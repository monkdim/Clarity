//! /bin/clarity-sh — a shell.
//!
//! Read a line, work out what it says, do it, repeat. That loop is the
//! oldest interface an operating system has, and it is the first thing on
//! this architecture that treats the machine as something to be *told* rather
//! than something to be watched.
//!
//! Freestanding, no libc, four system calls: read, write, brk, exit. What it
//! can do is bounded by that, and the bound is honest rather than hidden —
//! there is no `ls` because there is no filesystem on this architecture yet,
//! and no `run` because nothing can exec. When those exist, this is where
//! they attach.
//!
//! It ends on end of input. On a machine with nobody at the keyboard that is
//! three seconds and then a clean exit, which is what lets a boot with no one
//! watching still finish — and it is also just what a shell does when its
//! input closes.

const std = @import("std");

const NR_READ: u64 = 0;
const NR_WRITE: u64 = 1;
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

/// Write all of it, however many calls that takes.
///
/// write(2) is allowed to accept less than it was offered and say so, and
/// this kernel's does: it caps a single call at 256 bytes. A caller that
/// ignores the return value therefore loses everything past the cap — which
/// is what happened to `help` the first time this shell ran, cut off in the
/// middle of the sentence explaining why there is no `ls`.
fn write(s: []const u8) void {
    var done: usize = 0;
    while (done < s.len) {
        const n = syscall3(NR_WRITE, 1, @intFromPtr(s.ptr) + done, s.len - done);
        if (n <= 0) return; // the console is gone; there is nowhere to complain
        done += @intCast(n);
    }
}

fn read_line(buf: []u8) i64 {
    return syscall3(NR_READ, 0, @intFromPtr(buf.ptr), buf.len);
}

fn exit(code: u64) noreturn {
    _ = syscall3(NR_EXIT, code, 0, 0);
    unreachable;
}

fn write_dec(v: u64) void {
    var buf: [20]u8 = undefined;
    var i: usize = buf.len;
    var n = v;
    while (true) {
        i -= 1;
        buf[i] = '0' + @as(u8, @intCast(n % 10));
        n /= 10;
        if (n == 0) break;
    }
    write(buf[i..]);
}

fn eql(a: []const u8, b: []const u8) bool {
    if (a.len != b.len) return false;
    for (a, b) |x, y| if (x != y) return false;
    return true;
}

/// The first word, and everything after it with the spaces between them
/// preserved. Splitting further is the command's business: `echo` wants its
/// argument exactly as typed, spaces and all.
fn split(line: []const u8) struct { word: []const u8, rest: []const u8 } {
    var start: usize = 0;
    while (start < line.len and line[start] == ' ') start += 1;
    var end = start;
    while (end < line.len and line[end] != ' ') end += 1;
    var rest = end;
    while (rest < line.len and line[rest] == ' ') rest += 1;
    return .{ .word = line[start..end], .rest = line[rest..] };
}

/// How many commands were run and how many were not understood. Reported on
/// the way out, because a shell that silently did nothing and a shell that
/// ran everything look identical from a boot log otherwise.
var ran: u64 = 0;
var unknown: u64 = 0;

fn help() void {
    write(
        \\clarity-sh — the commands that exist
        \\  help          this
        \\  echo TEXT     write TEXT back
        \\  count TEXT    how many characters TEXT is
        \\  exit [N]      leave, with status N
        \\
        \\There is no ls: this architecture has no filesystem yet. There is no
        \\way to run a program: nothing can exec. Both are why this list is
        \\short rather than an oversight.
        \\
    );
}

export fn _start() callconv(.C) noreturn {
    write("clarity-sh: type help\n");

    var line: [128]u8 = undefined;
    while (true) {
        write("$ ");
        const n = read_line(&line);

        // Anything but a positive count ends the session. Zero is end of
        // input — nobody is typing — and negative is an error the kernel
        // reported, which a shell cannot do anything useful about.
        if (n <= 0) {
            write("\nclarity-sh: end of input after ");
            write_dec(ran);
            write(if (ran == 1) " command" else " commands");
            if (unknown > 0) {
                write(", ");
                write_dec(unknown);
                write(" not understood");
            }
            write("\n");
            exit(0);
        }

        // read(2) returns the newline that ended the line; it terminates the
        // line rather than belonging to it.
        var len: usize = @intCast(n);
        if (len > 0 and line[len - 1] == '\n') len -= 1;

        const parts = split(line[0..len]);
        if (parts.word.len == 0) continue;

        ran += 1;
        if (eql(parts.word, "help")) {
            help();
        } else if (eql(parts.word, "echo")) {
            write(parts.rest);
            write("\n");
        } else if (eql(parts.word, "count")) {
            write_dec(parts.rest.len);
            write("\n");
        } else if (eql(parts.word, "exit")) {
            const parsed = split(parts.rest);
            var status: u64 = 0;
            for (parsed.word) |c| {
                if (c < '0' or c > '9') {
                    status = 0;
                    break;
                }
                status = status * 10 + (c - '0');
            }
            write("clarity-sh: exit\n");
            exit(status);
        } else {
            // Named, not swallowed. A shell that ignores what it does not
            // understand teaches you nothing about what it does.
            unknown += 1;
            ran -= 1;
            write("clarity-sh: unknown command: ");
            write(parts.word);
            write("\n");
        }
    }
}

pub fn panic(_: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    write("clarity-sh: panic\n");
    exit(1);
}
