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
