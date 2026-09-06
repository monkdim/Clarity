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
/// PS in a PDPT or PD entry: this entry maps a 1 GiB or 2 MiB page directly
/// rather than pointing at the next level.
pub const PAGE_HUGE: u64 = 1 << 7;

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

/// The kernel's own address space. The boot stub built the page tables
/// (identity + HHDM + kernel window) and loaded them into CR3; init()
/// adopts that tree so later kernel mappings — the framebuffer, MMIO —
/// target the live tables instead of an undefined address space.
var kernel_space: AddressSpace = .{ .pml4_phys = 0, .regions = .{} };

fn read_cr3() u64 {
    return asm volatile ("mov %%cr3, %[ret]"
        : [ret] "=r" (-> u64),
    );
}

pub fn init() void {
    kernel_space.pml4_phys = read_cr3() & ADDR_MASK;
}

/// The kernel address space. Valid after init().
pub fn kernel() *AddressSpace {
    return &kernel_space;
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
        } else if (level > 0 and (entry.* & PAGE_HUGE) != 0) {
            // A 1 GiB or 2 MiB page already covers this address. Its frame
            // address is *not* a page table, so descending into it would
            // write page-table entries into whatever data lives there and
            // leave the mapping unchanged — silent corruption. The boot stub
            // identity-maps the first gigabyte with 2 MiB pages, so this is
            // the normal case for any 4 KiB mapping below 1 GiB, not an edge
            // case. Split it into a full table covering the same range with
            // the same permissions, then carry on down.
            try split_huge_page(entry, level);
        }
        table_phys = entry.* & ADDR_MASK;
    }
    const leaf = phys_to_table(table_phys);
    leaf[indices[3]] = (phys & ADDR_MASK) | flags | PAGE_PRESENT;
    flush_tlb_entry(virt);
}

/// Replace a huge-page entry with a table of smaller entries covering exactly
/// the same range and permissions. `level` is 1 for a 1 GiB PDPT entry (split
/// into 512 × 2 MiB) and 2 for a 2 MiB PD entry (split into 512 × 4 KiB).
fn split_huge_page(entry: *u64, level: usize) !void {
    const old = entry.*;
    const base = old & ADDR_MASK;
    // Everything except the frame address and PS; PS stays set on the children
    // only when they are themselves huge (a 1 GiB split yields 2 MiB pages).
    // Note the PAT bit moves between huge (bit 12) and 4 KiB (bit 7) entries;
    // nothing here sets it, so it is dropped rather than translated.
    const flags = old & ~ADDR_MASK & ~PAGE_HUGE;
    const child_stride: u64 = if (level == 1) 2 * 1024 * 1024 else 4096;
    const child_huge: u64 = if (level == 1) PAGE_HUGE else 0;

    const table_phys = pmm.alloc_page() orelse return error.OutOfMemory;
    const table = phys_to_table(table_phys);
    var i: usize = 0;
    while (i < 512) : (i += 1) {
        table[i] = (base + @as(u64, i) * child_stride) | flags | child_huge;
    }
    // The parent must stay as permissive as the widest child; the leaf entries
    // carry the real permissions.
    entry.* = table_phys | PAGE_PRESENT | PAGE_WRITE | PAGE_USER;
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

// ── Page-fault decision logic ─────────────────────

pub const PageFaultError = error{
    OutOfMemory,
    NotMapped,
    Protection,
    Unaligned,
};

pub const FaultCause = enum {
    not_present,
    write_to_readonly,
    user_access_to_kernel,
    reserved_bit_set,
    instruction_fetch,
};

pub fn classify_fault(error_code: u64) FaultCause {
    if ((error_code & 0x10) != 0) return .instruction_fetch;
    if ((error_code & 0x08) != 0) return .reserved_bit_set;
    if ((error_code & 0x04) != 0 and (error_code & 0x01) == 0) return .user_access_to_kernel;
    if ((error_code & 0x02) != 0 and (error_code & 0x01) != 0) return .write_to_readonly;
    return .not_present;
}

/// Walk the address space's region list; if `addr` falls inside a
/// known region, allocate a page (or COW a shared one) and map it.
/// Returns `error.NotMapped` for true segfaults.
pub fn handle_page_fault(space: *AddressSpace, faulting_addr: u64, error_code: u64) PageFaultError!void {
    const cause = classify_fault(error_code);
    const region = find_region(space, faulting_addr) orelse return error.NotMapped;
    if (cause == .write_to_readonly and (region.flags & PAGE_WRITE) == 0) {
        return error.Protection;
    }
    const phys = pmm.alloc_page() orelse return error.OutOfMemory;
    var flags: u64 = PAGE_PRESENT | PAGE_USER;
    if ((region.flags & PAGE_WRITE) != 0) flags |= PAGE_WRITE;
    const aligned = faulting_addr & ~@as(u64, pmm.PAGE_SIZE - 1);
    map_page(space, aligned, phys, flags) catch return error.OutOfMemory;
}

fn find_region(space: *AddressSpace, addr: u64) ?*const AddressSpace.Region {
    for (space.regions.items) |*r| {
        if (addr >= r.start and addr < r.end) return r;
    }
    return null;
}
