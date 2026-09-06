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
 *
 * Switching away pushes the callee-saved registers, records %rsp and the
 * address of the resume label, then loads the next thread's %rsp, pops *its*
 * saved registers and jumps to *its* recorded address. For a thread that has
 * run before, that address is the resume label, whose `ret` returns from the
 * clarity_switch_to *it* called, however long ago. For a brand-new thread it
 * is the entry point, whose stack init_kernel_thread laid out to match.
 */

        .text
        .globl clarity_switch_to
        .type clarity_switch_to, @function
clarity_switch_to:
        pushq %rbp
        pushq %rbx
        pushq %r12
        pushq %r13
        pushq %r14
        pushq %r15
        movq  %rsp, 0(%rdi)             /* prev->rsp = current stack */
        leaq  1f(%rip), %rax
        movq  %rax, 56(%rdi)            /* prev->rip = resume label */
        movq  0(%rsi), %rsp             /* switch to next's stack */
        popq  %r15
        popq  %r14
        popq  %r13
        popq  %r12
        popq  %rbx
        popq  %rbp
        jmp   *56(%rsi)                 /* resume next where it left off */
1:
        ret
        .size clarity_switch_to, . - clarity_switch_to

/* No executable stack. */
        .section .note.GNU-stack,"",@progbits
