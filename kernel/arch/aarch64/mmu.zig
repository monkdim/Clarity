//! AArch64 translation, after the boot stub has turned it on.
//!
//! The dangerous part of MMU bring-up — building a table and enabling
//! translation while executing out of the memory being remapped — happens in
//! arch/aarch64/boot.S, before any Zig runs, because a Zig function linked
//! for high virtual addresses cannot safely execute at physical ones: every
//! global it touches resolves to an address that is not mapped yet.
//!
//! What the stub leaves behind is a single level-1 table of 1 GiB blocks,
//! installed in both TTBR0_EL1 and TTBR1_EL1, describing exactly two things:
//!
//!   [0]   0x0000_0000..0x4000_0000  Device-nGnRnE   (UART, GIC, fw_cfg)
//!   [k]   the gigabyte the kernel was loaded into, Normal write-back
//!
//! One table can serve both registers because a kernel virtual address is
//! its physical address plus 0xFFFF_FF80_0000_0000, and that base is the
//! first address TTBR1 translates — so a physical address lands on the same
//! level-1 index either way.
//!
//! This file owns what happens next, and it needs information the stub could
//! not have: how much RAM the machine really has (`map_ram`, from the device
//! tree), and when the low half is no longer needed (`drop_identity`).

const console = @import("console.zig");
const vm = @import("vm.zig");

/// The level-1 table, defined in boot.S so it can be filled in before any
/// Zig runs, and placed outside .bss so that zeroing .bss does not erase the
/// table the code doing the zeroing is running on.
extern var aarch64_l1_table: [512]u64;

// Descriptor bits for a level-1 block entry. Must agree with the .set
// directives at the top of boot.S; they are written twice because the stub
// cannot see this file and this file cannot see the stub's assembler symbols.
const DESC_BLOCK: u64 = 0b01; // valid + block (not a table pointer)
const DESC_AF: u64 = 1 << 10; // access flag; without it every access faults
const SH_INNER: u64 = 0b11 << 8; // inner shareable
const AP_RW_EL1: u64 = 0b00 << 6; // read/write at EL1, no EL0 access
const ATTR_NORMAL_IDX: u64 = 1; // MAIR slot 1: Normal write-back

const GIB: u64 = 1 << 30;

fn normal_block(phys: u64) u64 {
    return phys | DESC_AF | SH_INNER | AP_RW_EL1 | (ATTR_NORMAL_IDX << 2) | DESC_BLOCK;
}

/// Publish table edits and drop every cached translation.
///
/// The stores above go through the same cacheable, inner-shareable
/// attributes the table walker is configured to use, so no cache maintenance
/// is needed here — unlike in the boot stub, where the MMU was still off and
/// the stores were not cacheable at all.
fn publish() void {
    asm volatile (
        \\dsb ishst
        \\tlbi vmalle1is
        \\dsb ish
        \\isb
        ::: "memory");
}

/// Extend the direct map to cover every gigabyte the device tree reported as
/// memory.
///
/// The boot stub could only map the gigabyte it found itself in, because it
/// ran before anything had read the machine's description. On a `virt` with
/// 1 GiB of RAM that is already the whole of it and this adds nothing; on a
/// machine with more, every page the allocator hands out above the first
/// gigabyte would otherwise be an address the kernel cannot touch — a
/// translation fault on first use, not a wrong answer, but only because the
/// low half happens to be gone.
///
/// Returns how many gigabytes were newly mapped. Blocks already described
/// are left alone, which is what keeps this from overwriting the device
/// block at index 0 on a machine whose memory node starts below 1 GiB.
pub fn map_ram(regions: []const Region) usize {
    var added: usize = 0;
    for (regions) |r| {
        if (r.len == 0) continue;
        var g = r.base / GIB;
        const last = (r.base + r.len - 1) / GIB;
        while (g <= last) : (g += 1) {
            if (g >= aarch64_l1_table.len) break; // beyond a 39-bit VA space
            if (aarch64_l1_table[g] != 0) continue;
            aarch64_l1_table[g] = normal_block(g * GIB);
            added += 1;
        }
    }
    if (added != 0) publish();
    return added;
}

/// What `map_ram` needs to know about a region. Structurally identical to
/// boot/fdt.Region; declared here so this module does not depend on where
/// the caller learned about memory — the x86 side would pass a multiboot
/// map through the same door.
pub const Region = struct {
    base: u64,
    len: u64,
};

/// Stop translating the low half of the address space.
///
/// Until now the same table has been installed in both TTBR0 and TTBR1, so
/// every physical address has also been a valid virtual one and any missed
/// conversion would have silently worked. Disabling TTBR0 walks makes that
/// impossible: from here a physical address dereferenced by mistake is a
/// translation fault at the point of the mistake.
///
/// It is also the whole point of the exercise. TTBR0 is the register the
/// hardware switches per process; a kernel that still needs it for itself
/// cannot hand it to userland.
pub fn drop_identity() void {
    asm volatile (
        \\mrs x0, tcr_el1
        \\orr x0, x0, #(1 << 7)
        \\msr tcr_el1, x0
        \\msr ttbr0_el1, xzr
        \\isb
        \\tlbi vmalle1is
        \\dsb ish
        \\isb
        ::: "x0", "memory");
}

/// Run a real stage-1 translation through the MMU and report what came back.
///
/// `at s1e1w` asks the hardware the same question a store would — what does
/// this virtual address mean at EL1, for a write — and puts the answer in
/// PAR_EL1 without performing the access. Null means it faulted.
///
/// This is the difference between reporting a bit and reporting a fact. A
/// kernel can set TCR_EL1.EPD0 and read it back all day; whether the low half
/// is actually untranslated is a question only the translation hardware can
/// answer, and answering it by dereferencing a low address would answer it by
/// crashing.
pub fn translate(virt: u64) ?u64 {
    const par = asm volatile (
        \\at s1e1w, %[va]
        \\isb
        \\mrs %[out], par_el1
        : [out] "=r" (-> u64),
        : [va] "r" (virt),
        : "memory"
    );
    // PAR_EL1.F (bit 0) set means the translation faulted; otherwise bits
    // [51:12] hold the physical page and the offset comes from the input.
    if (par & 1 != 0) return null;
    return (par & 0x000F_FFFF_FFFF_F000) | (virt & 0xFFF);
}

/// The same question, asked as EL0 would ask it: `at s1e0r` and `at s1e0w`
/// run a stage-1 translation with unprivileged read and write permissions.
///
/// This is how a kernel checks a process's address space without running the
/// process, and without dereferencing the address itself — which it must not
/// do anyway, because PSTATE.PAN makes an EL1 access to EL0-accessible memory
/// fault on any core that implements it. A page mapped read-only for
/// userland translates under `user_read` and faults under `user_write`, which
/// is the difference no amount of reading the descriptor back can prove.
pub fn translate_user_read(virt: u64) ?u64 {
    const par = asm volatile (
        \\at s1e0r, %[va]
        \\isb
        \\mrs %[out], par_el1
        : [out] "=r" (-> u64),
        : [va] "r" (virt),
        : "memory"
    );
    if (par & 1 != 0) return null;
    return (par & 0x000F_FFFF_FFFF_F000) | (virt & 0xFFF);
}

pub fn translate_user_write(virt: u64) ?u64 {
    const par = asm volatile (
        \\at s1e0w, %[va]
        \\isb
        \\mrs %[out], par_el1
        : [out] "=r" (-> u64),
        : [va] "r" (virt),
        : "memory"
    );
    if (par & 1 != 0) return null;
    return (par & 0x000F_FFFF_FFFF_F000) | (virt & 0xFFF);
}

/// True once the low half is no longer translated — read back from TCR_EL1
/// rather than assumed, so the boot log reports what the hardware did.
pub fn identity_dropped() bool {
    const tcr = asm volatile ("mrs %[out], tcr_el1"
        : [out] "=r" (-> u64),
    );
    return (tcr & (1 << 7)) != 0;
}

/// True once translation is enabled — read back from SCTLR_EL1.
pub fn enabled() bool {
    const sctlr = asm volatile ("mrs %[out], sctlr_el1"
        : [out] "=r" (-> u64),
    );
    return (sctlr & 1) != 0;
}

/// Where this code is actually executing. Taken from the program counter, so
/// it is evidence rather than a restatement of the linker script: if the
/// branch into the high mapping had not happened, this would print a low
/// address and the marker would be a lie that is visible.
fn here() u64 {
    return asm volatile ("adr %[out], ."
        : [out] "=r" (-> u64),
    );
}

pub fn report() void {
    console.print("  [ok] MMU on (39-bit VA, direct map at ");
    console.print_hex(vm.KERNEL_VA_BASE);
    console.print(") sctlr.M=");
    console.print_dec(if (enabled()) 1 else 0);
    console.print(" pc=");
    console.print_hex(here());
    console.println("");
}
