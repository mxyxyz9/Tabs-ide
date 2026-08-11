import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type {
  TestingCaseListResult,
  TestingCaseReviewInput,
  TestingCaseSummary,
  TestingClearGraphResult,
  TestingExplorationResult,
  TestingExplorationScope,
  TestingGraphSummary,
  TestingGeneratedArtifact,
  TestingGenerationJob,
  TestingGenerationJobListResult,
  TestingMismatch,
  TestingWorkbookImportResult,
} from "@tabs/contracts";

import type { PiiToken } from "./security";
import { RuntimeSqliteDatabase } from "./sqlite";

type RunStatus = TestingGraphSummary["lastRunStatus"];

interface CountRow {
  readonly count: number;
}

interface StatusRow {
  readonly target_url: string;
  readonly status: RunStatus;
  readonly error: string | null;
}

interface AuthRow {
  readonly captured_at: string;
}

interface TableInfoRow {
  readonly name: string;
}

export interface StoredGraphNode {
  readonly stateId: string;
  readonly pageUrl: string;
  readonly pageTitle: string;
  readonly snapshot: string;
}

export interface StoredGraphEdge {
  readonly fromStateId: string;
  readonly toStateId: string;
  readonly role: string;
  readonly name: string;
  readonly intentLocator: string;
}

interface StoredCaseRow {
  readonly id: string;
  readonly external_id: string;
  readonly source: TestingCaseSummary["source"];
  readonly description: string;
  readonly steps_json: string;
  readonly source_sheet: string | null;
  readonly source_row: number | null;
  readonly reconciliation_status: TestingCaseSummary["status"];
  readonly review_decision: TestingCaseSummary["reviewDecision"];
  readonly mismatches_json: string;
  readonly matched_state_ids_json: string;
  readonly standalone_status: TestingCaseSummary["standaloneStatus"];
  readonly ci_status: TestingCaseSummary["ciStatus"];
  readonly notes: string;
}

interface StoredGenerationJobRow {
  readonly id: string;
  readonly project_id: string;
  readonly status: TestingGenerationJob["status"];
  readonly framework: "playwright-ts";
  readonly provider_instance_id: string;
  readonly model: string;
  readonly model_options_json: string;
  readonly output_directory: string;
  readonly total_cases: number;
  readonly completed_cases: number;
  readonly estimated_tokens: number;
  readonly estimated_cost_usd: number;
  readonly error: string | null;
}

function ensureCrawlRunColumn(
  database: RuntimeSqliteDatabase,
  name: string,
  definition: string,
): void {
  const columns = database.query<TableInfoRow, []>("PRAGMA table_info(crawl_runs)").all();
  if (!columns.some((column) => column.name === name)) {
    database.exec(`ALTER TABLE crawl_runs ADD COLUMN ${name} ${definition}`);
  }
}

function ensureTableColumn(
  database: RuntimeSqliteDatabase,
  table: string,
  name: string,
  definition: string,
): void {
  const columns = database.query<TableInfoRow, []>(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === name)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

export class TestingGraphStore {
  readonly databasePath: string;
  readonly #database: RuntimeSqliteDatabase;

  constructor(databasePath: string) {
    this.databasePath = databasePath;
    mkdirSync(dirname(databasePath), { recursive: true });
    this.#database = new RuntimeSqliteDatabase(databasePath);
    this.#database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS crawl_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        target_url TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
        error TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        scope TEXT NOT NULL DEFAULT 'origin',
        max_states INTEGER,
        max_duration_seconds INTEGER,
        termination_reason TEXT,
        states_visited INTEGER,
        transitions_observed INTEGER,
        duration_ms INTEGER
      );
      CREATE INDEX IF NOT EXISTS crawl_runs_project_started
        ON crawl_runs(project_id, started_at DESC);

      CREATE TABLE IF NOT EXISTS graph_nodes (
        project_id TEXT NOT NULL,
        state_id TEXT NOT NULL,
        page_url TEXT NOT NULL,
        page_title TEXT NOT NULL,
        sanitized_snapshot TEXT NOT NULL,
        first_seen_run_id TEXT NOT NULL REFERENCES crawl_runs(id),
        created_at TEXT NOT NULL,
        PRIMARY KEY(project_id, state_id)
      );

      CREATE TABLE IF NOT EXISTS graph_edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES crawl_runs(id),
        from_state_id TEXT NOT NULL,
        to_state_id TEXT NOT NULL,
        action_role TEXT NOT NULL,
        action_name TEXT NOT NULL,
        intent_locator TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, from_state_id, to_state_id, action_role, action_name)
      );

      CREATE TABLE IF NOT EXISTS pii_tokens (
        project_id TEXT NOT NULL,
        token TEXT NOT NULL,
        kind TEXT NOT NULL,
        plaintext TEXT NOT NULL,
        digest TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(project_id, token),
        UNIQUE(project_id, digest)
      );

      CREATE TABLE IF NOT EXISTS subtree_cache (
        project_id TEXT NOT NULL,
        subtree_hash TEXT NOT NULL,
        tokenized_content TEXT NOT NULL,
        approximate_tokens INTEGER NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT NOT NULL,
        PRIMARY KEY(project_id, subtree_hash)
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        project_id TEXT PRIMARY KEY,
        profile_path TEXT NOT NULL,
        captured_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS test_imports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        workbook_name TEXT NOT NULL,
        workbook_path TEXT NOT NULL,
        imported_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS test_imports_project_imported
        ON test_imports(project_id, imported_at DESC);

      CREATE TABLE IF NOT EXISTS test_cases (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        import_id TEXT REFERENCES test_imports(id),
        external_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('excel', 'generated')),
        description TEXT NOT NULL,
        steps_json TEXT NOT NULL,
        source_sheet TEXT,
        source_row INTEGER,
        reconciliation_status TEXT NOT NULL CHECK (
          reconciliation_status IN ('matches', 'needs-review', 'blocked')
        ),
        review_decision TEXT NOT NULL DEFAULT 'pending' CHECK (
          review_decision IN ('pending', 'accepted', 'edited', 'rejected')
        ),
        mismatches_json TEXT NOT NULL DEFAULT '[]',
        matched_state_ids_json TEXT NOT NULL DEFAULT '[]',
        standalone_status TEXT NOT NULL DEFAULT 'not-yet-tested' CHECK (
          standalone_status IN ('passed', 'failed', 'blocked', 'not-applicable', 'not-yet-tested')
        ),
        ci_status TEXT CHECK (ci_status IN ('pass', 'fail')),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS test_cases_project_created
        ON test_cases(project_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS test_case_reviews (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL REFERENCES test_cases(id),
        decision TEXT NOT NULL,
        previous_json TEXT NOT NULL,
        reviewed_json TEXT NOT NULL,
        notes TEXT NOT NULL,
        reviewed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS generation_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (
          status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'budget-stopped')
        ),
        framework TEXT NOT NULL,
        provider_instance_id TEXT NOT NULL DEFAULT 'codex',
        model TEXT NOT NULL DEFAULT 'gpt-5.3-codex',
        model_options_json TEXT NOT NULL DEFAULT '[]',
        output_directory TEXT NOT NULL,
        total_cases INTEGER NOT NULL,
        completed_cases INTEGER NOT NULL DEFAULT 0,
        estimated_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost_usd REAL NOT NULL DEFAULT 0,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS generation_jobs_project_created
        ON generation_jobs(project_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS generated_artifacts (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES generation_jobs(id),
        case_id TEXT NOT NULL REFERENCES test_cases(id),
        external_id TEXT NOT NULL,
        feature_slug TEXT NOT NULL,
        page_object_path TEXT NOT NULL,
        data_path TEXT NOT NULL,
        spec_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS locator_fingerprints (
        id TEXT PRIMARY KEY,
        artifact_id TEXT NOT NULL REFERENCES generated_artifacts(id),
        case_id TEXT NOT NULL,
        locator_key TEXT NOT NULL,
        role TEXT NOT NULL,
        accessible_name TEXT NOT NULL,
        stable_attributes_json TEXT NOT NULL DEFAULT '{}',
        semantic_context TEXT NOT NULL,
        graph_state_id TEXT NOT NULL,
        url_pattern TEXT NOT NULL,
        verified_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS network_replay_metadata (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        sanitized_entries_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );
    `);
    ensureCrawlRunColumn(this.#database, "scope", "TEXT NOT NULL DEFAULT 'origin'");
    ensureCrawlRunColumn(this.#database, "max_states", "INTEGER");
    ensureCrawlRunColumn(this.#database, "max_duration_seconds", "INTEGER");
    ensureCrawlRunColumn(this.#database, "termination_reason", "TEXT");
    ensureCrawlRunColumn(this.#database, "states_visited", "INTEGER");
    ensureCrawlRunColumn(this.#database, "transitions_observed", "INTEGER");
    ensureCrawlRunColumn(this.#database, "duration_ms", "INTEGER");
    ensureTableColumn(
      this.#database,
      "generation_jobs",
      "provider_instance_id",
      "TEXT NOT NULL DEFAULT 'codex'",
    );
    ensureTableColumn(
      this.#database,
      "generation_jobs",
      "model",
      "TEXT NOT NULL DEFAULT 'gpt-5.3-codex'",
    );
    ensureTableColumn(
      this.#database,
      "generation_jobs",
      "model_options_json",
      "TEXT NOT NULL DEFAULT '[]'",
    );
    this.#database
      .query(
        `UPDATE crawl_runs
         SET status = 'failed', error = ?, completed_at = ?
         WHERE status = 'running'`,
      )
      .run("Interrupted before completion", new Date().toISOString());
  }

  close(): void {
    this.#database.close();
  }

  beginRun(
    projectId: string,
    targetUrl: string,
    configuration: {
      readonly scope?: TestingExplorationScope;
      readonly maxStates?: number;
      readonly maxDurationSeconds?: number;
    } = {},
  ): string {
    const runId = crypto.randomUUID();
    this.#database
      .query(
        `INSERT INTO crawl_runs
          (id, project_id, target_url, status, started_at, scope, max_states, max_duration_seconds)
         VALUES (?, ?, ?, 'running', ?, ?, ?, ?)`,
      )
      .run(
        runId,
        projectId,
        targetUrl,
        new Date().toISOString(),
        configuration.scope ?? "origin",
        configuration.maxStates ?? null,
        configuration.maxDurationSeconds ?? null,
      );
    return runId;
  }

  finishRun(
    runId: string,
    status: "completed" | "failed",
    error: string | null = null,
    metrics?: Pick<
      TestingExplorationResult,
      "terminationReason" | "statesVisited" | "transitionsObserved" | "durationMs"
    >,
  ): void {
    this.#database
      .query(
        `UPDATE crawl_runs SET
          status = ?, error = ?, completed_at = ?, termination_reason = ?, states_visited = ?,
          transitions_observed = ?, duration_ms = ?
         WHERE id = ?`,
      )
      .run(
        status,
        error,
        new Date().toISOString(),
        metrics?.terminationReason ?? null,
        metrics?.statesVisited ?? null,
        metrics?.transitionsObserved ?? null,
        metrics?.durationMs ?? null,
        runId,
      );
  }

  upsertNode(input: {
    readonly projectId: string;
    readonly runId: string;
    readonly stateId: string;
    readonly pageUrl: string;
    readonly pageTitle: string;
    readonly snapshot: string;
  }): void {
    this.#database
      .query(
        `INSERT INTO graph_nodes
          (project_id, state_id, page_url, page_title, sanitized_snapshot, first_seen_run_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, state_id) DO UPDATE SET
          page_url = excluded.page_url,
          page_title = excluded.page_title,
          sanitized_snapshot = excluded.sanitized_snapshot`,
      )
      .run(
        input.projectId,
        input.stateId,
        input.pageUrl,
        input.pageTitle,
        input.snapshot,
        input.runId,
        new Date().toISOString(),
      );
  }

  upsertEdge(input: {
    readonly projectId: string;
    readonly runId: string;
    readonly fromStateId: string;
    readonly toStateId: string;
    readonly role: string;
    readonly name: string;
  }): void {
    this.#database
      .query(
        `INSERT OR IGNORE INTO graph_edges
          (project_id, run_id, from_state_id, to_state_id, action_role, action_name, intent_locator, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.projectId,
        input.runId,
        input.fromStateId,
        input.toStateId,
        input.role,
        input.name,
        `getByRole('${input.role}', { name: ${JSON.stringify(input.name)} })`,
        new Date().toISOString(),
      );
  }

  storePiiTokens(projectId: string, tokens: ReadonlyArray<PiiToken>): void {
    const statement = this.#database.query(
      `INSERT OR IGNORE INTO pii_tokens
        (project_id, token, kind, plaintext, digest, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const now = new Date().toISOString();
    this.#database.transaction(() => {
      for (const token of tokens) {
        statement.run(projectId, token.token, token.kind, token.plaintext, token.digest, now);
      }
    })();
  }

  cacheSubtree(projectId: string, subtreeHash: string, tokenizedContent: string): boolean {
    const existing = this.#database
      .query("SELECT subtree_hash FROM subtree_cache WHERE project_id = ? AND subtree_hash = ?")
      .get(projectId, subtreeHash);
    const now = new Date().toISOString();
    if (existing) {
      this.#database
        .query(
          "UPDATE subtree_cache SET hit_count = hit_count + 1, last_used_at = ? WHERE project_id = ? AND subtree_hash = ?",
        )
        .run(now, projectId, subtreeHash);
      return true;
    }
    this.#database
      .query(
        `INSERT INTO subtree_cache
          (project_id, subtree_hash, tokenized_content, approximate_tokens, last_used_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(projectId, subtreeHash, tokenizedContent, Math.ceil(tokenizedContent.length / 4), now);
    return false;
  }

  recordAuthSession(projectId: string, profilePath: string): void {
    this.#database
      .query(
        `INSERT INTO auth_sessions (project_id, profile_path, captured_at) VALUES (?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
          profile_path = excluded.profile_path,
          captured_at = excluded.captured_at`,
      )
      .run(projectId, profilePath, new Date().toISOString());
  }

  graph(projectId: string): {
    readonly nodes: ReadonlyArray<StoredGraphNode>;
    readonly edges: ReadonlyArray<StoredGraphEdge>;
  } {
    const nodes = this.#database
      .query<
        { state_id: string; page_url: string; page_title: string; sanitized_snapshot: string },
        [string]
      >(
        `SELECT state_id, page_url, page_title, sanitized_snapshot
         FROM graph_nodes WHERE project_id = ? ORDER BY created_at`,
      )
      .all(projectId)
      .map((row) => ({
        stateId: row.state_id,
        pageUrl: row.page_url,
        pageTitle: row.page_title,
        snapshot: row.sanitized_snapshot,
      }));
    const edges = this.#database
      .query<
        {
          from_state_id: string;
          to_state_id: string;
          action_role: string;
          action_name: string;
          intent_locator: string;
        },
        [string]
      >(
        `SELECT from_state_id, to_state_id, action_role, action_name, intent_locator
         FROM graph_edges WHERE project_id = ? ORDER BY id`,
      )
      .all(projectId)
      .map((row) => ({
        fromStateId: row.from_state_id,
        toStateId: row.to_state_id,
        role: row.action_role,
        name: row.action_name,
        intentLocator: row.intent_locator,
      }));
    return { nodes, edges };
  }

  saveImportedCases(input: {
    readonly projectId: string;
    readonly workbookName: string;
    readonly workbookPath: string;
    readonly cases: ReadonlyArray<
      Omit<
        TestingCaseSummary,
        "id" | "source" | "reviewDecision" | "standaloneStatus" | "ciStatus" | "notes"
      >
    >;
  }): TestingWorkbookImportResult {
    const importId = crypto.randomUUID();
    const now = new Date().toISOString();
    const importedCaseIds: string[] = [];
    const insertCase = this.#database.query(
      `INSERT INTO test_cases
        (id, project_id, import_id, external_id, source, description, steps_json, source_sheet,
         source_row, reconciliation_status, mismatches_json, matched_state_ids_json, created_at,
         updated_at)
       VALUES (?, ?, ?, ?, 'excel', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.#database.transaction(() => {
      this.#database
        .query(
          `INSERT INTO test_imports (id, project_id, workbook_name, workbook_path, imported_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(importId, input.projectId, input.workbookName, input.workbookPath, now);
      for (const testCase of input.cases) {
        const caseId = crypto.randomUUID();
        importedCaseIds.push(caseId);
        insertCase.run(
          caseId,
          input.projectId,
          importId,
          testCase.externalId,
          testCase.description,
          JSON.stringify(testCase.steps),
          testCase.sourceSheet,
          testCase.sourceRow,
          testCase.status,
          JSON.stringify(testCase.mismatches),
          JSON.stringify(testCase.matchedStateIds),
          now,
          now,
        );
      }
    })();
    const cases = this.listCases(input.projectId).cases.filter((testCase) =>
      importedCaseIds.includes(testCase.id),
    );
    return {
      importId,
      workbookName: input.workbookName,
      cases,
      importedCount: input.cases.length,
      matchesCount: input.cases.filter((testCase) => testCase.status === "matches").length,
      needsReviewCount: input.cases.filter((testCase) => testCase.status === "needs-review").length,
      blockedCount: input.cases.filter((testCase) => testCase.status === "blocked").length,
    };
  }

  saveGeneratedCases(
    projectId: string,
    cases: ReadonlyArray<{
      readonly externalId: string;
      readonly description: string;
      readonly steps: ReadonlyArray<string>;
      readonly matchedStateIds: ReadonlyArray<string>;
    }>,
  ): TestingCaseListResult {
    const now = new Date().toISOString();
    const statement = this.#database.query(
      `INSERT INTO test_cases
        (id, project_id, external_id, source, description, steps_json, reconciliation_status,
         mismatches_json, matched_state_ids_json, created_at, updated_at)
       VALUES (?, ?, ?, 'generated', ?, ?, 'matches', '[]', ?, ?, ?)`,
    );
    this.#database.transaction(() => {
      for (const testCase of cases) {
        statement.run(
          crypto.randomUUID(),
          projectId,
          testCase.externalId,
          testCase.description,
          JSON.stringify(testCase.steps),
          JSON.stringify(testCase.matchedStateIds),
          now,
          now,
        );
      }
    })();
    return this.listCases(projectId);
  }

  listCases(projectId: string): TestingCaseListResult {
    const rows = this.#database
      .query<StoredCaseRow, [string]>(
        `SELECT id, external_id, source, description, steps_json, source_sheet, source_row,
          reconciliation_status, review_decision, mismatches_json, matched_state_ids_json,
          standalone_status, ci_status, notes
         FROM test_cases WHERE project_id = ? ORDER BY created_at DESC, source_row`,
      )
      .all(projectId);
    return {
      cases: rows.map((row) => ({
        id: row.id,
        externalId: row.external_id,
        source: row.source,
        description: row.description,
        steps: JSON.parse(row.steps_json) as string[],
        sourceSheet: row.source_sheet,
        sourceRow: row.source_row,
        status: row.reconciliation_status,
        reviewDecision: row.review_decision,
        mismatches: JSON.parse(row.mismatches_json) as TestingMismatch[],
        matchedStateIds: JSON.parse(row.matched_state_ids_json) as string[],
        standaloneStatus: row.standalone_status,
        ciStatus: row.ci_status,
        notes: row.notes,
      })),
    };
  }

  reviewCase(input: TestingCaseReviewInput): TestingCaseListResult {
    const existing = this.listCases(input.projectId).cases.find((item) => item.id === input.caseId);
    if (!existing) throw new Error("Testing case was not found in this project");
    const description = input.description?.trim() || existing.description;
    const steps = input.steps?.map((step) => step.trim()).filter(Boolean) ?? existing.steps;
    if (input.decision === "edited" && (!description || steps.length === 0)) {
      throw new Error("Edited cases require a description and at least one step");
    }
    const reviewed = { ...existing, description, steps, reviewDecision: input.decision };
    const now = new Date().toISOString();
    this.#database.transaction(() => {
      this.#database
        .query(
          `UPDATE test_cases SET description = ?, steps_json = ?, review_decision = ?, notes = ?,
           updated_at = ? WHERE id = ? AND project_id = ?`,
        )
        .run(
          description,
          JSON.stringify(steps),
          input.decision,
          input.notes ?? existing.notes,
          now,
          input.caseId,
          input.projectId,
        );
      this.#database
        .query(
          `INSERT INTO test_case_reviews
           (id, case_id, decision, previous_json, reviewed_json, notes, reviewed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          crypto.randomUUID(),
          input.caseId,
          input.decision,
          JSON.stringify(existing),
          JSON.stringify(reviewed),
          input.notes ?? "",
          now,
        );
    })();
    return this.listCases(input.projectId);
  }

  clearGraph(projectId: string): TestingClearGraphResult {
    const before = this.summary(projectId);
    this.#database.transaction(() => {
      this.#database.query("DELETE FROM graph_edges WHERE project_id = ?").run(projectId);
      this.#database.query("DELETE FROM graph_nodes WHERE project_id = ?").run(projectId);
      this.#database.query("DELETE FROM subtree_cache WHERE project_id = ?").run(projectId);
      this.#database.query("DELETE FROM pii_tokens WHERE project_id = ?").run(projectId);
      this.#database.query("DELETE FROM crawl_runs WHERE project_id = ?").run(projectId);
    })();
    return {
      ...this.summary(projectId),
      clearedNodeCount: before.nodeCount,
      clearedEdgeCount: before.edgeCount,
    };
  }

  createGenerationJob(input: {
    readonly id: string;
    readonly projectId: string;
    readonly outputDirectory: string;
    readonly totalCases: number;
    readonly modelSelection: TestingGenerationJob["modelSelection"];
  }): void {
    const now = new Date().toISOString();
    this.#database
      .query(
        `INSERT INTO generation_jobs
          (id, project_id, status, framework, provider_instance_id, model, model_options_json,
           output_directory, total_cases, created_at, updated_at)
         VALUES (?, ?, 'queued', 'playwright-ts', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.projectId,
        input.modelSelection.instanceId,
        input.modelSelection.model,
        JSON.stringify(input.modelSelection.options ?? []),
        input.outputDirectory,
        input.totalCases,
        now,
        now,
      );
  }

  updateGenerationJob(
    id: string,
    patch: {
      readonly status: TestingGenerationJob["status"];
      readonly completedCases?: number;
      readonly estimatedTokens?: number;
      readonly estimatedCostUsd?: number;
      readonly error?: string | null;
    },
  ): void {
    this.#database
      .query(
        `UPDATE generation_jobs SET status = ?, completed_cases = COALESCE(?, completed_cases),
         estimated_tokens = COALESCE(?, estimated_tokens),
         estimated_cost_usd = COALESCE(?, estimated_cost_usd), error = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        patch.status,
        patch.completedCases ?? null,
        patch.estimatedTokens ?? null,
        patch.estimatedCostUsd ?? null,
        patch.error ?? null,
        new Date().toISOString(),
        id,
      );
  }

  addGeneratedArtifact(input: {
    readonly jobId: string;
    readonly caseId: string;
    readonly externalId: string;
    readonly featureSlug: string;
    readonly pageObjectPath: string;
    readonly dataPath: string;
    readonly specPath: string;
    readonly fingerprints: ReadonlyArray<{
      readonly locatorKey: string;
      readonly role: string;
      readonly accessibleName: string;
      readonly semanticContext: string;
      readonly graphStateId: string;
      readonly urlPattern: string;
    }>;
    readonly captureReplay: boolean;
  }): void {
    const artifactId = crypto.randomUUID();
    const now = new Date().toISOString();
    this.#database.transaction(() => {
      this.#database
        .query(
          `INSERT INTO generated_artifacts
           (id, job_id, case_id, external_id, feature_slug, page_object_path, data_path,
            spec_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          artifactId,
          input.jobId,
          input.caseId,
          input.externalId,
          input.featureSlug,
          input.pageObjectPath,
          input.dataPath,
          input.specPath,
          now,
        );
      const fingerprintStatement = this.#database.query(
        `INSERT INTO locator_fingerprints
         (id, artifact_id, case_id, locator_key, role, accessible_name, semantic_context,
          graph_state_id, url_pattern, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const fingerprint of input.fingerprints) {
        fingerprintStatement.run(
          crypto.randomUUID(),
          artifactId,
          input.caseId,
          fingerprint.locatorKey,
          fingerprint.role,
          fingerprint.accessibleName,
          fingerprint.semanticContext,
          fingerprint.graphStateId,
          fingerprint.urlPattern,
          now,
        );
      }
      this.#database
        .query(
          `INSERT INTO network_replay_metadata
           (id, case_id, enabled, sanitized_entries_json, created_at) VALUES (?, ?, ?, '[]', ?)`,
        )
        .run(crypto.randomUUID(), input.caseId, input.captureReplay ? 1 : 0, now);
    })();
  }

  listGenerationJobs(projectId: string): TestingGenerationJobListResult {
    const rows = this.#database
      .query<StoredGenerationJobRow, [string]>(
        `SELECT id, project_id, status, framework, provider_instance_id, model,
          model_options_json, output_directory, total_cases,
          completed_cases, estimated_tokens, estimated_cost_usd, error
         FROM generation_jobs WHERE project_id = ? ORDER BY created_at DESC`,
      )
      .all(projectId);
    const artifactStatement = this.#database.query<
      Omit<TestingGeneratedArtifact, "fingerprintCount"> & { fingerprint_count: number },
      [string]
    >(
      `SELECT a.case_id AS caseId, a.external_id AS externalId, a.feature_slug AS featureSlug,
        a.page_object_path AS pageObjectPath, a.data_path AS dataPath, a.spec_path AS specPath,
        COUNT(f.id) AS fingerprint_count
       FROM generated_artifacts a LEFT JOIN locator_fingerprints f ON f.artifact_id = a.id
       WHERE a.job_id = ? GROUP BY a.id ORDER BY a.created_at`,
    );
    return {
      jobs: rows.map((row) => {
        const options = JSON.parse(row.model_options_json) as NonNullable<
          TestingGenerationJob["modelSelection"]["options"]
        >;
        return {
          id: row.id,
          projectId: row.project_id,
          status: row.status,
          framework: row.framework,
          modelSelection: {
            instanceId:
              row.provider_instance_id as TestingGenerationJob["modelSelection"]["instanceId"],
            model: row.model,
            ...(options.length > 0 ? { options } : {}),
          },
          outputDirectory: row.output_directory,
          totalCases: row.total_cases,
          completedCases: row.completed_cases,
          estimatedTokens: row.estimated_tokens,
          estimatedCostUsd: row.estimated_cost_usd,
          error: row.error,
          artifacts: artifactStatement.all(row.id).map((artifact) => ({
            ...artifact,
            fingerprintCount: artifact.fingerprint_count,
          })),
        };
      }),
    };
  }

  generationJob(projectId: string, jobId: string): TestingGenerationJob | null {
    return this.listGenerationJobs(projectId).jobs.find((job) => job.id === jobId) ?? null;
  }

  summary(projectId: string): TestingGraphSummary {
    const latest = this.#database
      .query<StatusRow, [string]>(
        "SELECT target_url, status, error FROM crawl_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT 1",
      )
      .get(projectId);
    const auth = this.#database
      .query<AuthRow, [string]>("SELECT captured_at FROM auth_sessions WHERE project_id = ?")
      .get(projectId);
    const count = (table: "graph_nodes" | "graph_edges" | "subtree_cache") =>
      this.#database
        .query<CountRow, [string]>(`SELECT COUNT(*) AS count FROM ${table} WHERE project_id = ?`)
        .get(projectId)?.count ?? 0;
    const cacheHits =
      this.#database
        .query<CountRow, [string]>(
          "SELECT COALESCE(SUM(hit_count), 0) AS count FROM subtree_cache WHERE project_id = ?",
        )
        .get(projectId)?.count ?? 0;

    return {
      projectId,
      targetUrl: latest?.target_url ?? null,
      databasePath: this.databasePath,
      authCapturedAt: auth?.captured_at ?? null,
      nodeCount: count("graph_nodes"),
      edgeCount: count("graph_edges"),
      cacheEntryCount: count("subtree_cache"),
      cacheHitCount: cacheHits,
      lastRunStatus: latest?.status ?? "idle",
      lastRunError: latest?.error ?? null,
    };
  }
}
