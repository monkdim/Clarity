//! Physical memory manager — bitmap page-frame allocator.
//!
//! The kernel walks the boot memory map, marks every "available"
//! region as free, marks the pages occupied by the kernel image and
//! the bitmap itself as in-use, then hands out pages on demand.
//!
//! O(n) worst-case allocation in the number of frames. Acceptable
//! for the early stage; bumped to a buddy allocator in a later
//! phase. Intentionally simple — we want the failure modes to be
//! easy to reason about.

const std = @import("std");
const multiboot = @import("../boot/multiboot2.zig");
const console = @import("../arch/x86_64/console.zig");

pub const PAGE_SIZE: usize = 4096;
pub const PAGE_SHIFT: u6 = 12;

const MAX_PAGES = 1 << 24; // up to 64 GiB
var bitmap: [MAX_PAGES / 8]u8 = undefined;

var total_pages: usize = 0;
var free_pages: usize = 0;
var next_hint: usize = 0;

pub fn init(memory_map: []const multiboot.MemoryMapEntry) void {
    console.println("    pmm: memset bitmap");
    @memset(&bitmap, 0xFF); // every page reserved by default
    console.println("    pmm: scanning memory map");
    for (memory_map) |entry| {
        if (entry.region_type != @intFromEnum(multiboot.MemoryRegionType.available)) continue;
        const start_page = entry.base_addr >> PAGE_SHIFT;
        const page_count = entry.length >> PAGE_SHIFT;
        if (start_page >= MAX_PAGES) continue;
        const end_page = @min(start_page + page_count, MAX_PAGES);
        var p = start_page;
        while (p < end_page) : (p += 1) {
            clear_bit(p);
            free_pages += 1;
        }
        total_pages = @max(total_pages, end_page);
    }
    console.println("    pmm: reserving low memory");
    // First MiB is always reserved; the kernel image is reserved by
    // the linker script keep-out region.
    var p: usize = 0;
    while (p < 256 and p < total_pages) : (p += 1) {
        if (!is_set(p)) {
            set_bit(p);
            free_pages -= 1;
        }
    }
}

pub fn alloc_page() ?u64 {
    var i = next_hint;
    var scanned: usize = 0;
    while (scanned < total_pages) : (scanned += 1) {
        if (i >= total_pages) i = 0;
        if (!is_set(i)) {
            set_bit(i);
            free_pages -= 1;
            next_hint = i + 1;
            return @as(u64, i) << PAGE_SHIFT;
        }
        i += 1;
    }
    return null;
}

pub fn alloc_pages(count: usize) ?u64 {
    if (count == 0) return null;
    if (count == 1) return alloc_page();
    // Linear scan for `count` contiguous free pages.
    var run: usize = 0;
    var run_start: usize = 0;
    var i: usize = 0;
    while (i < total_pages) : (i += 1) {
        if (!is_set(i)) {
            if (run == 0) run_start = i;
            run += 1;
            if (run == count) {
                var j: usize = 0;
                while (j < count) : (j += 1) set_bit(run_start + j);
                free_pages -= count;
                return @as(u64, run_start) << PAGE_SHIFT;
            }
        } else {
            run = 0;
        }
    }
    return null;
}

pub fn free_page(phys_addr: u64) void {
    const page = phys_addr >> PAGE_SHIFT;
    if (page >= total_pages) return;
    if (!is_set(page)) return; // double-free; ignore
    clear_bit(page);
    free_pages += 1;
    if (page < next_hint) next_hint = page;
}

pub fn stats() Stats {
    return .{
        .total_pages = total_pages,
        .free_pages = free_pages,
        .used_pages = total_pages - free_pages,
        .total_bytes = total_pages * PAGE_SIZE,
    };
}

pub const Stats = struct {
    total_pages: usize,
    free_pages: usize,
    used_pages: usize,
    total_bytes: usize,
};

inline fn set_bit(page: usize) void {
    bitmap[page >> 3] |= @as(u8, 1) << @as(u3, @intCast(page & 7));
}

inline fn clear_bit(page: usize) void {
    bitmap[page >> 3] &= ~(@as(u8, 1) << @as(u3, @intCast(page & 7)));
}

inline fn is_set(page: usize) bool {
    return (bitmap[page >> 3] & (@as(u8, 1) << @as(u3, @intCast(page & 7)))) != 0;
}
