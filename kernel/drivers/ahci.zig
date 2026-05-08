//! AHCI driver — SATA storage via AHCI controllers (PCI class 01:06:01).
//!
//! Skeleton: we scan PCI for an AHCI controller, read its HBA memory
//! map, identify each port, and expose ATA reads/writes as a block
//! device backed by /dev/sdN.
//!
//! The full driver lands in a follow-up. This file documents the
//! interface so the kernel can compile against it.

const std = @import("std");
const pci = @import("pci.zig");

pub const Disk = struct {
    port: u8,
    sector_size: u32,
    sector_count: u64,
    name: []const u8,
};

pub var disks: std.BoundedArray(Disk, 32) = .{};

pub fn scan() !void {
    var iter = pci.iterate();
    while (iter.next()) |dev| {
        if (dev.class == 0x01 and dev.subclass == 0x06 and dev.prog_if == 0x01) {
            try register_controller(dev);
        }
    }
}

fn register_controller(dev: pci.Device) !void {
    _ = dev;
    // TODO: BAR5 = HBA mem-mapped registers; iterate ports;
    //       issue IDENTIFY; build a Disk entry per active port.
}

pub fn read_sectors(disk: *const Disk, lba: u64, count: u32, buf: []u8) !void {
    _ = disk;
    _ = lba;
    _ = count;
    _ = buf;
    return error.NotImplemented;
}

pub fn write_sectors(disk: *const Disk, lba: u64, count: u32, buf: []const u8) !void {
    _ = disk;
    _ = lba;
    _ = count;
    _ = buf;
    return error.NotImplemented;
}
