//! Native bytecode VM entry (Phase 66 task 3, stretch goal).
//!
//! Skips the JavaScript engine entirely: the Clarity bytecode
//! produced by `stdlib/bytecode.clarity`'s compiler runs directly on
//! a Zig-implemented VM. Massive performance + footprint win once
//! it's fully wired (a freestanding QuickJS is ~700 KB; this VM is
//! shooting for ~50 KB stripped).
//!
//! This file is the kernel-facing entry. opcode.zig + vm.zig do the
//! interpretation; gc.zig owns the heap; value.zig defines the
//! tagged union for Clarity values.

const std = @import("std");
const opcode = @import("opcode.zig");
const value = @import("value.zig");
const vm = @import("vm.zig");

extern fn claritos_write(fd: i32, buf: [*]const u8, len: usize) callconv(.C) i64;
extern fn claritos_exit(code: i32) callconv(.C) noreturn;

/// Bundle: when the build script links the VM, the precompiled
/// Clarity bytecode for the stdlib + entry point is embedded here.
extern const bundle_bytecode: [*]const u8;
extern const bundle_bytecode_len: usize;

pub export fn _start() callconv(.C) noreturn {
    var instance = vm.Vm.init() catch claritos_exit(1);
    defer instance.deinit();

    instance.load_bundle(bundle_bytecode, bundle_bytecode_len) catch |err| {
        const msg = "[vm] bundle load failed: ";
        _ = claritos_write(2, msg, msg.len);
        const err_name = @errorName(err);
        _ = claritos_write(2, err_name.ptr, err_name.len);
        _ = claritos_write(2, "\n", 1);
        claritos_exit(2);
    };

    const exit_code = instance.run() catch |err| {
        const msg = "[vm] runtime error: ";
        _ = claritos_write(2, msg, msg.len);
        const err_name = @errorName(err);
        _ = claritos_write(2, err_name.ptr, err_name.len);
        _ = claritos_write(2, "\n", 1);
        claritos_exit(3);
    };

    claritos_exit(exit_code);
}
