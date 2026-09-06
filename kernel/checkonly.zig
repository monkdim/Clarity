//! Everything the kernel builds but does not boot.
//!
//! Zig never parses a file nothing imports, so a module no build reaches is
//! not "written and compiling" — it is written and unread, and could contain
//! anything at all. That was measured rather than supposed: a line of
//! deliberate nonsense appended to each of the files below once produced zero
//! errors from `zig build` and `zig build aarch64` alike.
//!
//! This file is what `zig build check` imports, so they are at least
//! compiled. It is not a claim that any of them works — nothing here has ever
//! executed, and README.md says so under "What does not run yet". It is the
//! smaller claim that they are still valid Zig against the code they refer
//! to, which is what stops them rotting silently while the modules under them
//! change.
//!
//! The first run of this check found one: boot/uefi.zig discarded a parameter
//! with `_ = handle;` and then used `handle` twenty-eight lines later.

comptime {
    _ = @import("drivers/tty.zig");
    _ = @import("fs/devfs.zig");
    _ = @import("fs/procfs.zig");
    _ = @import("boot/uefi.zig");
}
