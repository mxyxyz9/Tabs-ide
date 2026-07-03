import { memo, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import type { TaskNode } from "../../session-logic";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Self-ticking elapsed timer (direct DOM mutation — no React re-renders)
// ---------------------------------------------------------------------------

function formatElapsed(startIso: string): string {
  const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(startIso)) / 1000));
  if (elapsed < 60) return `${elapsed}s`;
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const TaskElapsed = memo(function TaskElapsed({ startedAt }: { startedAt: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const update = () => {
      if (ref.current) ref.current.textContent = formatElapsed(startedAt);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return (
    <span ref={ref} className="tabular-nums text-muted-foreground/55">
      {formatElapsed(startedAt)}
    </span>
  );
});

// ---------------------------------------------------------------------------
// Single task row
// ---------------------------------------------------------------------------

const TaskRow = memo(function TaskRow({ task }: { task: TaskNode }) {
  const isRunning = task.status === "running";
  const isFailed = task.status === "failed";
  const isStopped = task.status === "stopped";

  const StatusIcon = isRunning ? SpinnerIcon : isFailed || isStopped ? XIcon : CheckIcon;

  const iconColor = isRunning
    ? "text-blue-400"
    : isFailed
      ? "text-red-400"
      : isStopped
        ? "text-amber-400"
        : "text-emerald-400";

  const description = task.latestDetail ?? task.lastToolName ?? task.description;

  return (
    <div className="flex items-start gap-2 rounded-lg px-1 py-1 transition-[opacity] duration-200">
      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center", iconColor)}>
        <StatusIcon className="size-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate text-[11px] leading-5 text-foreground/80",
              isFailed && "text-red-400",
            )}
            title={description}
          >
            {description}
          </p>
          {isRunning && <TaskElapsed startedAt={task.startedAt} />}
        </div>
        {task.taskType && (
          <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/45">
            {task.taskType}
          </span>
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Task Progress Card — replaces generic "Reasoning update" entries
// ---------------------------------------------------------------------------

export const TaskProgressCard = memo(function TaskProgressCard({
  tasks,
}: {
  tasks: ReadonlyArray<TaskNode>;
}) {
  if (tasks.length === 0) return null;

  const runningCount = tasks.filter((t) => t.status === "running").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;

  const headerLabel =
    runningCount > 0 ? `Tasks (${completedCount}/${totalCount})` : `Tasks (${totalCount})`;

  return (
    <div className="rounded-xl border border-border/45 bg-card/25 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
        <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground/55">
          {headerLabel}
        </p>
        {runningCount > 0 && (
          <span className="inline-flex items-center gap-[3px]">
            <span className="h-1 w-1 rounded-full bg-blue-400/60 animate-pulse" />
            <span className="h-1 w-1 rounded-full bg-blue-400/60 animate-pulse [animation-delay:200ms]" />
            <span className="h-1 w-1 rounded-full bg-blue-400/60 animate-pulse [animation-delay:400ms]" />
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {tasks.map((task) => (
          <TaskRow key={task.taskId} task={task} />
        ))}
      </div>
    </div>
  );
});
