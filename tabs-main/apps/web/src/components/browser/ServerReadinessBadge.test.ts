import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { probeServerReadiness } from "./ServerReadinessBadge";

describe("probeServerReadiness", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns not_local for external non-loopback domains", async () => {
    const result = await probeServerReadiness("https://github.com/pulls");
    expect(result.state).toBe("not_local");
  });

  it("returns not_local for invalid URLs", async () => {
    const result = await probeServerReadiness("not-a-valid-url");
    expect(result.state).toBe("not_local");
  });

  it("reports ready when localhost server responds successfully", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
    } as unknown as Response);

    const result = await probeServerReadiness("http://localhost:5173");
    expect(result.state).toBe("ready");
    expect(result.latencyMs).toBeDefined();
    expect(result.lastProbedAt).toBeDefined();
  });

  it("reports offline when localhost server fetch rejects", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await probeServerReadiness("http://127.0.0.1:3000");
    expect(result.state).toBe("offline");
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("aborts and reports offline when probe times out", async () => {
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("The operation was aborted")), 20);
        }),
    );

    const result = await probeServerReadiness("http://localhost:8080", 10);
    expect(result.state).toBe("offline");
  });
});
