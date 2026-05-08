//! CPU context save/restore for cooperative + preemptive task
//! switching. We save the callee-saved register set (System V
//! AMD64 ABI: rbx, rbp, r12-r15) plus rsp + rip, since that's all
//! we need to resume a kernel thread from where it left off. User
//! threads add the full IRET frame on entry.

const std = @import("std");

pub const Context = extern struct {
    rsp: u64,
    rbp: u64,
    rbx: u64,
    r12: u64,
    r13: u64,
    r14: u64,
    r15: u64,
    rip: u64,
};

/// Switch from `prev` to `next`. Saves the current callee-saved
/// state into `prev` and restores `next`. After the call, execution
/// resumes wherever `next.rip` points — which for a brand-new
/// thread is `arch_thread_entry`, and for a previously-running
/// thread is the instruction right after its own switch_to call.
pub fn switch_to(prev: *Context, next: *const Context) callconv(.Naked) void {
    asm volatile (
        \\ push %rbp
        \\ push %rbx
        \\ push %r12
        \\ push %r13
        \\ push %r14
        \\ push %r15
        \\ mov  %rsp, 0(%rdi)         // prev.rsp = current rsp
        \\ mov  $1f, %rax              // record the resume label as prev.rip
        \\ mov  %rax, 56(%rdi)
        \\ mov  0(%rsi), %rsp         // next.rsp -> rsp
        \\ pop  %r15
        \\ pop  %r14
        \\ pop  %r13
        \\ pop  %r12
        \\ pop  %rbx
        \\ pop  %rbp
        \\ jmp  *56(%rsi)              // jump to next.rip
        \\1:
        \\ ret
    );
}

/// Initialise a brand-new kernel thread's context so that the
/// first switch_to lands at `entry` with `arg` in %rdi. The stack
/// must be allocated by the caller; `stack_top` points one byte
/// past the highest valid byte.
pub fn init_kernel_thread(ctx: *Context, stack_top: u64, entry: *const fn (u64) callconv(.C) noreturn, arg: u64) void {
    var rsp = stack_top & ~@as(u64, 0xF);
    // Pre-push the six callee-saved registers our switch_to will pop.
    rsp -= 8 * 6;
    const slots: [*]u64 = @ptrFromInt(rsp);
    slots[0] = 0;             // r15
    slots[1] = 0;             // r14
    slots[2] = 0;             // r13
    slots[3] = 0;             // r12
    slots[4] = 0;             // rbx
    slots[5] = arg;           // rbp — repurposed; first instruction of `entry` will move it to rdi
    ctx.rsp = rsp;
    ctx.rbp = 0;
    ctx.rbx = 0;
    ctx.r12 = 0; ctx.r13 = 0; ctx.r14 = 0; ctx.r15 = 0;
    ctx.rip = @intFromPtr(entry);
}

/// Build the IRET frame on `kstack_top` that returns to user mode
/// at `user_rip` with `user_rsp`. Returns the new rsp the kernel
/// should switch to before issuing iretq.
pub fn build_iret_frame(kstack_top: u64, user_rip: u64, user_rsp: u64, user_rflags: u64, user_cs: u16, user_ss: u16) u64 {
    var rsp = kstack_top & ~@as(u64, 0xF);
    rsp -= @sizeOf(IretFrame);
    const frame: *IretFrame = @ptrFromInt(rsp);
    frame.* = .{
        .rip = user_rip,
        .cs = user_cs,
        .rflags = user_rflags,
        .rsp = user_rsp,
        .ss = user_ss,
    };
    return rsp;
}

pub const IretFrame = extern struct {
    rip: u64,
    cs: u64,        // 16-bit selector zero-extended into 64-bit slot
    rflags: u64,
    rsp: u64,
    ss: u64,
};

/// Issue iretq using a pre-built frame at the current RSP.
pub fn enter_userland(rsp_with_iret_frame: u64) callconv(.Naked) noreturn {
    asm volatile (
        \\ mov %rdi, %rsp
        \\ swapgs                      // user GS, before iretq
        \\ iretq
    );
}
