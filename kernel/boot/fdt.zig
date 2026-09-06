//! The flattened device tree — how a machine describes itself.
//!
//! On x86 the firmware hands the kernel a multiboot2 information block. On
//! ARM there is no such convention: the bootloader leaves a pointer to a
//! device tree in x0, and everything the kernel knows about the machine —
//! how much RAM there is, where the serial port is, which interrupt
//! controller it has — comes out of that blob.
//!
//! This matters beyond QEMU. m1n1, the bootloader Asahi Linux established as
//! the way onto Apple Silicon, converts Apple's own device tree into exactly
//! this format and hands it over the same way. A parser written here is the
//! parser that machine needs.
//!
//! Format (devicetree.org specification v0.4): a header, then a stream of
//! tokens describing a tree of nodes, then a string table the property names
//! are indices into. Every integer in the blob is big-endian, on a machine
//! that is not, and every one is read a byte at a time — both because the
//! blob's alignment is the bootloader's business rather than ours, and
//! because a misaligned wide load on ARM with the MMU off is a fault rather
//! than a slow path.

const MAGIC: u32 = 0xD00D_FEED;

const TOKEN_BEGIN_NODE: u32 = 1;
const TOKEN_END_NODE: u32 = 2;
const TOKEN_PROP: u32 = 3;
const TOKEN_NOP: u32 = 4;
const TOKEN_END: u32 = 9;

pub const Region = struct {
    base: u64,
    len: u64,
};

pub const Fdt = struct {
    blob: [*]const u8,
    total_size: u32,
    struct_off: u32,
    struct_size: u32,
    strings_off: u32,
    strings_size: u32,
    /// The root node's #address-cells and #size-cells, which say how many
    /// 32-bit words an address and a length take in a child's `reg`. Two and
    /// two on a 64-bit machine; read rather than assumed, because a tree that
    /// says otherwise would be silently misread as garbage addresses.
    addr_cells: u32,
    size_cells: u32,
};

fn be32(p: [*]const u8, off: u32) u32 {
    return (@as(u32, p[off]) << 24) | (@as(u32, p[off + 1]) << 16) |
        (@as(u32, p[off + 2]) << 8) | @as(u32, p[off + 3]);
}

/// Read `cells` 32-bit words as one big-endian value.
///
/// More than two cells cannot fit in a u64. A tree that asked for three would
/// be describing addresses this kernel cannot represent, so it is refused
/// rather than truncated into a plausible-looking wrong number.
fn cells_to_u64(p: [*]const u8, off: u32, cells: u32) ?u64 {
    if (cells == 0 or cells > 2) return null;
    var v: u64 = 0;
    var i: u32 = 0;
    while (i < cells) : (i += 1) v = (v << 32) | be32(p, off + i * 4);
    return v;
}

fn str_eq(a: []const u8, b: []const u8) bool {
    if (a.len != b.len) return false;
    for (a, b) |x, y| if (x != y) return false;
    return true;
}

fn starts_with(haystack: []const u8, prefix: []const u8) bool {
    if (haystack.len < prefix.len) return false;
    return str_eq(haystack[0..prefix.len], prefix);
}

/// A NUL-terminated string in the blob, as a slice.
fn cstr(p: [*]const u8, off: u32, limit: u32) []const u8 {
    var n: u32 = 0;
    while (off + n < limit and p[off + n] != 0) n += 1;
    return p[off .. off + n];
}

/// One step of the token stream.
const Event = union(enum) {
    node_start: []const u8,
    node_end,
    prop: struct { name: []const u8, value: []const u8 },
};

const Walker = struct {
    fdt: *const Fdt,
    pos: u32,

    fn init(fdt: *const Fdt) Walker {
        return .{ .fdt = fdt, .pos = fdt.struct_off };
    }

    fn next(self: *Walker) ?Event {
        const p = self.fdt.blob;
        const end = self.fdt.struct_off + self.fdt.struct_size;
        while (self.pos + 4 <= end) {
            const token = be32(p, self.pos);
            self.pos += 4;
            switch (token) {
                TOKEN_NOP => continue,
                TOKEN_END => return null,
                TOKEN_END_NODE => return Event.node_end,
                TOKEN_BEGIN_NODE => {
                    const name = cstr(p, self.pos, end);
                    // The name is NUL-terminated and the stream realigns to
                    // the next 4-byte boundary after it.
                    self.pos += (@as(u32, @intCast(name.len)) + 4) & ~@as(u32, 3);
                    return Event{ .node_start = name };
                },
                TOKEN_PROP => {
                    if (self.pos + 8 > end) return null;
                    const len = be32(p, self.pos);
                    const name_off = be32(p, self.pos + 4);
                    self.pos += 8;
                    const value_at = self.pos;
                    if (value_at + len > end) return null;
                    self.pos += (len + 3) & ~@as(u32, 3);
                    const name = cstr(p, self.fdt.strings_off + name_off,
                        self.fdt.strings_off + self.fdt.strings_size);
                    return Event{ .prop = .{ .name = name, .value = p[value_at .. value_at + len] } };
                },
                // Any other token means the stream is not what it claims to
                // be; stopping is better than walking off the end of it.
                else => return null,
            }
        }
        return null;
    }
};

/// Validate a device tree at `phys` and read the root's cell sizes.
///
/// Null means there is no device tree there. That is a real possibility and
/// not an error: a bootloader is not obliged to provide one, and the caller
/// then falls back to whatever it knows about the machine.
pub fn parse(phys: u64) ?Fdt {
    if (phys == 0 or phys % 4 != 0) return null;
    const p: [*]const u8 = @ptrFromInt(phys);
    if (be32(p, 0) != MAGIC) return null;

    var fdt = Fdt{
        .blob = p,
        .total_size = be32(p, 4),
        .struct_off = be32(p, 8),
        .strings_off = be32(p, 12),
        .struct_size = be32(p, 36),
        .strings_size = be32(p, 32),
        // Defaults from the specification, used only if the root says nothing.
        .addr_cells = 2,
        .size_cells = 1,
    };

    // A blob whose sections claim to lie outside itself is corrupt, and
    // walking it would read arbitrary memory.
    if (fdt.struct_off + fdt.struct_size > fdt.total_size) return null;
    if (fdt.strings_off + fdt.strings_size > fdt.total_size) return null;

    // The root's properties come before its first child, so the first
    // node_end or nested node_start ends the search.
    var w = Walker.init(&fdt);
    var depth: u32 = 0;
    while (w.next()) |ev| {
        switch (ev) {
            .node_start => {
                depth += 1;
                if (depth > 1) break;
            },
            .node_end => break,
            .prop => |pr| {
                if (depth != 1 or pr.value.len != 4) continue;
                if (str_eq(pr.name, "#address-cells")) fdt.addr_cells = be32(pr.value.ptr, 0);
                if (str_eq(pr.name, "#size-cells")) fdt.size_cells = be32(pr.value.ptr, 0);
            },
        }
    }
    return fdt;
}

/// Every region of real RAM the tree describes, written into `out`.
///
/// A memory node is one whose `device_type` is "memory" — the property the
/// specification actually defines for this, rather than the `memory@…` naming
/// convention, which is only a convention. Its `reg` is a list of
/// address/length pairs, and there can be more than one.
pub fn memory_regions(fdt: *const Fdt, out: []Region) usize {
    var w = Walker.init(fdt);
    var count: usize = 0;
    var in_memory_node = false;
    var pending_reg: ?[]const u8 = null;
    var depth: u32 = 0;

    while (w.next()) |ev| {
        switch (ev) {
            .node_start => {
                depth += 1;
                if (depth == 2) {
                    in_memory_node = false;
                    pending_reg = null;
                }
            },
            .node_end => {
                if (depth == 2 and in_memory_node) {
                    if (pending_reg) |reg| count += decode_reg(fdt, reg, out[count..]);
                }
                if (depth > 0) depth -= 1;
                if (depth < 2) {
                    in_memory_node = false;
                    pending_reg = null;
                }
            },
            .prop => |pr| {
                if (depth != 2) continue;
                if (str_eq(pr.name, "device_type")) {
                    // NUL-terminated in the blob, so compare without it.
                    const v = if (pr.value.len > 0 and pr.value[pr.value.len - 1] == 0)
                        pr.value[0 .. pr.value.len - 1]
                    else
                        pr.value;
                    if (str_eq(v, "memory")) in_memory_node = true;
                } else if (str_eq(pr.name, "reg")) {
                    pending_reg = pr.value;
                }
            },
        }
        if (count >= out.len) break;
    }
    return count;
}

fn decode_reg(fdt: *const Fdt, reg: []const u8, out: []Region) usize {
    const pair_bytes = (fdt.addr_cells + fdt.size_cells) * 4;
    if (pair_bytes == 0) return 0;
    var i: usize = 0;
    var written: usize = 0;
    while (i + pair_bytes <= reg.len and written < out.len) : (i += pair_bytes) {
        const base = cells_to_u64(reg.ptr, @intCast(i), fdt.addr_cells) orelse return written;
        const len = cells_to_u64(reg.ptr, @intCast(i + fdt.addr_cells * 4), fdt.size_cells) orelse return written;
        if (len == 0) continue;
        out[written] = .{ .base = base, .len = len };
        written += 1;
    }
    return written;
}

/// The first `reg` region of the first node whose name starts with `prefix`.
///
/// Node names on a real tree carry a unit address — `fw-cfg@9020000` — so the
/// prefix is matched rather than the whole name; the address in the name is
/// the same one the `reg` gives, and reading it from `reg` is the supported
/// way round.
pub fn node_reg(fdt: *const Fdt, prefix: []const u8) ?Region {
    var w = Walker.init(fdt);
    var depth: u32 = 0;
    var matched_depth: ?u32 = null;

    while (w.next()) |ev| {
        switch (ev) {
            .node_start => {
                depth += 1;
                if (matched_depth == null and starts_with(ev.node_start, prefix)) matched_depth = depth;
            },
            .node_end => {
                if (matched_depth) |d| if (depth == d) {
                    matched_depth = null;
                };
                if (depth > 0) depth -= 1;
            },
            .prop => |pr| {
                if (matched_depth) |d| {
                    if (depth == d and str_eq(pr.name, "reg")) {
                        var one: [1]Region = undefined;
                        if (decode_reg(fdt, pr.value, &one) == 1) return one[0];
                    }
                }
            },
        }
    }
    return null;
}
