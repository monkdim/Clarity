//! Virtual terminal device — `/dev/tty0`.
//!
//! Owns a line-discipline buffer (canonical mode by default; raw
//! mode for the terminal app). Writes go to the framebuffer console
//! (or COM1 if no framebuffer is up); reads pull from the keyboard
//! ring buffer through PS/2 + the keymap. Supports the same VT100
//! parser the Phase 63 terminal app uses, so apps see a consistent
//! terminal regardless of where they run.
//!
//! Phase 71 ships canonical-mode line input + raw write-through to
//! the console. ICRNL / OPOST / ECHO toggling lives behind ioctl()
//! once the syscall is wired in.

const std = @import("std");
const console = @import("../arch/x86_64/console.zig");
const ps2 = @import("ps2.zig");

pub const LINE_BUFFER_SIZE: usize = 256;
pub const RING_SIZE: usize = 1024;

pub const Mode = enum { canonical, raw };

pub const Tty = struct {
    mode: Mode = .canonical,
    echo: bool = true,
    line_buf: [LINE_BUFFER_SIZE]u8 = undefined,
    line_len: usize = 0,
    in_ring: [RING_SIZE]u8 = undefined,
    in_head: usize = 0,
    in_tail: usize = 0,

    pub fn init() Tty { return .{}; }

    /// Push a scancode-translated byte into the input ring. Called
    /// from the keyboard driver's IRQ path (after keymap lookup);
    /// in canonical mode we accumulate into line_buf and only
    /// commit on `\n`.
    pub fn push_input(self: *Tty, byte: u8) void {
        if (self.mode == .raw) {
            self.ring_write(byte);
            return;
        }
        // Canonical: handle backspace + buffer-then-flush-on-newline.
        switch (byte) {
            8, 0x7F => {
                if (self.line_len > 0) {
                    self.line_len -= 1;
                    if (self.echo) self.write_byte(8);
                    if (self.echo) self.write_byte(' ');
                    if (self.echo) self.write_byte(8);
                }
            },
            '\r', '\n' => {
                self.line_buf[self.line_len] = '\n';
                var i: usize = 0;
                while (i <= self.line_len) : (i += 1) self.ring_write(self.line_buf[i]);
                self.line_len = 0;
                if (self.echo) self.write_byte('\n');
            },
            else => {
                if (self.line_len + 1 < LINE_BUFFER_SIZE) {
                    self.line_buf[self.line_len] = byte;
                    self.line_len += 1;
                    if (self.echo) self.write_byte(byte);
                }
            },
        }
    }

    fn ring_write(self: *Tty, byte: u8) void {
        const next = (self.in_head + 1) % RING_SIZE;
        if (next != self.in_tail) {
            self.in_ring[self.in_head] = byte;
            self.in_head = next;
        }
    }

    /// Pull up to `buf.len` bytes from the input ring. Returns the
    /// number of bytes copied; 0 if no bytes available (caller
    /// blocks via the scheduler in canonical mode).
    pub fn read(self: *Tty, buf: []u8) usize {
        var n: usize = 0;
        while (n < buf.len and self.in_head != self.in_tail) {
            buf[n] = self.in_ring[self.in_tail];
            self.in_tail = (self.in_tail + 1) % RING_SIZE;
            n += 1;
        }
        return n;
    }

    /// Write `buf` to the console (and the framebuffer console once
    /// the framebuffer driver is up; for now everything goes through
    /// the early-boot console — VGA + COM1).
    pub fn write(self: *Tty, buf: []const u8) usize {
        _ = self;
        for (buf) |b| console.print(&[_]u8{b});
        return buf.len;
    }

    fn write_byte(self: *Tty, byte: u8) void {
        _ = self.write(&[_]u8{byte});
    }

    pub fn input_available(self: *const Tty) bool { return self.in_head != self.in_tail; }
    pub fn input_pending(self: *const Tty) usize {
        return if (self.in_head >= self.in_tail) self.in_head - self.in_tail else RING_SIZE - self.in_tail + self.in_head;
    }

    pub fn set_mode(self: *Tty, mode: Mode) void {
        // Switching to raw drops any partially-typed line.
        if (mode == .raw) self.line_len = 0;
        self.mode = mode;
    }
};

/// The system has one TTY for now. Phase 73 grows this into a
/// multi-tty + virtual-console model when the desktop boots.
pub var tty0: Tty = Tty.init();

/// Called by the keyboard driver once a scancode has been mapped
/// to an ASCII byte. Hands the byte to tty0.
pub fn keyboard_byte(byte: u8) void {
    tty0.push_input(byte);
}
