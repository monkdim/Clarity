//! PCI bus enumeration via the legacy 0xCF8/0xCFC config ports.
//!
//! Skeleton: walks 256 buses × 32 devices × 8 functions, yields each
//! present device. Drivers that want to attach iterate this list.
//! MMIO-based ECAM is a follow-up; legacy port I/O is enough for
//! QEMU and most physical machines we care about.

const std = @import("std");
const port = @import("../arch/x86_64/port.zig");

const CONFIG_ADDR = 0xCF8;
const CONFIG_DATA = 0xCFC;

pub const Device = struct {
    bus: u8,
    slot: u8,
    function: u8,
    vendor: u16,
    device: u16,
    class: u8,
    subclass: u8,
    prog_if: u8,
    revision: u8,
};

pub fn iterate() Iterator {
    return .{};
}

pub const Iterator = struct {
    bus: u16 = 0,
    slot: u8 = 0,
    function: u8 = 0,

    pub fn next(self: *Iterator) ?Device {
        while (self.bus < 256) {
            while (self.slot < 32) {
                while (self.function < 8) {
                    const addr = make_addr(@intCast(self.bus), self.slot, self.function, 0);
                    const ven_dev = read32(addr);
                    self.function += 1;
                    if (@as(u16, @truncate(ven_dev)) == 0xFFFF) continue;
                    const class_word = read32(make_addr(@intCast(self.bus), self.slot, self.function - 1, 0x08));
                    return .{
                        .bus = @intCast(self.bus),
                        .slot = self.slot,
                        .function = self.function - 1,
                        .vendor = @truncate(ven_dev),
                        .device = @truncate(ven_dev >> 16),
                        .class = @truncate(class_word >> 24),
                        .subclass = @truncate(class_word >> 16),
                        .prog_if = @truncate(class_word >> 8),
                        .revision = @truncate(class_word),
                    };
                }
                self.function = 0;
                self.slot += 1;
            }
            self.slot = 0;
            self.bus += 1;
        }
        return null;
    }
};

fn make_addr(bus: u8, slot: u8, function: u8, offset: u8) u32 {
    return (1 << 31) |
        (@as(u32, bus) << 16) |
        (@as(u32, slot) << 11) |
        (@as(u32, function) << 8) |
        (offset & 0xFC);
}

fn read32(addr: u32) u32 {
    port.out32(CONFIG_ADDR, addr);
    return port.in32(CONFIG_DATA);
}
