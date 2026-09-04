import React from "react";
import { useGitApi } from "./gitApiContext";
import { AuditPanel } from "../audit/AuditPanel";

export function ReviewPanel({ cwd }: { cwd: string; activePanel?: string }) {
  const api = useGitApi();
  return <AuditPanel cwd={cwd} api={api} />;
}
