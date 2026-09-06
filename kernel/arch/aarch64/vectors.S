// AArch64 exception vector table for EL1.
//
// VBAR_EL1 points at a 2 KiB-aligned table of 16 entries, each exactly
// 128 bytes: four groups (current EL with SP0, current EL with SPx, lower
// EL in AArch64, lower EL in AArch32) times four kinds (synchronous, IRQ,
// FIQ, SError).
//
// Every entry reports and halts. Nothing in the kernel generates IRQs yet,
// so a fault reaching here is a bug, and the useful behaviour is to print
// what happened rather than to spin silently — the same reasoning behind
// populating all 256 x86 IDT gates. When the ARM kernel grows real
// interrupt sources, the IRQ entries gain a save/restore path and `eret`.

.macro VEC_ENTRY kind
.align 7                        // each vector entry occupies 2^7 = 128 bytes
    mov     x0, #\kind
    mrs     x1, esr_el1         // syndrome: what happened
    mrs     x2, elr_el1         // faulting instruction address
    mrs     x3, far_el1         // faulting virtual address
    b       aarch64_exception
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
    // Current EL with SPx
    VEC_ENTRY 4
    VEC_ENTRY 5
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
