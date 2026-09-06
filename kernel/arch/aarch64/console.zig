//! AArch64 early console — PL011 UART.
//!
//! QEMU's `virt` machine maps PL011 UART0 at 0x0900_0000 and wires it to
//! `-serial`. The firmware/QEMU leaves it in a usable state, so we only
//! need to respect the transmit-FIFO-full flag before writing a byte.
//!
//! Mirrors the x86_64 console API (init/print/println) so the shared
//! kernel code can print identically on both architectures.

const UART0_BASE: usize = 0x0900_0000;
const UARTDR: usize = 0x00; // data register
const UARTFR: usize = 0x18; // flag register
const FR_TXFF: u32 = 1 << 5; // transmit FIFO full

inline fn mmio_write(offset: usize, value: u32) void {
    @as(*volatile u32, @ptrFromInt(UART0_BASE + offset)).* = value;
}

inline fn mmio_read(offset: usize) u32 {
    return @as(*volatile u32, @ptrFromInt(UART0_BASE + offset)).*;
}

pub fn init() void {
    // QEMU's PL011 comes up transmit-ready; nothing to program for output.
    // Real hardware bring-up (baud divisors, line control, FIFO enable)
    // lands with the aarch64 driver phase.
}

pub fn print(s: []const u8) void {
    for (s) |c| putchar(c);
}

pub fn println(s: []const u8) void {
    print(s);
    putchar('\n');
}

fn putchar(c: u8) void {
    while ((mmio_read(UARTFR) & FR_TXFF) != 0) {}
    mmio_write(UARTDR, c);
}
