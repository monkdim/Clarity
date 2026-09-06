# Userspace

Two programs run in ring 3 during boot, in this order.

**`init.zig` → `/bin/clarity-init`.** Written by hand, freestanding, no C
library, syscalls issued directly. It exists to exercise the *loader*: a
linker's output has several PT_LOADs with different permissions and a `.bss`
whose `p_memsz` exceeds its `p_filesz`, none of which the 47 bytes of
hand-assembled machine code it replaced could show. It also checks the things
that have to work before anything larger can: that `.bss` really is zeroed,
that `brk` grows a heap whose pages are really mapped, and that SSE is enabled.

**`clarity_demo.clarity` → `/bin/clarity-demo`.** A Clarity program. It is
compiled to C by `clarity cc --freestanding`, linked against `libc/`, loaded
out of the filesystem and run as a second process — which also means the first
one exited and the kernel carried on.

## Why clarity_demo.c is checked in

The OS-boot job installs Zig and QEMU and nothing else. Making a kernel build
fetch a Clarity compiler would tie booting the operating system to a network,
so the generated C is committed as a build artifact and `kernel/build.zig`
compiles it directly.

The cost of that is a file that can drift from its source without anything
noticing. `stdlib/test_libc.clarity` is what notices: it regenerates the C,
requires it to match byte for byte, then links and runs it and compares the
output against the interpreter. That test runs in the ordinary suite, where a
Clarity compiler does exist.

To regenerate after editing the `.clarity` source:

```sh
clarity cc kernel/user/clarity_demo.clarity -o /tmp/demo --freestanding
cp /tmp/demo.c kernel/user/clarity_demo.c
```

## user.ld

Both programs link with `user.ld`. The `ALIGN(0x1000)` on every section is
load-bearing rather than tidiness — see the comment in the script itself.
