export type VcsSystem = "git" | "jujutsu";
export type SourceControlProvider = "github" | "gitlab" | "azure-devops" | "bitbucket";

export interface VcsDiscovery {
  system: VcsSystem;
  available: boolean;
  version: string | null;
}

export interface ProviderDiscovery {
  provider: SourceControlProvider;
  cliAvailable: boolean;
  version: string | null;
  authenticated: boolean;
  authenticatedAs: string | null;
  installInstructions: string | null;
  enabled: boolean;
}

export interface SourceControlDiscoveryResult {
  vcs: VcsDiscovery[];
  providers: ProviderDiscovery[];
}
