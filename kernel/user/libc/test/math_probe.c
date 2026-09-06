/* A deterministic sweep of the transcendental functions, printed as exact bit
 * patterns.
 *
 * Unlike the string and float-conversion probes, this one is not required to
 * match the host's libm exactly: sin, cos, tan, log, exp and pow here are
 * series approximations, and the host's are not. What the test asserts is a
 * bound on how far apart they are, in units in the last place, measured by
 * ulp_cmp.c. The bounds in stdlib/test_libc.clarity are the measured numbers
 * with a small margin, so a change that makes any of these functions worse
 * fails rather than silently drifting.
 */
#include <stdio.h>
#include <math.h>

typedef union { double d; unsigned long u; } B;

static unsigned long rng = 99194853094755497UL;
static unsigned long nr(void) { rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17; return rng; }

static void p(const char* n, double x, double y) { B b; b.d = y; printf("%s %.17g %016lx\n", n, x, b.u); }

int main(void) {
    for (int i = 0; i < 3000; i++) {
        double x = (double)(nr() % 2000000) / 100000.0 - 10.0;          /* [-10, 10] */
        p("sin", x, sin(x)); p("cos", x, cos(x)); p("tan", x, tan(x));
    }
    for (int i = 0; i < 3000; i++) {
        double x = (double)(nr() % 1000000) / 100000.0 + 1e-3;          /* (0, 10] */
        p("log", x, log(x)); p("exp", x - 5.0, exp(x - 5.0));
    }
    for (int i = 0; i < 2000; i++) {
        double b2 = (double)(nr() % 100000) / 1000.0 + 0.001;
        double e2 = (double)(nr() % 20000) / 1000.0 - 10.0;
        p("pow", b2, pow(b2, e2));
    }
    /* Large arguments, where the limit is the reduction rather than the
     * series: the absolute error stays around 1e-15, so the *relative* error
     * blows up wherever sine is near a zero. That is why sinbig has its own
     * much wider bound — it is a property of reducing modulo pi/2 in double,
     * not a defect that a longer series would fix. */
    for (int i = 0; i < 2000; i++) {
        double x = (double)(nr() % 1000000000UL) / 1000.0;              /* up to 1e6 */
        p("sinbig", x, sin(x)); p("logbig", x + 1.0, log(x + 1.0));
    }
    return 0;
}
