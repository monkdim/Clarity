#include "bignum.h"
#include "dtoa.h"

/* Exact decimal digits of a double.
 *
 * A finite double is m * 2^e with m a 53-bit integer, so its decimal
 * expansion is finite and exactly computable — no approximation is involved
 * anywhere below, and none is permitted: the caller (the Clarity runtime's
 * shortest-round-trip loop) decides how many digits to keep by checking
 * whether strtod maps them back to the same double, and that check is only
 * meaningful if the digits it is given are the true ones.
 *
 * The value is held as NUM/DEN with both exact integers, normalised so that
 * DEN <= NUM < 10*DEN. Then each digit is one round of schoolbook long
 * division: subtract DEN while it fits (at most nine times), emit the count,
 * multiply NUM by ten. Only compare, subtract and multiply-by-small are
 * needed — there is no big-by-big division here.
 */

/* Static, not stack: the pair is 1.7 KiB and the user stack a compiled
 * Clarity program gets from the kernel is measured in pages. Single-threaded,
 * so there is nothing to share them with. */
static BN NUM, DEN, TMP;

void cl_dtoa(double x, int ndig, char* digits, int* dec_exp) {
    union { double d; unsigned long u; } bits;
    bits.d = x;

    unsigned long frac = bits.u & 0x000FFFFFFFFFFFFFUL;
    int          be   = (int)((bits.u >> 52) & 0x7FF);

    unsigned long m;
    int e;
    if (be == 0) { m = frac; e = -1074; }               /* subnormal */
    else         { m = frac | 0x0010000000000000UL; e = be - 1075; }

    if (m == 0) { digits[0] = '0'; digits[1] = 0; *dec_exp = 0; return; }

    if (ndig < 1) ndig = 1;
    if (ndig > CL_DTOA_MAX_DIGITS) ndig = CL_DTOA_MAX_DIGITS;

    bn_set_u64(&NUM, m);
    bn_set_u64(&DEN, 1);
    if (e >= 0) bn_shl(&NUM, (unsigned int)e);
    else        bn_shl(&DEN, (unsigned int)(-e));

    /* Normalise to DEN <= NUM < 10*DEN, counting the decimal exponent. */
    int decexp = 0;
    for (;;) {
        bn_copy(&TMP, &DEN);
        bn_mul_small(&TMP, 10);
        if (bn_cmp(&NUM, &TMP) < 0) break;
        bn_copy(&DEN, &TMP);
        decexp++;
    }
    while (bn_cmp(&NUM, &DEN) < 0) { bn_mul_small(&NUM, 10); decexp--; }

    /* One extra digit beyond what was asked for, to round with. */
    int want = ndig + 1;
    char buf[CL_DTOA_MAX_DIGITS + 2];
    for (int i = 0; i < want; i++) {
        int d = 0;
        while (bn_cmp(&NUM, &DEN) >= 0) { bn_sub(&NUM, &DEN); d++; }
        buf[i] = (char)('0' + d);
        bn_mul_small(&NUM, 10);
    }

    /* Round half to even, which is what a correctly-rounded printf does and
     * what glibc does — a tie broken the other way would disagree with every
     * hosted build of the same program. `sticky` says whether anything at all
     * remains beyond the digit being examined, which is what separates a true
     * tie from a value just above one. */
    int sticky = !bn_is_zero(&NUM);
    int extra  = buf[ndig] - '0';
    int round_up = 0;
    if (extra > 5) round_up = 1;
    else if (extra == 5) round_up = sticky || ((buf[ndig - 1] - '0') & 1);

    if (round_up) {
        int i = ndig - 1;
        for (; i >= 0; i--) {
            if (buf[i] != '9') { buf[i]++; break; }
            buf[i] = '0';
        }
        /* Carried off the front: 999 -> 1000, one digit wider and one decimal
         * exponent higher. Only the leading 1 survives the truncation. */
        if (i < 0) { buf[0] = '1'; decexp++; }
    }

    for (int i = 0; i < ndig; i++) digits[i] = buf[i];
    digits[ndig] = 0;
    *dec_exp = decexp;
}
