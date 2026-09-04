# Reverse Engineering & Game Modding in Clarity

Clarity's Track B specialty is **RE tooling and game mods**: scanners, trainers,
and analysis tools written in a small, readable language and compiled — with
`clarity cc` — to a **standalone native binary** with no runtime, no VM, and no
interpreter to ship. This guide ties the pieces together.

Everything here works in a compiled binary. The live-memory, hooking, and
disassembly layers use the **native FFI** (`ffi_open`/`ffi_call`/`ffi_buffer`),
which exists only in `clarity cc` output — not the tree-walking interpreter — so
build these tools rather than `clarity run`-ning them.

    clarity cc mytool.clarity -o mytool && ./mytool

> **Note on imports.** `clarity cc` currently compiles a *single file*, so the
> examples inline the helpers they use from the stdlib modules below. The modules
> are the canonical source; copy what you need until native builds resolve
> imports.

---

## The toolkit

| Layer | Module | What it gives you |
|-------|--------|-------------------|
| Bytes & scanning | `stdlib/bytes.clarity` | endianness readers/writers, hex, **AOB/signature scanning** with `??` wildcards |
| 64-bit bit math | `stdlib/bits.clarity` | `band`/`bor`/`bxor`/`shl`/`shr`/`get_bits`/`to_hex`, correct to 2^53 (48-bit addresses, u32/u48 fields) |
| Binary formats | `stdlib/binformat.clarity` | declarative `parse`/`emit` of a field layout (headers, save files, packets) |
| Live memory | `stdlib/procmem.clarity` + `read_mem`/`write_mem` | enumerate a process's regions, read and **poke** its memory |
| Hooking | `stdlib/hook.clarity` | patch a live function's code (force a return value) |
| Foreign libraries | `ffi_open` + `ffi_buffer`/`ffi_read`/`ffi_write` | bind any C library (pointers, buffers, out-params) |
| Disassembly | `stdlib/capstone.clarity` | decode machine code via libcapstone → `{addr, size, mnemonic, op_str}` |

---

## Scan a binary for a signature

`bytes.clarity` turns a file into a byte list and scans it for an
array-of-bytes signature, `??` matching any byte:

    from "bytes.clarity" import scan, scan_all
    let buf = read_bytes("target.bin")
    let off = scan(buf, "48 8B ?? ?? E8")     -- first match offset, or -1
    let all = scan_all(buf, "7F 45 4C 46")    -- every match

Runnable tool: **`examples/sigscan.clarity`** — `./sigscan /bin/ls "7F ?? 4C 46"`.

## Read (and scan) a live process

`read_mem(pid, addr, len)` reads another process's memory (`pid <= 0` = self);
`procmem.clarity` parses `/proc/<pid>/maps` into regions you can walk:

    from "procmem.clarity" import mem_regions, scan_process
    for r in mem_regions(0) { show r["perms"] + " " + r["path"] }
    let hits = scan_process(0, "7F 45 4C 46")   -- AOB-scan live memory

Runnable tool: **`examples/memscan.clarity`**. Linux-only (reads `/proc`);
reading another process needs ptrace permission, reading self needs none.

## Poke memory — a trainer

`write_mem(pid, addr, bytes)` writes into a process (writing through
`/proc/<pid>/mem` even reaches read-only pages). `procmem.patch_first` finds a
signature and overwrites it:

    from "procmem.clarity" import patch_first
    patch_first(0, "00 00 00 64", [255, 255, 255, 255])   -- 100 -> big number

Runnable tool: **`examples/memtrainer.clarity`** — the classic
read → locate → write → verify loop.

## Hook a function

`hook.clarity` overwrites a function's prologue so every call returns a value you
choose, and restores it on demand:

    from "hook.clarity" import hook_return, unhook
    let addr = ffi_sym("is_licensed")
    let saved = hook_return(0, addr, 1)   -- always "return 1"
    -- ...
    unhook(0, addr, saved)

Runnable tool: **`examples/hookdemo.clarity`**. x86-64 Linux for now.

## Disassemble

`capstone.clarity` binds libcapstone at runtime and decodes bytes into
instructions — including code read live from a process:

    from "capstone.clarity" import disasm_x64, format_insn
    let addr = ffi_sym("abs")
    for ins in disasm_x64(read_mem(0, addr, 24), addr) {
        show format_insn(ins)     -- endbr64 / mov eax, edi / neg eax / ...
    }

Runnable tool: **`examples/disasm.clarity`**. Needs libcapstone
(Linux: `apt install libcapstone-dev`; macOS: `brew install capstone`).

## Parse & emit binary formats

`binformat.clarity` describes a layout once and gives you both directions:

    from "binformat.clarity" import parse, emit
    let ELF = [{name: "magic", type: "bytes", len: 4}, {name: "class", type: "u8"},
               {name: "_pad", type: "pad", len: 11}, {name: "etype", type: "u16le"}]
    let hdr = parse(ELF, read_bytes("/bin/ls"), 0)

Runnable tools: **`examples/binformat_demo.clarity`**, **`examples/elf64info.clarity`**.

## Bind any C library

`ffi_open` loads a shared library so `ffi_call` can reach it; raw buffers marshal
pointers and out-params:

    ffi_open("libz.so.1")
    let buf = ffi_buffer(64)
    ffi_call("some_fn", "ppl", [buf, src, len])
    let result = ffi_read(buf, 64)

Runnable tools: **`examples/ffi_libm.clarity`**, **`examples/ffi_buffer.clarity`**.

---

## Platform support

- **Linux** is the primary target: `/proc` powers live memory + hooking.
- **Hooking** emits x86-64 machine code today (arm64 needs i-cache handling).
- **Disassembly** works anywhere libcapstone is installed; Capstone is a *cross*
  disassembler, so x86-64 decodes even on an arm64 host.
- **Bytes, bits, and binary formats** are pure Clarity and run everywhere.

See [ROADMAP.md](ROADMAP.md) (Track B) and [GAPS.md](GAPS.md) for what's next:
trampoline detours, richer disassembly detail, and Windows support.
