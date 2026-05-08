//! Bytecode interpreter — the main loop for the native Clarity VM.
//!
//! Stack machine; each frame is a {function, ip, stack_base, locals}
//! tuple. Constants live in the function's pool and are referenced
//! by index. The full opcode table is in opcode.zig, the value
//! representation in value.zig, and GC in gc.zig.
//!
//! Skeleton: dispatch is wired but most opcodes return
//! error.NotImplemented today. The compiler in stdlib/bytecode.clarity
//! is the canonical encoding; this file decodes the same bytes.

const std = @import("std");
const opcode = @import("opcode.zig");
const value = @import("value.zig");
const gc = @import("gc.zig");

pub const Vm = struct {
    stack: [4096]value.Value = undefined,
    sp: usize = 0,
    frames: [256]Frame = undefined,
    fp: usize = 0,
    heap: gc.Heap,

    pub const Frame = struct {
        function: *value.Function,
        ip: usize,
        stack_base: usize,
    };

    pub fn init() !Vm {
        return Vm{ .heap = try gc.Heap.init() };
    }

    pub fn deinit(self: *Vm) void { self.heap.deinit(); }

    pub fn load_bundle(self: *Vm, bytes: [*]const u8, len: usize) !void {
        _ = self;
        _ = bytes;
        _ = len;
        // TODO: parse the constant pool + top-level function
        // produced by stdlib/bytecode.clarity's serialiser, allocate
        // the entry function on the heap, push the initial frame.
        return error.NotImplemented;
    }

    pub fn run(self: *Vm) !i32 {
        while (self.fp > 0) {
            const frame = &self.frames[self.fp - 1];
            const code = frame.function.code;
            const op = @as(opcode.Opcode, @enumFromInt(code[frame.ip]));
            frame.ip += 1;
            try self.dispatch(frame, op);
        }
        // Convention: the top of stack at frame 0 return is the exit code.
        if (self.sp > 0) {
            switch (self.stack[self.sp - 1]) {
                .int => |i| return @intCast(i),
                else => return 0,
            }
        }
        return 0;
    }

    fn dispatch(self: *Vm, frame: *Frame, op: opcode.Opcode) !void {
        switch (op) {
            .halt => self.fp = 0,
            .pop => {
                if (self.sp == 0) return error.StackUnderflow;
                self.sp -= 1;
            },
            .dup => {
                if (self.sp == 0) return error.StackUnderflow;
                self.stack[self.sp] = self.stack[self.sp - 1];
                self.sp += 1;
            },
            .null_ => self.push(.{ .null = {} }),
            .true_ => self.push(.{ .bool = true }),
            .false_ => self.push(.{ .bool = false }),
            .add, .sub, .mul, .div, .mod => try self.binop(op),
            .eq, .neq, .lt, .gt, .lte, .gte => try self.cmpop(op),
            .jump => {
                const target = read_u32(frame.function.code, frame.ip);
                frame.ip = target;
            },
            .jump_false => {
                const target = read_u32(frame.function.code, frame.ip);
                frame.ip += 4;
                if (self.sp == 0) return error.StackUnderflow;
                self.sp -= 1;
                if (!value.truthy(self.stack[self.sp])) frame.ip = target;
            },
            else => return error.NotImplemented,
        }
    }

    fn push(self: *Vm, v: value.Value) void {
        self.stack[self.sp] = v;
        self.sp += 1;
    }

    fn binop(self: *Vm, op: opcode.Opcode) !void {
        if (self.sp < 2) return error.StackUnderflow;
        const b = self.stack[self.sp - 1];
        const a = self.stack[self.sp - 2];
        self.sp -= 2;
        const result: value.Value = switch (a) {
            .int => |ai| switch (b) {
                .int => |bi| switch (op) {
                    .add => .{ .int = ai + bi },
                    .sub => .{ .int = ai - bi },
                    .mul => .{ .int = ai * bi },
                    .div => if (bi == 0) .{ .int = 0 } else .{ .int = @divTrunc(ai, bi) },
                    .mod => if (bi == 0) .{ .int = 0 } else .{ .int = @mod(ai, bi) },
                    else => return error.BadOpcode,
                },
                else => return error.TypeError,
            },
            else => return error.TypeError,
        };
        self.push(result);
    }

    fn cmpop(self: *Vm, op: opcode.Opcode) !void {
        if (self.sp < 2) return error.StackUnderflow;
        const b = self.stack[self.sp - 1];
        const a = self.stack[self.sp - 2];
        self.sp -= 2;
        const r = switch (op) {
            .eq => value.equal(a, b),
            .neq => !value.equal(a, b),
            .lt, .gt, .lte, .gte => switch (a) {
                .int => |ai| switch (b) {
                    .int => |bi| switch (op) {
                        .lt => ai < bi,
                        .gt => ai > bi,
                        .lte => ai <= bi,
                        .gte => ai >= bi,
                        else => unreachable,
                    },
                    else => return error.TypeError,
                },
                else => return error.TypeError,
            },
            else => unreachable,
        };
        self.push(.{ .bool = r });
    }

    fn read_u32(code: []const u8, off: usize) usize {
        return @as(usize, code[off]) |
            (@as(usize, code[off + 1]) << 8) |
            (@as(usize, code[off + 2]) << 16) |
            (@as(usize, code[off + 3]) << 24);
    }
};
