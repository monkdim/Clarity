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

/// Switch from `prev` to `next`. Saves the callee-saved state onto `prev`'s
/// own stack, records where to resume, and restores `next`. After the call,
/// execution continues wherever `next.rip` points — for a brand-new thread
/// its entry point, for one that has run before the instruction after its own
/// switch_to.
///
/// Defined in context.S. It cannot be written here: manipulating %rsp and
/// returning through a saved instruction pointer requires `callconv(.Naked)`,
/// and Zig will not call a naked function because it has no ABI.
pub extern fn clarity_switch_to(prev: *Context, next: *const Context) callconv(.C) void;

pub const switch_to = clarity_switch_to;

comptime {
    // context.S hardcodes these two offsets.
    std.debug.assert(@offsetOf(Context, "rsp") == 0);
    std.debug.assert(@offsetOf(Context, "rip") == 56);
}

/// Initialise a brand-new kernel thread's context so that the
/// first switch_to lands at `entry` with `arg` in %rdi. The stack
/// must be allocated by the caller; `stack_top` points one byte
/// past the highest valid byte.
pub fn init_kernel_thread(ctx: *Context, stack_top: u64, entry: *const fn (u64) callconv(.C) noreturn, arg: u64) void {
    var rsp = stack_top & ~@as(u64, 0xF);
    // Pre-push exactly what switch_to pops, in the order it pops them: the
    // six callee-saved registers, then RFLAGS (pushed first, so popped last).
    rsp -= 8 * 7;
    const slots: [*]u64 = @ptrFromInt(rsp);
    slots[0] = 0;             // r15
    slots[1] = 0;             // r14
    slots[2] = 0;             // r13
    slots[3] = 0;             // r12
    slots[4] = 0;             // rbx
    slots[5] = arg;           // rbp — repurposed; first instruction of `entry` will move it to rdi
    // IF=1 (bit 9) and the reserved bit 1, which is always set. A thread that
    // started with interrupts off could never be preempted, and the first
    // switch into a new thread often comes from inside the timer's interrupt
    // gate, where IF is 0 — so this has to be stated, not inherited.
    slots[6] = 0x202;         // rflags
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

/// Install the address space `cr3` and enter ring 3 with a frame already
/// built at `frame_rsp`.
///
/// Not `callconv(.Naked)`: a naked function has no ABI, so Zig refuses to
/// call one, and this was previously uncallable — it only compiled because
/// nothing reached it. A normal function works because the prologue is
/// irrelevant once %rsp is replaced and `iretq` leaves for good.
///
/// The CR3 load belongs here, in the same asm block, rather than at the call
/// site. The boot path runs on the stack the boot stub set up, which is a
/// low identity-mapped address; the process's address space maps its own
/// program and stack in the lower half and nothing else, so the moment CR3
/// changes that stack is gone. Any stack access before %rsp moves to the
/// thread's kernel stack — a push, a call, a spilled register — would fault,
/// and the fault handler would push its frame onto the same missing stack:
/// double fault, then triple, then a silent reset. Between these two
/// instructions there is no memory access at all, and both operands are
/// already in registers before the block begins.
///
/// `cli` for the same reason: an interrupt is taken *between* instructions,
/// so one arriving in that one-instruction window would push its frame onto
/// the stack CR3 had just taken away — a double fault, and then a triple.
/// The window is tiny, which makes it a rare boot failure rather than an
/// obvious one. `iretq` restores IF from the frame's RFLAGS, so ring 3 still
/// starts with interrupts on.
///
/// The kernel stack `frame_rsp` points into is an HHDM address in the upper
/// half, which every address space shares (see vmm.share_kernel_half), so it
/// survives the switch.
pub fn enter_userland(cr3: u64, frame_rsp: u64) noreturn {
    asm volatile (
        \\ cli
        \\ movq %[cr3], %%cr3
        \\ movq %[frame], %%rsp
        \\ swapgs
        \\ iretq
        :
        : [cr3] "r" (cr3),
          [frame] "r" (frame_rsp),
        : "memory"
    );
    unreachable;
}
