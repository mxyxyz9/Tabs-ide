import type { GitHistoryCommit, GitPushAccess } from "@tabs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Tag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { toGitUserFacingErrorMessage } from "../../lib/gitErrorMessages";
import { invalidateGitQueries } from "../../lib/gitReactQuery";
import { readNativeApi } from "../../nativeApi";
import { toastManager } from "../ui/toast";
import { GitCheckingState } from "./GitCheckingState";
import { Btn, Card, InlineForm, PanelToolbar } from "./gitPrimitives";

export function TagsPanel({
  cwd,
  commits,
  pushAccess = "unknown",
  onOpenDraftRelease,
  onRunInTerminal,
}: {
  cwd: string;
  commits: ReadonlyArray<GitHistoryCommit>;
  pushAccess?: GitPushAccess | undefined;
  onOpenDraftRelease: () => void;
  onRunInTerminal: (cmd: string) => void;
}) {
  const [form, setForm] = useState(false);
  const [realTags, setRealTags] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const api = readNativeApi();
  const queryClient = useQueryClient();

  const fetchTags = useCallback(async () => {
    if (!api || !cwd) {
      setLoadingTags(false);
      return;
    }
    const foundTags = new Set<string>();

    try {
      const res = await api.git.listTags({ cwd });
      if (res?.tags) {
        for (const t of res.tags) {
          if (t.name) foundTags.add(t.name);
        }
      }
    } catch {
      // Fallback to commits refs if RPC fails
    }

    for (const c of commits) {
      for (const r of c.refs || []) {
        if (r.startsWith("tag: ")) {
          const tagName = r.slice(5).trim();
          if (tagName) foundTags.add(tagName);
        }
      }
    }

    const tagCommitIndex = new Map<string, number>();
    commits.forEach((c, idx) => {
      for (const r of c.refs || []) {
        if (r.startsWith("tag: ")) {
          const tagName = r.slice(5).trim();
          if (tagName && !tagCommitIndex.has(tagName)) {
            tagCommitIndex.set(tagName, idx);
          }
        }
      }
    });

    const sortedTags = Array.from(foundTags).sort((a, b) => {
      const idxA = tagCommitIndex.get(a) ?? Number.MAX_SAFE_INTEGER;
      const idxB = tagCommitIndex.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (idxA !== idxB) return idxA - idxB;
      return b.localeCompare(a, undefined, { numeric: true });
    });

    setRealTags(sortedTags);
    setLoadingTags(false);
  }, [api, cwd, commits]);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  const createTag = useCallback(
    async (name: string) => {
      if (!api) return;
      try {
        await api.git.createTag({ cwd, name });
        await invalidateGitQueries(queryClient);
        await fetchTags();
        setForm(false);
        toastManager.add({ type: "success", title: `Tag ${name} created` });
      } catch (error) {
        toastManager.add({ type: "error", title: "Create tag failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, cwd, fetchTags, queryClient],
  );

  return (
    <div>
      {!form && (
        <PanelToolbar>
          <Btn primary onClick={() => setForm(true)}>
            Create tag
          </Btn>
          <Btn ghost onClick={onOpenDraftRelease}>
            Draft a release
          </Btn>
        </PanelToolbar>
      )}

      {form && (
        <Card className="p-3 mb-4">
          <div className="fs-11 font-medium tx-80 mb-2">Create new tag</div>
          <InlineForm
            placeholder="v1.5.0"
            submitLabel="Create tag"
            className="mb-0"
            onSubmit={(name) => {
              void createTag(name);
            }}
            onCancel={() => setForm(false)}
          />
        </Card>
      )}

      {loadingTags ? (
        <GitCheckingState message="Loading tags…" size={36} />
      ) : realTags.length === 0 ? (
        <Card className="p-6 text-center">
          <Tag className="mx-auto mb-2 tx-30" size={24} />
          <p className="fs-12 font-medium tx-80 mb-1">No tags created yet</p>
          <p className="fs-11 tx-40 mb-4">Tags mark specific points in your repository history (e.g. v1.0.0).</p>
        </Card>
      ) : (
        <Card className="p-2 mb-3">
          {realTags.map((tagName) => (
            <div key={tagName} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border bd-2 bg-o1 text-xs font-mono tx-80">
                <Tag size={11} /> {tagName}
              </span>
              <span className="fs-11 tx-30 flex-1">Tag release ref</span>
              <Btn
                sm
                ghost
                disabled={pushAccess === "read_only"}
                title={pushAccess === "read_only" ? "Pushing tags is disabled for read-only remotes." : undefined}
                onClick={() => onRunInTerminal(`git push origin ${tagName}`)}
              >
                Push tag
              </Btn>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
