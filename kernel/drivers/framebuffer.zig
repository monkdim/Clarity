//! Framebuffer driver — VESA / GOP linear framebuffer.
//!
//! The bootloader sets up the mode and hands us a BootInfo entry
//! describing the framebuffer (phys addr, pitch, dims, bpp). We map
//! it into the kernel address space, expose it as /dev/fb0, and let
//! the Clarity userspace draw into it via mmap().

const std = @import("std");
const multiboot = @import("../boot/multiboot2.zig");
const vmm = @import("../mm/vmm.zig");

pub var info: ?Info = null;
pub var pixels: ?[*]u32 = null;

pub const Info = struct {
    phys_addr: u64,
    pitch: u32,
    width: u32,
    height: u32,
    bpp: u8,
};

pub fn init(fb: multiboot.Framebuffer) !void {
    info = .{
        .phys_addr = fb.addr,
        .pitch = fb.pitch,
        .width = fb.width,
        .height = fb.height,
        .bpp = fb.bpp,
    };
    // Map the framebuffer into the kernel address space.
    const size = @as(u64, fb.pitch) * fb.height;
    const pages = (size + 0xFFF) / 0x1000;
    var i: u64 = 0;
    while (i < pages) : (i += 1) {
        const phys = fb.addr + i * 0x1000;
        const virt = 0xFFFF_C000_0000_0000 + i * 0x1000;
        try vmm.map_page(undefined, virt, phys, vmm.PAGE_PRESENT | vmm.PAGE_WRITE);
    }
    pixels = @ptrFromInt(0xFFFF_C000_0000_0000);
}

pub fn put_pixel(x: u32, y: u32, bgra: u32) void {
    const fb_info = info orelse return;
    const px = pixels orelse return;
    if (x >= fb_info.width or y >= fb_info.height) return;
    const stride_pixels = fb_info.pitch / 4;
    px[y * stride_pixels + x] = bgra;
}

pub fn clear(bgra: u32) void {
    const fb_info = info orelse return;
    const px = pixels orelse return;
    const stride_pixels = fb_info.pitch / 4;
    var y: u32 = 0;
    while (y < fb_info.height) : (y += 1) {
        var x: u32 = 0;
        while (x < fb_info.width) : (x += 1) {
            px[y * stride_pixels + x] = bgra;
        }
    }
}
