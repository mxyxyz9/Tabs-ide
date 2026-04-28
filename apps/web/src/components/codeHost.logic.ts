export function getDefaultCodeHostUnavailableMessage(): string {
  return [
    "Build the local editor checkout with `cd ../tabs-code-main && npm install && npm run compile`.",
    "Then set `TABS_CODE_OSS_BUILD_DIR` to the local `tabs-code-main` checkout root, or `TABS_CODE_OSS_ENTRY` to a served workbench URL if you explicitly want the web runtime.",
  ].join(" ");
}

export function getCodeHostUnavailableMessage(reason: string | null): string {
  return reason ?? getDefaultCodeHostUnavailableMessage();
}
