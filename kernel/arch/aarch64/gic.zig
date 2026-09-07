//! GICv2 — the interrupt controller on QEMU's `virt` machine.
//!
//! The exception vectors have been installed since the ARM kernel first
//! booted, and until now nothing could ever reach them: no interrupt source
//! existed, so every one of the sixteen entries reported and halted. This is
//! the first half of giving them something real to do (the timer is the
//! other), and it is the same gap the x86 side had — a complete-looking
//! `timer.zig` that nothing called.
//!
//! Two register blocks. The *distributor* decides which interrupts exist and
//! where they go; the *CPU interface* is what this core reads to find out
//! which one fired and to say it has finished. Both are inside the first
//! gigabyte, which the boot stub already maps Device-nGnRnE, so there is no
//! mapping work here — that was checked rather than assumed.
//!
//! A private peripheral interrupt (PPI) is per-core and needs no routing;
//! a shared one (SPI) does, and gets it. What is deliberately *not* set is
//! GICD_ICFGR, which says whether an interrupt is edge- or level-triggered:
//! the reset configuration is left alone, and the keyboard test is what says
//! whether events keep arriving past the first one. Writing a guess there
//! would make that test pass or fail for a reason nothing had checked.

const vm = @import("vm.zig");

/// Both blocks are inside the first gigabyte, which the boot stub maps
/// Device-nGnRnE — reached, like every other physical address the kernel
/// touches, through the direct map rather than directly.
const DIST: u64 = 0x0800_0000 + vm.KERNEL_VA_BASE;
const CPU: u64 = 0x0801_0000 + vm.KERNEL_VA_BASE;

// Distributor
const GICD_CTLR: u64 = DIST + 0x000;
const GICD_ISENABLER: u64 = DIST + 0x100; // one bit per INTID
const GICD_IPRIORITYR: u64 = DIST + 0x400; // one byte per INTID
const GICD_ITARGETSR: u64 = DIST + 0x800; // one byte per INTID: which cores

// CPU interface
const GICC_CTLR: u64 = CPU + 0x000;
const GICC_PMR: u64 = CPU + 0x004; // priority mask
const GICC_IAR: u64 = CPU + 0x00C; // acknowledge: read the pending INTID
const GICC_EOIR: u64 = CPU + 0x010; // end of interrupt

/// Returned by `acknowledge` when the interrupt was spurious. The GIC uses
/// 1023 for this, and it must not be passed to `end`.
pub const SPURIOUS: u32 = 1023;

fn mmio_write32(addr: u64, value: u32) void {
    const p: *volatile u32 = @ptrFromInt(addr);
    p.* = value;
}

fn mmio_read32(addr: u64) u32 {
    const p: *volatile u32 = @ptrFromInt(addr);
    return p.*;
}

/// Bring the controller up and enable one interrupt.
///
/// The priority mask matters more than it looks: it starts at 0, which masks
/// *everything*, so a GIC that is otherwise configured correctly delivers
/// nothing at all. 0xF0 lets every priority through.
pub fn init(intid: u32) void {
    // Distributor off while it is configured, then on.
    mmio_write32(GICD_CTLR, 0);
    configure(intid);
    mmio_write32(GICD_CTLR, 1);

    mmio_write32(GICC_PMR, 0xF0);
    mmio_write32(GICC_CTLR, 1);
}

/// Let one more interrupt through, after `init` has run.
///
/// Separate from `init` rather than a second call to it, because init turns
/// the distributor off and on again: doing that to add a second source would
/// briefly stop delivering the first, and a timer that misses a tick during
/// device probing is a hang waiting to happen.
pub fn enable(intid: u32) void {
    configure(intid);
}

/// Everything that is per-interrupt rather than per-controller.
fn configure(intid: u32) void {
    const id: u64 = intid;

    // Priority 0 (highest). One byte per INTID.
    const prio: *volatile u8 = @ptrFromInt(GICD_IPRIORITYR + id);
    prio.* = 0x00;

    // Routing. SGIs and PPIs (0..31) are per-core and ignore this register —
    // writes to those bytes are architecturally reserved, so they are not
    // made. An SPI is routed by the distributor, and on a GIC with more than
    // one CPU interface it reaches nobody until this says which.
    //
    // Nothing here proves that. It was tested by removing this write and
    // running the keyboard gate, which passed: QEMU's `virt` with one vCPU
    // builds a uniprocessor GICv2, where GICD_ITARGETSR is RAZ/WI and the
    // only CPU interface gets the interrupt either way. So this is written
    // because the architecture requires it of a multi-core GIC and this
    // kernel will meet one, not because anything on this machine noticed —
    // and it is said plainly rather than left to look verified.
    if (intid >= 32) {
        const target: *volatile u8 = @ptrFromInt(GICD_ITARGETSR + id);
        target.* = 0x01; // CPU interface 0, the only core that is running
    }

    // Enable it: one bit per INTID, 32 to a register.
    //
    // GICD_ISENABLER is write-1-to-set: the bits written as zero are left
    // alone, so this adds an interrupt rather than replacing the set. A
    // read-modify-write would be wrong as well as unnecessary — it would
    // re-write bits the hardware may have changed underneath.
    const reg = GICD_ISENABLER + (id / 32) * 4;
    mmio_write32(reg, @as(u32, 1) << @intCast(intid % 32));
}

/// Which interrupt fired. Every acknowledge must be paired with `end`, or the
/// CPU interface keeps that priority active and delivers nothing further.
pub fn acknowledge() u32 {
    return mmio_read32(GICC_IAR) & 0x3FF;
}

pub fn end(intid: u32) void {
    mmio_write32(GICC_EOIR, intid);
}
