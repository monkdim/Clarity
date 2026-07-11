# KyanOS — Path Forward

This document tracks **what's next for KyanOS**. The 1.0 development history (Phases 56–76) lives in git. Language-side gaps live in [GAPS.md](GAPS.md). This file covers the OS: kernel, freestanding runtime, compositor, window manager, desktop shell, default apps, ISO packer, QEMU launcher, themes, and the release pipeline.

---

## Where we are (July 2026)

KyanOS is **experimental and under active development.** Here is the honest, in-repo state — see [AUDIT.md](AUDIT.md) for the file-by-file evidence behind each line:

- **The layers exist; the boot path is not yet real.** The Zig micro-kernel, the freestanding runtime, init, the compositor, the window manager, and the apps are all written and in the tree — but boot-to-desktop has not been compiled, linked, or booted end to end, and the kernel does not yet build in CI. Multiboot2 → ELF loader → SYSCALL → fork/exec/wait are scaffolded, not wired. Bare-metal boot is a goal, not a verified claim.
- **One language, top to bottom.** ~50,000 lines of Clarity above the syscall boundary. The kernel, runtime, init, tmpfs/devfs/procfs, input pipeline, compositor, window manager, dock, launcher, settings panel, and the default apps are all in this repo — well-built and unit-tested as modules, though the boundaries between them are still bridged by test stubs rather than a live desktop.
- **The Kyan identity.** Obsidian (dark, default) and Quartz (light) are the two modes of the flagship identity, sharing one violet→cyan signature; the spring themes (Meadow, Bloom, Watercolor, Midnight) remain as selectable legacy palettes. Switchable live in **Settings → Appearance**.
- **Performance targets, not yet gates.** Under-5 s boot, 60 fps, under-256 MB idle, under-250 ms app launch are the goals. None is verified — there is no booting desktop to measure yet.

What this document is *not*: a phase-by-phase chronicle. The phase tables that used to live here are in git history at any commit before this rewrite.

---

## CI smoke test (the last piece of the developer workflow)

The `clarity os` CLI subcommand is now wired (`build`, `run`, `iso`, `install`); `read_bytes`/`write_bytes` builtins exist; a cross-platform QEMU launcher in `stdlib/qemu.clarity` picks HVF on macOS and KVM on Linux. What's still missing is a **headless QEMU boot in CI** that greps the serial output for the `KyanOS ready.` marker.

The infrastructure is there: `clarity os run --headless --boot-test "KyanOS ready."` does the right thing locally; `run_vm.clarity` already understands `boot_test_marker` + `timeout_seconds`. The remaining work is in `.github/workflows/ci.yml`:

- Install zig (the actions ecosystem has `goto-bus-stop/setup-zig` or equivalent).
- Install qemu-system-x86 + ovmf via apt on Ubuntu, brew on macOS.
- Run `./native/dist/clarity os build && ./native/dist/clarity os run --headless --boot-test "KyanOS ready." --timeout 120` after the existing self-hosted tests.
- Cache `kernel/zig-out` and `runtime/freestanding/zig-out` so subsequent runs are fast.

Skipped today because (a) it adds 5–10 minutes to every PR, and (b) needs a cache strategy that's its own design call.

---

## Hardware & drivers

Things that work today are useful in QEMU. Real hardware coverage is shallow.

- **Input.** macOS IOKit input (real keyboard/mouse/trackpad on bare metal Macs) is its own programming model — deferred to a dedicated phase.
- **Multi-touch.** Slot tracking for true multi-touch surfaces.
- **Devices.** USB HID, NVMe, real Intel NIC drivers — the kernel's PCI enumeration is generic; concrete drivers are stubs.
- **Audio.** Real ALSA / PulseAudio / PipeWire streaming via FFI. The audio app exists; the backend doesn't yet leave software mixing.
- **GPU.** Vulkan/Metal FFI bindings for a hardware-accelerated framebuffer. Software framebuffer is the current path; this is the largest single-feature deferral.
- **Image decoders.** PNG (DEFLATE) and JPEG (DCT) decoders. Sizeable enough to be their own phase. Wallpapers and app icons currently use procedural Clarity drawing instead of bitmaps.

---

## Networking

- **WiFi.** Association, WPA2/3 handshake, scan UI in Settings.
- **DHCP / DNS / firewall.** Today's stack is `user`-mode QEMU networking; bare-metal needs the real thing.
- **IPC transport.** The system-services IPC API is shared-memory only. A Unix-domain-socket transport using the same API surface is the planned follow-up so apps can talk across machine boundaries (and across containers, if we ever go there).

---

## UI toolkit & desktop polish

The toolkit ships the widgets needed to build the eleven default apps. Filling out the long tail:

- **Widgets.** Dropdown, RadioButton, Toggle, Tabs, TreeView, Tooltip — all deferred from Phase 60.
- **Window animations.** Drag-to-reorder in the dock; minimize-to-dock animation.
- **Files.** Tree-view sidebar, file previews (PDF/image/text), drag-and-drop between panes.
- **Editor.** Syntax highlighting (the LSP exists; the editor isn't wired to it yet), tabs, minimap.
- **Calculator.** Scientific mode (trig, log, powers, memory).

---

## Runtime & terminal

- **PTY.** The terminal app uses pipes today, which works for line-buffered output and is wrong for anything that wants raw mode (vim, less, ncurses apps). Adding `forkpty()` to the freestanding runtime closes this.
- **Hot reload.** The app framework supports module reload at the protocol level; the runtime hook that actually swaps modules in a live process is the gap.
- **Native bytecode VM.** `runtime/native_vm/` is a Zig implementation of the Clarity bytecode VM that would let the runtime ditch QuickJS. 10 of 58 opcodes are implemented; the rest return `error.NotImplemented`. Treat as a stretch goal for 1.x.

---

## Distribution & polish

- **Installer.** A Clarity-driven installer that writes the ISO to a USB stick with progress, partitioning, and an EFI fallback. The CLI surface (`clarity os install`) is reserved; the implementation isn't.
- **Update channel.** Signed deltas via the package registry transport. No design yet.
- **Crash report upload.** The crash dialog collects journal + watchdog state into a bug report; nothing receives it. A minimal sink is part of the same work as the registry's HTTP surface in [GAPS.md](GAPS.md).
- **Branding hygiene.** `stdlib/test_polish.clarity` still asserts the literal `"clarityos.dev"`; the website generator (`stdlib/website_gen.clarity`) bakes that domain into `iso_url`, `og:image`, and `og:url`. Nothing breaks at runtime — the site isn't deployed — but a future domain swap touches all three files in lockstep.

---

## Out of scope

Decisions that should stay decisions.

- **A second window-system protocol.** Wayland/X11 compatibility shims are not on the path. KyanOS apps target the Clarity compositor protocol; cross-OS apps run in QEMU.
- **POSIX userspace shim.** `bash`, `coreutils`, and the BSD utilities are not coming. The Clarity shell + the eleven default apps are the userspace.
- **A separate kernel language.** The kernel stays in Zig. Self-hosting the kernel in Clarity is not a 1.x goal.

---

## How to contribute

1. The single highest-value task is the **`clarity os` developer workflow** above. It unblocks everything else.
2. After that, anything in **Hardware & drivers** or **Networking** is high-impact and well-scoped.
3. UI toolkit work is good for surface-area familiarity; pick one widget or animation and ship it end-to-end with a test.
4. `clarity test stdlib/` runs all 120+ OS tests. Add a test for any change that isn't trivially visible.
5. Open an issue tagged `os` describing the approach before you start.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the developer workflow.
