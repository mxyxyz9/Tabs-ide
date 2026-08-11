# Testing generation templates

Tabs includes a built-in Playwright TypeScript Page Object Model template. A project can instead
provide a JSON manifest like `company-playwright.example.json` and enter its repository-relative
path in Testing.

The manifest is intentionally declarative. It can select relative directories, file names, and a
page-object class name, but it cannot execute code or inject instructions into the coding-agent
prompt. Version 1 supports these placeholders:

- `{caseId}`: normalized external test-case ID
- `{feature}`: normalized feature name selected from the reviewed case
- `{featurePascal}`: the feature name as a TypeScript-style PascalCase identifier

All paths must stay inside the project. Generated files are always separated into page objects,
data fixtures, and business-flow specs. Choose repository output explicitly when the manifest's
directories are rooted at repository paths; managed output remains the safer default.
