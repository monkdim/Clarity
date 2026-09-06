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
const usermode = @import("usermode.zig");
const threadtest = @import("threadtest.zig");

extern const __kernel_phys_end: u8;

/// Boot info handed up from the loader: memory map, framebuffer, ACPI RSDP.
pub const BootInfo = struct {
    memory_map: []const multiboot.MemoryMapEntry,
    framebuffer: ?multiboot.Framebuffer,
    rsdp: ?u64,
    cmdline: []const u8,
};

/// Entry point invoked by the boot stub. The stub switched to long mode,
/// mapped the identity/HHDM/kernel windows, loaded a flat GDT, and passed
/// the raw multiboot2 info blob pointer (physical, identity-mapped) in the
/// first C argument register.
pub export fn kernel_main(mb_info_phys: u64) callconv(.C) noreturn {
    console.init();
    console.println("ClarityOS micro-kernel starting...");

    // 1. CPU structures
    gdt.init();
    idt.init();
    console.println("  [ok] GDT + IDT");

    // Parse the multiboot2 info blob into a BootInfo. Allocator-free, so
    // the memory map aliases the firmware-supplied table — it must be
    // consumed by pmm before we repurpose low memory.
    const parsed = multiboot.ParsedBootInfo.parse(@ptrFromInt(mb_info_phys), null) catch {
        console.println("PANIC: multiboot2 info parse failed");
        hang();
    };
    const boot_info = BootInfo{
        .memory_map = parsed.memory_map,
        .framebuffer = parsed.framebuffer,
        .rsdp = parsed.rsdp_v2 orelse parsed.rsdp_v1,
        .cmdline = parsed.cmdline,
    };

    // Boot-layout diagnostics. The multiboot info blob is handed to us by
    // the loader, which reserves the kernel's file image but not its .bss;
    // if the blob lands inside .bss, pmm's bitmap memset would shred the
    // memory map we are about to read. Report the geometry so the boot log
    // proves whether they overlap.
    console.print("  mbi=");
    console.print_hex(mb_info_phys);
    console.print(" kernel_end=");
    console.print_hex(@intFromPtr(&__kernel_phys_end));
    console.print(" mmap_entries=");
    console.print_dec(boot_info.memory_map.len);
    console.println("");

    // 2. Memory: physical page allocator over the boot memory map,
    //    then a clean page-table tree owned by the kernel, then a
    //    slab allocator for kernel objects.
    pmm.init(boot_info.memory_map);
    console.println("  .. pmm ok");
    vmm.init();
    console.println("  .. vmm ok");
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
    drivers.init(&boot_info) catch |err| {
        console.print("PANIC: driver init failed: ");
        console.println(@errorName(err));
        hang();
    };
    console.println("  [ok] drivers");

    console.println("ClarityOS ready.");

    // 7. Kernel threads. The context switch had never executed — the call
    //    that would have used it was commented out — so this runs before
    //    anything is built on top of it.
    threadtest.run() catch |err| {
        console.print("PANIC: kernel thread self-test: ");
        console.println(@errorName(err));
        hang();
    };

    // 8. Leave ring 0 for the first time.
    //
    //    This runs before spawn_user because everything spawn_user needs — an
    //    ELF loader, a per-process address space, the scheduler's user path —
    //    rests on the CPU being able to reach ring 3 and come back through
    //    the syscall trampoline, and nothing had ever tested that. The
    //    self-test does it with nothing else in the way: a few mapped pages
    //    and a program that writes a line and exits. Its two markers are what
    //    the boot gate checks.
    usermode.run_first_user_program() catch |err| {
        console.print("PANIC: first user program: ");
        console.println(@errorName(err));
        hang();
    };

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
