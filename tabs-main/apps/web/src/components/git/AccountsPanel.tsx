import type { GitHubAccount } from "@tabs/contracts";
import { KeyRound } from "lucide-react";

import { Banner, Btn, Card, SectionLabel } from "./gitPrimitives";

function AccountRow({
  account: a,
  isActive,
  onSwitch,
  onRemove,
}: {
  account: GitHubAccount;
  isActive: boolean;
  onSwitch: (login: string) => void;
  onRemove: (login: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
      <span className="w-8 h-8 rounded-lg bg-o1 border bd-2 flex items-center justify-center text-xs font-mono font-semibold tx-80 shrink-0">
        {a.login[0]?.toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-mono tx-85 flex items-center gap-2">
          {a.login}
          {isActive && (
            <span className="fs-10 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--overlay-10)", color: "var(--fg-80)" }}>
              used here
            </span>
          )}
        </div>
        <div className="fs-10 tx-30 flex items-center gap-1.5 mt-0.5">
          {a.host}
          {a.scopes.map((s) => (
            <span key={s} className="font-mono px-1 py-px rounded bg-o1 border bd-1">
              {s}
            </span>
          ))}
        </div>
      </div>
      {!isActive && <Btn sm ghost onClick={() => onSwitch(a.login)}>Switch to this account</Btn>}
      <Btn sm ghost onClick={() => onRemove(a.login)}>
        Remove
      </Btn>
    </div>
  );
}

export function AccountsPanel({
  accounts,
  activeAccountLogin,
  repoName,
  credentialMismatch = false,
  onOpenConnectAccount,
  onSwitchAccount,
  onRemoveAccount,
}: {
  accounts: ReadonlyArray<GitHubAccount>;
  activeAccountLogin: string | null;
  repoName: string;
  credentialMismatch?: boolean;
  onOpenConnectAccount: () => void;
  onSwitchAccount: (login: string) => void;
  onRemoveAccount: (login: string) => void;
}) {
  return (
    <div>
      {credentialMismatch && (
        <Banner
          tone="warn"
          title="This project's push credential doesn't match"
          body="The account below handles GitHub actions. But git push authenticates through your system's SSH key, which currently resolves to a different account."
        />
      )}
      <Card className="p-2 mb-4">
        {accounts.map((a) => (
          <AccountRow key={a.login} account={a} isActive={a.login === activeAccountLogin} onSwitch={onSwitchAccount} onRemove={onRemoveAccount} />
        ))}
        {accounts.length === 0 && <div className="text-center fs-11 tx-25 py-4">No accounts connected</div>}
      </Card>
      <Btn primary onClick={onOpenConnectAccount}>
        Connect an account
      </Btn>

      <SectionLabel>This project</SectionLabel>
      <p className="text-xs tx-40 leading-relaxed mb-2">
        {repoName} pushes and opens pull requests as this account. Changing it here only affects this project.
      </p>
      <div className="flex items-center gap-2.5 bg-o1 border bd-2 rounded-lg px-3 py-2.5">
        <KeyRound size={13} className="tx-30 shrink-0" />
        <span className="text-xs tx-50">Push and open PRs as</span>
        <select
          value={activeAccountLogin || ""}
          onChange={(e) => onSwitchAccount(e.target.value)}
          className="border bd-2 rounded-md text-xs font-mono tx-80 px-2 py-1 outline-none"
          style={{ backgroundColor: "var(--bg-base)" }}
        >
          {accounts.map((a) => (
            <option key={a.login} value={a.login}>
              {a.login}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
