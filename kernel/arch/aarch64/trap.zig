//! What happens when a process traps into the kernel.
//!
//! Everything EL0 does that EL1 has to deal with — every `svc`, every fault —
//! arrives at one vector entry, which builds a trap frame and calls
//! `aarch64_sync_lower` below. The frame is not a record of what happened; it
//! is the process's registers, and writing to it is how the kernel answers.
//! A system call's result is a store to the saved x0. Resuming a process
//! somewhere else is a store to the saved ELR.
//!
//! The syscall numbers here are a placeholder, and deliberately not the
//! x86_64 side's. This is the seam where the real system call layer lands;
//! what it needs first is the machinery around it — entering EL0, trapping
//! back, changing what the process sees, and taking the CPU away from a
//! process that faulted — which is what this file is.

const console = @import("console.zig");
const timer = @import("timer.zig");

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
/// back" is not an outcome.
pub const EXIT_DONE: u64 = 0;
pub const EXIT_FAULT: u64 = 1;
pub const EXIT_BAD_CALL: u64 = 2;

/// Placeholder system calls, used by the EL0 probe.
const SYS_INCREMENT: u64 = 1;
const SYS_DONE: u64 = 2;

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
pub var last_argument: u64 = 0;
pub var done_value: u64 = 0;
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
    last_argument = 0;
    done_value = 0;
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
        SYS_INCREMENT => {
            ticks_entering = timer.ticks();
            last_argument = frame.x[0];
            // The answer goes back the way the argument came: into the saved
            // register, which the vector entry restores on its way out.
            frame.x[0] = frame.x[0] +% 1;
        },
        SYS_DONE => {
            ticks_leaving = timer.ticks();
            done_value = frame.x[0];
            aarch64_leave_user(EXIT_DONE);
        },
        else => {
            bad_call = number;
            aarch64_leave_user(EXIT_BAD_CALL);
        },
    }
}

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
