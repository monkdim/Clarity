//! ClarityOS micro-kernel — main entry point.
//!
//! The bootloader hands control here once paging is set up and the
//! machine is in long mode. From here we initialise memory, set up
//! the scheduler, mount the root filesystem, then jump into the
//! Clarity userspace runtime.
//!
//! This is the only non-Clarity code in the OS. Everything above
//! `userspace_start()` runs as Clarity.

const std = @import("std");
const console = @import("arch/x86_64/console.zig");
const gdt = @import("arch/x86_64/gdt.zig");
const idt = @import("arch/x86_64/idt.zig");
const paging = @import("arch/x86_64/paging.zig");
const pmm = @import("mm/pmm.zig");
const vmm = @import("mm/vmm.zig");
const heap = @import("mm/heap.zig");
const sched = @import("sched/scheduler.zig");
const syscall = @import("syscall/dispatch.zig");
const vfs = @import("fs/vfs.zig");
const tmpfs = @import("fs/tmpfs.zig");
const drivers = @import("drivers/init.zig");
const multiboot = @import("boot/multiboot2.zig");

/// Boot info handed up from the loader: memory map, framebuffer, ACPI RSDP.
pub const BootInfo = struct {
    memory_map: []const multiboot.MemoryMapEntry,
    framebuffer: ?multiboot.Framebuffer,
    rsdp: ?u64,
    cmdline: []const u8,
};

/// Entry point invoked by the boot stub. The boot stub has already
/// switched to long mode, set up an identity-mapped page table, and
/// loaded a flat GDT. It hands us a parsed BootInfo.
pub export fn kernel_main(boot_info: *const BootInfo) callconv(.C) noreturn {
    console.init();
    console.println("ClarityOS micro-kernel starting...");

    // 1. CPU structures
    gdt.init();
    idt.init();
    console.println("  [ok] GDT + IDT");

    // 2. Memory: physical page allocator over the boot memory map,
    //    then a clean page-table tree owned by the kernel, then a
    //    slab allocator for kernel objects.
    pmm.init(boot_info.memory_map);
    vmm.init();
    heap.init();
    console.println("  [ok] memory: pmm + vmm + heap");

    // 3. Scheduler: idle thread + kernel-thread runqueue.
    sched.init();
    console.println("  [ok] scheduler");

    // 4. Syscall surface. Wires the SYSCALL/SYSRET MSRs and the
    //    int 0x80 fallback to the dispatch table.
    syscall.init();
    console.println("  [ok] syscalls");

    // 5. VFS + tmpfs as the root filesystem.
    vfs.init();
    tmpfs.mount_root() catch |err| {
        console.print("PANIC: tmpfs mount failed: ");
        console.println(@errorName(err));
        hang();
    };
    console.println("  [ok] vfs + rootfs");

    // 6. Drivers: console, framebuffer, PS/2 keyboard + mouse, storage.
    drivers.init(boot_info) catch |err| {
        console.print("PANIC: driver init failed: ");
        console.println(@errorName(err));
        hang();
    };
    console.println("  [ok] drivers");

    // 7. Hand off to userspace. The first user process is the
    //    Clarity runtime executing /init.clarity. Schedule it and
    //    drop into the dispatch loop; we never come back.
    console.println("ClarityOS ready.");
    _ = sched.spawn_kthread(idle_loop, "[idle]", .idle) catch unreachable;
    _ = sched.spawn_user("/bin/clarity-init") catch |err| {
        console.print("PANIC: spawn /bin/clarity-init: ");
        console.println(@errorName(err));
        hang();
    };

    sched.run();
    unreachable;
}

fn idle_loop() noreturn {
    while (true) {
        asm volatile ("hlt");
    }
}

fn hang() noreturn {
    while (true) {
        asm volatile ("cli; hlt");
    }
}

/// The Zig panic handler runs when a programming invariant is
/// violated (slice OOB, integer overflow with checked semantics,
/// `unreachable`, etc). We dump the message, stop scheduling, and
/// halt.
pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    console.print("\n\nKERNEL PANIC: ");
    console.println(msg);
    sched.freeze();
    hang();
}
