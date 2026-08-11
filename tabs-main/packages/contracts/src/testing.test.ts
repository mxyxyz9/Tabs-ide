import { describe, expect, it } from "vitest";
import * as Schema from "effect/Schema";

import {
  DEFAULT_TESTING_MAX_STATES,
  MAX_TESTING_DURATION_SECONDS,
  MAX_TESTING_MAX_STATES,
  TestingExplorationInput,
  TestingCaseReviewInput,
  TestingWorkbookImportInput,
} from "./testing";

const decodeExplorationInput = Schema.decodeUnknownSync(TestingExplorationInput);

describe("TestingExplorationInput", () => {
  it("accepts a configurable state limit", () => {
    expect(
      decodeExplorationInput({
        projectId: "project",
        targetUrl: "https://example.test",
        cdpEndpoint: "http://127.0.0.1:9224",
        scope: "path",
        maxStates: 150,
        maxDurationSeconds: 300,
      }),
    ).toMatchObject({
      maxStates: 150,
      maxDurationSeconds: 300,
      scope: "path",
      cdpEndpoint: "http://127.0.0.1:9224",
    });
  });

  it("allows callers to use the crawler default", () => {
    const decoded = decodeExplorationInput({
      projectId: "project",
      targetUrl: "https://example.test",
    });
    expect(decoded.maxStates ?? DEFAULT_TESTING_MAX_STATES).toBe(DEFAULT_TESTING_MAX_STATES);
  });

  it.each([0, 1.5, MAX_TESTING_MAX_STATES + 1])("rejects invalid state limit %s", (maxStates) => {
    expect(() =>
      decodeExplorationInput({
        projectId: "project",
        targetUrl: "https://example.test",
        maxStates,
      }),
    ).toThrow();
  });

  it.each([0, 1.5, MAX_TESTING_DURATION_SECONDS + 1])(
    "rejects invalid time budget %s",
    (maxDurationSeconds) => {
      expect(() =>
        decodeExplorationInput({
          projectId: "project",
          targetUrl: "https://example.test",
          maxDurationSeconds,
        }),
      ).toThrow();
    },
  );

  it("rejects unknown scope modes", () => {
    expect(() =>
      decodeExplorationInput({
        projectId: "project",
        targetUrl: "https://example.test",
        scope: "workspace",
      }),
    ).toThrow();
  });
});

describe("Testing Phase 2 inputs", () => {
  it("decodes workbook imports and review decisions", () => {
    expect(
      Schema.decodeUnknownSync(TestingWorkbookImportInput)({
        projectId: "project",
        workbookPath: "/tmp/cases.xlsx",
        targetUrl: "https://example.test",
      }),
    ).toMatchObject({ workbookPath: "/tmp/cases.xlsx" });
    expect(
      Schema.decodeUnknownSync(TestingCaseReviewInput)({
        projectId: "project",
        caseId: "case",
        decision: "edited",
        description: "Updated",
        steps: ["Open page"],
      }),
    ).toMatchObject({ decision: "edited" });
  });

  it("rejects unsupported review decisions", () => {
    expect(() =>
      Schema.decodeUnknownSync(TestingCaseReviewInput)({
        projectId: "project",
        caseId: "case",
        decision: "approved",
      }),
    ).toThrow();
  });
});
