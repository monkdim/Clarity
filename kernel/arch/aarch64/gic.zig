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
//! gigabyte, which mmu.zig already maps Device-nGnRnE, so there is no mapping
//! work here — that was checked rather than assumed.
//!
//! Only what a timer needs is set up. A private peripheral interrupt (PPI)
//! is per-core and needs no routing, which is why there is no GICD_ITARGETSR
//! write below: SGIs and PPIs (INTIDs 0..31) ignore it.

const DIST: u64 = 0x0800_0000;
const CPU: u64 = 0x0801_0000;

// Distributor
const GICD_CTLR: u64 = DIST + 0x000;
const GICD_ISENABLER: u64 = DIST + 0x100; // one bit per INTID
const GICD_IPRIORITYR: u64 = DIST + 0x400; // one byte per INTID

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

    // Priority 0 (highest) for our interrupt. One byte per INTID.
    const id: u64 = intid;
    const prio: *volatile u8 = @ptrFromInt(GICD_IPRIORITYR + id);
    prio.* = 0x00;

    // Enable it: one bit per INTID, 32 to a register.
    const reg = GICD_ISENABLER + (id / 32) * 4;
    mmio_write32(reg, @as(u32, 1) << @intCast(intid % 32));

    mmio_write32(GICD_CTLR, 1);

    mmio_write32(GICC_PMR, 0xF0);
    mmio_write32(GICC_CTLR, 1);
}

/// Which interrupt fired. Every acknowledge must be paired with `end`, or the
/// CPU interface keeps that priority active and delivers nothing further.
pub fn acknowledge() u32 {
    return mmio_read32(GICC_IAR) & 0x3FF;
}

pub fn end(intid: u32) void {
    mmio_write32(GICC_EOIR, intid);
}
