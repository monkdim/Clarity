# Clarity & ClarityOS

**Simple code. Real power.**

A modern programming language and the operating system written in it. End to end, top to bottom — one syntax, one toolchain, one design vocabulary. From the moment you press the power button to the moment you press *Enter* in the REPL, it's all Clarity.

![ClarityOS desktop — Meadow theme](https://raw.githubusercontent.com/monkdim/Clarity/main/website/screenshots/meadow_desktop.png)

---

## Two projects, one story

### Clarity, the language

Clarity is what Python wishes it could be. It reads like English, runs like JavaScript, scales like Rust, and ships like Go — a single self-contained binary you can drop on any machine.

- **Readable by default.** Immutable variables, named arguments, pattern matching, `|>` pipes that make data flow visible at a glance, `show "Hello {name}"` interpolation, `--` line comments. No semicolons, no type-juggling ceremony, no clever-but-cryptic operators.
- **Powerful where it counts.** Classes with inheritance and interfaces, async / await, generators, decorators, comprehensions, destructuring, null coalescing, optional chaining, pattern matching. Everything modern languages give you, with none of the noise.
- **Self-hosted, end to end.** The lexer, parser, interpreter, bytecode VM, type checker, linter, formatter, debugger, profiler, doc generator, package manager, language server, and shell are all written in Clarity. You can read every byte of the toolchain in the same syntax you use to ship apps. **550+ tests, all in Clarity.**
- **Ships as a single binary.** Clarity transpiles to JavaScript, Bun compiles the bundle to a native executable for macOS, Linux, and Windows (x64 + ARM64). No runtime to install, no virtual environment to activate, no Python on the target machine. `clarity run hello.clarity` and you're done.
- **Batteries included.** `clarity debug`, `clarity profile`, `clarity fmt`, `clarity lint`, `clarity test`, `clarity doc`, `clarity lsp`, `clarity install <pkg>`. The whole developer experience is one command away from the moment you install.

### ClarityOS, the operating system

ClarityOS is a complete desktop operating system built almost entirely in Clarity itself. The Zig micro-kernel handles paging, scheduling, and syscalls; everything above the syscall boundary — init, the filesystem layer, the input pipeline, the compositor, the window manager, the dock, the launcher, the settings panel, the file manager, the editor, the terminal, the calculator, the image viewer, the system monitor, the app store, the email client, the chat app, the IDE, the documentation viewer, the playground, the package manager, the ISO packer, the QEMU launcher, and the release pipeline — is Clarity, all the way down.

- **Boots in under five seconds** to a desktop you'll actually want to use. Multiboot2 → ELF loader → ring switch → SYSCALL fast path → page faults → fork / exec / wait / kill → multiboot framebuffer → init → tmpfs / devfs / procfs → desktop session → login. No legacy cruft.
- **A first-day-of-spring identity.** Meadow (the new flagship) is sage green, daffodil yellow, blossom pink, and sky blue on a cream canvas. Bloom is mint and apricot. Watercolor is dreamy pastels on parchment. Midnight is the deep violet-charcoal Aurora theme for users who want it dark. All four ship by default and switch live in **Settings → Appearance**.
- **Designed like macOS, accessible like Windows.** Soft tinted shadows instead of harsh drop-shadows. 14-px window radii. Single-colour wordmark. Asymmetric layouts that anchor your attention without locking you in. Abstract app-icon marks (a wave for the terminal, a stack for files, a grid for calc, a cog for settings) that read at any size. Frosted chrome. Brand-gradient progress bars. Notifications that respect your focus.
- **One language, top to bottom.** When you write an app for ClarityOS, you write Clarity. When you read the kernel's syscall table, it's defined in Clarity. When you customise your theme, it's a Clarity dict. When you build the ISO, you call a Clarity function. There is no impedance mismatch between the OS and the apps that run on it.
- **Bootable on real hardware** or in QEMU on macOS with HVF acceleration, virtio-gpu, virtio-keyboard, OVMF auto-discovered. `clarity os build && clarity os run` and you're at a working desktop.

---

## Why this matters

Most operating systems are written in languages designed in the seventies, glued together with build systems designed in the eighties, decorated with UI frameworks designed in the nineties, distributed through package managers designed in the two-thousands. Each layer hides the layer below behind a wrapper. Reading the source is an archaeology project.

ClarityOS is the opposite bet. **One language. One toolchain. One palette. One radius scale. One typography ramp. One way to ship code.** The boot splash, the kernel syscall stub, the file-manager sidebar, the website's CSS, the package registry's HTTP handler — all the same syntax, all the same conventions, all the same `clarity test` away from green. You can clone the repo on a Sunday afternoon and have a working mental model of the whole system by Sunday evening.

That's the pitch: **a programming language good enough to write its own operating system in, and an operating system simple enough that you'd actually want to.**

---

## At a glance

| | Clarity | ClarityOS |
|---|---|---|
| **Status** | v1.0.0 — 100% self-hosted, zero Python dependency at runtime | 1.0 — 76 phases shipped, bootable on macOS QEMU and bare metal |
| **Lines of Clarity** | ~80,000 across the toolchain + stdlib | ~50,000 across kernel-adjacent userspace, desktop, apps, infra |
| **Tests** | 430+ language and tooling tests, all in Clarity | 120+ ClarityOS tests on top (perf gate, crash recovery, theme switcher, …) |
| **Boot time target** | — | under 5 s to desktop |
| **Frame target** | — | 60 fps with frame-time tracking |
| **Idle RAM target** | — | under 256 MB |
| **App launch target** | — | under 250 ms cold |
| **Dependencies on the target machine** | none — it's a single binary | Zig + QEMU (macOS / Linux) for the dev workflow; nothing for the burned ISO |

---

## Try it in five minutes

```bash
# Install Clarity
curl -fsSL https://raw.githubusercontent.com/monkdim/Clarity/main/install.sh | bash
clarity run examples/hello.clarity

# Boot ClarityOS in QEMU (macOS)
brew install qemu zig
git clone https://github.com/monkdim/Clarity.git
cd Clarity && clarity os build && clarity os run
```

Full instructions, the language tour, every CLI command, and the developer-tools deep-dive live in **[GETTING_STARTED.md](GETTING_STARTED.md)**.

---

## What ClarityOS looks like

Boot splash — asymmetric layout, logo + wordmark left-aligned in the upper third, full-width brand-gradient progress bar at the bottom:

![ClarityOS boot splash — Meadow theme](https://raw.githubusercontent.com/monkdim/Clarity/main/website/screenshots/meadow_splash.png)

Theme picker in **Settings → Appearance** — three light spring themes plus Midnight, switchable at runtime, persisted to `~/.clarity-os/theme`:

![ClarityOS theme picker — all four built-ins](https://raw.githubusercontent.com/monkdim/Clarity/main/website/screenshots/meadow_themes.png)

Marketing lockup — a single wordmark, a single brand stripe, no skeuomorphism:

![ClarityOS lockup](https://raw.githubusercontent.com/monkdim/Clarity/main/website/screenshots/meadow_lockup.png)

---

## What's inside

Clarity ships a self-hosted lexer, parser, AST, tree-walking interpreter, stack-based bytecode VM (48 opcodes), CLI dispatcher, REPL, shell, formatter, linter, type checker, debugger, profiler, doc generator, package manager + TOML parser, package registry server, language server (JSON-RPC 2.0), Clarity-to-JavaScript transpiler, build pipeline, installer, and a runtime spec that auto-generates the JS shim. Everything in `stdlib/`. Everything readable.

ClarityOS adds a multiboot2 Zig micro-kernel (paging, scheduler, syscalls, fork/exec/wait/kill, page faults, timer, multiboot framebuffer), a freestanding QuickJS-based userspace runtime, init / tmpfs / devfs / procfs, an input pipeline, a compositor, a window manager, a dock, a launcher, a settings panel, a notification centre, a theme protocol with four built-in themes + a registry + a picker, asymmetric meadow / bloom / watercolor wallpapers, modern flat branding (Drop+Leaf logo, abstract app-icon marks), an asymmetric boot splash, a perf-profiler with a release gate (boot / frame / memory / launch), crash recovery (journal + watchdog + crash dialog with bug-report flow), a pure-Clarity ISO9660 packer, a macOS QEMU launcher with HVF, an installer, a website generator, a release pipeline, and the eleven default apps (terminal, files, editor, calc, viewer, monitor, browser, mail, chat, store, settings).

For the full file-by-file structure, see the **Project structure** section of [GETTING_STARTED.md](GETTING_STARTED.md).

---

## Roadmap & history

- **Clarity** — see [GAPS.md](GAPS.md) for the language's development history (Phases 24–48, the road to v1.0).
- **ClarityOS** — see [ROADMAP_OS.md](ROADMAP_OS.md) for the OS roadmap (Phases 56–76, FFI through the spring design refresh).

Both projects are at 1.0 today. Both are still actively developed. Issues, PRs, and theme contributions are welcome.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: write Clarity. Add a test. Run `clarity test stdlib/`. Open a PR. The toolchain is the dogfood — every contribution improves the language *and* the OS.

---

## License

GPL-3.0 — see [LICENSE](LICENSE) for details.

---

<sub>Clarity is a self-hosted programming language. ClarityOS is the operating system written in it. Together, they're a bet that the simplest tools win — even at the level of an entire computer.</sub>
