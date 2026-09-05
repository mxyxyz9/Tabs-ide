import keytar from "keytar";

const SERVICE = "Tabs Provider Credentials";

export type ProviderSecretName =
  | "copilot.github-token"
  | "copilot.byok-api-key"
  | "gemini.api-key"
  | "droid.api-key"
  | "antigravity.api-key"
  | "openrouter.api-key"
  | "opencode.server-password"
  | "kilo.server-password";

function keychainLocation(name: ProviderSecretName): { service: string; account: string } {
  if (name === "copilot.github-token") {
    return { service: "Tabs GitHub Copilot", account: "github-token" };
  }
  return { service: SERVICE, account: name };
}

export function getProviderSecret(name: ProviderSecretName): Promise<string | null> {
  const location = keychainLocation(name);
  return keytar.getPassword(location.service, location.account);
}

export async function setProviderSecret(name: ProviderSecretName, value: string): Promise<void> {
  const normalized = value.trim();
  if (normalized.length === 0) {
    await deleteProviderSecret(name);
    return;
  }
  const location = keychainLocation(name);
  await keytar.setPassword(location.service, location.account, normalized);
}

export async function deleteProviderSecret(name: ProviderSecretName): Promise<void> {
  const location = keychainLocation(name);
  await keytar.deletePassword(location.service, location.account);
}
