# DMG Build VS Code Runtime Loading Fix

## Problem Summary

The Tabs desktop application DMG was building successfully but failing to load the embedded VS Code runtime, resulting in a "workbench readiness timeout" error. The app would fall back to a fallback workspace instead of loading the embedded VS Code editor.

## Root Cause Analysis

### Issue 1: ROOT_DIR Points Inside asar Archive ❌

**Location**: `tabs-main/apps/desktop/src/main.ts` line 107

**Problem**:
```typescript
const ROOT_DIR = Path.resolve(__dirname, "../../..");
```

In packaged apps:
- `__dirname` = `/Applications/Tabs.app/Contents/Resources/app.asar/apps/desktop/dist-electron`
- `ROOT_DIR` = `/Applications/Tabs.app/Contents/Resources/app.asar` (INSIDE asar ❌)
- VS Code runtime actual location: `/Applications/Tabs.app/Contents/Resources/tabs-code-main` (OUTSIDE asar ✓)

**Impact**: The code was looking for VS Code relative to `ROOT_DIR`, but `ROOT_DIR` pointed inside the asar archive where VS Code cannot be placed (asar files are read-only archives).

### Issue 2: VS Code Runtime Copied Into asar File ❌

**Location**: `tabs-main/scripts/build-desktop-artifact.ts` line 682

**Problem**:
```typescript
// This copied EVERYTHING including tabs-code-main into the asar
yield* fs.copy(stageResourcesDir, path.join(stageAppDir, "apps/desktop/prod-resources"));
```

**Impact**:
1. Bloated the asar file unnecessarily (167MB+ of VS Code files inside asar)
2. Placed VS Code in the wrong location where it cannot be accessed
3. Duplicated the VS Code runtime (it was already correctly placed in `Resources/tabs-code-main` by electron-builder's `extraFiles` config)

### Issue 3: Path Resolution Confusion

**Location**: `tabs-main/apps/desktop/src/codeHostManager.ts` lines 456-476

**Problem**: While the fallback path resolution did check `process.resourcesPath/tabs-code-main` first (correct), the `input.rootDir` parameter was still pointing inside the asar, causing confusion in the resolution logic and making debugging difficult.

## The Fix

### Fix 1: Correct ROOT_DIR for Packaged Apps ✓

**File**: `tabs-main/apps/desktop/src/main.ts`

**Change**:
```typescript
// OLD (WRONG):
const ROOT_DIR = Path.resolve(__dirname, "../../..");

// NEW (CORRECT):
const ROOT_DIR = app.isPackaged && process.resourcesPath
  ? process.resourcesPath
  : Path.resolve(__dirname, "../../..");
```

**Explanation**: In packaged apps, `ROOT_DIR` now correctly points to `/Applications/Tabs.app/Contents/Resources` (where `tabs-code-main` is located), not inside the asar archive.

### Fix 2: Exclude VS Code from asar File ✓

**File**: `tabs-main/scripts/build-desktop-artifact.ts`

**Change**:
```typescript
// OLD (WRONG):
yield* fs.copy(stageResourcesDir, path.join(stageAppDir, "apps/desktop/prod-resources"));

// NEW (CORRECT):
const prodResourcesDir = path.join(stageAppDir, "apps/desktop/prod-resources");
yield* fs.makeDirectory(prodResourcesDir, { recursive: true });

const resourceEntries = yield* fs.readDirectory(stageResourcesDir);
for (const entry of resourceEntries) {
  // Skip tabs-code-main - it should NOT be in the asar file
  if (entry === "tabs-code-main") {
    continue;
  }
  const from = path.join(stageResourcesDir, entry);
  const to = path.join(prodResourcesDir, entry);
  // ... copy logic for other resources
}
```

**Explanation**: Now only copies necessary resources (icons, etc.) into `prod-resources` (which goes into the asar), while `tabs-code-main` remains only in `stageResourcesDir` where electron-builder's `extraFiles` config will package it correctly outside the asar.

### Fix 3: Clean Up Debug Logging ✓

**File**: `tabs-main/apps/desktop/src/codeHostManager.ts`

**Change**: Removed extensive debug logging that was added during investigation, since the root cause is now fixed.

## How electron-builder Packaging Works

1. **asar Archive** (`app.asar`):
   - Contains the main application code
   - Read-only, compressed archive
   - Located at: `Contents/Resources/app.asar`
   - Should contain: JavaScript, small assets, configuration

2. **extraFiles** (unpacked):
   - Defined in `build.extraFiles` in package.json
   - Copied outside the asar archive
   - Located at: `Contents/Resources/`
   - Should contain: Large files, native binaries, VS Code runtime

3. **Our Configuration**:
   ```json
   "extraFiles": [
     {
       "from": "apps/desktop/resources/tabs-code-main",
       "to": "Resources/tabs-code-main",
       "filter": ["!**/*.ts", "!**/node_modules/**", "!**/.git"]
     }
   ]
   ```

## Testing Instructions

### 1. Clean Previous Build
```bash
cd tabs-main
rm -rf release/Tabs-0.0.14-arm64.{zip,dmg}
rm -rf apps/desktop/dist-electron
rm -rf apps/server/dist
```

### 2. Rebuild Desktop App
```bash
bun run build:desktop
```

### 3. Create DMG
```bash
bun run dist:desktop:dmg
```

This will create both:
- `release/Tabs-0.0.14-arm64.zip` (working)
- `release/Tabs-0.0.14-arm64.dmg` (should now work!)

### 4. Install and Test
```bash
# Mount the DMG
open release/Tabs-0.0.14-arm64.dmg

# Drag Tabs.app to Applications
# Launch Tabs from Applications folder

# Expected behavior:
# ✓ App launches successfully
# ✓ VS Code runtime loads (no "workbench readiness timeout")
# ✓ Embedded VS Code editor appears
# ✓ No fallback to fallback workspace
```

### 5. Verify VS Code Runtime Location
```bash
# Check that tabs-code-main is OUTSIDE the asar
ls -lh /Applications/Tabs.app/Contents/Resources/tabs-code-main

# Check that tabs-code-main is NOT inside the asar
# (This command should fail or show much smaller size)
npx asar list /Applications/Tabs.app/Contents/Resources/app.asar | grep tabs-code-main
```

## Expected Results

### Before Fix ❌
- DMG builds successfully (959 MB)
- App launches but shows "workbench readiness timeout"
- Falls back to fallback workspace
- VS Code runtime not loaded
- `tabs-code-main` was duplicated (inside asar + outside)
- Asar file was bloated (~200MB+)

### After Fix ✓
- DMG builds successfully (~800MB, smaller due to no duplication)
- App launches successfully
- VS Code runtime loads correctly
- Embedded VS Code editor appears
- `tabs-code-main` exists only outside asar at `Resources/tabs-code-main`
- Asar file is lean (~30-40MB)

## Files Modified

1. **tabs-main/apps/desktop/src/main.ts**
   - Fixed `ROOT_DIR` calculation to use `process.resourcesPath` in packaged apps

2. **tabs-main/apps/desktop/src/codeHostManager.ts**
   - Removed debug logging (root cause fixed)

3. **tabs-main/scripts/build-desktop-artifact.ts**
   - Modified to exclude `tabs-code-main` from `prod-resources` copy
   - Prevents VS Code from being packaged inside asar

## Additional Notes

### Why This Matters
- **asar files are read-only**: VS Code needs to write to its own directories (extensions, cache, etc.)
- **Performance**: Large files in asar slow down app startup
- **Code signing**: Symlinks and certain file types inside asar can break macOS code signing
- **Electron best practices**: Large runtimes should be unpacked

### Related Issues Fixed Previously
1. **Symlink Issue**: Absolute symlinks in `.claude/` directory broke code signing (fixed by removing `.claude` after copy)
2. **electron-builder DMG Bug**: Large files (167MB Electron Framework) weren't copied to DMG (workaround: use ZIP or custom DMG script)

### Workaround Script (Still Available)
If you still encounter DMG creation issues with electron-builder, the workaround script is available:
```bash
./tabs-main/scripts/create-dmg-from-zip.sh release/Tabs-0.0.14-arm64.zip
```

This uses `hdiutil` to create a DMG from the working ZIP file.

## Verification Checklist

- [ ] Build completes without errors
- [ ] DMG file is created (~800MB)
- [ ] App installs from DMG
- [ ] App launches without errors
- [ ] VS Code runtime loads (no timeout)
- [ ] Embedded editor appears
- [ ] Can open files in VS Code
- [ ] Can create new files
- [ ] Extensions load correctly
- [ ] No "workbench readiness timeout" error
- [ ] Console shows no VS Code runtime errors
- [ ] `tabs-code-main` exists at `Resources/tabs-code-main`
- [ ] `tabs-code-main` is NOT in asar file
- [ ] Asar file size is reasonable (~30-40MB)

## Conclusion

The fix addresses the fundamental issue: **packaged Electron apps need to distinguish between code inside the asar archive and resources outside it**. By correctly setting `ROOT_DIR` to `process.resourcesPath` in packaged apps and ensuring VS Code stays outside the asar, the embedded VS Code runtime can now be found and loaded successfully.
