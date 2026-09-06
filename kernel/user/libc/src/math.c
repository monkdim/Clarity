#include <math.h>

/* The math the Clarity runtime's builtins reach for.
 *
 * Split by how they are obtained, because the accuracy differs and pretending
 * otherwise would be the wrong kind of tidy:
 *
 *   exact          fabs floor ceil round trunc fmod sqrt
 *   near-exact     log exp   (argument reduction plus a series whose
 *                             truncation error is far below one ulp)
 *   good           sin cos tan pow  (same, but with the extra error of
 *                             reducing modulo pi/2, and for pow the two
 *                             roundings of exp(y*log(x)))
 *
 * The measured worst case over the ranges the test sweeps is recorded in
 * kernel/user/libc/README.md. These are not claimed to be correctly rounded;
 * a correctly-rounded transcendental library is a much larger thing, and the
 * Clarity builtins that use these do not need it.
 */

typedef union { double d; unsigned long u; } Bits;

double fabs(double x) { Bits b; b.d = x; b.u &= 0x7FFFFFFFFFFFFFFFUL; return b.d; }

/* Exponent of the value, or a sentinel for zero. Used by the exact routines,
 * which work on the representation rather than on the value. */
static int exp_of(double x) { Bits b; b.d = x; return (int)((b.u >> 52) & 0x7FF) - 1023; }

static double trunc_(double x) {
    Bits b; b.d = x;
    int e = (int)((b.u >> 52) & 0x7FF) - 1023;
    if (e < 0) { b.u &= 0x8000000000000000UL; return b.d; }   /* |x| < 1 -> +-0 */
    if (e >= 52) return x;                                    /* already integral */
    unsigned long mask = 0x000FFFFFFFFFFFFFUL >> e;
    if ((b.u & mask) == 0) return x;
    b.u &= ~mask;
    return b.d;
}

double floor(double x) {
    double t = trunc_(x);
    if (x < 0 && t != x) t -= 1.0;
    return t;
}

double ceil(double x) {
    double t = trunc_(x);
    if (x > 0 && t != x) t += 1.0;
    return t;
}

/* ISO C round(): halfway cases go away from zero, not to even. */
double round(double x) {
    double t = trunc_(x);
    double diff = fabs(x - t);
    if (diff >= 0.5) t += (x < 0) ? -1.0 : 1.0;
    return t;
}

/* The hardware instruction, which IEEE 754 requires to be correctly rounded.
 * Writing a software square root here would be strictly worse — and both of
 * these architectures have one, so there is no case where it would be needed.
 *
 * Named explicitly rather than left to __builtin_sqrt, because this library
 * is built with -fno-builtin: the compiler is told not to recognise the
 * library's own functions, which stops it turning printf into puts, and the
 * same flag would stop it turning a call here into the instruction. */
double sqrt(double x) {
    double r;
#if defined(__x86_64__)
    __asm__("sqrtsd %1, %0" : "=x"(r) : "x"(x));
#elif defined(__aarch64__)
    __asm__("fsqrt %d0, %d1" : "=w"(r) : "w"(x));
#else
#error "no square root instruction for this architecture"
#endif
    return r;
}

/* Multiply by a power of two by adjusting the exponent field. Exact whenever
 * the result is normal, which is the only case the callers below produce. */
static double scale2(double x, int n) {
    Bits b; b.d = x;
    int e = (int)((b.u >> 52) & 0x7FF) + n;
    if (e <= 0) return x * 0.0;             /* underflow to a signed zero */
    if (e >= 0x7FF) return x * 1e308 * 1e308;
    b.u = (b.u & 0x800FFFFFFFFFFFFFUL) | ((unsigned long)e << 52);
    return b.d;
}

double fmod(double x, double y) {
    if (y == 0.0 || x != x || y != y) return (x - x) / (y - y);   /* NaN */
    double r = fabs(x), b = fabs(y);
    if (r < b) return x;

    /* Bring b up to the same binade as r, then walk it back down one power of
     * two at a time. Every subtraction is exact: at each step b <= r < 2b, and
     * Sterbenz's lemma says the difference of two such values is
     * representable. So this is fmod to the last bit, not an approximation. */
    int e = exp_of(r) - exp_of(b);
    double bb = scale2(b, e);
    for (; e >= 0; e--) {
        if (r >= bb) r -= bb;
        bb *= 0.5;
    }
    return (x < 0) ? -r : r;
}

/* ln 2 split so that the reduction x - k*ln2 keeps the bits the single
 * rounding of a one-part constant would lose. */
static const double LN2_HI = 6.93147180369123816490e-01;
static const double LN2_LO = 1.90821492927058770002e-10;

static double log_core(double x, double* out_lo) {
    if (out_lo) *out_lo = 0.0;
    if (x != x) return x;
    if (x < 0.0) return (x - x) / 0.0;      /* NaN */
    if (x == 0.0) return -1.0 / 0.0;        /* -inf */

    Bits b; b.d = x;
    int k = (int)((b.u >> 52) & 0x7FF) - 1023;
    if (k == -1023) {                        /* subnormal: normalise first */
        x *= 9007199254740992.0;             /* 2^53 */
        b.d = x;
        k = (int)((b.u >> 52) & 0x7FF) - 1023 - 53;
    }
    /* Mantissa into [sqrt(2)/2, sqrt(2)), where the series below is shortest. */
    b.u = (b.u & 0x800FFFFFFFFFFFFFUL) | (1023UL << 52);
    double m = b.d;
    if (m > 1.4142135623730951) { m *= 0.5; k += 1; }

    /* log(m) = 2*atanh(s) with s = (m-1)/(m+1). |s| <= 0.1716, and the sweep
     * against the host libm is what set the term count: stopping at s^17 left
     * 5 ulp near the top of that range, because s^19/19 is 1.3e-16 and log(m)
     * there is only 0.35. Through s^25 the next term is 2.5e-21. */
    double s = (m - 1.0) / (m + 1.0);
    double s2 = s * s;
    double p = 1.0 / 25.0;
    p = 1.0 / 23.0 + s2 * p;
    p = 1.0 / 21.0 + s2 * p;
    p = 1.0 / 19.0 + s2 * p;
    p = 1.0 / 17.0 + s2 * p;
    p = 1.0 / 15.0 + s2 * p;
    p = 1.0 / 13.0 + s2 * p;
    p = 1.0 / 11.0 + s2 * p;
    p = 1.0 /  9.0 + s2 * p;
    p = 1.0 /  7.0 + s2 * p;
    p = 1.0 /  5.0 + s2 * p;
    p = 1.0 /  3.0 + s2 * p;
    double lm = 2.0 * (s + s * s2 * p);

    /* k*LN2_HI is exact: LN2_HI is ln2 with its low 21 mantissa bits cleared,
     * and |k| never exceeds 1100 here. So the only rounding in the sum is the
     * final one — which is what log_split below hands back separately. */
    double big = (double)k * LN2_HI;
    double small = (double)k * LN2_LO + lm;
    if (out_lo) {
        /* Fast2Sum: the residual is exact, provided the larger magnitude is
         * the first addend — which is not automatic here, since k can be 0
         * and leave the series term as the only contribution. */
        if (fabs(big) < fabs(small)) { double t = big; big = small; small = t; }
        double hi = big + small;
        *out_lo = (big - hi) + small;
        return hi;
    }
    return big + small;
}

double log(double x) { return log_core(x, 0); }

double exp(double x) {
    if (x != x) return x;
    if (x > 709.782712893384) return 1e308 * 1e308;    /* overflow to +inf */
    if (x < -745.133219101941) return 0.0;             /* underflow */

    /* x = k*ln2 + r with |r| <= ln2/2, so exp(x) = 2^k * exp(r) and the
     * series only ever sees a small argument. */
    double kf = x * 1.4426950408889634;                /* 1/ln2 */
    int k = (int)(kf < 0 ? kf - 0.5 : kf + 0.5);
    double r = (x - (double)k * LN2_HI) - (double)k * LN2_LO;

    /* Horner from the smallest term upwards, so each rounding happens on a
     * value that is already small relative to the total rather than on the
     * running sum. |r| <= ln2/2, so r^13/13! is below 1e-19 and the series
     * stops there. */
    double p = 1.0 / 6227020800.0;
    p = 1.0 / 479001600.0 + r * p;
    p = 1.0 / 39916800.0  + r * p;
    p = 1.0 / 3628800.0   + r * p;
    p = 1.0 / 362880.0    + r * p;
    p = 1.0 / 40320.0     + r * p;
    p = 1.0 / 5040.0      + r * p;
    p = 1.0 / 720.0       + r * p;
    p = 1.0 / 120.0       + r * p;
    p = 1.0 / 24.0        + r * p;
    p = 1.0 / 6.0         + r * p;
    p = 0.5               + r * p;
    return scale2(1.0 + r * (1.0 + r * p), k);
}

/* Dekker's exact product: p is fl(a*b) and e is the part that rounding threw
 * away, so a*b == p + e with no error at all. Written with the 2^27+1 split
 * rather than with an FMA because plain x86-64 does not guarantee one — FMA
 * arrived with a later instruction set, and this has to run on the baseline. */
static void two_prod(double a, double b, double* p, double* e) {
    const double SPLIT = 134217729.0;   /* 2^27 + 1 */
    double c = SPLIT * a, ah = c - (c - a), al = a - ah;
    double d = SPLIT * b, bh = d - (d - b), bl = b - bh;
    *p = a * b;
    *e = ((ah * bh - *p) + ah * bl + al * bh) + al * bl;
}

/* exp(y * log(x)) for x > 0, carrying the product in two pieces.
 *
 * The naive version loses accuracy in proportion to |y*log(x)|, because
 * exp turns an absolute error in its argument into a relative error in its
 * result. For x around 1e30 the rounding of log(x) alone is 1.4e-14, and the
 * sweep against the host libm measured tens of ulp because of it. Keeping the
 * low half of both the logarithm and the product, and folding it back in as
 * exp(t)*(1+dt), removes that term. */
static double pow_pos(double x, double y) {
    double lo;
    double hi = log_core(x, &lo);
    double p, e;
    two_prod(y, hi, &p, &e);
    double dt = e + y * lo;
    double r = exp(p);
    /* dt is tiny by construction, so the first-order correction is the whole
     * of it; a second-order term would be below half an ulp. */
    return r * (1.0 + dt);
}

double pow(double x, double y) {
    if (y == 0.0) return 1.0;
    if (x != x || y != y) return x + y;                /* NaN propagates */
    if (y == 1.0) return x;
    if (x == 0.0) return (y > 0.0) ? 0.0 : 1.0 / 0.0;

    /* An integral exponent of modest size goes through binary exponentiation
     * rather than exp(y*log(x)). Two reasons, and the first is the one that
     * matters: when the intermediates are exactly representable the answer is
     * exact, so 2.0 ** 10.0 is 1024 and not 1023.9999999999999. The second is
     * that it avoids the two roundings of the exp/log path, which the sweep
     * measures at tens of ulp. */
    {
        double iy = trunc_(y);
        if (iy == y && iy >= -4096.0 && iy <= 4096.0) {
            long n = (long)iy;
            unsigned long k = (unsigned long)(n < 0 ? -n : n);
            double base = x, acc = 1.0;
            while (k) { if (k & 1) acc *= base; base *= base; k >>= 1; }
            return (n < 0) ? 1.0 / acc : acc;
        }
    }

    if (x < 0.0) {
        /* Defined only for integral y, where the sign is decided by parity.
         * The integral case above already covers |y| <= 4096, so reaching
         * here means a huge integral exponent, whose result is 0 or infinity
         * for any base but 1 — the parity still has to be right. */
        double iy = trunc_(y);
        if (iy != y) return (x - x) / 0.0;             /* NaN */
        double mag = pow_pos(-x, y);
        return (fmod(fabs(iy), 2.0) == 1.0) ? -mag : mag;
    }
    return pow_pos(x, y);
}

/* pi/2 in three pieces, so reducing x modulo pi/2 keeps about 150 bits of the
 * constant. That bounds the argument this stays accurate for: past roughly
 * 2^40 the reduction, not the series, is the error, which is the same
 * trade-off every non-exhaustive libm makes and is documented rather than
 * hidden. */
static const double PIO2_1 = 1.57079632673412561417e+00;
static const double PIO2_2 = 6.07710050650619224932e-11;
static const double PIO2_3 = 2.02226624879595063154e-21;

/* Term count is set by the worst case in the reduced range, |x| = pi/4.
 * Stopping at x^13 for sine leaves a truncation error of 4e-17 there, which
 * sounds small and is about 400 ulp of the result — the first version of this
 * did exactly that, and the sweep against the host libm reported thousands of
 * ulp before the series was extended. Through x^19 and x^18 the next term is
 * below 1e-19, comfortably under half an ulp. */
static double sin_kernel(double x) {   /* |x| <= pi/4 */
    double x2 = x * x;
    double p = -1.0 / 121645100408832000.0;
    p =  1.0 / 355687428096000.0 + x2 * p;
    p = -1.0 / 1307674368000.0   + x2 * p;
    p =  1.0 / 6227020800.0      + x2 * p;
    p = -1.0 / 39916800.0        + x2 * p;
    p =  1.0 / 362880.0          + x2 * p;
    p = -1.0 / 5040.0            + x2 * p;
    p =  1.0 / 120.0             + x2 * p;
    p = -1.0 / 6.0               + x2 * p;
    return x + x * x2 * p;
}

static double cos_kernel(double x) {   /* |x| <= pi/4 */
    double x2 = x * x;
    double p = -1.0 / 6402373705728000.0;
    p =  1.0 / 20922789888000.0 + x2 * p;
    p = -1.0 / 87178291200.0    + x2 * p;
    p =  1.0 / 479001600.0      + x2 * p;
    p = -1.0 / 3628800.0        + x2 * p;
    p =  1.0 / 40320.0          + x2 * p;
    p = -1.0 / 720.0            + x2 * p;
    p =  1.0 / 24.0             + x2 * p;
    return 1.0 - 0.5 * x2 + x2 * x2 * p;
}

/* Reduce x to r in [-pi/4, pi/4] and report the quadrant. */
static int reduce_pio2(double x, double* r) {
    double q = x * 0.6366197723675814;                 /* 2/pi */
    long n = (long)(q < 0 ? q - 0.5 : q + 0.5);
    double t = x - (double)n * PIO2_1;
    t = t - (double)n * PIO2_2;
    t = t - (double)n * PIO2_3;
    *r = t;
    return (int)(n & 3);
}

double sin(double x) {
    if (x != x || x - x != 0.0) return (x - x) / (x - x);   /* NaN or inf -> NaN */
    double r;
    switch (reduce_pio2(x, &r)) {
    case 0:  return sin_kernel(r);
    case 1:  return cos_kernel(r);
    case 2:  return -sin_kernel(r);
    default: return -cos_kernel(r);
    }
}

double cos(double x) {
    if (x != x || x - x != 0.0) return (x - x) / (x - x);
    double r;
    switch (reduce_pio2(x, &r)) {
    case 0:  return cos_kernel(r);
    case 1:  return -sin_kernel(r);
    case 2:  return -cos_kernel(r);
    default: return sin_kernel(r);
    }
}

double tan(double x) {
    double s = sin(x), c = cos(x);
    return s / c;
}
