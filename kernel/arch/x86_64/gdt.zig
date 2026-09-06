//! Global Descriptor Table — flat 64-bit code/data segments + TSS.
//!
//! The selector *order* here is not free. SYSRET reconstructs the user
//! selectors from IA32_STAR[63:48] by fixed offsets — SS from base+8 and CS
//! from base+16 — so the user data descriptor must sit immediately before the
//! user code descriptor, which is the reverse of the intuitive
//! code-then-data order used for ring 0. Getting it wrong does not fail
//! loudly: SYSRET loads a code descriptor into SS and #GPs on the way out of
//! the kernel.
//!
//! The TSS is what supplies RSP0, the stack the CPU switches to when an
//! interrupt arrives while the CPU is in ring 3. Without it the first timer
//! tick taken in userspace has nowhere to push its frame and the machine
//! triple-faults.

const std = @import("std");

/// Segment selectors. The low two bits are the requested privilege level.
pub const KERNEL_CODE: u16 = 0x08;
pub const KERNEL_DATA: u16 = 0x10;
pub const USER_DATA: u16 = 0x18 | 3;
pub const USER_CODE: u16 = 0x20 | 3;
pub const TSS_SELECTOR: u16 = 0x28;

/// Base of the user selector pair as SYSRET wants it in IA32_STAR[63:48]:
/// SS = STAR[63:48] + 8, CS = STAR[63:48] + 16.
pub const STAR_USER_BASE: u16 = 0x10;

/// x86-64 Task State Segment, as a raw 32-bit word array rather than a
/// struct.
///
/// The architectural layout puts RSP0 at byte offset 4 — deliberately *not*
/// 8-byte aligned. An `extern struct` with a u32 followed by a u64 obeys C
/// rules and pads RSP0 to offset 8, so the CPU would read four bytes of
/// padding as the top half of the stack pointer and push the interrupt frame
/// somewhere meaningless. Writing the words by index removes the question.
///
///   [0]      reserved
///   [1..2]   rsp0 (low, high)
///   [3..6]   rsp1, rsp2
///   [7..8]   reserved
///   [9..22]  ist1..ist7
///   [23..24] reserved
///   [25]     reserved (low 16 bits) | iomap_base (high 16 bits)
const TSS_WORDS = 26;
const TSS_RSP0_LO = 1;
const TSS_RSP0_HI = 2;
const TSS_IOMAP = 25;

var tss: [TSS_WORDS]u32 align(16) = [_]u32{0} ** TSS_WORDS;

/// Stack the CPU switches to on a ring 3 → ring 0 interrupt.
var kernel_interrupt_stack: [16 * 1024]u8 align(16) = undefined;

/// Two extra slots because a 64-bit TSS descriptor is 16 bytes.
var gdt: [7]u64 align(16) = undefined;
var gdtr: packed struct { limit: u16, base: u64 } = undefined;

pub fn init() void {
    gdt[0] = 0;
    gdt[1] = descriptor(0x9A, 0xA); // 64-bit code, ring 0  -> 0x08
    gdt[2] = descriptor(0x92, 0xC); // 64-bit data, ring 0  -> 0x10
    gdt[3] = descriptor(0xF2, 0xC); // 64-bit data, ring 3  -> 0x18
    gdt[4] = descriptor(0xFA, 0xA); // 64-bit code, ring 3  -> 0x20

    set_kernel_stack(@intFromPtr(&kernel_interrupt_stack) + kernel_interrupt_stack.len);
    // iomap_base past the end of the segment: no I/O permission bitmap.
    tss[TSS_IOMAP] = @as(u32, TSS_WORDS * 4) << 16;

    const tss_base = @intFromPtr(&tss);
    const tss_limit: u64 = TSS_WORDS * 4 - 1;
    // Type 0x9 = available 64-bit TSS; present, DPL 0.
    gdt[5] = (tss_limit & 0xFFFF) |
        ((tss_base & 0xFFFF) << 16) |
        (((tss_base >> 16) & 0xFF) << 32) |
        (@as(u64, 0x89) << 40) |
        (((tss_limit >> 16) & 0xF) << 48) |
        (((tss_base >> 24) & 0xFF) << 56);
    gdt[6] = (tss_base >> 32) & 0xFFFF_FFFF;

    gdtr.limit = @sizeOf(@TypeOf(gdt)) - 1;
    gdtr.base = @intFromPtr(&gdt);
    asm volatile ("lgdt %[gdtr]"
        :
        : [gdtr] "*p" (&gdtr),
    );
    // The ring 0 descriptors at 0x08/0x10 are identical to the ones the boot
    // stub installed, so CS and the data segments stay valid across the load
    // and need no reload here.
    asm volatile ("ltr %[sel]"
        :
        : [sel] "r" (TSS_SELECTOR),
    );
}

/// Update the stack the CPU will use for the next ring 3 → ring 0 transition.
/// The scheduler calls this when switching to a thread that can enter user
/// mode, since each such thread needs its own kernel stack.
pub fn set_kernel_stack(top: u64) void {
    tss[TSS_RSP0_LO] = @truncate(top);
    tss[TSS_RSP0_HI] = @truncate(top >> 32);
}

pub fn kernel_stack_top() u64 {
    return (@as(u64, tss[TSS_RSP0_HI]) << 32) | tss[TSS_RSP0_LO];
}

/// A flat segment descriptor: base 0, limit 0, `access` and `flags` as the
/// architecture defines them (flags occupy bits 52..55 — AVL, L, D/B, G).
fn descriptor(access: u8, flags: u4) u64 {
    return (@as(u64, access) << 40) | (@as(u64, flags) << 52);
}
