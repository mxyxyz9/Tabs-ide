import { Effect, Layer, Option } from "effect";
import { runProcess } from "../processRunner";
import { GitHubCli } from "../git/Services/GitHubCli";
import { GitLabCli } from "../git/Services/GitLabCli";
import { AzureDevOpsCli } from "../git/Services/AzureDevOpsCli";
import { BitbucketApi, BitbucketApiLive } from "./BitbucketApi";
import { GitHubCliLive } from "../git/Layers/GitHubCli";
import { GitLabCliLive } from "../git/Layers/GitLabCli";
import { AzureDevOpsCliLive } from "../git/Layers/AzureDevOpsCli";
import type { SourceControlDiscoveryResult } from "@tabs/contracts";

interface GitHubHostAccount {
  state: string;
  active: boolean;
  login: string;
}

interface GitHubAuthJson {
  hosts?: Record<string, GitHubHostAccount[]>;
}

function parseGitHubStatus(stdout: string): { authenticated: boolean; username: string | null } {
  try {
    const data = JSON.parse(stdout) as GitHubAuthJson;
    if (data && data.hosts) {
      for (const [_, accounts] of Object.entries(data.hosts)) {
        const active = accounts.find((a) => a.active && a.state === "success") || accounts.find((a) => a.state === "success");
        if (active) {
          return { authenticated: true, username: active.login };
        }
      }
    }
  } catch {
    // Ignore JSON parse errors
  }
  return { authenticated: false, username: null };
}

const probeVersion = (cmd: string) =>
  Effect.tryPromise({
    try: () => runProcess(cmd, ["--version"], { timeoutMs: 5000 }),
    catch: () => null,
  }).pipe(
    Effect.catch(() => Effect.succeed(null))
  );

function firstLine(value: string): string | null {
  const line = value.split(/\r?\n/)[0]?.trim();
  return line && line.length > 0 ? line : null;
}

const discoveryEffect = Effect.gen(function* () {
  const github = yield* GitHubCli;
  const gitlab = yield* GitLabCli;
  const azure = yield* AzureDevOpsCli;
  const bitbucket = yield* BitbucketApi;

  const gitVersion = yield* probeVersion("git");
  const ghVersion = yield* probeVersion("gh");
  const glabVersion = yield* probeVersion("glab");
  const azVersion = yield* probeVersion("az");

  let ghAuth = { authenticated: false, username: null as string | null };
  if (ghVersion) {
    const statusText = yield* github.getAuthStatus({ cwd: process.cwd() }).pipe(
      Effect.catch(() => Effect.succeed(""))
    );
    ghAuth = parseGitHubStatus(statusText);
  }

  let glabAuth = { authenticated: false, username: null as string | null };
  if (glabVersion) {
    const statusText = yield* gitlab.getAuthStatus({ cwd: process.cwd() }).pipe(
      Effect.catch(() => Effect.succeed(""))
    );
    const match = statusText.match(/Logged in to \S+ as ([^\s]+)/i);
    if (match && match[1]) {
      glabAuth = { authenticated: true, username: match[1] };
    }
  }

  let azAuth = { authenticated: false, username: null as string | null };
  if (azVersion) {
    const statusText = yield* azure.getAuthStatus({ cwd: process.cwd() }).pipe(
      Effect.catch(() => Effect.succeed(""))
    );
    const trimmed = statusText.trim();
    if (trimmed && !trimmed.toLowerCase().includes("error") && !trimmed.toLowerCase().includes("no active")) {
      azAuth = { authenticated: true, username: trimmed };
    }
  }

  const bbAuth = yield* bitbucket.probeAuth();
  const bbAuthenticated = bbAuth.status !== "unauthenticated";
  const bbAccount = Option.getOrNull(bbAuth.account);

  const result: SourceControlDiscoveryResult = {
    vcs: [
      {
        system: "git",
        available: gitVersion !== null && gitVersion.code === 0,
        version: gitVersion ? firstLine(gitVersion.stdout) : null,
      },
      {
        system: "jujutsu",
        available: false,
        version: null,
      },
    ],
    providers: [
      {
        provider: "github",
        cliAvailable: ghVersion !== null && ghVersion.code === 0,
        version: ghVersion ? firstLine(ghVersion.stdout) : null,
        authenticated: ghAuth.authenticated,
        authenticatedAs: ghAuth.username,
        installInstructions:
          ghVersion === null
            ? "Install the GitHub CLI (`gh`) from https://cli.github.com or your package manager."
            : null,
        enabled: true,
      },
      {
        provider: "gitlab",
        cliAvailable: glabVersion !== null && glabVersion.code === 0,
        version: glabVersion ? firstLine(glabVersion.stdout) : null,
        authenticated: glabAuth.authenticated,
        authenticatedAs: glabAuth.username,
        installInstructions:
          glabVersion === null
            ? "Install the GitLab CLI (`glab`) from https://gitlab.com/gitlab-org/cli or your package manager (e.g. `brew install glab`)."
            : null,
        enabled: true,
      },
      {
        provider: "azure-devops",
        cliAvailable: azVersion !== null && azVersion.code === 0,
        version: azVersion ? firstLine(azVersion.stdout) : null,
        authenticated: azAuth.authenticated,
        authenticatedAs: azAuth.username,
        installInstructions:
          azVersion === null
            ? "Install the Azure command-line tools (`az`), then enable Azure DevOps support with `az extension add --name azure-devops`."
            : null,
        enabled: true,
      },
      {
        provider: "bitbucket",
        cliAvailable: false,
        version: null,
        authenticated: bbAuthenticated,
        authenticatedAs: bbAccount,
        installInstructions:
          "Set T3CODE_BITBUCKET_EMAIL and T3CODE_BITBUCKET_API_TOKEN on the server (use a Bitbucket API token with pull request and repository scopes).",
        enabled: true,
      },
    ],
  };

  return result;
});

const appLayer = Layer.mergeAll(
  GitHubCliLive,
  GitLabCliLive,
  AzureDevOpsCliLive,
  BitbucketApiLive
);

export async function discoverSourceControl(): Promise<SourceControlDiscoveryResult> {
  return Effect.runPromise(
    discoveryEffect.pipe(Effect.provide(appLayer))
  );
}
