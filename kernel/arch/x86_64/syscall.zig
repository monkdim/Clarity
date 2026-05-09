//! SYSCALL/SYSRET fast-path setup.
//!
//! On boot we point IA32_LSTAR at our entry trampoline, configure
//! IA32_STAR with the kernel + user segment selectors, and mask off
//! IF in IA32_FMASK so interrupts don't fire on the user → kernel
//! transition before we've swapped to a kernel stack.
//!
//! The entry trampoline:
//!   1. swapgs       — flips kernel GS into place
//!   2. saves user rsp into per-CPU storage
//!   3. loads kernel rsp from per-CPU storage
//!   4. pushes the saved user rsp + flags onto the kernel stack
//!   5. saves the rest of the user-visible register state
//!   6. calls dispatch.dispatch(nr, args)
//!   7. restores registers
//!   8. swapgs back, sysretq

const std = @import("std");
const dispatch = @import("../../syscall/dispatch.zig");

const IA32_EFER: u32 = 0xC000_0080;
const IA32_STAR: u32 = 0xC000_0081;
const IA32_LSTAR: u32 = 0xC000_0082;
const IA32_FMASK: u32 = 0xC000_0084;
const IA32_KERNEL_GS_BASE: u32 = 0xC000_0102;

/// Per-CPU scratch area we reach via gs:0.
pub const PerCpu = extern struct {
    kernel_rsp: u64,
    user_rsp_save: u64,
    current_thread: u64,
};

pub var per_cpu: PerCpu align(16) = undefined;

pub fn init() void {
    // EFER.SCE = 1 (enable SYSCALL/SYSRET)
    write_msr(IA32_EFER, read_msr(IA32_EFER) | 1);
    // STAR: kernel CS=0x08 in [47:32]; user CS=0x18 in [63:48] (the
    // CPU computes user_cs = STAR[63:48]+16 for sysret which lands
    // at 0x28+? — easier: set user base to 0x10 so user_cs = 0x1B,
    // user_ss = 0x23 with the RPL bits the GDT already has).
    write_msr(IA32_STAR, (@as(u64, 0x0008) << 32) | (@as(u64, 0x0010) << 48));
    write_msr(IA32_LSTAR, @intFromPtr(&syscall_entry));
    // Mask IF + DF + TF on entry; let the handler re-enable as it
    // sees fit.
    write_msr(IA32_FMASK, 0x0000_0700);
    write_msr(IA32_KERNEL_GS_BASE, @intFromPtr(&per_cpu));
}

inline fn read_msr(msr: u32) u64 {
    var lo: u32 = undefined;
    var hi: u32 = undefined;
    asm volatile ("rdmsr"
        : [lo] "={eax}" (lo),
          [hi] "={edx}" (hi),
        : [msr] "{ecx}" (msr),
    );
    return (@as(u64, hi) << 32) | lo;
}

inline fn write_msr(msr: u32, value: u64) void {
    const lo: u32 = @truncate(value);
    const hi: u32 = @truncate(value >> 32);
    asm volatile ("wrmsr"
        :
        : [lo] "{eax}" (lo),
          [hi] "{edx}" (hi),
          [msr] "{ecx}" (msr),
    );
}

/// SYSCALL entry point. Naked because we own register conventions
/// and the user RSP is still in %rsp on entry.
pub fn syscall_entry() callconv(.Naked) void {
    asm volatile (
        \\ swapgs                          // kernel GS in place
        \\ mov %rsp, %gs:8                 // save user rsp
        \\ mov %gs:0, %rsp                 // load kernel rsp
        \\
        \\ // Build a complete trap-style frame on the kernel stack
        \\ // so we can restore the user state precisely on return.
        \\ push %rcx                       // user rip (saved by SYSCALL)
        \\ push %r11                       // user rflags (saved by SYSCALL)
        \\ push %gs:8                      // user rsp
        \\ push %rax
        \\ push %rdi
        \\ push %rsi
        \\ push %rdx
        \\ push %r10
        \\ push %r8
        \\ push %r9
        \\
        \\ // Dispatch(nr=rax, a0..a5 in rdi/rsi/rdx/r10/r8/r9)
        \\ // The C dispatch function expects (nr, args struct) but
        \\ // here we hand it the six raw args.
        \\ mov %rax, %rdi                  // nr
        \\ // The other arg registers are already in the right slots
        \\ // for the System V calling convention except r10 -> rcx.
        \\ mov %r10, %rcx
        \\ call dispatch_syscall_c
        \\
        \\ // Pop everything we pushed (rax holds the return value).
        \\ pop %r9
        \\ pop %r8
        \\ pop %r10
        \\ pop %rdx
        \\ pop %rsi
        \\ pop %rdi
        \\ add $8, %rsp                    // skip saved rax (we want our return value)
        \\ pop %rsp                        // restore user rsp from frame
        \\ pop %r11                        // user rflags
        \\ pop %rcx                        // user rip
        \\
        \\ swapgs
        \\ sysretq
    );
}

/// C-callable bridge: takes the six syscall args System V style,
/// forwards to dispatch.dispatch, returns the i64 result in rax.
export fn dispatch_syscall_c(nr: u64, a0: u64, a1: u64, a2: u64, a3: u64, a4: u64, a5: u64) callconv(.C) i64 {
    return dispatch.dispatch(nr, .{
        .a0 = a0, .a1 = a1, .a2 = a2,
        .a3 = a3, .a4 = a4, .a5 = a5,
    });
}
