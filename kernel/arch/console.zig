//! The console, whichever machine this is.
//!
//! Both architectures have one and they answer to the same four calls —
//! `print`, `println`, `print_hex`, `print_dec` — because both grew from the
//! same shape rather than because anything made them agree. This is the file
//! that makes it a requirement: a subsystem written for both imports this,
//! and a console that stopped offering one of them would fail to build
//! rather than fail to link on one architecture only.
//!
//! It exists because fs/vfs.zig and fs/tmpfs.zig turned out to be portable
//! already — they import std, the heap, and each other — and the only thing
//! standing between the filesystem selftest and running on both machines was
//! one hard-coded console import.

const builtin = @import("builtin");

pub usingnamespace switch (builtin.cpu.arch) {
    .x86_64 => @import("x86_64/console.zig"),
    .aarch64 => @import("aarch64/console.zig"),
    else => @compileError("no console for this architecture"),
};
