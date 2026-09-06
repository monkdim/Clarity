//! A text console on a framebuffer.
//!
//! Everything the kernel has said so far went out a serial line. This is what
//! puts it on the screen — and it is written once, over the architecture-
//! independent surface in fb.zig, because a character cell is a character cell
//! on either machine.
//!
//! Deliberately small. There is no cursor to blink, no colour escape, no
//! scrollback: a boot log needs characters, newlines, tabs, backspace and
//! scrolling, and every one of those is a thing that can be got wrong, so the
//! list stops there. Backspace is the newest and the only one that is here
//! for something being typed rather than something being printed.

const fb = @import("fb.zig");
const font = @import("font8x8.zig");

pub const Console = struct {
    surface: fb.Surface,

    /// How many framebuffer pixels one font pixel becomes. 8x8 glyphs at 1:1
    /// on a 1024-wide screen give 128 columns of very small text; at 2 they
    /// give 64 columns that can be read from across a room, which is what a
    /// boot log is for.
    scale: u32,

    cols: u32,
    rows: u32,
    col: u32 = 0,
    row: u32 = 0,

    fg: u32,
    bg: u32,

    /// How many times the picture has been moved up. Counted because it is
    /// the one thing about this console that cannot be seen in a single
    /// screenshot — and because it was, for a while, always zero: the boot
    /// log filled thirty-three rows of forty-eight, so the scroll path had
    /// never run. Reporting the count is what turns that from something
    /// nobody looks at into something the boot log states.
    scrolls: u64 = 0,

    pub fn init(surface: fb.Surface, scale: u32, fg: u32, bg: u32) Console {
        const cw = @as(u32, font.WIDTH) * scale;
        const ch = @as(u32, font.HEIGHT) * scale;
        return .{
            .surface = surface,
            .scale = scale,
            .cols = surface.width / cw,
            .rows = surface.height / ch,
            .fg = fg,
            .bg = bg,
        };
    }

    pub fn clear(self: *Console) void {
        self.surface.clear(self.bg);
        self.col = 0;
        self.row = 0;
    }

    pub fn print(self: *Console, s: []const u8) void {
        for (s) |c| self.put(c);
    }

    pub fn put(self: *Console, c: u8) void {
        switch (c) {
            '\n' => {
                self.col = 0;
                self.next_row();
            },
            '\r' => self.col = 0,
            // Backspace moves the cursor and draws nothing, which is what a
            // terminal does and not what is convenient here. The convenient
            // version — step back and blank the cell — would make this
            // console the only one that erases on its own, so a caller
            // written against it would leave the character behind on every
            // real terminal. Erasing is the caller's business, and it spells
            // it the way everything else does: backspace, space, backspace.
            //
            // Backing up off the left edge lands on the end of the row above,
            // because a line long enough to wrap is still one line to whoever
            // is editing it. Not above the top of the screen, though: those
            // rows have been scrolled away and there is nothing to go back to.
            8 => {
                if (self.col > 0) {
                    self.col -= 1;
                } else if (self.row > 0) {
                    self.row -= 1;
                    self.col = self.cols - 1;
                }
            },
            // Tab stops every eight columns, computed rather than drawn: a tab
            // that drew eight spaces would erase whatever it passed over,
            // which is the wrong answer for a console and the easy one.
            '\t' => {
                const next = (self.col + 8) & ~@as(u32, 7);
                while (self.col < next and self.col < self.cols) : (self.col += 1) {
                    self.blank_cell(self.col, self.row);
                }
                if (self.col >= self.cols) {
                    self.col = 0;
                    self.next_row();
                }
            },
            else => {
                if (self.col >= self.cols) {
                    self.col = 0;
                    self.next_row();
                }
                self.draw(c, self.col, self.row);
                self.col += 1;
            },
        }
    }

    fn next_row(self: *Console) void {
        self.row += 1;
        if (self.row >= self.rows) {
            self.scroll();
            self.row = self.rows - 1;
        }
    }

    /// Move everything up one line and clear the last.
    ///
    /// Pixel by pixel through the surface rather than one big copy, because
    /// the surface's stride need not equal its width — a display controller is
    /// entitled to pad rows, and code that assumes otherwise produces a
    /// picture that shears a little further with every scroll.
    fn scroll(self: *Console) void {
        const ch = @as(u32, font.HEIGHT) * self.scale;
        const last = self.surface.height - ch;
        var y: u32 = 0;
        while (y < last) : (y += 1) {
            var x: u32 = 0;
            while (x < self.surface.width) : (x += 1) {
                self.surface.put(x, y, self.surface.get(x, y + ch));
            }
        }
        self.surface.fill(0, last, self.surface.width, ch, self.bg);
        self.scrolls += 1;
    }

    fn blank_cell(self: *Console, col: u32, row: u32) void {
        const cw = @as(u32, font.WIDTH) * self.scale;
        const ch = @as(u32, font.HEIGHT) * self.scale;
        self.surface.fill(col * cw, row * ch, cw, ch, self.bg);
    }

    fn draw(self: *Console, c: u8, col: u32, row: u32) void {
        const g = font.glyph(c);
        const cw = @as(u32, font.WIDTH) * self.scale;
        const ch = @as(u32, font.HEIGHT) * self.scale;
        const ox = col * cw;
        const oy = row * ch;

        // The background is painted as part of drawing the glyph rather than
        // separately, so a character replacing another leaves nothing of it
        // behind and the cell is written exactly once.
        var gy: u32 = 0;
        while (gy < font.HEIGHT) : (gy += 1) {
            const bits = g[gy];
            var gx: u32 = 0;
            while (gx < font.WIDTH) : (gx += 1) {
                const lit = (bits & (@as(u8, 0x80) >> @intCast(gx))) != 0;
                const colour = if (lit) self.fg else self.bg;
                var sy: u32 = 0;
                while (sy < self.scale) : (sy += 1) {
                    var sx: u32 = 0;
                    while (sx < self.scale) : (sx += 1) {
                        self.surface.put(ox + gx * self.scale + sx, oy + gy * self.scale + sy, colour);
                    }
                }
            }
        }
    }
};
