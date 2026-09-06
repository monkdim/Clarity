//! ramfb — a display that needs no driver.
//!
//! QEMU's `virt` machine has no VGA and, when booted with `-kernel`, no
//! firmware to program the PCI bars either — so the usual route to a screen
//! (enumerate PCI, find a display, read its BAR) starts with assigning the
//! BARs by hand. ramfb skips all of it: the kernel picks a region of its own
//! memory, tells QEMU where it is and what shape it has, and QEMU scans it
//! out. One structure written once.
//!
//! It is also the right shape for where this is going. On real Apple
//! Silicon there is no VGA either, and m1n1 — the bootloader Asahi Linux
//! established as the way in — hands a kernel exactly this: a physical
//! address, a stride, and a pixel format. Everything drawn on top of this
//! interface moves to that machine unchanged.
//!
//! One honest limitation. The framebuffer is mapped Normal write-back, so on
//! real hardware the display controller could read stale memory behind the
//! cache and show a partly-drawn frame. Under QEMU's TCG there is no cache to
//! be behind, so it does not arise here. Bare metal will need cache
//! maintenance after drawing, and that belongs with the code that knows the
//! machine's cache line size.

const fwcfg = @import("fwcfg.zig");
const vm = @import("vm.zig");

/// DRM_FORMAT_XRGB8888 — one 32-bit pixel, blue in the lowest byte, the top
/// byte ignored. The same layout the x86 side's framebuffer uses, so the
/// drawing code does not need to know which machine it is on.
const FOURCC_XRGB8888: u32 = 0x3432_5258; // 'X','R','2','4'

/// Where the framebuffer lives.
///
/// A stated reservation, not an allocation: nothing yet asks the page
/// allocator for a run of pages this large. RAM on `virt` starts at
/// 0x4000_0000 and the kernel is loaded at +0x80000 and is around a megabyte,
/// so 64 MiB in is far clear of it and inside the gigabyte the boot stub maps
/// before the device tree has been read. The physical page allocator now
/// exists and reserves this range rather than being told about it, so this
/// becomes a request rather than a constant once anything else competes for
/// memory that large.
pub const FB_PHYS: u64 = 0x4400_0000;

/// The configuration handed to QEMU. Big-endian, packed, 28 bytes — the
/// layout is fixed by QEMU's docs/specs/ramfb.txt and cannot be padded, so
/// it is written out as bytes rather than trusting a struct's alignment.
const CFG_LEN = 28;

pub const Surface = struct {
    base: u64,
    width: u32,
    height: u32,
    /// Bytes per row. Equal to width * 4 here, but kept separate because a
    /// real display controller often wants rows padded, and code that assumes
    /// otherwise breaks in a way that looks like a skewed picture.
    stride: u32,
};

var cfg_bytes: [CFG_LEN]u8 align(8) = undefined;

fn put_be32(buf: []u8, off: usize, v: u32) void {
    buf[off + 0] = @intCast((v >> 24) & 0xFF);
    buf[off + 1] = @intCast((v >> 16) & 0xFF);
    buf[off + 2] = @intCast((v >> 8) & 0xFF);
    buf[off + 3] = @intCast(v & 0xFF);
}

fn put_be64(buf: []u8, off: usize, v: u64) void {
    put_be32(buf, off, @intCast((v >> 32) & 0xFFFF_FFFF));
    put_be32(buf, off + 4, @intCast(v & 0xFFFF_FFFF));
}

/// Ask the machine for a screen of this size. Null means it has no ramfb —
/// which is a configuration fact about how QEMU was started, not a failure of
/// this code, so the caller says so rather than halting.
pub fn init(width: u32, height: u32) ?Surface {
    if (!fwcfg.present()) return null;
    const key = fwcfg.find("etc/ramfb") orelse return null;

    const stride = width * 4;
    put_be64(&cfg_bytes, 0, FB_PHYS);
    put_be32(&cfg_bytes, 8, FOURCC_XRGB8888);
    put_be32(&cfg_bytes, 12, 0); // flags: none defined
    put_be32(&cfg_bytes, 16, width);
    put_be32(&cfg_bytes, 20, height);
    put_be32(&cfg_bytes, 24, stride);

    if (!fwcfg.write_file(key, &cfg_bytes)) return null;

    // Two different addresses for one buffer, and mixing them up gives a
    // screen of noise rather than an error: QEMU was told the *physical*
    // address, because that is the only one it can scan out, while the
    // surface handed back is the *virtual* one, because that is the only one
    // this kernel can write through.
    return .{
        .base = vm.phys_to_virt(FB_PHYS),
        .width = width,
        .height = height,
        .stride = stride,
    };
}
