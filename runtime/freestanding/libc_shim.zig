//! Tiny libc surface that QuickJS calls into. We don't link a real
//! libc on bare metal — this file provides the functions that
//! actually get touched at runtime, routed where appropriate to
//! kernel syscalls via `host_shim.zig`.
//!
//! Intentionally minimal: the goal isn't a POSIX libc, it's "just
//! enough to make QuickJS run." Anything QuickJS doesn't call goes
//! unimplemented; if you discover a missing symbol while linking,
//! add it here.

const std = @import("std");
const shim = @import("host_shim.zig");

// ── Memory ───────────────────────────────────────

const HEAP_SIZE: usize = 16 * 1024 * 1024;             // 16 MiB userspace heap
var heap_arena: [HEAP_SIZE]u8 align(16) = undefined;
var heap_cursor: usize = 0;

/// Bump allocator backed by `heap_arena`. QuickJS's allocator
/// abstraction is plugged in via JS_NewRuntime2 with a custom
/// JSMallocFunctions; we don't actually need free() to do anything
/// useful for a JIT-less single-context runtime, but we still
/// expose it so any third-party code that links here gets a no-op.
export fn malloc(size: usize) callconv(.C) ?*anyopaque {
    const aligned = (size + 15) & ~@as(usize, 15);
    if (heap_cursor + aligned > HEAP_SIZE) return null;
    const ptr = &heap_arena[heap_cursor];
    heap_cursor += aligned;
    return @ptrCast(ptr);
}

export fn free(_: ?*anyopaque) callconv(.C) void {
    // Bump allocator: no per-allocation free. Replace with a real
    // allocator when QuickJS's working set outgrows 16 MiB.
}

export fn calloc(count: usize, size: usize) callconv(.C) ?*anyopaque {
    const total = count * size;
    const ptr = malloc(total) orelse return null;
    const bytes: [*]u8 = @ptrCast(ptr);
    @memset(bytes[0..total], 0);
    return ptr;
}

export fn realloc(p: ?*anyopaque, new_size: usize) callconv(.C) ?*anyopaque {
    // Bump allocator can't grow in place; allocate fresh + copy.
    if (p == null) return malloc(new_size);
    const fresh = malloc(new_size) orelse return null;
    // We don't track old sizes, so copy `new_size` bytes — slightly
    // wrong for shrinks (over-reads from old block) but safe for
    // bump where the old block is still mapped.
    const src: [*]const u8 = @ptrCast(p.?);
    const dst: [*]u8 = @ptrCast(fresh);
    @memcpy(dst[0..new_size], src[0..new_size]);
    return fresh;
}

// ── String / memory primitives ──────────────────

export fn memcpy(dst: [*]u8, src: [*]const u8, n: usize) callconv(.C) [*]u8 {
    @memcpy(dst[0..n], src[0..n]);
    return dst;
}

export fn memmove(dst: [*]u8, src: [*]const u8, n: usize) callconv(.C) [*]u8 {
    if (@intFromPtr(dst) < @intFromPtr(src)) {
        var i: usize = 0;
        while (i < n) : (i += 1) dst[i] = src[i];
    } else {
        var i: usize = n;
        while (i > 0) {
            i -= 1;
            dst[i] = src[i];
        }
    }
    return dst;
}

export fn memset(dst: [*]u8, value: i32, n: usize) callconv(.C) [*]u8 {
    @memset(dst[0..n], @truncate(@as(u32, @bitCast(value))));
    return dst;
}

export fn memcmp(a: [*]const u8, b: [*]const u8, n: usize) callconv(.C) i32 {
    var i: usize = 0;
    while (i < n) : (i += 1) {
        if (a[i] != b[i]) return @as(i32, a[i]) - @as(i32, b[i]);
    }
    return 0;
}

export fn strlen(s: [*:0]const u8) callconv(.C) usize {
    var n: usize = 0;
    while (s[n] != 0) : (n += 1) {}
    return n;
}

export fn strcmp(a: [*:0]const u8, b: [*:0]const u8) callconv(.C) i32 {
    var i: usize = 0;
    while (a[i] != 0 and a[i] == b[i]) : (i += 1) {}
    return @as(i32, a[i]) - @as(i32, b[i]);
}

export fn strncmp(a: [*:0]const u8, b: [*:0]const u8, n: usize) callconv(.C) i32 {
    var i: usize = 0;
    while (i < n and a[i] != 0 and a[i] == b[i]) : (i += 1) {}
    if (i == n) return 0;
    return @as(i32, a[i]) - @as(i32, b[i]);
}

export fn strchr(s: [*:0]const u8, c: i32) callconv(.C) ?[*:0]const u8 {
    var i: usize = 0;
    const target: u8 = @truncate(@as(u32, @bitCast(c)));
    while (s[i] != 0) : (i += 1) if (s[i] == target) return s + i;
    if (target == 0) return s + i;
    return null;
}

// ── Stdio (routed to kernel write syscall via host_shim) ─

export fn write(fd: i32, buf: [*]const u8, len: usize) callconv(.C) i64 {
    return shim.claritos_write(fd, buf, len);
}

export fn read(fd: i32, buf: [*]u8, len: usize) callconv(.C) i64 {
    return shim.claritos_read(fd, buf, len);
}

// ── Errno ────────────────────────────────────────

var _errno: i32 = 0;
export fn __errno_location() callconv(.C) *i32 { return &_errno; }

// ── Assertions / aborts ──────────────────────────

export fn __assert_fail(expr: [*:0]const u8, file: [*:0]const u8, line: u32, func: [*:0]const u8) callconv(.C) noreturn {
    const msg = "[claritos libc_shim] assertion failed: ";
    _ = shim.claritos_write(2, msg, msg.len);
    _ = shim.claritos_write(2, expr, strlen(expr));
    _ = shim.claritos_write(2, " (", 2);
    _ = shim.claritos_write(2, file, strlen(file));
    _ = shim.claritos_write(2, ":", 1);
    var num_buf: [16]u8 = undefined;
    const n = u32_to_decimal(line, &num_buf);
    _ = shim.claritos_write(2, &num_buf, n);
    _ = shim.claritos_write(2, " ", 1);
    _ = shim.claritos_write(2, func, strlen(func));
    _ = shim.claritos_write(2, ")\n", 2);
    shim.claritos_exit(134);
}

export fn abort() callconv(.C) noreturn {
    shim.claritos_exit(134);
}

fn u32_to_decimal(value: u32, out: *[16]u8) usize {
    if (value == 0) { out[0] = '0'; return 1; }
    var v = value;
    var tmp: [16]u8 = undefined;
    var n: usize = 0;
    while (v > 0) : (v /= 10) {
        tmp[n] = @intCast('0' + v % 10);
        n += 1;
    }
    var i: usize = 0;
    while (i < n) : (i += 1) out[i] = tmp[n - 1 - i];
    return n;
}

// ── Time ────────────────────────────────────────

export fn clock() callconv(.C) i64 {
    // POSIX-flavoured: returns an opaque clock count. We bridge to
    // the kernel's monotonic ns counter and return it directly;
    // the conversion to seconds is the caller's problem.
    return shim.claritos_clock_gettime();
}
