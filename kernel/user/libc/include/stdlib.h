#ifndef _CLARITY_STDLIB_H
#define _CLARITY_STDLIB_H
#include <stddef.h>

/* RAND_MAX is 2^31-1, matching the xorshift generator in rand.c. The Clarity
   runtime divides by it to get a unit float, so the value has to be the real
   maximum the generator can produce or random() would never reach 1.0. */
#define RAND_MAX 2147483647

void* malloc(size_t n);
void* calloc(size_t count, size_t size);
void* realloc(void* p, size_t n);
void  free(void* p);

void  exit(int code) __attribute__((noreturn));
void  abort(void) __attribute__((noreturn));

long   strtol(const char* s, char** end, int base);
double strtod(const char* s, char** end);

/* Always NULL here: a freestanding program has no environment to read. It is
   declared because the Clarity runtime calls getenv("CLARITY_GC") to decide
   whether to collect, and NULL is the correct answer — the arena allocator is
   the right default with no operating system to return memory to. */
char* getenv(const char* name);

int  rand(void);
void srand(unsigned int seed);

void qsort(void* base, size_t n, size_t size, int (*cmp)(const void*, const void*));

#endif
