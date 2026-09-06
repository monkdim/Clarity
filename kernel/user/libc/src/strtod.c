#include <stdlib.h>
#include <ctype.h>
#include "bignum.h"

/* Decimal string to the nearest double, exactly.
 *
 * The same reasoning as dtoa.c, run backwards. The parsed digits give an
 * exact rational D * 10^E, held as NUM/DEN with DEN a power of ten. The
 * result is then the 53 leading bits of NUM/DEN, obtained by binary long
 * division — compare, subtract, shift — with the bit after them and a sticky
 * flag deciding the rounding. Nothing here is approximate, so
 * strtod(printf("%.17g", x)) == x for every finite x, which is the property
 * the Clarity runtime's shortest-round-trip loop depends on.
 */

static BN NUM, DEN, TMP;

/* 768 decimal digits is the most that can ever change which double a string
 * rounds to (it is the width of the widest exact tie, a subnormal midpoint).
 * Digits past that are only ever a tiebreak signal, which `sticky` carries. */
#define MAX_SIG 768

static double make_double(int neg, unsigned long bits) {
    union { double d; unsigned long u; } out;
    out.u = bits | ((unsigned long)(neg != 0) << 63);
    return out.d;
}

double strtod(const char* s, char** end) {
    const char* p = s;
    while (isspace((unsigned char)*p)) p++;

    int neg = 0;
    if (*p == '+' || *p == '-') { neg = (*p == '-'); p++; }

    /* Collect significant digits and the decimal exponent they imply. */
    bn_set_u64(&NUM, 0);
    int nsig = 0;              /* significant digits accumulated into NUM */
    int exp10 = 0;             /* power of ten NUM must still be scaled by */
    int seen_digit = 0;
    int sticky = 0;            /* a nonzero digit was dropped past MAX_SIG */
    int leading = 1;           /* still skipping zeros before the first 1..9 */

    for (; *p >= '0' && *p <= '9'; p++) {
        seen_digit = 1;
        if (leading && *p == '0') continue;
        leading = 0;
        if (nsig < MAX_SIG) { bn_mul_small(&NUM, 10); bn_add_small(&NUM, (unsigned int)(*p - '0')); nsig++; }
        else { if (*p != '0') sticky = 1; exp10++; }
    }
    if (*p == '.') {
        p++;
        for (; *p >= '0' && *p <= '9'; p++) {
            seen_digit = 1;
            if (leading && *p == '0') { exp10--; continue; }
            leading = 0;
            if (nsig < MAX_SIG) { bn_mul_small(&NUM, 10); bn_add_small(&NUM, (unsigned int)(*p - '0')); nsig++; exp10--; }
            else if (*p != '0') sticky = 1;
        }
    }
    if (!seen_digit) { if (end) *end = (char*)s; return 0.0; }

    if (*p == 'e' || *p == 'E') {
        const char* q = p + 1;
        int eneg = 0;
        if (*q == '+' || *q == '-') { eneg = (*q == '-'); q++; }
        if (*q >= '0' && *q <= '9') {
            long ev = 0;
            for (; *q >= '0' && *q <= '9'; q++) {
                /* Clamp rather than overflow: any exponent past a few
                 * thousand already decides the answer (zero or infinity), and
                 * a wrapped one would decide it wrongly. */
                if (ev < 100000L) ev = ev * 10 + (*q - '0');
            }
            exp10 += (int)(eneg ? -ev : ev);
            p = q;
        }
    }
    if (end) *end = (char*)p;

    if (bn_is_zero(&NUM)) return make_double(neg, 0);

    /* Out of range before any work: 10^309 overflows and 10^-400 underflows
     * for any 768-digit mantissa, so these cannot be near a boundary. */
    if (exp10 + nsig > 400)  return make_double(neg, 0x7FF0000000000000UL);
    if (exp10 + nsig < -400) return make_double(neg, 0);

    bn_set_u64(&DEN, 1);
    if (exp10 > 0)      bn_mul_pow10(&NUM, (unsigned int)exp10);
    else if (exp10 < 0) bn_pow10(&DEN, (unsigned int)(-exp10));

    /* Normalise to DEN <= NUM < 2*DEN, so NUM/DEN is in [1,2) and the value
     * is (NUM/DEN) * 2^exp2. The shift is computed from the bit lengths in
     * one step, then corrected by at most one. */
    int exp2 = 0;
    int bn_n = (int)bn_bits(&NUM);
    int bn_d = (int)bn_bits(&DEN);
    int shift = bn_d - bn_n;
    if (shift > 0) { bn_shl(&NUM, (unsigned int)shift); exp2 -= shift; }
    else if (shift < 0) { bn_shl(&DEN, (unsigned int)(-shift)); exp2 += -shift; }
    while (bn_cmp(&NUM, &DEN) < 0) { bn_shl(&NUM, 1); exp2--; }
    for (;;) {
        bn_copy(&TMP, &DEN);
        bn_shl(&TMP, 1);
        if (bn_cmp(&NUM, &TMP) < 0) break;
        bn_copy(&DEN, &TMP);
        exp2++;
    }

    if (exp2 > 1023) return make_double(neg, 0x7FF0000000000000UL);

    /* How many mantissa bits this exponent can carry. Below the smallest
     * normal the mantissa is squeezed, one bit per power of two, which is
     * what makes subnormals lose precision — and getting that wrong here
     * would round every subnormal to the wrong neighbour. */
    int nbits = (exp2 >= -1022) ? 53 : 53 - (-1022 - exp2);
    if (nbits < 1) {
        /* Below half the smallest subnormal, or exactly at it. The two
         * candidates are 0 and 2^-1074; the midpoint is 2^-1075, and an exact
         * midpoint goes to the even one, which is 0. */
        if (exp2 == -1075 && bn_cmp(&NUM, &DEN) > 0) return make_double(neg, 1);
        if (exp2 > -1075) return make_double(neg, 1);
        return make_double(neg, 0);
    }

    unsigned long mant = 0;
    for (int i = 0; i < nbits; i++) {
        mant <<= 1;
        if (bn_cmp(&NUM, &DEN) >= 0) { bn_sub(&NUM, &DEN); mant |= 1; }
        bn_shl(&NUM, 1);
    }

    /* The bit after the mantissa, and whether anything follows it. */
    int round_bit = 0;
    if (bn_cmp(&NUM, &DEN) >= 0) { bn_sub(&NUM, &DEN); round_bit = 1; }
    if (!bn_is_zero(&NUM)) sticky = 1;
    if (round_bit && (sticky || (mant & 1))) mant++;

    /* Assemble. Adding the mantissa to the shifted exponent rather than
     * OR-ing it means a mantissa that carried past its width — 0x1FFF... + 1
     * — spills into the exponent field and produces exactly the right next
     * double, including the subnormal-to-normal step, with no special case. */
    unsigned long bits;
    if (exp2 >= -1022) bits = ((unsigned long)(exp2 + 1023) << 52) + (mant - 0x0010000000000000UL);
    else               bits = mant;
    if ((bits & 0x7FF0000000000000UL) == 0x7FF0000000000000UL) bits = 0x7FF0000000000000UL;
    return make_double(neg, bits);
}
