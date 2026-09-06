//! Key events into characters.
//!
//! virtio-input reports Linux input event codes. Over the main block those
//! are the AT set-1 scancodes unchanged — KEY_ESC is 1, KEY_A is 30, space
//! is 57 — which is why the two numbering schemes need no translation here
//! and would above it.
//!
//! The table is written out rather than computed because there is no rule to
//! compute: the layout is a historical artefact of a keyboard from 1984.
//!
//! Only the main block. Function keys, the numeric keypad, the arrows and
//! the modifiers beyond shift are absent because nothing reads them yet, and
//! a table full of entries no test has ever produced is a table full of
//! guesses.
//!
//! This is not a second copy of something on the x86 side. `drivers/ps2.zig`
//! hands out raw set-1 scancodes and has no table at all — nothing there
//! turns a key into a character yet, so when it does, this is what it should
//! share rather than the other way round.

const input = @import("virtio_input.zig");

const KEY_LEFTSHIFT: u16 = 42;
const KEY_RIGHTSHIFT: u16 = 54;

/// Linux keycode → the character it types, unshifted and shifted. Index is
/// the keycode; a zero means "this key types nothing".
const MAP = blk: {
    var m: [58][2]u8 = [_][2]u8{.{ 0, 0 }} ** 58;
    const rows = .{
        .{ 1, "\x1B\x1B" }, // escape
        .{ 2, "1!" },   .{ 3, "2@" },   .{ 4, "3#" },   .{ 5, "4$" },
        .{ 6, "5%" },   .{ 7, "6^" },   .{ 8, "7&" },   .{ 9, "8*" },
        .{ 10, "9(" },  .{ 11, "0)" },  .{ 12, "-_" },  .{ 13, "=+" },
        .{ 14, "\x08\x08" }, // backspace
        .{ 15, "\t\t" },
        .{ 16, "qQ" },  .{ 17, "wW" },  .{ 18, "eE" },  .{ 19, "rR" },
        .{ 20, "tT" },  .{ 21, "yY" },  .{ 22, "uU" },  .{ 23, "iI" },
        .{ 24, "oO" },  .{ 25, "pP" },  .{ 26, "[{" },  .{ 27, "]}" },
        .{ 28, "\n\n" }, // enter
        .{ 30, "aA" },  .{ 31, "sS" },  .{ 32, "dD" },  .{ 33, "fF" },
        .{ 34, "gG" },  .{ 35, "hH" },  .{ 36, "jJ" },  .{ 37, "kK" },
        .{ 38, "lL" },  .{ 39, ";:" },  .{ 40, "'\"" }, .{ 41, "`~" },
        .{ 43, "\\|" },
        .{ 44, "zZ" },  .{ 45, "xX" },  .{ 46, "cC" },  .{ 47, "vV" },
        .{ 48, "bB" },  .{ 49, "nN" },  .{ 50, "mM" },  .{ 51, ",<" },
        .{ 52, ".>" },  .{ 53, "/?" },  .{ 57, "  " },
    };
    for (rows) |r| {
        m[r[0]] = .{ r[1][0], r[1][1] };
    }
    break :blk m;
};

var shift_held: bool = false;

/// How many key presses have been seen, whether or not they typed anything.
/// Counted so a keyboard that is delivering events for keys with no character
/// can be told from one that is delivering nothing at all.
pub var presses: u64 = 0;

/// The next character typed, or null if nothing is waiting.
///
/// Key *releases* are consumed and produce nothing, except for shift, whose
/// release is the only reason this function has any state at all.
pub fn poll() ?u8 {
    while (input.poll()) |ev| {
        if (ev.type != input.EV_KEY) continue;

        // value 1 is a press, 2 a repeat, 0 a release.
        const down = ev.value != 0;
        if (ev.code == KEY_LEFTSHIFT or ev.code == KEY_RIGHTSHIFT) {
            shift_held = down;
            continue;
        }
        if (!down) continue;
        presses += 1;

        if (ev.code >= MAP.len) continue;
        const c = MAP[ev.code][if (shift_held) 1 else 0];
        if (c != 0) return c;
    }
    return null;
}
