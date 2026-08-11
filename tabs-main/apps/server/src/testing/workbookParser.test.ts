import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { reconcileWorkbookCase, scenariosFromGraph } from "./reconciliation";
import { parseSteps, parseTestingWorkbook } from "./workbookParser";

const graph = {
  nodes: [
    { stateId: "root", pageUrl: "https://app.test", pageTitle: "Home", snapshot: "Home" },
    {
      stateId: "profile",
      pageUrl: "https://app.test/profile",
      pageTitle: "Profile",
      snapshot: "Profile",
    },
    {
      stateId: "saved",
      pageUrl: "https://app.test/profile",
      pageTitle: "Saved",
      snapshot: "Changes saved",
    },
  ],
  edges: [
    {
      fromStateId: "root",
      toStateId: "profile",
      role: "link",
      name: "Profile",
      intentLocator: "getByRole('link', { name: 'Profile' })",
    },
    {
      fromStateId: "profile",
      toStateId: "saved",
      role: "button",
      name: "Save changes",
      intentLocator: "getByRole('button', { name: 'Save changes' })",
    },
  ],
} as const;

describe("Testing workbook ingestion and reconciliation", () => {
  it("parses numbered and newline-separated steps", () => {
    expect(parseSteps("1. Open profile\n2) Save changes")).toEqual([
      "Open profile",
      "Save changes",
    ]);
  });

  it("imports the controlled workbook with provenance and row-level errors", async () => {
    const fixturePath = resolve(
      import.meta.dirname,
      "../../../../../testing/fixtures/phase2-controlled.xlsx",
    );
    const parsed = await parseTestingWorkbook(fixturePath);

    expect(parsed.workbookName).toBe("phase2-controlled.xlsx");
    expect(parsed.cases).toHaveLength(6);
    expect(parsed.cases[0]).toMatchObject({
      externalId: "QA-001",
      sourceSheet: "QA Cases",
      sourceRow: 4,
      steps: ['Activate link "Profile"', 'Activate button "Save changes"'],
    });
    expect(parsed.cases[0]?.errors).toContain("Duplicate Case ID");
    expect(parsed.cases[2]?.errors).toContain("Duplicate Case ID");
    expect(parsed.cases[3]?.errors).toContain("Case ID is blank");
    expect(parsed.cases[4]?.errors).toContain("Steps are blank or malformed");
  });

  it("finds a reachable path and surfaces a deliberate mismatch", async () => {
    const fixturePath = resolve(
      import.meta.dirname,
      "../../../../../testing/fixtures/phase2-controlled.xlsx",
    );
    const parsed = await parseTestingWorkbook(fixturePath);
    const valid = reconcileWorkbookCase(parsed.cases[5]!, graph);
    const mismatch = reconcileWorkbookCase(parsed.cases[1]!, graph);

    expect(valid.status).toBe("matches");
    expect(valid.matchedStateIds).toEqual(["root", "profile", "saved"]);
    expect(mismatch.status).toBe("needs-review");
    expect(mismatch.mismatches[0]).toMatchObject({
      kind: "unreachable",
      expected: 'Activate button "Delete account"',
    });
  });

  it("generates starter scenarios only from reachable graph transitions", () => {
    const scenarios = scenariosFromGraph(graph);
    expect(scenarios).toHaveLength(2);
    expect(scenarios[1]).toMatchObject({
      externalId: "DISCOVERED-002",
      matchedStateIds: ["root", "profile", "saved"],
    });
  });
});
