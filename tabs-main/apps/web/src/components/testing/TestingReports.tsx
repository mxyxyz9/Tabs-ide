import React, { memo } from "react";
import { LoaderIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { useTestingData } from "./context";

export const TestingReports = memo(function TestingReports() {
  const {
    testerName,
    setTesterName,
    busyAction,
    generateSignoffReport,
    executionRuns,
    reportPaths,
    traceCaseId,
    setTraceCaseId,
    resolveTraceability,
    traceability,
    bugDraft,
    triageResult,
    graphExplorer,
  } = useTestingData();

  return (
    <section aria-labelledby="testing-reporting-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="testing-reporting-heading" className="text-lg font-semibold text-foreground">
          Reports and traceability
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Export a sign-off packet, resolve a case ID through its full evidence chain, and inspect the
          stored model of the application without reading source code.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>UAT sign-off report</CardTitle>
            <CardDescription>
              Creates matching Word and PDF reports from the latest completed Standalone round.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="testing-tester-name" className="text-sm font-medium">
                Tester name
              </label>
              <Input
                id="testing-tester-name"
                value={testerName}
                onChange={(event) => setTesterName(event.target.value)}
                disabled={busyAction !== null}
              />
            </div>
            <Button
              type="button"
              onClick={() => void generateSignoffReport()}
              disabled={
                busyAction !== null ||
                !testerName.trim() ||
                !executionRuns.some((run) => run.mode === "standalone" && run.completedAt)
              }
            >
              {busyAction === "report" ? (
                <LoaderIcon aria-hidden="true" className="animate-spin" />
              ) : null}
              Generate Word and PDF
            </Button>
            {reportPaths ? (
              <div className="space-y-1 text-xs text-muted-foreground" role="status">
                <p className="break-all">Word: {reportPaths.docxPath}</p>
                <p className="break-all">PDF: {reportPaths.pdfPath}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exact case lookup</CardTitle>
            <CardDescription>
              Use the original Excel ID or generated scenario ID; partial matches are not guessed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="testing-trace-case-id" className="text-sm font-medium">
                Case ID
              </label>
              <Input
                id="testing-trace-case-id"
                value={traceCaseId}
                onChange={(event) => setTraceCaseId(event.target.value)}
                placeholder="QA-0042"
                disabled={busyAction !== null}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void resolveTraceability()}
              disabled={busyAction !== null || !traceCaseId.trim()}
            >
              Resolve evidence chain
            </Button>
            {traceability ? (
              <div className="space-y-2 rounded-lg border border-border/70 p-4 text-sm">
                <p className="font-medium">
                  {traceability.case.externalId}: {traceability.case.description}
                </p>
                <p className="text-muted-foreground">
                  Current status: {traceability.case.standaloneStatus} ·{" "}
                  {traceability.generatedArtifacts.length} generated artifacts ·{" "}
                  {traceability.executions.length} executions · {traceability.healing.length}{" "}
                  healing decisions
                </p>
                {traceability.import ? (
                  <p className="break-all text-xs text-muted-foreground">
                    Workbook: {traceability.import.workbookName} ({traceability.import.workbookPath})
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {bugDraft ? (
        <Card>
          <CardHeader>
            <CardTitle>Local bug draft</CardTitle>
            <CardDescription>
              Review this draft. Testing will not file or transmit it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-xs">
              {bugDraft}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      {triageResult ? (
        <Card>
          <CardHeader>
            <CardTitle>Coding-agent triage</CardTitle>
            <CardDescription>
              Model inference is advisory and is kept separate from persisted observed facts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-xs">
              {triageResult}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>State graph explorer</CardTitle>
          <CardDescription>
            Accessible list alternative showing URLs, stored accessibility snapshots, linked cases,
            and transitions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-96 overflow-auto rounded-lg border border-border/70">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Stored application states and linked cases</caption>
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th scope="col" className="p-3">
                    State
                  </th>
                  <th scope="col" className="p-3">
                    URL and snapshot
                  </th>
                  <th scope="col" className="p-3">
                    Linked cases
                  </th>
                </tr>
              </thead>
              <tbody>
                {(graphExplorer?.nodes ?? []).map((node) => (
                  <tr key={node.stateId} className="border-t border-border/70 align-top">
                    <th scope="row" className="p-3 font-medium">
                      {node.pageTitle || node.stateId}
                    </th>
                    <td className="p-3">
                      <div className="break-all text-muted-foreground">{node.pageUrl}</div>
                      <pre className="mt-2 max-w-xl whitespace-pre-wrap">
                        {node.snapshot.slice(0, 500)}
                      </pre>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {node.linkedCaseIds.join(", ") || "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground" role="status">
            {graphExplorer?.nodes.length ?? 0} states and {graphExplorer?.edges.length ?? 0}{" "}
            transitions loaded.
          </p>
        </CardContent>
      </Card>
    </section>
  );
});

export default TestingReports;
