//! Interrupt Descriptor Table — IRQ + exception dispatch.

const std = @import("std");
const console = @import("console.zig");
const port = @import("port.zig");

const Entry = packed struct {
    offset_low: u16,
    selector: u16,
    ist: u8,
    type_attr: u8,
    offset_mid: u16,
    offset_high: u32,
    reserved: u32,
};

var idt: [256]Entry align(8) = undefined;
var idtr: packed struct { limit: u16, base: u64 } = undefined;

pub fn init() void {
    @memset(std.mem.asBytes(&idt), 0);
    remap_pic();
    idtr.limit = @sizeOf(@TypeOf(idt)) - 1;
    idtr.base = @intFromPtr(&idt);
    asm volatile ("lidt %[idtr]; sti"
        :
        : [idtr] "*p" (&idtr),
    );
}

pub fn set_handler(vector: u8, handler: *const fn () callconv(.C) void) void {
    const addr = @intFromPtr(handler);
    idt[vector] = .{
        .offset_low = @truncate(addr),
        .selector = 0x08,
        .ist = 0,
        .type_attr = 0x8E, // present, ring 0, 64-bit interrupt gate
        .offset_mid = @truncate(addr >> 16),
        .offset_high = @truncate(addr >> 32),
        .reserved = 0,
    };
}

fn remap_pic() void {
    // Remap the legacy 8259 PIC vectors to 0x20..0x2F so they don't
    // collide with CPU exceptions in the 0x00..0x1F range.
    port.out8(0x20, 0x11); port.out8(0xA0, 0x11);
    port.out8(0x21, 0x20); port.out8(0xA1, 0x28);
    port.out8(0x21, 0x04); port.out8(0xA1, 0x02);
    port.out8(0x21, 0x01); port.out8(0xA1, 0x01);
    port.out8(0x21, 0x00); port.out8(0xA1, 0x00);
}
