#!/bin/bash
# Workaround script to create a DMG from the ZIP file
# This avoids the electron-builder DMG creation bug where large files aren't copied

set -e

ZIP_FILE="$1"
if [ -z "$ZIP_FILE" ]; then
    echo "Usage: $0 <path-to-zip-file>"
    exit 1
fi

if [ ! -f "$ZIP_FILE" ]; then
    echo "Error: ZIP file not found: $ZIP_FILE"
    exit 1
fi

# Extract version and arch from filename
BASENAME=$(basename "$ZIP_FILE" .zip)
VERSION=$(echo "$BASENAME" | sed 's/Tabs-\(.*\)-\(.*\)/\1/')
ARCH=$(echo "$BASENAME" | sed 's/Tabs-\(.*\)-\(.*\)/\2/')

echo "Creating DMG for Tabs $VERSION ($ARCH)..."

# Create temporary directory
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# Extract ZIP
echo "Extracting ZIP..."
unzip -q "$ZIP_FILE" -d "$TMP_DIR"

# Create DMG
DMG_FILE="${ZIP_FILE%.zip}.dmg"
echo "Creating DMG: $DMG_FILE..."

# Remove old DMG if it exists
rm -f "$DMG_FILE"

# Create DMG using hdiutil (built-in macOS tool)
hdiutil create -volname "Tabs" \
    -srcfolder "$TMP_DIR/Tabs.app" \
    -ov -format UDZO \
    "$DMG_FILE"

echo "DMG created successfully: $DMG_FILE"
ls -lh "$DMG_FILE"
