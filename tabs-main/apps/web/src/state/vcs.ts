import { useAtomValue } from "@effect/atom-react";
import type { GitListBranchesResult, GitStatusResult } from "@tabs/contracts";
import { Atom } from "@tabs/client-runtime/state";
import { useEffect } from "react";

import { ensureNativeApi } from "../nativeApi";
import { appAtomRegistry } from "./atomRegistry";

interface VcsSnapshot {
  readonly statusByCwd: Readonly<Record<string, GitStatusResult | undefined>>;
  readonly branchesByCwd: Readonly<Record<string, GitListBranchesResult | undefined>>;
  readonly errorsByCwd: Readonly<Record<string, Error | undefined>>;
}

const EMPTY_VCS_SNAPSHOT: VcsSnapshot = { statusByCwd: {}, branchesByCwd: {}, errorsByCwd: {} };

export const vcsSnapshotAtom = Atom.make(EMPTY_VCS_SNAPSHOT).pipe(
  Atom.withLabel("tabs-vcs-snapshot"),
  Atom.keepAlive,
);

const refreshes = new Map<string, Promise<void>>();

export function refreshVcs(cwd: string | null): Promise<void> {
  if (!cwd) return Promise.resolve();
  const active = refreshes.get(cwd);
  if (active) return active;
  const refresh = Promise.all([ensureNativeApi().git.status({ cwd }), ensureNativeApi().git.listBranches({ cwd })])
    .then(([status, branches]) => {
      appAtomRegistry.update(vcsSnapshotAtom, (snapshot) => ({
        statusByCwd: { ...snapshot.statusByCwd, [cwd]: status },
        branchesByCwd: { ...snapshot.branchesByCwd, [cwd]: branches },
        errorsByCwd: { ...snapshot.errorsByCwd, [cwd]: undefined },
      }));
    })
    .catch((cause: unknown) => {
      const error = cause instanceof Error ? cause : new Error("Unable to read Git state.");
      appAtomRegistry.update(vcsSnapshotAtom, (snapshot) => ({
        ...snapshot,
        errorsByCwd: { ...snapshot.errorsByCwd, [cwd]: error },
      }));
    })
    .finally(() => refreshes.delete(cwd));
  refreshes.set(cwd, refresh);
  return refresh;
}

export function useVcs(cwd: string | null) {
  const result = useAtomValue(vcsSnapshotAtom, (snapshot) =>
    cwd
      ? {
          status: snapshot.statusByCwd[cwd] ?? null,
          branches: snapshot.branchesByCwd[cwd] ?? null,
          error: snapshot.errorsByCwd[cwd] ?? null,
        }
      : { status: null, branches: null, error: null },
  );
  useEffect(() => {
    void refreshVcs(cwd);
    if (!cwd) return;
    const interval = window.setInterval(() => void refreshVcs(cwd), 15_000);
    return () => window.clearInterval(interval);
  }, [cwd]);
  return result;
}
