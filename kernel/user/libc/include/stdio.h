#ifndef _CLARITY_STDIO_H
#define _CLARITY_STDIO_H
#include <stddef.h>
#include <stdarg.h>

/* No FILE, no stderr, no fopen. `clarity cc --freestanding` emits only these
   three, and printf writes straight to file descriptor 1 through the kernel's
   write syscall — there is nothing to flush and nothing to buffer. */
int printf(const char* fmt, ...);
int snprintf(char* buf, size_t size, const char* fmt, ...);
int sprintf(char* buf, const char* fmt, ...);
int vsnprintf(char* buf, size_t size, const char* fmt, va_list ap);

#endif
