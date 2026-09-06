//! The kernel's view of physical memory.
//!
//! The aarch64 kernel is linked for the top of the address space and loaded
//! at the bottom of it (see boot/linker_aarch64.ld). Once the MMU is on and
//! the identity map is gone, a physical address is not something the kernel
//! can dereference — every driver base out of the device tree, every page the
//! allocator hands back, every buffer address handed to a device has to be
//! translated in one direction or the other, explicitly.
//!
//! The mapping is a direct one: virtual = physical + KERNEL_VA_BASE, for all
//! of physical memory the kernel has mapped. That base is the first address
//! TTBR1_EL1 translates in a 39-bit VA space (T1SZ = 25), which is what makes
//! the arithmetic a single addition rather than a table lookup, and what lets
//! one level-1 table serve as both the identity map and the high map during
//! boot.
//!
//! The x86_64 side calls the same idea its HHDM, at 0xFFFF_8000_0000_0000.

/// Where physical address zero appears in the kernel's address space.
/// Must match KERNEL_VA_BASE in boot/linker_aarch64.ld and the T1SZ the boot
/// stub programs into TCR_EL1 — a mismatch is a kernel that faults on its
/// first access rather than one that is subtly wrong.
pub const KERNEL_VA_BASE: u64 = 0xFFFF_FF80_0000_0000;

/// The kernel address a physical one appears at.
pub inline fn phys_to_virt(phys: u64) u64 {
    return phys + KERNEL_VA_BASE;
}

/// The physical address behind a kernel one. Valid for addresses inside the
/// direct map — which is every kernel address, since the kernel image itself
/// is mapped there too.
pub inline fn virt_to_phys(virt: u64) u64 {
    return virt - KERNEL_VA_BASE;
}

/// A typed pointer to a physical address, for the common case of touching a
/// page the allocator returned or a device register the device tree named.
pub inline fn ptr_to_phys(comptime T: type, phys: u64) T {
    return @ptrFromInt(phys_to_virt(phys));
}
