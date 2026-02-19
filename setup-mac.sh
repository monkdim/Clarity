#!/usr/bin/env bash
#
# Clarity — macOS Setup Script
#
# Sets up everything you need to run Clarity on a Mac:
#   1. Checks for (and installs) prerequisites (Xcode CLI tools, Python 3, Bun)
#   2. Builds the Clarity native binary from source
#   3. Installs the `clarity` command globally
#   4. Installs the Clarity Terminal launcher
#
# Usage:
#   bash setup-mac.sh
#
# Or from the repo root after cloning:
#   chmod +x setup-mac.sh && ./setup-mac.sh
#

set -euo pipefail

# ── Helpers ──────────────────────────────────────────────

GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
BOLD="\033[1m"
DIM="\033[2m"
RESET="\033[0m"

info()    { printf "${CYAN}  [info]${RESET}  %s\n" "$*"; }
success() { printf "${GREEN}  [  ok]${RESET}  %s\n" "$*"; }
warn()    { printf "${YELLOW}  [warn]${RESET}  %s\n" "$*"; }
step()    { printf "\n${BOLD}── Step %s ──${RESET}\n\n" "$1"; }

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="/usr/local/bin"

# ── Banner ───────────────────────────────────────────────

echo ""
echo "   +===================================+"
echo "   |         C L A R I T Y             |"
echo "   |      macOS Setup Script           |"
echo "   |   Simple code. Real power.        |"
echo "   +===================================+"
echo ""

# ── Step 1: Xcode Command Line Tools ────────────────────

step "1/5 — Checking Xcode Command Line Tools"

if xcode-select -p &>/dev/null; then
  success "Xcode CLI tools already installed"
else
  info "Installing Xcode Command Line Tools (this may open a dialog)..."
  xcode-select --install 2>/dev/null || true
  echo ""
  warn "If a dialog appeared, click Install and wait for it to finish."
  warn "Then re-run this script."
  exit 0
fi

# ── Step 2: Python 3 ────────────────────────────────────

step "2/5 — Checking Python 3"

if command -v python3 &>/dev/null; then
  PY_VER=$(python3 --version 2>&1 | awk '{print $2}')
  success "Python 3 found: $PY_VER"
else
  warn "Python 3 not found."
  info "macOS usually includes Python 3 with Xcode CLI tools."
  info "You can also install it from https://python.org"
  echo ""
  echo "  After installing Python 3, re-run this script."
  exit 1
fi

# ── Step 3: Bun ─────────────────────────────────────────

step "3/5 — Checking Bun runtime"

if command -v bun &>/dev/null; then
  BUN_VER=$(bun --version 2>&1)
  success "Bun found: $BUN_VER"
else
  info "Bun is not installed. Installing now..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"

  if command -v bun &>/dev/null; then
    success "Bun installed: $(bun --version)"
  else
    warn "Bun install may need a shell restart."
    warn "Close and re-open Terminal, then re-run this script."
    exit 1
  fi
fi

# ── Step 4: Build Clarity ───────────────────────────────

step "4/5 — Building Clarity from source"

info "Transpiling Clarity -> JavaScript..."
cd "$REPO_DIR/native"
python3 transpile.py --bundle --compile

BINARY="$REPO_DIR/native/dist/clarity"

if [ -f "$BINARY" ]; then
  success "Binary built: $BINARY"
else
  warn "Build did not produce a binary. Check the output above for errors."
  exit 1
fi

# ── Step 5: Install ─────────────────────────────────────

step "5/5 — Installing Clarity"

info "Installing to $INSTALL_DIR/clarity ..."

if [ -w "$INSTALL_DIR" ]; then
  cp "$BINARY" "$INSTALL_DIR/clarity"
else
  info "Need sudo to copy into $INSTALL_DIR ..."
  sudo cp "$BINARY" "$INSTALL_DIR/clarity"
fi
chmod +x "$INSTALL_DIR/clarity"

success "Clarity installed to $INSTALL_DIR/clarity"

# ── Install Clarity Terminal launcher ────────────────────

info "Installing Clarity Terminal launcher..."

LAUNCHER="$REPO_DIR/clarity-terminal"
if [ -f "$LAUNCHER" ]; then
  if [ -w "$INSTALL_DIR" ]; then
    cp "$LAUNCHER" "$INSTALL_DIR/clarity-terminal"
  else
    sudo cp "$LAUNCHER" "$INSTALL_DIR/clarity-terminal"
  fi
  chmod +x "$INSTALL_DIR/clarity-terminal"
  success "Clarity Terminal launcher installed to $INSTALL_DIR/clarity-terminal"
fi

# ── Check PATH ──────────────────────────────────────────

case ":$PATH:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    echo ""
    warn "$INSTALL_DIR is not in your PATH."
    echo ""
    echo "  Add this line to your shell profile (~/.zshrc or ~/.bash_profile):"
    echo ""
    echo "    export PATH=\"$INSTALL_DIR:\$PATH\""
    echo ""
    echo "  Then restart your terminal or run:"
    echo ""
    echo "    source ~/.zshrc"
    echo ""
    ;;
esac

# ── Done ────────────────────────────────────────────────

echo ""
echo "  ${BOLD}${GREEN}Setup complete!${RESET}"
echo ""
echo "  Try these commands:"
echo ""
echo "    ${CYAN}clarity version${RESET}          Show version"
echo "    ${CYAN}clarity shell${RESET}            Interactive Clarity terminal"
echo "    ${CYAN}clarity repl${RESET}             Basic REPL"
echo "    ${CYAN}clarity run hello.clarity${RESET} Run a program"
echo "    ${CYAN}clarity-terminal${RESET}         Launch the Clarity Terminal"
echo "    ${CYAN}clarity help${RESET}             All commands"
echo ""
