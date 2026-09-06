//! What happens when a process traps into the kernel.
//!
//! Everything EL0 does that EL1 has to deal with — every `svc`, every fault —
//! arrives at one vector entry, which builds a trap frame and calls
//! `aarch64_sync_lower` below. The frame is not a record of what happened; it
//! is the process's registers, and writing to it is how the kernel answers.
//! A system call's result is a store to the saved x0. Resuming a process
//! somewhere else is a store to the saved ELR.
//!
//! The numbers are the ones in syscall/dispatch.zig, which are the ones
//! stdlib/kernel_abi.clarity defines — so a program built for this kernel
//! makes the same call whichever architecture it is running on. Only two are
//! implemented; the rest of that table follows once there is a VFS and a
//! process table on this architecture to implement them against.
//!
//! One rule shapes the whole file: **the kernel never dereferences an address
//! userspace gave it.** Not because the address might be wrong — though it
//! might — but because PSTATE.PAN makes an EL1 access to EL0-accessible
//! memory fault on any core that implements it. Every user pointer is
//! translated through the process's own page tables first and then reached
//! through the kernel's direct map, which both obeys that rule and makes
//! validation something the hardware does rather than something this code
//! remembers to.

const console = @import("console.zig");
const timer = @import("timer.zig");
const mmu = @import("mmu.zig");
const vm = @import("vm.zig");

/// The interrupted process's state, as the vector entry laid it out.
/// `extern` because the offsets are shared with assembly and must not be
/// reordered: x0-x30 at 0..248, ELR at 248, SPSR at 256.
pub const Frame = extern struct {
    x: [31]u64,
    elr: u64,
    spsr: u64,
};

/// Exception class, ESR_EL1 bits [31:26].
const EC_SVC64: u64 = 0x15; // `svc` from AArch64
pub const EC_INSTRUCTION_ABORT: u64 = 0x20;
pub const EC_DATA_ABORT: u64 = 0x24;

/// Why `enter_user` returned. A process leaves the CPU for exactly one of
/// these reasons, and the caller has to be able to tell them apart — "it came
/// back" is not an outcome. An unhandled system call is not among them: that
/// is ENOSYS, and the process keeps running.
pub const EXIT_DONE: u64 = 0;
pub const EXIT_FAULT: u64 = 1;

/// From syscall/dispatch.zig's `Nr`, which is stdlib/kernel_abi.clarity's
/// table. Deliberately the same numbers as the x86_64 side rather than a
/// convenient local set: a program that runs on one should make the same
/// call on the other.
const SYS_WRITE: u64 = 1;
const SYS_EXIT: u64 = 12;

/// Negative errno, the way the x86_64 dispatcher returns them.
const EBADF: i64 = -9;
const EFAULT: i64 = -14;
const ENOSYS: i64 = -38;

/// How much of a single `write` the kernel will copy in one go. A user
/// program can name any length it likes; this is the bound on what that can
/// cost, and it is the kernel's business rather than the caller's.
const WRITE_CHUNK: usize = 256;

pub const Fault = struct {
    ec: u64,
    esr: u64,
    far: u64,
    elr: u64,
};

/// What the last process to leave the CPU did. Read by the boot selftest;
/// replaced by per-process state once there is more than one process.
pub var last_fault: ?Fault = null;
pub var calls: u64 = 0;
pub var bytes_written: u64 = 0;
pub var exit_status: u64 = 0;
pub var bad_call: u64 = 0;

/// The timer's tick count at the first system call and at the last one. Both
/// are read inside a trap from EL0, so any difference between them elapsed
/// while the process was running — which is how the kernel can tell that an
/// interrupt was delivered *to a process* and the process survived it, rather
/// than merely that time passed.
pub var ticks_entering: u64 = 0;
pub var ticks_leaving: u64 = 0;

pub fn reset() void {
    last_fault = null;
    calls = 0;
    bytes_written = 0;
    exit_status = 0;
    bad_call = 0;
    ticks_entering = 0;
    ticks_leaving = 0;
}

/// Run `entry` at EL0 with `user_sp` as its stack, and return when it stops
/// being the kernel's problem. The address space it runs in is whatever is
/// currently in TTBR0 — installing it is the caller's business, because the
/// caller is the one that knows which process this is.
pub fn enter_user(entry: u64, user_sp: u64) u64 {
    return aarch64_enter_user(entry, user_sp);
}

extern fn aarch64_enter_user(entry: u64, user_sp: u64) callconv(.C) u64;
extern fn aarch64_leave_user(value: u64) callconv(.C) noreturn;

fn read_esr() u64 {
    return asm volatile ("mrs %[out], esr_el1"
        : [out] "=r" (-> u64),
    );
}

fn read_far() u64 {
    return asm volatile ("mrs %[out], far_el1"
        : [out] "=r" (-> u64),
    );
}

/// Called from vector entry 8 with the process's registers on the kernel
/// stack. Returning from here resumes the process; calling
/// `aarch64_leave_user` does not.
export fn aarch64_sync_lower(frame: *Frame) callconv(.C) void {
    const esr = read_esr();
    const ec = esr >> 26;

    if (ec == EC_SVC64) {
        dispatch(frame);
        return;
    }

    // A fault. Nothing here can fix one — there is no demand paging, no
    // copy-on-write, nothing that would make retrying the instruction work —
    // so resuming would re-execute it and fault again, forever. The kernel
    // takes the CPU back instead, which is what killing a process is before
    // there is a process table to remove it from.
    last_fault = .{ .ec = ec, .esr = esr, .far = read_far(), .elr = frame.elr };
    aarch64_leave_user(EXIT_FAULT);
}

fn dispatch(frame: *Frame) void {
    calls += 1;
    const number = frame.x[8];
    switch (number) {
        SYS_WRITE => {
            if (calls == 1) ticks_entering = timer.ticks();
            // The result goes back the way the arguments came: into the saved
            // registers, which the vector entry restores on its way out.
            frame.x[0] = @bitCast(sys_write(frame.x[0], frame.x[1], frame.x[2]));
        },
        SYS_EXIT => {
            ticks_leaving = timer.ticks();
            exit_status = frame.x[0];
            aarch64_leave_user(EXIT_DONE);
        },
        else => {
            // Every other number in the table exists and is not implemented
            // here yet, and a number outside it does not exist at all. Both
            // are ENOSYS and neither is fatal: a process asking for something
            // this kernel cannot do gets an answer and carries on, which is
            // what lets a program built against the full table run against a
            // partial one.
            bad_call = number;
            frame.x[0] = @bitCast(ENOSYS);
        },
    }
}

/// write(fd, buf, len) — the console, and nothing else yet.
///
/// `buf` is a user virtual address. It is not dereferenced: `mmu.translate_
/// user_read` runs a stage-1 translation with EL0 permissions and reports the
/// physical address, which the kernel then reads through its own direct map.
/// A page the process cannot read is a fault the hardware reports here, as
/// EFAULT, rather than one the kernel takes on the process's behalf.
///
/// Page by page, because a buffer is only guaranteed contiguous in the
/// process's address space. Two consecutive user pages are two unrelated
/// physical frames, and copying across the boundary as though they were one
/// is a bug that needs a buffer to straddle a page to appear at all.
fn sys_write(fd: u64, buf: u64, len: u64) i64 {
    if (fd != 1 and fd != 2) return EBADF;
    if (len == 0) return 0;

    var done: usize = 0;
    const want = @min(len, WRITE_CHUNK);
    while (done < want) {
        const va = buf + done;
        const phys = mmu.translate_user_read(va) orelse return EFAULT;

        // Stop at the end of this page; the next one is somewhere else.
        const page_left = PAGE_SIZE - (va & (PAGE_SIZE - 1));
        const n = @min(want - done, page_left);

        const src: [*]const u8 = @ptrFromInt(vm.phys_to_virt(phys));
        console.print(src[0..n]);
        done += n;
    }
    bytes_written += done;
    return @intCast(done);
}

const PAGE_SIZE: u64 = 4096;

/// Human-readable name for an exception class, for the failure path. Only the
/// ones a process can plausibly produce; anything else prints as its number,
/// which is more useful than a wrong guess.
pub fn ec_name(ec: u64) []const u8 {
    return switch (ec) {
        EC_SVC64 => "svc",
        EC_INSTRUCTION_ABORT => "instruction abort",
        EC_DATA_ABORT => "data abort",
        0x0E => "illegal execution state",
        0x18 => "trapped system register access",
        else => "unknown",
    };
}

pub fn report_fault(f: Fault) void {
    console.print("    ");
    console.print(ec_name(f.ec));
    console.print(" (ec=");
    console.print_hex(f.ec);
    console.print(") at pc=");
    console.print_hex(f.elr);
    console.print(" touching ");
    console.print_hex(f.far);
    console.println("");
}
