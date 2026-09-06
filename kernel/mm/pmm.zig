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

pub const PAGE_SIZE: usize = 4096;
pub const PAGE_SHIFT: u6 = 12;

const MAX_PAGES = 1 << 24; // up to 64 GiB
var bitmap: [MAX_PAGES / 8]u8 = undefined;

/// One past the highest page index any region reached — the bound the
/// allocator scans within. Distinct from `total_pages` because a machine
/// whose RAM starts high (ARM's starts at 0x4000_0000) has a large gap of
/// indices below it that exist in the bitmap and are not memory.
var max_page: usize = 0;

/// Pages of real, usable memory. What the machine actually has.
var total_pages: usize = 0;
var free_pages: usize = 0;
var next_hint: usize = 0;

/// Start a fresh map. Everything is reserved until a region says otherwise,
/// so a page nobody described can never be handed out.
///
/// Building the map through these four calls, rather than by handing the
/// allocator a boot structure, is what makes it architecture-neutral: x86
/// learns its memory from a multiboot2 map and ARM from a device tree, and
/// neither format needs to be known here.
pub fn begin() void {
    @memset(&bitmap, 0xFF);
    max_page = 0;
    total_pages = 0;
    free_pages = 0;
    next_hint = 0;
}

/// Mark a range as usable RAM.
pub fn add_available(base: u64, len: u64) void {
    const first = base >> PAGE_SHIFT;
    if (first >= MAX_PAGES) return;
    const last = @min((base + len) >> PAGE_SHIFT, MAX_PAGES);
    var p = first;
    while (p < last) : (p += 1) {
        if (is_set(p)) {
            clear_bit(p);
            free_pages += 1;
            total_pages += 1;
        }
    }
    max_page = @max(max_page, last);
}

/// Mark a range as in use: the kernel image, a framebuffer, the device tree
/// itself — anything already occupying memory the map called available.
///
/// Rounds outward. A reservation that covered only whole pages inside the
/// range would leave the page holding its first byte allocatable, which is
/// the kind of overlap that corrupts something once and never reproduces.
pub fn reserve(base: u64, len: u64) void {
    if (len == 0) return;
    const first = base >> PAGE_SHIFT;
    if (first >= MAX_PAGES) return;
    const last = @min((base + len + PAGE_SIZE - 1) >> PAGE_SHIFT, MAX_PAGES);
    var p = first;
    while (p < last) : (p += 1) {
        if (!is_set(p)) {
            set_bit(p);
            free_pages -= 1;
        }
    }
}

/// Finish the map and point the allocator at the first free page, so the
/// first allocation on a machine whose RAM starts high does not scan a
/// quarter of a million reserved bits to find it.
pub fn finish() void {
    var p: usize = 0;
    while (p < max_page) : (p += 1) {
        if (!is_set(p)) {
            next_hint = p;
            return;
        }
    }
    next_hint = 0;
}

pub fn alloc_page() ?u64 {
    var i = next_hint;
    var scanned: usize = 0;
    while (scanned < max_page) : (scanned += 1) {
        if (i >= max_page) i = 0;
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
    while (i < max_page) : (i += 1) {
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
    if (page >= max_page) return;
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
