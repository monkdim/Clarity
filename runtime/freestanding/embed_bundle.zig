//! Embeds the transpiled Clarity stdlib + entry-point bundle into
//! the freestanding runtime binary as `clarity_bundle_js[]`.
//!
//! The build script runs `python3 native/transpile.py --bundle`
//! once, then this file pulls the resulting `clarity-entry.js`
//! from the dist directory at compile time using `@embedFile`.

const std = @import("std");

/// Bundled JS source. Linked into the freestanding binary so we
/// don't need a host fs to load it on first boot.
pub const clarity_bundle_js: []const u8 = @embedFile("../../native/dist/clarity-entry.js");
pub const clarity_bundle_js_len: usize = clarity_bundle_js.len;

/// Symbols the C entry trampoline expects. Re-exported here so the
/// linker can find them with their C-mangled names.
export const clarity_bundle_js_data: [*]const u8 = clarity_bundle_js.ptr;
export const clarity_bundle_js_size: usize = clarity_bundle_js.len;
