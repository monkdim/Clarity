#!/bin/bash
# Build a standalone native Clarity binary.
#
# This script:
#   1. Transpiles all Clarity stdlib to JavaScript
#   2. Compiles everything into a single native binary via Bun
#
# Requirements:
#   - Python 3 (for the transpiler, only needed at build time)
#   - Bun (curl -fsSL https://bun.sh/install | bash)
#
# Usage:
#   ./native/build.sh                    # Build for current platform
#   ./native/build.sh --install          # Build + install to /usr/local/bin
#   ./native/build.sh --all              # Build for macOS, Linux, Windows
#   ./native/build.sh --target linux     # Build for specific platform

set -e

BOLD='\033[1m'
GREEN='\033[32m'
CYAN='\033[36m'
DIM='\033[2m'
RED='\033[31m'
YELLOW='\033[33m'
RESET='\033[0m'

DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$DIR")"
DIST="$DIR/dist"

echo ""
echo -e "${BOLD}   Building native Clarity binary${RESET}"
echo -e "${DIM}   No Python needed at runtime.${RESET}"
echo ""

# Check dependencies
if ! command -v python3 &>/dev/null; then
    echo -e "${RED}  Error: python3 required (for transpiler)${RESET}"
    echo "  Install: brew install python3"
    exit 1
fi

if ! command -v bun &>/dev/null; then
    echo -e "${DIM}  Bun not found. Installing...${RESET}"
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

# Step 1: Transpile
echo -e "${CYAN}  Step 1:${RESET} Transpiling Clarity → JavaScript..."
cd "$PROJECT_ROOT"
python3 native/transpile.py --bundle 2>&1 | grep -E "^\s+(Transpil|→|SKIP|runtime|clarity-entry|Bundle)"

# ── Build function ────────────────────────────────────────

build_target() {
    local TARGET="$1"
    local OUTNAME="$2"
    local LABEL="$3"

    echo ""
    echo -e "${CYAN}  Building:${RESET} ${LABEL}..."

    cd "$DIST"
    if [ -n "$TARGET" ]; then
        bun build --compile --target="bun-${TARGET}" clarity-entry.js --outfile "$OUTNAME" 2>&1
    else
        bun build --compile clarity-entry.js --outfile "$OUTNAME" 2>&1
    fi

    if [ -f "$OUTNAME" ]; then
        SIZE=$(du -h "$OUTNAME" | cut -f1)
        echo -e "  ${GREEN}Done:${RESET} ${BOLD}$DIST/$OUTNAME${RESET} ($SIZE)"
    fi
}

# ── Determine what to build ──────────────────────────────

if [[ "$1" == "--all" ]]; then
    # Build for all platforms
    echo ""
    echo -e "${CYAN}  Step 2:${RESET} Compiling for all platforms..."

    build_target "darwin-arm64"  "clarity-macos-arm64"   "macOS (Apple Silicon)"
    build_target "darwin-x64"   "clarity-macos-x64"     "macOS (Intel)"
    build_target "linux-x64"    "clarity-linux-x64"     "Linux (x64)"
    build_target "linux-arm64"  "clarity-linux-arm64"   "Linux (ARM64)"
    build_target "windows-x64"  "clarity-windows.exe"   "Windows (x64)"

    echo ""
    echo -e "  ${GREEN}${BOLD}All platforms built!${RESET}"
    echo ""
    echo "  Binaries in: $DIST/"
    echo ""
    ls -lh "$DIST"/clarity-* 2>/dev/null | awk '{print "    " $NF " (" $5 ")"}'

elif [[ "$1" == "--target" ]]; then
    if [ -z "$2" ]; then
        echo -e "${RED}  Error: --target requires a platform (macos, linux, windows)${RESET}"
        echo "  Usage: ./native/build.sh --target linux"
        exit 1
    fi

    echo ""
    echo -e "${CYAN}  Step 2:${RESET} Compiling for $2..."

    case "$2" in
        macos|darwin)
            build_target "darwin-arm64" "clarity-macos-arm64" "macOS (Apple Silicon)"
            build_target "darwin-x64"   "clarity-macos-x64"   "macOS (Intel)"
            ;;
        linux)
            build_target "linux-x64"   "clarity-linux-x64"   "Linux (x64)"
            build_target "linux-arm64" "clarity-linux-arm64"  "Linux (ARM64)"
            ;;
        windows|win)
            build_target "windows-x64" "clarity-windows.exe"  "Windows (x64)"
            ;;
        *)
            echo -e "${RED}  Unknown platform: $2${RESET}"
            echo "  Supported: macos, linux, windows"
            exit 1
            ;;
    esac

else
    # Default: build for current platform
    echo ""
    echo -e "${CYAN}  Step 2:${RESET} Compiling JavaScript → native binary..."
    build_target "" "clarity" "current platform"

    echo ""
    echo -e "  ${GREEN}${BOLD}Build complete!${RESET}"

    if [[ "$1" == "--install" ]]; then
        echo ""
        echo -e "${CYAN}  Installing to /usr/local/bin/clarity...${RESET}"
        sudo cp "$DIST/clarity" /usr/local/bin/clarity
        echo -e "  ${GREEN}Done!${RESET} Type ${BOLD}clarity${RESET} anywhere."
    else
        echo ""
        echo "  To install:"
        echo "    sudo cp $DIST/clarity /usr/local/bin/clarity"
        echo ""
        echo "  Or run directly:"
        echo "    $DIST/clarity shell"
    fi
fi

echo ""
