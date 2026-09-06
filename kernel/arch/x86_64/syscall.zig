//! SYSCALL/SYSRET fast-path setup.
//!
//! Userspace sets %rax to the syscall number and the arguments in
//! %rdi/%rsi/%rdx/%r10/%r8/%r9, then issues `syscall`. The CPU stashes the
//! return address in %rcx and RFLAGS in %r11, loads CS/SS from IA32_STAR, and
//! jumps to IA32_LSTAR — all *without* switching stacks. Everything else is
//! ours to do.
//!
//! Two things about the entry path are easy to get subtly wrong and fail in
//! ways that look like random corruption rather than a clear fault:
//!
//!   - The argument registers overlap the System V ones. %rdi already holds
//!     the first syscall argument, so writing the syscall number into it
//!     before reading it destroys that argument. The trampoline builds the
//!     argument block on the kernel stack and passes a pointer instead, which
//!     removes the shuffle entirely.
//!   - The user %rsp must be restored *after* the saved %rcx and %r11 are
//!     popped, not before: popping into %rsp first moves the stack pointer to
//!     the user stack and the remaining pops then read user memory.

const std = @import("std");
const dispatch = @import("../../syscall/dispatch.zig");
const gdt = @import("gdt.zig");

const IA32_EFER: u32 = 0xC000_0080;
const IA32_STAR: u32 = 0xC000_0081;
const IA32_LSTAR: u32 = 0xC000_0082;
const IA32_FMASK: u32 = 0xC000_0084;
const IA32_GS_BASE: u32 = 0xC000_0101;
const IA32_KERNEL_GS_BASE: u32 = 0xC000_0102;

/// Per-CPU scratch reached through %gs. The trampoline hardcodes the offsets,
/// so they are asserted rather than trusted.
pub const PerCpu = extern struct {
    kernel_rsp: u64 = 0,
    user_rsp_save: u64 = 0,
    current_thread: u64 = 0,
};

comptime {
    std.debug.assert(@offsetOf(PerCpu, "kernel_rsp") == 0);
    std.debug.assert(@offsetOf(PerCpu, "user_rsp_save") == 8);
}

pub var per_cpu: PerCpu align(16) = .{};

/// Stack the syscall trampoline switches to. Separate from the TSS's RSP0
/// because SYSCALL does not switch stacks itself and does not consult the TSS.
var syscall_stack: [16 * 1024]u8 align(16) = undefined;

pub fn init() void {
    per_cpu.kernel_rsp = @intFromPtr(&syscall_stack) + syscall_stack.len;

    // EFER.SCE — without this `syscall` is an invalid opcode.
    write_msr(IA32_EFER, read_msr(IA32_EFER) | 1);

    // STAR[47:32] is the kernel selector pair: SYSCALL loads CS from it and
    // SS from it+8, so 0x08/0x10. STAR[63:48] is the user base: SYSRET loads
    // SS from base+8 and CS from base+16, so 0x10 gives 0x18/0x20 — which is
    // why gdt.zig puts the user *data* descriptor first.
    write_msr(IA32_STAR, (@as(u64, gdt.KERNEL_CODE) << 32) |
        (@as(u64, gdt.STAR_USER_BASE) << 48));
    write_msr(IA32_LSTAR, @intFromPtr(&syscall_entry));

    // Clear TF, IF and DF on entry. IF especially: an interrupt taken between
    // the `syscall` and the stack switch would run on the user stack.
    write_msr(IA32_FMASK, 0x0000_0700);

    // While in the kernel, GS points at per_cpu and the shadow holds the
    // user's value; `swapgs` on each boundary keeps that true.
    write_msr(IA32_GS_BASE, @intFromPtr(&per_cpu));
    write_msr(IA32_KERNEL_GS_BASE, 0);
}

fn read_msr(msr: u32) u64 {
    var lo: u32 = undefined;
    var hi: u32 = undefined;
    asm volatile ("rdmsr"
        : [lo] "={eax}" (lo),
          [hi] "={edx}" (hi),
        : [msr] "{ecx}" (msr),
    );
    return (@as(u64, hi) << 32) | lo;
}

fn write_msr(msr: u32, value: u64) void {
    asm volatile ("wrmsr"
        :
        : [lo] "{eax}" (@as(u32, @truncate(value))),
          [hi] "{edx}" (@as(u32, @truncate(value >> 32))),
          [msr] "{ecx}" (msr),
    );
}

/// SYSCALL entry. Naked: on entry %rsp still points at the *user* stack and
/// nothing may touch it before the switch.
///
/// Ten pushes before the call keeps the frame 16-byte aligned, which System V
/// requires at the call site; the saved %rax doubles as that padding.
pub fn syscall_entry() callconv(.Naked) void {
    asm volatile (
        \\ swapgs
        \\ movq %rsp, %gs:8
        \\ movq %gs:0, %rsp
        \\ pushq %rcx
        \\ pushq %r11
        \\ pushq %gs:8
        \\ pushq %rax
        \\ pushq %r9
        \\ pushq %r8
        \\ pushq %r10
        \\ pushq %rdx
        \\ pushq %rsi
        \\ pushq %rdi
        \\ movq %rax, %rdi
        \\ movq %rsp, %rsi
        \\ call dispatch_syscall_c
        \\ addq $56, %rsp
        \\ popq %r10
        \\ popq %r11
        \\ popq %rcx
        \\ movq %r10, %rsp
        \\ swapgs
        \\ sysretq
    );
}

/// The six pushed argument registers, in the order the trampoline pushes
/// them, so a pointer to the lowest one is a pointer to this struct.
const RawArgs = extern struct {
    a0: u64,
    a1: u64,
    a2: u64,
    a3: u64,
    a4: u64,
    a5: u64,
};

export fn dispatch_syscall_c(nr: u64, args: *const RawArgs) callconv(.C) i64 {
    return dispatch.dispatch(nr, .{
        .a0 = args.a0,
        .a1 = args.a1,
        .a2 = args.a2,
        .a3 = args.a3,
        .a4 = args.a4,
        .a5 = args.a5,
    });
}
