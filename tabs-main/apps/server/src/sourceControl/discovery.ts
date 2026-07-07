import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SourceControlDiscoveryResult } from "@tabs/contracts";

const exec = promisify(execFile);

async function probe(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout, stderr } = await exec(cmd, args, { timeout: 5000 });
    return (stdout || stderr || "").trim();
  } catch {
    return null;
  }
}

export async function discoverSourceControl(): Promise<SourceControlDiscoveryResult> {
  // Executing auth checks: gh auth status can exit with code 1 if not logged in.
  // We should catch errors on auth calls and inspect stdout/stderr.
  const [gitVersion, ghVersion, ghAuthResult, glabVersion, glabAuthResult, azVersion, bbCheck] =
    await Promise.all([
      probe("git", ["--version"]),
      probe("gh", ["--version"]),
      exec("gh", ["auth", "status", "--hostname", "github.com"]).then(
        ({ stdout, stderr }) => (stdout || stderr || "").trim(),
        (err) => (err.stdout || err.stderr || "").trim() as string,
      ),
      probe("glab", ["--version"]),
      exec("glab", ["auth", "status"]).then(
        ({ stdout, stderr }) => (stdout || stderr || "").trim(),
        (err) => (err.stdout || err.stderr || "").trim() as string,
      ),
      probe("az", ["--version"]),
      probe("bb", ["--version"]).catch(() => null),
    ]);

  // Parse gh auth status output to extract username
  // "Logged in to github.com as username"
  const ghAuthMatch = ghAuthResult?.match(/Logged in to .+ as ([^\s]+)/)?.[1] ?? null;
  const glabAuthMatch = glabAuthResult?.match(/Logged in to .+ as ([^\s]+)/)?.[1] ?? null;

  return {
    vcs: [
      { system: "git", available: gitVersion !== null, version: gitVersion },
      { system: "jujutsu", available: false, version: null },
    ],
    providers: [
      {
        provider: "github",
        cliAvailable: ghVersion !== null,
        version: ghVersion?.match(/gh version ([^\s]+)/)?.[1] ?? null,
        authenticated: ghAuthMatch !== null,
        authenticatedAs: ghAuthMatch,
        installInstructions:
          ghVersion === null
            ? "Install the GitHub CLI (`gh`) from https://cli.github.com or your package manager."
            : null,
        enabled: true,
      },
      {
        provider: "gitlab",
        cliAvailable: glabVersion !== null,
        version: glabVersion?.match(/glab version ([^\s]+)/)?.[1] ?? null,
        authenticated: glabAuthMatch !== null,
        authenticatedAs: glabAuthMatch,
        installInstructions:
          glabVersion === null
            ? "Install the GitLab CLI (`glab`) from https://gitlab.com/gitlab-org/cli or your package manager (e.g. `brew install glab`)."
            : null,
        enabled: false,
      },
      {
        provider: "azure-devops",
        cliAvailable: azVersion !== null,
        version: null,
        authenticated: false,
        authenticatedAs: null,
        installInstructions:
          azVersion === null
            ? "Install the Azure command-line tools (`az`), then enable Azure DevOps support with `az extension add --name azure-devops`."
            : null,
        enabled: false,
      },
      {
        provider: "bitbucket",
        cliAvailable: bbCheck !== null,
        version: null,
        authenticated: false,
        authenticatedAs: null,
        installInstructions:
          "Set T3CODE_BITBUCKET_EMAIL and T3CODE_BITBUCKET_API_TOKEN on the server (use a Bitbucket API token with pull request and repository scopes).",
        enabled: false,
      },
    ],
  };
}
