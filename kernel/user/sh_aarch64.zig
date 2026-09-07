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
//!
//! **Typing while this shell is busy used to lose characters, and both the
//! loss and the fix are measured rather than suspected.** The keyboard was
//! polled, and the only code that polled it was a read — so while a command
//! ran or its output was written, nothing drained the device's queue, which
//! is sixty-four events deep, or sixteen key presses. Forty characters typed
//! at a prompt the shell was reading all arrived; the same forty sent while
//! it printed `help` arrived as nine, with the Enter lost too, so the shell
//! was left holding half a command and then gave up on end of input.
//!
//! Two things were wrong and both had to be fixed. The keyboard now has its
//! own interrupt, routed through the GIC from the SPI the device tree names,
//! which empties the queue into a ring in the driver. And system calls now
//! run with interrupts unmasked — exception entry from EL0 sets PSTATE.I,
//! and nothing used to clear it, so the interrupt would have been useless
//! for exactly the window that loses characters: the one where this shell is
//! inside `write`. The same forty now arrive as forty.
//!
//! `tools/key_check.py` types them, without waiting for a prompt, and fails
//! if fewer come back.

const std = @import("std");

const NR_READ: u64 = 0;
const NR_WRITE: u64 = 1;
const NR_OPEN: u64 = 2;
const NR_CLOSE: u64 = 3;
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

/// open(2). The path has to be NUL-terminated for the kernel, which is why
/// this takes a buffer rather than a slice: a shell argument is a slice of
/// the line it was typed on, and there is nowhere in it to put the zero.
fn open(path: [*:0]const u8) i64 {
    return syscall3(NR_OPEN, @intFromPtr(path), 0, 0);
}

fn close(fd: u64) void {
    _ = syscall3(NR_CLOSE, fd, 0, 0);
}

fn read_fd(fd: u64, buf: []u8) i64 {
    return syscall3(NR_READ, fd, @intFromPtr(buf.ptr), buf.len);
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
        \\  cat PATH      write out a file
        \\  exit [N]      leave, with status N
        \\
        \\There is no ls yet: listing a directory needs a system call that
        \\does not exist, and cat only needed open and read. There is no way
        \\to run a program either: nothing can exec. Both are why this list
        \\is short rather than an oversight.
        \\
    );
}

/// cat, in the only shape four system calls allow.
fn cat(path_text: []const u8) void {
    if (path_text.len == 0) {
        write("clarity-sh: cat: no path\n");
        return;
    }
    // A NUL-terminated copy, because open(2) takes a C string and the
    // argument is a slice of the line it was typed on.
    var path: [96:0]u8 = undefined;
    if (path_text.len >= path.len) {
        write("clarity-sh: cat: path too long\n");
        return;
    }
    for (path_text, 0..) |c, i| path[i] = c;
    path[path_text.len] = 0;

    const fd = open(&path);
    if (fd < 0) {
        write("clarity-sh: cat: cannot open ");
        write(path_text);
        write("\n");
        return;
    }

    // Read until it stops giving anything, rather than once: a read may
    // return less than was asked for without being at the end.
    var buf: [128]u8 = undefined;
    var total: usize = 0;
    var last: u8 = 0;
    while (true) {
        const n = read_fd(@intCast(fd), &buf);
        if (n <= 0) break;
        const got: usize = @intCast(n);
        write(buf[0..got]);
        total += got;
        last = buf[got - 1];
    }
    close(@intCast(fd));

    // End the line if the file did not. Remembered as it goes rather than
    // looked up afterwards: `buf` holds only the last chunk read, so an index
    // computed from the running total points into the wrong place — which is
    // exactly the mistake the first version of this made.
    if (total > 0 and last != '\n') write("\n");
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
        } else if (eql(parts.word, "cat")) {
            cat(split(parts.rest).word);
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
