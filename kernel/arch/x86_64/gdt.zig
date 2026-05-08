//! Global Descriptor Table — flat 64-bit code/data segments + TSS.

const std = @import("std");

const Entry = packed struct {
    limit_low: u16,
    base_low: u16,
    base_mid: u8,
    access: u8,
    flags_limit_high: u8,
    base_high: u8,
};

var gdt: [5]Entry align(8) = undefined;
var gdtr: packed struct { limit: u16, base: u64 } = undefined;

pub fn init() void {
    gdt[0] = std.mem.zeroes(Entry);                 // null
    gdt[1] = make_entry(0, 0, 0x9A, 0xA);           // 64-bit code, ring 0
    gdt[2] = make_entry(0, 0, 0x92, 0xC);           // 64-bit data, ring 0
    gdt[3] = make_entry(0, 0, 0xFA, 0xA);           // 64-bit code, ring 3
    gdt[4] = make_entry(0, 0, 0xF2, 0xC);           // 64-bit data, ring 3

    gdtr.limit = @sizeOf(@TypeOf(gdt)) - 1;
    gdtr.base = @intFromPtr(&gdt);
    asm volatile ("lgdt %[gdtr]"
        :
        : [gdtr] "*p" (&gdtr),
    );
}

fn make_entry(base: u32, limit: u32, access: u8, flags: u4) Entry {
    return .{
        .limit_low = @truncate(limit),
        .base_low = @truncate(base),
        .base_mid = @truncate(base >> 16),
        .access = access,
        .flags_limit_high = (@as(u8, flags) << 4) | @as(u8, @truncate(limit >> 16)),
        .base_high = @truncate(base >> 24),
    };
}
