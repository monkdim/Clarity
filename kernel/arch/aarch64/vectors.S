// AArch64 exception vector table for EL1.
//
// VBAR_EL1 points at a 2 KiB-aligned table of 16 entries, each exactly
// 128 bytes: four groups (current EL with SP0, current EL with SPx, lower
// EL in AArch64, lower EL in AArch32) times four kinds (synchronous, IRQ,
// FIQ, SError).
//
// Thirteen entries report and halt: a fault reaching one of those is a bug,
// and printing what happened beats spinning silently — the same reasoning
// behind populating all 256 x86 IDT gates.
//
// Three are real:
//
//   entry 5   current EL with SPx, IRQ    — the generic timer
//   entry 8   lower EL AArch64, sync      — every `svc` and every fault
//                                            userspace takes
//   entry 9   lower EL AArch64, IRQ       — the timer, while EL0 is running
//
// Entry 9 exists because EL0 runs with interrupts unmasked. A timer tick
// arriving while a process is on the CPU is not an error, and pointing that
// vector at the reporting path would make any EL0 test pass or fail depending
// on when it happened to start.
//
// The IRQ entries save x0-x18 and x30 themselves: these are not functions the
// compiler knows about, they are entries the CPU jumps to with the
// interrupted code's registers still live, and an AAPCS64 callee is free to
// clobber every caller-saved one. Entry 8 saves rather more, because the
// handler has to *read and change* the interrupted registers: a system call's
// arguments arrive in them and its result goes back through them.

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
//
// ELR_EL1 and SPSR_EL1 go on the stack too, and that is not symmetry for its
// own sake. They are single registers, one pair for the whole CPU, and the
// handler is allowed to switch threads: the moment it does, another thread
// resumes inside *its* copy of this entry, takes its own interrupts, and
// overwrites them. Whichever thread erets last would return to whatever
// address the most recent exception happened to leave behind.
//
// The x86_64 side gets this free, because `iretq` pops its return frame off
// the stack, so it is per-thread by construction. Here it has to be written
// down.
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
    mrs     x0, elr_el1
    mrs     x1, spsr_el1
    stp     x0, x1, [sp, #-16]!

    bl      aarch64_irq

    ldp     x0, x1, [sp], #16
    msr     elr_el1, x0
    msr     spsr_el1, x1
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

// The synchronous entry from EL0. Everything a process does that the kernel
// has to deal with arrives here: `svc`, and every fault it takes.
//
// It builds a full trap frame — x0-x30, then ELR_EL1 and SPSR_EL1 — and hands
// its address to Zig. Not to be tidy: the handler has to be able to change
// what it holds. A system call's return value is a write to the saved x0, and
// resuming a process at a different instruction is a write to the saved ELR.
// Restoring ELR and SPSR from the frame rather than leaving them in the
// system registers is what makes that possible, and is also what makes the
// entry re-entrant once a fault handler is allowed to take a fault.
//
// 272 bytes rather than 264, because SP must stay 16-byte aligned.
//
// The vector entry itself is a single branch, because the body does not fit:
// a vector slot is exactly 128 bytes and building and unwinding a 31-register
// frame takes more than thirty instructions. The two IRQ entries save half as
// much and do fit, which is the only reason they are written inline.
.macro SYNC_LOWER_ENTRY
.align 7
    b       aarch64_sync_lower_body
.endm

aarch64_sync_lower_body:
    sub     sp, sp, #272
    stp     x0, x1, [sp, #0]
    stp     x2, x3, [sp, #16]
    stp     x4, x5, [sp, #32]
    stp     x6, x7, [sp, #48]
    stp     x8, x9, [sp, #64]
    stp     x10, x11, [sp, #80]
    stp     x12, x13, [sp, #96]
    stp     x14, x15, [sp, #112]
    stp     x16, x17, [sp, #128]
    stp     x18, x19, [sp, #144]
    stp     x20, x21, [sp, #160]
    stp     x22, x23, [sp, #176]
    stp     x24, x25, [sp, #192]
    stp     x26, x27, [sp, #208]
    stp     x28, x29, [sp, #224]
    str     x30, [sp, #240]
    mrs     x9, elr_el1
    mrs     x10, spsr_el1
    stp     x9, x10, [sp, #248]

    mov     x0, sp
    bl      aarch64_sync_lower

    ldp     x9, x10, [sp, #248]
    msr     elr_el1, x9
    msr     spsr_el1, x10
    ldp     x0, x1, [sp, #0]
    ldp     x2, x3, [sp, #16]
    ldp     x4, x5, [sp, #32]
    ldp     x6, x7, [sp, #48]
    ldp     x8, x9, [sp, #64]
    ldp     x10, x11, [sp, #80]
    ldp     x12, x13, [sp, #96]
    ldp     x14, x15, [sp, #112]
    ldp     x16, x17, [sp, #128]
    ldp     x18, x19, [sp, #144]
    ldp     x20, x21, [sp, #160]
    ldp     x22, x23, [sp, #176]
    ldp     x24, x25, [sp, #192]
    ldp     x26, x27, [sp, #208]
    ldp     x28, x29, [sp, #224]
    ldr     x30, [sp, #240]
    add     sp, sp, #272
    eret

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
    // Lower EL, AArch64 — a process. Its system calls and faults arrive at
    // entry 8, and the timer interrupting it at entry 9.
    SYNC_LOWER_ENTRY
    IRQ_ENTRY
    VEC_ENTRY 10
    VEC_ENTRY 11
    // Lower EL, AArch32
    VEC_ENTRY 12
    VEC_ENTRY 13
    VEC_ENTRY 14
    VEC_ENTRY 15
