# The ClarityOS kernel

The only part of ClarityOS that is not written in Clarity. About 9 000
lines of Zig across two architectures, plus 2 000 lines of C that are not
kernel at all — a freestanding libc, so that a program compiled by
`clarity cc` has something to link against. That library now builds for
both, which is what lets the same Clarity program run on both.

Two kernels share most of that Zig. The **x86-64** side is the mature one:
it boots, schedules, and runs real user processes, one of which is a
Clarity program compiled to C and then to a static ELF. The **aarch64**
side is younger and is where the project is going, because Apple Silicon
is the hardware this is aimed at; it now runs unprivileged code at EL0 in
its own address space.

Neither has run on real hardware. Both boot under QEMU on every commit,
and `RUNNING.md` has the commands.

## What actually runs

Every claim below is a marker in a boot log that CI greps for, on three
consecutive boots for x86 and two differently-sized machines for ARM. A
claim with no marker behind it is in "What does not run yet".

**x86-64**, from `.github/workflows/os-boot.yml`:

- multiboot2 boot into long mode, higher-half at `0xFFFF_FFFF_8000_0000`
- GDT, IDT, and the FPU enabled
- physical page allocator, 4-level page tables, a slab heap
- preemptive priority round-robin scheduling — the preemption test is one
  no amount of cooperation between threads could pass
- FPU state preserved across a context switch
- a VFS with tmpfs underneath it: path resolution, create, write, read back
- two processes run in sequence, each loaded from an ELF written into the
  filesystem: `/bin/clarity-init` (Zig) and `/bin/clarity-demo` (a Clarity
  program through `clarity cc --freestanding`, linked against the libc in
  `user/libc`)
- in userspace: `.bss` zeroed, `brk` grows a heap that holds, SSE
  registers survive, `exit` returns through `sysret`, and the kernel
  outlives both processes

**aarch64**, on QEMU `virt`:

- boots from an ARM64 Linux Image header, so a bootloader hands it a
  device tree — which is how it learns where its memory and devices are
- higher-half kernel at `0xFFFF_FF80_0000_0000` on TTBR1, with the
  identity map *dropped*: the low half is no longer translated, which is
  checked by asking the MMU (`at s1e1w`) rather than by reading a bit back
- physical page allocator over the memory the device tree described, with
  the direct map extended to cover all of it
- generic timer at 100 Hz through a GICv2, with interrupts proven to
  arrive rather than assumed
- a 1024×768 framebuffer through `ramfb`, checked twice: the kernel reads
  its own pattern back, and CI takes a screenshot through QEMU's monitor
  and inspects the pixels
- **the boot log on screen**: a text console over that framebuffer, 64×48
  characters, with the serial console mirrored to it. CI reads the text back
  out of a screenshot — replaying the console's own wrapping and scrolling
  over the serial log to work out what each cell should hold, then comparing
  every pixel against a glyph it renders itself from `tools/font8x8.txt`
- per-process address spaces in TTBR0 — three-level tables, ASID-tagged,
  with permissions verified by asking the MMU to translate as EL0 would
- **a program at EL0**: `hello from EL0 on aarch64` in the boot log is
  printed by a user program through `write(2)`, not by the kernel. It reads
  its own memory, is interrupted by the timer and carries on, writes its
  answer back where the kernel can see it, and exits with a status the kernel
  checks — and when it writes to its read-only text page, the kernel takes
  the CPU back
- the kernel never dereferences an address userspace gave it: a user pointer
  is translated through the process's own page tables and read through the
  kernel's direct map. Privileged Access Never is enabled where the CPU has
  it, so that is enforced rather than intended — and the boot gate runs a
  PAN-capable CPU as well as one without, because on the one without, doing
  it the wrong way also works
- kernel threads switching, cooperatively and preemptively — the preemption
  test's threads never yield, and it checks not only that both ran but that
  each resumed inside its own code, which counters alone cannot see
- **a program loaded from an ELF**: `/bin/clarity-init` for aarch64 is built
  by a compiler and laid out by a linker into three segments with different
  permissions and a `.bss` whose memory size exceeds its file size. It runs
  twice, in two address spaces, over frames the first run returned — so its
  own checks that `.bss` reads zero and `.data` came from the file are checks
  on the loader, and its exit status carries the verdict
- a heap: `brk` moves a process's break and maps the pages behind it, and the
  program writes through the new break and reads it back — because a kernel
  returning the number it was asked for proves nothing about what is mapped
- **a Clarity program**: `/bin/clarity-demo` is the same generated C the
  x86_64 side runs, linked against the same `kernel/user/libc`, and its
  output is byte for byte identical — `float 3.1415929203539825
  1.4142135623730951 6.25`, checked literally, because those come out of
  strtod, the library's arithmetic, a hardware square root and dtoa, and a
  subtly wrong one still prints a plausible number

## What does not run yet

Written, compiles, and nothing has ever executed it:

- `fs/devfs.zig`, `fs/procfs.zig`, `drivers/tty.zig` — nothing imports
  devfs or procfs, and tty is reached only from devfs
- `boot/uefi.zig` — nothing imports it
- `drivers/ahci.zig`, `drivers/virtio_net.zig` — scanned for at boot, and
  every operation past detection returns `NotImplemented`

Not written:

- Nothing reads a keyboard on aarch64, so the console on screen is output
  only. QEMU's `virt` machine has no PS/2 controller; it needs a virtio-input
  driver, which does not exist yet.
- On aarch64: a scheduler and a filesystem. Threads can be switched, but
  nothing keeps run queues, priorities or a process table — the boot selftest
  drives the switching primitive directly. Programs are loaded from an ELF
  embedded in the kernel image, because there is nowhere to read one from.
- On aarch64, three system calls exist — `write`, `brk`, `exit` — and every
  other number returns `ENOSYS`. They are the three a freestanding C library
  needs, and the rest wait on a VFS and a process table.
- Of the 41 syscall numbers in `syscall/dispatch.zig`, 16 are wired on x86_64:
  read, write, open, close, mmap, brk, exit, fork, exec, wait, kill,
  getpid, getppid, nanosleep, clock_gettime, ioctl. The rest return
  `ENOSYS` — sockets, pipes, dup, and most of the directory calls among
  them.
- No SMP on either architecture. One CPU; the others are parked in the
  boot stub.
- No disk. tmpfs is the root filesystem and there is nothing under it.

## Layout

```
kernel/
├── boot/
│   ├── start.S             x86 multiboot2 entry, switch to long mode
│   ├── multiboot2.zig      boot-info parser
│   ├── fdt.zig             flattened device tree parser (ARM)
│   ├── uefi.zig            UEFI loader stub — nothing calls it
│   ├── linker.ld           x86 higher-half link layout
│   └── linker_aarch64.ld   ARM higher-half link layout
├── arch/x86_64/
│   ├── console.zig         COM1 + optional VGA
│   ├── port.zig  gdt.zig  idt.zig  paging.zig
│   ├── syscall.zig         SYSCALL/SYSRET entry
│   ├── context.zig/.S      thread switch, including CR3 and FPU state
│   ├── fpu.zig             FXSAVE area and a clean initial image
│   └── timer.zig           PIT
├── arch/aarch64/
│   ├── boot.S              Image header, EL2→EL1, MMU on, branch high
│   ├── vectors.S           the 16 exception vectors
│   ├── user.S              enter and leave EL0; the EL0 probe
│   ├── context.zig/.S      kernel thread switch, including the address space
│   ├── vm.zig              physical ↔ kernel-virtual, in one place
│   ├── mmu.zig             translation after the boot stub; cache upkeep
│   ├── paging.zig          per-process TTBR0 page tables
│   ├── trap.zig            trap frame, system calls, faults, user pointers
│   ├── console.zig         PL011
│   ├── gic.zig  timer.zig  fwcfg.zig  ramfb.zig
├── mm/
│   ├── pmm.zig             bitmap page-frame allocator (both architectures)
│   ├── vmm.zig             x86 4-level page tables, AddressSpace
│   └── heap.zig            slab allocator over the pmm
├── sched/
│   ├── process.zig         one Process per address space, many Threads
│   └── scheduler.zig       preemptive priority round-robin
├── syscall/dispatch.zig    syscall number → handler
├── fs/
│   ├── vfs.zig             path resolution, inodes, an FsOps vtable
│   ├── tmpfs.zig           the root filesystem
│   └── devfs.zig procfs.zig — written, unreached
├── loader/
│   ├── elf.zig             ELF64 parser
│   ├── segments.zig        map PT_LOADs into a space — shared by both
│   ├── load.zig            x86_64: page tables, regions, brk
│   └── load_aarch64.zig    aarch64: page tables, I-cache, page ownership
├── drivers/                framebuffer, ps2, pci wired; ahci, virtio_net stubs
├── graphics/
│   ├── fb.zig              architecture-independent drawing surface
│   ├── console.zig         a text console over it — one for both machines
│   └── font8x8.zig         generated from tools/font8x8.txt; do not edit
├── user/
│   ├── init.zig            /bin/clarity-init (x86_64)
│   ├── init_aarch64.zig    /bin/clarity-init (aarch64)
│   ├── clarity_demo.clarity → clarity_demo.c, the compiled Clarity program
│   ├── libc/               a freestanding libc: stdio, string, math, malloc.
│   │                       Portable C, plus three files with an #ifdef in
│   │                       them: sys.c, start.S, setjmp.S
│   └── user.ld             static user link layout, both architectures
├── tools/
│   ├── fb_check.py         boots ARM, screenshots it, reads the text back
│   ├── font8x8.txt         the console font, as 95 glyphs of ASCII art
│   ├── make_font.py        turns that into font8x8.zig, and into a picture
│   └── run_x86.sh          builds the GRUB ISO `zig build run` boots
├── main.zig                x86 entry
├── main_aarch64.zig        ARM entry
└── RUNNING.md              how to build and boot both
```

The `*test.zig` files at the top level (`threadtest`, `preempttest`,
`fputest`, `fstest`, `threadtest_aarch64`) and `initprog.zig` /
`clarityprog.zig` are the boot selftests. They are not a test framework: each one is a thing the kernel
does at boot, printing a marker that CI requires. That is deliberate — a
kernel subsystem that is never executed looks exactly like one that works,
and most of the bugs found in this kernel were in code that had never run.

## Build

Zig 0.13. From this directory:

```sh
zig build              # x86-64  -> zig-out/bin/clarity-kernel
zig build aarch64      # aarch64 -> zig-out/bin/clarity-kernel-aarch64.img
zig build run          # boot the x86-64 kernel (builds a GRUB ISO first)
zig build run-aarch64  # boot the aarch64 kernel, with a screen
```

`RUNNING.md` has the QEMU command lines, what the output should look like,
and the Apple Silicon path.

## Talking to the kernel from Clarity

`stdlib/kernel_abi.clarity` is the source of truth for syscall numbers,
errno values, file mode bits, mmap flags, and signals; the Zig enums in
`syscall/dispatch.zig` and `fs/vfs.zig` carry the same values.

`stdlib/syscall.clarity` is the userspace wrapper. On Linux and macOS it
delegates to the host runtime; the same signatures issue real syscall
instructions when running on ClarityOS.

`stdlib/scheduler.clarity` and `stdlib/vfs.clarity` are pure-state mirrors
of the kernel's scheduler and VFS, so the design contracts (priority
ordering, block and wake, path resolution, tmpfs read/write/truncate) can
be exercised by `stdlib/test_kernel.clarity` without booting QEMU. They
are models, not the kernel: passing them says the design is consistent,
not that the kernel implements it. Only the boot log says that.
