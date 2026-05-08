# Clarity freestanding runtime

The Clarity runtime that ships in `/bin/clarity-init` on ClarityOS.
Two build paths share this directory:

1. **QuickJS path** (default). Embeds QuickJS, runs the same JS
   bundle the dev runtime executes — only the I/O surface is
   different. Good first target while we still need a JS engine for
   the transpiled stdlib.
2. **Native bytecode VM path** (stretch goal). Skips JS entirely;
   `runtime/native_vm/vm.zig` interprets Clarity bytecode directly.
   Massive footprint + perf win. Lives behind `zig build vm`.

Both paths link against `host_shim.zig`, the kernel-syscall bridge.

## Layout

```
runtime/
├── freestanding/
│   ├── host.js               # Bun/Node ↔ ClarityOS adapter
│   ├── runtime_freestanding.js  # runtime.js without Node imports
│   ├── host_shim.zig         # SYSCALL bridge
│   ├── quickjs_main.c        # QuickJS-backed entry point
│   ├── build.zig             # Zig build script
│   └── README.md
└── native_vm/
    ├── main.zig              # _start; loads bundle, runs VM
    ├── opcode.zig            # Opcode enum (mirrors stdlib/bytecode.clarity)
    ├── value.zig             # tagged Value union + helpers
    ├── vm.zig                # interpreter loop
    └── gc.zig                # mark-and-sweep heap
```

## Build (when zig is available)

```sh
cd runtime/freestanding
zig build              # → zig-out/bin/clarity-runtime  (QuickJS path)
zig build vm           # → zig-out/bin/clarity-vm       (native bytecode VM)
```

The kernel's `kernel/main.zig` `spawn_user("/bin/clarity-init")`
loads whichever binary is installed at that path.

## How portability works

`stdlib/platform.clarity` is the cross-platform abstraction surface.
Stdlib code that touches I/O / processes / time should branch
through `platform.read_file()` / `platform.list_dir()` /
`platform.now_seconds()` rather than calling the runtime's
`read()` / `exec_full()` / `time()` directly. Those helpers detect
whether they're running on a host runtime (Bun/Node) or on the
bare-metal runtime (`CLARITY_HOST=claritos`) and dispatch
accordingly.

## Status (Phase 66)

- `host.js`           — done. Three concrete hosts (bun/node/claritos)
                        wired through one `HostInterface` shape.
- `runtime_freestanding.js` — done. No Node imports; uses host.js for
                        all I/O. Full type-conversion + display +
                        list/map/string runtime carried over from
                        native/runtime.js.
- `host_shim.zig`     — done. Wraps `SYS_*` numbers from
                        `stdlib/kernel_abi.clarity` as C-callable
                        functions plus a single dispatch entry the
                        JS engine binds.
- `quickjs_main.c`    — done. Tiny C shim — registers `print` +
                        `__claritos_syscall`, evaluates the bundled
                        JS, exits.
- `native_vm/`        — done as a skeleton. Opcodes mirror the full
                        58-opcode set from `stdlib/bytecode.clarity`;
                        Vm.dispatch handles ~10 of them today, the
                        rest return `error.NotImplemented`.
- `platform.clarity`  — done. Detection + override hooks + I/O
                        branches + audit (37 stdlib modules
                        classified as bare-metal-safe, 22 as
                        host-only).

`zig build`/`zig build run` / `zig build vm` only run in environments
that ship a Zig toolchain. None of the binaries here are produced in
this dev sandbox.
