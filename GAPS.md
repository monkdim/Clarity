# Clarity — Road to Self-Hosting

The goal: Clarity runs on its own code. Build a Clarity-native terminal powered entirely by Clarity.

## Completed (v0.1.0 – v0.4.0)

All core language features are implemented in Python. See README.md for the full list.
Variables, functions, control flow, classes, inheritance, interfaces, enums, pattern matching,
destructuring, async/await, generators, decorators, type annotations, pipe operator, list/map
comprehensions, modules, file I/O, HTTP, JSON, regex, bytecode compiler, package manager,
LSP server, REPL.

---

## Phase 24 — Foundation for Self-Hosting

> Get Clarity building itself: lexer + tokenizer rewritten in Clarity, website,
> stdlib hardening, test suite migration, and terminal groundwork.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Clarity website** | Done | `website/serve.clarity` — 4 routes, dark theme, syntax highlighting, served by Clarity |
| 2 | **Self-hosting: Lexer in Clarity** | Done | `stdlib/lexer.clarity` — full lexer, tokenizes its own source (15k chars, 3k tokens) |
| 3 | **Self-hosting: Tokenizer in Clarity** | Done | `stdlib/tokens.clarity` — all token types, keywords, Token class |
| 4 | **Stdlib hardening** | Done | Added `char_at`, `char_code`, `from_char_code`, `index_of`, `substring`, `is_digit`, `is_alpha`, `is_alnum`, `is_space`, `exec_full` |
| 5 | **Test suite in Clarity** | Done | `stdlib/test_clarity.clarity` — 130 tests across 22 sections + 23 self-hosting lexer tests |

## Phase 25 — Self-Hosting: Parser + AST

> Clarity can parse its own syntax.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **AST nodes in Clarity** | Done | `stdlib/ast_nodes.clarity` — all 49 node types ported as classes |
| 2 | **Recursive descent parser in Clarity** | Done | `stdlib/parser.clarity` — full 1200-line parser, Clarity parses Clarity |
| 3 | **Parse validation** | Done | 56 tests: statements, expressions, complex programs, self-parsing (tokens.clarity, ast_nodes.clarity, lexer.clarity) |

## Phase 26 — Self-Hosting: Interpreter

> Clarity can execute itself.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Tree-walking interpreter in Clarity** | Done | `stdlib/interpreter.clarity` — Environment, ClarityFunction/Class/Instance/Enum/Interface, full dispatch (22 stmt + 25 expr types), control flow signals, string interpolation |
| 2 | **Runtime/builtins in Clarity** | Done | Builtins registered in Interpreter._setup_builtins(); `stdlib/runtime.clarity` provides module system (math, json, os, time) |
| 3 | **Self-run test** | Done | `stdlib/test_interpreter.clarity` — 59 tests: variables, arithmetic, functions, closures, recursion, control flow, lists, maps, strings, classes, inheritance, try/catch, match, enums, pipes, comprehensions, destructuring, spread, ranges |

## Phase 27 — Clarity Terminal (Shell)

> A terminal/shell built entirely in Clarity.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Process execution** | Done | `stdlib/process.clarity` — run/run_output with options (cwd, env, stdin), which, pipe, sequence, ls, mkdir, cp, mv |
| 2 | **Shell REPL** | Done | `stdlib/repl.clarity` — interactive shell with auto-detect (Clarity code vs shell commands), colored prompt, built-in commands (.help, .cd, .env, .clear) |
| 3 | **Pipes & redirection** | Done | `stdlib/shell.clarity` — tokenizer + parser for pipes (`|`), `&&`, `||`, `;`, redirections (`>`, `>>`, `<`, `2>`), env var expansion ($VAR, ${VAR}), quoting, glob |
| 4 | **Environment & PATH** | Done | `stdlib/process.clarity` — get_path, get_env_map, home_dir, which, command_exists; shell.clarity — expand_vars, expand_tilde |
| 5 | **Scripting integration** | Done | `stdlib/repl.clarity` — auto-detects 50+ common shell commands, `$`/`!` prefix for explicit shell mode, multi-line Clarity with brace tracking |
| 6 | **Terminal UI** | Done | `stdlib/terminal.clarity` — 8 colors + bright variants + backgrounds, bold/dim/italic/underline/strike, cursor control, screen control, columns/rows, progress_bar, box drawing |

## Phase 28 — Full Bootstrap

> Clarity is fully self-hosted. The Python implementation becomes legacy.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Bytecode compiler in Clarity** | Done | `stdlib/bytecode.clarity` — 1400-line port: 48 opcodes, CodeObject, Compiler (full AST dispatch), VM (stack-based executor), disassembler |
| 2 | **Package manager in Clarity** | Done | `stdlib/package.clarity` — TOML parser/generator, init_package, install_packages, add_package, local dependency copying |
| 3 | **CLI in Clarity** | Done | `stdlib/cli.clarity` — full command dispatcher (run, shell, repl, check, tokens, ast, init, install, lsp, help, version), AST printer, `--self-hosted` bridge in Python CLI |
| 4 | **LSP in Clarity** | Done | `stdlib/lsp.clarity` — JSON-RPC transport, LanguageServer class, diagnostics, hover info (30+ builtins), completions (keywords + builtins) |
| 5 | **Bootstrap test** | Done | `stdlib/test_bootstrap.clarity` — 50 tests: variables, arithmetic, functions, closures, recursion, control flow, lists, maps, strings, classes, inheritance, try/catch, match, enums, pipes, higher-order, destructuring, spread, ranges, null coalescing — all identical output |
| 6 | **Standalone binary builder** | Done | `build_standalone.py` — PyInstaller bundler creates single-file `clarity` executable with stdlib included |

## Phase 29 — Cut the Cord: Native Binary

> Clarity runs without Python. Transpile to JavaScript, compile with Bun to a native binary.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Clarity-to-JS transpiler** | Done | `native/transpile.py` — 650-line transpiler: all 22 stmt + 25 expr types, class instantiation with `new`, string interpolation → template literals, `--bundle` flag for full stdlib |
| 2 | **JavaScript runtime** | Done | `native/runtime.js` — 290-line shim: I/O, types, collections, strings, math, system, JSON, crypto, HTTP, control flow signals (Break/Continue/Return), ClarityInstance/ClarityEnum |
| 3 | **Stdlib transpilation** | Done | 14/14 stdlib files transpile to JS, verified output matches Python-Clarity |
| 4 | **Native build script** | Done | `native/build.sh` — one-step: transpile all stdlib → JS, bundle with Bun (`bun build --compile`), produces standalone `clarity` binary |

## Phase 30 — Polish & Production-Ready

> Fix all transpiler gaps, add error tracing, and ship cross-platform binaries.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Fix parser edge cases** | Done | Lexer: semicolons (`;`) as statement separators. Parser: keywords (`show`, `match`, `class`, etc.) allowed as map keys |
| 2 | **14/14 stdlib transpilation** | Done | `lsp.clarity` and `bytecode.clarity` now transpile cleanly — string interpolation edge cases resolved |
| 3 | **Source-mapped error traces** | Done | Transpiler emits `/*@file:line*/` comments; `runtime.js` adds `formatClarityError()` and `clarityMain()` for readable Clarity stack traces |
| 4 | **REPL native mode** | Done | Import hoisting in transpiler — `from "file" import` inside blocks hoisted to module top level; `ask()` synchronous stdin for Bun |
| 5 | **Cross-platform builds** | Done | `build.sh --all` compiles for macOS (ARM64 + x64), Linux (x64 + ARM64), Windows (x64); `--target <platform>` for individual builds |

## Phase 31 — Native Test Suite & Runtime Fixes

> End-to-end validation of the transpiled JavaScript path. Every test transpiles Clarity → JS → Bun.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Native test runner** | Done | `tests/test_native.py` — transpiles Clarity programs to JS, runs through Bun, verifies output against expected values |
| 2 | **76 native test cases** | Done | 11 sections: language core (15), functions (7), classes (3), try/catch (2), collections (15), strings (11), math (6), advanced (8), JSON (1), encoding (2), integration (6) |
| 3 | **Runtime bug fixes** | Done | `is_digit`/`is_alpha`/`is_alnum`/`is_space` — fixed to check full strings, not single chars. `ClarityEnum` — expose members as properties. `display()` — don't quote strings in list output |
| 4 | **Import name consistency** | Done | Fixed `$join`/`$min`/`$max`/`$repeat`/`$set` — transpiler `_safe_name()` and import header now use matching `$`-prefixed names |
| 5 | **Smoke test script** | Done | `native/smoke_test.sh` — quick binary validation: hello world, arithmetic, functions, classes, control flow |

## Phase 32 — Developer Tooling: Formatter, Test Runner, Watch Mode

> Essential CLI tools for professional development workflow.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Code formatter** | Done | `clarity/formatter.py` — AST pretty-printer: consistent indentation, spacing, blank lines between definitions, multi-line collections; handles all 22 stmt + 25 expr types |
| 2 | **`clarity fmt` command** | Done | Format files/directories with `--check` (exit 1 if unformatted) and `--write` (format in-place). Both Python CLI and self-hosted CLI |
| 3 | **`clarity test` command** | Done | Discovers `test_*.clarity` files, runs each through the interpreter, reports pass/fail/error. Runs 7 stdlib test files (430+ tests) |
| 4 | **Watch mode** | Done | `clarity run --watch <file>` — polls file for changes, auto-reruns on save (0.5s interval) |

## Phase 33 — Type Checker & Linter

> Static analysis: catch bugs before runtime with type checking and linting.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Static type checker** | Done | `clarity/type_checker.py` — walks AST, infers types from literals/expressions/builtins, validates type annotations on let/fn/class, checks return types, 70+ builtin return types mapped |
| 2 | **Linter** | Done | `clarity/linter.py` — 7 rules: unused variables (W001), mutable-never-reassigned (W002), redeclaration (W003), shadowing (W004), constant conditions (W005), null comparison (W006), unreachable code (W007) |
| 3 | **`clarity check --types`** | Done | Enhanced check command with `--types` flag for static type checking; reports errors with line numbers and severity |
| 4 | **`clarity lint` command** | Done | Lint files/directories, colored output with severity + rule codes, both Python CLI and self-hosted CLI |
| 5 | **Test suite** | Done | 44 tests: type checker (29 — annotations, functions, classes, expressions, no false positives) + linter (15 — unused vars, mutability, shadowing, conditions, null comparison, unreachable code) |

## Phase 34 — Interactive Debugger

> Step-through debugging: breakpoints, call stacks, variable inspection, watch expressions.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Debugger core** | Done | `clarity/debugger.py` — hooks into interpreter execute(), breakpoints by file:line, step/next/finish/continue modes, call stack tracking |
| 2 | **Variable inspection** | Done | `vars` command shows all user variables in scope with mutability markers, `print <expr>` evaluates any Clarity expression, `eval <code>` runs arbitrary code |
| 3 | **Watch expressions** | Done | `watch <expr>` / `unwatch` — automatically evaluated and displayed at each pause, supports any Clarity expression |
| 4 | **Source navigation** | Done | `list [line]` shows source with current line highlighted and breakpoint markers, context window ±5 lines |
| 5 | **`clarity debug` command** | Done | Both Python CLI and self-hosted CLI updated; 15 debug commands (step, next, finish, continue, break, delete, breakpoints, print, eval, vars, backtrace, list, watch, unwatch, help) |
| 6 | **Test suite** | Done | 24 tests: breakpoints (4), frames (2), debugger init/state/format (12), breakpoint management (6) |

## Phase 35 — Profiler

> Performance measurement: function timing, call counts, hot lines, call graph.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Profiler core** | Done | `clarity/profiler.py` — hooks into interpreter execute() for line-level timing & _call() for function-level timing, tracks FunctionStats (calls, total/self/avg time, callers) and LineStats (hits, total time) |
| 2 | **Report output** | Done | Three report sections: Function Profile (sorted by total time), Hot Lines (top 15 with colored heat bars), Call Graph (callee <- caller with counts) |
| 3 | **Programmatic API** | Done | `get_stats()` returns dict with wall_time, functions, and lines for integration with other tools |
| 4 | **`clarity profile` command** | Done | Both Python CLI and self-hosted CLI updated; `clarity profile <file>` runs program and prints full report |
| 5 | **Test suite** | Done | 23 tests: stats classes (5), callee naming (3), profiler init (3), time formatting (3), execution/recording (4), loops (2), heat bar (3) |

## Phase 36 — Documentation Generator

> Auto-extract docs from source comments (`--`/`//`) and type annotations; output as terminal, Markdown, or JSON.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Doc extractor core** | Done | `clarity/docgen.py` — walks AST + source, extracts doc comments preceding fn/class/enum/interface/let declarations, builds typed DocEntry hierarchy (FunctionDoc, ClassDoc, EnumDoc, InterfaceDoc, ConstantDoc) |
| 2 | **Output formats** | Done | Terminal (colored), Markdown (grouped sections with signatures, params, return types), JSON (structured, machine-readable) |
| 3 | **Comment extraction** | Done | Contiguous `--` or `//` lines immediately before a declaration are collected as doc text; gaps break the block |
| 4 | **Class method docs** | Done | Class methods documented individually with their own doc comments, nested under parent class in all output formats |
| 5 | **`clarity doc` command** | Done | `clarity doc <file|dir> [--md|--json] [-o output]` — supports files and directories, optional output file; both Python CLI and self-hosted CLI |
| 6 | **Test suite** | Done | 34 tests: comment extraction (6), functions (5), classes (4), enums (2), constants (3), markdown (4), JSON (2), terminal (2), entries (2), signatures (3), error handling (1) |

---

## Phase 37 — Kill the Python Bootstrap

> Remove Python as a runtime dependency. The native binary becomes the only entry point.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Transpile dev tools to JS** | Done | All 6 dev tools ported to Clarity: `stdlib/linter.clarity` (7 rules, scope tracking, AST walker), `stdlib/formatter.clarity` (AST pretty-printer, all stmt+expr types), `stdlib/type_checker.clarity` (type inference, annotation validation, return-type checking), `stdlib/docgen.clarity` (comment extraction, terminal/markdown/JSON output), `stdlib/debugger.clarity` (step/next/finish, breakpoints, watches, variable inspection), `stdlib/profiler.clarity` (line/function timing, heat bars, call graph). All added to `native/transpile.py` bundle list (20 stdlib files total) |
| 2 | **Self-hosted CLI as default** | Done | Python CLI's `main()` now delegates to self-hosted CLI by default. `--python` flag added for legacy fallback. `--self-hosted` kept for backward compat. `stdlib/cli.clarity` imports and calls all 6 dev tools natively — no stubs, no Python delegation |
| 3 | **Remove Python entry point** | Done | Python `main()` boots directly into `run_self_hosted(args)`. `python -m clarity` still works but immediately runs the Clarity CLI. Version bumped to 0.5.0 across `__init__.py`, `pyproject.toml`, `stdlib/cli.clarity` |
| 4 | **CI/CD native builds** | Done | `.github/workflows/build.yml` — matrix strategy: macOS ARM64 + x64, Linux x64 + ARM64, Windows x64. Steps: checkout → Python → Bun → pip install → transpile → build → smoke test → package (tar.gz/zip) → upload artifact. Release job creates GitHub Release with all binaries on tag push. Test job runs pytest + self-hosted tests |
| 5 | **Smoke tests on native binary** | Done | `native/smoke_test.sh` expanded from 10 to 25+ tests covering all CLI commands: run (5), functions (2), control flow (2), classes (1), help/version (2), check (2), tokens (1), ast (1), lint (1), fmt (1), doc (2), test (1), init (1). Uses `check_cmd` pattern-matching and `check_exit` code verification |

---

## Phase 38 — Standard Library Expansion

> Grow the stdlib to make Clarity practical for real-world projects.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Collections** | Done | `stdlib/collections.clarity` — Set (union/intersection/difference/subset), OrderedMap (insertion-ordered with first/last), Queue (FIFO), Stack (LIFO), PriorityQueue (min-heap with bubble-up/sink-down) |
| 2 | **Date/Time** | Done | `stdlib/datetime.clarity` — DateTime class (format, iso, diff, add/subtract duration, day_of_week, leap year), Duration class (days/hours/minutes/seconds, arithmetic), constructors: now(), today(), from_timestamp(), from_iso(), date(), datetime() |
| 3 | **Path/Filesystem** | Done | `stdlib/path.clarity` — path_join, dirname, basename, extname, stem, resolve, normalize, relative, is_absolute; is_file, is_dir, is_symlink, file_size, modified_time; list_dir, glob_files, walk_dir, walk_dirs, mkdir_p, rmdir, copy_file, move_file, remove_file, temp_dir, temp_file, home_dir |
| 4 | **Networking** | Done | `stdlib/net.clarity` — HttpResponse class, http_get/post/put/delete with headers, download(); HttpServer class (route-based with get/post/put/delete handlers); tcp_connect, tcp_check; URL parser (protocol, host, port, path, query, fragment, query_params); encode_uri, decode_uri |
| 5 | **Database** | Done | `stdlib/db.clarity` — KVStore (JSON-backed persistent key-value), Table (document store with insert/find_all/find_where/find_one/query/update/delete, auto-incrementing _id); SQL Query builder (select/insert/update/delete with where/order/limit/offset, proper escaping); SQLite helpers (sqlite_exec, sqlite_query); schema helpers (create_table_sql, drop_table_sql, add_column_sql) |
| 6 | **Crypto** | Done | `stdlib/crypto.clarity` — sha256/sha512/sha1/md5, hash_file; hmac_sha256/hmac_sha512; random_bytes/random_hex/random_int/random_string; uuid4/uuid_timestamp; base64_encode_file/base64_decode_to_file; secure_compare (constant-time); hash_password/verify_password (salt + SHA-256) |

---

## Phase 39 — Package Registry

> Publish and install Clarity packages from a central registry.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Registry protocol** | Done | `stdlib/semver.clarity` — full SemVer 2.0.0: parse, compare (major/minor/patch/prerelease), range matching (^, ~, >=, <=, >, <, *, x, hyphen, \|\|), max_satisfying, min_satisfying, sort_versions, coerce. `stdlib/package.clarity` updated with registry client: GET /packages, /packages/:name, /packages/:name/:version/download, POST /publish, GET /search |
| 2 | **`clarity publish`** | Done | `pack_package()` creates tarball (all .clarity files + clarity.toml + README.md, excludes clarity_modules/), `publish_package()` uploads to registry with auth token from `~/.clarity/token`. CLI: `clarity publish` |
| 3 | **`clarity install <pkg>`** | Done | `clarity install <name> [version]` adds to clarity.toml and installs; `clarity install` reads lockfile or resolves fresh. Downloads from registry, caches with `.clarity_meta.json`, extracts tarballs to `clarity_modules/` |
| 4 | **Dependency resolution** | Done | Recursive resolution with depth limit (20), semver range matching via `max_satisfying()`, transitive dependency walking, lockfile v1 generation/reading (`clarity.lock` with version pinning and source tracking). Lockfile-first install for reproducible builds |
| 5 | **Registry server** | Done | `stdlib/registry.clarity` — full HTTP registry server written in Clarity (dogfooding). Filesystem + JSON index backend, Registry class with list/get/search/publish, 6 REST endpoints, CLI with --port and --data flags. Also added `clarity search <query>` and `clarity info <pkg>` commands |

---

## Phase 40 — REPL & Shell Enhancements

> Make the interactive experience world-class.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Syntax highlighting** | Done | `stdlib/highlight.clarity` — token-based colorizer using the lexer. Maps all token types to ANSI colors (keywords=magenta, declarations=blue, strings/numbers=green, operators=yellow, comments=gray, builtins=cyan). Highlights multi-line REPL input after submission. `.highlight` toggle command in REPL |
| 2 | **Tab completion** | Done | `stdlib/completer.clarity` — Completer class with context-aware completions: 38 keywords, 60+ builtins, user-defined variables/functions/classes (learned from input), member access (string/list/map methods), file path completion for import contexts. `.complete <prefix>` command, `common_prefix()` for longest match, `format_completions()` with kind labels |
| 3 | **Persistent history** | Done | REPL loads/saves history to `~/.clarity_history` (max 1000 entries). History persists across sessions, deduplicates consecutive entries. `.history [N]` shows recent entries, `.search <term>` finds matches in reverse chronological order. History saved on quit and EOF |
| 4 | **Multi-line editing** | Done | Enhanced brace-depth tracking for multi-line blocks with `...>` continuation prompt. Multi-line input displayed with syntax highlighting in a bordered box (`┌─ input ─` / `│` / `└─`) after submission. `.reset` clears completer state |
| 5 | **Pretty-printed output** | Done | `stdlib/pretty.clarity` — recursive pretty-printer with ANSI colors. Handles null (red), booleans (yellow), numbers (green), strings (green+quoted), lists (inline or multi-line), maps (cyan keys), class instances (magenta header), enums (blue). Configurable indent/depth/max items. `pretty_table()` for tabular data, `pretty_json()` for JSON-style output. `.pretty` toggle in REPL |

---

## Phase 41 — Concurrency & Channels

> Structured concurrency primitives beyond async/await.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Channels** | Done | `stdlib/channel.clarity` — Channel (unbuffered) and BufferedChannel with send/receive/try_receive/close/drain. FanOut (broadcast to N channels) and FanIn (merge N channels). `select()` polls multiple channels, `select_timeout()` with deadline. `chan()`, `buffered_chan(capacity)`, `named_chan(name)` constructors |
| 2 | **Structured concurrency** | Done | `stdlib/task.clarity` — Task (sync) and BackgroundTask (subprocess) with pending/running/done/failed/cancelled states. TaskGroup for structured concurrency (spawn/run_all/wait_all/cancel_all/results). Future/Promise with resolve/reject/then. `spawn()`, `spawn_bg()`, `parallel()`, `race()`, `with_timeout()`, `retry()` utilities |
| 3 | **Mutex / Atomic** | Done | `stdlib/mutex.clarity` — Mutex (spin-lock with deadlock detection), RWLock (multiple readers OR single writer), Atomic (counter with CAS/increment/decrement/exchange), AtomicFlag (boolean), Once (one-time init), Semaphore (counting permits with acquire/release), FileLock (multi-process via lockfile). All with `with_lock`/`with_permit` RAII patterns |
| 4 | **Worker pools** | Done | `stdlib/worker.clarity` — WorkerPool (configurable size, submit/run/results/stats), `parallel_map()`, `parallel_filter()`, `parallel_reduce()`, `parallel_each()` for collection parallelism. `parallel_exec()` for concurrent subprocess execution. Pipeline class for multi-stage data processing with run/run_batch |

---

## Phase 42 — Linguist Registration & Community

> Get Clarity officially recognized and build community infrastructure.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **TextMate grammar** | Done | `editors/clarity.tmLanguage.json` — full TextMate grammar with scopes for comments (-- and //), strings, numbers, keywords (control/logical/import), declarations (let/mut/fn/class/enum/interface/impl/async), 60+ builtins, constants, operators (|>, =>, .., ..., ??, ?.), decorators (@), function calls, punctuation |
| 2 | **Linguist PR** | Done | `editors/linguist/` — `languages.yml` (type: programming, color: #4A90D9, extensions: .clarity, tm_scope: source.clarity), `grammars.yml`, `sample.clarity` (140-line showcase of all major features), `filenames.txt`. `.gitattributes` updated with linguist-detectable |
| 3 | **VS Code extension** | Done | `editors/vscode/` — `package.json` (manifest with language, grammar, snippets, 4 commands, 4 config properties), `language-configuration.json` (comments, brackets, indentation, folding), `syntaxes/clarity.tmLanguage.json`, `snippets/clarity.json` (22 snippets: fn/afn/class/classx/iface/enum/if/ife/for/while/try/match/let/mut/from/show/lam/=>/decorator/lc/mc/pipe), `src/extension.ts` (LSP client, run/check/format/lint commands, status bar), `tsconfig.json` |
| 4 | **Playground** | Done | `playground/index.html` — self-contained web playground with Clarity-to-JS interpreter (tokenizer, parser, interpreter all in browser JS). 6 examples (hello/fibonacci/classes/functional/match/enum), resizable split editor/output panels, Ctrl+Enter to run, shareable URL via base64 hash, dark theme |
| 5 | **Documentation site** | Done | `docs/index.html` — single-page documentation site with sidebar navigation, dark mode support. Covers: getting started (install, hello, REPL), language guide (variables, types, functions, control flow, classes, enums, interfaces, errors, modules, collections, functional, async, decorators), stdlib reference (I/O, strings, math, collections, process, networking, testing), tools (CLI, packages, editor, playground) |

---

## Road to 100% — Remaining Phases

> Clarity is 94.9% self-hosted. These phases eliminate every non-Clarity dependency
> and make the language fully self-sufficient. Pick up from Phase 43.

## Phase 43 — Gitattributes & Repo Hygiene (Quick Win)

> Fix the GitHub language bar: mark remaining JS/Shell files so Linguist counts only Clarity.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Mark native JS as vendored** | Done | `.gitattributes` — `native/runtime.js linguist-vendored` (target-language runtime shim, not source) |
| 2 | **Mark shell scripts as vendored** | Done | `.gitattributes` — `native/*.sh linguist-vendored`, `install.sh linguist-vendored` (build/install tooling) |
| 3 | **Mark VS Code extension as vendored** | Done | `.gitattributes` — `editors/vscode/src/*.ts linguist-vendored` (TypeScript LSP client wrapper) |
| 4 | **Verify 100% on GitHub** | Done | All non-Clarity files marked as vendored or documentation. Language bar: 100% Clarity |

---

## Phase 44 — Self-Hosted Transpiler

> The last critical Python component. Port `native/transpile.py` (679 lines) to Clarity so Clarity can compile itself to JavaScript without Python.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Transpiler core in Clarity** | Done | `stdlib/transpile.clarity` — JSEmitter class with all 22 stmt + 25 expr type handlers, AST walker that emits JavaScript. ~450 lines, faithful port of `native/transpile.py` |
| 2 | **Import resolution** | Done | File imports resolved to `.js` paths, `from "file" import` mapped to ES module imports, nested imports hoisted to module top level via `hoisted_imports` list |
| 3 | **`--bundle` mode** | Done | `transpile_bundle()` transpiles all 35 stdlib files to JS, copies runtime.js, creates entry point and package.json. Invoked via `clarity transpile --bundle` |
| 4 | **`clarity transpile` command** | Done | New CLI command in `stdlib/cli.clarity`: `clarity transpile <file> [-o output.js]` for single files, `clarity transpile --bundle [-o dist_dir]` for full stdlib bundle |
| 5 | **Parity tests** | Pending | Verify transpiled output from Clarity transpiler matches Python transpiler output for all 76 native test cases |

---

## Phase 45 — Self-Hosted Build Pipeline

> Replace `native/build.sh` and `build_standalone.py` with Clarity scripts. The entire build process runs through Clarity.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Build script in Clarity** | Pending | `stdlib/build.clarity` — transpile all stdlib → JS, invoke Bun compile via `exec()`, handle `--all` and `--target` flags for cross-platform builds |
| 2 | **`clarity build` command** | Pending | New CLI command: `clarity build [--target <platform>] [--all]` — produces native binary from Clarity source |
| 3 | **Smoke test in Clarity** | Pending | `stdlib/test_smoke.clarity` — port `native/smoke_test.sh` (25 checks) to Clarity using `exec()` and pattern matching |
| 4 | **Install script in Clarity** | Pending | `install.clarity` — port `install.sh` logic: detect platform, download binary from releases, add to PATH |
| 5 | **Remove shell scripts** | Pending | Delete `native/build.sh`, `native/smoke_test.sh`, `install.sh` — Clarity handles everything |

---

## Phase 46 — Test Suite Migration

> Move all Python tests to Clarity. The `pytest` dependency disappears entirely.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Port interpreter tests** | Pending | Migrate `tests/test_interpreter.py` (298 lines) → `stdlib/test_interpreter_full.clarity` — cover all edge cases not yet in self-hosted tests |
| 2 | **Port parser tests** | Pending | Migrate `tests/test_parser.py` (192 lines) → `stdlib/test_parser_full.clarity` — AST structure verification |
| 3 | **Port feature tests** | Pending | Migrate `tests/test_v2_features.py` (611 lines), `test_v3_features.py` (367 lines), `test_v4_features.py` (503 lines) → `stdlib/test_features.clarity` |
| 4 | **Port tool tests** | Pending | Migrate `tests/test_type_checker.py`, `test_linter.py`, `test_debugger.py`, `test_profiler.py`, `test_docgen.py` → Clarity equivalents |
| 5 | **Port native tests** | Pending | Migrate `tests/test_native.py` (821 lines) → `stdlib/test_native.clarity` — transpile-and-verify tests running in Clarity |
| 6 | **Port lexer tests** | Pending | Migrate `tests/test_lexer.py` (128 lines) → `stdlib/test_lexer_full.clarity` |
| 7 | **`clarity test` enhanced** | Pending | Support test assertions, expected failures, test fixtures, and summary reporting (X passed, Y failed, Z skipped) |

---

## Phase 47 — Kill the Python Bootstrap (For Real)

> Remove the entire `clarity/` Python package. The native binary is the only entry point. Python is gone.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Audit Python-only codepaths** | Pending | Identify any functionality in `clarity/*.py` that has no Clarity equivalent yet — fill the gaps |
| 2 | **Self-compile chain** | Pending | Verify: `clarity transpile stdlib/ --bundle` → JS → `bun build --compile` → binary that can itself run `clarity transpile`. Full bootstrap circle |
| 3 | **Remove `clarity/` directory** | Pending | Delete all 15 Python source files (8,600 lines). Update `pyproject.toml` to point entry_point at native binary or remove entirely |
| 4 | **Remove `tests/` directory** | Pending | Delete all 12 Python test files (3,400 lines). All tests now live in `stdlib/test_*.clarity` |
| 5 | **Remove Python build files** | Pending | Delete `build_standalone.py`, `setup.py`, `pyproject.toml`, `native/transpile.py`. Clarity builds Clarity |
| 6 | **Update README** | Pending | Install instructions: download binary or `clarity build` from source. No `pip install`. No Python mentioned as a dependency |
| 7 | **Version 1.0.0** | Pending | Bump to v1.0.0 — Clarity is 100% self-hosted, zero external dependencies |

---

## Phase 48 — Runtime.js Generation

> The last non-Clarity file. Generate `native/runtime.js` from Clarity source instead of maintaining it by hand.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Runtime spec in Clarity** | Pending | `stdlib/runtime_spec.clarity` — define all JS shim functions (I/O, types, collections, crypto, HTTP) as a structured spec |
| 2 | **JS codegen from spec** | Pending | Transpiler emits runtime.js from the spec — builtins, type helpers, control flow signals, all generated |
| 3 | **Remove hand-written runtime.js** | Pending | Delete `native/runtime.js` (394 lines). The transpiler produces it from Clarity definitions |
| 4 | **Verify native binary** | Pending | All 76 native tests + 25 smoke tests pass with generated runtime |

---

## The Finish Line

After Phase 48, the repo contains:
- `stdlib/` — the entire language, toolchain, and standard library (100% Clarity)
- `editors/` — grammar files and editor extensions
- `docs/` / `playground/` — documentation (HTML, marked as docs)
- `examples/` — example programs
- `README.md`, `GAPS.md`, `LICENSE`

**Zero Python. Zero JavaScript. Zero Shell. 100% Clarity.**

The bootstrap problem is solved: a pre-built native binary compiles the next version of itself. New contributors download the binary and build from source — in Clarity.
