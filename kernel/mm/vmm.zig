//! Virtual memory manager — 4-level page tables for x86_64.
//!
//! Each user process owns its own PML4. The kernel's higher half
//! (>= 0xFFFF_8000_0000_0000) is shared across every address space
//! by sharing the upper 256 PML4 entries. Demand paging is handled
//! by the page-fault handler in idt.zig — when a page-fault hits an
//! address inside an mmap()'d region, the handler asks pmm for a
//! page and maps it in.

const std = @import("std");
const pmm = @import("pmm.zig");

pub const PAGE_PRESENT: u64 = 1 << 0;
pub const PAGE_WRITE: u64 = 1 << 1;
pub const PAGE_USER: u64 = 1 << 2;
pub const PAGE_NX: u64 = 1 << 63;

pub const ADDR_MASK: u64 = 0x000FFFFFFFFFF000;

/// One per process. Holds the root page table phys addr + a small
/// list of region descriptors so the kernel knows what's mapped at
/// what permissions. Region list is checked on page fault.
pub const AddressSpace = struct {
    pml4_phys: u64,
    regions: std.ArrayListUnmanaged(Region),

    pub const Region = struct {
        start: u64,
        end: u64,
        flags: u64,
        backing: Backing,
    };

    pub const Backing = union(enum) {
        anonymous,
        file: struct { inode_num: u64, offset: u64 },
        device: struct { phys_base: u64 },
    };
};

pub fn init() void {
    // Kernel address space's PML4 was set up by the boot stub; we
    // adopt it here and keep its phys addr for cloning into new
    // processes.
}

pub fn map_page(space: *AddressSpace, virt: u64, phys: u64, flags: u64) !void {
    // Walk the four levels, allocating intermediate tables on demand.
    // Each table is one 4 KiB page from the pmm. Returns error.OutOfMemory
    // if we exhaust physical pages before the path completes.
    const indices = [_]u9{
        @intCast((virt >> 39) & 0x1FF),
        @intCast((virt >> 30) & 0x1FF),
        @intCast((virt >> 21) & 0x1FF),
        @intCast((virt >> 12) & 0x1FF),
    };
    var table_phys = space.pml4_phys;
    var level: usize = 0;
    while (level < 3) : (level += 1) {
        const table = phys_to_table(table_phys);
        const entry = &table[indices[level]];
        if (entry.* & PAGE_PRESENT == 0) {
            const new_table = pmm.alloc_page() orelse return error.OutOfMemory;
            zero_page(new_table);
            entry.* = new_table | PAGE_PRESENT | PAGE_WRITE | PAGE_USER;
        }
        table_phys = entry.* & ADDR_MASK;
    }
    const leaf = phys_to_table(table_phys);
    leaf[indices[3]] = (phys & ADDR_MASK) | flags | PAGE_PRESENT;
    flush_tlb_entry(virt);
}

pub fn unmap_page(space: *AddressSpace, virt: u64) void {
    const indices = [_]u9{
        @intCast((virt >> 39) & 0x1FF),
        @intCast((virt >> 30) & 0x1FF),
        @intCast((virt >> 21) & 0x1FF),
        @intCast((virt >> 12) & 0x1FF),
    };
    var table_phys = space.pml4_phys;
    var level: usize = 0;
    while (level < 3) : (level += 1) {
        const table = phys_to_table(table_phys);
        const entry = table[indices[level]];
        if (entry & PAGE_PRESENT == 0) return;
        table_phys = entry & ADDR_MASK;
    }
    const leaf = phys_to_table(table_phys);
    leaf[indices[3]] = 0;
    flush_tlb_entry(virt);
}

fn phys_to_table(phys: u64) *[512]u64 {
    // The boot stub identity-mapped physical memory at the high
    // half offset. Adjust when we move to a recursive map.
    const HHDM_BASE: u64 = 0xFFFF_8000_0000_0000;
    return @ptrFromInt(HHDM_BASE + phys);
}

fn zero_page(phys: u64) void {
    const ptr: [*]u8 = @ptrFromInt(0xFFFF_8000_0000_0000 + phys);
    @memset(ptr[0..pmm.PAGE_SIZE], 0);
}

fn flush_tlb_entry(virt: u64) void {
    asm volatile ("invlpg (%[addr])"
        :
        : [addr] "r" (virt),
        : "memory"
    );
}
