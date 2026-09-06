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
const timer = @import("arch/aarch64/timer.zig");
const mmu = @import("arch/aarch64/mmu.zig");

/// Entry point called by the boot stub (arch/aarch64/boot.S) once the CPU
/// is at EL1 with a stack and a zeroed .bss. `dtb_phys` is the device tree
/// pointer QEMU leaves in x0; recorded now, consumed by the memory phase.
export fn kernel_main_aarch64(dtb_phys: u64) callconv(.C) noreturn {
    _ = dtb_phys;

    console.init();
    console.println("ClarityOS aarch64 micro-kernel starting...");
    console.println("  [ok] EL1 + PL011 UART");

    install_vectors();
    console.println("  [ok] exception vectors (VBAR_EL1)");

    // Turning translation on is the riskiest step of ARM bring-up: get the
    // attributes wrong and the next instruction fetch faults with no
    // console left to report it. Reaching the line below means the identity
    // map, the device attributes covering the UART, and the cache settings
    // are all correct.
    mmu.init();
    mmu.report();

    // The vectors installed above had never been reached: nothing on this
    // architecture generated an interrupt, so the entire delivery path — GIC,
    // DAIF, the vector entry itself — was untested. On x86 the equivalent gap
    // was hiding a scheduler that picked a thread and never switched to it.
    timer.init(100);
    console.print("  [ok] generic timer armed at 100 Hz, cntfrq=");
    console.print_dec(timer.frequency());
    console.println("");

    timer_selftest();

    console.println("ClarityOS aarch64: EL1 boot ok");

    hang();
}

/// The vector table lives in vectors.S, 2 KiB-aligned as VBAR_EL1 requires.
extern const aarch64_vectors: u8;

/// Prove an interrupt actually arrives.
///
/// The counter is incremented only by the IRQ handler, so reaching WANT is
/// impossible without one really being delivered — the same principle as the
/// x86 preemption test, which two threads could not pass by cooperating.
///
/// Bounded in spins rather than in time, because a deadline measured in timer
/// ticks would wait forever for exactly the thing whose absence it is meant to
/// report. Three ticks rather than one, because the comparator is one-shot: a
/// handler that fires but forgets to re-arm would pass a test that asked for
/// one and fail this.
fn timer_selftest() void {
    const WANT: u64 = 3;
    const SPIN_LIMIT: u64 = 100_000_000;
    var spins: u64 = 0;
    while (timer.ticks() < WANT and spins < SPIN_LIMIT) : (spins += 1) {
        asm volatile ("nop");
    }
    if (timer.ticks() >= WANT) {
        console.print("  [ok] aarch64 timer: interrupts delivered, ticks=");
        console.print_dec(timer.ticks());
        console.println("");
    } else {
        console.print("  [FAIL] aarch64 timer: no interrupt arrived, ticks=");
        console.print_dec(timer.ticks());
        console.println("");
    }
}

/// Called from the IRQ vector entry, which saved the caller-saved integer
/// registers and will `eret` when this returns.
///
/// Condition flags need no saving: `eret` restores PSTATE from SPSR_EL1,
/// which carries NZCV. FP and SIMD registers are *not* saved, which is fine
/// while the only interruptible code is kernel code that does not use them,
/// and is a gap to close before anything with floating point can be
/// preempted.
export fn aarch64_irq() callconv(.C) void {
    timer.handle_irq();
}

fn install_vectors() void {
    asm volatile (
        \\msr vbar_el1, %[table]
        \\isb
        :
        : [table] "r" (@intFromPtr(&aarch64_vectors)),
        : "memory"
    );
}

/// Called from every vector-table entry. `kind` is the entry index (0..15:
/// four groups of sync/IRQ/FIQ/SError), and the syndrome registers say what
/// happened and where. Nothing generates interrupts yet, so anything
/// arriving here is a bug worth reporting rather than silently spinning.
export fn aarch64_exception(kind: u64, esr: u64, elr: u64, far: u64) callconv(.C) noreturn {
    console.print("\n\nAARCH64 EXCEPTION entry=");
    console.print_dec(kind);
    console.print(" esr=");
    console.print_hex(esr);
    console.print(" elr=");
    console.print_hex(elr);
    console.print(" far=");
    console.print_hex(far);
    console.println("");
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
