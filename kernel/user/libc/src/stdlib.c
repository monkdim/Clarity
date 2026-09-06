#include <stdlib.h>
#include <ctype.h>
#include "sys.h"

void exit(int code) { cl_sys_exit(code); }

void abort(void) {
    static const char msg[] = "clarity: abort\n";
    cl_sys_write(1, msg, sizeof(msg) - 1);
    cl_sys_exit(134);   /* what a shell reports for SIGABRT: 128 + 6 */
}

/* There is no environment. The Clarity runtime's only caller is
 * getenv("CLARITY_GC"), and NULL is the right answer: with no operating
 * system to return pages to, the arena that never frees is the correct
 * default, and the collector is the thing a hosted build opts into. */
char* getenv(const char* name) { (void)name; return 0; }

/* xorshift64*, seeded to a non-zero constant so an unseeded rand() is
 * deterministic rather than degenerate — a zero state makes xorshift emit
 * zero forever. Returns 31 bits, which is what RAND_MAX promises. */
static unsigned long rng_state = 0x2545F4914F6CDD1DUL;

void srand(unsigned int seed) {
    rng_state = seed ? (unsigned long)seed * 0x2545F4914F6CDD1DUL : 0x2545F4914F6CDD1DUL;
}

int rand(void) {
    unsigned long x = rng_state;
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    rng_state = x;
    return (int)((x * 0x2545F4914F6CDD1DUL) >> 33);   /* top 31 bits */
}

long strtol(const char* s, char** end, int base) {
    const char* p = s;
    while (isspace((unsigned char)*p)) p++;

    int neg = 0;
    if (*p == '+' || *p == '-') { neg = (*p == '-'); p++; }

    if ((base == 0 || base == 16) && p[0] == '0' && (p[1] == 'x' || p[1] == 'X')) { p += 2; base = 16; }
    else if (base == 0 && p[0] == '0') { base = 8; }
    else if (base == 0) { base = 10; }

    const char* digits_start = p;
    unsigned long acc = 0;
    int overflow = 0;
    for (;; p++) {
        int d;
        if (*p >= '0' && *p <= '9') d = *p - '0';
        else if (*p >= 'a' && *p <= 'z') d = *p - 'a' + 10;
        else if (*p >= 'A' && *p <= 'Z') d = *p - 'A' + 10;
        else break;
        if (d >= base) break;
        /* Saturate rather than wrap: ISO C requires LONG_MAX/LONG_MIN here,
         * and silently wrapping would turn a too-large literal into a
         * plausible small number. */
        if (acc > (0x7FFFFFFFFFFFFFFFUL + (unsigned long)neg - (unsigned long)d) / (unsigned long)base) overflow = 1;
        acc = acc * (unsigned long)base + (unsigned long)d;
    }

    /* No digits consumed: ISO C says the end pointer is the original string. */
    if (p == digits_start) { if (end) *end = (char*)s; return 0; }
    if (end) *end = (char*)p;
    if (overflow) return neg ? (-0x7FFFFFFFFFFFFFFFL - 1L) : 0x7FFFFFFFFFFFFFFFL;
    return neg ? -(long)acc : (long)acc;
}
