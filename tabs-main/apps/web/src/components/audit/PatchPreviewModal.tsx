import React from "react";
import type { AuditFinding } from "@tabs/contracts";
import { Button } from "../ui/button";

export interface PatchPreviewModalProps {
  readonly finding: AuditFinding | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function PatchPreviewModal({ finding, isOpen, onClose }: PatchPreviewModalProps) {
  if (!isOpen || !finding || !finding.suggestedFix) return null;

  const fix = finding.suggestedFix;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-foreground">
      <div
        className="w-full max-w-2xl border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        {/* Header */}
        <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Safe Repair Patch Preview</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{fix.description}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm font-bold cursor-pointer">
            ✕
          </button>
        </div>

        {/* Patch Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
          <div className="text-muted-foreground">
            Affected File(s): <span className="text-foreground font-semibold">{fix.affectedFiles.join(", ")}</span>
          </div>

          <pre className="p-4 bg-muted/60 rounded-lg border border-border overflow-x-auto text-foreground">
            {fix.replacementPatch.split("\n").map((line, idx) => {
              let color = "text-muted-foreground";
              if (line.startsWith("+") && !line.startsWith("+++")) color = "text-emerald-500 bg-emerald-500/10 font-semibold";
              else if (line.startsWith("-") && !line.startsWith("---")) color = "text-red-500 bg-red-500/10 font-semibold";
              else if (line.startsWith("@")) color = "text-primary font-bold";

              return (
                <div key={idx} className={color}>
                  {line}
                </div>
              );
            })}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/40 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground italic">Automated preview • Reversible in Git</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} className="text-xs text-muted-foreground border-border">
              Close Preview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
