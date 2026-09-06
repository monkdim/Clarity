//! Interrupt Descriptor Table — IRQ + exception dispatch.
//!
//! Every one of the 256 gates is populated. An unpopulated gate is not
//! "unused": the CPU treats a not-present gate as a #GP, and with no #GP
//! handler that escalates to a double fault and then a triple fault, which
//! resets the machine without printing anything. That failure mode makes
//! every kernel bug look identical from the serial log, so the CPU
//! exception vectors report a register dump before halting, and the
//! remaining vectors get a benign handler that acknowledges the PIC.

const std = @import("std");
const console = @import("console.zig");
const port = @import("port.zig");

const Entry = packed struct {
    offset_low: u16,
    selector: u16,
    ist: u8,
    type_attr: u8,
    offset_mid: u16,
    offset_high: u32,
    reserved: u32,
};

/// What the CPU pushes for an interrupt taken from ring 0.
pub const InterruptFrame = extern struct {
    rip: u64,
    cs: u64,
    rflags: u64,
    rsp: u64,
    ss: u64,
};

var idt: [256]Entry align(8) = undefined;
var idtr: packed struct { limit: u16, base: u64 } = undefined;

const EXCEPTION_NAMES = [_][]const u8{
    "divide error",
    "debug",
    "non-maskable interrupt",
    "breakpoint",
    "overflow",
    "BOUND range exceeded",
    "invalid opcode",
    "device not available",
    "double fault",
    "coprocessor segment overrun",
    "invalid TSS",
    "segment not present",
    "stack-segment fault",
    "general protection fault",
    "page fault",
    "reserved",
    "x87 floating-point exception",
    "alignment check",
    "machine check",
    "SIMD floating-point exception",
    "virtualization exception",
    "control protection exception",
};

/// Vectors that push an error code before the interrupt frame.
fn pushes_error_code(comptime vec: usize) bool {
    return vec == 8 or (vec >= 10 and vec <= 14) or vec == 17 or vec == 21 or vec == 29 or vec == 30;
}

fn read_cr2() u64 {
    return asm volatile ("mov %%cr2, %[ret]"
        : [ret] "=r" (-> u64),
    );
}

fn halt() noreturn {
    while (true) asm volatile ("cli; hlt");
}

fn report(vec: usize, err: ?u64, frame: *const InterruptFrame) noreturn {
    console.print("\n\nCPU EXCEPTION ");
    console.print_dec(vec);
    if (vec < EXCEPTION_NAMES.len) {
        console.print(" (");
        console.print(EXCEPTION_NAMES[vec]);
        console.print(")");
    }
    if (err) |e| {
        console.print(" error_code=");
        console.print_hex(e);
    }
    console.print("\n  rip=");
    console.print_hex(frame.rip);
    console.print(" cs=");
    console.print_hex(frame.cs);
    console.print(" rflags=");
    console.print_hex(frame.rflags);
    console.print("\n  rsp=");
    console.print_hex(frame.rsp);
    console.print(" ss=");
    console.print_hex(frame.ss);
    if (vec == 14) {
        // #PF: CR2 holds the faulting linear address.
        console.print(" cr2=");
        console.print_hex(read_cr2());
    }
    console.println("");
    halt();
}

fn ExceptionHandler(comptime vec: usize) type {
    return struct {
        fn with_error(frame: *InterruptFrame, err: u64) callconv(.Interrupt) void {
            report(vec, err, frame);
        }
        fn without_error(frame: *InterruptFrame) callconv(.Interrupt) void {
            report(vec, null, frame);
        }
    };
}

/// Anything not otherwise claimed: acknowledge the PIC and resume. A
/// spurious or unclaimed IRQ must not be able to take the machine down.
fn default_irq(frame: *InterruptFrame) callconv(.Interrupt) void {
    _ = frame;
    end_of_interrupt(0xFF);
}

/// Signal end-of-interrupt to the PIC(s). Vectors 0x28+ live on the slave.
pub fn end_of_interrupt(vector: u8) void {
    if (vector >= 0x28) port.out8(0xA0, 0x20);
    port.out8(0x20, 0x20);
}

pub fn init() void {
    @memset(std.mem.asBytes(&idt), 0);
    remap_pic();

    // CPU exceptions: report and halt rather than triple-faulting silently.
    inline for (0..32) |vec| {
        const H = ExceptionHandler(vec);
        if (comptime pushes_error_code(vec)) {
            set_gate(@intCast(vec), @intFromPtr(&H.with_error));
        } else {
            set_gate(@intCast(vec), @intFromPtr(&H.without_error));
        }
    }
    // Everything else: benign, PIC-acknowledging stub until a driver claims it.
    inline for (32..256) |vec| {
        set_gate(@intCast(vec), @intFromPtr(&default_irq));
    }

    idtr.limit = @sizeOf(@TypeOf(idt)) - 1;
    idtr.base = @intFromPtr(&idt);
    asm volatile ("lidt %[idtr]; sti"
        :
        : [idtr] "*p" (&idtr),
    );
}

fn set_gate(vector: u8, addr: u64) void {
    idt[vector] = .{
        .offset_low = @truncate(addr),
        .selector = 0x08,
        .ist = 0,
        .type_attr = 0x8E, // present, ring 0, 64-bit interrupt gate
        .offset_mid = @truncate(addr >> 16),
        .offset_high = @truncate(addr >> 32),
        .reserved = 0,
    };
}

/// Install a device IRQ handler. Handlers use the interrupt calling
/// convention so the CPU state is preserved and the return is an `iretq`;
/// a plain function would return with `ret` and corrupt the stack.
pub fn set_handler(vector: u8, handler: *const fn (*InterruptFrame) callconv(.Interrupt) void) void {
    set_gate(vector, @intFromPtr(handler));
}

fn remap_pic() void {
    // Remap the legacy 8259 PIC vectors to 0x20..0x2F so they don't
    // collide with CPU exceptions in the 0x00..0x1F range.
    port.out8(0x20, 0x11); port.out8(0xA0, 0x11);
    port.out8(0x21, 0x20); port.out8(0xA1, 0x28);
    port.out8(0x21, 0x04); port.out8(0xA1, 0x02);
    port.out8(0x21, 0x01); port.out8(0xA1, 0x01);
    port.out8(0x21, 0x00); port.out8(0xA1, 0x00);
}
