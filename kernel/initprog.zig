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
const context = @import("arch/x86_64/context.zig");

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

/// Load it and run it. This does not return: the process owns the CPU until
/// it exits, and `sys_exit` halts because there is nothing else to schedule.
pub fn run() !noreturn {
    try install();

    const t = try sched.spawn_user(PATH);
    console.print("  init: loaded, entry frame at ");
    console.print_hex(t.iret_rsp);
    console.println("");

    // From here to the `iretq` in enter_userland is one uninterrupted region.
    // In the middle of it `current` names the init thread while the CPU is
    // still on the boot stack, and at the end of it CR3 changes out from
    // under that stack; neither is a state an interrupt should observe.
    asm volatile ("cli" ::: "memory");

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
