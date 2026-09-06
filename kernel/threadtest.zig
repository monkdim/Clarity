//! Kernel threads: prove the context switch before anything depends on it.
//!
//! `context.switch_to` existed but had never run — it was `callconv(.Naked)`,
//! which Zig will not let you call, and the one line in the scheduler that
//! would have used it was commented out. So the scheduler could pick a next
//! thread but never actually moved to it, and every "thread" the kernel
//! spawned ran nowhere.
//!
//! This is the smallest thing that shows the switch works both ways: two
//! threads that print and yield in turn. Their output has to interleave —
//! A, B, A, B — which is only possible if each `yield` really did save one
//! stack and restore another, and if resuming a thread lands it back inside
//! the yield it called rather than at its entry point.
//!
//! The two threads are the same function, told which one it is. That is not
//! only tidier: it means the letters the boot gate greps for are carried in
//! the thread's argument, so a thread that did not receive its argument
//! prints the wrong letter and the gate fails. Passing an argument to a
//! kernel thread had never worked, and nothing showed it, because every
//! caller passed zero.

const std = @import("std");
const console = @import("arch/x86_64/console.zig");
const sched = @import("sched/scheduler.zig");

const ROUNDS = 2;

// One console call, not five. Each call is atomic against preemption, but a
// line built from several of them can still be split down the middle by the
// timer — and these lines are what the boot gate greps for. Assembled here
// so the whole line goes out under one lock.
fn tick(who: []const u8, round: usize) void {
    var buf: [32]u8 = undefined;
    var n: usize = 0;
    for ("  [") |c| { buf[n] = c; n += 1; }
    for (who) |c| { buf[n] = c; n += 1; }
    for ("] round ") |c| { buf[n] = c; n += 1; }
    // ROUNDS is small enough that a single digit always suffices.
    buf[n] = '0' + @as(u8, @intCast(round));
    n += 1;
    console.println(buf[0..n]);
}

/// `which` is the thread's argument: 0 prints A, 1 prints B. A thread that
/// never received it would print A twice, and "[B] round 1" — which the boot
/// gate requires — would never appear.
fn thread_body(which: u64) callconv(.C) noreturn {
    const name = if (which == 0) "A" else "B";
    var i: usize = 0;
    while (i < ROUNDS) : (i += 1) {
        tick(name, i);
        sched.yield();
    }
    sched.thread_exit(0);
}

pub fn run() !void {
    _ = try sched.spawn_kthread(thread_body, 0, "[test-a]", .normal);
    _ = try sched.spawn_kthread(thread_body, 1, "[test-b]", .normal);
    console.println("  scheduler: two kernel threads queued");

    // Hands the CPU to the run queue and comes back when it drains — which
    // only happens because the last thread to exit switches back to the boot
    // context rather than halting.
    sched.run_queued();

    console.println("  [ok] context switch: both threads ran and returned");
}
