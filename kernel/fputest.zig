//! Does the context switch carry the FPU with it?
//!
//! Until now it did not, and nothing noticed, because nothing in the system
//! used floating point: the kernel is built with SSE subtracted and
//! `soft_float` on, and the one user program did integer arithmetic. A
//! compiled Clarity program changes that — it is C, and C on x86-64 keeps
//! every double in an xmm register — so the state has to travel with the
//! thread or two of them doing arithmetic at once would read each other's
//! registers.
//!
//! The test is the x87 stack rather than the xmm registers, for a reason
//! worth stating plainly: this module is compiled with SSE removed from the
//! target's feature set, deliberately, so that an interrupt handler can never
//! be the thing that clobbers a vector register. x87 is in the base x86-64
//! feature set and needs no such exception. FXSAVE writes both halves of the
//! state in one instruction to one area, so a thread that keeps its x87 stack
//! across a switch is a thread whose xmm registers were saved by the same
//! store. The ring-3 half — that SSE is enabled at all and produces the right
//! answer — is checked by /bin/clarity-init.

const console = @import("arch/x86_64/console.zig");
const sched = @import("sched/scheduler.zig");

const ROUNDS: u64 = 200;

var a_ok: bool = false;
var b_ok: bool = false;
var a_done: bool = false;
var b_done: bool = false;

/// Push the double whose bit pattern is at `src` onto the x87 stack, and
/// leave it there.
///
/// Bit patterns rather than `f64` values throughout, because this module is
/// compiled with SSE subtracted and `soft_float` on: an `f64` comparison here
/// would be a call into compiler-rt, which is a dependency this test has no
/// reason to acquire. The x87 instructions read and write eight bytes of
/// memory and do not care what type the source was declared as.
///
/// The operand is a pointer in a register rather than an "m" constraint,
/// matching the rest of this kernel's inline assembly.
fn fpu_load(src: *const u64) void {
    asm volatile ("fldl (%[p])"
        :
        : [p] "r" (src),
        : "memory"
    );
}

/// Pop the top of the x87 stack out into `dst`.
fn fpu_take(dst: *u64) void {
    asm volatile ("fstpl (%[p])"
        :
        : [p] "r" (dst),
        : "memory"
    );
}

fn body(mark: u64, ok: *bool, done: *bool) void {
    const want: u64 = mark;
    var got: u64 = 0;
    var good = true;
    var i: u64 = 0;
    while (i < ROUNDS) : (i += 1) {
        fpu_load(&want);
        // Hand the CPU to the other thread while a value of ours is live in
        // a register. Without FXSAVE in the switch, whatever it loads is what
        // we find on our way back.
        sched.yield();
        fpu_take(&got);
        if (got != want) {
            good = false;
            break;
        }
    }
    ok.* = good;
    done.* = true;
}

fn thread_a() noreturn {
    body(0x3FF8000000000000, &a_ok, &a_done);   // 1.5
    sched.thread_exit(0);
}

fn thread_b() noreturn {
    body(0xC002000000000000, &b_ok, &b_done);   // -2.25
    sched.thread_exit(0);
}

pub fn run() !void {
    _ = try sched.spawn_kthread(thread_a, "[fpu-a]", .normal);
    _ = try sched.spawn_kthread(thread_b, "[fpu-b]", .normal);

    // Hands the CPU to the run queue and comes back when it drains, the same
    // way the context-switch and preemption tests do.
    sched.run_queued();

    if (a_done and b_done and a_ok and b_ok) {
        console.print("  [ok] fpu switch: x87 state survived ");
        console.print_dec(ROUNDS);
        console.println(" switches each");
    } else if (!a_done or !b_done) {
        console.println("  [FAIL] fpu switch: a thread never finished");
    } else {
        console.println("  [FAIL] fpu switch: a thread found another's register value");
    }
}
