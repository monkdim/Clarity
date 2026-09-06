//! Preemption: prove the timer takes the CPU away from a thread that never
//! gives it up.
//!
//! `timer.init` was called from nowhere, so the PIT was never programmed and
//! no handler was ever installed on the timer vector — the scheduler's whole
//! preemptive half had never executed. The handler that would have run called
//! `sched.schedule()`, which picks the next thread without switching to it,
//! so had the timer been on it would have left `current` naming a thread that
//! was not running while the preempted one ran on, on the run queue and on
//! the CPU at the same time.
//!
//! The test has to be one that cooperative scheduling cannot pass. So neither
//! thread yields: A spins reading a flag, B sets it. B can only ever run if
//! something took the CPU away from A, and A can only observe the flag if the
//! CPU came back.

const std = @import("std");
const console = @import("arch/x86_64/console.zig");
const sched = @import("sched/scheduler.zig");
const timer = @import("arch/x86_64/timer.zig");

var b_ran: bool = false;

/// How long A waits before declaring preemption broken.
///
/// Counted in spins rather than timer ticks on purpose: if the timer is not
/// firing then `ticks` never advances, so a tick deadline would wait forever
/// for the very thing whose absence it is supposed to report. At 100 Hz a
/// tick is 10 ms, which is a few million spins even under TCG, so this leaves
/// a wide margin and still bounds the failure case to a couple of seconds.
const SPIN_LIMIT: u64 = 100_000_000;

fn thread_a() noreturn {
    var spins: u64 = 0;
    while (!@atomicLoad(bool, &b_ran, .seq_cst) and spins < SPIN_LIMIT) : (spins += 1) {
        asm volatile ("pause");
    }
    if (@atomicLoad(bool, &b_ran, .seq_cst)) {
        console.println("  [ok] preemption: B ran while A never yielded");
    } else {
        // Distinguishes the two ways this fails: no ticks at all means the
        // timer is not firing, ticks without B running means it fires but
        // does not switch.
        console.print("  [FAIL] preemption: B never ran, ticks=");
        console.print_dec(timer.ticks);
        console.println("");
    }
    sched.thread_exit(0);
}

fn thread_b() noreturn {
    @atomicStore(bool, &b_ran, true, .seq_cst);
    sched.thread_exit(0);
}

pub fn run() !void {
    _ = try sched.spawn_kthread(thread_a, "[preempt-a]", .normal);
    _ = try sched.spawn_kthread(thread_b, "[preempt-b]", .normal);
    console.println("  preempt: two threads queued, neither yields");

    // A is queued first, so A gets the CPU and holds it. Everything after
    // this depends on the timer prising it away.
    sched.run_queued();
}
