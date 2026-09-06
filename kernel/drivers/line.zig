//! Characters into lines.
//!
//! The keyboard driver produces one character at a time and a shell wants a
//! line at a time, and the thing in between is older than either: a canonical-
//! mode line discipline. It collects what is typed, shows it, lets it be
//! corrected, and hands over a line when Enter is pressed.
//!
//! Architecture-independent on purpose. Nothing here knows where the
//! characters came from or where the echo goes — the caller supplies a
//! function that writes one byte, and on aarch64 that function reaches both
//! the serial line and the screen. The x86 side has a keyboard too and no
//! table to turn scancodes into characters yet; when it gets one, this is
//! what it should feed.
//!
//! Not to be confused with `drivers/tty.zig`, which sketches the same idea
//! and has never been compiled — nothing imports it, so Zig has never so
//! much as parsed it. That was measured, not assumed: a line of deliberate
//! nonsense appended to it builds clean on both architectures.

/// Longer than the 64-column screen, so a line may wrap, because a line that
/// could not would make the wrap path in the console unreachable and a bug
/// there invisible.
pub const MAX_LINE: usize = 128;

pub const Editor = struct {
    buf: [MAX_LINE]u8 = undefined,
    len: usize = 0,

    /// Where the echo goes. One byte at a time: this writes control
    /// characters as often as printable ones, and a string interface would
    /// invite a caller that buffers them.
    echo: *const fn (u8) void,

    /// Characters dropped because the line was already full, and characters
    /// ignored because nothing maps them to anything. Counted rather than
    /// silently discarded: "the kernel read fewer characters than were typed"
    /// has several causes and they are not equally interesting.
    dropped: u64 = 0,
    ignored: u64 = 0,

    pub fn init(echo: *const fn (u8) void) Editor {
        return .{ .echo = echo };
    }

    /// Feed one character. Returns the finished line when Enter was pressed.
    ///
    /// The returned slice points into this editor and stays valid only until
    /// the next call — which is enough for a caller that acts on a line
    /// before reading the next one, and is why the alternative (a second
    /// buffer, copied into on every Enter) would be paying for something
    /// nobody has needed yet.
    pub fn feed(self: *Editor, c: u8) ?[]const u8 {
        switch (c) {
            // Enter arrives as carriage return from a keyboard and as line
            // feed from a serial line, and both mean the same thing here.
            '\r', '\n' => {
                self.echo('\n');
                const line = self.buf[0..self.len];
                self.len = 0;
                return line;
            },

            // Backspace and delete. Terminals disagree about which one the
            // key sends and the disagreement is not worth inheriting.
            8, 0x7F => {
                if (self.len > 0) {
                    self.len -= 1;
                    // Back over the character, paint a space where it was,
                    // and back over the space. The console moves the cursor
                    // on a backspace and draws nothing, so this is what
                    // actually erases — and it is what every terminal
                    // expects, which is why it is spelled out rather than
                    // hidden inside the console.
                    self.echo(8);
                    self.echo(' ');
                    self.echo(8);
                }
                return null;
            },

            else => {
                // Printable ASCII and tab. Everything else — escape, the
                // control range, anything with the high bit set — is dropped
                // rather than echoed, because a console that draws a glyph
                // for it puts a character on screen that is not in the line.
                if (c != '\t' and (c < 0x20 or c > 0x7E)) {
                    self.ignored += 1;
                    return null;
                }
                if (self.len == MAX_LINE) {
                    self.dropped += 1;
                    return null;
                }
                self.buf[self.len] = c;
                self.len += 1;
                self.echo(c);
                return null;
            },
        }
    }

    /// Throw away a partly typed line without echoing anything.
    pub fn reset(self: *Editor) void {
        self.len = 0;
    }
};
