# Clarity & KyanOS

**Simple code. Real power.**

A modern programming language — and an ambitious operating system written in it, still taking shape. One syntax, one toolchain, one design vocabulary, from the REPL on up. The language ships and runs today; the OS is an active work in progress.

![KyanOS boot splash — Obsidian, the Kyan identity](https://raw.githubusercontent.com/monkdim/Clarity/main/website/screenshots/kyan_splash.png)

<sub>Rendered straight out of Clarity's own software framebuffer — the faceted-K monogram, the signature violet→cyan progress bar, dark glass. Not a mockup.</sub>

---

## Two projects, one story

### Clarity, the language

Clarity is what Python wishes it could be. It reads like English, runs like JavaScript, scales like Rust, and ships like Go — a single self-contained binary you can drop on any machine.

- **Readable by default.** Immutable variables, named arguments, pattern matching, `|>` pipes that make data flow visible at a glance, `show "Hello {name}"` interpolation, `--` line comments. No semicolons, no type-juggling ceremony, no clever-but-cryptic operators.
- **Powerful where it counts.** Classes with inheritance and interfaces, async / await, generators, decorators, comprehensions, destructuring, null coalescing, optional chaining, pattern matching. Everything modern languages give you, with none of the noise.
- **Self-hosted, end to end.** The lexer, parser, interpreter, bytecode VM, type checker, linter, formatter, debugger, profiler, doc generator, package manager, language server, and shell are all written in Clarity. You can read every byte of the toolchain in the same syntax you use to ship apps. **~430 tests, all in Clarity**, run in CI.
- **Ships as a single binary.** Clarity transpiles to JavaScript, Bun compiles the bundle to a native executable for macOS, Linux, and Windows (x64 + ARM64). No runtime to install, no virtual environment to activate, no Python on the target machine. `clarity run hello.clarity` and you're done.
- **Batteries included.** `clarity debug`, `clarity profile`, `clarity fmt`, `clarity lint`, `clarity test`, `clarity doc`, `clarity lsp`, `clarity install <pkg>`. The whole developer experience is one command away from the moment you install.

### KyanOS, the operating system

KyanOS is an experimental desktop operating system — an active work in progress — built almost entirely in Clarity itself. The Zig micro-kernel handles paging, scheduling, and syscalls; above the syscall boundary, the userspace is written in Clarity: init, the filesystem layer, the input pipeline, the compositor, the window manager, the dock, the launcher, the settings panel, the file manager, the editor, the terminal, the calculator, the image viewer, the system monitor, the app store, the email client, the chat app, the IDE, the documentation viewer, the playground, the package manager, the ISO packer, the QEMU launcher, and the release pipeline — all Clarity.

- **A real boot path, end to end.** Multiboot2 → ELF loader → ring switch → SYSCALL fast path → page faults → fork / exec / wait / kill → multiboot framebuffer → init → tmpfs / devfs / procfs → desktop session → login. Bringing this all the way up to a stable desktop is still in progress — boot-to-desktop isn't yet wired into CI (see [ROADMAP_OS.md](ROADMAP_OS.md)).
- **Obsidian & neon — one identity, two modes.** The Kyan identity is dark volcanic glass lit by a single signature: violet melting into cyan. **Obsidian** (dark, the default) and **Quartz** (light) are the same identity in two moods, switchable live in **Settings → Appearance**, with a user-tunable accent hue. The faceted-K monogram is cut like a gem with one edge lit by the signature; the spring themes (Meadow, Bloom, Watercolor, Midnight) live on as selectable legacy palettes.
- **Designed like macOS, accessible like Windows.** Hairline depth instead of heavy shadows. 12-px window radii, 8-px controls. A grotesk + mono type pairing. Abstract app-icon marks (a wave for the terminal, a stack for files, a prism for the game hub) that read at any size. The signature gradient appears only where it means something — the logo edge, boot progress, focus rings, selection — and everything else stays quiet.
- **One language, top to bottom.** When you write an app for KyanOS, you write Clarity. When you read the kernel's syscall table, it's defined in Clarity. When you customise your theme, it's a Clarity dict. When you build the ISO, you call a Clarity function. There is no impedance mismatch between the OS and the apps that run on it.
- **Targets QEMU first** on macOS (HVF) and Linux (KVM), with virtio-gpu, virtio-keyboard, and OVMF auto-discovered. `clarity os build && clarity os run` is the developer workflow. Real-hardware boot is a goal, not a verified claim — it hasn't been validated yet.

---

## Why this matters

Most operating systems are written in languages designed in the seventies, glued together with build systems designed in the eighties, decorated with UI frameworks designed in the nineties, distributed through package managers designed in the two-thousands. Each layer hides the layer below behind a wrapper. Reading the source is an archaeology project.

KyanOS is the opposite bet. **One language. One toolchain. One palette. One radius scale. One typography ramp. One way to ship code.** The boot splash, the kernel syscall stub, the file-manager sidebar, the website's CSS, the package registry's HTTP handler — all the same syntax, all the same conventions, all the same `clarity test` away from green. You can clone the repo on a Sunday afternoon and have a working mental model of the whole system by Sunday evening.

That's the bet: **a programming language good enough to write its own operating system in, and an operating system simple enough that you'd actually want to.** The language is there today; the OS is the road still being walked.

---

## At a glance

| | Clarity | KyanOS |
|---|---|---|
| **Status** | v1.0.0 — self-hosted, single binary, runs today | Experimental — kernel + full userspace written; reliable boot-to-desktop still in progress, not yet CI-verified |
| **Lines of code** | ~53,000 lines of Clarity total — toolchain, stdlib, and OS userspace all live in `stdlib/` | plus a ~4,500-line Zig micro-kernel and a ~3,000-line Python bootstrap transpiler |
| **Tests** | ~430 tests in Clarity (~2,700 assertions), run in CI via `clarity test stdlib/` | included in the suite above |
| **Boot time** | — | target: under 5 s to desktop (goal, not yet verified) |
| **Frame rate** | — | target: 60 fps with frame-time tracking (goal) |
| **Idle RAM** | — | target: under 256 MB (goal) |
| **App launch** | — | target: under 250 ms cold (goal) |
| **Dependencies on the target machine** | none — it's a single binary | Zig + QEMU (macOS / Linux) for the dev workflow |

---

## Try Clarity in 60 seconds

One binary, no runtime, works on macOS and Linux (x64 + ARM64).

```bash
# 1. Install Clarity
curl -fsSL https://raw.githubusercontent.com/monkdim/Clarity/main/install.sh | bash

# 2. Clone the repo and run your first program
git clone https://github.com/monkdim/Clarity.git
cd Clarity
clarity run examples/hello.clarity
```

That's it — you've run real Clarity. From here, `clarity shell` drops you into the interactive terminal, `clarity help` lists every command, and `examples/` has eight tours of the language (classes, async, patterns, file I/O, …).

## Try KyanOS (experimental)

> **Heads up:** KyanOS is experimental and under active development. The boot-to-desktop path is still stabilizing and isn't yet CI-verified, so expect rough edges — depending on your setup it may not come all the way up yet. If you want the solid, finished half of this project, that's the language above.

The developer workflow targets QEMU on macOS (HVF) and Linux (KVM when `/dev/kvm` is readable, TCG otherwise). The first run builds a ~240 MB ISO from source, so plan for a one-time wait.

**macOS**

```bash
brew install qemu zig
clarity os build && clarity os run
```

**Linux**

```bash
sudo apt install qemu-system-x86 ovmf zig    # Debian / Ubuntu
# or: sudo dnf install qemu-system-x86 edk2-ovmf zig    # Fedora
# or: sudo pacman -S qemu-base edk2-ovmf zig            # Arch
clarity os build && clarity os run
```

The goal is to land you on the Obsidian desktop — dark glass, the signature violet→cyan edge — with terminal, files, editor, calc, viewer, and monitor pre-pinned to the dock. That's the target experience; getting every setup there reliably is still in progress.

Full instructions, the language tour, every CLI command, and the developer-tools deep-dive live in **[GETTING_STARTED.md](GETTING_STARTED.md)**.

---

## What KyanOS looks like

> These are **real renders from Clarity's software framebuffer**, produced by `clarity run` against the theme + branding modules in `stdlib/` — not mockups. A full composited desktop screenshot is still on the way (see [ROADMAP_OS.md](ROADMAP_OS.md)); the renderer pieces that draw it are landing now.

Boot splash — the faceted-K monogram on void black, the KyanOS wordmark ("Kyan" in ink, "OS" in signature cyan), and a full-width violet→cyan progress bar:

![KyanOS boot splash — Obsidian](https://raw.githubusercontent.com/monkdim/Clarity/main/website/screenshots/kyan_splash.png)

Marketing lockup — the gem-cut monogram with its signature-lit edge, and the wordmark:

![KyanOS lockup](https://raw.githubusercontent.com/monkdim/Clarity/main/website/screenshots/kyan_lockup.png)

---

## What's inside

Clarity ships a self-hosted lexer, parser, AST, tree-walking interpreter, stack-based bytecode VM (58 opcodes), CLI dispatcher, REPL, shell, formatter, linter, type checker, debugger, profiler, doc generator, package manager + TOML parser, package registry server, language server (JSON-RPC 2.0), Clarity-to-JavaScript transpiler, build pipeline, installer, and a runtime spec that auto-generates the JS shim. Everything in `stdlib/`. Everything readable.

The KyanOS codebase adds a multiboot2 Zig micro-kernel (paging, scheduler, syscalls, fork/exec/wait/kill, page faults, timer, multiboot framebuffer), a freestanding QuickJS-based userspace runtime, init / tmpfs / devfs / procfs, an input pipeline, a compositor, a window manager, a dock, a launcher, a settings panel, a notification centre, a theme protocol with the Kyan identity (Obsidian + Quartz) plus the legacy spring themes, a registry + a picker, procedural mineral / aurora / grid wallpapers, the faceted-K branding kit (gem monogram, signature-lit edge, abstract app-icon marks including the Prism game hub), a void-black boot splash, a perf-profiler with a release gate (boot / frame / memory / launch), crash recovery (journal + watchdog + crash dialog with bug-report flow), a pure-Clarity ISO9660 packer, a macOS QEMU launcher with HVF, an installer, a website generator, a release pipeline, and the eleven default apps (terminal, files, editor, calc, viewer, monitor, browser, mail, chat, store, settings). These are written and in the tree; wiring them into a reliable end-to-end boot is the work that remains.

For the full file-by-file structure, see the **Project structure** section of [GETTING_STARTED.md](GETTING_STARTED.md).

---

## Roadmap & history

- **Clarity** — see [GAPS.md](GAPS.md) for the language's path forward (binary I/O, v1.1 hardening, v2.0 compilation targets).
- **KyanOS** — see [ROADMAP_OS.md](ROADMAP_OS.md) for the OS path forward (the `clarity os` developer workflow, hardware drivers, networking, UI polish).

The language is at v1.0 and runs today; KyanOS is an active, experimental work in progress. Both are still being developed. Issues, PRs, and theme contributions are welcome.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: write Clarity. Add a test. Run `clarity test stdlib/`. Open a PR. The toolchain is the dogfood — every contribution improves the language *and* the OS.

---

## License

GPL-3.0 — see [LICENSE](LICENSE) for details.

---

<sub>Clarity is a self-hosted programming language. KyanOS is the operating system being written in it. Together, they're a bet that the simplest tools win — even at the level of an entire computer.</sub>
