# Release Checklist

This document covers desktop releases from the repository root workflows. The
desktop installers contain the complete Code OSS runtime and do not download it
after installation.

## What the workflow does

- Trigger: push tag matching `v*.*.*`.
- Runs quality gates first: lint, typecheck, test.
- Builds four artifacts in parallel:
  - macOS `arm64` DMG
  - macOS `x64` DMG
  - Linux `x64` AppImage
  - Windows `x64` NSIS installer
- Publishes one GitHub Release with all produced files.
  - Versions with a suffix after `X.Y.Z` (for example `1.2.3-alpha.1`) are published as GitHub prereleases.
  - Only plain `X.Y.Z` releases are marked as the repository's latest release.
- Includes Electron auto-update metadata (for example `latest*.yml` and `*.blockmap`) in release assets.
- Signing is optional and auto-detected per platform from secrets.
- Runs a Windows install and locked-process upgrade smoke test before publishing.

## Platform Readiness & Distribution Tiers

Tabs desktop releases distinguish between fully production-ready platforms, internal/beta builds, and deferred distribution requirements:

### 1. Linux (`.AppImage`) - Release Configuration

- **Build Isolation**: Builds completely independently in CI/local environments without requiring any Apple credentials or secrets.
- **User Data & Session Continuity**: New production installs use `$XDG_CONFIG_HOME/tabs` (defaulting to `~/.config/tabs`), with development mode isolated to `~/.config/tabs-dev`.
- **Legacy Path Compatibility**: Existing `Tabs (Alpha)` profiles retain the precedence used by prior releases. The resolver can also reuse Electron's historical `Tabs` default when no established canonical or alpha profile exists. It never merges or deletes profile directories automatically.
- **Native Verification**: AppImage launch and install-over-existing behavior must be verified on a Linux CI runner or release machine; macOS unit tests cover path selection only.
  - The root `Build Desktop Installers` workflow accepts an existing `artifact_run_id` and launches its packaged AppImage under a virtual display when `smoke_platforms` includes `linux-x64`. It uses AppImage extract-and-run because GitHub runners may restrict FUSE mounts. This checks that the bundled editor backend starts without rebuilding the installer; a normal direct launch on a Linux desktop is still a separate release check.

### 2. Windows (`.exe` NSIS Installer) - Release Configuration

- **Build Isolation**: Builds completely independently in CI/local environments without requiring any Apple credentials or secrets.
- **User Data & DPAPI Continuity**: New installs use `%APPDATA%\tabs` (dev at `%APPDATA%\tabs-dev`); existing `%APPDATA%\Tabs (Alpha)` profiles continue to be selected for compatibility.
- **Installer Identity**: The package uses stable `appId` `com.tabs.app`. NSIS install-over-existing and DPAPI continuity still require native Windows release validation; they cannot be proven by macOS unit tests.
- **Azure Trusted Signing**: Optional for local and internal builds; production signing is isolated to Windows CI jobs using Azure ATS secrets.

### 3. macOS (`.dmg`, `.zip`) — Release Tiers & Accepted Exception

- **Internal / Beta Builds (Unsigned / Ad-hoc)**:
  - Local development and automated testing produce functional ad-hoc signed macOS artifacts (`Signature=adhoc`) without requiring Apple Developer credentials.
  - Public preview builds use the dedicated macOS preview updater. Every update manifest is signed with the Tabs Ed25519 release key, and the app verifies that signature plus the selected ZIP's SHA-512 digest before staging it.
  - The same handwritten `.github/release-notes/vX.Y.Z.md` content is embedded in the Windows and AppImage update metadata and in the signed macOS preview manifest. The desktop update UI shows it before download or installation.
  - The private update key is stored only in the `TABS_MAC_UPDATE_PRIVATE_KEY` GitHub Actions secret. The matching public key is embedded in `apps/desktop/src/macPreviewUpdater.ts`. Losing the private key requires a manual-install migration; never rotate it silently.
  - The updater performs an atomic same-volume application swap with rollback. It does not clear quarantine, disable Gatekeeper, request administrator privileges, or claim that the build is Apple-notarized.
  - Users must still approve the first downloaded build in System Settings > Privacy & Security. Ad-hoc signatures do not provide stable Apple code identity, so privacy or Keychain permissions may need to be granted again after an update.
  - Builds released before this updater was embedded cannot bootstrap themselves and need one final manual installation. Later preview releases can update in place.
- **Production Distribution (Explicitly Deferred)**:
  - Public macOS release distribution requires Apple Developer ID Application code signing and Apple Notarization to pass Gatekeeper without user security overrides.
  - Because an Apple Developer account is not currently active, **Apple Developer ID signing and notarization are an explicitly deferred production-release requirement**.
  - Local macOS packaging and non-macOS release jobs (Windows and Linux) must never be blocked or failed due to the absence of Apple Developer credentials.
  - The root `Build Desktop Installers` workflow reuses existing arm64 and x64 artifacts on matching native runners when `artifact_run_id` is set and `smoke_platforms` includes `mac`. It checks signature, architecture, and editor backend startup after copying the app out of the DMG. It does not establish Gatekeeper approval for a quarantined download.

### 4. Browser-Partition Shutdown & Updater Flushing

- Both standard application quit (`app.on("before-quit")`) and automatic update restarts (`autoUpdater.quitAndInstall()` / `installDownloadedUpdate()`) execute asynchronous, parallel session flushing:
  - Discovers all distinct persistent browser sessions (`persist:tabs-browser:*`).
  - Deduplicates shared sessions (e.g. multiple tabs sharing the same named or project profile).
  - Flushes DOM storage synchronously and awaits each Chromium cookie store with a bounded timeout.
  - Closes child WebContents only after all storage flushes have completed.
  - Flushes the Code-OSS session and main Electron default session before final process exit.

## Desktop auto-update notes

- Runtime updater: `electron-updater` in `apps/desktop/src/main.ts`.
- Update UX:
  - Background checks run on startup delay + interval.
  - No automatic download or install.
  - The desktop UI shows a rocket update button when an update is available; click once to download, click again after download to restart/install.
  - Hovering or focusing the update button shows a concise release-notes preview. Settings > About provides a keyboard-accessible, scrollable "What's new" centered modal dialog with an X mark close button and full Markdown notes.
- Provider: GitHub Releases (`provider: github`) configured at build time.
- Repository slug source:
  - `TABS_DESKTOP_UPDATE_REPOSITORY` (format `owner/repo`), if set.
  - otherwise `GITHUB_REPOSITORY` from GitHub Actions.
- Temporary private-repo auth workaround:
  - set `TABS_DESKTOP_UPDATE_GITHUB_TOKEN` (or `GH_TOKEN`) in the desktop app runtime environment.
  - the app forwards it as an `Authorization: Bearer <token>` request header for updater HTTP calls.
- Required release assets for updater:
  - platform installers (`.exe`, `.dmg`, `.AppImage`, plus macOS `.zip` payloads for the preview updater)
  - `latest.yml` and `latest-linux.yml` metadata for Windows and AppImage updates
  - `*.blockmap` files (used for differential downloads)
- Unsigned macOS preview updater assets:
  - `Tabs-<version>-arm64.zip` and `Tabs-<version>-x64.zip`
  - `tabs-mac-preview-update.json`
  - `tabs-mac-preview-update.json.sig`
  - The release workflow fails rather than publishing an unsigned preview manifest when `TABS_MAC_UPDATE_PRIVATE_KEY` is unavailable.
  - macOS does not consume `latest-mac.yml`; the dedicated signed JSON manifest selects and authenticates the correct architecture ZIP.
- Release-note integrity:
  - Every platform uses `.github/release-notes/vX.Y.Z.md` as its source.
  - The workflow verifies that `latest.yml` and `latest-linux.yml` contain the exact notes before publishing, while the macOS notes are covered by the Ed25519 manifest signature.

## 1) Validate installers without publishing

Run the repository-root `Build Desktop Installers` workflow with all four
platforms selected. It uploads installers as workflow artifacts and runs the
Windows upgrade smoke test without publishing a GitHub Release.

The root `Build Desktop Installers` workflow has a smoke-only mode that reuses platform artifacts from an existing build run. Set `artifact_run_id` and set `smoke_platforms` to `win-x64`, `linux-x64`, `mac`, or a comma-separated combination. Dispatch that existing workflow on `codex/windows-release-repair` for focused native checks after a script-only test change; the build matrix is skipped. The Windows smoke installs a previous release, upgrades it with a process holding an installation file, and launches the upgraded app. Failed Windows runs upload installer and startup logs.

For example, to retest Windows without recompiling after changing only the smoke script:

```bash
gh workflow run build-desktop.yml --ref codex/windows-release-repair -f artifact_run_id=<build-run-id> -f smoke_platforms=win-x64
```

After all four jobs pass, the repository-root `Release Desktop` workflow can
reuse that exact successful run through its `artifact_run_id` input. Its
preflight checks the commit and asset set before publication.

## 2) Apple signing + notarization setup (macOS)

Required secrets used by the workflow:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

Checklist:

1. Apple Developer account access:
   - Team has rights to create Developer ID certificates.
2. Create `Developer ID Application` certificate.
3. Export certificate + private key as `.p12` from Keychain.
4. Base64-encode the `.p12` and store as `CSC_LINK`.
5. Store the `.p12` export password as `CSC_KEY_PASSWORD`.
6. In App Store Connect, create an API key (Team key).
7. Add API key values:
   - `APPLE_API_KEY`: contents of the downloaded `.p8`
   - `APPLE_API_KEY_ID`: Key ID
   - `APPLE_API_ISSUER`: Issuer ID
8. Run a new version release and confirm macOS artifacts are signed/notarized.

Notes:

- `APPLE_API_KEY` is stored as raw key text in secrets.
- The workflow writes it to a temporary `AuthKey_<id>.p8` file at runtime.

## 3) Azure Trusted Signing setup (Windows)

Required secrets used by the workflow:

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TRUSTED_SIGNING_ENDPOINT`
- `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`
- `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME`
- `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME`

Checklist:

1. Create Azure Trusted Signing account and certificate profile.
2. Record ATS values:
   - Endpoint
   - Account name
   - Certificate profile name
   - Publisher name
3. Create/choose an Entra app registration (service principal).
4. Grant service principal permissions required by Trusted Signing.
5. Create a client secret for the service principal.
6. Add Azure secrets listed above in GitHub Actions secrets.
7. Run a new version release and confirm Windows installer is signed.

## 4) Ongoing release checklist

1. Ensure `main` is green in CI.
2. Bump app version as needed.
3. Create release tag: `vX.Y.Z`.
4. Push tag.
5. Verify workflow steps:
   - preflight passes
   - all matrix builds pass
   - Windows installation and upgrade smoke passes
   - release job uploads expected files
6. Smoke test downloaded artifacts.

## 5) Troubleshooting

- macOS build unsigned when expected signed:
  - Check all Apple secrets are populated and non-empty.
- Windows build unsigned when expected signed:
  - Check all Azure ATS and auth secrets are populated and non-empty.
- Build fails with signing error:
  - Retry with secrets removed to confirm unsigned path still works.
  - Re-check certificate/profile names and tenant/client credentials.
