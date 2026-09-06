#ifndef _CLARITY_DTOA_H
#define _CLARITY_DTOA_H

/* 17 significant digits distinguish every pair of doubles, and the Clarity
 * runtime never asks for more. A little headroom above that costs nothing. */
#define CL_DTOA_MAX_DIGITS 24

/* Write exactly `ndig` significant decimal digits of |x| into `digits` (NUL
 * terminated) and set *dec_exp so the value is digits[0].digits[1..] x
 * 10^(*dec_exp). x must be finite and is used without its sign. Correctly
 * rounded, ties to even. */
void cl_dtoa(double x, int ndig, char* digits, int* dec_exp);

#endif
