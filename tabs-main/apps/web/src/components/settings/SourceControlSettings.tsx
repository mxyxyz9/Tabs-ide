import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { useSourceControlDiscovery } from "~/lib/sourceControlReactQuery";
import { ChevronDownIcon, RefreshCwIcon, GitBranchIcon } from "lucide-react";
import {
  GitHubIcon,
  GitLabIcon,
  AzureDevOpsIcon,
  BitbucketIcon,
  GitIcon,
  JujutsuIcon,
} from "~/components/Icons";
import { cn } from "~/lib/utils";
import { SettingsSection } from "~/routes/_chat.settings";

const SOURCE_CONTROL_PROVIDER_ICONS = {
  github: GitHubIcon,
  gitlab: GitLabIcon,
  "azure-devops": AzureDevOpsIcon,
  bitbucket: BitbucketIcon,
};

const VCS_ICONS = {
  git: GitIcon,
  jujutsu: JujutsuIcon,
};

function itemStatusDot(item: {
  available?: boolean;
  cliAvailable?: boolean;
  authenticated?: boolean;
}) {
  const available = item.available ?? item.cliAvailable ?? false;
  if (!available) return "bg-muted-foreground/35";
  if ("authenticated" in item && !item.authenticated) return "bg-warning";
  return "bg-success";
}

export function SourceControlSettingsPanel() {
  const { data, isLoading, error, refetch, isFetching } = useSourceControlDiscovery();
  const [isJjExpanded, setIsJjExpanded] = useState(false);

  const handleScan = () => {
    refetch();
  };

  const scanButton = (
    <Button
      size="icon-xs"
      variant="ghost"
      className="size-5 rounded-sm p-0 text-muted-foreground hover:text-foreground"
      onClick={handleScan}
      disabled={isLoading || isFetching}
      aria-label="Rescan server environment"
    >
      <RefreshCwIcon className={cn("size-3.5", (isLoading || isFetching) && "animate-spin")} />
    </Button>
  );

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <SettingsSection title="Version Control" headerAction={scanButton}>
          <div className="p-6 text-center text-xs text-muted-foreground">
            Scanning environment...
          </div>
        </SettingsSection>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SettingsSection title="Version Control" headerAction={scanButton}>
          <div className="p-6 text-center text-xs text-destructive">
            Failed to scan environment: {error instanceof Error ? error.message : String(error)}
          </div>
        </SettingsSection>
      </div>
    );
  }

  const vcs = data?.vcs ?? [];
  const providers = data?.providers ?? [];

  return (
    <div className="space-y-6">
      <SettingsSection title="Version Control" headerAction={scanButton}>
        {vcs.map((item) => {
          const Icon = VCS_ICONS[item.system];
          const dotClassName = itemStatusDot(item);
          const hasDetails = item.system === "jujutsu";
          const isExpanded = item.system === "jujutsu" && isJjExpanded;

          return (
            <div key={item.system} className="border-t border-border/60 first:border-t-0">
              <div className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {Icon && (
                        <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
                          <Icon className="size-4.5 text-foreground/80" aria-hidden />
                          <span
                            className={cn(
                              "pointer-events-none absolute -left-0.5 -top-0.5 size-2 rounded-full ring-2 ring-background",
                              dotClassName,
                            )}
                            aria-hidden
                          />
                        </span>
                      )}
                      <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-foreground capitalize">
                        {item.system}
                      </span>
                      {item.version ? (
                        <code className="text-xs text-muted-foreground">{item.version}</code>
                      ) : null}
                      {item.system === "jujutsu" && (
                        <Badge variant="warning" size="sm">
                          Coming Soon
                        </Badge>
                      )}
                      {item.available && (
                        <Badge variant="success" size="sm">
                          Available
                        </Badge>
                      )}
                    </div>
                    <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground/80">
                      {item.system === "git" ? (
                        <span>Git is configured and available for code operations.</span>
                      ) : (
                        <span>Support for Jujutsu is coming soon.</span>
                      )}
                    </p>
                  </div>
                  <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
                    {hasDetails && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setIsJjExpanded((open) => !open)}
                      >
                        <ChevronDownIcon
                          className={cn(
                            "size-3.5 transition-transform",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </Button>
                    )}
                    <Switch checked={item.available} disabled />
                  </div>
                </div>
              </div>
              {hasDetails && isExpanded && (
                <div className="border-t border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground sm:px-5">
                  Jujutsu (jj) is a next-generation Git-compatible version control system. Support
                  for local Jujutsu workspaces is coming in a future release.
                </div>
              )}
            </div>
          );
        })}
      </SettingsSection>

      <SettingsSection title="Source Control Providers">
        {providers.map((item) => {
          const Icon = SOURCE_CONTROL_PROVIDER_ICONS[item.provider];
          const dotClassName = itemStatusDot(item);

          return (
            <div key={item.provider} className="border-t border-border/60 first:border-t-0">
              <div className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {Icon && (
                        <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
                          <Icon className="size-4.5 text-foreground/80" aria-hidden />
                          <span
                            className={cn(
                              "pointer-events-none absolute -left-0.5 -top-0.5 size-2 rounded-full ring-2 ring-background",
                              dotClassName,
                            )}
                            aria-hidden
                          />
                        </span>
                      )}
                      <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-foreground capitalize">
                        {item.provider === "azure-devops" ? "Azure DevOps" : item.provider}
                      </span>
                      {item.cliAvailable && item.version ? (
                        <code className="text-xs text-muted-foreground">{item.version}</code>
                      ) : null}
                      {item.cliAvailable && !item.authenticated && (
                        <Badge variant="warning" size="sm">
                          Not authenticated
                        </Badge>
                      )}
                      {item.cliAvailable && item.authenticated && (
                        <Badge variant="success" size="sm">
                          Authenticated
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground/80">
                      {item.cliAvailable ? (
                        item.authenticated ? (
                          <span>
                            Authenticated as <strong>{item.authenticatedAs}</strong>. Pull request
                            and issue integrations are enabled.
                          </span>
                        ) : (
                          <span>
                            CLI is installed, but not authenticated. Run the authentication command
                            for <strong>{item.provider}</strong> on your server host to enable pull
                            request integrations.
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground/60 leading-relaxed block">
                          {item.installInstructions}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
                    <Switch checked={item.cliAvailable && item.authenticated} disabled />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </SettingsSection>
    </div>
  );
}
