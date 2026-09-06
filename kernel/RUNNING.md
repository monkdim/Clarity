# Running ClarityOS

Two architectures, two machines. Both boot under QEMU; neither has run on
real hardware yet.

## Build

Needs Zig 0.13. From `kernel/`:

```sh
zig build            # x86-64  -> zig-out/bin/clarity-kernel
zig build aarch64    # aarch64 -> zig-out/bin/clarity-kernel-aarch64.img
```

To just see one boot, without reading the rest of this file:

```sh
zig build run            # x86-64: builds a GRUB ISO, boots it, serial on stdout
zig build run-aarch64    # aarch64: boots the image, opens a window with the screen
```

The x86 one goes through `tools/run_x86.sh` because QEMU's `-kernel` cannot
load a multiboot2 image; the script builds the same rescue ISO the boot gate
builds, so `zig build run` and CI boot the kernel identically. It needs
`grub-mkrescue` and `xorriso`, and says so by name if they are missing.

Both boots end by halting on purpose — the kernel has nothing left to do, so
it stops rather than resetting. Ctrl-A X quits QEMU.

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

You should get a 1024×768 window. It shows a test pattern first — slate
background, blue border, four colour patches — and then the boot log itself,
in white on slate, 64 columns by 48 rows. Everything the kernel says from the
`[ok] console on screen` line onward appears there as well as on the serial
line.

That is what the boot gate checks: it screenshots the display and compares
*every character cell* against what the serial log says should be there,
rendering the glyphs itself from `tools/font8x8.txt`. The kernel draws from
`graphics/font8x8.zig`, which is generated from that file — so a generator
that dropped a row, a console that wrapped at the wrong column, or a scroll
that sheared by a pixel makes the two disagree.

The serial log should report the machine describing itself:

```
  [ok] MMU on (39-bit VA, direct map at 0xffffff8000000000) sctlr.M=1 pc=0xffffff8040082eb4
  [ok] identity map dropped: 0x9000000 no longer translates, 0xffffff8009000000 -> 0x9000000; TTBR0 is free for userland
  [ok] device tree at 0x48000000, 1048576 bytes, #address-cells=2 #size-cells=2
  [ok] fw_cfg from the device tree at 0x9020000
  ram 0x40000000 + 512 MiB
  [ok] direct map covers all of RAM (0 GiB added beyond the boot stub's block)
  [ok] pmm: 512 MiB managed, 129347 pages free, allocated 0x402bd000 and it holds
  [ok] process address space: 0x10000000 -> 0x402c0000 for EL0 read and write, 0x400000 read-only (a write there faults), kernel unaffected, unmapped and torn down with every page returned
  -- below this line, EL0 is speaking through write(2) --
hello from EL0 on aarch64
  [ok] EL0: a program wrote 26 bytes through write(2), read 41 from its own memory, and exited with 42 — which the kernel found in the page it had left it
  [ok] EL0: the timer interrupted it 18 times while it ran, and it carried on afterwards
  [ok] EL0: and when it wrote to its read-only text at 0x400000, the kernel took the CPU back
  [ok] context switch: ABABABa — two threads alternated and handed the CPU back
  [ok] preemption: B ran (7583766) while A (9416843) never yielded — 6 switches in 7 ticks, each thread resuming in its own code
  init: 74208 bytes of ELF, embedded in the kernel image
  init: entry 0x40100000, stack 0x7fffffc0, 4 mapped ranges, heap from 0x40104000
  [ok] user .data came from the file
hello from /bin/clarity-init on aarch64
  [ok] user .bss zeroed
  [ok] user .data writable
  [ok] user fp: 355/113 in a v register
  [ok] user heap: brk grew and the memory holds
  ... the same five lines again, from the second run ...
  [ok] init: a compiled, linked ELF ran at EL0 twice, printed 216 bytes, exited 42 each time, and every page came back
  demo: 123232 bytes of Clarity, compiled to C and then to this machine
  ... the demo program's own output ...
  float 3.1415929203539825 1.4142135623730951 6.25
  clarity-demo: all checks passed
  [ok] demo: a Clarity program ran on aarch64, printed 209 bytes and used 192 KiB of heap
```

The spin counts and the tick count vary — it is however many times the 100 Hz
timer happened to fire during the process's delay loop, and the check is only
that it fired at all.

Change `-m 512` and the RAM line follows it — that is the kernel reading the
device tree rather than assuming a machine. Try `-m 4096` and the direct-map
line changes too: the boot stub can only map the gigabyte it was loaded into,
because it runs before anything has read the device tree, and the other three
are mapped afterwards by code that has.

The `pc=` on the first line and the addresses on the second are the whole of
the higher-half port in two lines. The kernel is linked at
`0xFFFF_FF80_0000_0000 + physical` and running there, and the low half is no
longer translated at all — those addresses are not printed from the linker
script, they come from the program counter and from asking the MMU to
translate an address (`at s1e1w`) and reporting what it said.

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

### A keyboard

```sh
qemu-system-aarch64 \
  -M virt -cpu cortex-a72 -m 512 \
  -kernel zig-out/bin/clarity-kernel-aarch64.img \
  -device ramfb \
  -device virtio-keyboard-device \
  -serial stdio
```

`virt` has no PS/2 controller — neither does the hardware this is aimed at —
so a key press arrives as a virtio-input event on the MMIO bus, and the extra
`-device` is what puts one there. The kernel finds it by walking the
thirty-two bus slots the device tree names and reading each one's registers,
then spends three seconds reading whatever is typed:

```
  [ok] keyboard: virtio-input on a bus of 32 slots
  keyboard: read 7 characters from 7 key presses: "clarity"
```

Three seconds of nothing ends it, as does two seconds of quiet after the last
key, so a boot with nobody at the keyboard costs three seconds and no more.
Shift works; the table is the main key block only, so function keys, the
keypad and the arrows type nothing.

Drop the `-device` and the kernel says so and carries on. It prints the bus
rather than a summary of it, because "no keyboard" is also what a driver
looking at the wrong addresses would say — with one non-keyboard device
attached, which is what produced this line, it is telling you the slot really
was read and what was in it:

```
  [--] 32 virtio slots, none of them a usable keyboard:
       slot 0xa003e00: transport version 1, device id 4
```

The `keyboard: read` line cannot be an `[ok]`, and that is the whole
difficulty with testing an input device: reading nothing is exactly what a
working driver does when nobody types, so no marker in a log nobody typed
into can tell that from a queue the device never writes to.

`tools/key_check.py` is what closes it. It boots this same command line with
QEMU's monitor on a socket and types the alphabet twice through `sendkey` —
the monitor's own path into the input device, the same one a keypress in the
QEMU window takes — then requires the kernel to report back exactly those
fifty-two characters. Fifty-two is not arbitrary: QEMU turns each key into
four events, so the run puts over two hundred through a queue of sixty-four,
and it only passes if the driver really gives its buffers back to the device
rather than draining the ring it filled at start-up. Breaking that one line
makes it read sixteen characters and stop.

### What it does not do yet

It can now do the thing an operating system is for: run a program that is not
the kernel. Unprivileged code executes at EL0 in its own address space, prints
through `write(2)`, exits with a status, is preempted by the timer and carries
on, and is stopped by the kernel when it does something it is not allowed to.
Kernel threads switch, cooperatively and preemptively, carrying their address
space with them.

The last block is the one the rest of it was for: a Clarity program, compiled
to C by `clarity cc --freestanding`, linked against `kernel/user/libc`, and
running on an Apple-Silicon-class machine. Its output is byte for byte the
same as on x86-64, floating-point digits included — the same generated C, the
same library, only the three architecture-specific pieces differ.

Two other lines came from user programs rather than from the kernel:
`hello from EL0 on aarch64`, from a probe assembled into the kernel image, and
`hello from /bin/clarity-init on aarch64`, from an ELF that a compiler built
and a linker laid out into three segments.

The second runs twice, in two address spaces, and that is not repetition. The
second run gets the frames the first one just gave back, so `.bss zeroed` and
`.data came from the file` hold only if the loader really re-zeroed and
re-copied them — removing the zeroing passes the first run and fails the
second.

Try it on a CPU that implements Privileged Access Never — `-cpu max` instead
of `-cpu cortex-a72` — and it still works, because the kernel never touches a
user address directly. It translates the pointer through the process's own
page tables and reads through its own map. On cortex-a72, which has no PAN,
doing it the wrong way also works, which is exactly why the boot gate runs
both.

What is missing is everything above that. There is no *scheduler* — the
switching primitive exists and the boot selftest drives it directly, but
nothing keeps run queues, priorities, or a process table, so programs run one
after another rather than at the same time. They are loaded from ELFs embedded
in the kernel image rather than read from anywhere: no filesystem, no shell.
`write` goes straight to the serial console because there is no VFS to route
it through. There is text on screen and there is a keyboard, but nothing
joins them: no tty, no line discipline, no `read(2)`, and so no shell. Those
are the next thing.

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
python3 tools/key_check.py zig-out/bin/clarity-kernel-aarch64.img
python3 tools/make_font.py --png /tmp/font.png   # look at the font
python3 tools/make_font.py --check               # is the generated .zig stale?
```

`fb_check.py` boots the ARM kernel, takes a screendump through QEMU's monitor,
and reads the text back out of it — replaying the console's own wrapping and
scrolling over the serial log to work out what each cell should hold, then
comparing every pixel.

`key_check.py` boots it with a keyboard attached and a monitor socket, types
through `sendkey`, and compares what the kernel says it read against what was
sent. Between them the two scripts check the console in both directions
without a person looking at anything.

`make_font.py` regenerates `graphics/font8x8.zig` from `tools/font8x8.txt`.
The `.zig` is checked in, so building needs no Python; `--check` is what stops
the two drifting, and `--png` draws the font out so it can be looked at, which
is the only way to proofread eight bytes per glyph. The rest of the boot
assertions live in `.github/workflows/os-boot.yml`, which boots the x86 image
three times and requires all fifteen markers on every attempt, and boots the
ARM image three times — with 512 MiB, with 4 GiB, and on a PAN-capable CPU.
The 4 GiB one is not repetition: a machine that fits inside the boot stub's
single mapped gigabyte would pass with the code that maps the rest of RAM
deleted. All three attach a keyboard and require the kernel to find it, and
then `key_check.py` boots a fourth time to type at one.
