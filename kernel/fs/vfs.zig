//! VFS — virtual filesystem layer.
//!
//! A filesystem is anything that implements the FsOps vtable below.
//! Inodes carry a back-pointer to their owning fs, plus an opaque
//! `private` slot the fs uses for its per-inode state. Dentries live
//! in the dcache and link parent <-> child by name; lookups walk
//! the cache first and fall through to FsOps.lookup() on miss.
//!
//! The kernel keeps a per-process fd table in syscall/dispatch.zig
//! that maps fd integers to File handles owned here.

const std = @import("std");
const heap = @import("../mm/heap.zig");

pub const InodeNum = u64;
pub const Mode = u32;

pub const FileType = enum(u8) {
    regular,
    directory,
    char_device,
    block_device,
    symlink,
    fifo,
    socket,
};

pub const Inode = struct {
    num: InodeNum,
    fs: *Fs,
    file_type: FileType,
    mode: Mode,
    size: u64,
    nlink: u32,
    uid: u32,
    gid: u32,
    atime: u64,
    mtime: u64,
    ctime: u64,
    private: ?*anyopaque,
};

pub const Dentry = struct {
    name: []const u8,
    inode: ?*Inode,
    parent: ?*Dentry,
    children: std.ArrayListUnmanaged(*Dentry) = .{},
    refcount: u32 = 1,
};

pub const File = struct {
    inode: *Inode,
    pos: u64,
    flags: u32,
};

pub const FsOps = struct {
    mount: *const fn () anyerror!*Fs,
    unmount: *const fn (fs: *Fs) anyerror!void,

    lookup: *const fn (fs: *Fs, parent: *Inode, name: []const u8) anyerror!?*Inode,
    create: *const fn (fs: *Fs, parent: *Inode, name: []const u8, mode: Mode) anyerror!*Inode,
    mkdir: *const fn (fs: *Fs, parent: *Inode, name: []const u8, mode: Mode) anyerror!*Inode,
    unlink: *const fn (fs: *Fs, parent: *Inode, name: []const u8) anyerror!void,
    rmdir: *const fn (fs: *Fs, parent: *Inode, name: []const u8) anyerror!void,

    read: *const fn (fs: *Fs, inode: *Inode, offset: u64, buf: []u8) anyerror!usize,
    write: *const fn (fs: *Fs, inode: *Inode, offset: u64, buf: []const u8) anyerror!usize,
    truncate: *const fn (fs: *Fs, inode: *Inode, size: u64) anyerror!void,

    readdir: *const fn (fs: *Fs, inode: *Inode) anyerror![]const DirEntry,
};

pub const Fs = struct {
    name: []const u8,
    root_inode: *Inode,
    ops: FsOps,
    private: ?*anyopaque,
};

pub const DirEntry = struct {
    name: []const u8,
    inode_num: InodeNum,
    file_type: FileType,
};

var root_dentry: ?*Dentry = null;

/// Per-process fd table, keyed by PID. `current_process_id_fn` is
/// installed by the scheduler at boot so VFS doesn't have to import
/// it directly (would be a circular dependency).
pub const PerProcessTable = struct {
    fds: [256]?*File = .{null} ** 256,

    pub fn alloc(self: *PerProcessTable, inode: *Inode, flags: u32) !i64 {
        var i: usize = 3;
        while (i < self.fds.len) : (i += 1) {
            if (self.fds[i] == null) {
                const file = @as(*File, @ptrCast(@alignCast(heap.alloc(@sizeOf(File)) orelse return error.OutOfMemory)));
                file.* = .{ .inode = inode, .pos = 0, .flags = flags };
                self.fds[i] = file;
                return @intCast(i);
            }
        }
        return error.TooManyOpenFiles;
    }

    pub fn slot(self: *PerProcessTable, fd: i32) !*?*File {
        if (fd < 0 or fd >= self.fds.len) return error.BadFd;
        return &self.fds[@intCast(fd)];
    }
};

var current_table_fn: ?*const fn () *PerProcessTable = null;

pub fn install_current_table_resolver(f: *const fn () *PerProcessTable) void {
    current_table_fn = f;
}

fn current_table() *PerProcessTable {
    if (current_table_fn) |f| return f();
    return &fallback_table;
}

/// Used during early boot before the first process exists; also a
/// safety net for the test path. The scheduler swaps in real
/// per-process tables once init has been spawned.
pub var fallback_table: PerProcessTable = .{};

pub fn init() void {
    root_dentry = null;
    fallback_table = .{};
}

pub fn set_root(fs: *Fs) void {
    const dent = @as(*Dentry, @ptrCast(@alignCast(heap.alloc(@sizeOf(Dentry)) orelse return)));
    dent.* = .{
        .name = "/",
        .inode = fs.root_inode,
        .parent = null,
    };
    root_dentry = dent;
}

pub fn open(path: []const u8, flags: u32, mode: Mode) !i64 {
    const inode = try resolve(path) orelse {
        if ((flags & 0x40) != 0) {
            const parent = try resolve_parent(path);
            const name = basename(path);
            const new_inode = try parent.fs.ops.create(parent.fs, parent, name, mode);
            return current_table().alloc(new_inode, flags);
        }
        return error.NotFound;
    };
    return current_table().alloc(inode, flags);
}

pub fn close(fd: i32) !void {
    const slot_ptr = try current_table().slot(fd);
    if (slot_ptr.* == null) return error.BadFd;
    heap.free(@ptrCast(slot_ptr.*.?), @sizeOf(File));
    slot_ptr.* = null;
}

pub fn read(fd: i32, buf: []u8) !usize {
    const slot_ptr = try current_table().slot(fd);
    const file = slot_ptr.* orelse return error.BadFd;
    const n = try file.inode.fs.ops.read(file.inode.fs, file.inode, file.pos, buf);
    file.pos += n;
    return n;
}

pub fn write(fd: i32, buf: []const u8) !usize {
    const slot_ptr = try current_table().slot(fd);
    const file = slot_ptr.* orelse return error.BadFd;
    const n = try file.inode.fs.ops.write(file.inode.fs, file.inode, file.pos, buf);
    file.pos += n;
    return n;
}

fn alloc_fd(inode: *Inode, flags: u32) !i64 {
    return current_table().alloc(inode, flags);
}

fn resolve(path: []const u8) !?*Inode {
    _ = path;
    return null;
}

/// Read the entire file at `path` into a freshly-allocated buffer.
/// Used by sched.spawn_user when loading the executable for a new
/// process. Caller frees with `gpa.free`.
pub fn read_file_into_heap(path: []const u8, gpa: std.mem.Allocator) ![]u8 {
    const inode = (try resolve(path)) orelse return error.NotFound;
    const out = try gpa.alloc(u8, inode.size);
    var off: u64 = 0;
    while (off < out.len) {
        const n = try inode.fs.ops.read(inode.fs, inode, off, out[off..]);
        if (n == 0) break;
        off += n;
    }
    return out[0..off];
}

fn resolve_parent(path: []const u8) !*Inode {
    _ = path;
    return error.NotFound;
}

fn basename(path: []const u8) []const u8 {
    var i: usize = path.len;
    while (i > 0) : (i -= 1) {
        if (path[i - 1] == '/') return path[i..];
    }
    return path;
}
