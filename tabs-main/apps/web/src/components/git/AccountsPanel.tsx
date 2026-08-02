import type { GitHubAccount } from "@tabs/contracts";
import { KeyRound } from "lucide-react";

import { Button } from "../ui/button";
import { Banner, Card, PanelToolbar, SectionLabel } from "./gitPrimitives";

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
    <div className="flex items-center gap-3 px-2 py-2.5 border-b border-border/50 last:border-0">
      <span className="w-8 h-8 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-xs font-mono font-semibold text-foreground/90 shrink-0">
        {a.login[0]?.toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-mono text-foreground/90 flex items-center gap-2">
          {a.login}
          {isActive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--overlay-10)", color: "var(--fg-80)" }}>
              used here
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground/70 flex items-center gap-1.5 mt-0.5">
          {a.host}
          {a.scopes.map((s) => (
            <span key={s} className="font-mono px-1 py-px rounded bg-muted/50 border border-border/50">
              {s}
            </span>
          ))}
        </div>
      </div>
      {!isActive && <Button variant="ghost" size="sm" onClick={() => onSwitch(a.login)}>Switch to this account</Button>}
      <Button variant="ghost" size="sm" onClick={() => onRemove(a.login)}>
        Remove
      </Button>
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
      <PanelToolbar>
        <Button size="sm" onClick={onOpenConnectAccount}>
          Connect an account
        </Button>
      </PanelToolbar>

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
        {accounts.length === 0 && <div className="text-center text-[11px] text-muted-foreground/50 py-4">No accounts connected</div>}
      </Card>

      <SectionLabel>This project</SectionLabel>
      <p className="text-xs text-muted-foreground/70 leading-relaxed mb-2">
        {repoName} pushes and opens pull requests as this account. Changing it here only affects this project.
      </p>
      <div className="flex items-center gap-2.5 bg-muted/50 border border-border rounded-lg px-3 py-2.5">
        <KeyRound size={13} className="text-muted-foreground/70 shrink-0" />
        <span className="text-xs text-muted-foreground/80">Push and open PRs as</span>
        <select
          value={activeAccountLogin || ""}
          onChange={(e) => onSwitchAccount(e.target.value)}
          className="border border-border rounded-md text-xs font-mono text-foreground/90 bg-background px-2 py-1 outline-none"
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
