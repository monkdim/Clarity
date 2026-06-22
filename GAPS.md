# Clarity — Path Forward

This document tracks **what's next for the Clarity language and toolchain**. The 1.0 development history (Phases 1–55) lives in git. ClarityOS-specific work lives in [ROADMAP_OS.md](ROADMAP_OS.md). This file covers the *language*: lexer, parser, interpreter, bytecode VM, type checker, stdlib, CLI, package manager, LSP, native binary.

---

## Where we are (May 2026)

- **v1.0.0 shipped.** 100% self-hosted; the lexer, parser, interpreter, bytecode VM, type checker, linter, formatter, debugger, profiler, doc generator, package manager, LSP, and shell are all written in Clarity. ~430 tests, all in Clarity.
- **One binary, no runtime.** `clarity` ships as a single Bun-compiled executable for macOS and Linux on x64 and ARM64.
- **The Python bootstrap is still in `native/`.** It exists to rebuild the binary from source (`python3 native/transpile.py --bundle --compile`); end users never touch it.

The language is at the point where this document is short on purpose — what's left is selective hardening, not feature catch-up.

---

## Concrete gaps surfaced during the 1.0 cycle

### Brand-domain aspiration
`stdlib/website_gen.clarity` bakes `https://clarityos.dev/` into `iso_url`, `og:image`, and `og:url` for the generated marketing site. The domain isn't registered; the site isn't deployed. No runtime breakage today (no CLI command fetches it), but if the site ships before the domain does, those links will 404. Also: `stdlib/test_polish.clarity:229` asserts the literal `"clarityos.dev"`, which will need to change in lockstep with any domain swap.

---

## v1.1 — Language hardening

The 1.0 surface area is the right one. v1.1 is about making it sturdier, not bigger.

- **Error messages.** Audit parser and type-checker errors for line + column + caret rendering; ensure every error includes the source span. Right now coverage is uneven across phases.
- **Type checker.** Catalogue the known unsoundness (gradual-typing escape hatches, missing variance checks, etc.) and decide which to close vs. document. No new type-system features until the existing surface is sound.
- **Bytecode VM.** Benchmark interpreter vs. VM across the example suite; document the gap; close cases where the VM regresses on hot paths.
- **`clarity test` ergonomics.** Wall-clock per file, parallel runner, focus-mode (`--only`), and a `--watch` flag.
- **`clarity fmt` parity.** Compare formatter output against the stdlib's hand-formatted style; fix divergences. The stdlib is the dogfood; the formatter should reproduce it byte-for-byte.

---

## v1.2 — Toolchain & ecosystem polish

- **LSP.** Hover types, go-to-definition across files, rename, code actions for the seven lint rules. Right now diagnostics are good; the rest is uneven.
- **Package manager.** Lockfile spec, integrity hashes, offline mode, mirror support. The registry server exists; the client side is the gap.
- **Doc generator.** Cross-references between modules, search index, dark-mode CSS to match the website.
- **Debugger.** Conditional breakpoints, watch expressions, step-into-builtins gating.
- **Profiler.** Flamegraph SVG output; sub-line resolution where the bytecode positions allow.

---

## v2.0 — Compilation targets & FFI

These are the only items that belong in a 2.0 conversation rather than 1.x. Each is scoped large enough to deserve a design doc before any code lands.

- **WebAssembly target.** A `clarity build --target wasm` that produces a `.wasm` module plus glue, so Clarity can run in browsers without the JavaScript transpile step.
- **Native compilation.** Skip Bun. Compile Clarity → C or Clarity → LLVM IR → native binary. The bytecode VM (`runtime/native_vm/`) is the seed.
- **C FFI maturity.** `stdlib/ffi.clarity` works for libc-shaped APIs; the rough edges are struct layout, callbacks across the boundary, and ownership semantics for arrays. Driven by what ClarityOS apps actually need.

---

## Out of scope (decided no)

- **Macros / metaprogramming.** Pattern matching + decorators + the AST module cover the cases macros usually solve. A macro system is a category of language complexity Clarity has avoided on purpose.
- **Generics with monomorphisation.** Gradual typing + duck-typed runtime covers polymorphism. A static generic system would force the type checker into a much larger spec.
- **A second syntax.** No "Clarity Lite," no s-expression front-end, no significant whitespace mode. One syntax, one toolchain.

---

## How to contribute

1. Pick something from the **Concrete gaps** or **v1.1** sections.
2. Open an issue describing the approach before you start; tag it `language` or `tooling`.
3. Write the change in Clarity, in `stdlib/` (or `native/runtime.js` for builtins).
4. Add a test in the relevant `test_*.clarity`.
5. `clarity test stdlib/` should stay green.
6. Open a PR. CI runs darwin-arm64 + linux-x64 + linux-arm64.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the developer workflow.
