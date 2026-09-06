//! ClarityOS aarch64 kernel entry.
//!
//! First milestone of the Apple-Silicon-class AArch64 port: come up at
//! EL1 on QEMU's `virt` machine, bring the PL011 console online, and
//! report a verifiable boot marker over serial.
//!
//! The x86_64 kernel (main.zig) owns the mature path — memory manager,
//! scheduler, syscalls, VFS, drivers. Those subsystems are largely
//! architecture-neutral Zig, but they reach into x86-only pieces today
//! (port I/O, GDT/IDT, 4-level x86 paging), so they are brought across
//! one phase at a time rather than in one risky move. This entry point
//! grows as each is made architecture-clean.

const std = @import("std");
const console = @import("arch/aarch64/console.zig");
const timer = @import("arch/aarch64/timer.zig");
const mmu = @import("arch/aarch64/mmu.zig");
const ramfb = @import("arch/aarch64/ramfb.zig");
const fwcfg = @import("arch/aarch64/fwcfg.zig");
const fdt = @import("boot/fdt.zig");
const pmm = @import("mm/pmm.zig");
const vm = @import("arch/aarch64/vm.zig");
const fb = @import("graphics/fb.zig");

/// Entry point called by the boot stub (arch/aarch64/boot.S) once the CPU
/// is at EL1 with a stack and a zeroed .bss. `dtb_phys` is the device tree
/// pointer QEMU leaves in x0; recorded now, consumed by the memory phase.
export fn kernel_main_aarch64(dtb_phys: u64) callconv(.C) noreturn {
    console.init();
    console.println("ClarityOS aarch64 micro-kernel starting...");
    console.println("  [ok] EL1 + PL011 UART");

    install_vectors();
    console.println("  [ok] exception vectors (VBAR_EL1)");

    // Translation was turned on by the boot stub, before this function could
    // run at all: the kernel is linked for the high half, so there is no
    // address at which this code could execute untranslated. Reaching this
    // line at a high program counter is the evidence that the table the stub
    // built, the device attributes covering the UART, and the branch into the
    // high mapping are all correct.
    mmu.report();

    // Stop translating the low half. Everything below this line — the device
    // tree, fw_cfg, the framebuffer, every page the allocator returns — is
    // reached through the kernel's direct map, and dropping the identity map
    // here rather than at the end of boot is what makes that a claim the
    // machine checks instead of one this file asserts. A single missed
    // conversion is now a translation fault at the point of the mistake.
    //
    // It is also the point of the exercise: TTBR0 is the register the
    // hardware switches per process, and it is now free for userland.
    mmu.drop_identity();
    address_space_selftest();

    // What kind of machine is this? On x86 the firmware answers with a
    // multiboot2 block; here the answer is a device tree, whose address the
    // bootloader left in x0 — a physical one, which is now a number this
    // kernel cannot dereference until it says where that memory appears.
    const tree = describe_machine(dtb_phys);

    timer.init(100);
    console.print("  [ok] generic timer armed at 100 Hz, cntfrq=");
    console.print_dec(timer.frequency());
    console.println("");

    timer_selftest();

    // Physical memory. Nothing on this architecture could allocate a page
    // before this: the kernel had no idea where RAM was.
    memory_selftest(tree, dtb_phys);

    // A screen. Everything this kernel has said so far went out a serial
    // line; this is the first thing it can show.
    screen_selftest();

    console.println("ClarityOS aarch64: EL1 boot ok");

    hang();
}

/// Ask the translation hardware what the address space actually looks like.
///
/// Setting TCR_EL1.EPD0 and reading it back proves only that the write
/// landed. `at s1e1w` runs a real stage-1 translation and reports what came
/// out, so the three claims below are answered by the MMU rather than by this
/// file: the low half no longer translates, the high half does, and it maps
/// where the linker script says it maps.
///
/// The UART is the address to ask about, because it is the one this kernel is
/// printing through — if its high mapping were wrong there would be no
/// message, and if its low mapping still worked the whole exercise would be
/// pointless.
fn address_space_selftest() void {
    const uart_phys: u64 = 0x0900_0000;
    const low = mmu.translate(uart_phys);
    const high = mmu.translate(vm.phys_to_virt(uart_phys));

    if (low == null and high != null and high.? == uart_phys) {
        console.print("  [ok] identity map dropped: ");
        console.print_hex(uart_phys);
        console.print(" no longer translates, ");
        console.print_hex(vm.phys_to_virt(uart_phys));
        console.print(" -> ");
        console.print_hex(high.?);
        console.println("; TTBR0 is free for userland");
    } else {
        console.print("  [FAIL] address space: low=");
        console.print_hex(low orelse 0);
        console.print(" high=");
        console.print_hex(high orelse 0);
        console.print(" tcr.EPD0=");
        console.print_dec(if (mmu.identity_dropped()) 1 else 0);
        console.println("");
    }
}

/// The vector table lives in vectors.S, 2 KiB-aligned as VBAR_EL1 requires.
extern const aarch64_vectors: u8;

const SCREEN_W: u32 = 1024;
const SCREEN_H: u32 = 768;

/// Where the four colour patches sit. Named here so the pattern that draws
/// them and the check that reads them back cannot drift apart, and so the CI
/// step that inspects a screenshot has coordinates to name.
const PATCH: u32 = 120;
const PATCH_Y: u32 = 240;
const PATCH_X = [_]u32{ 112, 288, 464, 640 };
const PATCH_COLOUR = [_]u32{ fb.RED, fb.GREEN, fb.BLUE, fb.WHITE };

/// One past the last byte of usable RAM, once the device tree has been read.
/// Zero means it is not known yet, in which case nothing may assume a fixed
/// address is real memory.
var ram_end: u64 = 0;

/// Bring up the display and prove something is really on it.
///
/// Reading the pixels back is the part that matters. Writing to memory proves
/// only that the memory is writable — the question is whether that memory is
/// the screen, and whether the machine agreed to scan it out. The read-back
/// answers the first half; the screenshot CI takes answers the second, and
/// neither is redundant.
fn screen_selftest() void {
    // The framebuffer sits at a fixed address chosen before this kernel could
    // ask how much RAM the machine has. Now it can — and on a machine small
    // enough that the address is past the end of memory, configuring ramfb
    // would point the display at nothing and the writes below would go
    // nowhere. Refusing is a message; carrying on is a picture of noise.
    const fb_bytes: u64 = @as(u64, SCREEN_W) * SCREEN_H * 4;
    if (ram_end != 0 and ramfb.FB_PHYS + fb_bytes > ram_end) {
        console.print("  [--] framebuffer wants ");
        console.print_hex(ramfb.FB_PHYS);
        console.print("..");
        console.print_hex(ramfb.FB_PHYS + fb_bytes);
        console.print(" but RAM ends at ");
        console.print_hex(ram_end);
        console.println("; running headless");
        return;
    }

    const surf_info = ramfb.init(SCREEN_W, SCREEN_H) orelse {
        // Not a failure of this code: it means QEMU was started without
        // `-device ramfb`, and the kernel carries on headless as before.
        console.println("  [--] no ramfb on this machine; running headless");
        return;
    };

    const s = fb.Surface{
        .base = surf_info.base,
        .width = surf_info.width,
        .height = surf_info.height,
        .stride = surf_info.stride,
    };

    s.clear(fb.SLATE);
    s.frame(0, 0, SCREEN_W, SCREEN_H, 8, fb.SIGNAL);
    for (PATCH_X, PATCH_COLOUR) |x, colour| {
        s.fill(x, PATCH_Y, PATCH, PATCH, colour);
    }

    // Read back the centre of each patch, plus one pixel of the border and
    // one of the background, so a surface that came up entirely one colour
    // fails rather than passes.
    var ok = true;
    for (PATCH_X, PATCH_COLOUR) |x, colour| {
        if (s.get(x + PATCH / 2, PATCH_Y + PATCH / 2) != colour) ok = false;
    }
    if (s.get(4, 4) != fb.SIGNAL) ok = false;
    if (s.get(SCREEN_W / 2, SCREEN_H - 64) != fb.SLATE) ok = false;

    if (ok) {
        console.print("  [ok] framebuffer: ");
        console.print_dec(SCREEN_W);
        console.print("x");
        console.print_dec(SCREEN_H);
        console.print(" at ");
        console.print_hex(surf_info.base);
        console.println(", pattern reads back correct");
    } else {
        console.println("  [FAIL] framebuffer: wrote a pattern, read back something else");
    }
}

/// Prove an interrupt actually arrives.
///
/// The counter is incremented only by the IRQ handler, so reaching WANT is
/// impossible without one really being delivered — the same principle as the
/// x86 preemption test, which two threads could not pass by cooperating.
///
/// Bounded in spins rather than in time, because a deadline measured in timer
/// ticks would wait forever for exactly the thing whose absence it is meant to
/// report. Three ticks rather than one, because the comparator is one-shot: a
/// handler that fires but forgets to re-arm would pass a test that asked for
/// one and fail this.
fn timer_selftest() void {
    const WANT: u64 = 3;
    const SPIN_LIMIT: u64 = 100_000_000;
    var spins: u64 = 0;
    while (timer.ticks() < WANT and spins < SPIN_LIMIT) : (spins += 1) {
        asm volatile ("nop");
    }
    if (timer.ticks() >= WANT) {
        console.print("  [ok] aarch64 timer: interrupts delivered, ticks=");
        console.print_dec(timer.ticks());
        console.println("");
    } else {
        console.print("  [FAIL] aarch64 timer: no interrupt arrived, ticks=");
        console.print_dec(timer.ticks());
        console.println("");
    }
}

/// Called from the IRQ vector entry, which saved the caller-saved integer
/// registers and will `eret` when this returns.
///
/// Condition flags need no saving: `eret` restores PSTATE from SPSR_EL1,
/// which carries NZCV. FP and SIMD registers are *not* saved, which is fine
/// while the only interruptible code is kernel code that does not use them,
/// and is a gap to close before anything with floating point can be
/// preempted.
export fn aarch64_irq() callconv(.C) void {
    timer.handle_irq();
}

fn install_vectors() void {
    asm volatile (
        \\msr vbar_el1, %[table]
        \\isb
        :
        : [table] "r" (@intFromPtr(&aarch64_vectors)),
        : "memory"
    );
}

/// Called from every vector-table entry. `kind` is the entry index (0..15:
/// four groups of sync/IRQ/FIQ/SError), and the syndrome registers say what
/// happened and where. Nothing generates interrupts yet, so anything
/// arriving here is a bug worth reporting rather than silently spinning.
export fn aarch64_exception(kind: u64, esr: u64, elr: u64, far: u64) callconv(.C) noreturn {
    console.print("\n\nAARCH64 EXCEPTION entry=");
    console.print_dec(kind);
    console.print(" esr=");
    console.print_hex(esr);
    console.print(" elr=");
    console.print_hex(elr);
    console.print(" far=");
    console.print_hex(far);
    console.println("");
    hang();
}

fn hang() noreturn {
    while (true) {
        asm volatile ("wfe");
    }
}

/// Freestanding targets need an explicit panic handler.
pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    console.print("\n\nKERNEL PANIC (aarch64): ");
    console.println(msg);
    hang();
}

/// End of everything the kernel image occupies, from the linker script — past
/// .bss and past the boot stack.
extern const __stack_top: u8;

/// Read the machine's own description, and point the drivers that need an
/// address at the one it gives.
///
/// Null means no device tree, which is survivable: the drivers keep their
/// QEMU `virt` defaults and the memory phase below reports that it cannot
/// run. It is worth distinguishing from a tree that parsed and said something
/// unexpected, because the two have completely different causes.
fn describe_machine(dtb_phys: u64) ?fdt.Fdt {
    const tree = fdt.parse(vm.phys_to_virt(dtb_phys)) orelse {
        console.print("  [--] no device tree at ");
        console.print_hex(dtb_phys);
        console.println("; using built-in machine defaults");
        return null;
    };

    console.print("  [ok] device tree at ");
    console.print_hex(dtb_phys);
    console.print(", ");
    console.print_dec(tree.total_size);
    console.print(" bytes, #address-cells=");
    console.print_dec(tree.addr_cells);
    console.print(" #size-cells=");
    console.print_dec(tree.size_cells);
    console.println("");

    // The one hardcoded address this retires. The UART's cannot follow: the
    // console has to work before anything can be printed about the tree, so
    // it is found the only way something can be before there is any output.
    if (fdt.node_reg(&tree, "fw-cfg@")) |reg| {
        fwcfg.set_base(reg.base);
        console.print("  [ok] fw_cfg from the device tree at ");
        console.print_hex(reg.base);
        console.println("");
    }
    return tree;
}

/// Stand up the page allocator, and prove it hands out memory that works.
fn memory_selftest(tree: ?fdt.Fdt, dtb_phys: u64) void {
    const t = tree orelse {
        console.println("  [--] no device tree; physical memory unknown, allocator not started");
        return;
    };

    var regions: [8]fdt.Region = undefined;
    const n = fdt.memory_regions(&t, &regions);
    if (n == 0) {
        console.println("  [FAIL] device tree describes no memory");
        return;
    }

    pmm.begin();
    var total: u64 = 0;
    for (regions[0..n]) |r| {
        pmm.add_available(r.base, r.len);
        total += r.len;
        ram_end = @max(ram_end, r.base + r.len);
        console.print("  ram ");
        console.print_hex(r.base);
        console.print(" + ");
        console.print_dec(r.len >> 20);
        console.println(" MiB");
    }

    // The boot stub could only map the gigabyte it found itself running in,
    // because it ran before anything had read this tree. Now that the extent
    // of RAM is known, the rest of it gets mapped — otherwise the allocator
    // would happily hand out pages above the first gigabyte that this kernel
    // could not touch.
    var mmu_regions: [8]mmu.Region = undefined;
    for (regions[0..n], 0..) |r, i| mmu_regions[i] = .{ .base = r.base, .len = r.len };
    const added = mmu.map_ram(mmu_regions[0..n]);

    // Every gigabyte the allocator is about to hand pages out of has to be
    // reachable, and the way to know is to ask the MMU rather than to trust
    // the loop above. The last byte of each region is the interesting one: it
    // is the address a mapping that stopped one block short would miss, and
    // it is exactly where the allocator ends up on a machine with more RAM
    // than the boot stub could map.
    var reach_ok = true;
    for (regions[0..n]) |r| {
        if (r.len == 0) continue;
        const last = r.base + r.len - 1;
        if (mmu.translate(vm.phys_to_virt(last)) != last) reach_ok = false;
    }
    if (reach_ok) {
        console.print("  [ok] direct map covers all of RAM (");
        console.print_dec(added);
        console.println(" GiB added beyond the boot stub's block)");
    } else {
        console.println("  [FAIL] direct map does not reach the end of RAM");
    }

    // Three things already live in that memory and must never be handed out.
    //
    // The kernel image runs from where it was loaded — and the reservation
    // starts at the base of RAM rather than at the image, because the ARM64
    // boot protocol puts the kernel 512 KiB up and leaves what is underneath
    // to the bootloader. QEMU happens to put nothing there; a different
    // bootloader is entitled to, and half a mebibyte is not worth the risk.
    //
    // The device tree is still being read from, wherever the bootloader chose
    // to put it. And the framebuffer is being scanned out by the display
    // right now, so a page handed out of it would appear on screen.
    // `__stack_top` is a link-time address, which is now a *virtual* one; the
    // allocator deals in physical addresses, so it is converted back. Getting
    // this wrong would reserve a range starting 0xFFFF_FF80... pages in and
    // reserve nothing at all.
    const kernel_end: u64 = vm.virt_to_phys(@intFromPtr(&__stack_top));
    pmm.reserve(regions[0].base, kernel_end - regions[0].base);
    pmm.reserve(dtb_phys, t.total_size);
    pmm.reserve(ramfb.FB_PHYS, @as(u64, SCREEN_W) * SCREEN_H * 4);
    pmm.finish();

    const before = pmm.stats();

    // Allocate, write through it, read it back, free it, and check the page
    // comes back. Allocating alone proves only that a bit was flipped; the
    // question is whether the address returned is memory that works.
    const p1 = pmm.alloc_page() orelse {
        console.println("  [FAIL] pmm: no page available on a machine with RAM");
        return;
    };
    // `p1` is physical, and this kernel has no identity map: dereferencing it
    // directly would fault. Through the direct map it is memory.
    const cell: *volatile u64 = vm.ptr_to_phys(*volatile u64, p1);
    cell.* = 0xC0FFEE_5EED;
    const held = cell.* == 0xC0FFEE_5EED;

    const p2 = pmm.alloc_page() orelse 0;
    const distinct = p2 != 0 and p2 != p1;

    pmm.free_page(p1);
    pmm.free_page(p2);
    const after = pmm.stats();
    const restored = after.free_pages == before.free_pages;

    // A page below the end of the kernel image would mean the reservations
    // did not take — the failure that corrupts the kernel out from under
    // itself later rather than here.
    const outside_kernel = p1 >= kernel_end;

    if (held and distinct and restored and outside_kernel) {
        console.print("  [ok] pmm: ");
        console.print_dec(before.total_bytes >> 20);
        console.print(" MiB managed, ");
        console.print_dec(before.free_pages);
        console.print(" pages free, allocated ");
        console.print_hex(p1);
        console.println(" and it holds");
    } else {
        console.print("  [FAIL] pmm: held=");
        console.print_dec(@intFromBool(held));
        console.print(" distinct=");
        console.print_dec(@intFromBool(distinct));
        console.print(" restored=");
        console.print_dec(@intFromBool(restored));
        console.print(" outside_kernel=");
        console.print_dec(@intFromBool(outside_kernel));
        console.println("");
    }
}


