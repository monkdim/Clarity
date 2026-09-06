#ifndef _CLARITY_MATH_H
#define _CLARITY_MATH_H

/* Only what the Clarity runtime's math builtins reach for. Every one of these
   is a double-precision function of one or two doubles; there is no float
   variant, no long double, and no errno reporting — the runtime does not read
   errno, and a target with no operating system has nowhere to keep it. */
double fabs(double x);
double floor(double x);
double ceil(double x);
double round(double x);
double fmod(double x, double y);
double sqrt(double x);
double sin(double x);
double cos(double x);
double tan(double x);
double log(double x);
double exp(double x);
double pow(double x, double y);

#endif
