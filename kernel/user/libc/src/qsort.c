#include <stdlib.h>
#include <string.h>

/* Median-of-three quicksort with an insertion-sort cutoff, on raw bytes.
 *
 * The Clarity runtime calls this from exactly one place — the collector's
 * index sort, which sorts an array of pointers so a mark can find its object
 * by binary search. That array is already nearly sorted in practice
 * (allocation order is address order under a bump arena), which is the case
 * plain quicksort with a first-element pivot degrades to O(n^2) on. Hence
 * median-of-three, which turns the nearly-sorted case into the good case.
 *
 * Not stable, which ISO C does not require of qsort.
 */

static void swap_bytes(char* a, char* b, size_t size) {
    for (size_t i = 0; i < size; i++) { char t = a[i]; a[i] = b[i]; b[i] = t; }
}

static char* elem(void* base, size_t i, size_t size) { return (char*)base + i * size; }

static void insertion(void* base, size_t n, size_t size, int (*cmp)(const void*, const void*)) {
    for (size_t i = 1; i < n; i++)
        for (size_t j = i; j > 0 && cmp(elem(base, j - 1, size), elem(base, j, size)) > 0; j--)
            swap_bytes(elem(base, j - 1, size), elem(base, j, size), size);
}

void qsort(void* base, size_t n, size_t size, int (*cmp)(const void*, const void*)) {
    /* Iterative on the larger half, recursive on the smaller, so the stack
     * depth is bounded by log2(n) — about 40 frames for any array that fits
     * in memory. Recursing on both halves would be simpler and would risk a
     * stack overflow on an adversarial input, which on a kernel-provided
     * 8 KiB user stack is not a theoretical worry. */
    while (n > 12) {
        size_t mid = n / 2;
        char* a = elem(base, 0, size);
        char* b = elem(base, mid, size);
        char* c = elem(base, n - 1, size);
        /* Median of three into position 0. */
        if (cmp(a, b) > 0) swap_bytes(a, b, size);
        if (cmp(b, c) > 0) { swap_bytes(b, c, size); if (cmp(a, b) > 0) swap_bytes(a, b, size); }
        swap_bytes(a, b, size);

        size_t lo = 1, hi = n;
        for (;;) {
            while (lo < hi && cmp(elem(base, lo, size), elem(base, 0, size)) <= 0) lo++;
            while (lo < hi && cmp(elem(base, hi - 1, size), elem(base, 0, size)) > 0) hi--;
            if (lo >= hi) break;
            swap_bytes(elem(base, lo, size), elem(base, hi - 1, size), size);
        }
        swap_bytes(elem(base, 0, size), elem(base, lo - 1, size), size);

        size_t left = lo - 1;
        size_t right = n - lo;
        if (left < right) { qsort(base, left, size, cmp); base = elem(base, lo, size); n = right; }
        else              { qsort(elem(base, lo, size), right, size, cmp); n = left; }
    }
    insertion(base, n, size, cmp);
}
