//! SMEP and SMAP: the CPU refusing to run or touch user memory from ring 0.
//!
//! With CR4.SMEP set, a jump into a user page from the kernel is a fault.
//! With CR4.SMAP set, a kernel read or write through a user address is a
//! fault unless RFLAGS.AC is set, and nothing here ever sets it: every
//! access to a process's memory goes through mm/uaccess.zig and the direct
//! map of the physical frame. So SMAP is not a permission the kernel asks
//! for and hands back around each copy; it is a tripwire. A path that still
//! dereferences a user pointer directly would work on a CPU without SMAP,
//! and crash on one with it, which is why the boot gate runs the kernel
//! under `-cpu max` as well as the default `qemu64`, which has neither.
//!
//! Both are advertised by CPUID leaf 7: SMEP in EBX bit 7, SMAP in EBX
//! bit 20. The default QEMU CPU has neither, so the boot log says which
//! it got rather than claiming protection the hardware did not provide.

pub const Status = struct {
    smep: bool,
    smap: bool,
};

fn cpuid7_ebx() u32 {
    var ebx: u32 = 0;
    asm volatile (
        \\movl $7, %%eax
        \\xorl %%ecx, %%ecx
        \\cpuid
        : [ebx] "={ebx}" (ebx),
        :
        : "eax", "ecx", "edx"
    );
    return ebx;
}

/// Turn on whichever of the two the CPU has, and report what was done.
pub fn enable() Status {
    const ebx = cpuid7_ebx();
    const has_smep = (ebx & (1 << 7)) != 0;
    const has_smap = (ebx & (1 << 20)) != 0;

    var cr4 = asm volatile ("movq %%cr4, %[out]"
        : [out] "=r" (-> u64),
    );
    if (has_smep) cr4 |= 1 << 20;
    if (has_smap) cr4 |= 1 << 21;
    asm volatile ("movq %[v], %%cr4"
        :
        : [v] "r" (cr4),
        : "memory"
    );

    // Read back the register rather than trusting the write: the report is
    // what the CPU holds, which is the only thing worth printing.
    const now = asm volatile ("movq %%cr4, %[out]"
        : [out] "=r" (-> u64),
    );
    return .{
        .smep = (now & (1 << 20)) != 0,
        .smap = (now & (1 << 21)) != 0,
    };
}
