//! Multiboot2 header + boot info parser.
//!
//! ClarityOS is multiboot2-compliant so it can boot under GRUB and
//! QEMU's `-kernel` option directly during development. The UEFI
//! path uses uefi.zig instead (different entry contract entirely).

const std = @import("std");

pub const MAGIC: u32 = 0xE85250D6;
pub const ARCH_I386: u32 = 0;
pub const TAG_TYPE_END: u16 = 0;
pub const TAG_TYPE_FRAMEBUFFER: u16 = 5;
pub const TAG_TYPE_INFO_REQUEST: u16 = 1;

pub const InfoTag = enum(u32) {
    end = 0,
    cmdline = 1,
    bootloader = 2,
    module = 3,
    basic_meminfo = 4,
    bootdev = 5,
    mmap = 6,
    vbe = 7,
    framebuffer = 8,
    elf_sections = 9,
    apm = 10,
    efi32 = 11,
    efi64 = 12,
    smbios = 13,
    acpi_old = 14,
    acpi_new = 15,
    network = 16,
    efi_mmap = 17,
    efi_bs = 18,
    _,
};

pub const MemoryRegionType = enum(u32) {
    available = 1,
    reserved = 2,
    acpi_reclaimable = 3,
    nvs = 4,
    badram = 5,
    _,
};

pub const MemoryMapEntry = extern struct {
    base_addr: u64,
    length: u64,
    region_type: u32,
    reserved: u32,
};

pub const Framebuffer = extern struct {
    addr: u64,
    pitch: u32,
    width: u32,
    height: u32,
    bpp: u8,
    fb_type: u8,
    reserved: u16,
};

/// Multiboot2 header — embedded in a special section so the loader
/// can scan the first 32 KiB of the kernel image and find it. The
/// header asks for the framebuffer + memory map.
pub const Header = extern struct {
    magic: u32 = MAGIC,
    arch: u32 = ARCH_I386,
    header_length: u32,
    checksum: u32,
};

/// Iterate the boot info blob handed to kernel_main as a packed
/// stream of tags. Caller looks at `tag.type` and casts to the right
/// concrete struct.
pub const TagIterator = struct {
    cursor: [*]const u8,
    end: [*]const u8,

    pub fn init(blob_ptr: [*]const u8, total_size: usize) TagIterator {
        return .{
            .cursor = blob_ptr + 8, // skip total_size + reserved
            .end = blob_ptr + total_size,
        };
    }

    pub fn next(self: *TagIterator) ?TagHeader {
        if (@intFromPtr(self.cursor) >= @intFromPtr(self.end)) return null;
        const hdr = @as(*const TagHeader, @ptrCast(@alignCast(self.cursor))).*;
        if (hdr.tag_type == 0) return null;
        // 8-byte align the cursor for the next tag
        const advance = (hdr.size + 7) & ~@as(u32, 7);
        self.cursor += advance;
        return hdr;
    }
};

pub const TagHeader = extern struct {
    tag_type: u32,
    size: u32,
};
