//! The virtio MMIO transport.
//!
//! QEMU's `virt` machine puts thirty-two identical slots on a bus at
//! 0x0a000000, and what is in each — if anything — is only discoverable by
//! reading its registers. The device tree lists the slots; this reads them.
//!
//! Register map and the initialisation order are from the virtio 1.1
//! specification, §4.2. The order matters more than it looks: the device is
//! entitled to reject a driver that sets DRIVER_OK before FEATURES_OK, or
//! that configures a queue after DRIVER_OK, and a rejection looks exactly
//! like a device that is not there.

const vm = @import("vm.zig");

/// "virt", little-endian.
pub const MAGIC: u32 = 0x7472_6976;

pub const Reg = enum(u64) {
    magic = 0x000,
    version = 0x004,
    device_id = 0x008,
    vendor_id = 0x00C,
    device_features = 0x010,
    device_features_sel = 0x014,
    driver_features = 0x020,
    driver_features_sel = 0x024,
    queue_sel = 0x030,
    queue_num_max = 0x034,
    queue_num = 0x038,
    // Legacy (version 1) only: the guest's page size, the alignment of the
    // used ring inside the one contiguous queue, and that queue's page frame
    // number. Version 2 replaced all three with the six address registers
    // below, which is the whole difference between the two transports.
    guest_page_size = 0x028,
    queue_align = 0x03C,
    queue_pfn = 0x040,
    queue_ready = 0x044,
    queue_notify = 0x050,
    interrupt_status = 0x060,
    interrupt_ack = 0x064,
    status = 0x070,
    queue_desc_low = 0x080,
    queue_desc_high = 0x084,
    queue_driver_low = 0x090,
    queue_driver_high = 0x094,
    queue_device_low = 0x0A0,
    queue_device_high = 0x0A4,
    config = 0x100,
};

pub const Status = struct {
    pub const ACKNOWLEDGE: u32 = 1;
    pub const DRIVER: u32 = 2;
    pub const DRIVER_OK: u32 = 4;
    pub const FEATURES_OK: u32 = 8;
    pub const FAILED: u32 = 128;
};

/// Device IDs this kernel knows by name. The full list is much longer.
pub const DeviceId = struct {
    pub const NONE: u32 = 0;
    pub const INPUT: u32 = 18;
};

/// Bit 32 of the feature space: "this device speaks virtio 1.0 or later".
/// A version-2 transport requires the driver to accept it, and refuses to
/// come up otherwise.
pub const F_VERSION_1_SEL: u32 = 1;
pub const F_VERSION_1_BIT: u32 = 1;

/// One slot on the bus. `base` is physical, as the device tree gave it; every
/// access goes through the kernel's direct map, because the kernel runs in
/// the high half and a physical address is not something it can dereference.
pub const Device = struct {
    base: u64,
    version: u32,
    device_id: u32,

    pub fn read(self: Device, reg: Reg) u32 {
        const p: *volatile u32 = @ptrFromInt(vm.phys_to_virt(self.base) + @intFromEnum(reg));
        return p.*;
    }

    pub fn write(self: Device, reg: Reg, value: u32) void {
        const p: *volatile u32 = @ptrFromInt(vm.phys_to_virt(self.base) + @intFromEnum(reg));
        p.* = value;
    }

    pub fn read_config(self: Device, offset: u64) u8 {
        const p: *volatile u8 = @ptrFromInt(vm.phys_to_virt(self.base) + @intFromEnum(Reg.config) + offset);
        return p.*;
    }

    pub fn write_config(self: Device, offset: u64, value: u8) void {
        const p: *volatile u8 = @ptrFromInt(vm.phys_to_virt(self.base) + @intFromEnum(Reg.config) + offset);
        p.* = value;
    }
};

/// What is in this slot, or null if the slot is empty or speaks a version
/// this kernel does not.
///
/// An empty slot answers the magic correctly and reports device ID zero,
/// which is how a bus of thirty-two slots with one device in it looks.
pub fn probe(base: u64) ?Device {
    const d = Device{ .base = base, .version = 0, .device_id = 0 };
    if (d.read(.magic) != MAGIC) return null;
    const version = d.read(.version);
    // Both transports are driven. Version 1 is the legacy one and is what
    // QEMU's virtio-mmio presents by default — including on `virt`, where
    // the keyboard turned up as version 1 and a version-2-only driver walked
    // straight past it. Supporting only the modern one would have meant a
    // kernel that needs a non-default QEMU flag to find its keyboard, which
    // is not the same thing as a kernel that works.
    if (version != 1 and version != 2) return null;
    const id = d.read(.device_id);
    if (id == DeviceId.NONE) return null;
    return Device{ .base = base, .version = version, .device_id = id };
}

/// Bring a device up as far as FEATURES_OK, accepting only VIRTIO_F_VERSION_1.
///
/// Stops short of DRIVER_OK: the queues have to be configured in between, and
/// only the driver for a particular device knows how many it wants.
pub fn begin(d: Device) bool {
    d.write(.status, 0); // reset
    d.write(.status, Status.ACKNOWLEDGE);
    d.write(.status, Status.ACKNOWLEDGE | Status.DRIVER);

    // Accept no optional features at all. Every one this kernel does not
    // understand is one the device must not use, and the way to say that is
    // to leave the bit clear.
    d.write(.driver_features_sel, 0);
    d.write(.driver_features, 0);

    if (d.version == 1) {
        // Legacy has no FEATURES_OK to negotiate with, and no second feature
        // word to accept VIRTIO_F_VERSION_1 in — the whole point of that bit
        // is to say "not legacy". What it does need is the guest's page size,
        // because the queue is addressed by page frame number.
        d.write(.driver_features_sel, 1);
        d.write(.driver_features, 0);
        d.write(.guest_page_size, PAGE_SIZE);
        return true;
    }

    // Modern: the one bit that must be set is "this device speaks virtio 1.0
    // or later", which a version-2 transport refuses to come up without.
    d.write(.driver_features_sel, F_VERSION_1_SEL);
    d.write(.driver_features, F_VERSION_1_BIT);

    d.write(.status, Status.ACKNOWLEDGE | Status.DRIVER | Status.FEATURES_OK);
    // Read it back: the device clears the bit if it cannot live with what
    // was offered, and carrying on regardless is how a driver ends up
    // talking to a device that has already given up on it.
    return (d.read(.status) & Status.FEATURES_OK) != 0;
}

pub const PAGE_SIZE: u32 = 4096;

pub fn ready(d: Device) void {
    const base = Status.ACKNOWLEDGE | Status.DRIVER | Status.DRIVER_OK;
    d.write(.status, if (d.version == 1) base else base | Status.FEATURES_OK);
}

pub fn failed(d: Device) void {
    d.write(.status, Status.FAILED);
}
