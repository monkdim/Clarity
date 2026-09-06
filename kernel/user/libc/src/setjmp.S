/* setjmp / longjmp for x86-64 System V.
 *
 * Only the callee-saved registers need saving: everything else is either
 * dead across a call by the ABI's own rules, or belongs to the frame longjmp
 * is unwinding to. That is rbx, rbp, r12-r15, plus the stack pointer and
 * where to resume.
 *
 * Layout, matching jmp_buf in <setjmp.h> (index by 8 bytes):
 *   0 rbx   8 rbp   16 r12   24 r13   32 r14   40 r15   48 rsp   56 rip
 *
 * The saved rsp is the caller's stack pointer *after* the return address has
 * been popped conceptually — that is, rsp+8 at entry — so restoring it and
 * jumping to the saved return address puts the caller back exactly where it
 * was, with its frame intact.
 *
 * No floating-point state is saved. The x86-64 ABI has no callee-saved SSE
 * registers, and MXCSR and the x87 control word are not modified by anything
 * in this runtime.
 */
        .text
        .globl  setjmp
        .type   setjmp, @function
setjmp:
        movq    %rbx,  0(%rdi)
        movq    %rbp,  8(%rdi)
        movq    %r12, 16(%rdi)
        movq    %r13, 24(%rdi)
        movq    %r14, 32(%rdi)
        movq    %r15, 40(%rdi)
        leaq    8(%rsp), %rax          /* caller's rsp, above our return address */
        movq    %rax, 48(%rdi)
        movq    (%rsp), %rax           /* the return address */
        movq    %rax, 56(%rdi)
        xorl    %eax, %eax             /* a direct call returns 0 */
        ret
        .size   setjmp, .-setjmp

        .globl  longjmp
        .type   longjmp, @function
longjmp:
        movl    %esi, %eax
        testl   %eax, %eax
        jne     1f
        movl    $1, %eax               /* ISO C: longjmp(env, 0) makes setjmp return 1 */
1:
        movq     0(%rdi), %rbx
        movq     8(%rdi), %rbp
        movq    16(%rdi), %r12
        movq    24(%rdi), %r13
        movq    32(%rdi), %r14
        movq    40(%rdi), %r15
        movq    48(%rdi), %rsp
        jmp     *56(%rdi)
        .size   longjmp, .-longjmp

/* No executable stack is needed; say so, or the linker marks the whole
   program's stack executable because one object failed to declare it. */
        .section .note.GNU-stack,"",@progbits
