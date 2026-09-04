import type { NativeApi } from "@tabs/contracts";
import { createContext, useContext, type ReactNode } from "react";

const GitApiContext = createContext<NativeApi | null>(null);

export function GitApiProvider({ api, children }: { api: NativeApi | null; children: ReactNode }) {
  return <GitApiContext.Provider value={api}>{children}</GitApiContext.Provider>;
}

export function useGitApi(): NativeApi | null {
  return useContext(GitApiContext);
}
