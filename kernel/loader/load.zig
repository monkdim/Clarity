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
const segments = @import("segments.zig");

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
        // Zeroed for two reasons. The first is that pmm hands back whatever
        // was last in the frame, so an unzeroed stack lets a new process read
        // pages a previous one wrote — which is an information leak, not a
        // tidiness question. The second is that it is what builds the initial
        // stack frame below: argc, the argv terminator, the envp terminator
        // and the AT_NULL auxiliary entry are all zero, so zeroing the page
        // *is* writing them.
        zero_phys(phys);
        const virt = stack_bottom + p * pmm.PAGE_SIZE;
        vmm.map_page(space, virt, phys, vmm.PAGE_PRESENT | vmm.PAGE_WRITE | vmm.PAGE_USER | vmm.PAGE_NX) catch return error.OutOfMemory;
    }

    return .{
        .address_space = space,
        .entry_rip = exe.entry,
        // System V, §3.4.1: at entry %rsp points at argc, followed by argv's
        // pointers and a NULL, then envp and a NULL, then the auxiliary
        // vector ending in AT_NULL. A C runtime's entry stub reads argc from
        // (%rsp) and takes argv as %rsp+8, so it has to be a real frame and
        // not merely a valid address. The pages are zeroed above, which makes
        // this the empty case: no arguments, no environment. 64 bytes of
        // headroom keeps %rsp 16-byte aligned with room for all four
        // terminators.
        .user_rsp = USER_STACK_TOP - 64,
        .brk_start = brk_start,
    };
}

/// What loader/segments.zig needs to know about x86_64: how a page gets
/// mapped, and where a physical frame appears to the kernel.
pub const Ops = struct {
    pub const Space = vmm.AddressSpace;

    pub fn map(space: *Space, virt: u64, phys: u64, writable: bool, executable: bool) !void {
        var flags: u64 = vmm.PAGE_PRESENT | vmm.PAGE_USER;
        if (writable) flags |= vmm.PAGE_WRITE;
        if (!executable) flags |= vmm.PAGE_NX;
        return vmm.map_page(space, virt, phys, flags);
    }

    pub fn phys_to_virt(phys: u64) u64 {
        return 0xFFFF_8000_0000_0000 + phys;
    }
};

fn map_segment(space: *vmm.AddressSpace, seg: elf.Segment, image: []const u8) LoadError!void {
    try segments.map_segment(Ops, space, seg, image);

    // Record the region for the page-fault + brk machinery. This part is not
    // shared: it is what the x86_64 side does with a mapped range afterwards,
    // and the aarch64 side has no page-fault machinery to record it for yet.
    space.regions.append(heap.allocator(), .{
        .start = page_round_down(seg.vaddr),
        .end = page_round_up(seg.vaddr + seg.memsz),
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
    // The upper half has to be the kernel's, or the instruction after this
    // space's CR3 is installed is unmapped and the machine triple-faults.
    // This used to be a comment describing the intent, with no code.
    vmm.share_kernel_half(pml4);
    return space;
}

fn destroy_address_space(space: *vmm.AddressSpace, gpa: std.mem.Allocator) void {
    space.regions.deinit(heap.allocator());
    pmm.free_page(space.pml4_phys);
    gpa.destroy(space);
}

const page_round_down = segments.page_round_down;
const page_round_up = segments.page_round_up;

fn zero_phys(phys: u64) void {
    segments.zero(Ops, phys);
}
