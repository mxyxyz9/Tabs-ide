import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

import {
  DEFAULT_TESTING_BATCH_MAX_CASES,
  DEFAULT_TESTING_BATCH_MAX_COST_USD,
  DEFAULT_TESTING_BATCH_MAX_TOKENS,
  type TestingCaseSummary,
  type TestingGenerationInput,
  type TestingGenerationJob,
  type TestingLocatorEntry,
} from "@tabs/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import type { TextGenerationShape } from "../textGeneration/TextGeneration";
import type { StoredGraphEdge, StoredGraphNode, TestingGraphStore } from "./graphStore";
import type { LocatorLibraryStore } from "./locatorLibrary";
import { sanitizePersistedUrl, shortDigest } from "./security";

const GenerationPlan = Schema.Struct({
  featureSlug: Schema.String,
  testTitle: Schema.String,
  assertionText: Schema.String,
});

type GenerationPlan = typeof GenerationPlan.Type;

interface TestingGenerationTemplate {
  readonly version: 1;
  readonly name: string;
  readonly directories: {
    readonly pages: string;
    readonly data: string;
    readonly specs: string;
  };
  readonly filePatterns: {
    readonly pageObject: string;
    readonly data: string;
    readonly spec: string;
  };
  readonly classPattern: string;
}

interface GenerationLocator {
  readonly key: string;
  readonly strategy: TestingLocatorEntry["strategy"];
  readonly arguments: Readonly<Record<string, string | number | boolean>>;
  readonly semanticContext: string;
  readonly graphStateId: string;
  readonly urlPattern: string;
  readonly locatorEntryId?: string;
  readonly locatorVersionId?: string;
}

const BUILT_IN_TEMPLATE: TestingGenerationTemplate = {
  version: 1,
  name: "Built-in Playwright Page Object Model",
  directories: { pages: "pages", data: "data", specs: "specs" },
  filePatterns: {
    pageObject: "{caseId}-{feature}.page.ts",
    data: "{caseId}-{feature}.data.ts",
    spec: "{caseId}-{feature}.spec.ts",
  },
  classPattern: "{featurePascal}Page",
};

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "generated-case"
  );
}

function identifier(value: string): string {
  const words = slug(value).split("-").filter(Boolean);
  const combined = words
    .map((word, index) => (index === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join("");
  return /^[a-zA-Z_$]/.test(combined) ? combined : `item${combined}`;
}

function pascal(value: string): string {
  const result = identifier(value);
  return `${result.charAt(0).toUpperCase()}${result.slice(1)}`;
}

function edgesForCase(
  testCase: TestingCaseSummary,
  graph: {
    readonly nodes: ReadonlyArray<StoredGraphNode>;
    readonly edges: ReadonlyArray<StoredGraphEdge>;
  },
): ReadonlyArray<StoredGraphEdge> {
  const edges: StoredGraphEdge[] = [];
  for (let index = 0; index < testCase.matchedStateIds.length - 1; index += 1) {
    const fromStateId = testCase.matchedStateIds[index];
    const toStateId = testCase.matchedStateIds[index + 1];
    const edge = graph.edges.find(
      (candidate) => candidate.fromStateId === fromStateId && candidate.toStateId === toStateId,
    );
    if (edge) edges.push(edge);
  }
  return edges;
}

function graphLocators(
  edges: ReadonlyArray<StoredGraphEdge>,
  graph: { readonly nodes: ReadonlyArray<StoredGraphNode> },
  targetUrl: string,
): ReadonlyArray<GenerationLocator> {
  return edges.map((edge, index) => ({
    key: identifier(`${edge.name}-${index + 1}`),
    strategy: "role",
    arguments: { role: edge.role, name: edge.name },
    semanticContext: `${edge.role} ${edge.name}`,
    graphStateId: edge.fromStateId,
    urlPattern: graph.nodes.find((node) => node.stateId === edge.fromStateId)?.pageUrl ?? targetUrl,
  }));
}

function libraryLocators(
  entries: ReadonlyArray<TestingLocatorEntry>,
  targetUrl: string,
): ReadonlyArray<GenerationLocator> {
  return entries.map((entry) => ({
    key: identifier(entry.locatorKey),
    strategy: entry.strategy,
    arguments: entry.arguments,
    semanticContext: entry.semanticContext,
    graphStateId: entry.pageId,
    urlPattern: targetUrl,
    locatorEntryId: entry.id,
    locatorVersionId: entry.currentVersionId,
  }));
}

function ensureRepositoryOutput(projectPath: string, configuredPath: string | undefined): string {
  const root = resolve(projectPath);
  const output = resolve(root, configuredPath?.trim() || "tests/e2e/generated");
  const relativePath = relative(root, output);
  if (relativePath === "" || (!relativePath.startsWith(`..${sep}`) && relativePath !== "..")) {
    return output;
  }
  throw new Error("Repository test output must stay inside the selected project directory");
}

function safeRelativePath(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Template ${field} is required`);
  const normalized = value.trim().replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`Template ${field} must be a relative path without parent traversal`);
  }
  return normalized;
}

async function loadTemplate(
  projectPath: string,
  templatePath: string | undefined,
): Promise<TestingGenerationTemplate> {
  if (!templatePath?.trim()) return BUILT_IN_TEMPLATE;
  const root = resolve(projectPath);
  const resolvedPath = resolve(root, templatePath);
  const relativePath = relative(root, resolvedPath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    throw new Error("The company testing template must stay inside the selected project");
  }
  const raw = JSON.parse(await readFile(resolvedPath, "utf8")) as Record<string, unknown>;
  if (raw.version !== 1) {
    throw new Error("Company testing template version must be 1");
  }
  const directories = raw.directories as Record<string, unknown> | undefined;
  const filePatterns = raw.filePatterns as Record<string, unknown> | undefined;
  if (!directories || !filePatterns) {
    throw new Error("Template requires directories and filePatterns objects");
  }
  return {
    version: 1,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Company template",
    directories: {
      pages: safeRelativePath(directories.pages, "directories.pages"),
      data: safeRelativePath(directories.data, "directories.data"),
      specs: safeRelativePath(directories.specs, "directories.specs"),
    },
    filePatterns: {
      pageObject: safeRelativePath(filePatterns.pageObject, "filePatterns.pageObject"),
      data: safeRelativePath(filePatterns.data, "filePatterns.data"),
      spec: safeRelativePath(filePatterns.spec, "filePatterns.spec"),
    },
    classPattern: safeRelativePath(raw.classPattern, "classPattern"),
  };
}

function applyTemplatePattern(
  pattern: string,
  values: { readonly caseId: string; readonly feature: string; readonly featurePascal: string },
): string {
  const rendered = pattern
    .replaceAll("{caseId}", values.caseId)
    .replaceAll("{feature}", values.feature)
    .replaceAll("{featurePascal}", values.featurePascal);
  if (/\{[^}]+\}/.test(rendered)) throw new Error(`Unsupported template placeholder in ${pattern}`);
  return rendered;
}

function buildPrompt(
  testCase: TestingCaseSummary,
  locators: ReadonlyArray<GenerationLocator>,
): string {
  const lines = [
    `Case ID: ${testCase.externalId}`,
    `Description: ${testCase.description}`,
    "Reviewed steps:",
    ...testCase.steps.map((step, index) => `${index + 1}. ${step}`),
    "Verified intent path:",
    ...locators.map(
      (locator) => `${locator.key}: ${locator.strategy} ${JSON.stringify(locator.arguments)}`,
    ),
  ];
  lines.push(`Expected Result: ${testCase.expectedResult}`);
  lines.push(
    "Given the expected result above, choose a concise feature slug, a business-readable test title, and one final visible assertion text that can be confirmed with page.getByText().",
  );
  return lines.join("\n");
}

function pageObjectSource(input: {
  readonly className: string;
  readonly locators: ReadonlyArray<GenerationLocator>;
}): string {
  const declarations = input.locators.map((locator) => `  readonly ${locator.key}: Locator;`);
  const expression = (locator: GenerationLocator): string => {
    const args = locator.arguments;
    switch (locator.strategy) {
      case "role":
        return `page.getByRole(${JSON.stringify(String(args.role))} as Parameters<Page["getByRole"]>[0], { name: ${JSON.stringify(String(args.name ?? ""))} })`;
      case "label":
        return `page.getByLabel(${JSON.stringify(String(args.label))})`;
      case "test-id":
        return `page.getByTestId(${JSON.stringify(String(args.testId))})`;
      case "placeholder":
        return `page.getByPlaceholder(${JSON.stringify(String(args.placeholder))})`;
      case "alt-text":
        return `page.getByAltText(${JSON.stringify(String(args.altText))})`;
      case "title":
        return `page.getByTitle(${JSON.stringify(String(args.title))})`;
      case "text":
        return `page.getByText(${JSON.stringify(String(args.text))})`;
      case "css":
        return `page.locator(${JSON.stringify(String(args.selector))})`;
    }
  };
  const assignments = input.locators.map(
    (locator) => `    this.${locator.key} = ${expression(locator)};`,
  );
  const methods = input.locators.flatMap((locator) => {
    const key = locator.key;
    return [
      `  async ${identifier(`activate-${key}`)}(): Promise<void> {`,
      `    await this.${key}.click();`,
      "  }",
    ];
  });
  return [
    'import type { Locator, Page } from "playwright/test";',
    "",
    `export class ${input.className} {`,
    "  readonly page: Page;",
    ...declarations,
    "",
    "  constructor(page: Page) {",
    "    this.page = page;",
    ...assignments,
    "  }",
    "",
    ...methods,
    "}",
    "",
  ].join("\n");
}

function dataSource(input: {
  readonly targetUrl: string;
  readonly testCase: TestingCaseSummary;
  readonly plan: GenerationPlan;
}): string {
  return [
    "export const testData = ",
    JSON.stringify(
      {
        caseId: input.testCase.externalId,
        targetUrl: input.targetUrl,
        description: input.testCase.description,
        steps: input.testCase.steps,
        expectedResult: input.testCase.expectedResult,
        assertionText: input.plan.assertionText,
      },
      null,
      2,
    ),
    " as const;",
    "",
  ].join("");
}

function specSource(input: {
  readonly className: string;
  readonly plan: GenerationPlan;
  readonly locators: ReadonlyArray<GenerationLocator>;
  readonly dataImport: string;
  readonly pageImport: string;
}): string {
  return [
    'import { expect, test } from "playwright/test";',
    `import { testData } from ${JSON.stringify(input.dataImport)};`,
    `import { ${input.className} } from ${JSON.stringify(input.pageImport)};`,
    "",
    `test(${JSON.stringify(input.plan.testTitle)}, async ({ page }) => {`,
    "  const app = new " + input.className + "(page);",
    "  await page.goto(process.env.TESTING_BASE_URL ?? testData.targetUrl);",
    ...input.locators.map((locator) => `  await app.${identifier(`activate-${locator.key}`)}();`),
    "  await expect(page.getByText(testData.assertionText, { exact: false }).first()).toBeVisible();",
    "});",
    "",
  ].join("\n");
}

export class TestingGenerator {
  readonly #cancelledJobs = new Set<string>();
  #queueTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: TestingGraphStore,
    private readonly locatorStore: LocatorLibraryStore,
    private readonly testingRoot: string,
    private readonly textGeneration: TextGenerationShape,
  ) {}

  generate(input: TestingGenerationInput): Promise<TestingGenerationJob> {
    const allCases = this.store.listCases(input.projectId).cases;
    const requested = input.caseIds
      ? allCases.filter((testCase) => input.caseIds?.includes(testCase.id))
      : allCases.filter(
          (testCase) =>
            testCase.reviewDecision === "accepted" || testCase.reviewDecision === "edited",
        );
    const maxCases = input.maxCases ?? DEFAULT_TESTING_BATCH_MAX_CASES;
    const cases = requested.slice(0, maxCases);
    if (cases.length === 0) {
      throw new Error("Select or accept at least one reconciled case before generation");
    }
    const missingExpected = cases.find((c) => !c.expectedResult?.trim());
    if (missingExpected) {
      throw new Error(
        `Case ${missingExpected.externalId} is missing an expected result. Update the case before generation.`,
      );
    }
    const jobId = crypto.randomUUID();
    const outputDirectory =
      (input.outputMode ?? "managed") === "repository"
        ? ensureRepositoryOutput(input.projectPath, input.repositoryOutputPath)
        : resolve(this.testingRoot, "generated", shortDigest(input.projectId), jobId);
    this.store.createGenerationJob({
      id: jobId,
      projectId: input.projectId,
      outputDirectory,
      totalCases: cases.length,
      modelSelection: input.modelSelection,
    });

    const run = this.#queueTail.then(() => this.#run(jobId, input, cases, outputDirectory));
    this.#queueTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  cancel(projectId: string, jobId: string): TestingGenerationJob {
    const job = this.store.generationJob(projectId, jobId);
    if (!job) throw new Error("Generation job was not found");
    if (job.status === "queued" || job.status === "running") {
      this.#cancelledJobs.add(jobId);
      this.store.updateGenerationJob(jobId, { status: "cancelled", error: "Cancelled by user" });
    }
    return this.store.generationJob(projectId, jobId)!;
  }

  async #run(
    jobId: string,
    input: TestingGenerationInput,
    cases: ReadonlyArray<TestingCaseSummary>,
    outputDirectory: string,
  ): Promise<TestingGenerationJob> {
    const maxTokens = input.maxEstimatedTokens ?? DEFAULT_TESTING_BATCH_MAX_TOKENS;
    const maxCost = input.maxEstimatedCostUsd ?? DEFAULT_TESTING_BATCH_MAX_COST_USD;
    let completedCases = 0;
    let estimatedTokens = 0;
    let estimatedCostUsd = 0;
    const blockedCases: string[] = [];
    this.store.updateGenerationJob(jobId, { status: "running" });
    try {
      const template = await loadTemplate(input.projectPath, input.templatePath);
      await Promise.all(
        Object.values(template.directories).map((directory) =>
          mkdir(resolve(outputDirectory, directory), { recursive: true }),
        ),
      );
      const graph = this.store.graph(input.projectId);
      const targetUrl =
        (input.targetUrl ? sanitizePersistedUrl(input.targetUrl) : null) ??
        this.store.summary(input.projectId).targetUrl ??
        this.locatorStore
          .library(input.projectId)
          .pages.find((page) => !page.urlPattern.startsWith("https://repository.invalid/"))
          ?.urlPattern;
      if (!targetUrl)
        throw new Error("The project has no captured target URL for generated test data");
      for (const testCase of cases) {
        if (this.#cancelledJobs.has(jobId)) break;
        const edges = edgesForCase(testCase, graph);
        const caseLocatorEntries = this.locatorStore.caseLocators(input.projectId, testCase.id);
        const invalidEntry = caseLocatorEntries.find(
          (entry) =>
            entry.lifecycleStatus !== "accepted" || entry.verificationStatus !== "verified",
        );
        if (invalidEntry) {
          blockedCases.push(
            `${testCase.externalId}: ${invalidEntry.locatorKey} is ${invalidEntry.verificationStatus}`,
          );
          continue;
        }
        const mappedLocators = libraryLocators(
          caseLocatorEntries.filter((entry) => entry.classification === "action"),
          targetUrl,
        );
        const locators =
          mappedLocators.length > 0 ? mappedLocators : graphLocators(edges, graph, targetUrl);
        if (locators.length === 0) {
          blockedCases.push(`${testCase.externalId}: no verified Locator Library mapping`);
          continue;
        }
        const sanitizedPrompt = buildPrompt(testCase, locators);
        const nextTokens = Math.ceil(sanitizedPrompt.length / 4) + 1_500;
        const nextCost = nextTokens * 0.00001;
        if (estimatedTokens + nextTokens > maxTokens || estimatedCostUsd + nextCost > maxCost) {
          this.store.updateGenerationJob(jobId, {
            status: "budget-stopped",
            completedCases,
            estimatedTokens,
            estimatedCostUsd,
            error: "Stopped before dispatch because the next case would exceed the batch budget",
          });
          return this.store.generationJob(input.projectId, jobId)!;
        }
        const plan = await Effect.runPromise(
          this.textGeneration.generateStructuredTesting({
            cwd: input.projectPath,
            taskKind: "test-generation",
            sanitizedPrompt,
            outputSchema: GenerationPlan,
            modelSelection: input.modelSelection,
            reasoningTier: input.reasoningTier ?? "medium",
            budget: { maxEstimatedTokens: maxTokens, maxEstimatedCostUsd: maxCost },
          }),
        );
        const caseSlug = slug(testCase.externalId);
        const planSlug = slug(plan.featureSlug);
        const featureSlug = `${caseSlug}-${planSlug}`;
        const templateValues = {
          caseId: caseSlug,
          feature: planSlug,
          featurePascal: pascal(plan.featureSlug),
        };
        const className = applyTemplatePattern(template.classPattern, templateValues);
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(className)) {
          throw new Error("Template classPattern must produce a valid TypeScript class name");
        }
        const pageObjectPath = resolve(
          outputDirectory,
          template.directories.pages,
          applyTemplatePattern(template.filePatterns.pageObject, templateValues),
        );
        const dataPath = resolve(
          outputDirectory,
          template.directories.data,
          applyTemplatePattern(template.filePatterns.data, templateValues),
        );
        const specPath = resolve(
          outputDirectory,
          template.directories.specs,
          applyTemplatePattern(template.filePatterns.spec, templateValues),
        );
        const dataImport = relative(resolve(outputDirectory, template.directories.specs), dataPath)
          .replaceAll(sep, "/")
          .replace(/\.ts$/, "");
        const pageImport = relative(
          resolve(outputDirectory, template.directories.specs),
          pageObjectPath,
        )
          .replaceAll(sep, "/")
          .replace(/\.ts$/, "");
        await Promise.all([
          mkdir(dirname(pageObjectPath), { recursive: true }),
          mkdir(dirname(dataPath), { recursive: true }),
          mkdir(dirname(specPath), { recursive: true }),
        ]);
        await Promise.all([
          writeFile(pageObjectPath, pageObjectSource({ className, locators }), "utf8"),
          writeFile(dataPath, dataSource({ targetUrl, testCase, plan }), "utf8"),
          writeFile(
            specPath,
            specSource({
              className,
              plan,
              locators,
              dataImport: dataImport.startsWith(".") ? dataImport : `./${dataImport}`,
              pageImport: pageImport.startsWith(".") ? pageImport : `./${pageImport}`,
            }),
            "utf8",
          ),
        ]);
        this.store.addGeneratedArtifact({
          jobId,
          caseId: testCase.id,
          externalId: testCase.externalId,
          featureSlug,
          pageObjectPath,
          dataPath,
          specPath,
          captureReplay: input.captureReplay ?? false,
          fingerprints: locators.map((locator, index) => ({
            locatorKey: locator.key,
            role: String(locator.arguments.role ?? locator.strategy),
            accessibleName: String(
              locator.arguments.name ??
                locator.arguments.label ??
                locator.arguments.testId ??
                locator.arguments.text ??
                "",
            ),
            semanticContext: testCase.steps[index] ?? locator.semanticContext,
            graphStateId: locator.graphStateId,
            urlPattern: locator.urlPattern,
            ...(locator.locatorEntryId ? { locatorEntryId: locator.locatorEntryId } : {}),
            ...(locator.locatorVersionId ? { locatorVersionId: locator.locatorVersionId } : {}),
          })),
        });
        completedCases += 1;
        estimatedTokens += nextTokens;
        estimatedCostUsd += nextCost;
        this.store.updateGenerationJob(jobId, {
          status: "running",
          completedCases,
          estimatedTokens,
          estimatedCostUsd,
        });
      }
      const status = this.#cancelledJobs.has(jobId)
        ? "cancelled"
        : completedCases === 0 && blockedCases.length > 0
          ? "failed"
          : "completed";
      this.store.updateGenerationJob(jobId, {
        status,
        completedCases,
        estimatedTokens,
        estimatedCostUsd,
        ...(blockedCases.length > 0
          ? { error: `Blocked cases requiring locator resolution: ${blockedCases.join("; ")}` }
          : {}),
      });
    } catch (error) {
      this.store.updateGenerationJob(jobId, {
        status: "failed",
        completedCases,
        estimatedTokens,
        estimatedCostUsd,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.#cancelledJobs.delete(jobId);
    }
    return this.store.generationJob(input.projectId, jobId)!;
  }
}
