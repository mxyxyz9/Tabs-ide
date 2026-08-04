import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: {
  value: T;
  onValueChange: (val: T) => void;
  options: ReadonlyArray<SegmentOption<T>>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-muted/60 p-1 border border-border/40 select-none",
        className,
      )}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
              isSelected
                ? "bg-background text-foreground shadow-sm border border-foreground/30 ring-1 ring-foreground/20 dark:bg-accent dark:border-foreground/40 dark:shadow-[0_0_12px_rgba(255,255,255,0.15)]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
