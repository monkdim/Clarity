# Clarity

**Simple code. Real power.**

Clarity is a self-hosted programming language that combines the readability of Python with the expressiveness of functional languages. It features immutable-by-default variables, a pipe operator, pattern matching, classes, async/await, generators, and a full developer toolchain — all in a clean, minimal syntax.

Clarity is **self-hosted**: the lexer, parser, interpreter, bytecode compiler, CLI, LSP server, and package manager are all written in Clarity itself. It can also compile to a standalone native binary via JavaScript transpilation.

```
-- Hello World in Clarity
let name = "World"
show "Hello {name}!"

-- Pipes make data flow visible
let result = [1, 2, 3, 4, 5]
    |> filter(x => x % 2 == 0)
    |> map(x => x * x)
show result  -- [4, 16]
```

---

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [CLI Commands](#cli-commands)
- [Language Features](#language-features)
- [Developer Tools](#developer-tools)
- [Self-Hosting](#self-hosting)
- [Native Binary](#native-binary)
- [Project Structure](#project-structure)
- [Running Tests](#running-tests)
- [Roadmap](#roadmap)
- [License](#license)

---

## Install

### Pre-built binary (recommended)

Download the latest release for your platform from [Releases](https://github.com/monkdim/Clarity/releases), or build from source:

```bash
git clone https://github.com/monkdim/Clarity.git
cd Clarity
clarity build --install
```

### Build from source

Requires [Bun](https://bun.sh):

```bash
curl -fsSL https://bun.sh/install | bash
cd Clarity/native
python3 transpile.py --bundle --compile
# Binary is in native/dist/clarity
```

After install, the `clarity` command is available globally.

---

## Quick Start

Create a file called `hello.clarity`:

```
let name = "Clarity"
show "Hello from {name}!"

let nums = [1, 2, 3, 4, 5]
let squares = nums |> map(x => x * x)
show "Squares: {squares}"

fn greet(person) {
    show "Hey {person}, welcome!"
}
greet("Developer")
```

Run it:

```bash
clarity run hello.clarity
```

Or launch the interactive shell:

```bash
clarity shell
```

---

## CLI Commands

```
clarity run <file>              Run a Clarity program
clarity run <file> --watch      Run with auto-reload on save
clarity shell                   Interactive terminal (Clarity + shell commands)
clarity repl                    Basic interactive REPL
clarity check <file>            Check syntax
clarity check <file> --types    Static type checking
clarity lint <file|dir>         Lint for common issues
clarity fmt <file|dir>          Format code (--check, --write)
clarity test [dir]              Run test files (test_*.clarity)
clarity debug <file>            Interactive step-through debugger
clarity profile <file>          Profile execution (timing, hotspots, call graph)
clarity doc <file|dir>          Generate docs (--md, --json, -o <file>)
clarity compile <file>          Show bytecode disassembly
clarity tokens <file>           Show lexer output
clarity ast <file>              Show parse tree
clarity init                    Create a new clarity.toml
clarity install                 Install dependencies from clarity.toml
clarity lsp                     Start language server (for editors)
```

---

## Language Features

### Variables

```
let x = 42          -- immutable (default)
mut counter = 0     -- mutable (opt-in)
counter += 1

-- Type annotations (runtime checked)
let name: string = "Alice"
let age: int = 30
```

### Functions

```
fn add(a, b) {
    return a + b
}

-- Lambda shorthand
let double = x => x * 2
let multiply = (a, b) => a * b

-- Rest parameters
fn first(head, ...tail) {
    return head
}

-- Typed functions
fn divide(a: float, b: float) -> float {
    return a / b
}
```

### Pipes

The pipe operator `|>` passes the result as the first argument to the next function:

```
let result = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    |> filter(x => x % 2 == 0)
    |> map(x => x * x)
    |> reduce((a, b) => a + b, 0)
show result  -- 220
```

### Control Flow

```
if age >= 18 {
    show "adult"
} elif age >= 13 {
    show "teen"
} else {
    show "child"
}

-- If expressions (ternary)
let label = if age >= 18 { "adult" } else { "minor" }

-- For loops
for item in [1, 2, 3] {
    show item
}
for i in 0..10 {
    show i
}

-- While loops
mut n = 10
while n > 0 {
    n -= 1
}
```

### Pattern Matching

```
fn describe(value) {
    match value {
        when 0 { show "zero" }
        when 1 { show "one" }
        when "hello" { show "greeting" }
        else { show "something else: {value}" }
    }
}
```

### Classes & Inheritance

```
class Animal {
    fn init(name, sound) {
        this.name = name
        this.sound = sound
    }
    fn speak() {
        show "{this.name} says {this.sound}!"
    }
}

class Dog < Animal {
    fn init(name) {
        this.name = name
        this.sound = "woof"
    }
    fn fetch(item) {
        show "{this.name} fetches the {item}"
    }
}

let dog = Dog("Rex")
dog.speak()       -- Rex says woof!
dog.fetch("ball") -- Rex fetches the ball
```

### Interfaces

```
interface Drawable {
    fn draw()
    fn area() -> float
}

class Circle impl Drawable {
    fn init(r) { this.r = r }
    fn draw() { show "Drawing circle r={this.r}" }
    fn area() { return 3.14159 * this.r * this.r }
}
```

### Enums

```
enum Color { Red, Green, Blue }
show Color.Red     -- 0
show Color.names() -- ["Red", "Green", "Blue"]

enum Status {
    OK = 200
    NotFound = 404
    Error = 500
}
```

### Destructuring & Spread

```
let [first, second, ...rest] = [1, 2, 3, 4, 5]
let {name, age} = {name: "Alice", age: 30}

let merged = [...list1, ...list2]
let combined = {...map1, ...map2}
```

### Async/Await

```
async fn fetch_data() {
    return 42
}

let result = await fetch_data()
show result
```

### Generators

```
fn fibonacci() {
    mut a = 0
    mut b = 1
    for i in 0..10 {
        yield a
        a, b = b, a + b
    }
}

let fibs = fibonacci()
show fibs  -- [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

### Comprehensions

```
-- List comprehension
let squares = [x * x for x in 0..10 if x > 3]

-- Map comprehension
let lengths = {name: len(name) for name in ["alice", "bob", "charlie"]}
```

### Error Handling

```
try {
    let result = risky_operation()
} catch e {
    show "Error: {e}"
} finally {
    show "Cleanup done"
}

throw "something went wrong"
```

### Decorators

```
fn log(wrapped) {
    return fn(...args) {
        show "calling function"
        let result = wrapped(...args)
        show "done"
        return result
    }
}

@log
fn add(a, b) {
    return a + b
}
```

### Modules

```
import math
show math.sqrt(16)

from math import sqrt, pi
show sqrt(2)

import "utils.clarity"              -- file import
from "helpers" import process_data  -- named import
```

**Built-in modules:** math, json, os, path, random, time, crypto, regex

### Null Safety

```
let value = maybe_null ?? "default"   -- null coalescing
let name = user?.profile?.name        -- optional chaining
```

### Raw Strings

```
let path = r"C:\Users\test\new"    -- no escape processing
let regex = r"^\d{3}-\d{4}$"      -- no escape processing
```

---

## Built-in Functions

| Function | Description |
|----------|-------------|
| `show` | Print values |
| `len(x)` | Length of string, list, or map |
| `type(x)` | Get type name |
| `str(x)`, `int(x)`, `float(x)`, `bool(x)` | Type conversion |
| `range(n)`, `range(start, end)` | Number sequences |
| `map(list, fn)`, `filter(list, fn)`, `reduce(list, fn, init)` | Collection transforms |
| `sort(list)`, `reverse(list)`, `unique(list)`, `flat(list)` | List operations |
| `push(list, item)`, `pop(list)` | List mutation |
| `keys(map)`, `values(map)`, `entries(map)` | Map access |
| `join(list, sep)`, `split(str, sep)` | String operations |
| `upper(s)`, `lower(s)`, `trim(s)`, `replace(s, a, b)` | String transforms |
| `abs(n)`, `round(n)`, `floor(n)`, `ceil(n)`, `sqrt(n)` | Math |
| `min(list)`, `max(list)`, `sum(list)` | Aggregation |
| `read(path)`, `write(path, data)` | File I/O |
| `ask(prompt)` | Read user input |
| `exit(code)` | Exit with status code |

---

## Developer Tools

### Debugger

Interactive step-through debugging with breakpoints, variable inspection, and watch expressions:

```bash
clarity debug app.clarity
```

**Commands:** `step`, `next`, `finish`, `continue`, `break <line>`, `print <expr>`, `eval <code>`, `vars`, `backtrace`, `watch <expr>`, `list`, `help`

### Profiler

Measure function timing, call counts, and identify hot lines:

```bash
clarity profile app.clarity
```

Outputs a full report with function profile (sorted by time), hot lines with colored heat bars, and a call graph showing caller/callee relationships.

### Documentation Generator

Extract docs from source comments and type annotations:

```bash
clarity doc stdlib/                   # Terminal output
clarity doc stdlib/ --md -o docs.md   # Markdown file
clarity doc stdlib/ --json            # JSON output
```

Supports `--` and `//` doc comments preceding functions, classes, enums, interfaces, and constants.

### Type Checker

Static type analysis without running your code:

```bash
clarity check app.clarity --types
```

Infers types from literals, expressions, and 70+ built-in return types. Validates type annotations on variables, function parameters, and return types.

### Linter

Catch common issues with 7 built-in rules:

```bash
clarity lint src/
```

**Rules:** unused variables (W001), mutable-never-reassigned (W002), redeclaration (W003), shadowing (W004), constant conditions (W005), null comparison style (W006), unreachable code (W007).

### Formatter

Consistent code formatting:

```bash
clarity fmt src/ --check    # Check without modifying
clarity fmt src/ --write    # Format in-place
```

### Test Runner

Discovers and runs `test_*.clarity` files:

```bash
clarity test              # Run all tests in current directory
clarity test tests/       # Run tests in specific directory
```

### Watch Mode

Auto-reload on file changes:

```bash
clarity run app.clarity --watch
```

### Bytecode Compiler

Clarity includes a stack-based bytecode compiler and VM with 48 opcodes:

```bash
clarity compile program.clarity
```

### Language Server (LSP)

For editor integration (VS Code, etc.):

```bash
clarity lsp
```

Provides real-time diagnostics, hover info for 30+ builtins, and code completion via JSON-RPC 2.0.

### Package Manager

```bash
clarity init                         # Create clarity.toml
clarity install                      # Install dependencies
clarity install mylib --path ./libs  # Add local dependency
```

---

## Self-Hosting

Clarity is fully self-hosted. The entire toolchain has been rewritten in Clarity:

| Component | File | Description |
|-----------|------|-------------|
| Lexer | `stdlib/lexer.clarity` | Tokenizer — can tokenize its own source |
| Token types | `stdlib/tokens.clarity` | All token types and keywords |
| AST | `stdlib/ast_nodes.clarity` | 49 AST node types |
| Parser | `stdlib/parser.clarity` | Full recursive descent parser |
| Interpreter | `stdlib/interpreter.clarity` | Tree-walking interpreter with full dispatch |
| Runtime | `stdlib/runtime.clarity` | Module system (math, json, os, time) |
| Bytecode | `stdlib/bytecode.clarity` | 48-opcode compiler + stack VM |
| CLI | `stdlib/cli.clarity` | Full command dispatcher |
| LSP | `stdlib/lsp.clarity` | JSON-RPC language server |
| Package Manager | `stdlib/package.clarity` | TOML parser, dependency management |
| Shell | `stdlib/shell.clarity` | Pipe/redirect tokenizer and parser |
| REPL | `stdlib/repl.clarity` | Interactive shell with auto-detect |
| Terminal UI | `stdlib/terminal.clarity` | Colors, cursor control, box drawing |
| Process | `stdlib/process.clarity` | Process execution, PATH, environment |

The native binary runs the self-hosted toolchain directly — no Python dependency required.

---

## Native Binary

Clarity can compile to a standalone native binary with zero Python dependency.

### Building on macOS

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Clone and build
git clone https://github.com/monkdim/Clarity.git
cd Clarity/native
bash build.sh

# The binary is in native/dist/
./dist/clarity run ../examples/hello.clarity
```

### Building on Linux

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Build
cd Clarity/native
bash build.sh
./dist/clarity run ../examples/hello.clarity
```

### Cross-platform builds

```bash
# Build for all platforms
bash build.sh --all

# Build for a specific target
bash build.sh --target darwin-arm64    # macOS Apple Silicon
bash build.sh --target darwin-x64      # macOS Intel
bash build.sh --target linux-x64       # Linux x64
bash build.sh --target linux-arm64     # Linux ARM64
bash build.sh --target windows-x64     # Windows x64
```

### How it works

1. `native/transpile.py` transpiles all Clarity source to JavaScript
2. `native/runtime.js` provides the JS runtime shim (I/O, types, collections)
3. Bun compiles the bundled JS to a single native executable

### Verify the binary

```bash
clarity smoke
```

---

## Project Structure

```
Clarity/
  stdlib/                   # The language — 100% Clarity
    lexer.clarity           # Tokenizer
    parser.clarity          # Recursive descent parser (1200 lines)
    ast_nodes.clarity       # 49 AST node types
    tokens.clarity          # Token type definitions
    interpreter.clarity     # Tree-walking interpreter
    runtime.clarity         # Module system (math, json, os, time)
    bytecode.clarity        # Bytecode compiler + stack VM (1400 lines)
    cli.clarity             # CLI dispatcher (18 commands)
    formatter.clarity       # AST pretty-printer
    linter.clarity          # 7-rule linter
    type_checker.clarity    # Static type checker
    debugger.clarity        # Interactive step-through debugger
    profiler.clarity        # Execution profiler
    docgen.clarity          # Documentation generator
    package.clarity         # Package manager + TOML parser
    lsp.clarity             # Language server (JSON-RPC 2.0)
    shell.clarity           # Pipe/redirect tokenizer and parser
    repl.clarity            # Interactive shell with auto-detect
    terminal.clarity        # Terminal UI (colors, cursor, box drawing)
    process.clarity         # Process execution, PATH, environment
    transpile.clarity       # Self-hosted Clarity-to-JS transpiler
    build.clarity           # Self-hosted build pipeline
    test_*.clarity          # Test suites (430+ tests)

  native/                   # Build tooling (vendored)
    transpile.py            # Clarity-to-JavaScript transpiler
    runtime.js              # JavaScript runtime shim
    build.sh                # Build script (uses Bun)
    smoke_test.sh           # Binary verification

  examples/                 # Example programs
  website/                  # Clarity-powered website
  GAPS.md                   # Development roadmap
```

---

## Running Tests

```bash
# Run all tests
clarity test stdlib/

# Run specific test suites
clarity run stdlib/test_features.clarity
clarity run stdlib/test_type_checker_full.clarity
clarity run stdlib/test_linter_full.clarity
clarity run stdlib/test_debugger_full.clarity
clarity run stdlib/test_profiler_full.clarity
clarity run stdlib/test_docgen_full.clarity

# Smoke tests (verify the binary)
clarity smoke
```

**430+ self-hosted tests** across 14 test files, all written in Clarity.

---

## Roadmap

See [GAPS.md](GAPS.md) for the full development history (Phases 24-48).

Clarity reached **v1.0.0** — 100% self-hosted, zero Python dependency. The entire language, toolchain, and test suite are written in Clarity itself.

---

## License

GPL-3.0 — see [LICENSE](LICENSE) for details.
