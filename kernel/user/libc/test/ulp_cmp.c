/* Compare two math_probe outputs and report the largest disagreement per
 * function, in units in the last place.
 *
 * ULP distance is counted on the sign-magnitude-to-ordinal mapping of the bit
 * pattern, which is the standard way: adjacent doubles differ by 1 whatever
 * their exponent, so one number covers the whole range without having to say
 * "relative error, except near zero, except across a binade boundary".
 *
 * Built with the host compiler — it is the measuring instrument, not part of
 * what is measured.
 */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

static long ordinal(unsigned long u) {
    /* Negative zero and negative values fold onto the reflected side, so the
     * distance across zero comes out as one rather than as 2^63. */
    return (u < (1UL << 63)) ? (long)u : -(long)(u - (1UL << 63)) - 1;
}

#define MAXF 32

int main(int argc, char** argv) {
    if (argc != 3) { fprintf(stderr, "usage: ulp_cmp <a> <b>\n"); return 2; }
    FILE* fa = fopen(argv[1], "r");
    FILE* fb = fopen(argv[2], "r");
    if (!fa || !fb) { fprintf(stderr, "ulp_cmp: cannot open inputs\n"); return 2; }

    char names[MAXF][32];
    unsigned long worst[MAXF];
    long counts[MAXF];
    int nf = 0;

    char la[256], lb[256];
    long line = 0;
    while (fgets(la, sizeof(la), fa) && fgets(lb, sizeof(lb), fb)) {
        line++;
        char na[32], nb[32], xa[64], xb[64], ha[32], hb[32];
        if (sscanf(la, "%31s %63s %31s", na, xa, ha) != 3) continue;
        if (sscanf(lb, "%31s %63s %31s", nb, xb, hb) != 3) continue;
        if (strcmp(na, nb) != 0 || strcmp(xa, xb) != 0) {
            fprintf(stderr, "ulp_cmp: inputs diverge at line %ld\n", line);
            return 2;
        }
        unsigned long ua = strtoul(ha, 0, 16), ub = strtoul(hb, 0, 16);
        long d = ordinal(ua) - ordinal(ub);
        if (d < 0) d = -d;

        int k = 0;
        for (; k < nf; k++) if (strcmp(names[k], na) == 0) break;
        if (k == nf) { if (nf == MAXF) continue; strcpy(names[nf], na); worst[nf] = 0; counts[nf] = 0; nf++; }
        counts[k]++;
        if ((unsigned long)d > worst[k]) worst[k] = (unsigned long)d;
    }
    if (line == 0) { fprintf(stderr, "ulp_cmp: no comparable lines\n"); return 2; }
    for (int k = 0; k < nf; k++) printf("%s %lu %ld\n", names[k], worst[k], counts[k]);
    return 0;
}
