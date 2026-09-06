#include <string.h>

/* Byte-at-a-time throughout. A word-at-a-time memcpy is two to eight times
 * faster and is the obvious next change, but it has alignment and overlap
 * cases that want their own tests; this version is small enough to read and
 * verify by inspection, which is the right first property for the layer
 * everything else sits on.
 */

size_t strlen(const char* s) {
    const char* p = s;
    while (*p) p++;
    return (size_t)(p - s);
}

char* strcpy(char* dst, const char* src) {
    char* d = dst;
    while ((*d++ = *src++)) {}
    return dst;
}

char* strncpy(char* dst, const char* src, size_t n) {
    size_t i = 0;
    for (; i < n && src[i]; i++) dst[i] = src[i];
    /* ISO C: pad with NULs to exactly n, and do not terminate if src filled it. */
    for (; i < n; i++) dst[i] = 0;
    return dst;
}

char* strcat(char* dst, const char* src) {
    char* d = dst + strlen(dst);
    while ((*d++ = *src++)) {}
    return dst;
}

int strcmp(const char* a, const char* b) {
    /* Compared as unsigned char, which ISO C requires: signed chars would put
     * every byte above 0x7F on the wrong side of the comparison, and the
     * Clarity runtime compares map keys with this. */
    const unsigned char* x = (const unsigned char*)a;
    const unsigned char* y = (const unsigned char*)b;
    while (*x && *x == *y) { x++; y++; }
    return (int)*x - (int)*y;
}

int strncmp(const char* a, const char* b, size_t n) {
    const unsigned char* x = (const unsigned char*)a;
    const unsigned char* y = (const unsigned char*)b;
    for (size_t i = 0; i < n; i++) {
        if (x[i] != y[i]) return (int)x[i] - (int)y[i];
        if (!x[i]) return 0;
    }
    return 0;
}

char* strchr(const char* s, int c) {
    char want = (char)c;
    for (;; s++) {
        if (*s == want) return (char*)s;
        if (!*s) return 0;   /* c == 0 matches the terminator, per ISO C */
    }
}

char* strstr(const char* hay, const char* needle) {
    if (!*needle) return (char*)hay;
    for (; *hay; hay++) {
        const char* h = hay;
        const char* n = needle;
        while (*h && *n && *h == *n) { h++; n++; }
        if (!*n) return (char*)hay;
    }
    return 0;
}

void* memcpy(void* dst, const void* src, size_t n) {
    unsigned char* d = (unsigned char*)dst;
    const unsigned char* s = (const unsigned char*)src;
    for (size_t i = 0; i < n; i++) d[i] = s[i];
    return dst;
}

void* memmove(void* dst, const void* src, size_t n) {
    unsigned char* d = (unsigned char*)dst;
    const unsigned char* s = (const unsigned char*)src;
    if (d == s || n == 0) return dst;
    /* Copy backwards only when the regions overlap with dst above src;
     * forwards is correct in every other case, including no overlap. */
    if (d < s) { for (size_t i = 0; i < n; i++) d[i] = s[i]; }
    else       { for (size_t i = n; i > 0; i--) d[i - 1] = s[i - 1]; }
    return dst;
}

void* memset(void* dst, int c, size_t n) {
    unsigned char* d = (unsigned char*)dst;
    unsigned char v = (unsigned char)c;
    for (size_t i = 0; i < n; i++) d[i] = v;
    return dst;
}

int memcmp(const void* a, const void* b, size_t n) {
    const unsigned char* x = (const unsigned char*)a;
    const unsigned char* y = (const unsigned char*)b;
    for (size_t i = 0; i < n; i++) if (x[i] != y[i]) return (int)x[i] - (int)y[i];
    return 0;
}
