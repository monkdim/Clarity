//! /bin/clarity-init — the first user program, as a compiler builds it.
//!
//! This replaces 47 bytes of machine code written out by hand inside the
//! kernel. Those bytes proved the CPU could reach ring 3 and come back, but
//! they proved almost nothing about the loader: one segment, no BSS, and a
//! layout the kernel itself had chosen. A linker's output is the real test —
//! it decides how many segments there are, what permissions each gets, and
//! how much of the last page is file-backed rather than zero-filled.
//!
//! Freestanding, with no libc, because ClarityOS has none yet. The syscalls
//! are written out directly, which doubles as the smallest possible statement
//! of the ABI a libc will eventually sit on.

const std = @import("std");

const NR_WRITE: u64 = 1;
const NR_BRK: u64 = 9;
const NR_EXIT: u64 = 12;

fn syscall3(nr: u64, a0: u64, a1: u64, a2: u64) i64 {
    return asm volatile ("syscall"
        : [ret] "={rax}" (-> i64),
        : [nr] "{rax}" (nr),
          [a0] "{rdi}" (a0),
          [a1] "{rsi}" (a1),
          [a2] "{rdx}" (a2),
        : "rcx", "r11", "memory"
    );
}

fn write(fd: u64, buf: []const u8) i64 {
    return syscall3(NR_WRITE, fd, @intFromPtr(buf.ptr), buf.len);
}

/// Minimal hex, because a userspace with no libc still has to be able to say
/// what a number was. Fixed 16 digits: no allocation, no formatting library,
/// and nothing that could itself be the thing that is broken.
fn write_hex(v: u64) void {
    const digits = "0123456789abcdef";
    var buf: [19]u8 = undefined;
    buf[0] = '0';
    buf[1] = 'x';
    var i: usize = 0;
    while (i < 16) : (i += 1) {
        const nib: u8 = @intCast((v >> @intCast(60 - i * 4)) & 0xF);
        buf[2 + i] = digits[nib];
    }
    buf[18] = '\n';
    _ = write(1, &buf);
}

fn exit(code: u64) noreturn {
    _ = syscall3(NR_EXIT, code, 0, 0);
    unreachable;
}

/// A mutable copy of the greeting, so the image has a writable segment as
/// well as a read-only one. A single read-only PT_LOAD would not exercise
/// the loader's per-segment permissions at all.
var greeting = "hello from /bin/clarity-init\n".*;

/// Zero-initialised, so it lands in .bss — where p_memsz exceeds p_filesz and
/// the loader has to zero the difference rather than copy it. Getting that
/// wrong leaves "uninitialised" globals holding whatever was in the page,
/// which stays invisible until it is a very confusing bug.
var bss_probe: u64 = 0;

export fn _start() callconv(.C) noreturn {
    _ = write(1, &greeting);

    // Through a volatile pointer, so the compiler cannot fold this. It can
    // otherwise see that bss_probe is declared zero and nothing else writes
    // it, prove the branch, and emit the success message unconditionally —
    // which would make this pass whether or not .bss was actually zeroed,
    // i.e. test nothing at all.
    const probe: *volatile u64 = &bss_probe;
    probe.* +%= 1;
    if (probe.* == 1) {
        _ = write(1, "  [ok] user .bss zeroed\n");
    } else {
        _ = write(1, "  [FAIL] user .bss held garbage\n");
    }

    // A heap. brk(0) reports the current break; asking for more maps pages
    // that were not there before. This is what malloc will sit on.
    const before = syscall3(NR_BRK, 0, 0, 0);
    if (before <= 0) {
        _ = write(1, "  [FAIL] user heap: brk(0) reported no break\n");
        exit(1);
    }
    const want = @as(u64, @intCast(before)) + 8192;
    const after = syscall3(NR_BRK, want, 0, 0);
    if (after < 0 or @as(u64, @intCast(after)) != want) {
        _ = write(1, "  [FAIL] user heap: brk did not grow\n");
        _ = write(1, "    before ");
        write_hex(@bitCast(before));
        _ = write(1, "    wanted ");
        write_hex(want);
        _ = write(1, "    got    ");
        write_hex(@bitCast(after));
        exit(1);
    }

    // Checking the return value alone would prove nothing — the kernel could
    // return the number without mapping anything. Write through the new
    // break and read it back, volatile so neither end can be folded away. If
    // the page is not mapped this faults instead, which the boot log shows.
    const cell: *volatile u64 = @ptrFromInt(@as(usize, @intCast(before)) + 16);
    cell.* = 0xC0FFEE;
    if (cell.* == 0xC0FFEE) {
        _ = write(1, "  [ok] user heap: brk grew and the memory holds\n");
    } else {
        _ = write(1, "  [FAIL] user heap: wrote to brk memory, read back wrong\n");
    }

    exit(0);
}

pub fn panic(_: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    _ = write(2, "  [FAIL] user panic\n");
    exit(1);
}
