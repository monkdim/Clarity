//! Paging — 4-level (PML4/PDPT/PD/PT) page tables.
//! Most of the heavy lifting lives in mm/vmm.zig; this file
//! exists so the kernel main entry has a hook for arch-specific
//! init (cr3 swap, recursive map, page-fault handler).

const std = @import("std");

pub fn init() void {
    // The boot stub already set up the bootstrap page tables. We
    // re-load them here through Zig once kernel_main is in long mode.
}

pub fn switch_address_space(cr3_phys: u64) void {
    asm volatile ("mov %[cr3], %%cr3"
        :
        : [cr3] "r" (cr3_phys),
        : "memory"
    );
}
