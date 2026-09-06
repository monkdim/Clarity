// Entering and leaving EL0 on AArch64.
//
// Two halves of one journey. `aarch64_enter_user` saves the kernel's
// callee-saved state, points ELR_EL1 and SP_EL0 at the process, and erets
// down. `aarch64_leave_user` is called from inside an exception handler and
// puts the kernel back exactly where `enter_user` left it — so from the
// caller's point of view `enter_user` simply returned, with whatever value
// the handler passed.
//
// That is a context switch with the general registers left out, and it is
// deliberately the smaller thing: nothing here resumes a *different* thread,
// only the one that went down. Preemptive switching between processes needs
// the trap frame the vector entry already builds, and lands with the
// scheduler.

.section .bss
.align 4
// Where the kernel's state waits while EL0 runs.
//
//    0..95   x19-x30, the callee-saved set AAPCS64 requires a function to
//            preserve — exactly what `enter_user`'s caller is entitled to
//            still have when it returns
//   96       SP
//  104       DAIF
//
// DAIF is in there because taking an exception from EL0 sets PSTATE.I: the
// handler runs with interrupts masked, and `leave_user` returns with `ret`
// rather than `eret`, so nothing would ever unmask them again. A kernel that
// lost its timer the first time a process exited would look completely
// healthy right up until it needed to schedule something.
//
// One save area, so `enter_user` does not nest. Nothing needs it to: a
// process re-entering the kernel arrives through the vector table, not
// through here.
aarch64_user_save:
    .space 112

.section .text

// u64 aarch64_enter_user(u64 entry, u64 user_sp)
//
// Returns the value handed to aarch64_leave_user. Does not return any other
// way: an EL0 program that never traps never comes back.
.global aarch64_enter_user
.type aarch64_enter_user, %function
aarch64_enter_user:
    adrp    x2, aarch64_user_save
    add     x2, x2, #:lo12:aarch64_user_save
    stp     x19, x20, [x2, #0]
    stp     x21, x22, [x2, #16]
    stp     x23, x24, [x2, #32]
    stp     x25, x26, [x2, #48]
    stp     x27, x28, [x2, #64]
    stp     x29, x30, [x2, #80]
    mov     x3, sp
    str     x3, [x2, #96]
    mrs     x4, daif
    str     x4, [x2, #104]

    msr     sp_el0, x1              // the process's stack
    msr     elr_el1, x0             // where it starts
    // SPSR_EL1 = 0: M[3:0] = 0b0000 (EL0t, using SP_EL0), M[4] = 0
    // (AArch64), and DAIF all clear — interrupts stay live while EL0 runs,
    // which is why vector entry 9 has to be a real handler rather than a
    // report-and-halt. A timer tick landing in a reporting vector would make
    // this a test that passes or fails depending on when it was started.
    msr     spsr_el1, xzr
    eret

// void aarch64_leave_user(u64 return_value) — never returns to its caller.
.global aarch64_leave_user
.type aarch64_leave_user, %function
aarch64_leave_user:
    adrp    x2, aarch64_user_save
    add     x2, x2, #:lo12:aarch64_user_save
    ldp     x19, x20, [x2, #0]
    ldp     x21, x22, [x2, #16]
    ldp     x23, x24, [x2, #32]
    ldp     x25, x26, [x2, #48]
    ldp     x27, x28, [x2, #64]
    ldp     x29, x30, [x2, #80]
    ldr     x3, [x2, #96]
    mov     sp, x3
    // Interrupts last, so nothing arrives while SP is in flight.
    ldr     x4, [x2, #104]
    msr     daif, x4
    // x30 now holds enter_user's return address, and x0 the value to return
    // through it. This `ret` returns from a function whose frame was
    // abandoned two exception levels ago.
    ret

// ── The program that runs at EL0 ────────────────────────────────────────
//
// Not linked as code — the kernel copies these bytes into a page it
// allocated and maps that page into a process's address space. It therefore
// lives in .rodata: from the kernel's own point of view it is data, and the
// kernel's mapping of it should not be executable.
//
// Everything here is position-independent except the two addresses it is
// told about, which are the addresses main_aarch64.zig maps the pages at.
// That coupling is the point rather than an accident: it is the process's
// memory layout, and both ends have to agree on it.

.section .rodata.usertest, "a"

.global __user_probe_start
__user_probe_start:
    // 1. Say something. The string is in this page, named by a PC-relative
    //    address — so what reaches the kernel is a *user* virtual address,
    //    meaningful only inside this process's page tables. The kernel
    //    translating it rather than dereferencing it is the whole point.
    mov     x0, #1                  // fd 1
    adr     x1, .Lmsg
    mov     x2, #(.Lmsgend - .Lmsg)
    mov     x8, #1                  // SYS_WRITE
    svc     #0

    // The kernel put the byte count in x0. If it disagrees with what we
    // asked for, say so with an exit status nothing else produces.
    cmp     x0, x2
    b.ne    .Lbad_write

    // 2. Read the kernel's number out of our data page, add one to it.
    movz    x9, #0x1000, lsl #16    // 0x1000_0000 — the data page
    ldr     x19, [x9]
    add     x19, x19, #1

    // 3. Spend long enough at EL0 that the 100 Hz timer is certain to fire
    //    here rather than in the kernel. That is the point of the loop: it
    //    makes the process get interrupted, so vector entry 9 has to save and
    //    restore it correctly and the kernel has to hand the CPU back to
    //    exactly this instruction. Sixty-seven million iterations is a
    //    fraction of a second under TCG — several ticks — and a slower
    //    machine only makes it more certain.
    movz    x11, #0x400, lsl #16
2:  subs    x11, x11, #1
    b.ne    2b

    // 4. Store it where the kernel can read it through its own direct map,
    //    which is how the write is checked: it has to land in the physical
    //    page, not merely appear to from here.
    str     x19, [x9]

    // 5. Exit with it.
    mov     x0, x19
    mov     x8, #12                 // SYS_EXIT
    svc     #0
1:  b       1b                      // the kernel does not come back here

.Lbad_write:
    movz    x0, #0xBAD
    mov     x8, #12
    svc     #0
3:  b       3b

    .balign 4
.Lmsg:
    .ascii  "hello from EL0 on aarch64\n"
.Lmsgend:
    .balign 4
.global __user_probe_end
__user_probe_end:

// A second entry point, entered separately. It writes to its own text page,
// which is mapped read-only for EL0 — so this must trap, and the kernel must
// be the one that says what happened.
.global __user_fault_start
__user_fault_start:
    movz    x12, #0x40, lsl #16     // 0x0040_0000 — this very page
    mov     x0, #1
    str     x0, [x12]               // must fault: read-only at EL0

    // Reaching this instruction means the store was allowed, which is the
    // failure this half of the probe exists to catch. Exiting with a status
    // nothing else produces, rather than spinning, is the difference between
    // a test that reports and a test that hangs — and a hung boot is a much
    // worse way to find out.
    movz    x0, #0xDEAD
    mov     x8, #12                 // SYS_EXIT
    svc     #0
1:  b       1b
.global __user_fault_end
__user_fault_end:
