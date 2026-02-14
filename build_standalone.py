#!/usr/bin/env python3
"""Build standalone Clarity binaries and macOS .app bundle.

Creates:
  1. A standalone `clarity` CLI binary (PyInstaller)
  2. A macOS `Clarity.app` you launch from Spotlight/Dock/Finder

Usage:
  python build_standalone.py              # Build CLI binary + .app
  python build_standalone.py --cli-only   # Just the CLI binary
  python build_standalone.py --app-only   # Just the .app (needs CLI binary)

Requirements:
  pip install pyinstaller
"""

import os
import sys
import subprocess
import shutil
import stat
import plistlib


PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
STDLIB_DIR = os.path.join(PROJECT_ROOT, "stdlib")
CLARITY_PKG = os.path.join(PROJECT_ROOT, "clarity")
DIST_DIR = os.path.join(PROJECT_ROOT, "dist")
BUILD_DIR = os.path.join(PROJECT_ROOT, "build")
APP_NAME = "Clarity"
APP_BUNDLE = os.path.join(DIST_DIR, f"{APP_NAME}.app")


# ── PyInstaller CLI binary ────────────────────────────────

def check_pyinstaller():
    """Ensure PyInstaller is installed."""
    try:
        import PyInstaller
    except ImportError:
        print("  Installing PyInstaller...")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "pyinstaller"],
            stdout=subprocess.DEVNULL,
        )


def collect_stdlib_files():
    """Collect all .clarity files from stdlib/."""
    files = []
    for root, dirs, filenames in os.walk(STDLIB_DIR):
        for f in filenames:
            if f.endswith(".clarity"):
                src = os.path.join(root, f)
                rel = os.path.relpath(src, PROJECT_ROOT)
                files.append((src, os.path.dirname(rel)))
    return files


def build_cli_binary():
    """Build the standalone clarity CLI with PyInstaller."""
    print("━━━ Building CLI binary ━━━")
    check_pyinstaller()

    stdlib_files = collect_stdlib_files()
    print(f"  Bundling {len(stdlib_files)} stdlib files...")

    datas = [f"--add-data={src}{os.pathsep}{dest}" for src, dest in stdlib_files]

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name=clarity",
        "--onefile",
        "--clean",
        "--noconfirm",
        "--log-level=WARN",
    ]
    cmd.extend(datas)
    cmd.extend([
        "--hidden-import=clarity",
        "--hidden-import=clarity.cli",
        "--hidden-import=clarity.lexer",
        "--hidden-import=clarity.parser",
        "--hidden-import=clarity.interpreter",
        "--hidden-import=clarity.runtime",
        "--hidden-import=clarity.errors",
        "--hidden-import=clarity.tokens",
        "--hidden-import=clarity.ast_nodes",
        "--hidden-import=clarity.bytecode",
        "--hidden-import=clarity.package",
        "--hidden-import=clarity.lsp",
    ])
    cmd.append(os.path.join(CLARITY_PKG, "__main__.py"))

    subprocess.check_call(cmd, cwd=PROJECT_ROOT)

    exe_path = os.path.join(DIST_DIR, "clarity")
    if sys.platform == "win32":
        exe_path += ".exe"

    if os.path.exists(exe_path):
        size_mb = os.path.getsize(exe_path) / (1024 * 1024)
        print(f"  CLI binary: {exe_path} ({size_mb:.1f} MB)")
        return exe_path
    else:
        print("  ERROR: Build failed — binary not found")
        sys.exit(1)


# ── macOS .app bundle ─────────────────────────────────────

def build_macos_app(cli_binary_path):
    """Create Clarity.app — a real macOS application."""
    if sys.platform != "darwin":
        print("  Skipping .app build (not on macOS)")
        print("  The CLI binary works on any platform.")
        return

    print()
    print("━━━ Building Clarity.app ━━━")

    # Clean previous build
    if os.path.exists(APP_BUNDLE):
        shutil.rmtree(APP_BUNDLE)

    # Create .app structure
    contents = os.path.join(APP_BUNDLE, "Contents")
    macos_dir = os.path.join(contents, "MacOS")
    resources = os.path.join(contents, "Resources")
    os.makedirs(macos_dir)
    os.makedirs(resources)

    # ── Info.plist ──
    info_plist = {
        "CFBundleName": APP_NAME,
        "CFBundleDisplayName": APP_NAME,
        "CFBundleIdentifier": "dev.clarity.terminal",
        "CFBundleVersion": "0.4.0",
        "CFBundleShortVersionString": "0.4.0",
        "CFBundlePackageType": "APPL",
        "CFBundleSignature": "CLRT",
        "CFBundleExecutable": "clarity-terminal",
        "CFBundleIconFile": "clarity",
        "LSMinimumSystemVersion": "10.15",
        "NSHighResolutionCapable": True,
        "CFBundleDocumentTypes": [{
            "CFBundleTypeExtensions": ["clarity"],
            "CFBundleTypeName": "Clarity Source File",
            "CFBundleTypeRole": "Editor",
            "LSItemContentTypes": ["dev.clarity.source"],
        }],
        "UTExportedTypeDeclarations": [{
            "UTTypeIdentifier": "dev.clarity.source",
            "UTTypeConformsTo": ["public.plain-text"],
            "UTTypeDescription": "Clarity Source File",
            "UTTypeTagSpecification": {
                "public.filename-extension": ["clarity"],
            },
        }],
    }
    plist_path = os.path.join(contents, "Info.plist")
    with open(plist_path, "wb") as f:
        plistlib.dump(info_plist, f)

    # ── Copy CLI binary into the .app ──
    app_binary = os.path.join(macos_dir, "clarity")
    shutil.copy2(cli_binary_path, app_binary)
    os.chmod(app_binary, 0o755)

    # ── Main launcher script ──
    # This is the actual executable that macOS runs when you launch the .app.
    # It creates a native terminal window running the Clarity shell.
    launcher_path = os.path.join(macos_dir, "clarity-terminal")
    with open(launcher_path, "w") as f:
        f.write(LAUNCHER_SCRIPT)
    os.chmod(launcher_path, 0o755)

    # ── Terminal profile (for native look) ──
    profile_path = os.path.join(resources, "clarity.terminal")
    with open(profile_path, "w") as f:
        f.write(TERMINAL_PROFILE)

    # ── Generate app icon ──
    generate_icon(resources)

    print(f"  App bundle: {APP_BUNDLE}")
    print()
    print("  ┌─────────────────────────────────────────┐")
    print("  │  Install:                                │")
    print("  │    cp -r dist/Clarity.app /Applications/  │")
    print("  │                                          │")
    print("  │  Then launch 'Clarity' from Spotlight.   │")
    print("  └─────────────────────────────────────────┘")


# The launcher opens a proper terminal window running Clarity.
# On first launch it tries the native Terminal.app profile for best UX.
# Falls back to a basic Terminal.app window if needed.
LAUNCHER_SCRIPT = r'''#!/bin/bash
# Clarity Terminal Launcher
# Opens a native terminal window running the Clarity shell.

DIR="$(cd "$(dirname "$0")" && pwd)"
CLARITY="$DIR/clarity"

# Ensure the binary is executable
chmod +x "$CLARITY" 2>/dev/null

# Try to find the terminal profile for styled window
PROFILE="$DIR/../Resources/clarity.terminal"

if [ -f "$PROFILE" ]; then
    # Open with custom terminal profile (dark theme, styled)
    open "$PROFILE"
    # Wait a moment then run clarity in the new window
    sleep 0.5
    osascript -e "
        tell application \"Terminal\"
            activate
            do script \"exec '$CLARITY' shell\" in front window
        end tell
    " 2>/dev/null
else
    # Fallback: plain Terminal.app window
    osascript -e "
        tell application \"Terminal\"
            activate
            do script \"exec '$CLARITY' shell\"
        end tell
    " 2>/dev/null
fi
'''

# macOS Terminal.app profile — dark theme matching Clarity's aesthetic
TERMINAL_PROFILE = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>name</key>
    <string>Clarity</string>
    <key>type</key>
    <string>Window Settings</string>

    <!-- Dark background -->
    <key>BackgroundColor</key>
    <data>YnBsaXN0MDDUAQIDBAUGBwpYJHZlcnNpb25ZJGFyY2hpdmVyVCR0b3BYJG9iamVjdHMSAAGGoF8QD05TS2V5ZWRBcmNoaXZlctEICVRyb290gAGjCwwTVSRudWxs0w0ODxARElVOU1JHQlxOU0NvbG9yU3BhY2VWJGNsYXNzTxAYMC4wOTQxMTc2NSAwLjA5ODAzOSAxEAKAAtIUFRYXWiRjbGFzc25hbWVYJGNsYXNzZXNXTlNDb2xvcqIWGFhOU09iamVjdAgRGiQpMjdJTFFTVlxhcnR2gQGDAAAAAAAAAQEAAAAAAAAAGQAAAAAAAAAAAAAAAAAAAJU=</data>

    <!-- Light text -->
    <key>TextColor</key>
    <data>YnBsaXN0MDDUAQIDBAUGBwpYJHZlcnNpb25ZJGFyY2hpdmVyVCR0b3BYJG9iamVjdHMSAAGGoF8QD05TS2V5ZWRBcmNoaXZlctEICVRyb290gAGjCwwTVSRudWxs0w0ODxARElVOU1JHQlxOU0NvbG9yU3BhY2VWJGNsYXNzTxAoMC45NDExNzY0NyAwLjk0MTE3NjQ3IDAuOTQxMTc2NDcgMC44NRADgALSFBUWF1okY2xhc3NuYW1lWCRjbGFzc2VzV05TQ29sb3KiFhhYTlNPYmplY3QIERokKTI3SUxRU1ZcYXF+gIKEhgAAAAAAAAEBAAAAAAAAABkAAAAAAAAAAAAAAAAAAACT</data>

    <!-- Font: Menlo 14pt -->
    <key>Font</key>
    <data>YnBsaXN0MDDUAQIDBAUGBwpYJHZlcnNpb25ZJGFyY2hpdmVyVCR0b3BYJG9iamVjdHMSAAGGoF8QD05TS2V5ZWRBcmNoaXZlctEICVRyb290gAGjCwwRVSRudWxs0w0ODxBfEBpNZW5sby1SZWd1bGFyI0AsAAAAAAAAgALSEhMUFVokY2xhc3NuYW1lWCRjbGFzc2VzVk5TRm9udKIUFlhOU09iamVjdAgRGiQpMjdJTFFTWV8QGmMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAawAAAAAAAACJ</data>

    <!-- Window size -->
    <key>columnCount</key>
    <integer>110</integer>
    <key>rowCount</key>
    <integer>32</integer>

    <!-- Shell exits: close window -->
    <key>shellExitAction</key>
    <integer>0</integer>

    <!-- Title -->
    <key>WindowTitle</key>
    <string>Clarity</string>

    <!-- Cursor -->
    <key>CursorType</key>
    <integer>1</integer>
    <key>CursorBlink</key>
    <true/>
</dict>
</plist>
'''


def generate_icon(resources_dir):
    """Generate a Clarity app icon.

    Creates an .icns file from a programmatically generated icon.
    Uses sips (built into macOS) for conversion.
    On non-macOS, creates a placeholder.
    """
    # Create a simple SVG icon, then convert
    icon_svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00d4ff"/>
      <stop offset="100%" stop-color="#7b2ff7"/>
    </linearGradient>
  </defs>
  <!-- Background rounded rect -->
  <rect x="32" y="32" width="960" height="960" rx="200" fill="url(#bg)"/>
  <!-- Terminal prompt caret -->
  <text x="200" y="620" font-family="Menlo,monospace" font-size="480"
        font-weight="bold" fill="url(#accent)">C</text>
  <!-- Cursor blink line -->
  <rect x="620" y="280" width="40" height="340" rx="8" fill="#00d4ff" opacity="0.8"/>
  <!-- Subtle underline -->
  <rect x="180" y="680" width="500" height="6" rx="3" fill="#00d4ff" opacity="0.3"/>
</svg>'''

    svg_path = os.path.join(resources_dir, "clarity_icon.svg")
    with open(svg_path, "w") as f:
        f.write(icon_svg)

    if sys.platform == "darwin":
        # Convert SVG → PNG → ICNS using macOS built-in tools
        iconset = os.path.join(resources_dir, "clarity.iconset")
        os.makedirs(iconset, exist_ok=True)

        # Use qlmanage or sips to render SVG to PNG
        # First try rsvg-convert, then fall back to sips
        png_1024 = os.path.join(iconset, "icon_512x512@2x.png")

        try:
            # Try rsvg-convert (from librsvg, available via brew)
            subprocess.check_call(
                ["rsvg-convert", "-w", "1024", "-h", "1024", svg_path, "-o", png_1024],
                stderr=subprocess.DEVNULL,
            )
        except (FileNotFoundError, subprocess.CalledProcessError):
            try:
                # Fallback: use Python + cairosvg if available
                import cairosvg
                cairosvg.svg2png(
                    url=svg_path, write_to=png_1024,
                    output_width=1024, output_height=1024,
                )
            except ImportError:
                # Last resort: create a simple PNG with Pillow or skip
                print("  (icon: using placeholder — install rsvg-convert for full icon)")
                _create_placeholder_icon(resources_dir)
                return

        # Generate all required icon sizes
        sizes = [16, 32, 64, 128, 256, 512]
        for size in sizes:
            out = os.path.join(iconset, f"icon_{size}x{size}.png")
            subprocess.run(
                ["sips", "-z", str(size), str(size), png_1024, "--out", out],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            out2x = os.path.join(iconset, f"icon_{size}x{size}@2x.png")
            subprocess.run(
                ["sips", "-z", str(size * 2), str(size * 2), png_1024, "--out", out2x],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )

        # Convert iconset to icns
        icns_path = os.path.join(resources_dir, "clarity.icns")
        subprocess.run(
            ["iconutil", "-c", "icns", iconset, "-o", icns_path],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        # Cleanup
        shutil.rmtree(iconset, ignore_errors=True)
        if os.path.exists(icns_path):
            print(f"  App icon: {icns_path}")
        else:
            _create_placeholder_icon(resources_dir)
    else:
        print("  (icon generation requires macOS — placeholder created)")
        _create_placeholder_icon(resources_dir)


def _create_placeholder_icon(resources_dir):
    """Create a minimal placeholder .icns file."""
    # Just keep the SVG for reference; .app will use default icon
    pass


# ── Main ──────────────────────────────────────────────────

def main():
    cli_only = "--cli-only" in sys.argv
    app_only = "--app-only" in sys.argv

    print()
    print("  ┌───────────────────────────────────┐")
    print("  │   Building Clarity Terminal        │")
    print("  │   Simple code. Real power.         │")
    print("  └───────────────────────────────────┘")
    print()

    cli_binary = os.path.join(DIST_DIR, "clarity")
    if sys.platform == "win32":
        cli_binary += ".exe"

    if not app_only:
        cli_binary = build_cli_binary()

    if not cli_only:
        if not os.path.exists(cli_binary):
            print(f"  CLI binary not found at {cli_binary}")
            print(f"  Run without --app-only first to build it.")
            sys.exit(1)
        build_macos_app(cli_binary)

    # Print summary
    print()
    print("  ━━━ Done ━━━")
    print()

    if not app_only:
        print(f"  CLI binary:   {cli_binary}")
        print(f"    Install:    sudo cp dist/clarity /usr/local/bin/clarity")
        print()

    if not cli_only and sys.platform == "darwin":
        print(f"  macOS app:    {APP_BUNDLE}")
        print(f"    Install:    cp -r dist/Clarity.app /Applications/")
        print(f"    Then:       Open Spotlight → type 'Clarity' → Enter")
        print()

    if not cli_only and sys.platform != "darwin":
        print("  (macOS .app skipped — not on macOS)")
        print("  The CLI binary works standalone on any platform:")
        print("    ./dist/clarity shell")
        print()


if __name__ == "__main__":
    main()
