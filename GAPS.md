# Clarity — Path Forward

This document tracks **what's next for the Clarity language and toolchain**. The 1.0 development history (Phases 1–55) lives in git. KyanOS-specific work lives in [ROADMAP_OS.md](ROADMAP_OS.md). This file covers the *language*: lexer, parser, interpreter, bytecode VM, type checker, stdlib, CLI, package manager, LSP, native compilation.

---

## Where we are (July 2026)

- **v1.0.0 shipped.** 100% self-hosted; the lexer, parser, interpreter, bytecode VM, type checker, linter, formatter, debugger, profiler, doc generator, package manager, LSP, and shell are all written in Clarity. ~2,750 assertions across 50+ test files, all in Clarity.
- **One binary today, no runtime.** `clarity` ships as a single Bun-compiled executable for macOS and Linux on x64 and ARM64.
- **Native compilation has begun.** `clarity cc <file>` compiles a Clarity program **straight to C, then to a real native binary** — no Bun, no bytecode VM (stage 1: the scalar core). This is the seed of the "no runtime at all" endgame; see v2.0 below.
- **The Python bootstrap is still in `native/`.** It rebuilds the binary from source (`python3 native/transpile.py --bundle` → `bun build --compile`); end users never touch it.

The language is at the point where what's left is selective hardening and the native-compilation build-out — not feature catch-up.

---

## Recently shipped (this cycle)

Cleared during the mid-2026 hardening pass — recorded so the tiers below read accurately:

- **Friendly errors.** `clarity run`/`check` print the offending source line with a `^` caret under the exact column (`errors.clarity`).
- **Type checker caught up.** Wrong argument counts and undefined names (typos) are now flagged before you run — zero false positives across the whole stdlib.
- **Dead commands revived.** `clarity profile`, `clarity debug`, and the **REPL** actually execute code now (all three were no-ops).
- **Bytecode VM correctness.** Fixed the iterator stack leak, the crashing/leaking comprehension compilers, and `try/catch` not catching engine-raised errors (division by zero, undefined variable, bad index).
- **Formatter.** Stopped corrupting strings that contain escapes (`\n`/`\t`/…) — `fmt --write` is safe again.
- **Interpreter.** `for k in someMap` iterates keys (was a run of nulls); comprehensions work over maps and strings.
- **LSP.** Hover now shows user-symbol signatures; **go-to-definition** added.
- **Parser.** Keyword names are usable as bare map keys (`show:`, `type:`…) — the parser can now read its own `lsp.clarity`.

---

## Concrete gaps still open

### `clarity gen-runtime` drift
`native/runtime.js` is documented as auto-generated from `stdlib/runtime_spec.clarity`, but regenerating produces a large diff against the committed file — and (per AUDIT.md) blindly regenerating would revert behavioral fixes that live only in `runtime.js` (the `_clarityType` branch of `type()`, FFI string/BigInt marshalling, the `_ffi_read_view` GC workaround). Until spec ↔ runtime are reconciled, builtin edits must touch both by hand. Fragile; needs a careful, test-guarded reconciliation, not a blind regen.

### Brand-domain / naming
`stdlib/website_gen.clarity` bakes `https://clarityos.dev/` into the generated site; `stdlib/test_polish.clarity` asserts the literal string. The project has since leaned into the KyanOS name — any domain/brand swap touches both files in lockstep.

---

## v1.1 — Language hardening (largely done; finish the tail)

- **Error messages** — ✅ source line + caret for lexer/parser errors. **Remaining:** give *runtime* errors a column too, so the caret works there like it does for parse errors (they carry a line but no column today).
- **Type checker** — ✅ arity + undefined-name checks landed. **Remaining:** a written soundness audit of the gradual-typing escape hatches (catalogue what's intentionally loose vs. an actual hole).
- **Bytecode VM** — ✅ the correctness bugs are fixed. **Remaining:** benchmark interpreter vs. VM across the example suite and document/close any hot-path regressions.
- **`clarity fmt` parity** — ✅ the escape-corruption bug is fixed. **Remaining:** byte-for-byte reproduction of the hand-formatted stdlib.
- **`clarity test` ergonomics** — open: `--only` focus mode, `--watch`, a parallel runner, per-file wall-clock.

---

## v1.2 — Toolchain & ecosystem polish

- **LSP** — ✅ hover types + go-to-definition (same file). **Remaining:** rename, cross-file go-to-definition, and code actions for the seven lint rules.
- **Package manager.** Lockfile spec, integrity hashes, offline mode, mirror support. The registry server exists; the client side is the gap.
- **Doc generator.** Cross-references between modules, search index, dark-mode CSS.
- **Debugger.** ✅ runs again. **Remaining:** conditional breakpoints, watch expressions, step-into-builtins gating.
- **Profiler.** ✅ runs again. **Remaining:** flamegraph SVG output; sub-line resolution.

---

## v2.0 — Native compilation, WASM & FFI

The headline track. Each item is scoped large enough to grow in stages.

- **Native compilation (Clarity → C → binary).** *In progress.* `clarity cc` compiles the scalar core (stage 1) **and now lists, maps, `for`-loops over lists/maps/strings/ranges, indexing + index-assignment, and the common builtins** (`len`/`push`/`str`/`int`/`float`/`range`/`keys`/`has`/`contains`) — stage 2. Collections render exactly like the interpreter, and every codegen test compiles the C with a real compiler and diffs the native output against the tree-walking interpreter. **Next:** stage 3 — classes, closures, and a real memory strategy (arena/GC instead of the stage-2 leak). Endgame: `clarity build` emits a native binary with **no Bun**. (This supersedes the stalled Zig `runtime/native_vm/` bet — the C path is fully buildable and testable in CI, and produces compiled code rather than a bytecode interpreter in a binary.)
- **C FFI maturity.** `stdlib/ffi.clarity` handles libc-shaped APIs; the rough edges are **struct layout, callbacks across the boundary, and array ownership**. This is the on-ramp to real native integrations (e.g. `llama.cpp` for the Hearth app in [ROADMAP_OS.md](ROADMAP_OS.md)) — driven by what those apps actually need.
- **WebAssembly target.** `clarity build --target wasm` → a `.wasm` module plus glue, so Clarity runs in browsers without the JS transpile step. (`wasm-ld` / the LLVM tools are already available in the dev image.)

---

## Out of scope (decided no)

- **Macros / metaprogramming.** Pattern matching + decorators + the AST module cover the cases macros usually solve.
- **Generics with monomorphisation.** Gradual typing + duck-typed runtime covers polymorphism; a static generic system would blow up the type-checker spec.
- **A second syntax.** No "Clarity Lite," no s-expression front-end, no significant-whitespace mode. One syntax, one toolchain.

---

## How to contribute

1. Pick something from **Concrete gaps** or the **v1.1 / v1.2** tails.
2. Write the change in Clarity, in `stdlib/` (or `native/runtime.js` for builtins — mind the drift note above).
3. Add a test in the relevant `test_*.clarity`.
4. `clarity test stdlib/` should stay green.
5. Open a PR. CI runs darwin-arm64 + linux-x64 + linux-arm64.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the developer workflow.
