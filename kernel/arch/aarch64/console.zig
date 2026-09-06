//! AArch64 early console — PL011 UART.
//!
//! QEMU's `virt` machine maps PL011 UART0 at 0x0900_0000 and wires it to
//! `-serial`. The firmware/QEMU leaves it in a usable state, so we only
//! need to respect the transmit-FIFO-full flag before writing a byte.
//!
//! Mirrors the x86_64 console API (init/print/println) so the shared
//! kernel code can print identically on both architectures.

const vm = @import("vm.zig");
const text = @import("../../graphics/console.zig");

/// Where else everything printed should go.
///
/// Null until there is a screen, which cannot be before the device tree has
/// been read — and by then the console has already said several things. Those
/// early lines exist only on the serial line, which is correct: they are about
/// finding the machine, and one of the things being found is the display.
///
/// Opt-in and set once, so the ordinary path stays a single MMIO write. The
/// x86_64 side mirrors to VGA the same way and for the same reason.
var mirror: ?*text.Console = null;

pub fn set_mirror(c: *text.Console) void {
    mirror = c;
}

/// The PL011's physical address on QEMU's `virt`, seen through the kernel's
/// direct map. It has to be a constant rather than something read from the
/// device tree, because the console has to work before anything can be
/// printed about the tree — including the fact that there is not one.
///
/// The `+ KERNEL_VA_BASE` is what changed when the kernel moved to the high
/// half: the physical address is still 0x0900_0000, and after the boot stub
/// drops the identity map that address is no longer one this kernel can
/// dereference.
const UART0_PHYS: usize = 0x0900_0000;
const UART0_BASE: usize = UART0_PHYS + vm.KERNEL_VA_BASE;
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

/// One byte to the console, control characters included.
///
/// `print` exists for messages; this exists for echoing what someone typed,
/// where the bytes go out one at a time and several of them are not
/// printable. Same path, so an echoed character reaches the screen exactly
/// as a printed one does.
pub fn putc(c: u8) void {
    putchar(c);
}

fn putchar(c: u8) void {
    while ((mmio_read(UARTFR) & FR_TXFF) != 0) {}
    mmio_write(UARTDR, c);
    if (mirror) |m| m.put(c);
}
