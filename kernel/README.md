# ClarityOS micro-kernel

The only non-Clarity code in the operating system. About ~10 K lines
of Zig (the target — current skeleton is ~2 K) covering boot, memory
management, scheduling, syscalls, and the small set of drivers
needed to bring up the userspace runtime.

## Layout

```
kernel/
├── boot/
│   ├── start.S            # multiboot2 entry, switch to long mode
│   ├── multiboot2.zig     # header + boot-info parser
│   ├── uefi.zig           # UEFI loader stub
│   └── linker.ld          # higher-half link layout
├── arch/x86_64/
│   ├── console.zig        # VGA + COM1 early console
│   ├── port.zig           # in/out wrappers
│   ├── gdt.zig            # flat 64-bit segments
│   ├── idt.zig            # interrupt vectors + PIC remap
│   └── paging.zig         # CR3 swap + arch hooks
├── mm/
│   ├── pmm.zig            # bitmap page-frame allocator
│   ├── vmm.zig            # 4-level page tables, AddressSpace
│   └── heap.zig           # slab allocator over pmm
├── sched/
│   └── scheduler.zig      # priority round-robin, block/wake/exit
├── syscall/
│   └── dispatch.zig       # SYSCALL entry → handler table
├── fs/
│   ├── vfs.zig            # VFS layer + dentry/inode/file structs
│   └── tmpfs.zig          # in-memory root filesystem
├── drivers/
│   ├── init.zig           # registers all built-in drivers
│   ├── pci.zig            # PCI bus enumeration
│   ├── ps2.zig            # 8042 keyboard + mouse
│   ├── framebuffer.zig    # VESA / GOP linear FB
│   ├── ahci.zig           # SATA storage (skeleton)
│   └── virtio_net.zig     # paravirt NIC for QEMU/KVM (skeleton)
├── main.zig               # kernel_main()
├── build.zig              # Zig build script
└── README.md              # this file
```

## Build

Requires Zig 0.13 or newer. From this directory:

```
zig build              # build zig-out/bin/clarity-kernel
zig build run          # boot the kernel under QEMU (needs qemu-system-x86_64)
```

The kernel image is multiboot2-compliant, so QEMU's `-kernel` flag
loads it directly without any bootloader. UEFI booting goes through
a separate loader binary that lives next to the kernel and shares
the same `kernel_main` contract.

## Talking to the kernel from Clarity

`stdlib/kernel_abi.clarity` is the single source of truth for syscall
numbers, errno values, file mode bits, mmap flags, and signals. The
Zig enums in `syscall/dispatch.zig` and `fs/vfs.zig` keep the same
values so userspace and kernel agree on the wire format.

`stdlib/syscall.clarity` is the userspace wrapper. On Linux/macOS it
delegates to the host runtime (Bun's fs/process APIs). When ClarityOS
is self-hosting, the same call signatures issue real `syscall`
instructions instead — userspace code doesn't change.

`stdlib/scheduler.clarity` and `stdlib/vfs.clarity` are pure-state
mirrors of the kernel scheduler and VFS. They run fully in-process
and let the test suite exercise the design contracts (priority
ordering, block/wake, path resolution, tmpfs read/write/truncate)
without booting QEMU.

## Status (Phase 65)

- Boot stub, paging tables, GDT, IDT: skeleton in place
- Physical + virtual memory, slab heap: skeleton, allocators
  reachable through their public API
- Scheduler: full priority queues + block/wake/exit
- Syscall ABI: 38 calls registered; ~10 wired up (read / write /
  open / close / exit / getpid / nanosleep / clock_gettime). The
  rest return ENOSYS.
- Drivers: PS/2, framebuffer, PCI iter — wired. AHCI + virtio-net:
  scaffolds with NotImplemented bodies. USB HID, NVMe, real Intel
  NICs: deferred to a follow-up phase.
- VFS + tmpfs: scaffolded; tmpfs is functional through the FsOps
  vtable, on-disk filesystems are deferred.

The Clarity-side mirrors (kernel_abi, syscall, scheduler, vfs) are
fully tested in `stdlib/test_kernel.clarity`. The kernel itself
needs a Zig toolchain + QEMU to validate; the build script is
checked in, the structure compiles standalone in any environment
where those are available.
