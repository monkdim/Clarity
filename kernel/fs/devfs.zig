//! devfs — exposes character devices to userspace as VFS inodes.
//!
//! Mounted at `/dev`. Each device is an inode whose `read` /
//! `write` ops dispatch to the device driver. Phase 71 ships:
//!
//!   /dev/tty0      tty driver (line discipline, terminal I/O)
//!   /dev/console   alias for tty0
//!   /dev/null      discards writes; reads return EOF
//!   /dev/zero      reads return zero bytes; writes silently succeed
//!
//! Block devices (/dev/sda etc.) come in Phase 72 once we have AHCI
//! actually moving sectors.

const std = @import("std");
const vfs = @import("vfs.zig");
const tty = @import("../drivers/tty.zig");

pub const DeviceKind = enum { tty, null_dev, zero_dev };

const DeviceEntry = struct {
    name: []const u8,
    kind: DeviceKind,
    inum: vfs.InodeNum,
};

var devices: [4]DeviceEntry = .{
    .{ .name = "tty0",    .kind = .tty,      .inum = 1001 },
    .{ .name = "console", .kind = .tty,      .inum = 1002 },
    .{ .name = "null",    .kind = .null_dev, .inum = 1003 },
    .{ .name = "zero",    .kind = .zero_dev, .inum = 1004 },
};

var devfs: vfs.Fs = undefined;
var devfs_root_inode: vfs.Inode = undefined;
var device_inodes: [4]vfs.Inode = undefined;

pub fn mount() !void {
    devfs_root_inode = .{
        .num = 1000,
        .fs = &devfs,
        .file_type = .directory,
        .mode = 0o755 | 0x4000,
        .size = 0,
        .nlink = 1, .uid = 0, .gid = 0,
        .atime = 0, .mtime = 0, .ctime = 0,
        .private = null,
    };
    var i: usize = 0;
    while (i < devices.len) : (i += 1) {
        device_inodes[i] = .{
            .num = devices[i].inum,
            .fs = &devfs,
            .file_type = .char_device,
            .mode = if (devices[i].kind == .null_dev or devices[i].kind == .zero_dev) 0o666 else 0o620,
            .size = 0,
            .nlink = 1, .uid = 0, .gid = 0,
            .atime = 0, .mtime = 0, .ctime = 0,
            .private = @ptrFromInt(@as(usize, @intFromEnum(devices[i].kind)) + 1),
        };
    }
    devfs = .{
        .name = "devfs",
        .root_inode = &devfs_root_inode,
        .ops = ops,
        .private = null,
    };
}

pub fn root() *vfs.Fs { return &devfs; }

const ops: vfs.FsOps = .{
    .mount = mount_unused,
    .unmount = unmount_noop,
    .lookup = op_lookup,
    .create = op_create_denied,
    .mkdir = op_mkdir_denied,
    .unlink = op_unlink_denied,
    .rmdir = op_rmdir_denied,
    .read = op_read,
    .write = op_write,
    .truncate = op_truncate_noop,
    .readdir = op_readdir,
};

fn mount_unused() !*vfs.Fs { return &devfs; }
fn unmount_noop(_: *vfs.Fs) !void {}

fn op_lookup(_: *vfs.Fs, parent: *vfs.Inode, name: []const u8) !?*vfs.Inode {
    if (parent != &devfs_root_inode) return null;
    var i: usize = 0;
    while (i < devices.len) : (i += 1) {
        if (std.mem.eql(u8, devices[i].name, name)) return &device_inodes[i];
    }
    return null;
}

fn op_create_denied(_: *vfs.Fs, _: *vfs.Inode, _: []const u8, _: vfs.Mode) !*vfs.Inode {
    return error.PermissionDenied;
}
fn op_mkdir_denied(_: *vfs.Fs, _: *vfs.Inode, _: []const u8, _: vfs.Mode) !*vfs.Inode {
    return error.PermissionDenied;
}
fn op_unlink_denied(_: *vfs.Fs, _: *vfs.Inode, _: []const u8) !void {
    return error.PermissionDenied;
}
fn op_rmdir_denied(_: *vfs.Fs, _: *vfs.Inode, _: []const u8) !void {
    return error.PermissionDenied;
}

fn op_truncate_noop(_: *vfs.Fs, _: *vfs.Inode, _: u64) !void {}

fn device_kind(inode: *vfs.Inode) DeviceKind {
    const tag: usize = @intFromPtr(inode.private);
    return @enumFromInt(@as(u8, @intCast(tag - 1)));
}

fn op_read(_: *vfs.Fs, inode: *vfs.Inode, _: u64, buf: []u8) !usize {
    return switch (device_kind(inode)) {
        .tty => tty.tty0.read(buf),
        .null_dev => 0,
        .zero_dev => blk: {
            @memset(buf, 0);
            break :blk buf.len;
        },
    };
}

fn op_write(_: *vfs.Fs, inode: *vfs.Inode, _: u64, buf: []const u8) !usize {
    return switch (device_kind(inode)) {
        .tty => tty.tty0.write(buf),
        .null_dev => buf.len,
        .zero_dev => buf.len,
    };
}

fn op_readdir(_: *vfs.Fs, inode: *vfs.Inode) ![]const vfs.DirEntry {
    if (inode != &devfs_root_inode) return &.{};
    const out = struct {
        var entries: [4]vfs.DirEntry = undefined;
    };
    var i: usize = 0;
    while (i < devices.len) : (i += 1) {
        out.entries[i] = .{
            .name = devices[i].name,
            .inode_num = devices[i].inum,
            .file_type = .char_device,
        };
    }
    return out.entries[0..devices.len];
}
