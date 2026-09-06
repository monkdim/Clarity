//! /bin/clarity-init — the first real process.
//!
//! The executable is built by kernel/build.zig as its own freestanding
//! program (see user/init.zig) and embedded here. It used to be 47 bytes
//! of machine code assembled by this file, which proved the CPU could reach
//! ring 3 and return but exercised almost nothing of the loader: one segment,
//! no BSS, and a layout the kernel had chosen for itself. A linker decides
//! how many segments there are, what permissions each carries, and how much
//! of the last page is file-backed rather than zero-filled — and the loader
//! has to be right about all of it.
//!
//! It is embedded in the kernel image rather than shipped as a GRUB module
//! because the physical allocator already reserves the kernel image. A module
//! would sit somewhere pmm is free to hand out, which is its own problem.

const console = @import("arch/x86_64/console.zig");
const vfs = @import("fs/vfs.zig");
const sched = @import("sched/scheduler.zig");

pub const PATH = "/bin/clarity-init";

/// The linked ELF, handed over by the build (kernel.root_module
/// .addAnonymousImport("init_elf", ...)). Referenced as a slice and written
/// straight to the file — deliberately never copied into a local, because it
/// is several kilobytes and the boot stack this runs on is 16 KiB.
const IMAGE: []const u8 = @embedFile("init_elf");

/// Write the executable into the filesystem so spawn_user can find it by
/// name, exactly as it would find one that came off a disk.
pub fn install() !void {
    const fd = try vfs.open(PATH, 0x40 | 0x1, 0o755); // O_CREAT | O_WRONLY
    const n = try vfs.write(@intCast(fd), IMAGE);
    try vfs.close(@intCast(fd));

    console.print("  init: wrote ");
    console.print_dec(@as(u64, @intCast(n)));
    console.print(" bytes to ");
    console.println(PATH);
    if (n != IMAGE.len) return error.ShortWrite;
}

/// Install it, hand it to the scheduler, and come back when it has exited.
///
/// This used to enter ring 3 by hand: `cli`, take the thread back off the run
/// queue, make it current, and jump. That was the only way it could work,
/// because a user thread had no kernel-side context for the scheduler to
/// switch into — so the entry was a one-way jump off the boot stack, and the
/// process's exit had nothing to return to. `spawn_user` now gives the thread
/// an entry trampoline like any other, which is what makes a *second* process
/// possible.
pub fn run() !void {
    try install();

    const t = try sched.spawn_user(PATH);
    console.print("  init: queued, entry frame at ");
    console.print_hex(t.iret_rsp);
    console.println("");

    sched.run_queued();
}
