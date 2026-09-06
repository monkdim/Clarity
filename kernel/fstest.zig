//! Filesystem: prove a path can be resolved before anything depends on it.
//!
//! tmpfs had working create, lookup, read and write the whole time, and
//! nothing could reach any of them, because `vfs.resolve` was:
//!
//!     fn resolve(path: []const u8) !?*Inode { _ = path; return null; }
//!
//! Every `open` fell through to "not found", and `read_file_into_heap` — the
//! one thing `spawn_user` needs to load an executable — could only ever
//! return error.NotFound. So the userspace path was blocked on a stub, not on
//! anything hard.
//!
//! This walks the whole round trip: make a directory, create a file in it,
//! write, read back through a fresh open by path, and list the directory. The
//! read-back is the part worth asserting — the backing buffer is rounded up to
//! a power of two, so a read bounded by the buffer instead of the file size
//! returns trailing slack as though it were content, and looks fine until
//! something compares bytes.

const std = @import("std");
const console = @import("arch/x86_64/console.zig");
const vfs = @import("fs/vfs.zig");

const PATH = "/bin/hello.txt";
const CONTENT = "clarity";

pub fn run() !void {
    const root = try vfs.resolve_for_test("/");
    _ = try root.fs.ops.mkdir(root.fs, root, "bin", 0o755);

    // O_CREAT|O_WRONLY: the file does not exist yet, so this exercises the
    // create path, which needs resolve_parent to find /bin.
    const wfd = try vfs.open(PATH, 0x40 | 0x1, 0o644);
    const written = try vfs.write(@intCast(wfd), CONTENT);
    try vfs.close(@intCast(wfd));

    // A fresh open by the same path: this only finds anything if resolve
    // actually walked /bin/hello.txt rather than returning null.
    const rfd = try vfs.open(PATH, 0, 0);
    var buf: [64]u8 = undefined;
    const n = try vfs.read(@intCast(rfd), &buf);
    try vfs.close(@intCast(rfd));

    console.print("  fs: wrote ");
    console.print_dec(@as(u64, @intCast(written)));
    console.print(" read ");
    console.print_dec(@as(u64, @intCast(n)));
    console.print(" \"");
    console.print(buf[0..n]);
    console.println("\"");

    if (n != CONTENT.len or !std.mem.eql(u8, buf[0..n], CONTENT)) {
        return error.ReadBackMismatch;
    }

    const entries = try root.fs.ops.readdir(root.fs, root);
    console.print("  fs: / has ");
    console.print_dec(@as(u64, @intCast(entries.len)));
    console.println(" entries");

    console.println("  [ok] vfs: path resolve, create, write, read back");
}
