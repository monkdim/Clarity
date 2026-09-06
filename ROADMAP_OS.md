# KyanOS — Path Forward

This document tracks **what's next for KyanOS**. The 1.0 development history (Phases 56–76) lives in git. Language-side gaps live in [GAPS.md](GAPS.md). This file covers the OS: kernel, freestanding runtime, compositor, window manager, desktop shell, default apps, ISO packer, QEMU launcher, themes, and the release pipeline.

---

## Where we are (September 2026)

KyanOS is **experimental and under active development**, but the boot path is
no longer hypothetical. Each claim below is backed by a CI gate that runs on
every pull request; anything not gated is called out as unverified.

- **The x86_64 kernel boots, verified on every PR.** GRUB loads the
  multiboot2 kernel, the boot stub switches to long mode, and the kernel runs
  its full init sequence to the `ClarityOS ready.` marker on serial:

  ```
  ClarityOS micro-kernel starting...
    [ok] GDT + IDT
    [ok] memory: pmm + vmm + heap
    [ok] scheduler
    [ok] syscalls
    [ok] vfs + rootfs
    [ok] drivers
  ClarityOS ready.
  ```

  The `OS boot (linux-x64, TCG)` job builds the kernel, wraps it in a GRUB
  rescue ISO, and boots it under QEMU **three times, requiring all three** to
  reach the marker — reliability is part of the gate, not a re-run away.
- **An AArch64 (Apple-Silicon-class) kernel boots too.** A second gate,
  `OS boot (aarch64, TCG)`, builds the ARM64 kernel and boots it on QEMU's
  `virt` machine: EL2→EL1 drop, FP/SIMD enabled, PL011 UART up. This is the
  start of the Apple Silicon track, not parity — the ARM kernel does not yet
  have memory management, scheduling, or drivers.
- **There is still no userspace.** After printing `ClarityOS ready.` the
  kernel tries to spawn `/bin/clarity-init` and fails: the freestanding
  runtime does not build. This is *the* gap between "the kernel boots" and
  "the OS runs" — see **Userspace runtime** below.
- **One language above the syscall boundary.** ~50,000 lines of Clarity: the
  runtime, init, tmpfs/devfs/procfs, input pipeline, compositor, window
  manager, dock, launcher, and the default apps. The desktop is exercised by
  a large unit-test suite (60 test files, all green) and by render
  verification, but it runs hosted — it has not yet run *on* the kernel,
  because there is no userspace to host it.
- **The Kyan identity.** Obsidian (dark, default) and Quartz (light) share one
  violet→cyan signature; the spring themes remain as selectable legacy
  palettes. Switchable live in **Settings → Appearance**.
- **Performance targets, still not gates.** Under-5 s boot, 60 fps,
  under-256 MB idle, under-250 ms app launch. None is measured: there is no
  booting desktop to measure yet.

---

## Userspace runtime — the critical path

This is the single blocker between a booting kernel and a usable OS, and it is
larger than it looks.

`runtime/freestanding` builds `clarity-runtime` (QuickJS evaluating the
transpiled Clarity bundle) as the binary the kernel spawns as
`/bin/clarity-init`. It does not compile. Two distinct problems:

1. **No freestanding libc.** QuickJS's C sources `#include <stdlib.h>`,
   `<stdio.h>`, `<assert.h>`, `<string.h>`. The build targets
   `x86_64-freestanding` with `-ffreestanding`, so those headers do not
   exist. `libc_shim.zig` supplies ~18 functions (malloc/free, mem*, str*,
   write/read, abort, clock) but **no C headers at all**, and QuickJS needs
   far more than 18 functions — the printf family, `strtod`, `qsort`,
   `setjmp`/`longjmp`, math, and file I/O among them. Writing that header +
   implementation layer is the bulk of the work.
2. **No single-file bundle.** `@embedFile` needs one self-contained script.
   `transpile.py --bundle` emits the stdlib as many `.js` modules plus a
   139-byte `clarity-entry.js` stub that ES-`import`s its siblings — which a
   freestanding QuickJS cannot resolve. A real single-file bundle step is
   required.

**Two candidate routes, neither started:**

- **Finish the freestanding libc** (above). The Clarity semantics come for
  free because they already exist as JavaScript; the work is bounded and
  well-understood, just broad.
- **Finish `runtime/native_vm`** — a pure-Zig Clarity bytecode VM, so no libc
  is needed at all. Attractive in principle, but it is a **484-line
  skeleton**: taking it to "runs the stdlib" means reimplementing the whole
  Clarity runtime (strings, maps, lists, classes, closures, GC) in Zig, which
  is *larger* than the libc route, not smaller.

A third option worth evaluating before committing: build the runtime against
**static musl** rather than bare freestanding, and implement the Linux syscall
subset musl needs in the kernel (which already has a syscall dispatch table).
That trades "write a libc" for "implement syscalls", which may be the smaller
and more reusable job.

---

## Kernel — verified and outstanding

**Verified working** (exercised by the boot gate):

- Multiboot2 boot, higher-half link, long-mode entry, and page tables mapping
  the identity window, the HHDM (`0xFFFF_8000_…`, which the VMM depends on),
  and the kernel window.
- Physical page allocator over the firmware memory map, reserving the whole
  loaded kernel image so it cannot hand out its own pages.
- Slab heap, scheduler init, syscall MSR wiring, VFS + tmpfs root mount.
- Driver init: PS/2 (8042) with bounded status waits, framebuffer mapping
  through the real kernel address space.

**Outstanding on x86_64:**

- **ELF loader → `execve` → userspace.** Scaffolded, never exercised, and
  blocked on the runtime above.
- **Exception handlers that report.** A fault today is silent: no handler
  prints a register dump, so a bad access simply stops the machine. This cost
  real debugging time and should be fixed early.
- **AHCI and virtio-net are skeletons.** Both scan PCI correctly, but
  `attach`/`send_frame`/`recv_frame` are `NotImplemented`. PCI enumeration
  itself is real.

**Outstanding on aarch64** (in rough order): exception vectors, MMU/TTBR page
tables, the generic timer, then sharing the memory manager, scheduler and VFS
with x86_64 behind an arch abstraction. The shared subsystems are mostly
architecture-neutral Zig already, but they reach into port I/O, GDT/IDT and
x86 4-level paging, so they cross over one phase at a time.

---

## CI gates (the developer workflow)

Both OS gates are live in `.github/workflows/os-boot.yml`:

- **`OS boot (linux-x64, TCG)`** — `zig build` the kernel, `grub-mkrescue` a
  kernel-only rescue ISO, boot it under `qemu-system-x86_64` three times,
  require `ClarityOS ready.` on all three.
- **`OS boot (aarch64, TCG)`** — `zig build aarch64`, boot under
  `qemu-system-aarch64 -M virt`, require the EL1 marker.

Both are deliberately **kernel-only**: they do not depend on the userspace
runtime, so they gate the kernel today rather than waiting on it. Once the
runtime builds, a third gate should boot the full ISO and assert a marker
printed from *Clarity* code — that is the real "the OS runs" test.

GitHub runners have no `/dev/kvm`, so both boot under TCG.

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

- **Widgets — done.** Dropdown, RadioButton, Toggle, Tabs, TreeView and Tooltip
  have all landed; the Phase 60 deferral list is clear.
- **Shipped since:** window controls (close/minimize/zoom) and dock restore,
  window resize by the corner handle, a scientific Calculator, a Files
  tree-view sidebar plus a details/preview pane, switchable Settings panes, a
  live System Monitor, a Prism game-detail view, an interactive Terminal echo
  shell, and a real text Editor with lexer-backed syntax highlighting.
- **Still open — window animations.** Drag-to-reorder in the dock;
  minimize-to-dock animation.
- **Still open — Files.** Drag-and-drop between panes; PDF/image previews
  (image previews are gated on the decoders below).
- **Still open — Editor.** Tabs, minimap, and wiring the editor to the LSP for
  diagnostics (highlighting is done, via the lexer).

---

## Runtime & terminal

- **PTY — done on the hosted build.** `stdlib/pty.clarity` drives a real PTY
  via `openpty` + `posix_spawn` through FFI (`posix_spawn` rather than
  `forkpty` so the Bun runtime is never left forked), and the Terminal app
  runs a live shell on it where `pty_supported()` is true. What remains is a
  PTY inside *ClarityOS*, which is gated on the freestanding runtime existing
  at all. Hosts without a PTY fall back to the built-in echo shell.
- **Hot reload.** The app framework supports module reload at the protocol
  level; the runtime hook that actually swaps modules in a live process is the
  gap.
- **Native bytecode VM.** `runtime/native_vm/` is a Zig implementation of the
  Clarity bytecode VM that would let the runtime ditch QuickJS. Measured
  state: 54 opcodes defined, **20 implemented** (not half), `load_bundle`
  still returns `error.NotImplemented`, 484 lines in total. Note the real
  cost: finishing it means reimplementing Clarity's runtime semantics —
  strings, maps, lists, classes, closures, GC — in Zig, which is a *larger*
  job than porting a freestanding libc, since the JavaScript runtime already
  provides those semantics. Treat as a stretch goal for 1.x.

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

## The long goal — Apple hardware, and PC games

The stated ambition is a Mac-quality desktop that runs well on Apple hardware
while still being able to play PC games. Those two halves pull in opposite
directions, and it is worth writing down why.

**Apple hardware means AArch64.** Apple Silicon is ARM64, so it needs the
aarch64 kernel (now booting at EL1 under QEMU) taken all the way: MMU, timers,
interrupts, then Apple-specific bring-up — the M-series boot protocol, device
tree, AIC interrupt controller, and Apple's own display/USB/NVMe blocks, none
of which are PC-standard. Running under virtualization on Apple hardware
(Virtualization.framework) is a far shorter path to "runs on a Mac" and is
worth doing first: it exercises the same aarch64 kernel without needing a
single Apple hardware driver.

**PC games mean x86 plus a Windows compatibility layer plus a GPU.** A native
PC game needs, at minimum: an x86_64 userspace, a Win32/DirectX translation
layer of Wine/Proton scale, a real GPU driver, and a graphics API
(Vulkan/Metal). Each of those is a multi-year project in its own right, and
the GPU driver is the single largest deferral in this document. On Apple
Silicon it additionally needs x86→ARM binary translation, i.e. a Rosetta-class
translator.

**Honest sequencing.** Nothing here starts before the userspace runtime
exists — an OS that cannot run its own init cannot run a game. The realistic
order is: userspace → desktop running on the kernel → GPU/graphics stack →
virtualized-on-Mac → Apple-native aarch64 → any game-compatibility work. The
gaming ambition is best treated as a direction, not a milestone, until the
graphics stack is real.

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
