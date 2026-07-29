import type { GitHubAccount } from "@tabs/contracts";
import { Check, FolderGit2, GitBranch as GitBranchIcon, Terminal, Users } from "lucide-react";
import { useState } from "react";

import { Btn, Dropdown, TONE } from "./gitPrimitives";

export function TopBar({
  repoName,
  branchLabel,
  accentDotTone,
  accounts,
  activeAccountLogin,
  terminalOpen,
  onToggleTerminal,
  onSwitchAccount,
  onOpenAccounts,
  onOpenSignIn,
}: {
  repoName: string;
  branchLabel: string;
  accentDotTone: "ok" | "warn" | "bad" | "info";
  accounts: ReadonlyArray<GitHubAccount>;
  activeAccountLogin: string | null;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  onSwitchAccount: (login: string) => void;
  onOpenAccounts: () => void;
  onOpenSignIn: () => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-b bd-1 shrink-0" style={{ backgroundColor: "var(--bg-base)" }}>
      <div className="flex items-center gap-2 text-xs font-mono tx-40 min-w-0">
        <FolderGit2 size={13} className="tx-30 shrink-0" />
        <span className="tx-70 truncate">{repoName}</span>
        <span className="tx-20">/</span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border bd-2 bg-o1 tx shrink-0 font-medium">
          <GitBranchIcon size={11} />
          {branchLabel}
        </span>
      </div>

      <div className="flex-1" />

      {/* Account button */}
      <Dropdown
        open={accountOpen}
        setOpen={setAccountOpen}
        align="right"
        width="w-72"
        trigger={(toggle) => (
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-2 h-7 pl-1.5 pr-2.5 rounded-full bg-o1 hov-bg-o2 border bd-2 hov-bd-3 transition-all cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-o2 flex items-center justify-center fs-10 font-mono font-semibold tx-80">
              {activeAccountLogin ? activeAccountLogin[0]?.toUpperCase() : "–"}
            </span>
            <span className="text-xs font-mono tx-70">{activeAccountLogin || "signed out"}</span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TONE[accentDotTone].dot }} />
          </button>
        )}
      >
        {activeAccountLogin ? (
          <>
            <div className="px-3 pt-3 pb-2 fs-10 uppercase tracking-widest tx-30 font-mono">Switch account</div>
            <div className="pb-1">
              {accounts.map((a) => (
                <button
                  key={a.login}
                  type="button"
                  onClick={() => {
                    onSwitchAccount(a.login);
                    setAccountOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hov-bg-o1 transition-colors cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-full bg-o2 flex items-center justify-center fs-10 font-mono font-semibold tx-80 shrink-0">
                    {a.login[0]?.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono tx-80 flex-1 truncate">{a.login}</span>
                  {a.login === activeAccountLogin && <Check size={12} className="tx-40 shrink-0" />}
                </button>
              ))}
            </div>
            <div className="h-px bg-o1" />
            <button
              type="button"
              onClick={() => {
                onOpenAccounts();
                setAccountOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left fs-11 tx-50 hov-tx hov-bg-o1 transition-colors cursor-pointer"
            >
              <Users size={12} /> Manage accounts
            </button>
          </>
        ) : (
          <div className="p-3">
            <div className="fs-11 tx-50 leading-relaxed mb-3">No GitHub account is signed in. Sign in to push, pull, or open pull requests.</div>
            <Btn
              primary
              className="w-full justify-center"
              onClick={() => {
                onOpenSignIn();
                setAccountOpen(false);
              }}
            >
              Sign in to GitHub
            </Btn>
          </div>
        )}
      </Dropdown>

      {/* Quick Terminal toggle button */}
      <button
        type="button"
        onClick={onToggleTerminal}
        title={terminalOpen ? "Hide terminal" : "Open terminal"}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
          terminalOpen ? "bg-o2 border bd-3 tx" : "bg-o1 hov-bg-o2 border bd-2 tx-60 hov-tx"
        }`}
      >
        <Terminal size={12} />
        <span>Terminal</span>
      </button>
    </div>
  );
}
