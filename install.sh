#!/bin/bash
# Clarity Quick Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/monkdim/Clarity/main/install.sh | bash

set -e

BOLD='\033[1m'
GREEN='\033[32m'
CYAN='\033[36m'
DIM='\033[2m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}   +===================================+${RESET}"
echo -e "${BOLD}   |         C L A R I T Y             |${RESET}"
echo -e "${BOLD}   |   Simple code. Real power.        |${RESET}"
echo -e "${BOLD}   +===================================+${RESET}"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "  Python 3 is required. Install it first:"
    echo "    brew install python3"
    exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo -e "  ${DIM}Python ${PYTHON_VERSION} found${RESET}"

# Clone or update
INSTALL_DIR="$HOME/.clarity"
if [ -d "$INSTALL_DIR" ]; then
    echo -e "  ${DIM}Updating existing installation...${RESET}"
    cd "$INSTALL_DIR"
    git pull --quiet origin main 2>/dev/null || true
else
    echo -e "  ${DIM}Cloning Clarity...${RESET}"
    git clone --quiet https://github.com/monkdim/Clarity.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install Python package
echo -e "  ${DIM}Installing Clarity package...${RESET}"
python3 -m pip install --quiet -e "$INSTALL_DIR" 2>/dev/null

# Create bin symlink
BIN_DIR="/usr/local/bin"
if [ ! -w "$BIN_DIR" ]; then
    BIN_DIR="$HOME/.local/bin"
    mkdir -p "$BIN_DIR"
fi

# Create the clarity command
cat > "$BIN_DIR/clarity" << 'LAUNCHER'
#!/bin/bash
exec python3 -m clarity "$@"
LAUNCHER
chmod +x "$BIN_DIR/clarity"

echo ""
echo -e "  ${GREEN}${BOLD}Clarity installed!${RESET}"
echo ""
echo -e "  ${CYAN}clarity shell${RESET}     Interactive terminal"
echo -e "  ${CYAN}clarity repl${RESET}      Basic REPL"
echo -e "  ${CYAN}clarity help${RESET}      All commands"
echo ""

# macOS: offer to build .app
if [ "$(uname)" = "Darwin" ]; then
    echo -e "  ${DIM}Want the standalone macOS app? Run:${RESET}"
    echo -e "    cd $INSTALL_DIR && python3 build_standalone.py"
    echo -e "    cp -r dist/Clarity.app /Applications/"
    echo ""
fi

# Ensure PATH includes our bin dir
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo -e "  ${DIM}Add to your shell profile:${RESET}"
    echo "    export PATH=\"$BIN_DIR:\$PATH\""
    echo ""
fi
