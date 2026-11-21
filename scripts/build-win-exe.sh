#!/usr/bin/env bash
# Build the real Windows .exe (NSIS) on Linux WITHOUT wine.
#
# Why the patch: electron-builder's NSIS target needs wine on Linux only to
# extract the uninstaller — it runs the half-built installer under wine so it
# writes out the uninstaller stub. This recipe swaps that step for the static
# UninstallerReader (the exact code path electron-builder already uses on
# macOS Catalina+, where wine is unavailable).
#
# Result: release/VisionCut AI Setup <version>.exe, copied to public/downloads/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/desktop"

# 1) dependencies
[ -d node_modules ] || npm install --no-audit --no-fund

# 2) patch the wine step -> static uninstaller extraction
TARGET="node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js"
FROM='await (0, wine_1.execWine)(installerPath, null, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });'
TO='await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath);'
if grep -qF "$FROM" "$TARGET"; then
  node -e '
    const fs = require("fs");
    const p = process.argv[1], from = process.argv[2], to = process.argv[3];
    let s = fs.readFileSync(p, "utf8");
    if (!s.includes(from)) { console.error("patch target not found"); process.exit(1); }
    fs.writeFileSync(p, s.replace(from, to));
    console.log("patched NsisTarget.js: wine -> static UninstallerReader");
  ' "$TARGET" "$FROM" "$TO"
else
  echo "already patched (or upstream changed) — checking TO marker"
  grep -qF "UninstallerReader.exec(installerPath" "$TARGET" || { echo "unexpected NsisTarget.js state"; exit 1; }
fi

# 3) build (signAndEditExecutable=false: rcedit/signtool need wine; the NSIS
#    installer itself and the app still build fine — exe icon is the Electron
#    default until a Windows CI runner embeds the app icon)
npx electron-builder --win nsis --x64 --publish never \
  -c.win.signAndEditExecutable=false -c.compression=maximum

# 4) publish into the site's public downloads
VERSION="$(node -p "require('./package.json').version")"
mkdir -p "$ROOT/public/downloads"
cp "release/VisionCut AI Setup $VERSION.exe" \
   "$ROOT/public/downloads/VisionCut-Setup-$VERSION.exe"
echo "OK -> public/downloads/VisionCut-Setup-$VERSION.exe"
sha256sum "$ROOT/public/downloads/VisionCut-Setup-$VERSION.exe"
