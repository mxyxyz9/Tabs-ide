import React from "react";
import { readNativeApi } from "../../nativeApi";
import { AuditPanel } from "../audit/AuditPanel";

export function ReviewPanel({ cwd }: { cwd: string; activePanel?: string }) {
  const api = readNativeApi();
  return <AuditPanel cwd={cwd} api={api} />;
}
