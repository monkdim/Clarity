#ifndef _CLARITY_CTYPE_H
#define _CLARITY_CTYPE_H

/* ASCII only. The Clarity runtime feeds these `(unsigned char)` values from
   byte strings, and a locale-aware version would need a locale, which needs
   an operating system. */
int isdigit(int c);
int isalpha(int c);
int isalnum(int c);
int isspace(int c);
int isupper(int c);
int islower(int c);
int toupper(int c);
int tolower(int c);

#endif
