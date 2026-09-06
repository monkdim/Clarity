//! x87 and SSE: turning them on, and the state a thread owns.
//!
//! Nothing in the kernel uses floating point — it is built with `soft_float`
//! and with SSE subtracted from the CPU feature set, deliberately, so that an
//! interrupt handler can never be the thing that clobbers a register nobody
//! saved. Userspace is a different matter: a compiled Clarity program is C,
//! and C on x86-64 passes and returns every `double` in `xmm0`. Without the
//! two control-register bits below, its first floating-point instruction
//! raises #UD and the process dies before it prints anything.
//!
//! Two bits in CR0 and two in CR4, and then the state has to be switched with
//! the thread, or two processes doing arithmetic at the same time would see
//! each other's registers. That save lives in context.S, next to the
//! general-purpose registers, because it has exactly the same lifetime.

/// The FXSAVE area is 512 bytes and must be 16-byte aligned.
pub const AREA_SIZE = 512;

/// A valid FXSAVE image describing a freshly initialised FPU: this is what a
/// thread starts with.
///
/// It cannot simply be zeroes. FXRSTOR reads MXCSR out of the image, and an
/// all-zero MXCSR unmasks every SSE exception — so the first inexact result,
/// which is to say the first division, would raise #XM. 0x1F80 is the reset
/// value, with all six exception masks set. 0x037F likewise is the x87
/// control word's reset value: 64-bit precision, round to nearest, all
/// exceptions masked.
pub const CLEAN: [AREA_SIZE]u8 = blk: {
    var a = [_]u8{0} ** AREA_SIZE;
    a[0] = 0x7F;  a[1] = 0x03;    // FCW = 0x037F
    a[24] = 0x80; a[25] = 0x1F;   // MXCSR = 0x1F80
    break :blk a;
};

/// A 16-byte-aligned copy of CLEAN, because FXRSTOR needs an aligned operand
/// and a `const` in .rodata carries no such guarantee on its own.
var clean_area: [AREA_SIZE]u8 align(16) = CLEAN;

/// Enable x87 and SSE for this CPU.
///
/// CR0.EM (bit 2) must be *clear*: set, it makes every SSE instruction trap
/// to the #NM handler so that a kernel can emulate them, which is not what is
/// wanted here. CR0.MP (bit 1) set makes `wait`/`fwait` respect TS, which is
/// the configuration Intel documents alongside EM=0.
///
/// CR4.OSFXSR (bit 9) is the one that actually turns SSE on: it tells the CPU
/// that this operating system knows how to save the SSE state with FXSAVE, and
/// until it is set every SSE instruction raises #UD no matter what CR0 says.
/// CR4.OSXMMEXCPT (bit 10) routes unmasked SSE exceptions to #XM rather than
/// to #UD, which only matters once something unmasks one — but a #UD reported
/// for an arithmetic fault is a genuinely confusing thing to debug.
pub fn enable() void {
    var cr0 = asm volatile ("movq %%cr0, %[out]"
        : [out] "=r" (-> u64),
    );
    cr0 &= ~@as(u64, 1 << 2);   // clear EM
    cr0 |= 1 << 1;              // set MP
    asm volatile ("movq %[v], %%cr0"
        :
        : [v] "r" (cr0),
        : "memory"
    );

    var cr4 = asm volatile ("movq %%cr4, %[out]"
        : [out] "=r" (-> u64),
    );
    cr4 |= 1 << 9;              // OSFXSR
    cr4 |= 1 << 10;             // OSXMMEXCPT
    asm volatile ("movq %[v], %%cr4"
        :
        : [v] "r" (cr4),
        : "memory"
    );

    // Put the hardware into the same state CLEAN describes, so the very first
    // FXSAVE — of whatever was running before any thread existed — records a
    // sane image rather than whatever the firmware left behind.
    //
    // One FXRSTOR rather than `fninit` plus `ldmxcsr`, and not for brevity:
    // `ldmxcsr` requires the SSE feature, and this module is compiled with SSE
    // subtracted from the target, so the assembler would refuse it. FXRSTOR
    // needs only `fxsr`, which is still in the feature set, and it sets the
    // x87 control word, the tag word and MXCSR together — which is the whole
    // of what the other two would have done.
    asm volatile ("fxrstor (%[p])"
        :
        : [p] "r" (&clean_area),
        : "memory"
    );
}
