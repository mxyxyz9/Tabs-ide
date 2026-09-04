import { bootstrapRemoteBearerSession } from "@tabs/client-runtime/authorization";
import {
  BearerConnectionCredential,
  BearerConnectionProfile,
  BearerConnectionRegistration,
  BearerConnectionTarget,
  SshConnectionProfile,
  SshConnectionRegistration,
  SshConnectionTarget,
} from "@tabs/client-runtime/connection";
import { fetchRemoteEnvironmentDescriptor } from "@tabs/client-runtime/environment";
import {
  ConnectionCatalogDocument,
  EMPTY_CONNECTION_CATALOG_DOCUMENT,
  registerConnectionInCatalog,
  removeConnectionFromCatalog,
} from "@tabs/client-runtime/platform";
import { AuthStandardClientScopes, type DesktopSshEnvironmentTarget } from "@tabs/contracts";
import { resolveRemotePairingTarget } from "@tabs/shared/remote";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";

const CatalogJson = Schema.fromJsonString(ConnectionCatalogDocument);
const decodeCatalog = Schema.decodeUnknownSync(CatalogJson);
const encodeCatalog = Schema.encodeSync(CatalogJson);

export interface SavedManualConnection {
  readonly environmentId: string;
  readonly label: string;
  readonly kind: "remote" | "ssh" | "relay";
}

async function readCatalog() {
  const raw = await window.desktopBridge?.getConnectionCatalog?.();
  if (!raw) return EMPTY_CONNECTION_CATALOG_DOCUMENT;
  try {
    return decodeCatalog(raw);
  } catch {
    return EMPTY_CONNECTION_CATALOG_DOCUMENT;
  }
}

async function writeCatalog(catalog: typeof ConnectionCatalogDocument.Type) {
  const stored = await window.desktopBridge?.setConnectionCatalog?.(encodeCatalog(catalog));
  if (stored !== true) throw new Error("Desktop connection storage is unavailable.");
}

export async function listManualConnections(): Promise<readonly SavedManualConnection[]> {
  const catalog = await readCatalog();
  return catalog.targets.map((target) => ({
    environmentId: target.environmentId,
    label: target.label,
    kind:
      target._tag === "SshConnectionTarget"
        ? "ssh"
        : target._tag === "RelayConnectionTarget"
          ? "relay"
          : "remote",
  }));
}

export async function registerManualRemote(input: { host: string; pairingCode: string }) {
  const target = resolveRemotePairingTarget(input);
  const descriptor = await Effect.runPromise(
    fetchRemoteEnvironmentDescriptor({ httpBaseUrl: target.httpBaseUrl }).pipe(
      Effect.provide(FetchHttpClient.layer),
    ),
  );
  const access = await Effect.runPromise(
    bootstrapRemoteBearerSession({
      httpBaseUrl: target.httpBaseUrl,
      credential: target.credential,
      scopes: AuthStandardClientScopes,
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  );
  const connectionId = `bearer:${descriptor.environmentId}`;
  const registration = new BearerConnectionRegistration({
    target: new BearerConnectionTarget({
      environmentId: descriptor.environmentId,
      label: descriptor.label,
      connectionId,
    }),
    profile: new BearerConnectionProfile({
      connectionId,
      environmentId: descriptor.environmentId,
      label: descriptor.label,
      httpBaseUrl: target.httpBaseUrl,
      wsBaseUrl: target.wsBaseUrl,
    }),
    credential: new BearerConnectionCredential({ token: access.access_token }),
  });
  await writeCatalog(registerConnectionInCatalog(await readCatalog(), registration));
  return descriptor.environmentId;
}

export async function registerManualSsh(target: DesktopSshEnvironmentTarget) {
  const bridge = window.desktopBridge;
  if (!bridge) throw new Error("SSH environments are only available in the desktop app.");
  const bootstrap = await bridge.ensureSshEnvironment(target, { issuePairingToken: true });
  if (!bootstrap.pairingToken)
    throw new Error("The SSH environment did not issue a pairing token.");
  const descriptor = await bridge.fetchSshEnvironmentDescriptor(bootstrap.httpBaseUrl);
  await bridge.bootstrapSshBearerSession(bootstrap.httpBaseUrl, bootstrap.pairingToken);
  const connectionId = `ssh:${descriptor.environmentId}`;
  const registration = new SshConnectionRegistration({
    target: new SshConnectionTarget({
      environmentId: descriptor.environmentId,
      label: descriptor.label,
      connectionId,
    }),
    profile: new SshConnectionProfile({
      connectionId,
      environmentId: descriptor.environmentId,
      label: descriptor.label,
      target: bootstrap.target,
    }),
  });
  await writeCatalog(registerConnectionInCatalog(await readCatalog(), registration));
  return descriptor.environmentId;
}

export async function removeManualConnection(environmentId: string) {
  const catalog = await readCatalog();
  const target = catalog.targets.find((entry) => entry.environmentId === environmentId);
  if (!target) return;
  if (target._tag === "SshConnectionTarget") {
    const profile = catalog.profiles.find(
      (entry) =>
        entry._tag === "SshConnectionProfile" && entry.connectionId === target.connectionId,
    );
    if (profile?._tag === "SshConnectionProfile") {
      await window.desktopBridge?.disconnectSshEnvironment(profile.target).catch(() => undefined);
    }
  }
  await writeCatalog(removeConnectionFromCatalog(catalog, target));
}
