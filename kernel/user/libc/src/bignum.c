#include "bignum.h"

static void bn_trim(BN* a) { while (a->n && a->v[a->n - 1] == 0) a->n--; }

void bn_copy(BN* dst, const BN* src) {
    dst->n = src->n;
    for (unsigned int i = 0; i < src->n; i++) dst->v[i] = src->v[i];
}

void bn_set_u64(BN* a, unsigned long x) {
    a->n = 0;
    if (x) { a->v[a->n++] = (unsigned int)(x & 0xFFFFFFFFUL); }
    if (x >> 32) { a->v[a->n++] = (unsigned int)(x >> 32); }
}

int bn_is_zero(const BN* a) { return a->n == 0; }

unsigned int bn_bits(const BN* a) {
    if (a->n == 0) return 0;
    unsigned int top = a->v[a->n - 1];
    unsigned int b = 0;
    while (top) { b++; top >>= 1; }
    return (a->n - 1) * 32 + b;
}

void bn_shl(BN* a, unsigned int k) {
    if (a->n == 0 || k == 0) return;
    unsigned int limbs = k / 32, bits = k % 32;
    unsigned int need = a->n + limbs + (bits ? 1 : 0);
    if (need > BN_LIMBS) { a->n = 0; return; }   /* caller sized this wrong */
    if (bits) {
        unsigned int carry = 0;
        for (unsigned int i = 0; i < a->n; i++) {
            unsigned long w = ((unsigned long)a->v[i] << bits) | carry;
            a->v[i] = (unsigned int)(w & 0xFFFFFFFFUL);
            carry = (unsigned int)(w >> 32);
        }
        if (carry) a->v[a->n++] = carry;
    }
    if (limbs) {
        for (unsigned int i = a->n; i > 0; i--) a->v[i - 1 + limbs] = a->v[i - 1];
        for (unsigned int i = 0; i < limbs; i++) a->v[i] = 0;
        a->n += limbs;
    }
}

void bn_shr(BN* a, unsigned int k) {
    if (a->n == 0 || k == 0) return;
    unsigned int limbs = k / 32, bits = k % 32;
    if (limbs >= a->n) { a->n = 0; return; }
    for (unsigned int i = 0; i + limbs < a->n; i++) a->v[i] = a->v[i + limbs];
    a->n -= limbs;
    if (bits) {
        for (unsigned int i = 0; i < a->n; i++) {
            unsigned int hi = (i + 1 < a->n) ? a->v[i + 1] : 0;
            a->v[i] = (a->v[i] >> bits) | (unsigned int)((unsigned long)hi << (32 - bits));
        }
    }
    bn_trim(a);
}

void bn_mask(BN* a, unsigned int k) {
    unsigned int limbs = k / 32, bits = k % 32;
    if (limbs >= a->n) return;
    if (bits) { a->v[limbs] &= (unsigned int)((1UL << bits) - 1UL); a->n = limbs + 1; }
    else      { a->n = limbs; }
    bn_trim(a);
}

int bn_cmp(const BN* a, const BN* b) {
    if (a->n != b->n) return a->n < b->n ? -1 : 1;
    for (unsigned int i = a->n; i > 0; i--)
        if (a->v[i - 1] != b->v[i - 1]) return a->v[i - 1] < b->v[i - 1] ? -1 : 1;
    return 0;
}

void bn_sub(BN* a, const BN* b) {
    unsigned long borrow = 0;
    for (unsigned int i = 0; i < a->n; i++) {
        unsigned long bi = (i < b->n) ? b->v[i] : 0;
        unsigned long d = (unsigned long)a->v[i] - bi - borrow;
        a->v[i] = (unsigned int)(d & 0xFFFFFFFFUL);
        borrow = (d >> 63) & 1UL;   /* the subtraction wrapped */
    }
    bn_trim(a);
}

void bn_mul_small(BN* a, unsigned int m) {
    if (a->n == 0 || m == 1) return;
    if (m == 0) { a->n = 0; return; }
    unsigned long carry = 0;
    for (unsigned int i = 0; i < a->n; i++) {
        unsigned long w = (unsigned long)a->v[i] * m + carry;
        a->v[i] = (unsigned int)(w & 0xFFFFFFFFUL);
        carry = w >> 32;
    }
    while (carry && a->n < BN_LIMBS) { a->v[a->n++] = (unsigned int)(carry & 0xFFFFFFFFUL); carry >>= 32; }
}

void bn_add_small(BN* a, unsigned int x) {
    unsigned long carry = x;
    for (unsigned int i = 0; i < a->n && carry; i++) {
        unsigned long w = (unsigned long)a->v[i] + carry;
        a->v[i] = (unsigned int)(w & 0xFFFFFFFFUL);
        carry = w >> 32;
    }
    if (carry && a->n < BN_LIMBS) a->v[a->n++] = (unsigned int)carry;
}

unsigned int bn_divmod_small(BN* a, unsigned int d) {
    unsigned long rem = 0;
    for (unsigned int i = a->n; i > 0; i--) {
        unsigned long cur = (rem << 32) | a->v[i - 1];
        a->v[i - 1] = (unsigned int)(cur / d);
        rem = cur % d;
    }
    bn_trim(a);
    return (unsigned int)rem;
}

void bn_mul_pow10(BN* a, unsigned int k) {
    /* Nine digits at a time: 10^9 is the largest power of ten that fits in a
     * 32-bit limb multiplier, so this is one bn_mul_small per nine zeros
     * rather than per zero. */
    static const unsigned int p10[9] = {1u, 10u, 100u, 1000u, 10000u, 100000u, 1000000u, 10000000u, 100000000u};
    while (k >= 9) { bn_mul_small(a, 1000000000u); k -= 9; }
    if (k) bn_mul_small(a, p10[k]);
}

void bn_pow10(BN* a, unsigned int k) {
    bn_set_u64(a, 1);
    bn_mul_pow10(a, k);
}

unsigned long bn_low64(const BN* a) {
    unsigned long lo = (a->n > 0) ? a->v[0] : 0;
    unsigned long hi = (a->n > 1) ? a->v[1] : 0;
    return lo | (hi << 32);
}
