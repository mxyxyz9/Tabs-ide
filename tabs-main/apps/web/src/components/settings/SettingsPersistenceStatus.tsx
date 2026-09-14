import { useSettingsPersistence } from "../../hooks/useSettings";
import { Button } from "../ui/button";
import { cn } from "~/lib/utils";

export function SettingsPersistenceStatus({ className }: { readonly className?: string }) {
  const persistence = useSettingsPersistence();

  if (persistence.status === "idle") {
    return null;
  }

  return (
    <div
      aria-live="polite"
      role="status"
      className={cn("flex items-center gap-2 text-xs", className)}
    >
      {persistence.status === "saving" && <span className="text-muted-foreground">Saving...</span>}
      {persistence.status === "saved" && <span className="text-muted-foreground">Saved</span>}
      {persistence.status === "failed" && (
        <div className="flex items-center gap-1.5 text-destructive font-medium">
          <span>Failed to save</span>
          {persistence.retry && (
            <Button
              size="xs"
              variant="outline"
              className="h-6 px-2 text-xs text-foreground border-destructive/40 hover:bg-destructive/10"
              onClick={() => {
                void persistence.retry?.();
              }}
            >
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
