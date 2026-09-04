import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";
import { ProviderInstanceId, type TestingCaseSummary } from "@tabs/contracts";
import type { TextGenerationShape } from "../textGeneration/TextGeneration";
import { generateOfficialPlaywright } from "./officialPlaywright";

describe("official Playwright candidate integration (no model calls)", () => {
  it("passes tools and selected model to the backend and validates its candidate with Playwright", async () => {
    const root = await mkdtemp(join(process.cwd(), "official-agent-test-"));
    const modelSelection = {
      instanceId: ProviderInstanceId.makeUnsafe("chosen-codex"),
      model: "chosen-model",
    };
    let captured: unknown;
    const textGeneration = {
      generateStructuredTesting: (input: { cwd: string }) =>
        Effect.tryPromise(async () => {
          captured = input;
          await writeFile(
            join(input.cwd, "tests/generated.spec.ts"),
            'import { test, expect } from "playwright/test"; test("reviewed candidate", () => { expect(1).toBe(1); });',
          );
          return { summary: "Mock candidate only", blockedReason: "" };
        }),
    } as unknown as TextGenerationShape;
    try {
      const files = await generateOfficialPlaywright({
        request: {
          projectId: "project",
          projectPath: root,
          targetUrl: "https://example.test",
          modelSelection,
        },
        testCase: {
          id: "case",
          externalId: "TC-1",
          steps: ["Open page"],
          expectedResult: "Page appears",
        } as unknown as TestingCaseSummary,
        outputDirectory: root,
        textGeneration,
      });
      expect(captured).toMatchObject({
        modelSelection,
        playwrightTools: { cwd: expect.stringContaining("agent-") },
      });
      expect(await readFile(files.specPath, "utf8")).toContain("reviewed candidate");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("does not accept a blocked agent response as generated code", async () => {
    const root = await mkdtemp(join(process.cwd(), "official-agent-blocked-"));
    try {
      await expect(
        generateOfficialPlaywright({
          request: {
            projectId: "project",
            projectPath: root,
            targetUrl: "https://example.test",
            modelSelection: {
              instanceId: ProviderInstanceId.makeUnsafe("codex"),
              model: "selected",
            },
          },
          testCase: {
            id: "case",
            steps: [],
            expectedResult: "Page",
          } as unknown as TestingCaseSummary,
          outputDirectory: root,
          textGeneration: {
            generateStructuredTesting: () =>
              Effect.succeed({ summary: "", blockedReason: "Authentication required" }),
          } as unknown as TextGenerationShape,
        }),
      ).rejects.toThrow("Authentication required");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
