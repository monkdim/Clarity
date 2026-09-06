//! The ARM generic timer, EL1 physical.
//!
//! Counterpart to arch/x86_64/timer.zig, and it exists for the same reason
//! that one was written: the exception vectors were installed and nothing
//! could ever reach them, so the whole interrupt path was untested. On x86
//! that turned out to hide a scheduler that picked a thread without switching
//! to it. Here it hides nothing yet, because there is no scheduler on this
//! architecture — which is exactly why it is worth turning on before there
//! is, rather than after.
//!
//! INTID 30 is the non-secure EL1 physical timer, a private peripheral
//! interrupt: per-core, so it needs no routing in the distributor.
//!
//! The comparator is one-shot against CNTP_TVAL_EL0. Each interrupt re-arms
//! it, and forgetting to would give exactly one tick — which is why the test
//! counts several rather than checking for one.

const gic = @import("gic.zig");

pub const TIMER_INTID: u32 = 30;

/// Ticks the handler has counted. Read from the boot path while the handler
/// writes it, so both ends go through volatile: the compiler is entitled to
/// assume a plain global cannot change inside a spin loop that does not touch
/// it, and would hoist the read straight out.
var tick_count: u64 = 0;

pub fn ticks() u64 {
    const p: *const volatile u64 = &tick_count;
    return p.*;
}

fn count_tick() void {
    const p: *volatile u64 = &tick_count;
    p.* +%= 1;
}

fn read_cntfrq() u64 {
    return asm volatile ("mrs %[out], cntfrq_el0"
        : [out] "=r" (-> u64),
    );
}

fn set_tval(v: u64) void {
    asm volatile ("msr cntp_tval_el0, %[v]"
        :
        : [v] "r" (v),
    );
}

/// Interval in timer ticks, kept so the handler can re-arm with the same one.
var interval: u64 = 0;

/// Program the timer for `hz` and let interrupts through.
///
/// The `msr daifclr, #2` at the end is the step it is easy to leave out: the
/// GIC can be configured perfectly and the timer running, and with I still
/// set in DAIF the core simply never takes the interrupt.
pub fn init(hz: u64) void {
    const freq = read_cntfrq();
    interval = if (hz == 0 or freq == 0) freq else freq / hz;

    gic.init(TIMER_INTID);

    set_tval(interval);
    // CNTP_CTL_EL0: bit 0 ENABLE, bit 1 IMASK (0 = not masked).
    asm volatile ("msr cntp_ctl_el0, %[v]"
        :
        : [v] "r" (@as(u64, 1)),
    );

    asm volatile ("msr daifclr, #2" ::: "memory");
}

pub fn frequency() u64 {
    return read_cntfrq();
}

/// Called from the IRQ vector. Re-arms the comparator, because it is one-shot.
pub fn handle_irq() void {
    const which = gic.acknowledge();
    if (which == gic.SPURIOUS) return;
    if (which == TIMER_INTID) {
        set_tval(interval);
        count_tick();
    }
    gic.end(which);
}
