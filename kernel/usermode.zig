//! First userspace: enter ring 3 and take a syscall back.
//!
//! Everything below `spawn_user` — the ELF loader, per-process address
//! spaces, the scheduler's user path — sits on one unproven assumption: that
//! the CPU can actually leave ring 0 and come back through the syscall
//! trampoline. Nothing exercised that, and the pieces it needs (a TSS, the
//! SYSRET selector ordering, the argument marshalling) were all present but
//! wrong, in ways that produce a silent triple fault rather than a message.
//!
//! So this runs first: three pages mapped user-accessible, 47 bytes of
//! hand-checked machine code, and a real `syscall` from CPL 3. It proves the
//! mechanism with nothing else in the way, and the boot log says so either
//! way — the marker only appears if a ring 3 instruction ran, trapped into
//! the kernel, and the handler saw the arguments the program passed.
//!
//! It is deliberately not a process: no scheduler, no ELF, no fd table. Those
//! come next, on top of a path that is known to work.

const std = @import("std");
const console = @import("arch/x86_64/console.zig");
const gdt = @import("arch/x86_64/gdt.zig");
const vmm = @import("mm/vmm.zig");
const pmm = @import("mm/pmm.zig");

// Deliberately at the 1 GiB mark rather than the conventional 0x400000. The
// boot stub identity-maps the first gigabyte with 2 MiB pages, so a 4 KiB
// mapping down there depends on vmm splitting a huge page — correct now, but
// this test exists to answer one question (can the CPU reach ring 3 and come
// back), and it should not be able to fail for a second reason.
const CODE_VA: u64 = 0x0000_0000_4000_0000;
const DATA_VA: u64 = 0x0000_0000_4000_1000;
const STACK_VA: u64 = 0x0000_0000_4000_2000;
const PAGE_SIZE: u64 = 4096;

const MESSAGE = "hello from ring 3, pid 0";

/// The program, assembled from:
///
///     movq $1, %rax            # SYS_write
///     movq $1, %rdi            # fd 1
///     movabsq $DATA_VA, %rsi
///     movq $LEN, %rdx
///     syscall
///     movq $12, %rax           # SYS_exit
///     xorq %rdi, %rdi
///     syscall
///  1: jmp 1b
///
/// The two immediates that have to agree with this file are patched in below
/// rather than left as magic numbers, so the message cannot drift out of sync
/// with the code that points at it.
const PAYLOAD = [_]u8{
    0x48, 0xC7, 0xC0, 0x01, 0x00, 0x00, 0x00, // mov  rax, 1
    0x48, 0xC7, 0xC7, 0x01, 0x00, 0x00, 0x00, // mov  rdi, 1
    0x48, 0xBE, 0, 0, 0, 0, 0, 0, 0, 0, //       movabs rsi, DATA_VA
    0x48, 0xC7, 0xC2, 0, 0, 0, 0, //             mov  rdx, len
    0x0F, 0x05, //                               syscall
    0x48, 0xC7, 0xC0, 0x0C, 0x00, 0x00, 0x00, // mov  rax, 12
    0x48, 0x31, 0xFF, //                         xor  rdi, rdi
    0x0F, 0x05, //                               syscall
    0xEB, 0xFE, //                            1: jmp 1b
};
const MSG_ADDR_OFFSET = 16;
const MSG_LEN_OFFSET = 27;

comptime {
    // The two patch offsets are byte positions inside the encoding above; if
    // an instruction is edited without updating them, patch the wrong bytes
    // and the program jumps into the weeds with no clue why.
    std.debug.assert(PAYLOAD.len == 47);
    std.debug.assert(PAYLOAD[MSG_ADDR_OFFSET - 2] == 0x48 and PAYLOAD[MSG_ADDR_OFFSET - 1] == 0xBE);
    std.debug.assert(PAYLOAD[MSG_LEN_OFFSET - 1] == 0xC2);
}

/// Map one page of fresh physical memory at `va`, reachable from ring 3.
fn map_user_page(va: u64) !void {
    const phys = pmm.alloc_page() orelse return error.OutOfMemory;
    try vmm.map_page(vmm.kernel(), va, phys, vmm.PAGE_PRESENT | vmm.PAGE_WRITE | vmm.PAGE_USER);
    const page: [*]u8 = @ptrFromInt(va);
    @memset(page[0..PAGE_SIZE], 0);
}

pub fn run_first_user_program() !void {
    try map_user_page(CODE_VA);
    try map_user_page(DATA_VA);
    try map_user_page(STACK_VA);

    const code: [*]u8 = @ptrFromInt(CODE_VA);
    @memcpy(code[0..PAYLOAD.len], &PAYLOAD);
    std.mem.writeInt(u64, code[MSG_ADDR_OFFSET..][0..8], DATA_VA, .little);
    std.mem.writeInt(u32, code[MSG_LEN_OFFSET..][0..4], @intCast(MESSAGE.len), .little);

    const data: [*]u8 = @ptrFromInt(DATA_VA);
    @memcpy(data[0..MESSAGE.len], MESSAGE[0..MESSAGE.len]);

    console.print("  entering ring 3 at ");
    console.print_hex(CODE_VA);
    console.println("");

    // The stack grows down from the top of its page, 16-byte aligned.
    enter_ring3(CODE_VA, STACK_VA + PAGE_SIZE - 16);
}

/// Drop to CPL 3. `iretq` is the only way in: it loads CS, SS, RIP, RSP and
/// RFLAGS as one atomic transition, so there is no window where the CPU is at
/// ring 3 with a ring 0 stack. DS/ES/FS are set first because `iretq` leaves
/// them alone; GS is handled by `swapgs`, which also arms the shadow base the
/// syscall trampoline swaps back in.
fn enter_ring3(entry: u64, stack_top: u64) noreturn {
    asm volatile (
        \\ movl %[ds], %%ds
        \\ movl %[ds], %%es
        \\ movl %[ds], %%fs
        \\ swapgs
        \\ pushq %[ss]
        \\ pushq %[rsp]
        \\ pushq $0x202
        \\ pushq %[cs]
        \\ pushq %[rip]
        \\ iretq
        :
        : [ds] "r" (@as(u32, gdt.USER_DATA)),
          [ss] "r" (@as(u64, gdt.USER_DATA)),
          [rsp] "r" (stack_top),
          [cs] "r" (@as(u64, gdt.USER_CODE)),
          [rip] "r" (entry),
        : "memory"
    );
    unreachable;
}
