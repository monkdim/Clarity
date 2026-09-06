// ClarityOS aarch64 boot stub — QEMU 'virt' / Apple-Silicon-class AArch64.
//
// QEMU enters the kernel ELF at its entry point with the boot CPU running
// at EL2 (or EL1, depending on machine flags) and x0 pointing at a device
// tree blob. This stub:
//   1. parks secondary CPUs (only the boot CPU proceeds),
//   2. drops from EL2 to EL1 if needed,
//   3. enables FP/SIMD access at EL1 (Zig may emit SIMD; without this,
//      those instructions trap),
//   4. installs a stack, zeroes .bss, and calls kernel_main_aarch64.

.section .text.boot
.global _start
.type _start, %function
_start:
    // Only the boot CPU (Aff0 == 0) continues; others wait forever.
    mrs     x1, mpidr_el1
    and     x1, x1, #0xFF
    cbz     x1, .Lprimary
.Lpark:
    wfe
    b       .Lpark

.Lprimary:
    // If we entered at EL2, configure EL1 as AArch64 and eret down to it.
    mrs     x1, CurrentEL
    lsr     x1, x1, #2
    cmp     x1, #2
    b.ne    .Lat_el1

    movz    x1, #0x8000, lsl #16        // HCR_EL2.RW (bit 31): EL1 is AArch64
    msr     hcr_el2, x1
    mov     x1, #0x3c5                  // DAIF masked, M[3:0]=0b0101 (EL1h)
    msr     spsr_el2, x1
    adr     x1, .Lat_el1
    msr     elr_el2, x1
    eret

.Lat_el1:
    // Allow FP/SIMD at EL1 (CPACR_EL1.FPEN = 0b11).
    mrs     x1, cpacr_el1
    orr     x1, x1, #(3 << 20)
    msr     cpacr_el1, x1
    isb

    // Stack.
    ldr     x1, =__stack_top
    mov     sp, x1

    // Zero .bss (8 bytes at a time; the linker aligns both ends to 16).
    ldr     x1, =__bss_start
    ldr     x2, =__bss_end
.Lbss_loop:
    cmp     x1, x2
    b.hs    .Lbss_done
    str     xzr, [x1], #8
    b       .Lbss_loop
.Lbss_done:

    // x0 still holds the DTB pointer QEMU passed in.
    bl      kernel_main_aarch64

.Lhalt:
    wfe
    b       .Lhalt
