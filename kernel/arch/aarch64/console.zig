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

/// Print an unsigned value as 0x-prefixed hex. Dependency-free (no std.fmt,
/// no allocator) so it is safe from the earliest boot paths and from
/// exception handlers.
pub fn print_hex(v: u64) void {
    const digits = "0123456789abcdef";
    print("0x");
    var i: u6 = 60;
    var started = false;
    while (true) : (i -= 4) {
        const nib: u8 = @intCast((v >> i) & 0xF);
        if (nib != 0 or started or i == 0) {
            started = true;
            putchar(digits[nib]);
        }
        if (i == 0) break;
    }
}

/// Print an unsigned value in decimal.
pub fn print_dec(v: u64) void {
    if (v == 0) {
        putchar('0');
        return;
    }
    var buf: [20]u8 = undefined;
    var n = v;
    var i: usize = 0;
    while (n > 0) : (n /= 10) {
        buf[i] = @intCast('0' + (n % 10));
        i += 1;
    }
    while (i > 0) {
        i -= 1;
        putchar(buf[i]);
    }
}

fn putchar(c: u8) void {
    while ((mmio_read(UARTFR) & FR_TXFF) != 0) {}
    mmio_write(UARTDR, c);
}
