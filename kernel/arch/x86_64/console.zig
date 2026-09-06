//! Early console — VGA text mode at 0xB8000 + serial COM1 fallback.
//!
//! Used during boot before the framebuffer driver is up. Once the
//! desktop is running, console.println goes to the kernel log
//! reachable via dmesg(8).

const std = @import("std");
const port = @import("port.zig");

const VGA_BUF: [*]volatile u16 = @ptrFromInt(0xFFFF_8000_000B_8000);
const VGA_W = 80;
const VGA_H = 25;
const COM1 = 0x3F8;

var cursor_x: u8 = 0;
var cursor_y: u8 = 0;
var attr: u8 = 0x07; // light grey on black

pub fn init() void {
    cursor_x = 0;
    cursor_y = 0;
    // Initialise COM1 at 38400 8N1.
    port.out8(COM1 + 1, 0x00);
    port.out8(COM1 + 3, 0x80);
    port.out8(COM1 + 0, 0x03);
    port.out8(COM1 + 1, 0x00);
    port.out8(COM1 + 3, 0x03);
    port.out8(COM1 + 2, 0xC7);
    port.out8(COM1 + 4, 0x0B);
}

pub fn print(s: []const u8) void {
    for (s) |c| putchar(c);
}

pub fn println(s: []const u8) void {
    print(s);
    putchar('\n');
}

// VGA mirroring is opt-in. The VGA buffer is addressed through the HHDM
// (0xFFFF_8000_..), so a write faults on any path where that mapping isn't
// live — and if it faults inside panic() it storms the log with the panic
// prefix forever. Serial (pure port I/O) never faults, so the early console
// stays serial-only until a driver explicitly turns VGA on.
var vga_enabled: bool = false;

pub fn enable_vga() void {
    vga_enabled = true;
}

fn putchar(c: u8) void {
    serial_out(c);
    if (!vga_enabled) return;
    if (c == '\n') {
        cursor_x = 0;
        cursor_y += 1;
    } else {
        VGA_BUF[cursor_y * VGA_W + cursor_x] = (@as(u16, attr) << 8) | c;
        cursor_x += 1;
        if (cursor_x >= VGA_W) {
            cursor_x = 0;
            cursor_y += 1;
        }
    }
    if (cursor_y >= VGA_H) cursor_y = VGA_H - 1; // TODO: scroll
}

fn serial_out(c: u8) void {
    while ((port.in8(COM1 + 5) & 0x20) == 0) {}
    port.out8(COM1, c);
}
