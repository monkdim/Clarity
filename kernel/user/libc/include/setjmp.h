#ifndef _CLARITY_SETJMP_H
#define _CLARITY_SETJMP_H

/* Sized for the larger of the two architectures this library builds for.

   x86-64 System V needs eight words: rbx, rbp, r12-r15, rsp and the return
   address. AArch64 needs twenty-one: x19-x28, x29, x30, sp, and d8-d15 —
   because AAPCS64 makes the low halves of v8-v15 callee-saved, which the
   x86-64 ABI has no equivalent of.

   Thirty-two words rather than twenty-one, for room to grow without breaking
   a compiled object. One size for both keeps this header from having to know
   which target it is being read for, and the cost is 88 unused bytes per
   jmp_buf on x86-64.

   Callers must not rely on anything but the callee-saved set surviving; the
   ISO C rule about non-volatile locals modified between setjmp and longjmp
   applies here exactly as it does anywhere else, and the Clarity code
   generator already marks such locals volatile. */
typedef unsigned long jmp_buf[32];

int  setjmp(jmp_buf env);
void longjmp(jmp_buf env, int val) __attribute__((noreturn));

#endif
