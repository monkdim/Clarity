//! Periodic timer driving the scheduler.
//!
//! Uses the legacy 8254 PIT for now (channel 0, mode 2 = rate
//! generator). Once we have ACPI parsing for the LAPIC frequency,
//! the LAPIC timer will replace this — the API stays the same.
//!
//! Default tick: 100 Hz (10 ms quantum).

const std = @import("std");
const port = @import("port.zig");
const idt = @import("idt.zig");
const sched = @import("../../sched/scheduler.zig");

const PIT_CMD: u16 = 0x43;
const PIT_CH0: u16 = 0x40;
const PIT_BASE_FREQ: u32 = 1_193_182;
const TIMER_VECTOR: u8 = 0x20;

pub var ticks: u64 = 0;
pub var hz: u32 = 100;

pub fn init(target_hz: u32) void {
    hz = target_hz;
    const divisor: u16 = @intCast(PIT_BASE_FREQ / target_hz);
    port.out8(PIT_CMD, 0b00110100);                    // ch0, lobyte/hibyte, rate generator
    port.out8(PIT_CH0, @truncate(divisor));
    port.out8(PIT_CH0, @truncate(divisor >> 8));
    idt.set_handler(TIMER_VECTOR, timer_irq);
}

fn timer_irq() callconv(.C) void {
    ticks += 1;
    // EOI to PIC master.
    port.out8(0x20, 0x20);
    // Cooperatively yield to the scheduler. The dispatch path
    // chooses the next thread; if it's a different one, the
    // arch-level switch happens before we return from this IRQ.
    sched.schedule();
}

pub fn uptime_ms() u64 { return ticks * (1000 / hz); }
pub fn uptime_seconds() u64 { return ticks / hz; }
