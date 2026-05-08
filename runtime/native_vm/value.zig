//! Tagged value type for the native bytecode VM.
//!
//! Clarity has nine value kinds: null, bool, int, float, string,
//! list, map, function, instance. We represent them as a tagged
//! union; heap-allocated kinds (string/list/map/function/instance)
//! point at GC-managed objects.

const std = @import("std");

pub const Tag = enum(u8) {
    null,
    bool,
    int,
    float,
    string,
    list,
    map,
    function,
    instance,
    enum_variant,
};

pub const Value = union(Tag) {
    null: void,
    bool: bool,
    int: i64,
    float: f64,
    string: *String,
    list: *List,
    map: *Map,
    function: *Function,
    instance: *Instance,
    enum_variant: *EnumVariant,
};

pub const String = struct {
    bytes: []const u8,
    hash: u64,
    marked: bool,
};

pub const List = struct {
    items: std.ArrayListUnmanaged(Value),
    marked: bool,
};

pub const Map = struct {
    entries: std.StringHashMapUnmanaged(Value),
    marked: bool,
};

pub const Function = struct {
    name: []const u8,
    arity: u8,
    code: []const u8,
    constants: []const Value,
    upvalues: []const Value,
    marked: bool,
};

pub const Instance = struct {
    class_name: []const u8,
    fields: std.StringHashMapUnmanaged(Value),
    methods: *Map,
    marked: bool,
};

pub const EnumVariant = struct {
    enum_name: []const u8,
    variant_name: []const u8,
    payload: ?Value,
    marked: bool,
};

pub fn truthy(v: Value) bool {
    return switch (v) {
        .null => false,
        .bool => |b| b,
        .int => |i| i != 0,
        .float => |f| f != 0.0,
        .string => |s| s.bytes.len > 0,
        .list => |l| l.items.items.len > 0,
        .map => true,
        .function => true,
        .instance => true,
        .enum_variant => true,
    };
}

pub fn equal(a: Value, b: Value) bool {
    if (@as(Tag, a) != @as(Tag, b)) return false;
    return switch (a) {
        .null => true,
        .bool => |x| x == b.bool,
        .int => |x| x == b.int,
        .float => |x| x == b.float,
        .string => |x| std.mem.eql(u8, x.bytes, b.string.bytes),
        .list => |x| x == b.list,
        .map => |x| x == b.map,
        .function => |x| x == b.function,
        .instance => |x| x == b.instance,
        .enum_variant => |x| {
            const y = b.enum_variant;
            return std.mem.eql(u8, x.enum_name, y.enum_name) and
                std.mem.eql(u8, x.variant_name, y.variant_name);
        },
    };
}
