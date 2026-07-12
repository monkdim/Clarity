//! Kernel heap — slab allocator over the page allocator.
//!
//! Slabs of fixed-size objects (32, 64, 128, 256, 512, 1024, 2048,
//! 4096 bytes). Allocations larger than 4 KiB go through the page
//! allocator directly.
//!
//! Each slab is a linked list of pages, where each page is a list of
//! free chunks. Allocation pulls the head of a free list; free pushes
//! back onto it.

const std = @import("std");
const pmm = @import("pmm.zig");

const SLAB_CLASSES = [_]usize{ 32, 64, 128, 256, 512, 1024, 2048, 4096 };
const SLAB_COUNT = SLAB_CLASSES.len;

const SlabFreeNode = struct {
    next: ?*SlabFreeNode,
};

const Slab = struct {
    object_size: usize,
    free_list: ?*SlabFreeNode = null,
    pages_owned: usize = 0,
};

var slabs: [SLAB_COUNT]Slab = undefined;

pub fn init() void {
    for (SLAB_CLASSES, 0..) |size, i| {
        slabs[i] = .{ .object_size = size };
    }
}

// ── std.mem.Allocator interface over the slab ────────────
// So the rest of the kernel can hand a real Allocator to ArrayList /
// AutoHashMap / the loader — using OUR heap, not std.heap.page_allocator
// (which is mmap-backed and doesn't exist on a freestanding target).
pub fn allocator() std.mem.Allocator {
    return .{ .ptr = undefined, .vtable = &vtable };
}

const vtable = std.mem.Allocator.VTable{
    .alloc = vt_alloc,
    .resize = vt_resize,
    .free = vt_free,
};

// Pick a slab class big enough for both the length and the alignment, so
// the class-aligned chunk we return also satisfies the requested align.
fn need_size(len: usize, log2_align: u8) usize {
    const alignment = @as(usize, 1) << @as(u6, @intCast(log2_align));
    return if (alignment > len) alignment else len;
}

fn vt_alloc(_: *anyopaque, len: usize, log2_align: u8, _: usize) ?[*]u8 {
    return alloc(need_size(len, log2_align));
}

fn vt_resize(_: *anyopaque, buf: []u8, _: u8, new_len: usize, _: usize) bool {
    return new_len <= buf.len;
}

fn vt_free(_: *anyopaque, buf: []u8, log2_align: u8, _: usize) void {
    free(buf.ptr, need_size(buf.len, log2_align));
}

pub fn alloc(size: usize) ?[*]u8 {
    if (size == 0) return null;
    if (size > 4096) {
        const pages = (size + pmm.PAGE_SIZE - 1) / pmm.PAGE_SIZE;
        const phys = pmm.alloc_pages(pages) orelse return null;
        return @ptrFromInt(0xFFFF_8000_0000_0000 + phys);
    }
    const class_idx = pick_class(size) orelse return null;
    const slab = &slabs[class_idx];
    if (slab.free_list == null) {
        if (!grow_slab(slab)) return null;
    }
    const node = slab.free_list.?;
    slab.free_list = node.next;
    return @ptrCast(node);
}

pub fn free(ptr: [*]u8, size: usize) void {
    if (size > 4096) {
        const pages = (size + pmm.PAGE_SIZE - 1) / pmm.PAGE_SIZE;
        var i: usize = 0;
        while (i < pages) : (i += 1) {
            const virt: u64 = @intFromPtr(ptr) + i * pmm.PAGE_SIZE;
            const phys = virt - 0xFFFF_8000_0000_0000;
            pmm.free_page(phys);
        }
        return;
    }
    const class_idx = pick_class(size) orelse return;
    const slab = &slabs[class_idx];
    const node: *SlabFreeNode = @ptrCast(@alignCast(ptr));
    node.next = slab.free_list;
    slab.free_list = node;
}

fn pick_class(size: usize) ?usize {
    for (SLAB_CLASSES, 0..) |class_size, i| {
        if (size <= class_size) return i;
    }
    return null;
}

fn grow_slab(slab: *Slab) bool {
    const phys = pmm.alloc_page() orelse return false;
    slab.pages_owned += 1;
    const base: usize = @intCast(0xFFFF_8000_0000_0000 + phys);
    var offset: usize = 0;
    while (offset + slab.object_size <= pmm.PAGE_SIZE) : (offset += slab.object_size) {
        const node: *SlabFreeNode = @ptrFromInt(base + offset);
        node.next = slab.free_list;
        slab.free_list = node;
    }
    return true;
}
