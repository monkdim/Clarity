//! Syscall dispatch — entry from userspace, route to handlers.
//!
//! Userspace invokes a syscall by setting %rax to the syscall number,
//! the args in %rdi/%rsi/%rdx/%r10/%r8/%r9, then issuing `syscall`.
//! The CPU jumps to the address in IA32_LSTAR, which is our
//! `syscall_entry` trampoline. The trampoline saves the user stack,
//! loads the kernel stack from the per-CPU TSS, and tail-calls the
//! Zig dispatcher below.

const std = @import("std");
const sched = @import("../sched/scheduler.zig");
const vfs = @import("../fs/vfs.zig");

/// Canonical syscall numbers — must match stdlib/kernel_abi.clarity.
pub const Nr = enum(u32) {
    read = 0,
    write = 1,
    open = 2,
    close = 3,
    stat = 4,
    fstat = 5,
    lseek = 6,
    mmap = 7,
    munmap = 8,
    brk = 9,

    fork = 10,
    exec = 11,
    exit = 12,
    wait = 13,
    getpid = 14,
    getppid = 15,
    kill = 16,
    nanosleep = 17,

    pipe = 20,
    dup = 21,
    dup2 = 22,
    socket = 23,
    bind = 24,
    listen = 25,
    accept = 26,
    connect = 27,
    send = 28,
    recv = 29,

    mkdir = 30,
    rmdir = 31,
    unlink = 32,
    rename = 33,
    readdir = 34,
    chdir = 35,
    getcwd = 36,
    mount = 37,
    umount = 38,

    ioctl = 40,
    clock_gettime = 41,
    futex_wait = 42,
    futex_wake = 43,
    _,
};

/// errno values — must match stdlib/kernel_abi.clarity.
pub const Errno = enum(i32) {
    success = 0,
    eperm = 1,
    enoent = 2,
    esrch = 3,
    eintr = 4,
    eio = 5,
    enxio = 6,
    e2big = 7,
    enoexec = 8,
    ebadf = 9,
    eagain = 11,
    enomem = 12,
    eacces = 13,
    efault = 14,
    ebusy = 16,
    eexist = 17,
    enodev = 19,
    enotdir = 20,
    eisdir = 21,
    einval = 22,
    enfile = 23,
    emfile = 24,
    enotty = 25,
    espipe = 29,
    erofs = 30,
    erange = 34,
    enosys = 38,
    enotempty = 39,
    _,
};

pub fn init() void {
    // TODO: program IA32_STAR, IA32_LSTAR, IA32_FMASK MSRs to point
    // the SYSCALL instruction at syscall_entry; install int 0x80 in
    // the IDT for legacy / debugging.
}

/// Called from the syscall-entry trampoline with the six argument
/// registers already plumbed into a struct. Returns the value that
/// the trampoline writes back into %rax.
pub fn dispatch(nr: u64, args: Args) i64 {
    switch (@as(Nr, @enumFromInt(@as(u32, @truncate(nr))))) {
        .read => return sys_read(args),
        .write => return sys_write(args),
        .open => return sys_open(args),
        .close => return sys_close(args),
        .exit => return sys_exit(args),
        .getpid => return sys_getpid(),
        .nanosleep => return sys_nanosleep(args),
        .clock_gettime => return sys_clock_gettime(args),
        else => return -@as(i64, @intFromEnum(Errno.enosys)),
    }
}

pub const Args = struct {
    a0: u64,
    a1: u64,
    a2: u64,
    a3: u64,
    a4: u64,
    a5: u64,
};

fn sys_read(args: Args) i64 {
    const fd: i32 = @intCast(@as(i64, @bitCast(args.a0)));
    const buf: [*]u8 = @ptrFromInt(args.a1);
    const len: usize = @intCast(args.a2);
    const n = vfs.read(fd, buf[0..len]) catch return -@as(i64, @intFromEnum(Errno.eio));
    return @intCast(n);
}

fn sys_write(args: Args) i64 {
    const fd: i32 = @intCast(@as(i64, @bitCast(args.a0)));
    const buf: [*]const u8 = @ptrFromInt(args.a1);
    const len: usize = @intCast(args.a2);
    const n = vfs.write(fd, buf[0..len]) catch return -@as(i64, @intFromEnum(Errno.eio));
    return @intCast(n);
}

fn sys_open(args: Args) i64 {
    const path: [*:0]const u8 = @ptrFromInt(args.a0);
    const flags: u32 = @truncate(args.a1);
    const mode: u32 = @truncate(args.a2);
    return vfs.open(std.mem.span(path), flags, mode) catch -@as(i64, @intFromEnum(Errno.enoent));
}

fn sys_close(args: Args) i64 {
    const fd: i32 = @intCast(@as(i64, @bitCast(args.a0)));
    vfs.close(fd) catch return -@as(i64, @intFromEnum(Errno.ebadf));
    return 0;
}

fn sys_exit(args: Args) i64 {
    sched.exit(@intCast(@as(i64, @bitCast(args.a0))));
}

fn sys_getpid() i64 {
    if (sched.current_thread()) |t| return t.pid;
    return 0;
}

fn sys_nanosleep(args: Args) i64 {
    _ = args;
    sched.block(.{ .sleep_until = 0 });
    return 0;
}

fn sys_clock_gettime(args: Args) i64 {
    _ = args;
    // TODO: read TSC + offset from boot epoch.
    return 0;
}
