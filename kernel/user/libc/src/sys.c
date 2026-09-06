#include "sys.h"

/* System V AMD64 §A.2.1: a syscall clobbers %rcx and %r11 and nothing else,
 * so those are the only registers in the clobber list besides memory. The
 * argument registers are the ABI's own (%rdi, %rsi, %rdx), which is why the
 * constraints name them explicitly rather than letting the compiler choose.
 */
static inline long cl_syscall3(long nr, long a, long b, long c) {
    long ret;
    __asm__ __volatile__(
        "syscall"
        : "=a"(ret)
        : "a"(nr), "D"(a), "S"(b), "d"(c)
        : "rcx", "r11", "memory");
    return ret;
}

static inline long cl_syscall1(long nr, long a) {
    long ret;
    __asm__ __volatile__(
        "syscall"
        : "=a"(ret)
        : "a"(nr), "D"(a)
        : "rcx", "r11", "memory");
    return ret;
}

long cl_sys_write(int fd, const void* buf, unsigned long len) {
    return cl_syscall3(CL_SYS_WRITE, (long)fd, (long)buf, (long)len);
}

void* cl_sys_brk(void* addr) {
    return (void*)cl_syscall1(CL_SYS_BRK, (long)addr);
}

void cl_sys_exit(int code) {
    cl_syscall1(CL_SYS_EXIT, (long)code);
    /* The kernel does not return from exit. If it somehow did, spinning is
     * the only safe thing left: there is no stack frame to return to. `hlt`
     * would be the polite instruction and is exactly the wrong one — it is
     * privileged, so in ring 3 it raises #GP and the failure stops looking
     * like the one that actually happened. */
    for (;;) { __asm__ __volatile__("pause" ::: "memory"); }
}
