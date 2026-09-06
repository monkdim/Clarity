//! The console as something to read from.
//!
//! `drivers/line.zig` turns characters into lines; this decides who gets
//! them. There is one editor, not one per caller, because two editors reading
//! the same keyboard would each see half of what was typed — and the boot
//! selftest and `read(2)` are two callers of exactly that kind.
//!
//! Architecture-independent, like the editor: the keyboard, the echo and even
//! the clock arrive as functions. On aarch64 they are virtio-input, the PL011
//! console mirrored to the screen, and the generic timer.

const line = @import("line.zig");

pub const Source = struct {
    /// The next character typed, or null.
    poll: *const fn () ?u8,
    /// Where the echo goes.
    echo: *const fn (u8) void,
    /// A monotonic counter, for the idle timeout. Ticks rather than
    /// microseconds because a tick is what the kernel has.
    ticks: *const fn () u64,
};

var src: ?Source = null;
var editor: line.Editor = undefined;

/// The last completed line, plus the newline that ends it, and how much of it
/// has been handed out. A caller with a short buffer gets the rest next time,
/// which is what makes read(2) with a one-byte buffer work.
var pending: [line.MAX_LINE + 1]u8 = undefined;
var pending_len: usize = 0;
var pending_at: usize = 0;

pub fn init(s: Source) void {
    src = s;
    editor = line.Editor.init(s.echo);
    pending_len = 0;
    pending_at = 0;
}

pub fn present() bool {
    return src != null;
}

/// What the editor has been told to throw away, for the boot log to report.
pub fn ignored() u64 {
    return if (src == null) 0 else editor.ignored;
}
pub fn dropped() u64 {
    return if (src == null) 0 else editor.dropped;
}

/// A line that was still being typed when the wait ran out.
pub fn partial() []const u8 {
    if (src == null) return &.{};
    return editor.buf[0..editor.len];
}

/// Fill `dest` from the console. Returns 0 for end of input.
///
/// This is where a real kernel blocks the calling thread and wakes it when a
/// key arrives. There is no scheduler to block on yet, so it spins — and a
/// spin with no end would hang the boot rather than wait for it, since
/// nothing can interrupt a system call. So it gives up after `idle_ticks`
/// with nothing typed and reports end of input, which is a thing callers
/// already have to handle: it is what a closed stdin looks like.
///
/// The timeout is the caller's, not this module's, because how long it is
/// worth waiting is a question about the caller and not about the keyboard.
pub fn read(dest: []u8, idle_ticks: u64) usize {
    const s = src orelse return 0;
    if (dest.len == 0) return 0;
    if (pending_at == pending_len and !collect(s, idle_ticks)) return 0;

    const n = @min(dest.len, pending_len - pending_at);
    @memcpy(dest[0..n], pending[pending_at..][0..n]);
    pending_at += n;
    return n;
}

/// Give back the last `n` bytes handed out by `read`.
///
/// For a caller that took bytes and then could not deliver them — `read(2)`
/// discovering halfway through that the process's buffer is not writable.
/// Without this the line would be gone, and a program that passed a bad
/// pointer would cost the *next* program its input.
pub fn unread(n: usize) void {
    pending_at -= @min(n, pending_at);
}

fn collect(s: Source, idle_ticks: u64) bool {
    var deadline = s.ticks() + idle_ticks;
    while (s.ticks() < deadline) {
        const c = s.poll() orelse continue;
        deadline = s.ticks() + idle_ticks;
        const done = editor.feed(c) orelse continue;

        const n = @min(done.len, pending.len - 1);
        @memcpy(pending[0..n], done[0..n]);
        // The newline is put back on. The editor strips it, because a line is
        // its text; a reader wants it, because that is how read(2) says where
        // one line ended and the next begins.
        pending[n] = '\n';
        pending_len = n + 1;
        pending_at = 0;
        return true;
    }
    return false;
}
