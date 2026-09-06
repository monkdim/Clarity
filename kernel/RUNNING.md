# Running ClarityOS

Two architectures, two machines. Both boot under QEMU; neither has run on
real hardware yet.

## Build

Needs Zig 0.13. From `kernel/`:

```sh
zig build            # x86-64  -> zig-out/bin/clarity-kernel
zig build aarch64    # aarch64 -> zig-out/bin/clarity-kernel-aarch64.img
```

The aarch64 build produces two files. The `.img` is the bootable one: a flat
binary carrying an ARM64 Linux Image header, which is what makes a bootloader
treat it as a kernel — and hand it a device tree. The ELF beside it has the
symbols, for a debugger or a disassembler; booting it works, but the kernel
comes up knowing nothing about the machine.

## aarch64 — the one with a screen

```sh
qemu-system-aarch64 \
  -M virt -cpu cortex-a72 -m 512 \
  -kernel zig-out/bin/clarity-kernel-aarch64.img \
  -device ramfb \
  -serial stdio
```

`-device ramfb` is what gives it a display. Without it the kernel says so and
carries on headless, which is why the flag is not optional if you want to see
anything. Drop `-serial stdio` for `-serial file:boot.log` if you would rather
have the log in a file than mixed into the QEMU window's terminal.

You should get a 1024×768 window: slate background, blue border, and four
colour patches — red, green, blue, white. That picture is the test the boot
gate checks pixel by pixel.

The serial log should report the machine describing itself:

```
  [ok] device tree at 0x48000000, 1048576 bytes, #address-cells=2 #size-cells=2
  [ok] fw_cfg from the device tree at 0x9020000
  ram 0x40000000 + 512 MiB
  [ok] pmm: 512 MiB managed, 129349 pages free, allocated 0x402bb000 and it holds
```

Change `-m 512` and the RAM line follows it — that is the kernel reading the
device tree rather than assuming a machine.

### On an Apple Silicon Mac

This is the reason the aarch64 side exists. `-accel hvf` runs the kernel on
the M-series CPU itself rather than emulating an ARM chip on top of another
one — the same instruction set, at native speed.

```sh
brew install qemu

qemu-system-aarch64 \
  -M virt,gic-version=2 \
  -accel hvf -cpu host \
  -m 512 \
  -kernel zig-out/bin/clarity-kernel-aarch64.img \
  -device ramfb \
  -serial stdio
```

Two flags need explaining, because both are places this can fail:

**`-cpu host`** is required with `-accel hvf`. The hypervisor runs on the real
CPU, so it cannot pretend to be a cortex-a72.

**`gic-version=2`** pins the interrupt controller. `arch/aarch64/gic.zig`
speaks GICv2 and nothing else; QEMU chooses a version based on the machine and
accelerator, and if it picks GICv3 the kernel will come up, print its first
few lines, and then hang waiting for a timer interrupt that never arrives.
If it hangs after `[ok] generic timer armed`, that is the first thing to
suspect.

**This path is untested.** Everything else in this file has been run; the HVF
command has not, because the machine writing it has no Mac. If it does not
work, the boot log up to the point it stops is the useful thing to report.

### What it does not do yet

Prints to the serial line, draws a fixed pattern, and can allocate a physical
page. No page tables for processes, no text on screen, no keyboard, no
programs — those are on the x86 side, and are being brought across.

## x86-64 — the one that runs programs

QEMU's `-kernel` cannot load this one directly: it is a multiboot2 image, and
`-kernel` on x86 wants a Linux bzImage or a PVH ELF. It boots from a GRUB
rescue ISO, which is also what the boot gate builds:

```sh
mkdir -p isodir/boot/grub
cp zig-out/bin/clarity-kernel isodir/boot/clarity-kernel
cat > isodir/boot/grub/grub.cfg <<'CFG'
set timeout=0
set default=0
menuentry "ClarityOS" {
    multiboot2 /boot/clarity-kernel
    boot
}
CFG
grub-mkrescue -o clarity.iso isodir

qemu-system-x86_64 -cdrom clarity.iso -boot d -m 512 \
  -serial stdio -display none -no-reboot
```

Needs `grub-pc-bin`, `grub-common`, `xorriso` and `mtools` alongside QEMU.

This is the mature side: memory management, preemptive scheduling, a
filesystem, ELF loading, and two processes run in sequence — the second of
them a Clarity program compiled by `clarity cc --freestanding`. It has no
display.

## The checks

```sh
python3 tools/fb_check.py zig-out/bin/clarity-kernel-aarch64.img
```

Boots the ARM kernel, takes a screendump through QEMU's monitor, and verifies
the colours at the coordinates the kernel draws them. The rest of the boot
assertions live in `.github/workflows/os-boot.yml`, which boots the x86 image
three times and requires all fifteen markers on every attempt.
