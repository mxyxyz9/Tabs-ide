import React, { memo } from "react";
import { LoaderIcon, PlayIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { useTestingData } from "./context";

export const TestingRuns = memo(function TestingRuns() {
  const {
    executionMode,
    setExecutionMode,
    busyAction,
    visualComparison,
    setVisualComparison,
    runGeneratedTests,
    normalizedTarget,
    generationJobs,
    scheduleTime,
    setScheduleTime,
    createTestingSchedule,
    testingSchedules,
    executionRuns,
    draftFailedCaseBug,
    triageFailedCase,
    decideHealing,
  } = useTestingData();

  return (
    <section aria-labelledby="testing-execution-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="testing-execution-heading" className="text-lg font-semibold text-foreground">
          Run and investigate
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Standalone mode is for manual UAT. CI mode returns the same persisted results for a
          release gate. Locator changes are proposed for review and are never silently applied.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execution controls</CardTitle>
          <CardDescription>
            Runs use the latest completed automation batch and the target URL from Discover.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="testing-execution-mode" className="text-sm font-medium">
                Operating mode
              </label>
              <Select
                value={executionMode}
                onValueChange={(value) => setExecutionMode(value as "standalone" | "ci")}
                disabled={busyAction !== null}
              >
                <SelectTrigger id="testing-execution-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="standalone">Standalone / UAT</SelectItem>
                  <SelectItem value="ci">CI release gate</SelectItem>
                </SelectPopup>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-4">
              <div>
                <label htmlFor="testing-visual-comparison" className="text-sm font-medium">
                  Visual comparison
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Opt in to local screenshots and approved baselines.
                </p>
              </div>
              <Switch
                id="testing-visual-comparison"
                checked={visualComparison}
                onCheckedChange={setVisualComparison}
                disabled={busyAction !== null}
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void runGeneratedTests()}
            disabled={
              busyAction !== null ||
              !normalizedTarget ||
              !generationJobs.some((job) => job.status === "completed")
            }
          >
            {busyAction === "run-tests" ? (
              <LoaderIcon aria-hidden="true" className="animate-spin" />
            ) : (
              <PlayIcon aria-hidden="true" />
            )}
            Run generated tests
          </Button>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <label htmlFor="testing-schedule-time" className="text-sm font-medium">
                One-off local schedule
              </label>
              <Input
                id="testing-schedule-time"
                type="datetime-local"
                value={scheduleTime}
                onChange={(event) => setScheduleTime(event.target.value)}
                disabled={busyAction !== null}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="self-end"
              onClick={() => void createTestingSchedule()}
              disabled={
                busyAction !== null ||
                !scheduleTime ||
                !normalizedTarget ||
                !generationJobs.some((job) => job.status === "completed")
              }
            >
              Schedule run
            </Button>
          </div>
          {testingSchedules.length > 0 ? (
            <ul
              className="space-y-1 text-xs text-muted-foreground"
              aria-label="Local schedules"
            >
              {testingSchedules.map((schedule) => (
                <li key={schedule.id}>
                  {new Date(schedule.nextRunAt).toLocaleString()} · {schedule.timezone} ·{" "}
                  {schedule.recurrence}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-3" aria-live="polite">
        {executionRuns.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No execution rounds yet.
            </CardContent>
          </Card>
        ) : (
          executionRuns.map((run) => (
            <Card key={run.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {run.mode === "ci" ? "CI" : "Standalone"} round
                    </CardTitle>
                    <CardDescription>
                      {run.results.length} cases · {(run.durationMs / 1000).toFixed(1)} seconds
                    </CardDescription>
                  </div>
                  <Badge variant={run.status === "passed" ? "success" : "outline"}>
                    {run.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2" aria-label="Case execution results">
                  {run.results.map((result) => (
                    <li
                      key={`${run.id}-${result.caseId}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
                    >
                      <span>
                        {result.externalId}: {result.status}
                        {result.quarantined ? " · flaky, quarantined from gate" : ""}
                        {result.visualStatus !== "disabled"
                          ? ` · visual ${result.visualStatus}`
                          : ""}
                      </span>
                      {result.status === "failed" ? (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void draftFailedCaseBug(run, result.caseId)}
                            disabled={busyAction !== null}
                          >
                            Draft local bug
                          </Button>
                          {run.mode === "ci" && !result.quarantined ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void triageFailedCase(run, result.caseId)}
                              disabled={busyAction !== null}
                            >
                              Triage with Fusion model
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {run.healingProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="space-y-3 rounded-lg border border-border/70 p-4"
                  >
                    <p className="text-sm font-medium">
                      Locator proposal ({Math.round(proposal.confidence * 100)}% confidence)
                    </p>
                    <pre className="overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                      {proposal.diff}
                    </pre>
                    {proposal.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void decideHealing(proposal.id, "accepted")}
                          disabled={busyAction !== null}
                        >
                          Accept proposal
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void decideHealing(proposal.id, "rejected")}
                          disabled={busyAction !== null}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline">{proposal.status.replace("-", " ")}</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
});

export default TestingRuns;
