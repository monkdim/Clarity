#!/bin/bash
# Comprehensive smoke test for the native Clarity binary/bundle.
#
# Verifies ALL CLI commands work end-to-end after build.
# Usage:
#   ./native/smoke_test.sh              # Test using bun + dist/
#   ./native/smoke_test.sh ./clarity    # Test a compiled binary

set -e

BOLD='\033[1m'
GREEN='\033[32m'
RED='\033[31m'
DIM='\033[2m'
YELLOW='\033[33m'
RESET='\033[0m'

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DIR")"
DIST="$DIR/dist"
PASSED=0
FAILED=0

# Determine how to run Clarity
if [ -n "$1" ]; then
    CLARITY="$1"
    echo -e "${BOLD}  Smoke testing: ${CLARITY}${RESET}"
else
    CLARITY="bun $DIST/clarity-entry.js"
    echo -e "${BOLD}  Smoke testing: bun dist/${RESET}"
fi
echo ""

# ── Test helpers ────────────────────────────────────────

check() {
    local NAME="$1"
    local INPUT="$2"
    local EXPECTED="$3"

    local TMP=$(mktemp /tmp/smoke_XXXXXX.clarity)
    echo "$INPUT" > "$TMP"

    local ACTUAL
    ACTUAL=$($CLARITY run "$TMP" 2>&1) || true
    rm -f "$TMP"

    if [ "$ACTUAL" = "$EXPECTED" ]; then
        PASSED=$((PASSED + 1))
        echo -e "  ${GREEN}PASS${RESET}  $NAME"
    else
        FAILED=$((FAILED + 1))
        echo -e "  ${RED}FAIL${RESET}  $NAME"
        echo -e "    ${DIM}Expected: $EXPECTED${RESET}"
        echo -e "    ${DIM}Got:      $ACTUAL${RESET}"
    fi
}

check_cmd() {
    local NAME="$1"
    local CMD="$2"
    local EXPECT_PATTERN="$3"

    local ACTUAL
    ACTUAL=$(eval "$CMD" 2>&1) || true

    if echo "$ACTUAL" | grep -q "$EXPECT_PATTERN"; then
        PASSED=$((PASSED + 1))
        echo -e "  ${GREEN}PASS${RESET}  $NAME"
    else
        FAILED=$((FAILED + 1))
        echo -e "  ${RED}FAIL${RESET}  $NAME"
        echo -e "    ${DIM}Expected to contain: $EXPECT_PATTERN${RESET}"
        echo -e "    ${DIM}Got: $(echo "$ACTUAL" | head -3)${RESET}"
    fi
}

check_exit() {
    local NAME="$1"
    local CMD="$2"
    local EXPECT_EXIT="$3"

    eval "$CMD" >/dev/null 2>&1
    local EXIT_CODE=$?

    if [ "$EXIT_CODE" = "$EXPECT_EXIT" ]; then
        PASSED=$((PASSED + 1))
        echo -e "  ${GREEN}PASS${RESET}  $NAME"
    else
        FAILED=$((FAILED + 1))
        echo -e "  ${RED}FAIL${RESET}  $NAME"
        echo -e "    ${DIM}Expected exit code: $EXPECT_EXIT, got: $EXIT_CODE${RESET}"
    fi
}

# ── Core: run ───────────────────────────────────────────

echo -e "  ${BOLD}-- run --${RESET}"
check "hello world"     'show "hello world"'                "hello world"
check "arithmetic"      'show 2 + 3 * 4'                   "14"
check "variables"       'let x = 42
show x'                                                     "42"
check "string ops"      'show upper("hello")'               "HELLO"
check "list ops"        'show len([1, 2, 3])'               "3"

echo -e "  ${BOLD}-- functions --${RESET}"
check "function call"   'fn add(a, b) { return a + b }
show add(3, 4)'                                             "7"
check "recursion"       'fn fib(n) {
    if n <= 1 { return n }
    return fib(n - 1) + fib(n - 2)
}
show fib(10)'                                               "55"

echo -e "  ${BOLD}-- control flow --${RESET}"
check "if/else"         'if 5 > 3 { show "yes" } else { show "no" }'   "yes"
check "for loop"        'mut s = 0
for i in [1, 2, 3] { s += i }
show s'                                                     "6"

echo -e "  ${BOLD}-- classes --${RESET}"
check "class"           'class Dog {
    fn init(name) { this.name = name }
    fn bark() { return this.name + " says woof" }
}
let d = Dog("Rex")
show d.bark()'                                              "Rex says woof"

# ── CLI Commands ────────────────────────────────────────

echo ""
echo -e "  ${BOLD}-- help --${RESET}"
check_cmd "help output" "$CLARITY help" "Usage: clarity"
check_cmd "version"     "$CLARITY version" "Clarity v"

echo -e "  ${BOLD}-- check --${RESET}"
TMP_CHECK=$(mktemp /tmp/smoke_check_XXXXXX.clarity)
echo 'let x = 42' > "$TMP_CHECK"
check_cmd "check syntax"     "$CLARITY check $TMP_CHECK" "OK"
check_cmd "check with types" "$CLARITY check $TMP_CHECK --types" "OK"
rm -f "$TMP_CHECK"

echo -e "  ${BOLD}-- tokens --${RESET}"
TMP_TOK=$(mktemp /tmp/smoke_tok_XXXXXX.clarity)
echo 'let x = 42' > "$TMP_TOK"
check_cmd "tokens output" "$CLARITY tokens $TMP_TOK" "tokens total"
rm -f "$TMP_TOK"

echo -e "  ${BOLD}-- ast --${RESET}"
TMP_AST=$(mktemp /tmp/smoke_ast_XXXXXX.clarity)
echo 'let x = 42' > "$TMP_AST"
check_cmd "ast output" "$CLARITY ast $TMP_AST" "LetStatement"
rm -f "$TMP_AST"

echo -e "  ${BOLD}-- lint --${RESET}"
TMP_LINT=$(mktemp /tmp/smoke_lint_XXXXXX.clarity)
echo 'fn main() {
    let x = 42
    show "hello"
}
main()' > "$TMP_LINT"
check_cmd "lint output" "$CLARITY lint $TMP_LINT" "file(s) checked"
rm -f "$TMP_LINT"

echo -e "  ${BOLD}-- fmt --${RESET}"
TMP_FMT=$(mktemp /tmp/smoke_fmt_XXXXXX.clarity)
echo 'let x = 42
show x' > "$TMP_FMT"
check_cmd "fmt check" "$CLARITY fmt $TMP_FMT --check" "file(s)"
rm -f "$TMP_FMT"

echo -e "  ${BOLD}-- doc --${RESET}"
TMP_DOC=$(mktemp /tmp/smoke_doc_XXXXXX.clarity)
cat > "$TMP_DOC" <<'ENDCLARITY'
-- Adds two numbers together
fn add(a, b) {
    return a + b
}
ENDCLARITY
check_cmd "doc terminal" "$CLARITY doc $TMP_DOC" "Documentation"
check_cmd "doc markdown" "$CLARITY doc $TMP_DOC --md" "# "
rm -f "$TMP_DOC"

echo -e "  ${BOLD}-- test --${RESET}"
TMP_TEST_DIR=$(mktemp -d /tmp/smoke_test_XXXXXX)
cat > "$TMP_TEST_DIR/test_basic.clarity" <<'ENDCLARITY'
fn assert(val, msg) {
    if not val { throw "FAIL: " + msg }
}
assert(1 + 1 == 2, "addition")
assert(len([1, 2, 3]) == 3, "list length")
ENDCLARITY
check_cmd "test runner" "$CLARITY test $TMP_TEST_DIR" "passed"
rm -rf "$TMP_TEST_DIR"

echo -e "  ${BOLD}-- init --${RESET}"
TMP_INIT_DIR=$(mktemp -d /tmp/smoke_init_XXXXXX)
check_cmd "init package" "cd $TMP_INIT_DIR && $CLARITY init" "Created clarity.toml"
rm -rf "$TMP_INIT_DIR"

# ── Summary ──────────────────────────────────────────────

TOTAL=$((PASSED + FAILED))
echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}All $PASSED smoke tests passed!${RESET}"
else
    echo -e "  $PASSED passed, ${RED}$FAILED failed${RESET} / $TOTAL total"
fi
echo ""
exit $FAILED
