//! The kernel command line — the first thing this machine can be told.
//!
//! Everything the kernel knew until now it worked out for itself: how much
//! RAM there is, which slots hold devices, whether the CPU has PAN. None of
//! that is a preference. This is the other kind of fact — what the person
//! starting the machine wants it to do — and there was nowhere to put one.
//!
//! It exists because of a specific failure. `read(2)` gives up after a while
//! with nothing typed, because there is no scheduler to block a thread on, and
//! the timeout was three seconds: long enough for a test that types through a
//! monitor socket, and far too short for a person, who has to find the window
//! and click it first. Measured on an M5 Mac: the shell had exited before any
//! key could reach it. Every test passed. The operating system was unusable by
//! hand.
//!
//! The wrong repair is to pick a bigger number and hope it suits both. The
//! right one is to notice that the two callers want different things and that
//! only one of them can say so: a person cannot pass a flag to the machine
//! they are sitting in front of, and a test harness can. So the default is
//! what suits a person, and `tools/` and the boot gate ask for the short one
//! by name.
//!
//! Syntax is `key=value` separated by spaces, which is what every other kernel
//! does and what a bootloader will hand over unchanged. Unknown keys are
//! counted and ignored rather than refused: a command line is written by a
//! person and a kernel that will not boot because of a typo in an option it
//! does not have is worse than one that says it saw something it did not
//! understand.

const fdt = @import("fdt.zig");

/// How long a read waits with nothing typed, in seconds.
///
/// Two minutes. Not a guess at how long somebody takes to start typing —
/// it is how long the machine should sit there before deciding nobody is
/// coming, and for something that ends the session when it fires, that
/// wants to be generously long rather than exactly right.
pub const DEFAULT_IDLE_SECONDS: u32 = 120;

/// The timer runs at 100 Hz, and both waits are counted in its ticks.
const TICKS_PER_SECOND: u64 = 100;

/// A read that never gives up would hang a boot with nobody at the keyboard,
/// which is the thing the timeout exists to prevent — so zero is refused
/// rather than treated as "wait forever".
const MIN_IDLE_SECONDS: u32 = 1;

/// An hour. Past this the number is more likely a typo than an intention,
/// and a boot that hangs for a day because of a stray digit is exactly what
/// this file is trying to stop happening.
const MAX_IDLE_SECONDS: u32 = 3600;

var idle_seconds: u32 = DEFAULT_IDLE_SECONDS;
var from_command_line = false;
var unknown_keys: u32 = 0;
var rejected_values: u32 = 0;

/// Read `/chosen/bootargs`, if the machine gave one.
///
/// Safe to skip: a kernel booted with no device tree, or with one that has no
/// `chosen` node, keeps every default. That is not an error — a bootloader is
/// not obliged to pass anything.
pub fn init(tree: ?fdt.Fdt) void {
    const t = tree orelse return;
    const args = fdt.bootargs(&t) orelse return;
    parse(args);
}

/// Split on spaces and hand each word to `apply`.
///
/// Separate from `init` so it can be driven with a string rather than a
/// machine, which is what makes it possible to check the parsing at all.
pub fn parse(args: []const u8) void {
    var i: usize = 0;
    while (i < args.len) {
        while (i < args.len and is_space(args[i])) i += 1;
        const start = i;
        while (i < args.len and !is_space(args[i])) i += 1;
        if (i > start) apply(args[start..i]);
    }
}

fn is_space(c: u8) bool {
    return c == ' ' or c == '\t' or c == '\r' or c == '\n';
}

fn apply(word: []const u8) void {
    const eq = index_of(word, '=') orelse {
        unknown_keys += 1;
        return;
    };
    const key = word[0..eq];
    const value = word[eq + 1 ..];

    if (str_eq(key, "clarity.idle")) {
        const n = parse_u32(value) orelse {
            rejected_values += 1;
            return;
        };
        if (n < MIN_IDLE_SECONDS or n > MAX_IDLE_SECONDS) {
            rejected_values += 1;
            return;
        }
        idle_seconds = n;
        from_command_line = true;
        return;
    }

    unknown_keys += 1;
}

fn index_of(haystack: []const u8, needle: u8) ?usize {
    for (haystack, 0..) |c, i| if (c == needle) return i;
    return null;
}

fn str_eq(a: []const u8, b: []const u8) bool {
    if (a.len != b.len) return false;
    for (a, b) |x, y| if (x != y) return false;
    return true;
}

/// Decimal only, and no sign. Null for anything else, including an empty
/// string and anything that would overflow — a value that does not parse is
/// reported rather than turned into a number that was never written down.
fn parse_u32(text: []const u8) ?u32 {
    if (text.len == 0) return null;
    var out: u32 = 0;
    for (text) |c| {
        if (c < '0' or c > '9') return null;
        const digit: u32 = c - '0';
        if (out > (0xFFFF_FFFF - digit) / 10) return null;
        out = out * 10 + digit;
    }
    return out;
}

/// What a read should wait, in timer ticks.
pub fn idle_ticks() u64 {
    return @as(u64, idle_seconds) * TICKS_PER_SECOND;
}

pub fn idle() u32 {
    return idle_seconds;
}

/// " s" or " second", so the boot log reads as English at 1 as well as 120.
pub fn idle_unit() []const u8 {
    return if (idle_seconds == 1) " second idle" else " seconds idle";
}

/// The same number as prose, for a prompt rather than a report.
pub fn idle_unit_plain() []const u8 {
    return if (idle_seconds == 1) " second of quiet ends the read" else " seconds of quiet ends the read";
}

/// Whether the number above was asked for or merely defaulted to.
///
/// The boot log prints this, so that a command line the kernel silently
/// failed to read looks different from one it never had. Without it a broken
/// parser and an absent `-append` produce the same line.
pub fn was_given() bool {
    return from_command_line;
}

pub fn ignored() u32 {
    return unknown_keys;
}

pub fn rejected() u32 {
    return rejected_values;
}

/// Put every default back, so a test can parse more than one command line.
pub fn reset() void {
    idle_seconds = DEFAULT_IDLE_SECONDS;
    from_command_line = false;
    unknown_keys = 0;
    rejected_values = 0;
}
