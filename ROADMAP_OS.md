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
| 1 | **Status bar** | Done | `stdlib/statusbar.clarity` — `StatusBar` Widget paints theme-aware bar with active app name, clock (HH:MM via `datetime_now()`), volume indicator (`audio.master_volume`), and a notification dot. `attach_to_bus(b)` subscribes to `notification.new` / `notification.dismissed` for live counts. |
| 2 | **App launcher** | Done | `stdlib/launcher.clarity` — `Launcher` + `AppEntry`. Search field at the top, grid below with arrow-key navigation; type-to-filter (matches names + keywords), Enter to launch, Escape to dismiss. `on_launch` / `on_dismiss` callbacks. |
| 3 | **Dock / taskbar** | Done | `stdlib/dock.clarity` — `Dock` + `DockItem`. Pinned + running indicators (accent dot under each running icon), badge pills, click-to-launch / click-to-focus depending on `running` flag. `mark_running`/`mark_focused`/`set_badge`. Drag-to-reorder + minimize-to-dock animation deferred. |
| 4 | **Wallpaper** | Done | `stdlib/wallpaper.clarity` — `Wallpaper` Widget with `set_color`, `set_gradient` (vertical lerp between two colours), and `set_image(img, mode)` for `fill` / `fit` / `centered` / `tiled`. Nearest-neighbour scaling for fill/fit. |
| 5 | **Lock screen** | Done | `stdlib/lockscreen.clarity` — `LockScreen` Widget. Dark overlay over the wallpaper, centred clock + date, password field that masks input as bullets. `on_unlock(password)` callback returns `true` to release the lock; `false` clears the buffer and shows an error. Backspace/Escape supported. |
| 6 | **Settings panel** | Done | `stdlib/settings.clarity` — `SettingsPanel` two-column layout: sidebar with category list, content area swaps based on selection. `add_category(name, content_widget)` registers panes; arrow keys + sidebar clicks change selection; the panel auto-relayouts the active content widget into the right pane. |

---

## Phase 63 — Core Apps

> The apps that ship with every OS. All written in Clarity using the UI toolkit.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Terminal** | Done | `stdlib/app_terminal.clarity` — `Terminal` engine: VT100 / xterm parser handling control chars (\\b \\r \\n \\t), CSI cursor moves (A B C D H f), erase-in-line/display (K J), full SGR repertoire (16 colors + bright + reset, xterm 256-color, truecolor `38;2;R;G;B`), scrollback buffer with limit. `TerminalApp` Widget paints the cell grid and exposes `feed(bytes)` for any process pipe. PTY (forkpty) deferred. |
| 2 | **File manager** | Done | `stdlib/app_files.clarity` — `FilesApp` Widget with sidebar (Home / Documents / Downloads / Root + storage.mounts), breadcrumb path bar, file list with size + dir-vs-file glyph. `navigate(path)`, `copy_file`/`move_file`/`delete_file`/`make_directory` ops. Click + double-click to open, Backspace to go up, arrow keys to move selection. Tree view + previews + drag-drop deferred. |
| 3 | **Text editor** | Done | `stdlib/app_editor.clarity` — `TextBuffer` with cursor + lines + per-action undo/redo, `find(needle)` + `replace_at(row, col, needle, repl)`, dirty flag. `EditorApp` Widget paints gutter + line numbers + caret + status footer. Cursor keys + Backspace/Delete/Enter; `Ctrl+Z`/`Ctrl+Y`/`Ctrl+S`. Syntax highlighting + tabs + minimap deferred. |
| 4 | **Image viewer** | Done | `stdlib/app_viewer.clarity` — `ImageViewer` Widget loads BMP via `image.load_bmp`, supports zoom (`+`/`-`/`0`/`f`/wheel), pan (arrow keys + drag), rotate left/right, and three filters (grayscale, brightness, invert) with single-shot undo. Status footer shows path / dimensions / zoom. PNG/JPEG ride along once those decoders land. |
| 5 | **Calculator** | Done | `stdlib/app_calc.clarity` — `Calculator` engine: digits, decimal entry, +/-/*/÷, =, C, ±, %, history of past evaluations. `CalculatorApp` paints a display + 4×5 button grid (with the `0` cell spanning two columns) and routes both mouse clicks and keyboard input. Scientific mode (trig/log/powers) deferred. |
| 6 | **System monitor** | Done | `stdlib/app_monitor.clarity` — pure parsers for `/proc/stat` / `/proc/meminfo` / `/proc/loadavg` / `/proc/uptime` / `/proc/<pid>/status`; `cpu_percent_between(prev, curr)` differences two snapshots; `kill_pid(pid, signal)` SIGTERMs by default. `SystemMonitor` Widget paints a CPU history graph, memory + load + uptime line, and a top-by-RSS process list. `tick()` is the caller-driven refresh hook. |

---

## Phase 64 — App Framework & Distribution

> Make it easy for others to build and ship ClarityOS apps.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **App manifest** | Done | `stdlib/app_manifest.clarity` — `clarity-app.toml` parser/generator (TOML-with-arrays), `AppManifest` class with name / version / author / description / icon / entry / categories / `[window]` / `[permissions]`. `requests("filesystem.read")` / `requests("network")` / `allowed_hosts()` answer the gating questions; `validate()` returns the error list. |
| 2 | **App sandbox** | Done | `stdlib/app_sandbox.clarity` — `Sandbox(manifest, app_dir)` gates by manifest grants. Own data dir (`~/.clarity-os/apps/<name>/data`) is always read+write; everything else needs an explicit grant. `check_read` / `check_write` / `check_network` (with exact + `*.example.com` wildcard host matching) / `check_audio` / `check_notifications` / `check_clipboard` / `check_process`; `enforce_*` counterparts throw `PermissionError`. `SandboxedFs` façade delegates to the sandbox before calling the real `read`/`write`/`exists`/`append`. Audit log captures every check. |
| 3 | **App Store / package index** | Done | `stdlib/app_store.clarity` — `AppEntry` (name, version, icon, categories, screenshots, rating, installs, tarball_url), `HttpAppStoreClient` (curl-backed) and `LocalAppStoreClient` (in-memory, for tests + offline mirrors). `AppStore` exposes `list` / `search` / `info` / `featured` / `by_category`; `install` (downloads, extracts, validates the manifest, records in `installed.json`), `install_local` (no-network path used by the scaffolder), `remove`, `installed`, `manifest_for`, `launch_command`. |
| 4 | **`clarity app new`** | Done | `stdlib/app_scaffold.clarity` + CLI hook. `clarity app new <dir> --template basic\|gui [--author ...] [--description ...]` writes `clarity-app.toml`, `main.clarity` (basic shows a string; gui mounts a `WidgetRoot` + `Label`), `.gitignore`, `README.md`. Refuses to clobber an existing manifest, errors on unknown templates. Generated manifests round-trip through validate() with no errors. |
| 5 | **Hot reload** | Done | `stdlib/hot_reload.clarity` — `FileWatcher` (mtime+size polling, returns `{path, kind}` for added / modified / removed), `StateBox` (per-reload survival cache: `put`/`get`/`has`/`remove`/`clear`/`keys`/`size`), `HotReloader` (ties watcher + StateBox + caller-supplied `rebuild_fn(state, prev_app)` together; `build_initial`/`tick`/`force_reload`; emits `before_reload` / `after_reload` / `error` events; rebuild errors get captured into `.error` instead of crashing the loop). The actual module-swap is the runtime hook left for a later phase; everything around it is here. |

---

## Phase 65 — Micro-kernel

> The only non-Clarity code in the system. As small as possible.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Boot sequence** | Done | `kernel/boot/start.S` (multiboot2 entry, switch to long mode, identity-map first GiB with 2 MiB pages, ljmp to long-mode CS), `kernel/boot/multiboot2.zig` (header + tag iterator + memory-map / framebuffer struct definitions), `kernel/boot/uefi.zig` (UEFI entry that translates the EFI memory map then converges on kernel_main), `kernel/boot/linker.ld` (higher-half link layout with the multiboot2 header in the first 32 KiB). Compiles standalone with `zig build`; not buildable in this sandbox (no zig toolchain). |
| 2 | **Memory management** | Done | `kernel/mm/pmm.zig` (bitmap page-frame allocator over the boot memory map; `alloc_page` / `alloc_pages(n)` for runs / `free_page` / `stats`), `kernel/mm/vmm.zig` (4-level x86_64 page tables, `AddressSpace` with `Region` list for demand paging, `map_page`/`unmap_page`, TLB invalidate), `kernel/mm/heap.zig` (slab allocator, eight size classes 32..4096 + page-allocator fallback for larger requests). |
| 3 | **Process scheduler** | Done | `kernel/sched/scheduler.zig` (priority round-robin with three levels, per-priority Queue, `spawn_kthread` / `spawn_user` / `block` / `wake` / `exit` / `schedule` / `run`, freeze switch for panic). Mirrored as a fully-tested in-process simulation in `stdlib/scheduler.clarity` so the design contract (priority preemption, FIFO within a level, sleep wakers, exit + reap) runs under `clarity test` without a CPU. |
| 4 | **Syscall interface** | Done | `kernel/syscall/dispatch.zig` registers 38 syscalls (read/write/open/close/stat/lseek/mmap/munmap/brk, fork/exec/exit/wait/getpid/getppid/kill/nanosleep, pipe/dup/dup2/socket/bind/listen/accept/connect/send/recv, mkdir/rmdir/unlink/rename/readdir/chdir/getcwd/mount/umount, ioctl/clock_gettime/futex_wait/futex_wake) with ~10 wired (read/write/open/close/exit/getpid/nanosleep/clock_gettime). `stdlib/kernel_abi.clarity` is the canonical source for syscall numbers + errno + signals + open/mmap flags; the Zig enums match. `stdlib/syscall.clarity` is the userspace wrapper (`sys_open`/`sys_read`/...): on Linux/macOS it delegates to a host backend with an in-process fd table; on bare metal it would issue the real `syscall` instruction. Mock backend + trace log support the test suite. |
| 5 | **Device drivers** | Done | `kernel/drivers/init.zig` (registers built-ins), `kernel/drivers/pci.zig` (PCI bus enumeration via 0xCF8/0xCFC config ports), `kernel/drivers/ps2.zig` (8042 keyboard + mouse with ring buffers + IRQ handlers wired through `kernel/arch/x86_64/idt.zig`), `kernel/drivers/framebuffer.zig` (VESA/GOP linear FB, mapped into a high-half virtual range, exposes `put_pixel`/`clear`), `kernel/drivers/ahci.zig` + `kernel/drivers/virtio_net.zig` (PCI scan + scaffolds returning `error.NotImplemented` so the kernel links). USB HID, NVMe, real Intel NICs deferred to follow-ups. |
| 6 | **Filesystem** | Done | `kernel/fs/vfs.zig` (Inode / Dentry / File / FsOps vtable, fd table, `open`/`close`/`read`/`write` plus path resolution glue), `kernel/fs/tmpfs.zig` (in-memory root: alloc_inode + child list per dir + growable byte buffer per file, full FsOps implementation). Mirrored as `stdlib/vfs.clarity` for the test path: `Tmpfs` implements lookup/create/mkdir/unlink/rmdir/read/write/truncate/readdir; `Vfs` wraps it with path resolution + cwd + fd table + lseek. Same call surface as the Zig kernel. |

**Tests:** `stdlib/test_kernel.clarity` covers the Clarity-side mirrors with 118 assertions — ABI constants (uniqueness, errno/signal/syscall name lookup, open/mode predicates, mmap-flag independence), scheduler (priority preemption, FIFO within a level, block/wake/wake_all/wake_sleepers, exit/reap, event log), tmpfs through the VFS (open + read/write/append/truncate, mkdir, readdir, chdir + relative paths, lseek SEEK_SET/CUR/END, the ENOENT/EBADF/EISDIR/ENOTEMPTY/EEXIST error paths), and the syscall wrapper (host backend round-trip via real /tmp file, mock backend + trace log, claritos backend reports "not yet wired"). The kernel itself needs Zig + QEMU; `kernel/build.zig` is the entry point (`zig build` / `zig build run`).

---

## Phase 66 — Clarity Runtime on Bare Metal

> The Clarity interpreter/VM runs directly on the micro-kernel — no Bun, no Node, no Linux.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Freestanding JS runtime** | Done | `runtime/freestanding/runtime_freestanding.js` is a port of `native/runtime.js` with no Node imports — every I/O call goes through `runtime/freestanding/host.js`, which detects Bun / Node / ClarityOS at start and dispatches accordingly. `runtime/freestanding/quickjs_main.c` is the C entry point that boots a QuickJS context, registers `print` and `__claritos_syscall`, and evaluates the bundled JS. `runtime/freestanding/build.zig` is the Zig build (default target = freestanding x86_64 ELF the kernel spawns as `/bin/clarity-init`). |
| 2 | **Syscall bindings** | Done | `runtime/freestanding/host_shim.zig` exports each kernel syscall as a C-callable function (`claritos_read` / `claritos_write` / `claritos_open` / ...) plus a single `claritos_syscall(nr, ...)` dispatch entry the JS engine binds as `__claritos_syscall`. Numbers come from `stdlib/kernel_abi.clarity`. The host-side adapter in `runtime/freestanding/host.js` (the `claritos_host()` branch) wraps the dispatch entry so `fs.read_text(path)` becomes `open + read_all + close`, etc. — the JS runtime never imports `fs`. |
| 3 | **Native Clarity VM (stretch goal)** | Done | `runtime/native_vm/{main,opcode,value,vm,gc}.zig` — Zig skeleton that skips JS entirely. `opcode.zig` mirrors the full 58-opcode set from `stdlib/bytecode.clarity`; `value.zig` is the tagged union (null/bool/int/float/string/list/map/function/instance/enum_variant); `vm.zig` is the interpreter loop with the dispatch wired and ~10 opcodes implemented (push/pop/dup/null/true/false/add/sub/mul/div/mod/eq/neq/lt/gt/lte/gte/jump/jump_false); `gc.zig` is a mark-and-sweep heap. Bundle parsing + the remaining 40-odd opcodes are explicitly `error.NotImplemented` until a Zig toolchain is available to test against. |
| 4 | **Stdlib on bare metal** | Done | `stdlib/platform.clarity` — host detection (`bun` / `node` / `claritos`), override hook (for tests + simulating bare metal under the host runtime), canonical OS / arch / endian / line-separator getters, and I/O helpers that branch internally (`read_file` / `write_file` / `list_dir` / `make_dir` / `remove_file` / `now_seconds`) so callers don't have to. Ships an explicit portability audit: 37 stdlib modules classified `BARE_METAL_SAFE`, 22 as `HOST_ONLY` (the modules that reach for /proc, shell tooling, or real network sockets). The two lists are disjoint by construction; the test suite enforces it. |

**Tests:** `stdlib/test_runtime_portability.clarity` — 44 assertions covering live-host detection (host_name / os_name / arch_name / endianness / line_separator return sane values; is_unix / is_linux match), the override hook (flips is_bare_metal + is_host), the I/O branches on both paths (host write+read+remove round-trip on /tmp; bare-metal path exercised via override + syscall mocks asserting `open`/`read`/`write`/`close`/`readdir`/`mkdir`/`unlink`/`clock_gettime` were all issued), and the audit (≥30 modules safe, no overlap with HOST_ONLY, every kernel-related module classified safe, shell/net/registry/hot_reload/app_store classified host-only).

---

## Phase 67 — Bootable ISO & Installer

> ClarityOS boots on real hardware (and VMs).

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **ISO builder** | Done | `stdlib/mkiso.clarity` — `IsoBuilder` lays out the staging tree (`boot/clarity-kernel`, `EFI/BOOT/BOOTX64.EFI`, `bin/clarity-init`, `lib/clarity/stdlib`, plus per-app trees), generates BIOS + UEFI GRUB configs (main / rescue / installer entries with configurable timeout + cmdline), validates the configuration, and packs via `grub-mkrescue` (preferred) or `xorriso` (fallback). `plan()` returns the pure operation list for tests; `build()` executes it. |
| 2 | **Live USB mode** | Done | `stdlib/live_usb.clarity` — `LiveUsbBuilder` wraps `IsoBuilder` with `live/filesystem.squashfs` packed via `mksquashfs`, a JSON `manifest.json` (kind/version/persistence/cmdline/label), an optional persistence overlay slot (`live/persistence/`), and the `boot=live` cmdline default. Same plan / build / validate split as the ISO builder. |
| 3 | **Installer app** | Done | `stdlib/installer.clarity` — guided wizard state machine: welcome → disk → partition → account → review → install → done. Each transition validates prerequisites (disk selected and ≥ 8 GiB, layout chosen, username + password ≥ 6 chars). Three layouts: `auto`, `auto_luks` (LUKS2-encrypted root), `manual`. `plan()` returns the operation list (wipe / partition / make_efi / make_swap / make_root / format / mount_target / copy_system / install_bootloader / create_user / set_timezone / unmount_target); `confirm_install()` drives it with progress + log. `_dry_run` flag lets the test suite exercise the full state machine without touching real storage. |
| 4 | **QEMU/VM testing** | Done | `stdlib/run_vm.clarity` — `QemuRunner` builds a QEMU command line from a small option dict (iso / kernel / cmdline / disk / memory / cores / uefi / kvm / headless / serial / network / virtio_disk / snapshot / no_reboot / extra args) with full validation. `cmd()` returns the argv list, `shell_command()` returns it as a quoted string, `run()` launches it, `boot_test_marker` enables CI smoke runs that grep serial output for a marker line and report `saw_marker` + exit code. |
| 5 | **Hardware compatibility** | Done | `stdlib/hardware.clarity` — static catalogue of supported PCI devices across CPU / storage / network / display / input / audio with three tier classifications (`tier1` / `tier2` / `experimental`). Includes virtio (storage/net/gpu/sound), Intel ICH9 + Sunrise Point AHCI, Intel e1000 / e1000e / AX200 / AX210, Realtek 8139, QEMU std VGA, VMware SVGA II, Intel HD Graphics catch-all, PS/2 8042 keyboard + mouse, Intel xHCI USB 3.0, Intel HDA. `lookup_pci(vendor, device)` does most-specific-match-wins resolution (exact > vendor-only fallback); `driver_for` / `tier` / `entries_by_kind` / `entries_by_tier` / `kind_supported` / `count_by_tier` / `report` (markdown-formatted compatibility matrix). |

**Tests:** `stdlib/test_iso.clarity` — 124 assertions covering all five tasks: ISO plan shape (mkdir/copy/copy_tree/write/pack), GRUB config content (main / rescue / installer entries, multiboot2 line, configurable timeout), validation (missing kernel, non-.iso output, no boot mode); live USB plan adds squashfs + manifest with right keys + cmdline default; installer state machine drives all 7 steps with full prerequisite validation + back navigation, exercises both layout flavours with + without LUKS, asserts plan op kinds and the LUKS encryption flag propagation, catches a too-small disk at the partition gate; QEMU runner argv composition for ISO mode + direct kernel mode, UEFI flags, headless/serial flags, validation of mutually-exclusive iso+kernel + memory floor + network whitelist; hardware DB lookup with exact-match-wins-over-vendor-fallback, tier coverage (every entry has a tier; counts sum to total), `kind_supported` predicates, markdown report generation.

---

## Phase 68 — Web & Networking Apps

> Connect ClarityOS to the internet.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Web browser** | Done | `stdlib/html_parser.clarity` (single-pass tokenizer + DOM builder for the strict subset: headings, p, ul/ol/li, a, img, form, input, button, div/span, strong/em/code, br/hr — plus comment + doctype dropping, entity decoding, mismatched-close tolerance), `stdlib/css_layout.clarity` (block + inline flow with line wrapping, default style table per tag, inline `style="..."` overrides, padding + margin per side, document/html/body always block), `stdlib/browser.clarity` (Browser + Tab classes: per-tab history with back/forward + truncate-on-new-load, bookmarks with dedupe, URL normalisation incl. bare-domain → https, search-engine fallback for non-URL queries, pluggable fetcher so tests inject a fake transport, error-status surfaces as tab.status="error"). |
| 2 | **Email client** | Done | `stdlib/imap.clarity` (IMAP4rev1 client: tagged commands with auto-incrementing tags, multi-line response reader handling untagged + continuation + tagged terminators, CAPABILITY parsing, LOGIN, SELECT extracting EXISTS/RECENT/UIDVALIDITY/UIDNEXT, LIST, SEARCH, FETCH ENVELOPE; transport-pluggable so tests drive it without sockets), `stdlib/smtp.clarity` (SMTP submission: greeting + EHLO + multi-line capability parse, optional STARTTLS, AUTH LOGIN with base64 username/password, MAIL FROM + RCPT TO + DATA + dot-stuffing + final dot, QUIT; SmtpMessage with To/Cc/Bcc separation — Bcc absent from headers but in recipient list — and full RFC 822 render), `stdlib/mail.clarity` (MailApp aggregating multiple MailAccount instances, each with attached IMAP + SMTP transports; folder switching INBOX/Sent/Drafts, compose → save_draft / send_compose, mark_read / flag / delete_message, unread counter). |
| 3 | **Chat app** | Done | `stdlib/websocket.clarity` (RFC 6455 frame parser/builder with FIN + opcode + masking, 7/16/64-bit length forms, partial-frame returns null, dedicated builders for text/close/ping/pong, masked client frames + unmasked server frames; `client_handshake` builds the HTTP upgrade request, `parse_handshake_response` validates the 101 + extracts Sec-WebSocket-Accept; `WebSocket` class buffers bytes across feed() calls and dispatches frames as events), `stdlib/chat.clarity` (Channel with bounded history (1000 msgs) + members + unread counter; ChatConnection wraps any backend implementing connect/join/part/send/poll; ChatApp aggregates connections, dispatches message/join/part/presence events into the right channel, exposes channel_list + unread_total + per-channel select clearing unread). Same surface works against IRC, Matrix, or anything else that exposes that backend interface. |
| 4 | **Package manager GUI** | Done | `stdlib/store_app.clarity` — front-end on top of `app_store.clarity`. Five views (browse / search / category / detail / installed) with consistent state transitions; sort by name/rating/installs in either direction (stable insertion sort over the entry list); install path captures progress + error in `installing` and surfaces them through the summary; back_to_list returns to the most-recent list view (search > category > browse). |

**Tests:** `stdlib/test_web_apps.clarity` — 166 assertions covering all four tasks: HTML parser (basic tags + nested children + double + single-quoted attrs + void elements + self-closing + comments + entity decoding + mismatched-close tolerance + nested find_all); CSS layout (document is always block, h1/p stack with margin-top, narrow viewport produces multi-line wrap, inline `style="..."` overrides parsed); Browser state machine (tab create + load + title from `<title>` + DOM + layout, bookmark dedupe + remove, history back/forward with truncate-on-new-load, bare-domain → https normalisation, search routes to DDG, HTTP 500 → status="error" + error message, close_tab decrements); IMAP wire protocol (greeting + tagged CAPABILITY + LOGIN + SELECT extracting EXISTS/RECENT/UIDVALIDITY/UIDNEXT + SEARCH parsing space-separated id list + sequential A1/A2/A3 tagging); SMTP wire protocol (greeting + multi-line EHLO + capability parse + MAIL FROM + RCPT TO + DATA + terminating dot + QUIT all observable on the fake transport; multi-recipient render with Bcc-not-in-headers); Mail app (sync_inbox + compose + send + save draft + folder switching + mark_read + flag + delete); WebSocket (frame round-trip with masking + 200-byte payload through 16-bit length + close frame carrying 1000 as 0x03E8 + ping + partial frame returns null + handshake request shape + 101 vs 400 response handling); Chat app (join, send, poll dispatching message/join/part/presence into channels, unread tracking + clear-on-select, multi-channel unread total); Store app (browse + sort by rating/installs/name with both directions, search + empty-query handling, category + detail + back-to-list, install path with a real synthetic tarball through LocalAppStoreClient, installed view).

---

## Phase 69 — Developer Experience on ClarityOS

> ClarityOS is the best platform for writing Clarity code.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Clarity IDE** | Done | `stdlib/ide.clarity` — `ProjectTree` (mtime-aware fs scan + expand/collapse + visible() DFS for the UI), `IdeBuffer` (TextBuffer + dirty flag + revert), `Ide` aggregating tabs (open/close/select with re-open switching focus, no duplicates), an embedded `Terminal`, `IdeDebuggerState` (Breakpoint set with toggle that returns the new state, watches with dedupe, idle/running/paused/done state machine + step/resume/stop), `IdeOutputPanel` (multi-channel log: build/test/run/lsp/git), `IdeGitPane` (status/branch/diff via shelled git), pluggable `register_lsp(extension, fn)` per file extension. |
| 2 | **Visual UI builder** | Done | `stdlib/ui_builder.clarity` — `UiBuilder` with `WIDGET_PALETTE` (WidgetRoot / Label / Button / Checkbox / TextInput / Slider / ProgressBar / ScrollView / ListView with their constructor props and import paths), `add` / `remove` (recursive, refuses to remove root) / `move_node` / `resize_node` / `set_property` / `rename` (validates identifier shape), `hit_test(x, y)` deepest-match-wins, `to_dict` JSON-friendly serialise, `generate(module_name)` emits compilable Clarity source with the right `from ... import ...` lines + `set_bounds` + `add` calls. History snapshot per mutation for future undo. |
| 3 | **Documentation browser** | Done | `stdlib/docs_app.clarity` — `DocsApp` loads from a stdlib directory (drives `generate_docs_entries` per file, normalises with stable IDs + visit counter), exposes `list_alphabetical` (insertion-sorted), `list_by_module`, `modules`, `open(id)` (bumps visits + pushes history), `back` (pops + selects previous), `search(query)` (weighted: name match 10 / summary 3 / module 2; sorted descending), bookmarks with dedupe + tag, pluggable runner via `set_runner(fn)` so the test suite injects a fake without shelling out. |
| 4 | **Playground app** | Done | `stdlib/playground_app.clarity` — `PlaygroundApp` wraps a TextBuffer for source, runs through a pluggable runner (real or injected for tests), keeps a 50-entry history; `examples()` / `examples_by_category` over a built-in 6-snippet gallery (basics / language / concurrency); `save_snippet` / `load_snippet` / `delete_snippet` with replace-on-same-id semantics, persisted to `~/.clarity-os/playground/snippets/`; `share()` returns a deterministic URL keyed by an FNV-1a 32-bit hash of the source so the same source always gets the same URL slug. |

**Tests:** `stdlib/test_devx.clarity` — 125 assertions: project tree expand/collapse + visible(); IDE tab open dedupe + dirty count + save_all; LSP integration with a fake backend that flags "BUG" markers; debugger transitions through idle → running → paused → done with step/resume + breakpoint toggle returning the new state; output panel multi-channel append + clear + run_in_terminal capturing real `echo` output; UI builder add/remove/move/resize/property/rename + hit-test (label hit, button hit, root in empty area, null outside) + unknown widget kind throws + remove root refused + generated code contains the right ctors + bounds + add calls + imports; docs browser load from a synthetic stdlib dir + alphabetical sort actually sorted + search ranks name matches above summary matches + open/back history + bookmarks dedupe + run_example with injected runner; playground source state + gallery + load_example + injected runner + snippet save/replace/load/delete + share is deterministic for identical source and differs for different source.

---

## Phase 70 — Kernel completion

> Replaces the Phase 65 scaffolds with a kernel that actually runs userspace. The first of five phases (70–74) bridging the gap from "scaffold + simulation" to "boots in QEMU and you can use the apps." Original Phase 70 ("Polish & Ship") moved to Phase 75.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **ELF loader** | Done | `kernel/loader/elf.zig` — strict ELF64 LE parser with header validation (magic / class / data / type / machine), program-header walk, PT_LOAD segment list, `LoadedExecutable` with entry / is_dynamic / segments. `kernel/loader/load.zig` — loads segments into a fresh `AddressSpace`, allocates pages from `pmm`, copies file-backed bytes + zero-fills BSS, maps with `PAGE_USER` + `PAGE_NX` where appropriate, sets up an 8-page user stack, returns the `LoadedProcess` with entry RIP / user RSP / brk_start. Mirrored as `stdlib/elf.clarity` (parser + `build_test_elf` constructor) so the test suite drives a real synthetic ELF round-trip. |
| 2 | **Real `spawn_user` + ring switch** | Done | `kernel/sched/scheduler.zig` `spawn_user` is no longer `error.NotImplemented`: reads the ELF off the VFS, parses + loads, allocates a 16-KiB kernel stack + a `Process` + main `Thread`, builds the IRET frame with user CS=0x1B / SS=0x23 / RFLAGS=0x202 pointing at the entry RIP, queues the thread. `kernel/arch/x86_64/context.zig` defines the `Context` save-area, `init_kernel_thread` / `build_iret_frame` / `enter_userland` (the `iretq` trampoline). |
| 3 | **SYSCALL/SYSRET fast-path** | Done | `kernel/arch/x86_64/syscall.zig` — `init()` programs `IA32_EFER.SCE`, `IA32_STAR` (CS selectors), `IA32_LSTAR` (entry trampoline), `IA32_FMASK` (mask IF/DF/TF), `IA32_KERNEL_GS_BASE` (per-CPU scratch). `syscall_entry` (naked) does `swapgs` → save user RSP into per-CPU `gs:8` → load kernel RSP → push user RIP/RFLAGS/RSP + arg registers → call C dispatcher → restore and `sysretq`. The `dispatch_syscall_c` bridge translates the System V ABI args into `syscall/dispatch.zig`'s `Args` struct. |
| 4 | **Context switching** | Done | `context.switch_to(prev, next)` saves the six callee-saved registers + RSP into `prev`, restores them from `next`, then jumps through `next.rip`. New kernel threads get pre-pushed register slots so the first switch lands at their entry function. |
| 5 | **Page-fault handler + demand paging** | Done | `kernel/mm/vmm.zig` `classify_fault(error_code)` returns one of `.not_present` / `.write_to_readonly` / `.user_access_to_kernel` / `.reserved_bit_set` / `.instruction_fetch`. `handle_page_fault(space, addr, error_code)` walks the address-space region list, lazily allocates a page from `pmm`, maps it with the region's flags. Returns `error.NotMapped` for a true segfault. Mirrored as `process_model.FaultModel` so the test suite drives the same decision tree. |
| 6 | **Timer-driven scheduling** | Done | `kernel/arch/x86_64/timer.zig` — 8254 PIT channel 0, mode 2, configurable Hz (default 100). IRQ vector 0x20 increments the global tick counter, EOIs the master PIC, and calls `sched.schedule()`. `uptime_ms` + `uptime_seconds` for clock_gettime. |
| 7 | **fork / exec / wait / kill** | Done | `kernel/sched/scheduler.zig` adds `fork` (clones address space, allocates child Process + Thread, registers parent/child link), `exec` (parses+loads the new ELF, replaces address space, rebuilds the IRET frame, re-enters userland), `waitpid` (any-child or specific PID, removes from process table on reap), `kill` (SIGKILL terminates immediately and posts a zombie record to the parent). `kernel/sched/process.zig` owns `Process` + `Table` + `ZombieRecord` + `reparent_children` (orphans go to init=PID 1). Errno enum extended with `echild`. Mirrored as `process_model.UserspaceSim` — the test suite forks two children, exits one, kills the other with SIGKILL, asserts both reach the parent's zombie queue and waitpid reaps them in order. |
| 8 | **Multiboot2 framebuffer parsing** | Done | `kernel/boot/multiboot2.zig` `ParsedBootInfo.parse(blob, gpa)` walks the tag stream, extracts framebuffer (addr/pitch/width/height/bpp), memory map (entries copied into a heap-allocated slice), cmdline (null-terminated), RSDP v1 + v2 pointers. Same parser logic mirrored as `process_model.parse_multiboot_blob` over a list of bytes — test suite synthesises a blob with all four tag types and asserts every field round-trips. (Discovered + fixed an int32 sign-extension bug in the byte-→u32 helper while writing the test.) |

**Tests:** `stdlib/test_kernel_full.clarity` — 77 assertions: ELF parser (synthetic ELF64 build → parse round-trip with two PT_LOAD segments — code R+X, data R+W with BSS padding; rejects bad magic, 32-bit class, ARM machine), process table (alloc_pid monotonicity, register/lookup/remove, child registration), userspace fork/exec/waitpid/kill (init forks two children; one execs `/bin/sh` and exits 0; the other gets SIGKILL'd; both end up in init's zombie queue and waitpid reaps them in pid order; waitpid with no children returns null), orphan reparenting (parent with two grandchildren exits before they do; grandchildren end up under init=1), page-fault classifier (all five cause categories), page-fault handler (lazy-mapping on first touch, spurious-fault returning false on second access, segfault throw for out-of-region address, write-to-RO throw, RO read succeeds), multiboot2 parser (cmdline + framebuffer all 6 fields + memory map with two entries — available 0..1 GiB, reserved 1..1.5 GiB).

---

## Phase 71 — Freestanding runtime: QuickJS, libc shim, TTY, devfs, per-process fd table

> Wires the runtime → kernel boundary so a userspace ELF can actually issue syscalls and have stdin/stdout/stderr go somewhere visible.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **QuickJS vendor scaffolding** | Done | `runtime/freestanding/third_party/fetch_quickjs.sh` downloads + extracts QuickJS-NG (default v0.5.0) into `third_party/quickjs/` so the build script can pick it up. README documents the why (Bun + V8 need a host libc; QuickJS doesn't) and the recovery plan if a missing-symbol surfaces. |
| 2 | **Bundle embedder + build script** | Done | `runtime/freestanding/embed_bundle.zig` `@embedFile`'s the transpiled `clarity-entry.js` into the freestanding binary as `clarity_bundle_js[]`. `build.zig` checks for `third_party/quickjs/quickjs.h` at configure time and prints a friendly skip notice if not vendored yet; otherwise links QuickJS + `host_shim.zig` + `libc_shim.zig` + `embed_bundle.zig` + `quickjs_main.c` into `clarity-runtime`. Native bytecode VM target (`zig build vm`) shares the shim objects. |
| 3 | **TTY driver + devfs** | Done | `kernel/drivers/tty.zig` — virtual terminal with canonical-mode line discipline (backspace deletes from line buffer + emits BS-space-BS, `\r`/`\n` commits the line + trailing newline to the input ring) + raw mode (every byte immediately readable) + echo toggle. `kernel/fs/devfs.zig` — devfs mounted at `/dev` with four character devices: `tty0` + `console` (alias) routing to `tty.tty0`, `null` (discards writes / EOF on read), `zero` (reads zero bytes / writes succeed). `op_create` / `op_mkdir` / `op_unlink` / `op_rmdir` all return `error.PermissionDenied` — devfs is read-only structurally. |
| 4 | **Per-process fd table** | Done | `kernel/fs/vfs.zig` — global `fd_table` replaced with `PerProcessTable` struct + a `current_table_fn` resolver the scheduler installs at boot. `open` / `close` / `read` / `write` syscalls consult the current process's table; `fallback_table` covers early boot before the first process exists. Each table holds 256 fd slots; alloc returns the lowest free index (3+, since 0/1/2 are reserved for stdio). |
| 5 | **libc shim** | Done | `runtime/freestanding/libc_shim.zig` — bump-allocator-backed `malloc`/`free`/`calloc`/`realloc` over a 16 MiB arena, `memcpy`/`memmove`/`memset`/`memcmp` via `@memcpy`/`@memset`, `strlen`/`strcmp`/`strncmp`/`strchr`, `read`/`write` syscalls routed through `host_shim`, `__assert_fail`/`abort` that print to fd 2 then exit, `__errno_location`. The full surface QuickJS calls into when running freestanding. |

**Tests:** `stdlib/test_runtime_full.clarity` — 45 assertions: TTY canonical mode (echo prints chars, line commits on `\n`, BS-space-BS sequence on backspace + line-buffer rollback, empty-line backspace no-op, echo=false suppresses output but still commits, multi-character lines), TTY raw mode (every byte immediately available, no line buffering, BS + Ctrl+C passed through), mode switching (drops in-progress canonical line), TTY write capture (string + byte-list), fd table stdio install (3 fds at 0/1/2 → tty0), fd table alloc returns 3+ then 4+, close + bad-fd-throws, dup shares inode, fork-clone gives child fresh fds that mutate independently from parent, end-to-end userspace → kernel → tty (process writes to fd 1, read out of TTY's output capture; keyboard pushes input, process reads fd 0 and gets the committed line; bad-fd reads throw EBADF).

---

## Phase 72 — Userspace bootstrap: `/bin/clarity-init`, procfs, input pipeline

> The first user process. The kernel `spawn_user`s us; we coordinate everything else: mount the filesystem tree, start the service supervisor, run the input pipeline, spawn the desktop session.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **clarity-init bootstrap** | Done | `stdlib/init_app.clarity` — `InitApp` class. Boot sequence: read config from `/etc/clarity-os.toml`, mount tree, topo-sort the service spec list, spawn each service. `tick()` runs the supervisor (waitpid loop reaps zombies + restarts per policy) + the input pump (reads `/dev/tty0` → dispatches bytes to the InputBus). Pluggable syscall backend so the test suite drives the same boot sequence the real kernel would. |
| 2 | **Mount tree** | Done | DEFAULT_MOUNTS = root tmpfs, /dev devfs (ro,nodev), /proc procfs (ro), /tmp tmpfs (rw,nosuid,nodev,size=64m). The mount syscall is delegated to the syscall backend; init records what was mounted and surfaces failures in `errors`. |
| 3 | **Kernel input → event_bus pipeline** | Done | `stdlib/input_pipeline.clarity` — `InputPipeline(source, bus)`. `pump()` drains scancodes from the source, runs each through `keymap.decode_key` with the live Modifiers tracker (auto-updated via `Modifiers.update`), wraps the result as a key event {code, press, char, name, shift/ctrl/alt/meta}, dispatches to `bus.on_key`. Captures events into a 256-deep ring for tests. `dispatch_text_byte()` is the canonical-mode fast path: byte goes straight to `bus.on_text` without touching the keymap. |
| 4 | **Service supervisor** | Done | Topo-ordered start (Kahn's algo over the dep graph; cycles throw); restart policies "always" / "on-failure" / "no" — clean exit with on-failure does *not* respawn, exit_code != 0 does; failed-to-spawn services land in state="failed" rather than crashing init. Reverse topo on `shutdown()` — SIGTERMs the launcher first, the logger last. Test suite verifies the policy with both clean-exit-no-restart and crash-then-restart paths against fresh init instances. |
| 5 | **procfs** | Done | `kernel/fs/procfs.zig` materialises content on every read (cpuinfo from cpu count, meminfo from `pmm.stats()`, uptime from the timer's tick counter, loadavg/version constants); `op_lookup` finds top-level entries + numeric PIDs that match a live process. `stdlib/procfs.clarity` mirrors the same shape against an injected process-table snapshot for tests; supports `read("/proc/<pid>/status")` style VFS-shaped lookup that throws ENOENT for unknown paths. |

**Tests:** `stdlib/test_init_app.clarity` — 65 assertions: init boot reads config, mounts in order (4 mounts), spawns services in topo order (logger first; launcher last), populates service registry; supervision reaps a logger zombie + restarts per policy, *doesn't* restart launcher on clean exit but *does* on a crash (verified on a fresh init), failed-to-spawn services marked "failed", shutdown SIGTERMs all 6 services; procfs renders cpuinfo / meminfo (loaded from injected stats) / uptime / loadavg (formatted to 2dp) / version, per-PID status / cmdline / comm, throws ENOENT on unknown PID + unknown top-level path; input pipeline translates KEY_A → "a" without shift, holding KEY_LEFTSHIFT then pressing KEY_A produces "A", modifier-only events dispatched, text-byte fast path bypasses keymap; end-to-end init.tick() pumps tty bytes into the bus.

---

## Phase 73 — Compositor on bare metal: framebuffer mmap, DisplayServer, DesktopSession

> Brings the Phase 59–62 desktop chrome (Compositor + WindowManager + Wallpaper + StatusBar + Dock + Launcher + LockScreen) onto the bare-metal kernel framebuffer. After Phase 73, a userspace process can paint pixels that show up on the actual screen.

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | **Framebuffer mmap** | Done | `kernel/drivers/framebuffer.zig` `map_into_user(space, virt)` maps the boot framebuffer's physical pages into a user AddressSpace with PAGE_USER+PAGE_WRITE and tracks the region for munmap/COW. `kernel/syscall/dispatch.zig` adds a graphics fast-path for `sys_mmap(fd=-2)` + `sys_ioctl(fd=-2, FB_GET_INFO=0x4600)` that returns a `FbInfoForUser` struct (width/height/pitch/bpp). Userspace flow: `ioctl(FB_FD, FB_GET_INFO, &info)` → `mmap(addr, info.size, RW, SHARED, FB_FD, 0)` → wrap as a Framebuffer. |
| 2 | **DisplayServer** | Done | `stdlib/display_server.clarity` — frame loop on top of the existing Compositor + WindowManager. `frame()` calls `compositor.render()` only when there's dirty content; `_needs_full_paint` forces a one-shot full repaint after window changes. `tick()` drains input, dispatches mouse events with focus-on-press routing, dispatches key/text events to the focused window, then paints a frame. `step(n)` is the bare-metal main-loop helper. Cursor tracking + show/hide. Snapshot returns paint stats for tests. |
| 3 | **DesktopSession** | Done | `stdlib/desktop_session.clarity` — top-level orchestrator. `boot(layout)` mounts wallpaper / statusbar / dock at the right z-order using injected factories (so tests run with stubs and bare-metal uses the real wallpaper.clarity / statusbar.clarity / dock.clarity widgets). `launch(app_id)` builds a Window from the app factory, places it offset from the previous window, focuses it; second `launch` of the same app returns the existing entry instead of spawning a duplicate. `close_app` removes from compositor + the running map. `show_launcher` / `hide_launcher` toggle the overlay; `lock` / `unlock` for the lock screen; `notify(title, body)` records a notification. Default pinned apps: terminal, files, editor, calc, viewer, monitor. |
| 4 | **Input → focused window dispatch** | Done | `_drain_input` pulls `bus.drain()` (try/catch tolerant of older buses), `_dispatch_event` routes by `kind` (mouse/key/text). `_safe_call` looks up the handler on the target by dict key first (the stub-window shape) then by class method (the real Widget shape). Mouse press → focus changes; key + text events → focused window. WM hook (when present) intercepts mouse before the window. |
| 5 | **App launching** | Done | DesktopSession's launch path covers it. The default app factories are wired to the existing Phase 63 apps (`app_terminal`, `app_files`, `app_editor`, `app_calc`, `app_viewer`, `app_monitor`); the test suite uses stub factories so the test path doesn't pull in the real widget tree. Real bare-metal init code in Phase 74 will plug in the production factories. |

**Tests:** `stdlib/test_desktop_session.clarity` — 63 assertions: DisplayServer (first frame paints fully + bumps painted count + calls compositor.render; second frame with no dirty skips; add_window marks dirty + paints; mouse press at (150,150) routes focus to win_a + delivers the event to its on_mouse handler + cursor follows; mouse outside any window doesn't change focus; key + text events dispatch to the focused window's on_key / on_text; cursor visibility + setter); DesktopSession boot (3 baseline factories run, 3 widgets mounted, default pinned list = 6 apps); launch (factory runs, window count goes 3→4, calc focused; re-launch returns same entry; second app brings count to 5; unknown app throws); close_app (removes entry + window; closing already-closed returns false); launcher show/hide (idempotent; focus moves to launcher); lock/unlock (idempotent; focus moves to lockscreen); notification storage; cursor visibility + position setter.

---

## Phase 75 — Polish & Ship ClarityOS 1.0

> The release. (Renumbered from Phase 70; phases 70–74 finish the bare-metal port first.)

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
