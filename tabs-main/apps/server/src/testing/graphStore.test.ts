import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TestingGraphStore } from "./graphStore";
import { RuntimeSqliteDatabase } from "./sqlite";

describe("TestingGraphStore", () => {
  it("persists graph, auth, PII, and cache metadata outside the project workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "tabs-testing-store-"));
    const databasePath = join(root, "testing", "state-graph.sqlite");
    const store = new TestingGraphStore(databasePath);
    try {
      const runId = store.beginRun("project", "https://example.test");
      store.upsertNode({
        projectId: "project",
        runId,
        stateId: "state-a",
        pageUrl: "https://example.test",
        pageTitle: "Example",
        snapshot: '- main "Example"',
      });
      store.upsertNode({
        projectId: "project",
        runId,
        stateId: "state-b",
        pageUrl: "https://example.test/next",
        pageTitle: "Next",
        snapshot: '- main "Next"',
      });
      store.upsertEdge({
        projectId: "project",
        runId,
        fromStateId: "state-a",
        toStateId: "state-b",
        role: "link",
        name: "Next",
      });
      store.cacheSubtree("project", "header", '- banner "Shared"');
      store.cacheSubtree("project", "header", '- banner "Shared"');
      store.recordAuthSession("project", join(root, "auth"));
      store.finishRun(runId, "completed");

      expect(store.summary("project")).toMatchObject({
        nodeCount: 2,
        edgeCount: 1,
        cacheEntryCount: 1,
        cacheHitCount: 1,
        lastRunStatus: "completed",
      });
    } finally {
      store.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("marks an interrupted crawl as failed when storage is reopened", async () => {
    const root = await mkdtemp(join(tmpdir(), "tabs-testing-store-recovery-"));
    const databasePath = join(root, "testing", "state-graph.sqlite");
    const firstStore = new TestingGraphStore(databasePath);
    firstStore.beginRun("project", "https://example.test");
    firstStore.close();

    const reopenedStore = new TestingGraphStore(databasePath);
    try {
      expect(reopenedStore.summary("project")).toMatchObject({
        lastRunStatus: "failed",
        lastRunError: "Interrupted before completion",
      });
    } finally {
      reopenedStore.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists scoped-run configuration and completion metrics additively", async () => {
    const root = await mkdtemp(join(tmpdir(), "tabs-testing-store-scope-"));
    const databasePath = join(root, "testing", "state-graph.sqlite");
    const store = new TestingGraphStore(databasePath);
    const runId = store.beginRun("project", "https://example.test/settings", {
      scope: "path",
      maxStates: 75,
      maxDurationSeconds: 300,
    });
    store.finishRun(runId, "completed", null, {
      terminationReason: "time-budget",
      statesVisited: 12,
      transitionsObserved: 18,
      durationMs: 300_100,
    });
    store.close();

    try {
      const database = new RuntimeSqliteDatabase(databasePath, { readonly: true });
      const row = database
        .query<
          {
            scope: string;
            max_states: number;
            max_duration_seconds: number;
            termination_reason: string;
            states_visited: number;
            transitions_observed: number;
            duration_ms: number;
          },
          []
        >(
          `SELECT scope, max_states, max_duration_seconds, termination_reason, states_visited,
            transitions_observed, duration_ms FROM crawl_runs`,
        )
        .get();
      database.close();

      expect(row).toEqual({
        scope: "path",
        max_states: 75,
        max_duration_seconds: 300,
        termination_reason: "time-budget",
        states_visited: 12,
        transitions_observed: 18,
        duration_ms: 300_100,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("stores reconciled cases, review history, dual-mode status, and clears only graph data", async () => {
    const root = await mkdtemp(join(tmpdir(), "tabs-testing-cases-"));
    const databasePath = join(root, "testing", "state-graph.sqlite");
    const store = new TestingGraphStore(databasePath);
    try {
      const runId = store.beginRun("project", "https://example.test");
      store.upsertNode({
        projectId: "project",
        runId,
        stateId: "root",
        pageUrl: "https://example.test",
        pageTitle: "Home",
        snapshot: "Home",
      });
      store.finishRun(runId, "completed");
      const imported = store.saveImportedCases({
        projectId: "project",
        workbookName: "cases.xlsx",
        workbookPath: "/tmp/cases.xlsx",
        cases: [
          {
            externalId: "QA-001",
            description: "Open home",
            steps: ["Open home"],
            sourceSheet: "Cases",
            sourceRow: 2,
            status: "matches",
            mismatches: [],
            matchedStateIds: ["root"],
          },
        ],
      });

      expect(imported).toMatchObject({ importedCount: 1, matchesCount: 1 });
      expect(imported.cases[0]).toMatchObject({
        externalId: "QA-001",
        standaloneStatus: "not-yet-tested",
        ciStatus: null,
      });
      expect(store.listCases("another-project").cases).toHaveLength(0);
      expect(store.summary("another-project")).toMatchObject({ nodeCount: 0, edgeCount: 0 });
      const reviewed = store.reviewCase({
        projectId: "project",
        caseId: imported.cases[0]!.id,
        decision: "edited",
        externalId: "QA-HOME-001",
        description: "Open the home page",
        steps: ["Navigate home"],
        notes: "Aligned with company wording",
      });
      expect(reviewed.cases[0]).toMatchObject({
        reviewDecision: "edited",
        externalId: "QA-HOME-001",
        description: "Open the home page",
        notes: "Aligned with company wording",
      });

      const cleared = store.clearGraph("project");
      expect(cleared).toMatchObject({ clearedNodeCount: 1, nodeCount: 0, edgeCount: 0 });
      expect(store.listCases("project").cases).toHaveLength(1);
    } finally {
      store.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
