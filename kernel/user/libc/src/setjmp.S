/* setjmp / longjmp.
 *
 * Only the callee-saved registers need saving: everything else is either dead
 * across a call by the ABI's own rules, or belongs to the frame longjmp is
 * unwinding to. Which registers those are is the whole of the difference
 * between the two versions below.
 *
 * jmp_buf is sized in <setjmp.h> for the larger of the two.
 */

#if defined(__x86_64__)

/* rbx, rbp, r12-r15, plus the stack pointer and where to resume.
 *
 * Layout (index by 8 bytes):
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

#elif defined(__aarch64__)

/* x19-x28, the frame pointer x29, the link register x30, the stack pointer,
 * and d8-d15.
 *
 * Layout (byte offsets):
 *     0 x19    8 x20   16 x21   24 x22   32 x23   40 x24
 *    48 x25   56 x26   64 x27   72 x28   80 x29   88 x30
 *    96 sp
 *   104 d8  112 d9  120 d10 128 d11 136 d12 144 d13 152 d14 160 d15
 *
 * The floating-point half has no x86-64 counterpart and is not optional here:
 * AAPCS64 makes the low 64 bits of v8-v15 callee-saved, so a longjmp that
 * left them alone would hand the caller back someone else's doubles. A
 * compiled Clarity program keeps floating-point locals in exactly those
 * registers.
 *
 * There is no return address on the stack to skip past, as there is on x86:
 * the link register *is* the return address, so SP is saved as it stands and
 * `ret` at the end of longjmp goes to the restored x30.
 */
        .text
        .globl  setjmp
        .type   setjmp, %function
setjmp:
        stp     x19, x20, [x0, #0]
        stp     x21, x22, [x0, #16]
        stp     x23, x24, [x0, #32]
        stp     x25, x26, [x0, #48]
        stp     x27, x28, [x0, #64]
        stp     x29, x30, [x0, #80]
        mov     x9, sp
        str     x9, [x0, #96]
        stp     d8,  d9,  [x0, #104]
        stp     d10, d11, [x0, #120]
        stp     d12, d13, [x0, #136]
        stp     d14, d15, [x0, #152]
        mov     w0, wzr                /* a direct call returns 0 */
        ret
        .size   setjmp, .-setjmp

        .globl  longjmp
        .type   longjmp, %function
longjmp:
        ldp     x19, x20, [x0, #0]
        ldp     x21, x22, [x0, #16]
        ldp     x23, x24, [x0, #32]
        ldp     x25, x26, [x0, #48]
        ldp     x27, x28, [x0, #64]
        ldp     x29, x30, [x0, #80]
        ldr     x9, [x0, #96]
        mov     sp, x9
        ldp     d8,  d9,  [x0, #104]
        ldp     d10, d11, [x0, #120]
        ldp     d12, d13, [x0, #136]
        ldp     d14, d15, [x0, #152]
        /* Read the value only after the buffer is done with: it arrives in w1
           and the buffer pointer was x0, so setting the result first would
           destroy the pointer. */
        mov     w0, w1
        /* ISO C: longjmp(env, 0) makes setjmp return 1. */
        cmp     w0, #0
        csinc   w0, w0, wzr, ne
        ret
        .size   longjmp, .-longjmp

        .section .note.GNU-stack,"",%progbits

#else
#error "no setjmp for this architecture"
#endif
