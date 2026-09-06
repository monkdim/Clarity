#ifndef _CLARITY_SETJMP_H
#define _CLARITY_SETJMP_H

/* x86-64 System V: rbx, rbp, r12-r15, rsp and the return address — eight
   words. Sized at 16 for room to grow without breaking a compiled object.
   Callers must not rely on anything but the callee-saved set surviving; the
   ISO C rule about non-volatile locals modified between setjmp and longjmp
   applies here exactly as it does anywhere else, and the Clarity code
   generator already marks such locals volatile. */
typedef unsigned long jmp_buf[16];

int  setjmp(jmp_buf env);
void longjmp(jmp_buf env, int val) __attribute__((noreturn));

#endif
