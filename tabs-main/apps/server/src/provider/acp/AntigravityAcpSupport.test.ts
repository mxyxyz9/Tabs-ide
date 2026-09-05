import { ANTIGRAVITY_DEFAULT_MODEL } from "@tabs/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as EffectAcpErrors from "effect-acp/errors";
import type * as EffectAcpSchema from "effect-acp/schema";

import {
  antigravityPermissionMode,
  applyAntigravityAcpModelSelection,
} from "./AntigravityAcpSupport";

const modelConfig = {
  id: "model",
  name: "Model",
  type: "select",
  currentValue: "gemini-default",
  options: [
    { value: "gemini-default", name: "Gemini default" },
    { value: "gemini-saved", name: "Gemini saved" },
  ],
} satisfies EffectAcpSchema.SessionConfigOption;

function makeRuntime(
  configOptions: ReadonlyArray<EffectAcpSchema.SessionConfigOption> = [modelConfig],
  failure?: EffectAcpErrors.AcpError,
) {
  const selections: string[] = [];
  return {
    selections,
    runtime: {
      getConfigOptions: Effect.succeed(configOptions),
      setModel: (model: string) =>
        failure
          ? Effect.fail(failure)
          : Effect.sync(() => {
              selections.push(model);
            }),
    },
  };
}

describe("Antigravity ACP support", () => {
  it("maps Tabs permissions to native Antigravity modes", () => {
    expect(antigravityPermissionMode("approval-required")).toBe("default");
    expect(antigravityPermissionMode("auto-accept-edits")).toBe("auto_edit");
    expect(antigravityPermissionMode("full-access")).toBe("yolo");
  });

  it.effect("restores a saved native model after resume", () =>
    Effect.gen(function* () {
      const { runtime, selections } = makeRuntime();
      expect(
        yield* applyAntigravityAcpModelSelection({
          runtime,
          model: "gemini-saved",
          mapError: (cause) => cause,
        }),
      ).toBe("gemini-saved");
      expect(selections).toEqual(["gemini-saved"]);
    }),
  );

  it.effect("keeps the native default for the provider default alias", () =>
    Effect.gen(function* () {
      const { runtime, selections } = makeRuntime();
      expect(
        yield* applyAntigravityAcpModelSelection({
          runtime,
          model: ANTIGRAVITY_DEFAULT_MODEL,
          mapError: (cause) => cause,
        }),
      ).toBe("gemini-default");
      expect(selections).toEqual([]);
    }),
  );

  it.effect("rejects stale model IDs instead of silently selecting another model", () =>
    Effect.gen(function* () {
      const { runtime, selections } = makeRuntime();
      expect(
        yield* applyAntigravityAcpModelSelection({
          runtime,
          model: "gemini-removed",
          mapError: (cause) => cause,
        }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "AcpRequestError", code: -32602 });
      expect(selections).toEqual([]);
    }),
  );
});
