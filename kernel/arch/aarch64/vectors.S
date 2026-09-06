// AArch64 exception vector table for EL1.
//
// VBAR_EL1 points at a 2 KiB-aligned table of 16 entries, each exactly
// 128 bytes: four groups (current EL with SP0, current EL with SPx, lower
// EL in AArch64, lower EL in AArch32) times four kinds (synchronous, IRQ,
// FIQ, SError).
//
// Fifteen entries report and halt: a fault reaching one of those is a bug,
// and printing what happened beats spinning silently — the same reasoning
// behind populating all 256 x86 IDT gates.
//
// The sixteenth is real. "Current EL with SPx, IRQ" is where the generic
// timer arrives, so it saves the caller-saved registers, calls into Zig, and
// returns with `eret` rather than halting. It has to save x0-x18 and x30
// itself: this is not a function the compiler knows about, it is an entry the
// CPU jumps to with the interrupted code's registers still live, and an
// AAPCS64 callee is free to clobber every one of them.

.macro VEC_ENTRY kind
.align 7                        // each vector entry occupies 2^7 = 128 bytes
    mov     x0, #\kind
    mrs     x1, esr_el1         // syndrome: what happened
    mrs     x2, elr_el1         // faulting instruction address
    mrs     x3, far_el1         // faulting virtual address
    b       aarch64_exception
.endm

// An IRQ that is handled rather than reported. x0-x18 are the caller-saved
// set; x30 is the link register, which `bl` is about to overwrite. Pushed in
// pairs because stp/ldp need the stack 16-byte aligned, which SP_EL1 is.
.macro IRQ_ENTRY
.align 7
    stp     x0, x1, [sp, #-16]!
    stp     x2, x3, [sp, #-16]!
    stp     x4, x5, [sp, #-16]!
    stp     x6, x7, [sp, #-16]!
    stp     x8, x9, [sp, #-16]!
    stp     x10, x11, [sp, #-16]!
    stp     x12, x13, [sp, #-16]!
    stp     x14, x15, [sp, #-16]!
    stp     x16, x17, [sp, #-16]!
    stp     x18, x30, [sp, #-16]!
    bl      aarch64_irq
    ldp     x18, x30, [sp], #16
    ldp     x16, x17, [sp], #16
    ldp     x14, x15, [sp], #16
    ldp     x12, x13, [sp], #16
    ldp     x10, x11, [sp], #16
    ldp     x8, x9, [sp], #16
    ldp     x6, x7, [sp], #16
    ldp     x4, x5, [sp], #16
    ldp     x2, x3, [sp], #16
    ldp     x0, x1, [sp], #16
    eret
.endm

.section .text
.align 11                       // VBAR_EL1 requires 2^11 = 2048-byte alignment
.global aarch64_vectors
aarch64_vectors:
    // Current EL with SP0
    VEC_ENTRY 0                 // synchronous
    VEC_ENTRY 1                 // IRQ
    VEC_ENTRY 2                 // FIQ
    VEC_ENTRY 3                 // SError
    // Current EL with SPx — the kernel's own IRQs arrive at entry 5.
    VEC_ENTRY 4
    IRQ_ENTRY
    VEC_ENTRY 6
    VEC_ENTRY 7
    // Lower EL, AArch64
    VEC_ENTRY 8
    VEC_ENTRY 9
    VEC_ENTRY 10
    VEC_ENTRY 11
    // Lower EL, AArch32
    VEC_ENTRY 12
    VEC_ENTRY 13
    VEC_ENTRY 14
    VEC_ENTRY 15
