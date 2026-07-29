import type { GitStashEntry } from "@tabs/contracts";
import { RefreshCw } from "lucide-react";

import { Btn, Card, SectionLabel } from "./gitPrimitives";

export function StashesPanel({
  stashes,
  hasChanges,
  behindCount,
  hasConflict,
  onOpenStash,
  onOpenStashPullReapply,
  onApplyStash,
  onDropStash,
}: {
  stashes: ReadonlyArray<GitStashEntry>;
  hasChanges: boolean;
  behindCount: number;
  hasConflict: boolean;
  onOpenStash: () => void;
  onOpenStashPullReapply: () => void;
  onApplyStash: (ref: string) => void;
  onDropStash: (ref: string) => void;
}) {
  const nothingToDo = !hasChanges && behindCount === 0;

  return (
    <div>
      <SectionLabel>Update safely</SectionLabel>
      <Card className="p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="fs-11 tx-50 leading-relaxed max-w-2xl">
            Set your current changes aside, pull the latest commits — from your own branch or a teammate's — then bring your changes back. Each step is reported as it happens. If your changes conflict with what came in, you'll resolve it right here.
          </p>
          {nothingToDo && <div className="fs-10 tx-30">Nothing to stash, and already up to date.</div>}
          {hasConflict && <div className="fs-10 font-medium" style={{ color: "var(--sem-amber)" }}>Resolve the merge in progress before running this again.</div>}
        </div>
        <div className="shrink-0 sm:ml-auto">
          <Btn primary icon={RefreshCw} disabled={hasConflict || nothingToDo} onClick={onOpenStashPullReapply}>
            Stash, pull &amp; reapply
          </Btn>
        </div>
      </Card>

      <SectionLabel action={<Btn sm ghost disabled={!hasChanges} onClick={onOpenStash}>Stash current changes</Btn>}>
        Stashes
      </SectionLabel>
      {stashes.length === 0 ? (
        <div className="text-center fs-11 tx-25 py-6 border bd-1 rounded-lg">
          {hasChanges ? 'No manual stashes yet. Set aside what you have right now with "Stash current changes" above.' : "No manual stashes, and nothing to stash right now."}
        </div>
      ) : (
        <Card className="p-2">
          {stashes.map((s) => (
            <div key={s.stashRef} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-xs tx-80">{s.message}</div>
                <div className="fs-10 font-mono tx-30">
                  {s.stashRef} &middot; {s.createdAt}
                </div>
              </div>
              <Btn sm ghost onClick={() => onApplyStash(s.stashRef)}>
                Apply
              </Btn>
              <Btn sm ghost onClick={() => onDropStash(s.stashRef)}>
                Drop
              </Btn>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
