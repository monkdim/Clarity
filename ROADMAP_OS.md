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
| 1 | **FFI binding layer** | Pending | `stdlib/ffi.clarity` — `dlopen()`, `dlsym()`, `dlclose()` wrappers. Define C function signatures from Clarity: `let puts = ffi.bind("libc", "puts", ["string"], "int")` |
| 2 | **Type marshalling** | Pending | Map Clarity types to C types: int, float, string (char*), bool, null (void), list (array pointer), map (struct pointer). Handle memory ownership (who frees?) |
| 3 | **Pointer abstraction** | Pending | `Pointer` class — wrap raw addresses safely. `alloc(size)`, `free(ptr)`, `read_byte/write_byte`, `read_int/write_int`, `read_string/write_string`. No raw pointer arithmetic exposed |
| 4 | **Struct definition** | Pending | Define C structs from Clarity: `let Point = ffi.struct("Point", [["x", "f64"], ["y", "f64"]])`. Auto-calculate offsets and padding |
| 5 | **Callback support** | Pending | Pass Clarity functions as C callbacks. Trampoline mechanism: wrap a Clarity closure into a C function pointer |

---

## Phase 57 — Graphics: Framebuffer & 2D Rendering

> Clarity can draw pixels. This is the visual foundation for everything.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Framebuffer abstraction** | Pending | `stdlib/graphics.clarity` — `Framebuffer` class: create (width, height), put_pixel, get_pixel, fill_rect, clear, blit (copy region). Backed by FFI to platform framebuffer (Linux: `/dev/fb0` or DRM, macOS: IOSurface) |
| 2 | **2D drawing primitives** | Pending | `stdlib/draw.clarity` — line (Bresenham), circle (midpoint), rounded_rect, polygon, arc. Anti-aliased variants. All in pure Clarity operating on the framebuffer |
| 3 | **Text rendering** | Pending | `stdlib/font.clarity` — BDF/PSF bitmap font loader, `draw_text(fb, x, y, text, font, color)`, `measure_text()`. Ship a default monospace + proportional font. Glyph caching |
| 4 | **Image loading** | Pending | `stdlib/image.clarity` — BMP loader/writer (simple, no dependencies), PNG decoder (inflate + unfilter), JPEG decoder (baseline DCT). `Image` class with resize, crop, rotate |
| 5 | **GPU acceleration (optional)** | Pending | FFI bindings to Vulkan/Metal for hardware-accelerated rendering. Shader compilation, vertex buffers, texture upload. Falls back to software framebuffer |

---

## Phase 58 — Input: Keyboard, Mouse, Touch

> The OS can receive and route human input.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Raw input layer** | Pending | `stdlib/input.clarity` — read from `/dev/input/event*` (Linux evdev) or IOKit (macOS) via FFI. Parse event structs: type, code, value, timestamp |
| 2 | **Keyboard handling** | Pending | Keycode → character mapping (US layout + framework for others), modifier tracking (shift/ctrl/alt/super), key repeat. `KeyEvent` class: key, modifiers, is_press, is_release |
| 3 | **Mouse/trackpad** | Pending | `MouseEvent` class: x, y, dx, dy, button, scroll_x, scroll_y, is_click, is_drag. Cursor position tracking, multi-button support |
| 4 | **Touch input** | Pending | `TouchEvent` class: touch_id, x, y, pressure, phase (began/moved/ended/cancelled). Multi-touch tracking for gestures |
| 5 | **Input event bus** | Pending | Central event dispatcher using Clarity channels. `on_key(fn)`, `on_mouse(fn)`, `on_touch(fn)`. Event bubbling (target → parent → root) and capture. Focus tracking |

---

## Phase 59 — Window Manager

> Multiple windows, stacking, focus, resize, drag. The visual heart of the desktop.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Window abstraction** | Pending | `stdlib/window.clarity` — `Window` class: title, x, y, width, height, framebuffer, visible, focused, resizable, minimized, maximized. Each window owns its own framebuffer |
| 2 | **Window compositor** | Pending | `stdlib/compositor.clarity` — `Compositor` class: manages window stack (z-order), composites all visible windows onto screen framebuffer. Dirty-rect tracking for partial redraws. Alpha blending for transparency |
| 3 | **Window chrome** | Pending | Title bar with close/minimize/maximize buttons, resize handles (8 edges + corners), drop shadow. Drawn in Clarity, fully themeable |
| 4 | **Window management** | Pending | Drag to move, edge-drag to resize, double-click title to maximize, minimize to dock. Snap to edges (left-half, right-half, quarters). `Alt+Tab` window switcher overlay |
| 5 | **Multi-workspace** | Pending | Virtual desktops. `Workspace` class with its own window stack. Switch with keyboard shortcuts or gesture. Slide animation between workspaces |

---

## Phase 60 — UI Toolkit

> Widgets, layout, events. The equivalent of AppKit/GTK/Qt — written in Clarity.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Widget base** | Pending | `stdlib/ui.clarity` — `Widget` class: bounds, parent, children, visible, enabled, style. `draw(fb)` and `handle_event(event)` virtual methods. Widget tree with recursive layout/draw |
| 2 | **Layout engine** | Pending | `stdlib/layout.clarity` — `FlexLayout` (row/column, justify, align, gap, wrap), `GridLayout` (rows/columns, spans), `StackLayout` (absolute positioning). Constraint-based sizing (min/max/preferred) |
| 3 | **Core widgets** | Pending | Label, Button, TextInput, TextArea, Checkbox, RadioButton, Slider, ProgressBar, Spinner, Toggle, Dropdown/Select, ScrollView, ListView, TreeView, TabBar, ToolTip |
| 4 | **Theming** | Pending | `stdlib/theme.clarity` — `Theme` class: colors (background, foreground, accent, selection, border), fonts (sans, mono, sizes), spacing scale, corner radii, shadows. Light + Dark themes built-in. CSS-like style inheritance |
| 5 | **Accessibility** | Pending | Semantic widget roles, keyboard navigation (Tab/Shift+Tab), focus rings, screen reader labels, high-contrast mode, reduced-motion option |

---

## Phase 61 — System Services

> The daemons that make an OS feel like an OS, not a demo.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Init system** | Pending | `system/init.clarity` — PID 1 (in userspace). Service definitions (name, command, dependencies, restart policy). Dependency-ordered startup. Watchdog restarts. `clarity-ctl start/stop/status/list` |
| 2 | **IPC / message bus** | Pending | `stdlib/ipc.clarity` — Unix domain sockets + Clarity channels for cross-process communication. Named services register on the bus. Request/response and publish/subscribe patterns. Serialization via Clarity's JSON |
| 3 | **Storage service** | Pending | `system/storage.clarity` — mount/unmount filesystems, volume detection, disk usage, auto-mount USB/external drives. Notify apps on mount/eject |
| 4 | **Network service** | Pending | `system/network.clarity` — WiFi scanning/connecting (via wpa_supplicant FFI), DHCP client, DNS resolver, connection status, firewall rules. Exposes connection state on IPC bus |
| 5 | **Audio service** | Pending | `system/audio.clarity` — ALSA/PulseAudio/PipeWire FFI bindings. Mixer (per-app volume), playback/capture streams, device enumeration. WAV/PCM playback, audio routing |
| 6 | **Notification service** | Pending | `system/notify.clarity` — apps send notifications (title, body, icon, actions, urgency). Notification center queues and displays them. Dismiss/action callbacks via IPC |

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
