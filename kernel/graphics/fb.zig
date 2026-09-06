//! Drawing into a linear framebuffer.
//!
//! Deliberately knows nothing about how the framebuffer was obtained. On
//! QEMU's `virt` machine it comes from ramfb; on real Apple hardware it will
//! come from m1n1; on the x86 side it will come from the multiboot2 boot
//! information. All three hand over the same four facts — an address, a
//! width, a height, and a stride — so everything above this line is written
//! once.
//!
//! Pixels are XRGB8888: one 32-bit word per pixel, 0x00RRGGBB.

pub const Surface = struct {
    base: u64,
    width: u32,
    height: u32,
    stride: u32,

    fn row(self: Surface, y: u32) [*]volatile u32 {
        return @ptrFromInt(self.base + @as(u64, y) * self.stride);
    }

    /// Set one pixel. Out-of-bounds coordinates are ignored rather than
    /// wrapping onto the next row, which is what makes a clipped rectangle
    /// safe to draw instead of a diagonal smear.
    pub fn put(self: Surface, x: u32, y: u32, colour: u32) void {
        if (x >= self.width or y >= self.height) return;
        self.row(y)[x] = colour;
    }

    /// Read a pixel back. The self-test uses this: writing to memory proves
    /// nothing about whether the memory is the screen.
    pub fn get(self: Surface, x: u32, y: u32) u32 {
        if (x >= self.width or y >= self.height) return 0;
        return self.row(y)[x] & 0x00FF_FFFF;
    }

    pub fn clear(self: Surface, colour: u32) void {
        var y: u32 = 0;
        while (y < self.height) : (y += 1) {
            const r = self.row(y);
            var x: u32 = 0;
            while (x < self.width) : (x += 1) r[x] = colour;
        }
    }

    /// Fill a rectangle, clipped to the surface. Width and height are counts,
    /// so a zero-sized rectangle draws nothing rather than one stray pixel.
    pub fn fill(self: Surface, x0: u32, y0: u32, w: u32, h: u32, colour: u32) void {
        if (w == 0 or h == 0 or x0 >= self.width or y0 >= self.height) return;
        const x1 = @min(x0 + w, self.width);
        const y1 = @min(y0 + h, self.height);
        var y = y0;
        while (y < y1) : (y += 1) {
            const r = self.row(y);
            var x = x0;
            while (x < x1) : (x += 1) r[x] = colour;
        }
    }

    /// A one-pixel outline. Drawn as four fills so the corners are covered
    /// exactly once each.
    pub fn frame(self: Surface, x0: u32, y0: u32, w: u32, h: u32, t: u32, colour: u32) void {
        if (w <= 2 * t or h <= 2 * t) return;
        self.fill(x0, y0, w, t, colour);
        self.fill(x0, y0 + h - t, w, t, colour);
        self.fill(x0, y0, t, h, colour);
        self.fill(x0 + w - t, y0, t, h, colour);
    }
};

// A small palette, named so the test pattern and its assertions cannot drift
// apart: both sides refer to the same constant.
pub const SLATE: u32 = 0x0011_1A20;
pub const SIGNAL: u32 = 0x000E_6F9E;
pub const RED: u32 = 0x00FF_0000;
pub const GREEN: u32 = 0x0000_FF00;
pub const BLUE: u32 = 0x0000_00FF;
pub const WHITE: u32 = 0x00FF_FFFF;
