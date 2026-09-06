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
 *   offset 576 cr3, or 0 to leave the address space alone
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
 * CR3 is switched too, and the order is load-bearing. It happens *after* %rsp
 * has moved to the next thread's stack and before anything is popped off it,
 * because the two stacks are not both mapped in both address spaces: a kernel
 * thread's stack is an HHDM address every space maps, but the boot stack is a
 * low identity-mapped one that a process's space does not. Doing it earlier
 * would pull the outgoing stack out from under this function; doing it later
 * would pop from a stack the current tables do not describe.
 *
 * Between those two instructions there is no memory access at all — which is
 * why `cli` is here as well. An interrupt arriving in that window would push
 * its frame at the new %rsp under the old CR3, which is precisely the mapping
 * that may not exist: a double fault, then a triple, then a silent reset. The
 * `popfq` at the end restores whatever interrupt state the incoming thread
 * was switched away with, so this does not leak.
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
        cli                             /* see the CR3 note above */
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
        movq  576(%rsi), %rdx           /* next->cr3, 0 = leave it alone */
        testq %rdx, %rdx
        jz    2f
        movq  %cr3, %rcx
        cmpq  %rcx, %rdx
        je    2f                        /* same address space: no TLB flush */
        movq  %rdx, %cr3
2:
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
