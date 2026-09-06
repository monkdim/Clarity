//! ClarityOS aarch64 kernel entry.
//!
//! First milestone of the Apple-Silicon-class AArch64 port: come up at
//! EL1 on QEMU's `virt` machine, bring the PL011 console online, and
//! report a verifiable boot marker over serial.
//!
//! The x86_64 kernel (main.zig) owns the mature path — memory manager,
//! scheduler, syscalls, VFS, drivers. Those subsystems are largely
//! architecture-neutral Zig, but they reach into x86-only pieces today
//! (port I/O, GDT/IDT, 4-level x86 paging), so they are brought across
//! one phase at a time rather than in one risky move. This entry point
//! grows as each is made architecture-clean.

const std = @import("std");
const console = @import("arch/aarch64/console.zig");

/// Entry point called by the boot stub (arch/aarch64/boot.S) once the CPU
/// is at EL1 with a stack and a zeroed .bss. `dtb_phys` is the device tree
/// pointer QEMU leaves in x0; recorded now, consumed by the memory phase.
export fn kernel_main_aarch64(dtb_phys: u64) callconv(.C) noreturn {
    _ = dtb_phys;

    console.init();
    console.println("ClarityOS aarch64 micro-kernel starting...");
    console.println("  [ok] EL1 + PL011 UART");
    console.println("ClarityOS aarch64: EL1 boot ok");

    hang();
}

fn hang() noreturn {
    while (true) {
        asm volatile ("wfe");
    }
}

/// Freestanding targets need an explicit panic handler.
pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    console.print("\n\nKERNEL PANIC (aarch64): ");
    console.println(msg);
    hang();
}
