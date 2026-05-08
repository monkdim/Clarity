# ClarityOS — The Road to an Operating System

> **Vision:** An operating system where 95% of everything you see, touch, and run is written in Clarity. A micro-kernel handles the hardware. Everything above it — the window manager, file manager, terminal, networking, apps, package manager — is Clarity all the way down.

**Starting point:** Clarity v1.0.0 is 100% self-hosted. The language has a compiler, VM, concurrency primitives, networking, crypto, a package registry, and a shell. We're building on solid ground.

**Architecture:**

```
┌─────────────────────────────────────────────────────┐
│  ClarityOS Applications                             │
│  (file manager, editor, browser, settings, store)   │
├─────────────────────────────────────────────────────┤
│  ClarityOS Desktop                                  │
│  (window manager, compositor, status bar, launcher) │
├─────────────────────────────────────────────────────┤
│  ClarityOS Frameworks                               │
│  (UI toolkit, layout engine, event system, themes)  │
├─────────────────────────────────────────────────────┤
│  Clarity Runtime                                    │
│  (interpreter/VM, stdlib, package manager)          │
├─────────────────────────────────────────────────────┤
│  System Services (in Clarity)                       │
│  (init, networking, audio, storage, IPC)            │
├─────────────────────────────────────────────────────┤
│  Micro-kernel (Zig/Rust, ~10K lines)                │
│  (memory, scheduling, syscalls, drivers)            │
├─────────────────────────────────────────────────────┤
│  Bootloader + Hardware                              │
└─────────────────────────────────────────────────────┘
```

---

## Phase 56 — FFI: Foreign Function Interface

> Clarity can call C/Zig/Rust libraries directly. This is the bridge between Clarity and hardware.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **FFI binding layer** | Done | `stdlib/ffi.clarity` — Bun-backed `dlopen`/`dlsym`/`dlclose`. `let getpid = ffi.bind("libc", "getpid", [], "int")`. `Library` class for opening multiple symbols at once. `libc`/`libm` resolve to the platform-correct shared library. |
| 2 | **Type marshalling** | Done | All FFI primitives (i8..i64, u8..u64, f32/f64, bool, ptr, char) plus auto-conversion of Clarity strings → null-terminated UTF-8 buffers for `cstring` args, and BigInt returns for u64/i64 → Number on the way back. Marshalling drills through Clarity Pointer/Callback wrappers and recomputes addresses on each call (TypedArray addresses move). |
| 3 | **Pointer abstraction** | Done | `Pointer` class — `alloc(size)`, `cstring(s)`, `wrap_addr(addr)`, `read_*`/`write_*` for every primitive width, `read_string()` for NUL-terminated C strings, `free()`. Allocations use `Buffer.allocUnsafeSlow` to bypass the Node buffer pool, since pooled buffers can be relocated. Writes are restricted to memory we own. |
| 4 | **Struct definition** | Done | `ffi.struct("Point", [["x","f64"],["y","f64"]])` builds a `StructDef` with natural-alignment offsets and trailing padding. `Point.new()` allocates an instance; `p.set(name, val)` / `p.get(name)`; `Point.from_ptr(addr)` wraps an existing struct returned from C. |
| 5 | **Callback support** | Done | `ffi.callback(fn, arg_types, return_type)` wraps a Clarity function as a C function pointer via Bun's `JSCallback`. Tested with `qsort` from libc — sorts a 5-element int array using a Clarity comparator. `cb.close()` releases the trampoline. |

---

## Phase 57 — Graphics: Framebuffer & 2D Rendering

> Clarity can draw pixels. This is the visual foundation for everything.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Framebuffer abstraction** | Done | `stdlib/graphics.clarity` — 32-bit BGRA `Framebuffer` over a stable Pointer-backed buffer. `put_pixel` / `get_pixel` / `clear` / `fill_rect` / `stroke_rect` / `blit` / `save_bmp`. Bulk fills go through a `_ffi_fill_u32` runtime helper for native-speed `clear`. Color helpers + named constants. |
| 2 | **2D drawing primitives** | Done | `stdlib/draw.clarity` — `line` (Bresenham), `hline`/`vline`, `rect`/`fill_rect`, `circle` + `circle_outline` (midpoint + scanline fill), `rounded_rect`, `arc` (sampled), `polygon`/`polyline`. |
| 3 | **Text rendering** | Done | `stdlib/font.clarity` — `Font` class, embedded 8x8 ASCII bitmap font (95 printable chars), `draw_text` / `measure_text`, plus a `load_psf` parser for Linux PSF v1 console fonts. |
| 4 | **Image loading** | Done | `stdlib/image.clarity` — `Image` with `crop`, `resize` (nearest), `rotate_90`. `load_bmp` reads 24- and 32-bit BMPs, top-down or bottom-up; `save_bmp` writes 32-bit. `from_framebuffer`/`to_framebuffer` for interop. PNG/JPEG decoders deferred to a follow-up phase since DEFLATE/DCT are sizeable. |
| 5 | **GPU acceleration (optional)** | Pending | FFI bindings to Vulkan/Metal for hardware-accelerated rendering. Shader compilation, vertex buffers, texture upload. Falls back to software framebuffer |

---

## Phase 58 — Input: Keyboard, Mouse, Touch

> The OS can receive and route human input.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Raw input layer** | Done | `stdlib/input.clarity` — Linux evdev support: `InputDevice` opens `/dev/input/event*` non-blocking via libc FFI, `parse_event(s)` decodes the 24-byte `struct input_event`, `pack_event` builds them for tests/replay. macOS IOKit deferred to its own follow-up (different programming model entirely). |
| 2 | **Keyboard handling** | Done | `stdlib/keymap.clarity` — full Linux KEY_* constants, US layout with Shift/CapsLock semantics (CapsLock toggles letters only, both at once cancel out), `Modifiers` state tracker, `KeyEvent` with `code` / `name` / `char` / `is_press` / `is_repeat` / modifier snapshot. |
| 3 | **Mouse/trackpad** | Done | `stdlib/mouse.clarity` — `MouseEvent` (x/y/dx/dy/scroll/button/is_motion/is_press/is_release/is_scroll/is_click) and `MouseTracker` that accumulates EV_REL / button deltas between SYN_REPORTs into one frame's events. Optional bounds clamp the cursor to a window. |
| 4 | **Touch input** | Done | `stdlib/touch.clarity` — `TouchEvent` (touch_id/x/y/pressure/phase) and a single-finger `TouchTracker` covering began/moved/ended/cancelled phases. Multi-touch slot tracking (ABS_MT_SLOT + ABS_MT_TRACKING_ID) is its own follow-up. |
| 5 | **Input event bus** | Done | `stdlib/event_bus.clarity` — `InputBus` with `on_key` / `on_mouse` / `on_touch` registration, raw-event dispatch that drives the modifier tracker + mouse tracker + touch tracker internally, and the consume-on-`return true` pattern for stop-propagation. |

---

## Phase 59 — Window Manager

> Multiple windows, stacking, focus, resize, drag. The visual heart of the desktop.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Window abstraction** | Done | `stdlib/window.clarity` — `Window` with title, position, outer bounds, owned Framebuffer (re-allocated on resize), visible/focused/resizable/minimized/maximized state, `move`/`resize`/`maximize`/`unmaximize`, plus `hit_test` reporting "title"/"resize"/"content"/"border"/null. |
| 2 | **Window compositor** | Done | `stdlib/compositor.clarity` — `Compositor` with bottom-to-top z-order, `add` / `remove` / `focus` / `window_at` for hit-testing, dirty-rect tracking with `paint(rect)` / `mark_window` / `mark_all`, `_coalesce` of overlapping rects, partial-redraw `render` (skips work entirely when no rects are dirty). |
| 3 | **Window chrome** | Done | `stdlib/chrome.clarity` — `decorate(window, theme, font)` paints a 1-pixel border, title bar (focus-aware bg/fg with accent stripe), three colored control discs, resize-handle stripes; `drop_shadow` paints a soft shadow into the screen FB. Themes are plain merge-able dicts. |
| 4 | **Window management** | Done | `stdlib/window_manager.clarity` — `WindowManager` attaches to an `InputBus`; left-click on title-bar starts a move drag, on resize-handle starts a resize drag, edge-snap on release with `snap_threshold`, `Alt+Tab` cycles focus to the next-most-recent window. |
| 5 | **Multi-workspace** | Done | `stdlib/workspace.clarity` — `Workspace` owns a window list; `WorkspaceManager(compositor, n)` mounts/unmounts workspaces on the compositor, `switch_to`/`next`/`prev` jump (with wrap), `move_window` migrates between workspaces, and `begin_slide(target)` returns a `SlideAnimation` the caller ticks per frame for a slide transition. |

---

## Phase 60 — UI Toolkit

> Widgets, layout, events. The equivalent of AppKit/GTK/Qt — written in Clarity.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Widget base** | Done | `stdlib/ui.clarity` — `Widget` (bounds, parent, children, visible/enabled/focused/focusable, role, theme inheritance, layout), `WidgetRoot` (bus integration, hit-test, focus chain, render). `_setup_widget()` factored out so subclasses inherit field defaults via the `class X < Widget` chain. |
| 2 | **Layout engine** | Done | `stdlib/layout.clarity` — `FlexLayout` (row/column, justify start/center/end/space_between/space_around, align start/center/end/stretch, gap, padding), `GridLayout` (rows × cols + gap + padding), `StackLayout` (absolute). Honours each child's `preferred_size()`. |
| 3 | **Core widgets** | Done | `stdlib/widgets.clarity` — `Label`, `Button` (mouse + Enter/Space activation), `Checkbox`, `ProgressBar`, `Slider` (drag + arrow keys + Home/End), `TextInput` (typing + arrow/Home/End/Backspace/Delete), `ScrollView` (wheel + keyboard, with thumb), `ListView` (click + arrow keys). Dropdown/RadioButton/Toggle/Tabs/TreeView/Tooltip deferred. |
| 4 | **Theming** | Done | `stdlib/theme.clarity` — `dark()`, `light()`, `high_contrast()` themes as plain mergeable dicts. Themes include colors, font, spacing scale, corner radius, border width, shadow alpha, transition timing. Walked up the widget tree so a subtree can override its parent's theme. |
| 5 | **Accessibility** | Done | Every widget has a `role` field (button / checkbox / textbox / slider / progressbar / listbox / scrollview / label) for screen readers. Tab / Shift+Tab walk a `tab_index`-sorted focus chain; visible focus rings drawn via `theme.focus_ring`; high-contrast theme ships built-in. Keyboard equivalents on every interactive widget. |

---

## Phase 61 — System Services

> The daemons that make an OS feel like an OS, not a demo.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Init system** | Done | `stdlib/init.clarity` — `Service` (start/stop/health functions, deps list, restart policy) + `ServiceManager` (Kahn's-algorithm topological sort, dep-ordered start_all, reverse-order stop_all, cycle detection, watchdog `tick()` that restarts unhealthy services per their policy, event listener channel). |
| 2 | **IPC / message bus** | Done | `stdlib/ipc.clarity` — `Bus` with `register`/`call`/`try_call` (request/response), `subscribe`/`publish` (pub-sub with consume-on-`return true`), `unregister`/`unsubscribe`, `set_intercept` for test/log hooks. In-process today; same API will get a Unix-domain-socket transport in a follow-up. |
| 3 | **Storage service** | Done | `stdlib/storage.clarity` — `mounts()` parses `/proc/mounts`, `disk_usage(path)` calls libc `statvfs` via FFI, `mount`/`umount` syscalls (need root), `StorageWatcher` diffs snapshots and publishes `storage.mounted` / `storage.unmounted` IPC events. |
| 4 | **Network service** | Done | `stdlib/network.clarity` — `interfaces()` enumerates `/sys/class/net/*`, `interface_info(name)` returns operstate / carrier / MAC / MTU / speed / counters, `interface_stats(name)` parses `/proc/net/dev`, `dns_resolvers()` parses `/etc/resolv.conf`. WiFi association / DHCP / firewall deferred to a dedicated phase. |
| 5 | **Audio service** | Done | `stdlib/audio.clarity` — `play_wav(path)` shells out to `paplay`/`aplay`/`afplay`/`ffplay` (whichever is available), `master_volume` / `set_master_volume` / `mute` / `unmute` via `amixer`. Real ALSA/PulseAudio/PipeWire FFI streaming is a separate phase. |
| 6 | **Notification service** | Done | `stdlib/notify.clarity` — `Notification` (title/body/urgency/icon/timeout/actions/app_name) + `NotificationCenter` with active queue, history, do-not-disturb mode (critical urgency bypasses), and full IPC plumbing: `notification.new` / `notification.dismissed` / `notification.action` events. |

---

## Phase 62 — Desktop Shell

> The status bar, app launcher, dock, wallpaper — what makes it feel like a real desktop.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Status bar** | Pending | `desktop/statusbar.clarity` — top-of-screen bar: clock, WiFi/battery/volume indicators, notification bell, app name. Clickable widgets that open dropdowns (calendar, WiFi picker, volume slider) |
| 2 | **App launcher** | Pending | `desktop/launcher.clarity` — grid of installed apps with icons and names. Search bar to filter. Keyboard-driven (type to search, Enter to launch). Categories or recent/favorites |
| 3 | **Dock / taskbar** | Pending | `desktop/dock.clarity` — bottom bar with pinned app icons + running app indicators. Click to focus/launch. Drag to reorder. Minimize-to-dock animation |
| 4 | **Wallpaper** | Pending | `desktop/wallpaper.clarity` — solid color, gradient, or image. Tiled/centered/fill/fit modes. Per-workspace wallpapers. Slideshow mode with timer |
| 5 | **Lock screen** | Pending | `desktop/lockscreen.clarity` — shown on boot and after idle timeout. Clock, date, password field. Blur wallpaper background |
| 6 | **Settings panel** | Pending | `desktop/settings.clarity` — system preferences app: display (resolution, scaling), appearance (theme, accent color, wallpaper), sound (volume, output device), network (WiFi, IP), accounts, keyboard shortcuts, about |

---

## Phase 63 — Core Apps

> The apps that ship with every OS. All written in Clarity using the UI toolkit.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Terminal** | Pending | `apps/terminal.clarity` — VT100/xterm emulator: ANSI escape parsing, 256-color + truecolor, scrollback buffer, tabs, split panes. Runs the Clarity shell (already built in Phase 27) |
| 2 | **File manager** | Pending | `apps/files.clarity` — icon/list/column views, breadcrumb path bar, sidebar (home/desktop/documents/downloads/volumes), drag-and-drop, copy/move/delete, file previews, search |
| 3 | **Text editor** | Pending | `apps/editor.clarity` — syntax highlighting (Clarity + common languages), line numbers, tab bar, find/replace (regex), undo/redo, auto-indent, bracket matching, minimap. Not a full IDE — think TextEdit or Mousepad |
| 4 | **Image viewer** | Pending | `apps/viewer.clarity` — open BMP/PNG/JPEG, zoom, pan, rotate, fit-to-window, slideshow, basic filters (brightness, contrast, grayscale) |
| 5 | **Calculator** | Pending | `apps/calculator.clarity` — standard mode (basic arithmetic), scientific mode (trig, log, powers), history tape, keyboard input |
| 6 | **System monitor** | Pending | `apps/monitor.clarity` — CPU/memory/disk usage graphs, process list (PID, name, CPU%, MEM%), kill process, network activity, uptime |

---

## Phase 64 — App Framework & Distribution

> Make it easy for others to build and ship ClarityOS apps.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **App manifest** | Pending | `clarity-app.toml` — name, version, icon, author, description, permissions (filesystem, network, audio, notifications), entry point, window size. Similar role to Info.plist or .desktop files |
| 2 | **App sandbox** | Pending | Apps run with restricted permissions by default. Filesystem limited to app data dir unless user grants access. Network requires permission. System calls filtered. Prevents one bad app from nuking the system |
| 3 | **App Store / package index** | Pending | Extend the Clarity package registry with app metadata (icon, screenshots, categories, ratings). `clarity app install <name>`, `clarity app list`, `clarity app remove` |
| 4 | **`clarity app new`** | Pending | Scaffold a new ClarityOS app project: creates `clarity-app.toml`, `main.clarity` with a hello-world window, `icon.bmp`, `.gitignore`. Templates for common app types |
| 5 | **Hot reload** | Pending | During development, watch `.clarity` files and hot-swap the running app's code without restarting. Preserve widget state across reloads where possible |

---

## Phase 65 — Micro-kernel

> The only non-Clarity code in the system. As small as possible.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Boot sequence** | Pending | UEFI bootloader (Zig) → load kernel ELF → set up page tables → jump to kernel main. Multiboot2 compliant for QEMU/VM testing |
| 2 | **Memory management** | Pending | Physical page allocator (bitmap), virtual memory (page tables, demand paging), kernel heap (slab allocator). User-space processes get isolated address spaces |
| 3 | **Process scheduler** | Pending | Preemptive round-robin with priority levels. Process states: ready, running, blocked, zombie. Fork/exec model or spawn. Context switching (save/restore registers) |
| 4 | **Syscall interface** | Pending | ~40 syscalls: process (fork, exec, exit, wait, getpid), memory (mmap, munmap), filesystem (open, close, read, write, stat, mkdir, readdir), IPC (pipe, socket, send, recv), device (ioctl), time (clock_gettime, nanosleep). Clarity runtime calls these via FFI |
| 5 | **Device drivers** | Pending | Keyboard (PS/2 + USB HID), mouse, framebuffer (VESA/GOP), storage (AHCI/NVMe), network (virtio-net for VMs, basic Intel NIC). Drivers run in userspace where possible (microkernel philosophy) |
| 6 | **Filesystem** | Pending | Simple filesystem (ClarityFS or ext2 read/write) for the root partition. VFS layer so multiple filesystems can be mounted. tmpfs for /tmp |

---

## Phase 66 — Clarity Runtime on Bare Metal

> The Clarity interpreter/VM runs directly on the micro-kernel — no Bun, no Node, no Linux.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Freestanding JS runtime** | Pending | Compile Bun (or a minimal JS engine like QuickJS) as a freestanding binary that runs on the micro-kernel. This executes the transpiled Clarity stdlib |
| 2 | **Syscall bindings** | Pending | Replace Node/Bun I/O calls in `runtime.js` with direct syscalls to the micro-kernel. `read()` → syscall, not `fs.readFileSync()` |
| 3 | **Native Clarity VM (stretch goal)** | Pending | Compile the Clarity bytecode VM to native code (via Zig/Rust). Skip JS entirely — Clarity bytecode runs on metal. Massive performance win |
| 4 | **Stdlib on bare metal** | Pending | Verify all 35+ stdlib files work on the bare-metal runtime. Fix any assumptions about Linux/macOS userspace |

---

## Phase 67 — Bootable ISO & Installer

> ClarityOS boots on real hardware (and VMs).

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **ISO builder** | Pending | `tools/mkiso.clarity` — assembles bootloader + kernel + Clarity runtime + stdlib + desktop + apps into a bootable ISO image. UEFI boot support |
| 2 | **Live USB mode** | Pending | Boot from USB, run entirely in RAM. Try ClarityOS without installing. Persistent storage option for saving settings |
| 3 | **Installer app** | Pending | `apps/installer.clarity` — disk selection, partition (GPT), format (ClarityFS/ext4), copy system files, install bootloader, create user account. Guided wizard UI built with the Clarity UI toolkit |
| 4 | **QEMU/VM testing** | Pending | `tools/run-vm.clarity` — launch QEMU with the ISO, correct flags for UEFI, virtio devices, serial console for debug output. CI integration for automated boot tests |
| 5 | **Hardware compatibility** | Pending | Test matrix: Intel + AMD x86_64, common WiFi chips (Intel AX200/AX210), NVMe + SATA storage, USB 2.0/3.0. Document supported hardware |

---

## Phase 68 — Web & Networking Apps

> Connect ClarityOS to the internet.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Web browser** | Pending | `apps/browser.clarity` — HTTP/HTTPS client (TLS via FFI to bearssl/mbedtls), HTML parser (subset: text, links, images, headings, lists, forms), CSS layout (block/inline/flex subset), JS disabled initially. Tabs, bookmarks, history, URL bar. Not Chromium — a purpose-built Clarity browser |
| 2 | **Email client** | Pending | `apps/mail.clarity` — IMAP/SMTP client, inbox/sent/drafts, compose with basic formatting, attachments, multiple accounts |
| 3 | **Chat app** | Pending | `apps/chat.clarity` — WebSocket-based messaging, rooms/channels, user presence, message history. Could connect to IRC or Matrix protocols |
| 4 | **Package manager GUI** | Pending | `apps/store.clarity` — graphical front-end for the Clarity package registry. Browse, search, install, update, rate packages and apps. Dependency tree view |

---

## Phase 69 — Developer Experience on ClarityOS

> ClarityOS is the best platform for writing Clarity code.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Clarity IDE** | Pending | `apps/ide.clarity` — project tree, multi-tab editor with LSP integration, integrated terminal, debugger UI (breakpoints, step, watches, call stack), output panel, git integration (diff, commit, push) |
| 2 | **Visual UI builder** | Pending | Drag-and-drop UI designer for ClarityOS apps. Generates Clarity code. Preview mode. Component palette with all UI toolkit widgets |
| 3 | **Documentation browser** | Pending | `apps/docs.clarity` — offline access to Clarity docs, stdlib reference, API explorer. Search, bookmarks, code examples you can run inline |
| 4 | **Playground app** | Pending | Native version of the web playground. Write Clarity, see output instantly. Share snippets. Example gallery |

---

## Phase 70 — Polish & Ship ClarityOS 1.0

> The release.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Performance profiling** | Pending | Profile the full desktop: boot time, app launch time, compositor frame rate, memory usage. Target: boot in <5s, 60fps compositing, <256MB RAM idle |
| 2 | **Crash recovery** | Pending | Watchdog restarts crashed services. Journal/log system for debugging. "Something went wrong" dialog with option to restart app or report bug |
| 3 | **Theming & branding** | Pending | ClarityOS logo, boot splash, default wallpapers, icon set (all SVG/Clarity-drawn), consistent design language across all apps |
| 4 | **Website & downloads** | Pending | clarityos.dev — landing page, feature overview, screenshots, download ISO, documentation, community links |
| 5 | **ClarityOS 1.0 release** | Pending | Tag, build ISO, publish, announce. The first operating system where almost everything above the kernel is one language |

---

## Timeline Estimate

| Milestone | Phases | What you get |
|---|---|---|
| **Clarity draws pixels** | 56–57 | FFI + framebuffer + 2D drawing |
| **Clarity has a GUI** | 58–60 | Input + windows + widgets |
| **Clarity has a desktop** | 61–62 | Services + shell (usable on top of Linux) |
| **ClarityOS runs apps** | 63–64 | Core apps + app framework |
| **ClarityOS boots** | 65–67 | Micro-kernel + bare metal + ISO |
| **ClarityOS connects** | 68–69 | Web + dev tools |
| **ClarityOS ships** | 70 | 1.0 release |

---

## Principles

1. **Clarity everywhere.** If it can be written in Clarity, it will be. The micro-kernel is the only exception.
2. **Simple over clever.** A readable 100-line solution beats a clever 30-line one. This is an OS people should be able to understand.
3. **Ship incrementally.** Each phase is usable. Phase 62 gives you a desktop that runs on Linux. You don't need the micro-kernel to have something real.
4. **Dogfood everything.** ClarityOS is built using Clarity's own tools — the editor, debugger, profiler, package manager.
5. **Small kernel, big userspace.** The kernel does memory, scheduling, and syscalls. Everything else — filesystem, networking, audio, GUI — runs in Clarity userspace.
