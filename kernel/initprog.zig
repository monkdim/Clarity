//! /bin/clarity-init — the first real process.
//!
//! The ring 3 self-test proved the CPU can leave and re-enter the kernel, but
//! it hand-mapped three pages and jumped straight at them. Everything between
//! a *file* and a running process — vfs read, ELF parse, segment mapping into
//! a fresh address space, CR3 — was still untested, for the same reason the
//! path resolution was: nothing could reach it.
//!
//! So this builds a real ELF, writes it into the filesystem, and asks
//! `spawn_user` to load it by name. Everything that happens after that is the
//! production path, not a rehearsal of it.
//!
//! The executable is assembled here rather than embedded at build time
//! because it has to be *small* and *exactly* what we expect: a 64-byte
//! header, one program header, and a payload whose encoding was checked
//! against a real disassembler. Nothing to link, nothing to strip, and the
//! bytes in the file are the bytes in this source.

const std = @import("std");
const console = @import("arch/x86_64/console.zig");
const vfs = @import("fs/vfs.zig");
const sched = @import("sched/scheduler.zig");
const context = @import("arch/x86_64/context.zig");

pub const PATH = "/bin/clarity-init";

/// Where the single PT_LOAD segment goes. Page-aligned, and clear of the
/// 2 MiB identity pages the boot stub installs in the low gigabyte.
const LOAD_VADDR: u64 = 0x0000_0000_4010_0000;

const EHDR_SIZE = 64;
const PHDR_SIZE = 56;
const CODE_OFF = EHDR_SIZE + PHDR_SIZE; // 120

const MESSAGE = "hello from /bin/clarity-init\n";

/// write(1, msg, len); exit(0); and a halt loop that must never be reached.
/// Same shape as the ring 3 self-test's payload, with the message address
/// patched to wherever the segment lands.
const CODE = [_]u8{
    0x48, 0xC7, 0xC0, 0x01, 0x00, 0x00, 0x00, // mov  rax, 1   (SYS_write)
    0x48, 0xC7, 0xC7, 0x01, 0x00, 0x00, 0x00, // mov  rdi, 1   (fd 1)
    0x48, 0xBE, 0, 0, 0, 0, 0, 0, 0, 0, //       movabs rsi, <msg>
    0x48, 0xC7, 0xC2, 0, 0, 0, 0, //             mov  rdx, <len>
    0x0F, 0x05, //                               syscall
    0x48, 0xC7, 0xC0, 0x0C, 0x00, 0x00, 0x00, // mov  rax, 12  (SYS_exit)
    0x48, 0x31, 0xFF, //                         xor  rdi, rdi
    0x0F, 0x05, //                               syscall
    0xEB, 0xFE, //                            1: jmp 1b
};
const MSG_ADDR_OFFSET = 16;
const MSG_LEN_OFFSET = 27;

comptime {
    std.debug.assert(CODE.len == 47);
    std.debug.assert(CODE[MSG_ADDR_OFFSET - 2] == 0x48 and CODE[MSG_ADDR_OFFSET - 1] == 0xBE);
    std.debug.assert(CODE[MSG_LEN_OFFSET - 1] == 0xC2);
}

const IMAGE_SIZE = CODE_OFF + CODE.len + MESSAGE.len;

fn put16(buf: []u8, off: usize, v: u16) void {
    std.mem.writeInt(u16, buf[off..][0..2], v, .little);
}
fn put32(buf: []u8, off: usize, v: u32) void {
    std.mem.writeInt(u32, buf[off..][0..4], v, .little);
}
fn put64(buf: []u8, off: usize, v: u64) void {
    std.mem.writeInt(u64, buf[off..][0..8], v, .little);
}

/// Lay out a minimal ET_EXEC x86-64 ELF: one program header, one PT_LOAD
/// segment covering the whole file, entry at the code.
fn build_image(buf: []u8) void {
    @memset(buf, 0);

    const entry = LOAD_VADDR + CODE_OFF;
    const msg_vaddr = LOAD_VADDR + CODE_OFF + CODE.len;

    // ── ELF header ──
    buf[0] = 0x7F;
    buf[1] = 'E';
    buf[2] = 'L';
    buf[3] = 'F';
    buf[4] = 2; // ELFCLASS64
    buf[5] = 1; // ELFDATA2LSB
    buf[6] = 1; // EV_CURRENT
    put16(buf, 16, 2); // e_type = ET_EXEC
    put16(buf, 18, 0x3E); // e_machine = EM_X86_64
    put32(buf, 20, 1); // e_version
    put64(buf, 24, entry); // e_entry
    put64(buf, 32, EHDR_SIZE); // e_phoff
    put64(buf, 40, 0); // e_shoff
    put32(buf, 48, 0); // e_flags
    put16(buf, 52, EHDR_SIZE); // e_ehsize
    put16(buf, 54, PHDR_SIZE); // e_phentsize
    put16(buf, 56, 1); // e_phnum
    put16(buf, 58, 64); // e_shentsize
    put16(buf, 60, 0); // e_shnum
    put16(buf, 62, 0); // e_shstrndx

    // ── program header: PT_LOAD, read + execute ──
    put32(buf, 64, 1); // p_type = PT_LOAD
    put32(buf, 68, 0x4 | 0x1); // p_flags = R | X
    put64(buf, 72, 0); // p_offset — the whole file
    put64(buf, 80, LOAD_VADDR); // p_vaddr
    put64(buf, 88, LOAD_VADDR); // p_paddr
    put64(buf, 96, IMAGE_SIZE); // p_filesz
    put64(buf, 104, IMAGE_SIZE); // p_memsz
    put64(buf, 112, 0x1000); // p_align

    // ── code, with the message address and length patched in ──
    @memcpy(buf[CODE_OFF..][0..CODE.len], &CODE);
    put64(buf, CODE_OFF + MSG_ADDR_OFFSET, msg_vaddr);
    put32(buf, CODE_OFF + MSG_LEN_OFFSET, @intCast(MESSAGE.len));
    @memcpy(buf[CODE_OFF + CODE.len ..][0..MESSAGE.len], MESSAGE[0..MESSAGE.len]);
}

/// Write the executable into the filesystem so spawn_user can find it by
/// name, exactly as it would find one that came off a disk.
pub fn install() !void {
    var image: [IMAGE_SIZE]u8 = undefined;
    build_image(&image);

    const fd = try vfs.open(PATH, 0x40 | 0x1, 0o755); // O_CREAT | O_WRONLY
    const n = try vfs.write(@intCast(fd), &image);
    try vfs.close(@intCast(fd));

    console.print("  init: wrote ");
    console.print_dec(@as(u64, @intCast(n)));
    console.print(" bytes to ");
    console.println(PATH);
    if (n != IMAGE_SIZE) return error.ShortWrite;
}

/// Load it and run it. This does not return: the process owns the CPU until
/// it exits, and `sys_exit` halts because there is nothing else to schedule.
pub fn run() !noreturn {
    try install();

    const t = try sched.spawn_user(PATH);
    console.print("  init: loaded, entry frame at ");
    console.print_hex(t.iret_rsp);
    console.println("");

    // spawn_user queues the thread for the scheduler to pick. We are about to
    // enter it directly instead, so take it back off the queue and make it
    // current — otherwise the kernel would run a process it does not believe
    // is running. This also points the TSS at its kernel stack, which has to
    // happen before the CPU is ever in ring 3.
    sched.adopt_current(t);

    console.println("  init: entering userspace");

    // Installing the address space and leaving for ring 3 are one step, not
    // two: this function runs on the boot stack, which is a low
    // identity-mapped address the process's address space does not map. See
    // enter_userland — anything at all between the two would fault on a
    // stack that no longer exists.
    context.enter_userland(t.cr3, t.iret_rsp);
}
