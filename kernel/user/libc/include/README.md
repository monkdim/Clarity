These are the headers a freestanding Clarity program includes.

`clarity cc --freestanding` emits C that includes exactly six standard headers
— stdio, stdlib, string, math, ctype, setjmp — and nothing else. That is not a
coincidence to be preserved by hand: `stdlib/test_c_codegen.clarity` compiles
the emitted C with `-nostdinc` against a stub library declaring only those
six, so a seventh include breaks the test.

These declare only what the runtime actually calls, which is why they are
short. `stddef.h` and `stdarg.h` are deliberately absent: those belong to the
compiler, not to a C library, and clang/zig cc supply them from their own
resource directory.
