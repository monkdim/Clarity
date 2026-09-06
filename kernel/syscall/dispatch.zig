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
const console = @import("../arch/x86_64/console.zig");
const arch_syscall = @import("../arch/x86_64/syscall.zig");

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
    echild = 10,
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
    // Program IA32_EFER.SCE, STAR, LSTAR and FMASK, and point the entry
    // trampoline at a kernel stack. Until this ran, `syscall` from ring 3 was
    // an invalid opcode — this module was reachable only in principle.
    arch_syscall.init();
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
        .mmap => return sys_mmap(args),
        .exit => return sys_exit(args),
        .fork => return sys_fork(),
        .exec => return sys_exec(args),
        .wait => return sys_wait(args),
        .kill => return sys_kill(args),
        .getpid => return sys_getpid(),
        .getppid => return sys_getppid(),
        .nanosleep => return sys_nanosleep(args),
        .clock_gettime => return sys_clock_gettime(args),
        .ioctl => return sys_ioctl(args),
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
    // Note: the buffer is a raw user pointer and is not validated. Nothing
    // here checks that the range is mapped, user-owned, or even canonical, so
    // a bad pointer faults in the kernel. Validation belongs with the rest of
    // the user-memory access layer, which does not exist yet.
    const buf: [*]const u8 = @ptrFromInt(args.a1);
    const len: usize = @intCast(args.a2);
    if (vfs.write(fd, buf[0..len])) |n| {
        return @intCast(n);
    } else |_| {
        // Before anything has opened descriptors of its own, stdout and
        // stderr go to the kernel console rather than failing. A program that
        // cannot report why it is unhappy is much harder to debug than one
        // whose first write lands somewhere visible.
        if (fd == 1 or fd == 2) {
            console.print(buf[0..len]);
            return @intCast(len);
        }
        return -@as(i64, @intFromEnum(Errno.ebadf));
    }
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

// ── mmap / ioctl — graphics fast-path ───────────

const MMAP_FB_FD: i32 = -2;       // fd we treat as "the framebuffer"
const IOCTL_FB_GET_INFO: u64 = 0x4600;

fn sys_mmap(args: Args) i64 {
    // (addr, length, prot, flags, fd, offset). We honour just the
    // graphics fast path — fd=MMAP_FB_FD maps the kernel framebuffer
    // into the calling process at `addr`. Anonymous + file-backed
    // mmap come in a later phase.
    const addr: u64 = args.a0;
    const fd: i32 = @intCast(@as(i64, @bitCast(args.a4)));
    if (fd != MMAP_FB_FD) return -@as(i64, @intFromEnum(Errno.einval));
    const cur = sched.current_thread() orelse return -@as(i64, @intFromEnum(Errno.esrch));
    const proc = sched.process_table.lookup(cur.pid) orelse return -@as(i64, @intFromEnum(Errno.esrch));
    const fb = @import("../drivers/framebuffer.zig");
    const size = fb.map_into_user(proc.address_space, addr) catch return -@as(i64, @intFromEnum(Errno.enomem));
    if (size == 0) return -@as(i64, @intFromEnum(Errno.enodev));
    return @intCast(addr);
}

fn sys_ioctl(args: Args) i64 {
    const fd: i32 = @intCast(@as(i64, @bitCast(args.a0)));
    const op: u64 = args.a1;
    if (fd == MMAP_FB_FD and op == IOCTL_FB_GET_INFO) {
        const fb = @import("../drivers/framebuffer.zig");
        const info_user = fb.user_info() orelse return -@as(i64, @intFromEnum(Errno.enodev));
        const dst: *fb.FbInfoForUser = @ptrFromInt(args.a2);
        dst.* = info_user;
        return 0;
    }
    return -@as(i64, @intFromEnum(Errno.enotty));
}

fn sys_exit(args: Args) i64 {
    const code: i32 = @intCast(@as(i64, @bitCast(args.a0)));
    console.print("\n  [exit] status=");
    console.print_dec(@intCast(@as(u32, @bitCast(code))));
    console.println("");
    if (sched.current_thread() == null) {
        // The ring 3 self-test runs before the scheduler owns userspace, so
        // there is no thread to mark dead and nothing to switch to. Stop
        // cleanly rather than spinning in the dispatcher looking for a
        // runnable thread that does not exist.
        console.println("  [halt] no scheduler context");
        while (true) asm volatile ("cli; hlt");
    }
    sched.exit(code);
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

// ── Process syscalls ─────────────────────────────

fn sys_fork() i64 {
    return sched.fork() catch |err| switch (err) {
        error.OutOfMemory => -@as(i64, @intFromEnum(Errno.enomem)),
        else => -@as(i64, @intFromEnum(Errno.eagain)),
    };
}

fn sys_exec(args: Args) i64 {
    const path: [*:0]const u8 = @ptrFromInt(args.a0);
    sched.exec(std.mem.span(path)) catch |err| switch (err) {
        error.NotFound => return -@as(i64, @intFromEnum(Errno.enoent)),
        error.OutOfMemory => return -@as(i64, @intFromEnum(Errno.enomem)),
        else => return -@as(i64, @intFromEnum(Errno.enoexec)),
    };
    // exec() doesn't return on success (it replaces the image).
    unreachable;
}

fn sys_wait(args: Args) i64 {
    const wstatus_ptr: ?*i32 = if (args.a0 == 0) null else @ptrFromInt(args.a0);
    const pid_arg: i32 = @bitCast(@as(i32, @intCast(args.a1)));
    const result = sched.waitpid(pid_arg) orelse return -@as(i64, @intFromEnum(Errno.echild));
    if (wstatus_ptr) |p| p.* = result.exit_code;
    return result.pid;
}

fn sys_kill(args: Args) i64 {
    const pid: i32 = @bitCast(@as(i32, @intCast(args.a0)));
    const sig: i32 = @bitCast(@as(i32, @intCast(args.a1)));
    return if (sched.kill(pid, sig)) 0 else -@as(i64, @intFromEnum(Errno.esrch));
}

fn sys_getppid() i64 {
    if (sched.current_thread()) |t| {
        if (sched.process_table.lookup(t.pid)) |p| return p.parent_pid;
    }
    return 0;
}

