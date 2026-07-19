# Clarity — Competitive Roadmap

> **North star:** make Clarity a language you can build *and ship* real applications in —
> compiled to standalone native binaries with **no runtime**, no Bun, no VM — with a
> deliberate specialty in **app building** and **gaming (RE tooling and game mods)**.

This is the strategic map. The tactical, near-term gap list lives in [GAPS.md](GAPS.md);
KyanOS-specific work lives in [ROADMAP_OS.md](ROADMAP_OS.md). This file is the "why" and the
"where next" across the whole language — read it top-down, pick a track, then find the concrete
task in GAPS.md.

Where a language wins today is rarely raw syntax — it's the *distance from `hello world` to a
shipped artifact a stranger can run*. Clarity is already 100% self-hosted and ships as a single
binary; the roadmap below is about closing that distance for the four kinds of software we
actually want to build, and doing it faster and with less ceremony than the incumbents.

---

## The state of play (July 2026)

- **Self-hosted, v1.0.** Lexer, parser, interpreter, bytecode VM, type checker, linter,
  formatter, debugger, profiler, doc generator, package manager, LSP, and shell — all written
  in Clarity. ~2,750 assertions in Clarity.
- **One binary, no external runtime for the *toolchain*.** `clarity` is a single Bun-compiled
  executable (macOS + Linux, x64 + ARM64).
- **Native compilation is real and growing.** `clarity cc <file>` compiles Clarity → C → a true
  native ELF/Mach-O binary with **no Bun and no VM**. As of stage 9 it covers the scalar core,
  collections, classes, closures, a reclaiming GC, strings, file I/O, process/exec, math, and
  JSON — each capability verified by compiling the generated C and diffing its output against the
  tree-walking interpreter. Native `wc`, a native sysinfo tool, and a native JSON transformer all
  compile to standalone binaries that match the interpreter byte-for-byte.

The bet: keep pushing `clarity cc` until *any* Clarity program compiles to a native binary, then
specialize hard into the two markets where a small, embeddable, native-compiling language has an
unfair advantage — **app tooling** and **games (mods + reverse engineering)**.

---

## Track A — Native app runtime (finish "build any app as a native binary")

The trunk everything else hangs off. Until an arbitrary Clarity program compiles and runs
natively, the specialty tracks can't ship. Driven stage-by-stage through `clarity cc`; each stage
lands with codegen tests that diff native output against the interpreter.

- **Stage 10 — binary I/O + native FFI.** `read_bytes`/`write_bytes` for raw buffers, and
  `dlopen`/`dlsym` so compiled Clarity can call arbitrary C functions from shared libraries.
  *This is the gateway to Track B* — pattern scanning, hooking, and format parsing all need raw
  bytes and native calls.
- **Stage 11+ — networking.** Sockets → an HTTP client that isn't a `curl` shell-out → an HTTP
  server → TLS. Unlocks web/API backends as native binaries.
- **Stage 12+ — services stdlib.** Real crypto (not the toy cipher), a real embedded key/value or
  SQLite binding, CSV/YAML/TOML parsers. The "boring but load-bearing" tier for backends and data
  tools.
- **Precise GC.** Replace conservative C-stack scanning with an emitted shadow stack of live
  roots. Removes the optimiser/ABI fragility that keeps mid-run collection opt-in today, and makes
  default-on GC safe on every platform. Prerequisite for long-running native services.
- **GUI, last.** Desktop/GUI needs a graphics stack; it comes after the headless tiers are solid,
  most likely as an FFI binding to an existing toolkit rather than a from-scratch renderer.

**Done when:** a non-trivial Clarity app — a web service, a CLI with subprocesses, a data
pipeline — compiles with `clarity cc` and runs as a single native binary with no Bun anywhere.

---

## Track B — Gaming specialty: RE tooling & game mods

The differentiator. This is where a small language that compiles to native code, calls C
directly, and can be *embedded* has a genuine edge over Python (slow, needs an interpreter shipped)
and C++ (heavy, slow to iterate). Two sub-directions share the same primitives (raw memory + FFI +
a small embeddable core):

**RE / tooling direction**
- **Raw memory + pattern scanning.** Byte buffers, endianness helpers, AOB/signature scanning,
  pointer arithmetic against a target's address space.
- **Binary-format DSL.** Declarative struct/format definitions that parse and emit binary blobs —
  save files, network packets, asset formats, executable headers. Clarity's existing struct/FFI
  layout work (`ffi.clarity`) is the seed.
- **Process & memory access.** Read/write another process's memory, enumerate modules/regions
  (`/proc` on Linux first, platform APIs later).
- **Hooking / detours.** Function interception primitives (inline hooks, IAT/GOT, trampolines) for
  instrumentation and modding.
- **Disassembly / analysis on-ramp.** FFI bindings to an existing engine (Capstone-class) rather
  than a from-scratch disassembler.

**Mods / embedding direction**
- **Embeddable runtime.** A small C-callable core so a game or host app can embed Clarity as its
  scripting layer — `clarity_eval`, value marshalling, host-function registration. The native
  compiler and the C value model already point at this.
- **Overlays & input.** Drawing/overlay and input-hook primitives (again FFI-first) for in-game
  tools and mod UIs.
- **Windows as a first-class target.** RE and modding live on Windows. `clarity cc` currently
  targets ELF/Mach-O; a PE/COFF path (via mingw/clang) is on this track, not an afterthought.

> **Open sub-ordering (needs a call):** within Track B, do we lead with *embeddable-scripting-for-mods*
> (make Clarity the language you write game mods in) or *native-RE-tooling* (make Clarity the
> language you write cheats/trainers/analyzers in) first? They share primitives but diverge on
> polish priorities (embedding API + Windows PE vs. process-memory + hooking + disasm).

**Done when:** you can write a memory scanner / trainer, *or* embed Clarity as a game's mod
scripting language, entirely in Clarity, compiled native.

---

## Track C — Language maturity (compete on the fundamentals)

The table stakes that keep Clarity credible next to modern languages while the specialty tracks
land. Mostly hardening of things that already exist.

- **Concurrency that's real.** Today's concurrency is cooperative/faked. Native threads or an
  async runtime with a real scheduler — needed for servers and for responsive tools.
- **Performance.** Benchmark interpreter vs. VM vs. native across the example suite; close hot-path
  regressions. The native path should be the fast path.
- **Error model.** Runtime errors get a column + caret like parse errors already do; a documented
  story for errors-as-values vs. exceptions.
- **Type system.** A written soundness audit of the gradual-typing escape hatches — catalogue
  what's intentionally loose vs. an actual hole.
- **Tooling tail.** `clarity test` ergonomics (`--only`, `--watch`, parallel runner); LSP rename +
  cross-file go-to-definition + code actions; debugger conditional breakpoints/watch expressions;
  profiler flamegraphs.

---

## Track D — Ecosystem (so other people can ship too)

A language is only as strong as the distance from "I want to use it" to "it's in production."

- **Package manager, client side.** Lockfile spec, integrity hashes, offline mode, mirror support.
  The registry server exists; the client is the gap.
- **Distribution.** `clarity build` producing a native binary as the *default, documented* path —
  cross-compilation, static linking, small binaries.
- **Docs & learning.** Cross-referenced doc generator with search; a real tutorial track for each
  of the four app types; example apps that double as proof points.
- **WASM target.** `clarity build --target wasm` for the browser, so the web story doesn't depend
  on the JS transpile.

---

## Sequencing

1. **Now → next:** Track A stage 10 (binary I/O + FFI) — it's the shared prerequisite for the
   whole Track B specialty, so it comes first even though it's on the "trunk."
2. **Then:** open Track B on top of stage 10 (raw memory + pattern scan + a binary-format DSL),
   picking the RE-first vs. mods-first sub-ordering per the open question above.
3. **In parallel, opportunistically:** Track A networking/services stages as specific apps need
   them, and Track C hardening as friction shows up.
4. **Track D** rides along — every stage ships with tests and docs so the ecosystem can follow.

---

## Explicitly out of scope

Carried over from GAPS.md — decided *no* so the roadmap stays focused:

- **Macros / metaprogramming.** Pattern matching + decorators + the AST module cover the cases.
- **Generics with monomorphisation.** Gradual typing + duck-typed runtime covers polymorphism.
- **A second syntax.** One syntax, one toolchain. No "Clarity Lite," no s-expr front-end, no
  significant-whitespace mode.
