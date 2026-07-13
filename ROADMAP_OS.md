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
- **Native bytecode VM.** `runtime/native_vm/` is a Zig implementation of the Clarity bytecode VM that would let the runtime ditch QuickJS. Roughly half of its ~54 opcodes are implemented; the rest return `error.NotImplemented`, and `load_bundle` is still a stub. Treat as a stretch goal for 1.x.

---

## Distribution & polish

- **Installer.** A Clarity-driven installer that writes the ISO to a USB stick with progress, partitioning, and an EFI fallback. The CLI surface (`clarity os install`) is reserved; the implementation isn't.
- **Update channel.** Signed deltas via the package registry transport. No design yet.
- **Crash report upload.** The crash dialog collects journal + watchdog state into a bug report; nothing receives it. A minimal sink is part of the same work as the registry's HTTP surface in [GAPS.md](GAPS.md).
- **Branding hygiene.** `stdlib/test_polish.clarity` still asserts the literal `"clarityos.dev"`; the website generator (`stdlib/website_gen.clarity`) bakes that domain into `iso_url`, `og:image`, and `og:url`. Nothing breaks at runtime — the site isn't deployed — but a future domain swap touches all three files in lockstep.

---

## Hearth — a local-AI base app (long-term, after the desktop is solid)

A first-class, private, on-device AI studio shipped *with* KyanOS — port of the existing PC "Hearth" (Python/PySide6 cockpit over local model engines). Not near-term: this waits until boot-to-desktop and the UI toolkit are in a nice spot. Captured here so the shape is on record.

**Architecture (proven by the PC build).** Hearth is a *cockpit*, not a model — it drives model engines that run as separate concerns and talks to them locally. That decoupling is what makes a Clarity port sane: rebuild the cockpit, not the math.

- **App layer → 100% Clarity.** The launcher/panel UI, chat with markdown + syntax-highlighted code, model management, prompt/style config, projects, tools, settings, the OpenAI-compatible API surface, and the pipeline orchestration are all ordinary Clarity + KyanOS-toolkit work. This is the bulk of the app and it is entirely writable in Clarity.
- **LLM brain → Clarity + `llama.cpp` via FFI.** `brain.py` is ~250 lines of prompt templates over a thin `POST /v1/chat/completions`; the Clarity version FFIs `llama.cpp` (portable C, GGUF models) instead of HTTP-to-Ollama. This is the one AI engine with a real path to running **CPU-only inside bare-metal KyanOS** (slow on large models, usable on small quantized ones). Everything *we* write stays Clarity; `llama.cpp` is a linked dependency doing the SIMD matmuls, the way numpy backs Python.
- **Image generation (SDXL) → stays external.** Nobody reimplements SDXL in Clarity — it needs a GPU and a Metal/Vulkan-class compute stack. On a *hosted* KyanOS desktop the Clarity app talks to ComfyUI over HTTP (works today in principle); *inside* bare-metal KyanOS it is gated on GPU drivers + a compute stack, i.e. an OS-level prerequisite, not app work. This is the honest ceiling.
- **Pipelines (upscale / video / PDF / marketing / 3D-print / mods) → split.** Orchestration, templating, and **customizable branding** (swap the hardcoded brand names for user config — the clean, easy part) port to Clarity; the heavy compute does not (ESRGAN is a neural net, cv2 MP4 is a codec → FFI, Blender parametric 3D is effectively a CAD kernel). Each heavy pipeline is its own sub-project.

**Honest verdict.** *Can Hearth be written and used entirely in Clarity?* The **app**: yes, fully. The **LLM brain**: yes in practice as Clarity + a `llama.cpp` FFI (and *technically* even as pure Clarity — a GGUF loader + transformer loop compiled via `clarity cc` produces correct tokens, just far too slow without SIMD/GPU to be more than a proof). **Image/3D**: no — they stay external until KyanOS grows a GPU/compute story. So the LLM half is genuinely reachable OS-native long-term; the image/3D half rides on the same track as GPU support landing in the kernel.

**Phasing when the time comes.** (1) Hosted Clarity Hearth on the KyanOS desktop — Clarity cockpit + `llama.cpp` FFI chat + HTTP to an existing ComfyUI — proves the whole spine. (2) Generalize the pipelines (branding → config) and port the non-GPU parts. (3) Chase the OS-native endgame: `llama.cpp` built for KyanOS → CPU chat inside the OS, with image/3D hosted until the GPU stack exists.

**Ties to the language track.** The Clarity→C native compiler (see [GAPS.md](GAPS.md)) is the enabler for any pure-Clarity inference experiment — as it grows SIMD intrinsics / a BLAS FFI, a Clarity-native inference path gets progressively less absurd. A fun north-star, not a dependency.

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
