#include <ctype.h>

/* Range tests rather than a table: the table is 257 bytes and one indirection
 * faster, and neither matters at the call sites the Clarity runtime has
 * (is_digit over a short string, upper/lower over a name). Arguments arrive
 * as (unsigned char) values from the runtime, so the negative-argument case
 * ISO C leaves undefined cannot occur here; the tests are written so it would
 * simply answer false if it did. */

int isdigit(int c) { return c >= '0' && c <= '9'; }
int isupper(int c) { return c >= 'A' && c <= 'Z'; }
int islower(int c) { return c >= 'a' && c <= 'z'; }
int isalpha(int c) { return isupper(c) || islower(c); }
int isalnum(int c) { return isalpha(c) || isdigit(c); }
int isspace(int c) { return c == ' ' || c == '\t' || c == '\n' || c == '\v' || c == '\f' || c == '\r'; }
int toupper(int c) { return islower(c) ? c - 'a' + 'A' : c; }
int tolower(int c) { return isupper(c) ? c - 'A' + 'a' : c; }
