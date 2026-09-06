//! AArch64 MMU bring-up for EL1.
//!
//! The kernel starts with the MMU off, so every access is physical and
//! strongly ordered. Turning the MMU on is what makes normal memory
//! cacheable (and is a prerequisite for user/kernel separation later), but
//! it is also the single easiest way to kill the machine: get the
//! attributes or the translation setup wrong and the very next instruction
//! fetch faults, with no console left to say so.
//!
//! This first stage keeps the mapping deliberately trivial and identity:
//! a 39-bit VA space (T0SZ = 25) with 4 KiB granule, described entirely by
//! two level-1 1 GiB block descriptors —
//!
//!   [0] 0x0000_0000..0x4000_0000  Device-nGnRnE   (PL011 UART lives at 0x0900_0000)
//!   [1] 0x4000_0000..0x8000_0000  Normal write-back (QEMU virt RAM)
//!
//! Identity mapping means execution continues at the same addresses the
//! instant translation is enabled, so there is no trampoline to get wrong.
//! Higher-half kernel mapping and per-process TTBR0 spaces come later.

const console = @import("console.zig");

/// Level-1 table: 512 entries, each describing 1 GiB. 4 KiB aligned as the
/// architecture requires for a translation table base.
var l1_table: [512]u64 align(4096) = [_]u64{0} ** 512;

// Descriptor bits (block entry at level 1).
const DESC_BLOCK: u64 = 0b01; // valid + block (not table)
const DESC_AF: u64 = 1 << 10; // access flag; without it every access faults
const SH_INNER: u64 = 0b11 << 8; // inner shareable
const AP_RW_EL1: u64 = 0b00 << 6; // read/write at EL1, no EL0 access

// MAIR_EL1 attribute slots.
const ATTR_DEVICE_IDX: u64 = 0;
const ATTR_NORMAL_IDX: u64 = 1;
const MAIR_VALUE: u64 = (0x00 << 0) | (0xFF << 8); // Device-nGnRnE, Normal WB RW-alloc

fn block_desc(phys: u64, attr_idx: u64, shareable: u64) u64 {
    return phys | DESC_AF | shareable | AP_RW_EL1 | (attr_idx << 2) | DESC_BLOCK;
}

/// TCR_EL1: 39-bit VA (T0SZ 25), 4 KiB granule, walks cacheable and inner
/// shareable, TTBR1 disabled (nothing is mapped in the high half yet),
/// 40-bit intermediate physical addresses.
fn tcr_value() u64 {
    const T0SZ: u64 = 25;
    const IRGN0: u64 = 0b01 << 8; // walk: write-back write-allocate
    const ORGN0: u64 = 0b01 << 10;
    const SH0: u64 = 0b11 << 12; // inner shareable
    const TG0: u64 = 0b00 << 14; // 4 KiB granule
    const EPD1: u64 = 1 << 23; // no TTBR1 walks
    const IPS: u64 = 0b010 << 32; // 40-bit PA
    return T0SZ | IRGN0 | ORGN0 | SH0 | TG0 | EPD1 | IPS;
}

/// Build the tables and switch translation on. Identity-mapped, so control
/// flow is unaffected — if this returns, the MMU is live.
pub fn init() void {
    l1_table[0] = block_desc(0x0000_0000, ATTR_DEVICE_IDX, 0); // MMIO: not shareable
    l1_table[1] = block_desc(0x4000_0000, ATTR_NORMAL_IDX, SH_INNER); // RAM

    asm volatile (
        \\dsb sy
        \\isb
        ::: "memory");

    asm volatile (
        \\msr mair_el1, %[mair]
        \\msr tcr_el1,  %[tcr]
        \\msr ttbr0_el1, %[ttbr]
        \\isb
        :
        : [mair] "r" (MAIR_VALUE),
          [tcr] "r" (tcr_value()),
          [ttbr] "r" (@intFromPtr(&l1_table)),
        : "memory"
    );

    // Invalidate stale translations before anything can be cached, then
    // enable translation (M), the data cache (C) and the instruction
    // cache (I) together.
    asm volatile (
        \\tlbi vmalle1
        \\dsb nsh
        \\isb
        \\mrs x0, sctlr_el1
        \\orr x0, x0, #(1 << 0)
        \\orr x0, x0, #(1 << 2)
        \\orr x0, x0, #(1 << 12)
        \\msr sctlr_el1, x0
        \\isb
        ::: "x0", "memory");
}

/// True once translation is enabled — read back from SCTLR_EL1 rather than
/// assumed, so the boot log reports what the hardware actually did.
pub fn enabled() bool {
    const sctlr = asm volatile ("mrs %[out], sctlr_el1"
        : [out] "=r" (-> u64),
    );
    return (sctlr & 1) != 0;
}

pub fn report() void {
    console.print("  [ok] MMU on (identity, 39-bit VA) sctlr.M=");
    console.print_dec(if (enabled()) 1 else 0);
    console.println("");
}
