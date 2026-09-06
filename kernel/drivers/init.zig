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
        framebuffer.init(fb) catch |err| {
            console.print("  [warn] framebuffer init failed: ");
            console.println(@errorName(err));
        };
    }

    // Peripherals below are best-effort: a machine with no PS/2 controller,
    // no AHCI port, or no virtio NIC is a normal machine, not a boot
    // failure. Report and continue rather than aborting the boot.

    // PS/2 keyboard + mouse via the legacy 8042 controller.
    ps2.init() catch |err| {
        console.print("  [warn] PS/2 controller unavailable: ");
        console.println(@errorName(err));
    };

    // Block devices.
    ahci.scan() catch |err| {
        console.print("  [warn] AHCI scan failed: ");
        console.println(@errorName(err));
    };

    // NIC — virtio-net for VMs, real Intel NICs deferred.
    virtio_net.scan() catch |err| {
        console.print("  [warn] virtio-net scan failed: ");
        console.println(@errorName(err));
    };
}
