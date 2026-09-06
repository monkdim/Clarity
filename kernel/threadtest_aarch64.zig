//! Two ways of taking the CPU away from a kernel thread on AArch64.
//!
//! Counterpart to threadtest.zig and preempttest.zig on the x86_64 side, and
//! kept together because both rest on the same piece of assembly: the
//! cooperative case is a thread calling `switch_to` itself, and the
//! preemptive case is the timer's interrupt handler calling it on the
//! thread's behalf. The second is the one that matters and the one that is
//! easy to fake — so it is built so that it cannot be.
//!
//! The preemption test's threads never yield. Neither one calls `switch_to`,
//! looks at a flag, or cooperates in any way; each spins incrementing its own
//! counter. The second counter can only move if something took the CPU away
//! from the first, which is the same principle the x86 test uses and the
//! reason two well-behaved threads cannot pass it by taking turns.

const console = @import("arch/aarch64/console.zig");
const context = @import("arch/aarch64/context.zig");
const pmm = @import("mm/pmm.zig");
const vm = @import("arch/aarch64/vm.zig");
const timer = @import("arch/aarch64/timer.zig");

/// Two pages each. A kernel thread here does very little, but a stack that is
/// one page short of enough does not report anything — it runs into whatever
/// is below it.
const STACK_PAGES: usize = 2;

// ── Cooperative ─────────────────────────────────────────────────────────

var ctx_main: context.Context = .{};
var ctx_a: context.Context = .{};
var ctx_b: context.Context = .{};

/// What ran, in order. An alternating sequence is the thing to check: a
/// switch that went nowhere would leave one letter repeated, and a switch
/// that lost the thread would leave the trace short.
var trace: [16]u8 = undefined;
var trace_len: usize = 0;

fn note(c: u8) void {
    if (trace_len < trace.len) {
        trace[trace_len] = c;
        trace_len += 1;
    }
}

const ROUNDS: usize = 3;

fn thread_a(_: u64) callconv(.C) noreturn {
    var i: usize = 0;
    while (i < ROUNDS) : (i += 1) {
        note('A');
        context.switch_to(&ctx_a, &ctx_b);
    }
    note('a');
    // Hand the CPU back to whoever started this. Looping rather than
    // returning because there is nowhere to return to: this thread was
    // entered through a trampoline that has no caller.
    while (true) context.switch_to(&ctx_a, &ctx_main);
}

fn thread_b(_: u64) callconv(.C) noreturn {
    while (true) {
        note('B');
        context.switch_to(&ctx_b, &ctx_a);
    }
}

// ── Preemptive ──────────────────────────────────────────────────────────

var ctx_pa: context.Context = .{};
var ctx_pb: context.Context = .{};

var running: bool = false;
var current: u8 = 0;
var spins_a: u64 = 0;
var spins_b: u64 = 0;
var preemptions: u64 = 0;
var ticks_used: u64 = 0;
var gave_up: bool = false;

/// Which thread's *code* is currently executing, written by that code itself
/// on every pass round its loop.
///
/// This is what makes the test able to tell a real preemption from a
/// plausible-looking one. `current` is the kernel's belief about who is
/// running; `who` is the running code's own account of itself. They can
/// disagree, and the way they disagree is specific: taking an exception from
/// EL0 or EL1 puts the return address in ELR_EL1 and the saved state in
/// SPSR_EL1, which are one pair of registers for the whole CPU. If the vector
/// entry leaves them there across a thread switch, the next thread to `eret`
/// returns to whatever address the most recent exception left behind —
/// somewhere in the *other* thread's code, running on this thread's stack.
///
/// Counters alone cannot see that: both threads' loops would still be
/// executing and both counters would still climb. This can.
var who: u64 = 0;
var mismatches: u64 = 0;

/// How far each thread has to get. Small: at 100 Hz each thread does millions
/// of increments per tick, so anything reachable at all is reached in the
/// first one.
const WANT: u64 = 1000;

/// How many times the CPU has to change hands before this counts as working.
///
/// Both counters pass WANT within a tick or two, so stopping there would
/// prove exactly one switch — enough to say the mechanism fired once, not
/// enough to say a thread can be preempted repeatedly and keep running. Six
/// is three turns each.
const MIN_SWITCHES: u64 = 6;

/// A ceiling in timer ticks, so that a preemption path that does not work
/// reports rather than hangs. Two seconds at 100 Hz — hundreds of times what
/// the test needs, and the difference between a failing boot log and a boot
/// that stops with nothing on the screen.
const TICK_LIMIT: u64 = 200;

fn spin_a(_: u64) callconv(.C) noreturn {
    const p: *volatile u64 = &spins_a;
    const w: *volatile u64 = &who;
    while (true) {
        w.* = 1;
        p.* +%= 1;
    }
}

fn spin_b(_: u64) callconv(.C) noreturn {
    const p: *volatile u64 = &spins_b;
    const w: *volatile u64 = &who;
    while (true) {
        w.* = 2;
        p.* +%= 1;
    }
}

/// Called from the timer interrupt, after the interrupt itself has been
/// handled and acknowledged. Interrupts are masked here — the CPU masked them
/// on the way into the vector — which is what makes the bookkeeping below
/// safe without a lock.
pub fn on_tick() void {
    if (!running) return;
    ticks_used += 1;

    const a: *volatile u64 = &spins_a;
    const b: *volatile u64 = &spins_b;

    // Whoever the kernel thinks is running had better be the one whose code
    // is actually executing.
    const w: *volatile u64 = &who;
    if (w.* != current) mismatches += 1;

    const done = a.* >= WANT and b.* >= WANT and preemptions >= MIN_SWITCHES;

    if (done or ticks_used > TICK_LIMIT) {
        gave_up = !done;
        running = false;
        const leaving = if (current == 1) &ctx_pa else &ctx_pb;
        context.switch_to(leaving, &ctx_main);
        return;
    }

    preemptions += 1;
    if (current == 1) {
        current = 2;
        context.switch_to(&ctx_pa, &ctx_pb);
    } else {
        current = 1;
        context.switch_to(&ctx_pb, &ctx_pa);
    }
}

// ── Running them ────────────────────────────────────────────────────────

fn alloc_stack() ?u64 {
    const phys = pmm.alloc_pages(STACK_PAGES) orelse return null;
    return vm.phys_to_virt(phys) + STACK_PAGES * pmm.PAGE_SIZE;
}

fn free_stack(stack_top: u64) void {
    const base = vm.virt_to_phys(stack_top - STACK_PAGES * pmm.PAGE_SIZE);
    var i: usize = 0;
    while (i < STACK_PAGES) : (i += 1) pmm.free_page(base + i * pmm.PAGE_SIZE);
}

pub fn run() void {
    if (pmm.stats().total_pages == 0) {
        console.println("  [--] no physical memory; thread switching not exercised");
        return;
    }
    const before = pmm.stats();

    cooperative();
    preemptive();

    const after = pmm.stats();
    if (after.free_pages != before.free_pages) {
        console.print("  [FAIL] thread stacks leaked: ");
        console.print_dec(before.free_pages);
        console.print(" -> ");
        console.print_dec(after.free_pages);
        console.println("");
    }
}

fn cooperative() void {
    const stack_a = alloc_stack() orelse {
        console.println("  [FAIL] context switch: no stack for thread A");
        return;
    };
    const stack_b = alloc_stack() orelse {
        console.println("  [FAIL] context switch: no stack for thread B");
        return;
    };

    trace_len = 0;
    context.init_kernel_thread(&ctx_a, stack_a, &thread_a, 0);
    context.init_kernel_thread(&ctx_b, stack_b, &thread_b, 0);

    context.switch_to(&ctx_main, &ctx_a);

    // Back here only because thread A switched to ctx_main, which it does
    // only after both threads have taken their turns.
    const want = "ABABABa";
    var ok = trace_len == want.len;
    if (ok) {
        for (want, 0..) |c, i| {
            if (trace[i] != c) ok = false;
        }
    }

    if (ok) {
        console.print("  [ok] context switch: ");
        console.print(trace[0..trace_len]);
        console.println(" — two threads alternated and handed the CPU back");
    } else {
        console.print("  [FAIL] context switch: trace was \"");
        console.print(trace[0..trace_len]);
        console.print("\", wanted \"");
        console.print(want);
        console.println("\"");
    }

    free_stack(stack_a);
    free_stack(stack_b);
}

fn preemptive() void {
    const stack_a = alloc_stack() orelse {
        console.println("  [FAIL] preemption: no stack");
        return;
    };
    const stack_b = alloc_stack() orelse {
        console.println("  [FAIL] preemption: no stack");
        return;
    };

    spins_a = 0;
    spins_b = 0;
    who = 1;
    mismatches = 0;
    preemptions = 0;
    ticks_used = 0;
    gave_up = false;

    context.init_kernel_thread(&ctx_pa, stack_a, &spin_a, 0);
    context.init_kernel_thread(&ctx_pb, stack_b, &spin_b, 0);

    const ticks_before = timer.ticks();
    current = 1;
    running = true;
    context.switch_to(&ctx_main, &ctx_pa);
    // The timer handler switched back here.

    const a = spins_a;
    const b = spins_b;
    const ticks_after = timer.ticks();

    if (!gave_up and a >= WANT and b >= WANT and preemptions >= MIN_SWITCHES and mismatches == 0) {
        console.print("  [ok] preemption: B ran (");
        console.print_dec(b);
        console.print(") while A (");
        console.print_dec(a);
        console.print(") never yielded — ");
        console.print_dec(preemptions);
        console.print(" switches in ");
        console.print_dec(ticks_after - ticks_before);
        console.println(" ticks, each thread resuming in its own code");
    } else {
        console.print("  [FAIL] preemption: a=");
        console.print_dec(a);
        console.print(" b=");
        console.print_dec(b);
        console.print(" switches=");
        console.print_dec(preemptions);
        console.print(" wrong_thread_resumed=");
        console.print_dec(mismatches);
        console.print(" gave_up=");
        console.print_dec(@intFromBool(gave_up));
        console.println("");
    }

    free_stack(stack_a);
    free_stack(stack_b);
}
