import { GitPullRequest } from "lucide-react";
import { useEffect, useState } from "react";

import { readNativeApi } from "../../nativeApi";
import { GitCheckingState } from "./GitCheckingState";
import { Badge, Btn, Card } from "./gitPrimitives";

interface MockPR {
  n: number;
  title: string;
  state: "open" | "draft" | "merged" | "closed";
  branch: string;
  body: string;
}

export function PRsPanel({
  cwd,
  branchName,
  onOpenCreatePR,
  onRunInTerminal,
}: {
  cwd: string;
  branchName: string;
  onOpenCreatePR: () => void;
  onRunInTerminal: (cmd: string) => void;
}) {
  const [prs, setPrs] = useState<MockPR[]>([]);
  const [loading, setLoading] = useState(true);
  const api = readNativeApi();

  useEffect(() => {
    if (!api || !cwd || !branchName) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    api.git
      .resolvePullRequest({ cwd, reference: branchName })
      .then((res: { pullRequest?: { number: number; title: string; state?: string; headBranch?: string; baseBranch?: string; url: string } | null }) => {
        if (cancelled) return;
        if (res.pullRequest) {
          const pr = res.pullRequest;
          setPrs([
            {
              n: pr.number,
              title: pr.title,
              state: (pr.state as "open" | "draft" | "merged" | "closed") || "open",
              branch: `${pr.headBranch ?? branchName} → ${pr.baseBranch ?? "main"}`,
              body: pr.url,
            },
          ]);
        } else {
          setPrs([]);
        }
      })
      .catch(() => {
        if (!cancelled) setPrs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, cwd, branchName]);

  return (
    <div>
      {loading ? (
        <GitCheckingState message="Loading pull requests…" size={36} />
      ) : prs.length === 0 ? (
        <Card className="p-6 text-center">
          <GitPullRequest className="mx-auto mb-2 tx-30" size={24} />
          <p className="fs-12 font-medium tx-80 mb-1">No open pull requests for {branchName}</p>
          <p className="fs-11 tx-40 mb-4">Push your branch and open a pull request on GitHub to request feedback and merge changes.</p>
          <Btn primary icon={GitPullRequest} onClick={onOpenCreatePR}>
            Create pull request
          </Btn>
        </Card>
      ) : (
        <Card className="p-2 mb-3">
          {prs.map((pr) => (
            <div key={pr.n} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
              <Badge tone={pr.state}>
                #{pr.n} {pr.state}
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="text-xs tx-80 truncate">{pr.title}</div>
                <div className="fs-10 font-mono tx-30 truncate">{pr.branch}</div>
              </div>
              <Btn sm ghost onClick={() => onRunInTerminal(`gh pr view ${pr.n} --web`)}>
                View on GitHub
              </Btn>
            </div>
          ))}
        </Card>
      )}
      {prs.length > 0 && (
        <div className="mt-4">
          <Btn primary icon={GitPullRequest} onClick={onOpenCreatePR}>
            Create pull request
          </Btn>
        </div>
      )}
    </div>
  );
}
