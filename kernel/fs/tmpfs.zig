//! tmpfs — in-memory filesystem.
//!
//! Used for /tmp, /dev (initially), and as the root filesystem until
//! a real on-disk fs is mounted. Inodes are allocated from the
//! kernel heap; data lives in growable byte buffers indexed by
//! offset. Directory listings are linked lists of dentries.

const std = @import("std");
const vfs = @import("vfs.zig");
const heap = @import("../mm/heap.zig");

const TmpfsInode = struct {
    base: vfs.Inode,
    data: ?[]u8 = null,
    capacity: usize = 0,
    children: std.ArrayListUnmanaged(Child) = .{},

    const Child = struct {
        name: []const u8,
        inode: *TmpfsInode,
    };
};

var root_fs: vfs.Fs = undefined;
var next_inum: vfs.InodeNum = 1;

pub fn mount_root() !void {
    const root_inode = try alloc_inode(.directory, 0o755);
    root_fs = .{
        .name = "tmpfs",
        .root_inode = &root_inode.base,
        .ops = ops,
        .private = null,
    };
    vfs.set_root(&root_fs);
}

const ops: vfs.FsOps = .{
    .mount = mount_unused,
    .unmount = unmount_noop,
    .lookup = op_lookup,
    .create = op_create,
    .mkdir = op_mkdir,
    .unlink = op_unlink,
    .rmdir = op_rmdir,
    .read = op_read,
    .write = op_write,
    .truncate = op_truncate,
    .readdir = op_readdir,
};

fn mount_unused() !*vfs.Fs { return &root_fs; }
fn unmount_noop(_: *vfs.Fs) !void {}

fn alloc_inode(file_type: vfs.FileType, mode: vfs.Mode) !*TmpfsInode {
    const inode = @as(*TmpfsInode, @ptrCast(@alignCast(heap.alloc(@sizeOf(TmpfsInode)) orelse return error.OutOfMemory)));
    inode.* = .{
        .base = .{
            .num = next_inum,
            .fs = &root_fs,
            .file_type = file_type,
            .mode = mode,
            .size = 0,
            .nlink = 1,
            .uid = 0,
            .gid = 0,
            .atime = 0,
            .mtime = 0,
            .ctime = 0,
            .private = null,
        },
    };
    next_inum += 1;
    return inode;
}

fn op_lookup(_: *vfs.Fs, parent: *vfs.Inode, name: []const u8) !?*vfs.Inode {
    const dir: *TmpfsInode = @fieldParentPtr("base", parent);
    for (dir.children.items) |child| {
        if (std.mem.eql(u8, child.name, name)) return &child.inode.base;
    }
    return null;
}

/// Directory entries own their names. `name` belongs to the caller — often a
/// slice of a path buffer that is about to go out of scope — so storing it
/// directly leaves the entry pointing at whatever occupies that memory next.
fn add_child(parent: *vfs.Inode, name: []const u8, inode: *TmpfsInode) !void {
    const gpa = heap.allocator();
    const owned = try gpa.dupe(u8, name);
    const dir: *TmpfsInode = @fieldParentPtr("base", parent);
    try dir.children.append(gpa, .{ .name = owned, .inode = inode });
}

fn op_create(_: *vfs.Fs, parent: *vfs.Inode, name: []const u8, mode: vfs.Mode) !*vfs.Inode {
    const inode = try alloc_inode(.regular, mode);
    try add_child(parent, name, inode);
    return &inode.base;
}

fn op_mkdir(_: *vfs.Fs, parent: *vfs.Inode, name: []const u8, mode: vfs.Mode) !*vfs.Inode {
    const inode = try alloc_inode(.directory, mode);
    try add_child(parent, name, inode);
    return &inode.base;
}

fn op_unlink(_: *vfs.Fs, parent: *vfs.Inode, name: []const u8) !void {
    const dir: *TmpfsInode = @fieldParentPtr("base", parent);
    for (dir.children.items, 0..) |child, i| {
        if (std.mem.eql(u8, child.name, name)) {
            _ = dir.children.swapRemove(i);
            return;
        }
    }
    return error.NotFound;
}

fn op_rmdir(fs: *vfs.Fs, parent: *vfs.Inode, name: []const u8) !void {
    return op_unlink(fs, parent, name);
}

fn op_read(_: *vfs.Fs, inode: *vfs.Inode, offset: u64, buf: []u8) !usize {
    const file: *TmpfsInode = @fieldParentPtr("base", inode);
    const data = file.data orelse return 0;
    // Bound by the file's size, not the buffer's length. The backing buffer is
    // rounded up to a power of two, so reading to `data.len` hands back the
    // slack after the data as though it were file content.
    const off: usize = @intCast(offset);
    const size: usize = @intCast(inode.size);
    if (off >= size or off >= data.len) return 0;
    const n = @min(@min(size - off, buf.len), data.len - off);
    @memcpy(buf[0..n], data[off..][0..n]);
    return n;
}

fn op_write(_: *vfs.Fs, inode: *vfs.Inode, offset: u64, buf: []const u8) !usize {
    const file: *TmpfsInode = @fieldParentPtr("base", inode);
    const required = offset + buf.len;
    if (required > file.capacity) {
        const new_cap = std.math.ceilPowerOfTwo(usize, @intCast(required)) catch return error.OutOfMemory;
        const new_data = @as([*]u8, @ptrCast(heap.alloc(new_cap) orelse return error.OutOfMemory));
        if (file.data) |old| {
            @memcpy(new_data[0..old.len], old);
            heap.free(@ptrCast(old.ptr), file.capacity);
        }
        file.data = new_data[0..new_cap];
        file.capacity = new_cap;
    }
    @memcpy(file.data.?[offset..][0..buf.len], buf);
    if (required > inode.size) inode.size = required;
    return buf.len;
}

fn op_truncate(_: *vfs.Fs, inode: *vfs.Inode, size: u64) !void {
    const file: *TmpfsInode = @fieldParentPtr("base", inode);
    if (size > @as(u64, @intCast(file.capacity))) return error.NoSpace;
    inode.size = size;
}

fn op_readdir(_: *vfs.Fs, inode: *vfs.Inode) ![]const vfs.DirEntry {
    const dir: *TmpfsInode = @fieldParentPtr("base", inode);
    if (inode.file_type != .directory) return error.NotADirectory;
    const gpa = heap.allocator();
    const out = try gpa.alloc(vfs.DirEntry, dir.children.items.len);
    for (dir.children.items, 0..) |child, i| {
        out[i] = .{
            .name = child.name,
            .inode_num = child.inode.base.num,
            .file_type = child.inode.base.file_type,
        };
    }
    return out;
}
