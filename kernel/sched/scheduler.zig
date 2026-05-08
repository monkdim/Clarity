//! Preemptive priority round-robin scheduler.
//!
//! Three priority levels (high / normal / idle). Each level has its
//! own runqueue. A timer interrupt every 10 ms calls schedule() —
//! the current thread is preempted, moved to the tail of its queue,
//! and the head of the highest non-empty queue is dispatched.
//!
//! Threads block by removing themselves from the runqueue and
//! pointing at a wait reason; when the reason fires (I/O completes,
//! a child exits, a timer expires), the waker calls wake() to put
//! them back on the runqueue.

const std = @import("std");
const heap = @import("../mm/heap.zig");

pub const Priority = enum(u8) {
    high = 0,
    normal = 1,
    idle = 2,

    pub fn count() usize { return 3; }
};

pub const State = enum(u8) {
    runnable,
    running,
    blocked,
    zombie,
};

pub const WaitReason = union(enum) {
    none,
    io,
    sleep_until: u64,
    waitpid: i32,
    futex: usize,
    channel: usize,
};

pub const Pid = i32;
pub const Tid = i32;

pub const Thread = struct {
    tid: Tid,
    pid: Pid,
    name: []const u8,
    priority: Priority,
    state: State,
    wait: WaitReason = .none,
    rsp: u64 = 0,        // saved kernel stack pointer
    cr3: u64 = 0,        // address space root
    next: ?*Thread = null,
    ticks_run: u64 = 0,
    exit_code: i32 = 0,
};

const Queue = struct {
    head: ?*Thread = null,
    tail: ?*Thread = null,

    fn enqueue(self: *Queue, t: *Thread) void {
        t.next = null;
        if (self.tail) |tail| {
            tail.next = t;
            self.tail = t;
        } else {
            self.head = t;
            self.tail = t;
        }
    }

    fn dequeue(self: *Queue) ?*Thread {
        const t = self.head orelse return null;
        self.head = t.next;
        if (self.head == null) self.tail = null;
        t.next = null;
        return t;
    }

    fn remove(self: *Queue, target: *Thread) bool {
        var prev: ?*Thread = null;
        var cur = self.head;
        while (cur) |t| : ({
            prev = t;
            cur = t.next;
        }) {
            if (t == target) {
                if (prev) |p| p.next = t.next else self.head = t.next;
                if (self.tail == t) self.tail = prev;
                t.next = null;
                return true;
            }
        }
        return false;
    }

    pub fn len(self: *const Queue) usize {
        var n: usize = 0;
        var cur = self.head;
        while (cur) |t| : (cur = t.next) n += 1;
        return n;
    }
};

var queues: [Priority.count()]Queue = .{ .{}, .{}, .{} };
var current: ?*Thread = null;
var next_tid: Tid = 1;
var frozen: bool = false;

pub fn init() void {
    for (&queues) |*q| q.* = .{};
    current = null;
    frozen = false;
}

pub fn freeze() void {
    frozen = true;
}

pub fn spawn_kthread(entry: *const fn () noreturn, name: []const u8, priority: Priority) !*Thread {
    const t = @as(*Thread, @ptrCast(@alignCast(heap.alloc(@sizeOf(Thread)) orelse return error.OutOfMemory)));
    t.* = .{
        .tid = next_tid,
        .pid = 0,
        .name = name,
        .priority = priority,
        .state = .runnable,
    };
    next_tid += 1;
    _ = entry; // TODO: stack setup + arch_thread_init
    queues[@intFromEnum(priority)].enqueue(t);
    return t;
}

pub fn spawn_user(path: []const u8) !*Thread {
    _ = path;
    // TODO: load ELF from VFS, build address space, allocate user stack.
    // Skeleton: returns error.NotImplemented today.
    return error.NotImplemented;
}

pub fn schedule() void {
    if (frozen) return;
    const prev = current;
    if (prev) |p| {
        if (p.state == .running) {
            p.state = .runnable;
            queues[@intFromEnum(p.priority)].enqueue(p);
        }
    }
    var i: usize = 0;
    while (i < Priority.count()) : (i += 1) {
        if (queues[i].dequeue()) |next| {
            next.state = .running;
            current = next;
            // arch_switch_to(next, prev);
            return;
        }
    }
    // Nothing runnable — leave `current` null and the idle loop in
    // main.zig will just halt.
    current = null;
}

pub fn block(reason: WaitReason) void {
    if (current) |c| {
        c.state = .blocked;
        c.wait = reason;
    }
    schedule();
}

pub fn wake(t: *Thread) void {
    if (t.state != .blocked) return;
    t.state = .runnable;
    t.wait = .none;
    queues[@intFromEnum(t.priority)].enqueue(t);
}

pub fn exit(code: i32) noreturn {
    if (current) |c| {
        c.state = .zombie;
        c.exit_code = code;
        // Reaping is the parent's responsibility via waitpid.
    }
    while (true) schedule();
}

pub fn run() noreturn {
    while (true) {
        schedule();
        // The dispatcher returns here when no thread is runnable;
        // hlt-loop until the next interrupt.
        asm volatile ("hlt");
    }
}

pub fn current_thread() ?*Thread {
    return current;
}

pub fn queue_len(p: Priority) usize {
    return queues[@intFromEnum(p)].len();
}
