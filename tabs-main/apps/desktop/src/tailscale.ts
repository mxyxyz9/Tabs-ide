import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface TailscaleStatus {
  available: boolean;
  running: boolean;
  magicDnsName: string | null;
  ipv4: string | null;
}

export async function getTailscaleStatus(): Promise<TailscaleStatus> {
  try {
    const { stdout } = await exec("tailscale", ["status", "--json"], { timeout: 5000 });
    const data = JSON.parse(stdout);
    return {
      available: true,
      running: data.BackendState === "Running",
      magicDnsName: data.Self?.DNSName ?? null,
      ipv4: data.Self?.TailscaleIPs?.[0] ?? null,
    };
  } catch {
    return { available: false, running: false, magicDnsName: null, ipv4: null };
  }
}
