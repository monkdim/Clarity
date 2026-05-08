//! ELF64 parser + program loader.
//!
//! Reads an ELF64 little-endian executable from a byte buffer,
//! validates the header, walks the program headers, and returns a
//! `LoadedExecutable` describing the segments to map into a user
//! address space.
//!
//! Strict subset:
//!   * EI_CLASS == ELFCLASS64
//!   * EI_DATA  == ELFDATA2LSB
//!   * e_type   == ET_EXEC or ET_DYN (treated as a static PIE)
//!   * e_machine == EM_X86_64
//!   * Loadable segments must be PT_LOAD; we ignore PT_NOTE /
//!     PT_DYNAMIC / PT_TLS / PT_GNU_* for now (loader hand-off
//!     doesn't need them yet — userspace is statically linked).
//!
//! Doesn't actually map pages. That's load.zig's job once it has a
//! target AddressSpace.

const std = @import("std");

pub const ELFMAG: [4]u8 = .{ 0x7F, 'E', 'L', 'F' };
pub const ELFCLASS64: u8 = 2;
pub const ELFDATA2LSB: u8 = 1;

pub const ET_EXEC: u16 = 2;
pub const ET_DYN: u16 = 3;
pub const EM_X86_64: u16 = 62;

pub const PT_LOAD: u32 = 1;
pub const PT_DYNAMIC: u32 = 2;
pub const PT_INTERP: u32 = 3;
pub const PT_NOTE: u32 = 4;
pub const PT_PHDR: u32 = 6;
pub const PT_TLS: u32 = 7;

pub const PF_X: u32 = 1;
pub const PF_W: u32 = 2;
pub const PF_R: u32 = 4;

pub const Header = extern struct {
    e_ident: [16]u8,
    e_type: u16,
    e_machine: u16,
    e_version: u32,
    e_entry: u64,
    e_phoff: u64,
    e_shoff: u64,
    e_flags: u32,
    e_ehsize: u16,
    e_phentsize: u16,
    e_phnum: u16,
    e_shentsize: u16,
    e_shnum: u16,
    e_shstrndx: u16,
};

pub const ProgramHeader = extern struct {
    p_type: u32,
    p_flags: u32,
    p_offset: u64,
    p_vaddr: u64,
    p_paddr: u64,
    p_filesz: u64,
    p_memsz: u64,
    p_align: u64,
};

pub const Segment = struct {
    vaddr: u64,
    filesz: u64,
    memsz: u64,
    flags: u32,
    file_offset: u64,

    pub fn readable(self: Segment) bool { return (self.flags & PF_R) != 0; }
    pub fn writable(self: Segment) bool { return (self.flags & PF_W) != 0; }
    pub fn executable(self: Segment) bool { return (self.flags & PF_X) != 0; }
};

pub const LoadedExecutable = struct {
    entry: u64,
    is_dynamic: bool,
    segments: []const Segment,

    pub fn highest_address(self: LoadedExecutable) u64 {
        var max: u64 = 0;
        for (self.segments) |s| {
            const end = s.vaddr + s.memsz;
            if (end > max) max = end;
        }
        return max;
    }
};

pub const ParseError = error{
    Truncated,
    BadMagic,
    Not64Bit,
    NotLittleEndian,
    UnsupportedType,
    UnsupportedMachine,
    BadPhdrTable,
    OutOfMemory,
    Overflow,
};

/// Parse `bytes` as an ELF64 image. Allocates the segment slice
/// from `gpa`; caller frees with `release(gpa, exe)`.
pub fn parse(bytes: []const u8, gpa: std.mem.Allocator) ParseError!LoadedExecutable {
    if (bytes.len < @sizeOf(Header)) return error.Truncated;
    const hdr = @as(*const Header, @ptrCast(@alignCast(bytes.ptr))).*;
    if (!std.mem.eql(u8, hdr.e_ident[0..4], &ELFMAG)) return error.BadMagic;
    if (hdr.e_ident[4] != ELFCLASS64) return error.Not64Bit;
    if (hdr.e_ident[5] != ELFDATA2LSB) return error.NotLittleEndian;
    if (hdr.e_type != ET_EXEC and hdr.e_type != ET_DYN) return error.UnsupportedType;
    if (hdr.e_machine != EM_X86_64) return error.UnsupportedMachine;
    if (hdr.e_phentsize != @sizeOf(ProgramHeader)) return error.BadPhdrTable;

    const phoff = hdr.e_phoff;
    const phnum = @as(u64, hdr.e_phnum);
    const ph_total = phnum * @sizeOf(ProgramHeader);
    if (phoff + ph_total > bytes.len) return error.Truncated;

    var loadable = std.ArrayList(Segment).init(gpa);
    errdefer loadable.deinit();

    var i: u64 = 0;
    while (i < phnum) : (i += 1) {
        const off = phoff + i * @sizeOf(ProgramHeader);
        const ph = @as(*const ProgramHeader, @ptrCast(@alignCast(&bytes[off]))).*;
        if (ph.p_type != PT_LOAD) continue;
        if (ph.p_filesz > ph.p_memsz) return error.BadPhdrTable;
        if (ph.p_offset + ph.p_filesz > bytes.len) return error.Truncated;
        try loadable.append(.{
            .vaddr = ph.p_vaddr,
            .filesz = ph.p_filesz,
            .memsz = ph.p_memsz,
            .flags = ph.p_flags,
            .file_offset = ph.p_offset,
        });
    }

    return .{
        .entry = hdr.e_entry,
        .is_dynamic = hdr.e_type == ET_DYN,
        .segments = try loadable.toOwnedSlice(),
    };
}

pub fn release(gpa: std.mem.Allocator, exe: LoadedExecutable) void {
    gpa.free(exe.segments);
}
