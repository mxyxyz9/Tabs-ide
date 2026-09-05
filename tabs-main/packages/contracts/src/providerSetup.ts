import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProviderDriverKind } from "./providerInstance.ts";

const SetupOperationId = TrimmedNonEmptyString.check(Schema.isMaxLength(128));
const ByteCount = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** Observable state for a server-owned provider runtime installation. */
export const ProviderInstallState = Schema.Struct({
  driver: ProviderDriverKind,
  operationId: Schema.NullOr(SetupOperationId),
  phase: Schema.Literals([
    "idle",
    "downloading",
    "extracting",
    "verifying",
    "succeeded",
    "failed",
    "cancelled",
  ]),
  downloadedBytes: ByteCount,
  totalBytes: Schema.NullOr(ByteCount),
  version: Schema.NullOr(TrimmedNonEmptyString),
  installedVersion: Schema.NullOr(TrimmedNonEmptyString),
  canRemove: Schema.Boolean,
  message: Schema.NullOr(Schema.String),
});
export type ProviderInstallState = typeof ProviderInstallState.Type;
