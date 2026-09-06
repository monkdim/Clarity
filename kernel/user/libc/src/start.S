/* Program entry for a freestanding Clarity binary.
 *
 * The kernel enters here with the stack laid out the way a Unix loader lays
 * it out — argc at the top, then argv[0..argc-1], then a NULL — because that
 * is what ClarityOS's ELF loader builds and what a Linux kernel builds, and
 * matching it means the same object runs under both. That equivalence is what
 * lets this library be tested on a Linux host rather than only in a VM.
 *
 * The ABI asks for a 16-byte aligned stack at the point of a call. At entry
 * rsp points at argc and is itself 16-aligned, so after the two pushes of the
 * argument setup below it is aligned again for the call to main.
 */
        .text
        .globl  _start
        .type   _start, @function
_start:
        xorq    %rbp, %rbp             /* outermost frame: no caller to unwind to */
        movq    (%rsp), %rdi           /* argc */
        leaq    8(%rsp), %rsi          /* argv */
        andq    $-16, %rsp             /* realign after the implicit entry layout */
        call    main
        movl    %eax, %edi
        call    exit
        /* exit does not return; if it somehow did, stop here rather than
           executing whatever bytes follow. */
1:      pause
        jmp     1b
        .size   _start, .-_start

        .section .note.GNU-stack,"",@progbits
