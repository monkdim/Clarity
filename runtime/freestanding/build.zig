//! Builds the freestanding Clarity runtime (Phase 66).
//!
//! Two output shapes:
//!
//!   1. clarity-runtime         QuickJS-backed JS runtime that
//!                              evaluates the transpiled Clarity
//!                              bundle. Default; ships as
//!                              /bin/clarity-init.
//!   2. clarity-vm              Native bytecode VM (runtime/native_vm)
//!                              that runs Clarity bytecode directly,
//!                              skipping JS entirely. Stretch goal —
//!                              build it with `zig build vm`.
//!
//! Either path produces a freestanding ELF that the ClarityOS
//! kernel can spawn as the first user process. host_shim.zig is
//! shared between both — it's the syscall bridge.

const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .x86_64,
        .os_tag = .freestanding,
        .abi = .none,
    });
    const optimize = b.standardOptimizeOption(.{});

    // ── Shared object: host_shim ────────────────────

    const shim = b.addObject(.{
        .name = "claritos_host_shim",
        .root_source_file = b.path("host_shim.zig"),
        .target = target,
        .optimize = optimize,
    });

    // ── clarity-runtime: QuickJS path ───────────────

    const rt = b.addExecutable(.{
        .name = "clarity-runtime",
        .target = target,
        .optimize = optimize,
    });
    rt.addCSourceFile(.{ .file = b.path("quickjs_main.c"), .flags = &.{
        "-std=c11", "-ffreestanding", "-fno-stack-protector",
        "-I", "third_party/quickjs",
    }});
    rt.addIncludePath(b.path("third_party/quickjs"));
    rt.addObject(shim);
    rt.linkLibC();
    rt.entry = .{ .symbol_name = "_start" };
    b.installArtifact(rt);

    // ── clarity-vm: native bytecode VM path ─────────

    const vm = b.addExecutable(.{
        .name = "clarity-vm",
        .root_source_file = b.path("../native_vm/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    vm.addObject(shim);
    vm.entry = .{ .symbol_name = "_start" };

    const vm_step = b.step("vm", "Build the native bytecode VM");
    vm_step.dependOn(&b.addInstallArtifact(vm, .{}).step);
}
