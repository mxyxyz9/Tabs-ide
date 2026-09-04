import { EventEmitter } from "node:events";
import type { WebContents } from "electron";
import { describe, expect, it, vi } from "vitest";
import { JourneyRecorder, journeyCode } from "./journeyRecorder";

function fixture() {
  const debug = Object.assign(new EventEmitter(), {
    isAttached: vi.fn(() => false),
    attach: vi.fn(),
    detach: vi.fn(),
    sendCommand: vi.fn(async () => ({ identifier: "script-1" })),
  });
  const contents = Object.assign(new EventEmitter(), {
    debugger: debug,
    getURL: () => "https://example.com/start?token=secret",
    isDestroyed: () => false,
    executeJavaScript: vi.fn(async () => undefined),
  });
  return { debug, contents, recorder: new JourneyRecorder(contents as unknown as WebContents) };
}

describe("embedded journey recorder", () => {
  it("cleans listeners and injected script after repeated recording", async () => {
    const { debug, contents, recorder } = fixture();
    for (let index = 0; index < 3; index++) {
      await recorder.start();
      expect(debug.listenerCount("message")).toBe(1);
      const output = await recorder.stop();
      expect(output.code).not.toContain("token=secret");
      expect(debug.listenerCount("message")).toBe(0);
      expect(contents.listenerCount("destroyed")).toBe(0);
    }
    expect(debug.sendCommand).toHaveBeenCalledWith("Page.removeScriptToEvaluateOnNewDocument", {
      identifier: "script-1",
    });
  });
  it("cleans up a failed injection", async () => {
    const { recorder, debug, contents } = fixture();
    contents.executeJavaScript.mockRejectedValueOnce(new Error("navigation interrupted"));
    await expect(recorder.start()).rejects.toThrow("navigation interrupted");
    expect(debug.listenerCount("message")).toBe(0);
    expect(recorder.status().recording).toBe(false);
  });
  it("exports placeholders and an explicit assertion-review guard", () => {
    const code = journeyCode("https://example.com", [
      { action: "fill", selector: "input:nth-of-type(1)" },
      { action: "click", selector: "button" },
    ]);
    expect(code).toContain("RECORDED_INPUT_1");
    expect(code).toContain('throw new Error("Add expected-result assertions');
    expect(code).not.toContain("test.skip");
  });
});
