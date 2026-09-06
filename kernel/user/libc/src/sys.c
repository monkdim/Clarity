#include "sys.h"

/* How a system call is made, on each architecture this library runs on.
 *
 * Two instructions and two register conventions, and nothing else in the
 * library knows which one it was built for.
 */
#if defined(__x86_64__)

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

#elif defined(__aarch64__)

/* AArch64: the number goes in x8, the arguments in x0-x5, and the result
 * comes back in x0 — which is also where the first argument was, hence the
 * "+r" on x0 rather than a separate output. The register variables are how a
 * specific register is named to the compiler here; the x86 constraint letters
 * have no equivalent.
 *
 * `svc` clobbers no general register other than the result, so the clobber
 * list is memory alone.
 */
static inline long cl_syscall3(long nr, long a, long b, long c) {
    register long x8 __asm__("x8") = nr;
    register long x0 __asm__("x0") = a;
    register long x1 __asm__("x1") = b;
    register long x2 __asm__("x2") = c;
    __asm__ __volatile__(
        "svc #0"
        : "+r"(x0)
        : "r"(x8), "r"(x1), "r"(x2)
        : "memory");
    return x0;
}

static inline long cl_syscall1(long nr, long a) {
    register long x8 __asm__("x8") = nr;
    register long x0 __asm__("x0") = a;
    __asm__ __volatile__(
        "svc #0"
        : "+r"(x0)
        : "r"(x8)
        : "memory");
    return x0;
}

#else
#error "no system call convention for this architecture"
#endif

long cl_sys_write(int fd, const void* buf, unsigned long len) {
    return cl_syscall3(CL_SYS_WRITE, (long)fd, (long)buf, (long)len);
}

void* cl_sys_brk(void* addr) {
    return (void*)cl_syscall1(CL_SYS_BRK, (long)addr);
}

void cl_sys_exit(int code) {
    cl_syscall1(CL_SYS_EXIT, (long)code);
    /* The kernel does not return from exit. If it somehow did, spinning is
     * the only safe thing left: there is no stack frame to return to.
     *
     * The polite instruction on each architecture is exactly the wrong one:
     * `hlt` and `wfi` are both privileged, so from userspace they raise a
     * fault and the failure stops looking like the one that actually
     * happened. These two are the unprivileged hints. */
#if defined(__x86_64__)
    for (;;) { __asm__ __volatile__("pause" ::: "memory"); }
#else
    for (;;) { __asm__ __volatile__("yield" ::: "memory"); }
#endif
}
