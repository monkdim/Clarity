//! PS/2 keyboard + mouse driver — 8042 controller.
//!
//! Two devices on the legacy 8042 controller (i8042) hanging off
//! ports 0x60 (data) and 0x64 (status/command). The controller
//! multiplexes keyboard (port 1) and mouse (port 2). USB HID is its
//! own driver and lives in usb_hid.zig (deferred).
//!
//! Events are delivered through ring buffers consumed by the input
//! event bus in stdlib/event_bus.clarity.

const std = @import("std");
const port = @import("../arch/x86_64/port.zig");
const idt = @import("../arch/x86_64/idt.zig");

const PS2_DATA = 0x60;
const PS2_STATUS = 0x64;
const PS2_CMD = 0x64;

const KBD_BUF_SIZE = 256;
const MOUSE_BUF_SIZE = 256;

var kbd_buf: [KBD_BUF_SIZE]u8 = undefined;
var kbd_head: usize = 0;
var kbd_tail: usize = 0;

var mouse_buf: [MOUSE_BUF_SIZE]u8 = undefined;
var mouse_head: usize = 0;
var mouse_tail: usize = 0;

pub fn init() !void {
    // Disable both ports during reconfig.
    cmd(0xAD); // disable port 1
    cmd(0xA7); // disable port 2

    // Drain.
    while ((port.in8(PS2_STATUS) & 0x01) != 0) _ = port.in8(PS2_DATA);

    // Configure controller: enable IRQs on both ports, scancode translation off.
    cmd(0x20);
    var cfg = port.in8(PS2_DATA);
    cfg |= 0b0000_0011; // IRQ1 + IRQ12
    cfg &= 0b1011_1110; // clear translation bit
    cmd(0x60);
    port.out8(PS2_DATA, cfg);

    // Self test.
    cmd(0xAA);
    if (port.in8(PS2_DATA) != 0x55) return error.ControllerSelfTest;

    cmd(0xAE); // enable port 1
    cmd(0xA8); // enable port 2

    idt.set_handler(0x21, kbd_irq);
    idt.set_handler(0x2C, mouse_irq);
}

fn cmd(byte: u8) void {
    while ((port.in8(PS2_STATUS) & 0x02) != 0) {}
    port.out8(PS2_CMD, byte);
}

fn kbd_irq() callconv(.C) void {
    const scancode = port.in8(PS2_DATA);
    const next = (kbd_head + 1) % KBD_BUF_SIZE;
    if (next != kbd_tail) {
        kbd_buf[kbd_head] = scancode;
        kbd_head = next;
    }
}

fn mouse_irq() callconv(.C) void {
    const byte = port.in8(PS2_DATA);
    const next = (mouse_head + 1) % MOUSE_BUF_SIZE;
    if (next != mouse_tail) {
        mouse_buf[mouse_head] = byte;
        mouse_head = next;
    }
}

pub fn read_kbd() ?u8 {
    if (kbd_head == kbd_tail) return null;
    const b = kbd_buf[kbd_tail];
    kbd_tail = (kbd_tail + 1) % KBD_BUF_SIZE;
    return b;
}

pub fn read_mouse() ?u8 {
    if (mouse_head == mouse_tail) return null;
    const b = mouse_buf[mouse_tail];
    mouse_tail = (mouse_tail + 1) % MOUSE_BUF_SIZE;
    return b;
}
