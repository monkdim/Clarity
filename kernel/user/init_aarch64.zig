//! /bin/clarity-init for aarch64 — the first program on this architecture
//! that a compiler and a linker produced, rather than the kernel assembling
//! it into its own image.
//!
//! The distinction matters for the same reason it did on x86_64. Bytes the
//! kernel lays out itself prove the CPU can reach EL0 and come back; they
//! prove almost nothing about a loader, because the kernel chose the layout.
//! A linker decides how many segments there are, what permissions each gets,
//! and how much of the last page is file-backed rather than zero-filled —
//! and then the loader has to agree.
//!
//! Freestanding, no libc. The system calls are written out directly, which
//! doubles as the smallest possible statement of the ABI: number in x8,
//! arguments in x0-x5, `svc #0`, result back in x0.

const std = @import("std");

const NR_READ: u64 = 0;
const NR_WRITE: u64 = 1;
const NR_BRK: u64 = 9;
const NR_EXIT: u64 = 12;

fn syscall3(nr: u64, a0: u64, a1: u64, a2: u64) i64 {
    return asm volatile ("svc #0"
        : [ret] "={x0}" (-> i64),
        : [nr] "{x8}" (nr),
          [a0] "{x0}" (a0),
          [a1] "{x1}" (a1),
          [a2] "{x2}" (a2),
        : "memory"
    );
}

fn write(fd: u64, buf: []const u8) i64 {
    return syscall3(NR_WRITE, fd, @intFromPtr(buf.ptr), buf.len);
}

fn read(fd: u64, buf: []u8) i64 {
    return syscall3(NR_READ, fd, @intFromPtr(buf.ptr), buf.len);
}

fn exit(code: u64) noreturn {
    _ = syscall3(NR_EXIT, code, 0, 0);
    unreachable;
}

/// Minimal hex, because a userspace with no libc still has to be able to say
/// what a number was.
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

/// A mutable copy of the greeting, so the image has a writable segment as
/// well as a read-only one. A single read-only PT_LOAD would not exercise the
/// loader's per-segment permissions at all.
var greeting = "hello from /bin/clarity-init on aarch64\n".*;

/// Zero-initialised, so it lands in .bss — where p_memsz exceeds p_filesz and
/// the loader has to zero the difference rather than copy it.
var bss_probe: u64 = 0;

var fp_a: f64 = 355.0;
var fp_b: f64 = 113.0;

/// How many of this program's own checks failed.
///
/// It goes into the exit status, because the kernel is the only thing that
/// can act on it and a message on the console is not something the kernel
/// reads. A program that printed [FAIL] and exited successfully anyway would
/// let a broken loader pass the boot gate, which is exactly what happened the
/// first time this was tested: the loader stopped zeroing pages, this program
/// said so, and the marker above it still said [ok].
var failures: u64 = 0;

fn check(passed: bool, ok_msg: []const u8, fail_msg: []const u8) void {
    if (passed) {
        _ = write(1, ok_msg);
    } else {
        failures += 1;
        _ = write(1, fail_msg);
    }
}

/// Something in this program's *text*, to aim a deliberately bad read at.
///
/// Taking the address of `_start` would do as well; a function of its own
/// says why the address is being taken. The loader maps this segment
/// read-and-execute for EL0, so it is a legal pointer that is not a legal
/// place to put data — which is exactly the case a kernel has to get right.
fn greeting_is_here() callconv(.C) void {}

export fn _start() callconv(.C) noreturn {
    // The greeting starts lowercase in the file, and this program makes it
    // uppercase further down. So on a second run, in a second address space
    // over frames the first run just gave back, finding it lowercase again is
    // the loader having re-copied the file into a fresh page rather than
    // handing over one that still held what the last process wrote. Reading
    // it off the console is not enough: the difference is one letter, and a
    // check should not be something a person has to notice.
    check(
        greeting[0] == 'h',
        "  [ok] user .data came from the file\n",
        "  [FAIL] user .data held a previous process's writes\n",
    );

    _ = write(1, &greeting);

    // Through a volatile pointer, so the compiler cannot fold this. It can
    // otherwise see that bss_probe is declared zero and nothing else writes
    // it, prove the branch, and emit the success message unconditionally —
    // which would make this pass whether or not .bss was really zeroed.
    const probe: *volatile u64 = &bss_probe;
    probe.* +%= 1;
    check(
        probe.* == 1,
        "  [ok] user .bss zeroed\n",
        "  [FAIL] user .bss held garbage\n",
    );

    // A writable page really is writable: the greeting is in .data, so
    // storing into it goes through a mapping the loader had to mark writable
    // and the kernel had to copy file bytes into. A read-only mapping faults
    // here instead, which the boot log shows.
    greeting[0] = 'H';
    check(
        greeting[0] == 'H',
        "  [ok] user .data writable\n",
        "  [FAIL] user .data did not take a write\n",
    );

    // Floating point at EL0. A compiled Clarity program is C, and C keeps
    // doubles in v registers — so until the kernel enables FP/SIMD access,
    // the first arithmetic in such a program traps and it dies before
    // printing anything. Read through volatile pointers so the compiler
    // cannot fold the whole computation and emit a constant, which would make
    // this pass on a machine where FP access was never enabled.
    const a: *volatile f64 = &fp_a;
    const b: *volatile f64 = &fp_b;
    const q = a.* / b.*;
    const bits: u64 = @bitCast(q);
    // 355/113 is 3.14159292035398... The quotient is not exact, but rounding
    // it is: one specific double, on every conforming machine. So the check
    // is a bit pattern rather than a tolerance — and it is the same pattern
    // the x86_64 program checks, which is the point.
    if (bits == 0x400921FB78121FB8) {
        _ = write(1, "  [ok] user fp: 355/113 in a v register\n");
    } else {
        failures += 1;
        _ = write(1, "  [FAIL] user fp: wrong quotient ");
        write_hex(bits);
    }

    // A heap. brk(0) reports the current break; asking for more maps pages
    // that were not there before. This is what a C library's malloc sits on,
    // and the reason it is tested here rather than left until something
    // depends on it.
    const before = syscall3(NR_BRK, 0, 0, 0);
    if (before <= 0) {
        failures += 1;
        _ = write(1, "  [FAIL] user heap: brk(0) reported no break\n");
    } else {
        const want = @as(u64, @intCast(before)) + 8192;
        const after = syscall3(NR_BRK, want, 0, 0);
        if (after < 0 or @as(u64, @intCast(after)) != want) {
            failures += 1;
            _ = write(1, "  [FAIL] user heap: brk did not grow\n");
            _ = write(1, "    before ");
            write_hex(@bitCast(before));
            _ = write(1, "    wanted ");
            write_hex(want);
            _ = write(1, "    got    ");
            write_hex(@bitCast(after));
        } else {
            // Checking the return value alone would prove nothing — the
            // kernel could return the number without mapping anything. Write
            // through the new break and read it back, volatile so neither end
            // can be folded away. An unmapped page faults instead, which the
            // boot log shows.
            const cell: *volatile u64 = @ptrFromInt(@as(usize, @intCast(before)) + 16);
            cell.* = 0xC0FFEE;
            check(
                cell.* == 0xC0FFEE,
                "  [ok] user heap: brk grew and the memory holds\n",
                "  [FAIL] user heap: wrote to brk memory, read back wrong\n",
            );
        }
    }

    // And a line from the console, read by *this program* rather than by the
    // kernel on its behalf. Everything above reads memory the loader put
    // there; this is the first thing the program asks the outside world for.
    //
    // The first read deliberately points somewhere this process may execute
    // and read but not write: its own text. A kernel that translates the
    // buffer for writing, as it must, cannot deliver there and says EFAULT.
    // One that translates it for reading — the same call sys_write makes, and
    // the easy mistake — finds the page perfectly readable and writes through
    // its own map into this program's instructions. That would corrupt the
    // process silently and in the process's favour, so it is worth a check
    // rather than a comment.
    //
    // A refused read must also not eat the line. So the second read asks
    // again, with a buffer that works, and must get the same line back — if
    // the kernel dropped it, a program with a bad pointer would cost the next
    // reader its input for reasons nothing in that reader could explain.
    //
    // Nobody may be typing, and that is not a failure: a boot with no one at
    // the keyboard reports end of input, which is what a closed stdin does.
    // The read that reports it is the first one, so an untyped boot waits
    // once rather than twice.
    _ = write(1, "  init: type a line: ");
    const text: [*]u8 = @ptrFromInt(@intFromPtr(&greeting_is_here));
    const refused = read(0, text[0..16]);

    if (refused == 0) {
        _ = write(1, "\n  init: nothing typed, end of input\n");
    } else if (refused > 0) {
        failures += 1;
        _ = write(1, "\n  [FAIL] user read: the kernel wrote into read-only text\n");
    } else {
        var typed: [128]u8 = undefined;
        const got = read(0, &typed);
        if (got <= 0) {
            failures += 1;
            _ = write(1, "\n  [FAIL] user read: the refused read ate the line ");
            write_hex(@bitCast(got));
        } else {
            const n: usize = @intCast(got);
            // read(2) hands back the newline that ended the line. A reader
            // that did not get one was given something that is not a line,
            // and every caller splitting input on newlines would be wrong.
            if (typed[n - 1] != '\n') {
                failures += 1;
                _ = write(1, "\n  [FAIL] user read: no newline ends the line\n");
            }
            _ = write(1, "\n  [ok] user read: a bad buffer was refused and kept the line\n");
            _ = write(1, "  init: read \"");
            _ = write(1, typed[0 .. n - 1]);
            _ = write(1, "\"\n");
        }
    }

    // 42 means every check above passed. Anything else is the count of the
    // ones that did not, which is what the kernel checks — so a loader that
    // breaks one of them fails the boot gate rather than merely printing
    // about it.
    exit(if (failures == 0) 42 else failures);
}

pub fn panic(_: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    _ = write(2, "  [FAIL] user panic\n");
    exit(1);
}
