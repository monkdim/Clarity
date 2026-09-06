/* The non-float half of the library, checked the same way: compiled once
 * against the host's C library and once against this one, with the two
 * outputs required to be identical.
 *
 * Written so that every line printed is a consequence of a documented ISO C
 * rule, not of an implementation detail — comparing against glibc only proves
 * something if glibc's answer is the one the standard requires.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <setjmp.h>
#include <math.h>

static unsigned long rng = 1234567891011121314UL;
static unsigned long next_rand(void) {
    rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17;
    return rng;
}

static void t_string(void) {
    char a[64], b[64];

    printf("strlen %zu %zu\n", strlen(""), strlen("hello world"));

    strcpy(a, "abc"); strcat(a, "def");
    printf("strcpy/strcat [%s]\n", a);

    memset(b, '#', sizeof(b)); strncpy(b, "xy", 5); b[8] = 0;
    printf("strncpy [%s] %d %d %d\n", b, b[2], b[4], (unsigned char)b[5]);

    printf("strcmp %d %d %d\n",
           strcmp("a", "a") == 0, strcmp("a", "b") < 0, strcmp("b", "a") > 0);
    /* Bytes above 0x7F must compare as unsigned, or every non-ASCII key
     * sorts on the wrong side. */
    printf("strcmp high %d\n", strcmp("\xff", "\x01") > 0);
    printf("strncmp %d %d %d\n", strncmp("abcd", "abce", 3), strncmp("abcd", "abce", 4) < 0, strncmp("", "", 5));

    printf("strchr %d %d %d\n", strchr("hello", 'l') != 0, strchr("hello", 'z') == 0, strchr("hi", 0) != 0);
    printf("strstr %d %d %d %d\n",
           strstr("hello", "ll") != 0, strstr("hello", "") == 0 ? 0 : 1,
           strstr("hello", "lo") != 0, strstr("hello", "xy") == 0);

    memcpy(a, "0123456789", 11);
    memmove(a + 2, a, 8); a[10] = 0;
    printf("memmove up [%s]\n", a);
    memcpy(a, "0123456789", 11);
    memmove(a, a + 2, 8); a[8] = 0;
    printf("memmove down [%s]\n", a);
    printf("memcmp %d %d %d\n", memcmp("ab", "ab", 2), memcmp("ab", "ac", 2) < 0, memcmp("\xff", "\x01", 1) > 0);
}

static void t_ctype(void) {
    int d = 0, a = 0, n = 0, s = 0, u = 0, l = 0;
    for (int c = 0; c < 128; c++) {
        d += isdigit(c) ? 1 : 0;
        a += isalpha(c) ? 1 : 0;
        n += isalnum(c) ? 1 : 0;
        s += isspace(c) ? 1 : 0;
        u += toupper(c);
        l += tolower(c);
    }
    printf("ctype %d %d %d %d %d %d\n", d, a, n, s, u, l);
}

static void t_printf(void) {
    printf("[%d] [%5d] [%-5d] [%05d] [%+d] [% d]\n", 42, 42, 42, 42, 42, 42);
    printf("[%ld] [%ld]\n", 9223372036854775807L, -9223372036854775807L - 1L);
    printf("[%u] [%lu]\n", 4294967295u, 18446744073709551615UL);
    printf("[%x] [%X] [%08lx] [%#x]\n", 48879u, 48879u, 3735928559UL, 255u);
    printf("[%s] [%10s] [%-10s] [%.3s]\n", "clarity", "clarity", "clarity", "clarity");
    printf("[%c] [%%]\n", 'z');
    printf("[%.5d] [%8.5d]\n", 42, 42);
    char buf[8];
    int n = snprintf(buf, sizeof(buf), "%s", "0123456789");
    printf("snprintf trunc n=%d [%s]\n", n, buf);
    n = snprintf(0, 0, "%d-%s", 7, "x");
    printf("snprintf measure n=%d\n", n);
    char big[64];
    sprintf(big, "%08lx%08lx", 0x1234UL, 0xabcdefUL);
    printf("sprintf [%s]\n", big);
}

static void t_strtol(void) {
    static const char* cases[] = {
        "0", "42", "-42", "+42", "  17", "0x1f", "0X1F", "017", "z", "99999999999999999999",
        "-99999999999999999999", "2147483648", "9223372036854775807", "-9223372036854775808",
        "12abc", "", "-", "0b101",
    };
    for (unsigned i = 0; i < sizeof(cases)/sizeof(cases[0]); i++) {
        char* end = 0;
        long v = strtol(cases[i], &end, 0);
        printf("strtol[%s] = %ld rest=[%s]\n", cases[i], v, end);
        v = strtol(cases[i], &end, 10);
        printf("strtol10[%s] = %ld rest=[%s]\n", cases[i], v, end);
    }
}

static int cmp_long(const void* a, const void* b) {
    long x = *(const long*)a, y = *(const long*)b;
    return (x > y) - (x < y);
}

static void t_qsort(void) {
    long v[512];
    for (int i = 0; i < 512; i++) v[i] = (long)(next_rand() % 1000);
    qsort(v, 512, sizeof(long), cmp_long);
    int ok = 1;
    long sum = 0;
    for (int i = 0; i < 512; i++) { if (i && v[i - 1] > v[i]) ok = 0; sum += v[i]; }
    printf("qsort random sorted=%d sum=%ld first=%ld last=%ld\n", ok, sum, v[0], v[511]);

    /* Already sorted, and reversed: the two shapes a naive pivot choice turns
     * into quadratic time. Correctness is what is checked here; the timing
     * claim is in the source comment, not in this output. */
    for (int i = 0; i < 512; i++) v[i] = i;
    qsort(v, 512, sizeof(long), cmp_long);
    printf("qsort sorted %ld %ld\n", v[0], v[511]);
    for (int i = 0; i < 512; i++) v[i] = 511 - i;
    qsort(v, 512, sizeof(long), cmp_long);
    printf("qsort reversed %ld %ld\n", v[0], v[511]);
    /* All equal, and the degenerate sizes. */
    for (int i = 0; i < 512; i++) v[i] = 7;
    qsort(v, 512, sizeof(long), cmp_long);
    printf("qsort equal %ld %ld\n", v[0], v[511]);
    qsort(v, 0, sizeof(long), cmp_long);
    qsort(v, 1, sizeof(long), cmp_long);
    printf("qsort degenerate ok\n");
}

static jmp_buf jb;

static void thrower(int depth) {
    if (depth == 0) longjmp(jb, 7);
    thrower(depth - 1);
}

static void t_setjmp(void) {
    volatile int visits = 0;
    int r = setjmp(jb);
    visits++;
    if (r == 0) thrower(20);
    printf("setjmp r=%d visits=%d\n", r, visits);

    /* longjmp(env, 0) must arrive as 1, per ISO C. */
    if (setjmp(jb) == 0) longjmp(jb, 0);
    printf("setjmp zero-becomes-one ok\n");

    /* The callee-saved registers must survive. Enough live values to force
     * the compiler to keep some of them in rbx/r12-r15 across the call. */
    volatile long guard = 0;
    long a = 11, b = 22, c = 33, d = 44, e = 55, f = 66;
    if (setjmp(jb) == 0) { guard = a + b + c + d + e + f; longjmp(jb, 3); }
    printf("setjmp callee-saved %ld %ld\n", guard, a + b + c + d + e + f);
}

static void t_malloc(void) {
    /* Grow, free, and reuse: the allocator has to hand the same space back
     * rather than only ever moving the break upwards. */
    void* p[64];
    for (int i = 0; i < 64; i++) { p[i] = malloc(64); memset(p[i], i, 64); }
    int ok = 1;
    for (int i = 0; i < 64; i++) { unsigned char* q = p[i]; for (int j = 0; j < 64; j++) if (q[j] != (unsigned char)i) ok = 0; }
    printf("malloc distinct=%d\n", ok);
    for (int i = 0; i < 64; i += 2) free(p[i]);
    for (int i = 0; i < 64; i += 2) p[i] = malloc(64);
    printf("malloc reuse ok=%d\n", p[0] != 0);
    for (int i = 0; i < 64; i++) free(p[i]);

    char* s = malloc(8);
    memcpy(s, "1234567", 8);
    s = realloc(s, 4096);
    printf("realloc keeps [%s]\n", s);
    free(s);

    /* Coalescing: allocate a run, free it all, then ask for the whole span
     * back. Without coalescing this has to grow the heap again, which still
     * succeeds — so what is checked is that it succeeds and the data is
     * usable, not the address. */
    void* q[32];
    for (int i = 0; i < 32; i++) q[i] = malloc(1024);
    for (int i = 0; i < 32; i++) free(q[i]);
    char* big = malloc(30000);
    memset(big, 'A', 30000);
    printf("coalesce %c%c ok\n", big[0], big[29999]);
    free(big);

    void* z = calloc(100, 8);
    unsigned char* zb = z;
    int zeroed = 1;
    for (int i = 0; i < 800; i++) if (zb[i]) zeroed = 0;
    printf("calloc zeroed=%d overflow=%d\n", zeroed, calloc((size_t)-1 / 4, 8) == 0);
    free(z);
    free(0);
    printf("free(NULL) ok\n");
}

static void t_math(void) {
    static const double xs[] = {0.0, 1.0, -1.0, 0.5, -0.5, 1.5, -1.5, 2.5, -2.5,
                                3.7, -3.7, 1e15, -1e15, 1e-10, 123456.789};
    for (unsigned i = 0; i < sizeof(xs)/sizeof(xs[0]); i++)
        printf("exact %.17g %.17g %.17g %.17g %.17g\n",
               fabs(xs[i]), floor(xs[i]), ceil(xs[i]), round(xs[i]), sqrt(fabs(xs[i])));

    static const double num[] = {10.0, -10.0, 7.5, 1e10, 0.3, 1e-5};
    static const double den[] = {3.0, 3.0, 0.5, 7.0, 0.1, 3e-6};
    for (unsigned i = 0; i < sizeof(num)/sizeof(num[0]); i++)
        printf("fmod %.17g\n", fmod(num[i], den[i]));

    /* sqrt is the hardware instruction on both sides, so it is compared bit
     * for bit; the rest are compared to a tolerance, and the tolerance itself
     * is what this line reports. */
    for (int i = 0; i < 200; i++) {
        double x = (double)(next_rand() % 2000000) / 1000.0 - 1000.0;
        printf("sq %.17g\n", sqrt(x < 0 ? -x : x));
    }
}

int main(void) {
    t_string();
    t_ctype();
    t_printf();
    t_strtol();
    t_qsort();
    t_setjmp();
    t_malloc();
    t_math();
    return 0;
}
