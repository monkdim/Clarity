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
    kernel.addAssemblyFile(b.path("arch/x86_64/context.S"));
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

    // ── AArch64 (Apple-Silicon-class) kernel ──────────────
    //
    // Built under its own step (`zig build aarch64`) rather than the
    // default install, so the x86_64 build and its boot gate are wholly
    // unaffected. QEMU's `virt` machine is the CI target.
    const aarch64_target = b.resolveTargetQuery(.{
        .cpu_arch = .aarch64,
        .os_tag = .freestanding,
        .abi = .none,
    });

    const kernel_arm = b.addExecutable(.{
        .name = "clarity-kernel-aarch64",
        .root_source_file = b.path("main_aarch64.zig"),
        .target = aarch64_target,
        .optimize = optimize,
    });
    kernel_arm.setLinkerScript(b.path("boot/linker_aarch64.ld"));
    kernel_arm.addAssemblyFile(b.path("arch/aarch64/boot.S"));
    kernel_arm.addAssemblyFile(b.path("arch/aarch64/vectors.S"));
    kernel_arm.entry = .{ .symbol_name = "_start" };

    const aarch64_step = b.step("aarch64", "Build the AArch64 kernel");
    aarch64_step.dependOn(&b.addInstallArtifact(kernel_arm, .{}).step);
}
