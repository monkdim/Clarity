//! Driver init — registers all built-in drivers with the kernel.
//!
//! Drivers are independent translation units that own their devices.
//! init.zig is the only place that knows the full list — the kernel
//! main() calls drivers.init(boot_info) once and the right things
//! get wired up.

const std = @import("std");
const main = @import("../main.zig");
const console = @import("../arch/x86_64/console.zig");
const ps2 = @import("ps2.zig");
const framebuffer = @import("framebuffer.zig");
const ahci = @import("ahci.zig");
const virtio_net = @import("virtio_net.zig");

pub fn init(boot_info: *const main.BootInfo) !void {
    // Console first — every other driver wants to print errors.
    console.init();

    // Framebuffer if the bootloader handed one up.
    if (boot_info.framebuffer) |fb| {
        try framebuffer.init(fb);
    }

    // PS/2 keyboard + mouse via the legacy 8042 controller.
    try ps2.init();

    // Block devices.
    try ahci.scan();

    // NIC — virtio-net for VMs, real Intel NICs deferred.
    try virtio_net.scan();
}
