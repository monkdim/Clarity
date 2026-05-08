//! Mark-and-sweep garbage collector for the native bytecode VM.
//!
//! Trivial copy of the design we want long-term: every allocation
//! threads a `marked` bit; the collector walks the value stack +
//! frames + globals, marks reachable objects, then frees the rest.
//! Tri-colour incremental + generational sweeps land later.

const std = @import("std");
const value = @import("value.zig");

pub const Heap = struct {
    allocator: std.mem.Allocator,
    strings: std.ArrayListUnmanaged(*value.String) = .{},
    lists: std.ArrayListUnmanaged(*value.List) = .{},
    maps: std.ArrayListUnmanaged(*value.Map) = .{},
    functions: std.ArrayListUnmanaged(*value.Function) = .{},
    instances: std.ArrayListUnmanaged(*value.Instance) = .{},
    bytes_alive: usize = 0,
    next_gc: usize = 1024 * 1024,

    pub fn init() !Heap {
        return Heap{ .allocator = std.heap.page_allocator };
    }

    pub fn deinit(self: *Heap) void {
        for (self.strings.items) |s| self.allocator.destroy(s);
        for (self.lists.items) |l| self.allocator.destroy(l);
        for (self.maps.items) |m| self.allocator.destroy(m);
        for (self.functions.items) |f| self.allocator.destroy(f);
        for (self.instances.items) |i| self.allocator.destroy(i);
        self.strings.deinit(self.allocator);
        self.lists.deinit(self.allocator);
        self.maps.deinit(self.allocator);
        self.functions.deinit(self.allocator);
        self.instances.deinit(self.allocator);
    }

    pub fn intern_string(self: *Heap, bytes: []const u8) !*value.String {
        // TODO: hash table for dedupe; for now, allocate every time.
        const s = try self.allocator.create(value.String);
        s.* = .{ .bytes = bytes, .hash = 0, .marked = false };
        try self.strings.append(self.allocator, s);
        self.bytes_alive += @sizeOf(value.String) + bytes.len;
        return s;
    }

    pub fn collect(self: *Heap, roots: []const value.Value) !void {
        for (roots) |r| mark(r);
        sweep(self);
    }
};

fn mark(v: value.Value) void {
    switch (v) {
        .string => |s| s.marked = true,
        .list => |l| {
            if (l.marked) return;
            l.marked = true;
            for (l.items.items) |item| mark(item);
        },
        .map => |m| {
            if (m.marked) return;
            m.marked = true;
            var it = m.entries.iterator();
            while (it.next()) |e| mark(e.value_ptr.*);
        },
        .function => |f| f.marked = true,
        .instance => |i| {
            if (i.marked) return;
            i.marked = true;
            var it = i.fields.iterator();
            while (it.next()) |e| mark(e.value_ptr.*);
        },
        .enum_variant => |ev| ev.marked = true,
        else => {},
    }
}

fn sweep(self: *Heap) void {
    _ = self;
    // TODO: walk each list, free unmarked, clear marks on survivors.
}
