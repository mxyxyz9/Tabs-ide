import { describe, expect, it } from "vitest";
import {
  STARTUP_ANIMATION_HOLD_MS,
  STARTUP_ANIMATION_EXIT_MS,
} from "../components/SplashScreen";

describe("Startup splash timing constraints", () => {
  it("preserves the short anti-flash period without arbitrary multi-second hold", () => {
    expect(STARTUP_ANIMATION_HOLD_MS).toBe(150);
    expect(STARTUP_ANIMATION_HOLD_MS).toBeLessThanOrEqual(250);
  });

  it("preserves the exact 200 ms bottom-exit animation duration", () => {
    expect(STARTUP_ANIMATION_EXIT_MS).toBe(200);
  });
});
