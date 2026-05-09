//! Builds the freestanding Clarity runtime (Phase 71).
//!
//! Three artifacts:
//!
//!   1. clarity-runtime         QuickJS-backed JS runtime that
//!                              evaluates the embedded Clarity
//!                              bundle. Default; ships as
//!                              /bin/clarity-init.
//!   2. clarity-vm              Native bytecode VM that runs
//!                              Clarity bytecode directly (Phase 66
//!                              skeleton, Phase 71+ continues).
//!   3. clarity-shim            Just the host_shim + libc_shim
//!                              objects, useful for unit-test
//!                              binaries that don't need an engine.
//!
//! Pre-flight checks: bails if `third_party/quickjs/` is missing.
//! Run `third_party/fetch_quickjs.sh` first.

const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .x86_64,
        .os_tag = .freestanding,
        .abi = .none,
    });
    const optimize = b.standardOptimizeOption(.{});

    // ── Shared objects ────────────────────────────

    const shim = b.addObject(.{
        .name = "claritos_host_shim",
        .root_source_file = b.path("host_shim.zig"),
        .target = target,
        .optimize = optimize,
    });

    const libc = b.addObject(.{
        .name = "claritos_libc_shim",
        .root_source_file = b.path("libc_shim.zig"),
        .target = target,
        .optimize = optimize,
    });

    const bundle = b.addObject(.{
        .name = "claritos_bundle",
        .root_source_file = b.path("embed_bundle.zig"),
        .target = target,
        .optimize = optimize,
    });

    // ── clarity-shim — linkable .a for tests + native_vm ─

    const shim_lib = b.addStaticLibrary(.{
        .name = "claritos-shim",
        .target = target,
        .optimize = optimize,
    });
    shim_lib.addObject(shim);
    shim_lib.addObject(libc);
    b.installArtifact(shim_lib);

    // ── clarity-runtime — QuickJS path ────────────

    const has_qjs = blk: {
        const qjs_path = "third_party/quickjs/quickjs.h";
        const fs = std.fs.cwd();
        fs.access(qjs_path, .{}) catch break :blk false;
        break :blk true;
    };

    if (has_qjs) {
        const rt = b.addExecutable(.{
            .name = "clarity-runtime",
            .target = target,
            .optimize = optimize,
        });
        rt.addCSourceFiles(.{
            .files = &.{
                "quickjs_main.c",
                "third_party/quickjs/quickjs.c",
                "third_party/quickjs/quickjs-libc.c",
                "third_party/quickjs/libregexp.c",
                "third_party/quickjs/libunicode.c",
                "third_party/quickjs/cutils.c",
                "third_party/quickjs/libbf.c",
            },
            .flags = &.{
                "-std=c11",
                "-ffreestanding",
                "-fno-stack-protector",
                "-fno-builtin",
                "-DCONFIG_VERSION=\"freestanding\"",
                "-DCONFIG_BIGNUM",
                "-Wno-implicit-function-declaration",
            },
        });
        rt.addIncludePath(b.path("third_party/quickjs"));
        rt.addObject(shim);
        rt.addObject(libc);
        rt.addObject(bundle);
        rt.entry = .{ .symbol_name = "_start" };
        rt.linkage = .static;
        b.installArtifact(rt);
    } else {
        const skip = b.addSystemCommand(&.{
            "echo",
            "WARNING: third_party/quickjs/ not present. Run third_party/fetch_quickjs.sh to enable the QuickJS-backed runtime.",
        });
        b.getInstallStep().dependOn(&skip.step);
    }

    // ── clarity-vm — native bytecode VM (stretch) ─

    const vm = b.addExecutable(.{
        .name = "clarity-vm",
        .root_source_file = b.path("../native_vm/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    vm.addObject(shim);
    vm.addObject(libc);
    vm.entry = .{ .symbol_name = "_start" };
    vm.linkage = .static;

    const vm_step = b.step("vm", "Build the native bytecode VM");
    vm_step.dependOn(&b.addInstallArtifact(vm, .{}).step);
}
