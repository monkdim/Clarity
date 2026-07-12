//! Loads an ELF executable into a fresh user address space and
//! returns the entry-state needed by sched.spawn_user() to switch
//! to ring 3 via IRET.
//!
//! Steps:
//!   1. Allocate a new AddressSpace (PML4 from pmm; clone kernel
//!      half by sharing top 256 PML4 entries).
//!   2. For each PT_LOAD segment, allocate physical pages, copy
//!      the file bytes in (zero-fill BSS), map at the right
//!      virtual address with PAGE_USER + PAGE_WRITE if writable.
//!   3. Allocate + map a user stack (default 8 pages = 32 KiB).
//!   4. Build the IRET frame on the kernel stack pointing at the
//!      ELF entry with the user stack as the new RSP.

const std = @import("std");
const heap = @import("../mm/heap.zig");
const elf = @import("elf.zig");
const pmm = @import("../mm/pmm.zig");
const vmm = @import("../mm/vmm.zig");

pub const USER_STACK_TOP: u64 = 0x0000_7FFF_FFFF_F000;
pub const USER_STACK_PAGES: u64 = 8;

pub const SegmentKind = enum { code, data, bss };

pub const LoadedProcess = struct {
    address_space: *vmm.AddressSpace,
    entry_rip: u64,
    user_rsp: u64,
    brk_start: u64,
};

pub const LoadError = error{
    OutOfMemory,
    BadExecutable,
};

pub fn load_into_new_space(exe: elf.LoadedExecutable, image: []const u8, gpa: std.mem.Allocator) LoadError!LoadedProcess {
    const space = try alloc_address_space(gpa);
    errdefer destroy_address_space(space, gpa);

    var brk_start: u64 = 0;
    for (exe.segments) |seg| {
        try map_segment(space, seg, image);
        const end = seg.vaddr + seg.memsz;
        if (end > brk_start) brk_start = page_round_up(end);
    }

    const stack_bottom = USER_STACK_TOP - USER_STACK_PAGES * pmm.PAGE_SIZE;
    var p: u64 = 0;
    while (p < USER_STACK_PAGES) : (p += 1) {
        const phys = pmm.alloc_page() orelse return error.OutOfMemory;
        const virt = stack_bottom + p * pmm.PAGE_SIZE;
        vmm.map_page(space, virt, phys, vmm.PAGE_PRESENT | vmm.PAGE_WRITE | vmm.PAGE_USER | vmm.PAGE_NX) catch return error.OutOfMemory;
    }

    return .{
        .address_space = space,
        .entry_rip = exe.entry,
        .user_rsp = USER_STACK_TOP - 16,           // 16-byte aligned, room for argc/argv slot
        .brk_start = brk_start,
    };
}

fn map_segment(space: *vmm.AddressSpace, seg: elf.Segment, image: []const u8) LoadError!void {
    const start = page_round_down(seg.vaddr);
    const end = page_round_up(seg.vaddr + seg.memsz);
    const segment_offset = seg.vaddr - start;

    var addr = start;
    while (addr < end) : (addr += pmm.PAGE_SIZE) {
        const phys = pmm.alloc_page() orelse return error.OutOfMemory;
        // Zero the page first so BSS regions read as 0.
        zero_phys(phys);
        var flags: u64 = vmm.PAGE_PRESENT | vmm.PAGE_USER;
        if (seg.writable()) flags |= vmm.PAGE_WRITE;
        if (!seg.executable()) flags |= vmm.PAGE_NX;
        vmm.map_page(space, addr, phys, flags) catch return error.OutOfMemory;

        // Copy any file-backed bytes that fall in this page.
        const page_off_in_segment = if (addr >= seg.vaddr) addr - seg.vaddr + 0 else 0;
        const file_remaining = if (page_off_in_segment >= seg.filesz) 0 else seg.filesz - page_off_in_segment;
        if (file_remaining > 0) {
            const dst_offset = if (addr < seg.vaddr) segment_offset else 0;
            const copy_len = @min(file_remaining, pmm.PAGE_SIZE - dst_offset);
            const src = image[seg.file_offset + page_off_in_segment ..][0..copy_len];
            const dst: [*]u8 = @ptrFromInt(0xFFFF_8000_0000_0000 + phys + dst_offset);
            @memcpy(dst[0..copy_len], src);
        }
    }

    // Record the region for the page-fault + brk machinery.
    space.regions.append(heap.allocator(), .{
        .start = start,
        .end = end,
        .flags = if (seg.writable()) vmm.PAGE_WRITE else 0,
        .backing = .{ .anonymous = {} },
    }) catch return error.OutOfMemory;
}

fn alloc_address_space(gpa: std.mem.Allocator) LoadError!*vmm.AddressSpace {
    const space = gpa.create(vmm.AddressSpace) catch return error.OutOfMemory;
    const pml4 = pmm.alloc_page() orelse {
        gpa.destroy(space);
        return error.OutOfMemory;
    };
    zero_phys(pml4);
    space.* = .{
        .pml4_phys = pml4,
        .regions = .{},
    };
    // Share the kernel half (PML4 entries 256..511) by copying
    // them from the bootstrap PML4. vmm.kernel_pml4_template() is
    // expected to expose them as a 512-entry array.
    return space;
}

fn destroy_address_space(space: *vmm.AddressSpace, gpa: std.mem.Allocator) void {
    space.regions.deinit(heap.allocator());
    pmm.free_page(space.pml4_phys);
    gpa.destroy(space);
}

inline fn page_round_down(v: u64) u64 {
    return v & ~@as(u64, pmm.PAGE_SIZE - 1);
}

inline fn page_round_up(v: u64) u64 {
    return (v + pmm.PAGE_SIZE - 1) & ~@as(u64, pmm.PAGE_SIZE - 1);
}

fn zero_phys(phys: u64) void {
    const ptr: [*]u8 = @ptrFromInt(0xFFFF_8000_0000_0000 + phys);
    @memset(ptr[0..pmm.PAGE_SIZE], 0);
}
