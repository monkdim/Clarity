//! ClarityOS kernel build script (Zig 0.13+).
//!
//! Produces a freestanding x86_64 ELF kernel that the bootloader can
//! load. Uses our custom linker script (boot/linker.ld) and the
//! bootstrap assembly in boot/start.S.
//!
//!     zig build              # build kernel/ at zig-out/bin/clarity-kernel
//!     zig build run          # build + boot under QEMU (requires qemu-system-x86_64)

const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .x86_64,
        .os_tag = .freestanding,
        .abi = .none,
        .cpu_features_sub = std.Target.x86.featureSet(&.{
            .mmx, .sse, .sse2, .avx, .avx2,
        }),
        .cpu_features_add = std.Target.x86.featureSet(&.{
            .soft_float,
        }),
    });
    const optimize = b.standardOptimizeOption(.{});

    const kernel = b.addExecutable(.{
        .name = "clarity-kernel",
        .root_source_file = b.path("main.zig"),
        .target = target,
        .optimize = optimize,
        .code_model = .kernel,
    });
    kernel.setLinkerScript(b.path("boot/linker.ld"));
    kernel.addAssemblyFile(b.path("boot/start.S"));
    kernel.entry = .{ .symbol_name = "_start" };

    b.installArtifact(kernel);

    // `zig build run` — boot the kernel under QEMU.
    const qemu = b.addSystemCommand(&.{
        "qemu-system-x86_64",
        "-cpu",       "qemu64,+sse,+sse2",
        "-m",         "256M",
        "-serial",    "stdio",
        "-no-reboot",
        "-no-shutdown",
        "-kernel",
    });
    qemu.addArtifactArg(kernel);

    const run_step = b.step("run", "Boot the kernel under QEMU");
    run_step.dependOn(&qemu.step);
}
