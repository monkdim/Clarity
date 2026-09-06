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

const std = @import("std");
const console = @import("arch/x86_64/console.zig");
const sched = @import("sched/scheduler.zig");

const ROUNDS = 2;

fn tick(who: []const u8, round: usize) void {
    console.print("  [");
    console.print(who);
    console.print("] round ");
    console.print_dec(round);
    console.println("");
}

fn thread_a() noreturn {
    var i: usize = 0;
    while (i < ROUNDS) : (i += 1) {
        tick("A", i);
        sched.yield();
    }
    sched.thread_exit(0);
}

fn thread_b() noreturn {
    var i: usize = 0;
    while (i < ROUNDS) : (i += 1) {
        tick("B", i);
        sched.yield();
    }
    sched.thread_exit(0);
}

pub fn run() !void {
    _ = try sched.spawn_kthread(thread_a, "[test-a]", .normal);
    _ = try sched.spawn_kthread(thread_b, "[test-b]", .normal);
    console.println("  scheduler: two kernel threads queued");

    // Hands the CPU to the run queue and comes back when it drains — which
    // only happens because the last thread to exit switches back to the boot
    // context rather than halting.
    sched.run_queued();

    console.println("  [ok] context switch: both threads ran and returned");
}
