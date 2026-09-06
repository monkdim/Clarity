/* A fixed-size unsigned big integer, used only by the two float conversions.
 *
 * printf("%.17g", x) and strtod(s) have to agree exactly, or the Clarity
 * runtime's shortest-round-trip loop never terminates and every float prints
 * with 17 digits — or worse, prints something that reads back as a different
 * number. Getting that agreement with double arithmetic is not possible: the
 * error in computing 10^k in double is at the sixteenth digit, which is
 * precisely where the answer is decided. So both directions are done on exact
 * integers instead, and the only operations needed are shift, compare,
 * subtract, multiply by a small value, and divide by a small value.
 *
 * 220 limbs is 7040 bits. The widest intermediate is a 768-digit decimal
 * mantissa (2551 bits, the most digits that can distinguish two doubles)
 * shifted left far enough to normalise against a 10^342 denominator — well
 * inside that. Sized once, checked by an assertion at the two places that
 * could overflow it.
 */
#ifndef _CLARITY_BIGNUM_H
#define _CLARITY_BIGNUM_H

#define BN_LIMBS 220

typedef struct {
    unsigned int n;                  /* limbs in use; 0 means the value is 0 */
    unsigned int v[BN_LIMBS];        /* little-endian base 2^32 */
} BN;

void         bn_set_u64(BN* a, unsigned long x);
int          bn_is_zero(const BN* a);
unsigned int bn_bits(const BN* a);           /* position of the highest set bit + 1 */
void         bn_shl(BN* a, unsigned int k);
int          bn_cmp(const BN* a, const BN* b);
void         bn_sub(BN* a, const BN* b);     /* a -= b, requires a >= b */
void         bn_mul_small(BN* a, unsigned int m);
void         bn_add_small(BN* a, unsigned int x);
unsigned int bn_divmod_small(BN* a, unsigned int d);   /* a /= d, returns remainder */
void         bn_pow10(BN* a, unsigned int k);
void         bn_mul_pow10(BN* a, unsigned int k);
unsigned long bn_low64(const BN* a);
void         bn_shr(BN* a, unsigned int k);
void         bn_copy(BN* dst, const BN* src);
/* Keep only the low k bits. */
void         bn_mask(BN* a, unsigned int k);

#endif
