/* Kernel context switch.
 *
 * In assembly rather than Zig inline asm because this is precisely the shape
 * Zig will not let you have: a function that manipulates %rsp and returns
 * through a saved instruction pointer needs `callconv(.Naked)`, and a naked
 * function has no ABI, so Zig refuses to call one. Written here it is an
 * ordinary C-ABI symbol the kernel can call.
 *
 *   void clarity_switch_to(Context *prev, Context *next)
 *
 * The callee-saved set lives on each thread's own stack, so only %rsp and the
 * resume address are kept in the Context struct:
 *
 *   offset 0   rsp
 *   offset 56  rip
 *   offset 64  the 512-byte FXSAVE area
 *
 * Switching away pushes RFLAGS and the callee-saved registers, records %rsp
 * and the address of the resume label, then loads the next thread's %rsp,
 * pops *its* saved state and jumps to *its* recorded address. For a thread
 * that has run before, that address is the resume label, whose `ret` returns
 * from the clarity_switch_to *it* called, however long ago. For a brand-new
 * thread it is the entry point, whose stack init_kernel_thread laid out to
 * match.
 *
 * RFLAGS is saved because the timer preempts from inside an interrupt gate,
 * where IF is 0. Without this, a thread resumed from that context would carry
 * the interrupt state of whichever thread happened to switch to it: one that
 * yielded cooperatively would come back with interrupts off and never be
 * preempted again, and one preempted by the timer would come back with them
 * on, midway through its own interrupt handler. Each thread now restores the
 * interrupt state it was switched away with.
 *
 * The x87/SSE state is saved and restored here too, for the same reason and
 * with the same lifetime: userspace is C, and C on x86-64 keeps every double
 * in an xmm register. The kernel itself is built with SSE subtracted from the
 * feature set, so it can never be the one to clobber them — but two user
 * threads doing arithmetic certainly can. FXSAVE and FXRSTOR need a 16-byte
 * aligned operand, which is why the Context struct asserts its own alignment.
 */

        .text
        .globl clarity_switch_to
        .type clarity_switch_to, @function
clarity_switch_to:
        pushfq
        pushq %rbp
        pushq %rbx
        pushq %r12
        pushq %r13
        pushq %r14
        pushq %r15
        movq  %rsp, 0(%rdi)             /* prev->rsp = current stack */
        leaq  1f(%rip), %rax
        movq  %rax, 56(%rdi)            /* prev->rip = resume label */
        fxsave 64(%rdi)                 /* prev's x87 + SSE registers */
        fxrstor 64(%rsi)                /* next's; a brand-new thread's area
                                           holds the clean image Context's
                                           default put there */
        movq  0(%rsi), %rsp             /* switch to next's stack */
        movq  56(%rsi), %rax            /* resume address, read before popfq
                                           so no memory access depends on the
                                           restored flags */
        popq  %r15
        popq  %r14
        popq  %r13
        popq  %r12
        popq  %rbx
        popq  %rbp
        popfq                           /* next's own interrupt state */
        jmp   *%rax                     /* resume next where it left off */
1:
        ret
        .size clarity_switch_to, . - clarity_switch_to

/* No executable stack. */
        .section .note.GNU-stack,"",@progbits
