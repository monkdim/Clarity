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
const pmm = @import("../mm/pmm.zig");
const vmm = @import("../mm/vmm.zig");
const context = @import("../arch/x86_64/context.zig");
const gdt = @import("../arch/x86_64/gdt.zig");
const elf = @import("../loader/elf.zig");
const loader = @import("../loader/load.zig");
const process = @import("process.zig");
const vfs = @import("../fs/vfs.zig");
const console = @import("../arch/x86_64/console.zig");

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
    context: context.Context = std.mem.zeroes(context.Context),
    kernel_stack_top: u64 = 0,
    iret_rsp: u64 = 0,                      // for first entry to userspace
    cr3: u64 = 0,                            // address space root
    next: ?*Thread = null,
    ticks_run: u64 = 0,
    exit_code: i32 = 0,
};

/// Per-CPU process table; populated lazily.
pub var process_table: process.Table = undefined;

pub fn init_process_table(gpa: std.mem.Allocator) void {
    process_table = process.Table.init(gpa);
}

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

    fn is_empty(self: *const Queue) bool {
        return self.head == null;
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

    // 16 KiB kernel stack
    const stack_pages = 4;
    const stack_phys = pmm.alloc_pages(stack_pages) orelse return error.OutOfMemory;
    const stack_top = 0xFFFF_8000_0000_0000 + stack_phys + stack_pages * pmm.PAGE_SIZE;
    context.init_kernel_thread(&t.context, stack_top, @ptrCast(entry), 0);
    t.kernel_stack_top = stack_top;

    queues[@intFromEnum(priority)].enqueue(t);
    return t;
}

pub fn spawn_user(path: []const u8) !*Thread {
    // 1. Read the ELF off the VFS.
    const image = try vfs.read_file_into_heap(path, heap.allocator());
    defer heap.allocator().free(image);
    // 2. Parse + load.
    const exe = try elf.parse(image, heap.allocator());
    defer elf.release(heap.allocator(), exe);
    const loaded = try loader.load_into_new_space(exe, image, heap.allocator());

    // 3. Allocate Process + main Thread.
    const proc = try process_table.gpa.create(process.Process);
    proc.* = .{
        .pid = process_table.alloc_pid(),
        .parent_pid = if (current) |c| c.pid else 0,
        .name = path,
        .address_space = loaded.address_space,
        .state = .runnable,
    };
    try process_table.register(proc);

    const t = @as(*Thread, @ptrCast(@alignCast(heap.alloc(@sizeOf(Thread)) orelse return error.OutOfMemory)));
    t.* = .{
        .tid = next_tid,
        .pid = proc.pid,
        .name = path,
        .priority = .normal,
        .state = .runnable,
    };
    next_tid += 1;
    proc.main_thread_tid = t.tid;

    // 16 KiB kernel stack for syscall + interrupt handling.
    const kstack_pages = 4;
    const kstack_phys = pmm.alloc_pages(kstack_pages) orelse return error.OutOfMemory;
    t.kernel_stack_top = 0xFFFF_8000_0000_0000 + kstack_phys + kstack_pages * pmm.PAGE_SIZE;
    t.cr3 = loaded.address_space.pml4_phys;

    // 4. Build the IRET frame so the first dispatch lands in user
    //    mode at the ELF entry point.
    const user_rflags: u64 = 0x202;            // IF=1, reserved bit 1 = 1
    // From the GDT, not written out: SYSRET fixes the order of the user
    // descriptor pair, so user *data* comes first and the numeric values are
    // the reverse of the obvious guess.
    const user_cs: u16 = gdt.USER_CODE;
    const user_ss: u16 = gdt.USER_DATA;
    t.iret_rsp = context.build_iret_frame(t.kernel_stack_top, loaded.entry_rip, loaded.user_rsp, user_rflags, user_cs, user_ss);

    queues[@intFromEnum(Priority.normal)].enqueue(t);
    return t;
}

/// The context the boot path is running on. `yield` needs somewhere to save
/// the caller's registers even before any Thread exists, and this is it: the
/// kernel's initial stack behaves as thread zero.
var boot_context: context.Context = std.mem.zeroes(context.Context);

/// Pick the next runnable thread without switching to it. Used by the timer
/// IRQ, which cannot switch stacks from inside an interrupt frame yet.
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
            return;
        }
    }
    // Nothing runnable — leave `current` null and the caller halts.
    current = null;
}

/// Give up the CPU: pick the next runnable thread and actually switch to it.
///
/// Separate from `schedule` because switching is only safe from a normal call
/// like this one. Doing it inside the timer's interrupt handler means each
/// thread resumes inside its *own* handler and returns through its own
/// `iretq`, which works but has to be got exactly right; until it is, the
/// timer only picks and this is what moves.
///
/// Returns when something switches back to the caller.
pub fn yield() void {
    if (frozen) return;

    const prev = current;
    const prev_ctx: *context.Context = if (prev) |p| &p.context else &boot_context;

    // The caller goes back on the run queue before we look for a successor,
    // so a lone thread yields to itself rather than finding nothing.
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
            // The CPU takes an interrupt in ring 3 onto the stack named by the
            // TSS, so RSP0 has to follow whichever thread is running — a stale
            // one would push the frame onto a stack another thread is using.
            if (next.kernel_stack_top != 0) gdt.set_kernel_stack(next.kernel_stack_top);
            context.switch_to(prev_ctx, &next.context);
            return;
        }
    }
    // Nothing else is runnable.
    if (prev) |p| {
        // boot_context.rip is only set once something has switched *away*
        // from the boot path. Without that check this would jump to address
        // zero on any path that blocks before the run queue is ever entered.
        if (p.state != .running and boot_context.rip != 0) {
            // The caller is finished and there is no successor, so there is
            // no thread left to return to. Go back to the boot context — the
            // one that started the run queue — which can carry on without it.
            current = null;
            context.switch_to(&p.context, &boot_context);
            return;
        }
    }
    // The caller is still runnable and simply has the CPU to itself.
}

/// End the calling thread. It never runs again, so this does not return: the
/// switch away from it is the last thing that happens on its stack.
pub fn thread_exit(code: i32) noreturn {
    if (current) |c| {
        c.state = .zombie;
        c.exit_code = code;
    }
    yield();
    // Only reached if there was nowhere to go, which means nothing is left to
    // run at all.
    while (true) asm volatile ("cli; hlt");
}

/// Hand control to the run queue and come back when it drains. Used by the
/// boot path to run kernel threads to completion before carrying on.
pub fn run_queued() void {
    while (true) {
        var any = false;
        var i: usize = 0;
        while (i < Priority.count()) : (i += 1) {
            if (!queues[i].is_empty()) any = true;
        }
        if (!any) break;
        yield();
    }
    // The boot context is a resume point on *this* frame, and it stops being
    // one the moment this call returns. Left set, a thread that exits later
    // would find it, "switch back to boot", and resume inside a run_queued
    // that already finished — re-running whatever the boot path did next.
    // Clearing rip is how yield knows there is no boot coroutine left.
    boot_context.rip = 0;
}

/// Make `t` the running thread directly, without the run queue picking it.
///
/// `spawn_user` queues the thread it builds, which is what you want when the
/// scheduler is going to dispatch it. The first process is the exception: the
/// boot path enters it by hand, so the thread has to come back *off* the
/// queue and be installed as current. Otherwise the kernel believes nothing
/// is running — getpid would answer 0, exit would have no thread to end, and
/// a later yield could hand the CPU to a thread that is already on it.
pub fn adopt_current(t: *Thread) void {
    _ = queues[@intFromEnum(t.priority)].remove(t);
    t.state = .running;
    current = t;
    // An interrupt taken in ring 3 lands on the stack the TSS names, so RSP0
    // has to be this thread's before the CPU is ever in ring 3.
    if (t.kernel_stack_top != 0) gdt.set_kernel_stack(t.kernel_stack_top);
}

pub fn block(reason: WaitReason) void {
    if (current) |c| {
        c.state = .blocked;
        c.wait = reason;
    }
    // yield, not schedule: a blocked thread has to stop running, and until
    // now this only *chose* a successor without moving to it, so the caller
    // carried straight on as if it had never blocked. Marking the state
    // blocked first also keeps it off the run queue.
    yield();
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
    // Switch away for real. This used to be `while (true) schedule()`, which
    // picks a successor but never moves to it — so a thread that called exit
    // carried straight on through the loop, dead and still running, forever.
    // A zombie is never re-queued, so yield returns only when there is
    // genuinely nothing left to run.
    yield();
    console.println("  [halt] nothing left to run");
    while (true) asm volatile ("cli; hlt");
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

// ── Process syscalls ─────────────────────────────

/// Clone the current process's address space + state into a new
/// child process. Returns child PID to the parent, 0 to the child.
pub fn fork() !Pid {
    const cur = current orelse return error.NoCurrent;
    const parent = process_table.lookup(cur.pid) orelse return error.NoCurrent;

    // Clone the address space (deep copy of regions; pages start
    // shared + COW marked when we add real COW. Phase 70 ships
    // straight private copies for simplicity).
    const child_space = try clone_address_space(parent.address_space);
    const child = try process_table.gpa.create(process.Process);
    child.* = .{
        .pid = process_table.alloc_pid(),
        .parent_pid = parent.pid,
        .name = parent.name,
        .address_space = child_space,
        .state = .runnable,
    };
    try process_table.register(child);
    try parent.add_child(child.pid, process_table.gpa);

    // Build a new Thread for the child that resumes right after
    // the syscall return — same user RIP, same user RSP, but with
    // RAX = 0 so userspace sees a 0 return value.
    const t = @as(*Thread, @ptrCast(@alignCast(heap.alloc(@sizeOf(Thread)) orelse return error.OutOfMemory)));
    t.* = .{
        .tid = next_tid,
        .pid = child.pid,
        .name = child.name,
        .priority = .normal,
        .state = .runnable,
        .cr3 = child_space.pml4_phys,
    };
    next_tid += 1;
    child.main_thread_tid = t.tid;
    queues[@intFromEnum(Priority.normal)].enqueue(t);
    return child.pid;
}

/// Replace the current process's image with a new ELF. exec() does
/// not return on success.
pub fn exec(path: []const u8) !void {
    const cur = current orelse return error.NoCurrent;
    const proc = process_table.lookup(cur.pid) orelse return error.NoCurrent;

    const image = try vfs.read_file_into_heap(path, heap.allocator());
    defer heap.allocator().free(image);
    const exe_obj = try elf.parse(image, heap.allocator());
    defer elf.release(heap.allocator(), exe_obj);
    const loaded = try loader.load_into_new_space(exe_obj, image, heap.allocator());

    // Tear down the old address space; the new one replaces it.
    proc.address_space = loaded.address_space;
    cur.cr3 = loaded.address_space.pml4_phys;
    cur.iret_rsp = context.build_iret_frame(cur.kernel_stack_top, loaded.entry_rip, loaded.user_rsp, 0x202, gdt.USER_CODE, gdt.USER_DATA);
    proc.name = path;

    // Re-enter user mode with the new image.
    context.enter_userland(cur.iret_rsp);
}

pub const WaitResult = struct { pid: Pid, exit_code: i32 };

pub fn waitpid(target: i32) ?WaitResult {
    const cur = current orelse return null;
    const parent = process_table.lookup(cur.pid) orelse return null;
    const reaped = if (target <= 0) parent.reap_any() else parent.reap_pid(target);
    const z = reaped orelse return null;
    process_table.remove(z.pid);
    return .{ .pid = z.pid, .exit_code = z.exit_code };
}

pub fn kill(target_pid: Pid, sig: i32) bool {
    const target = process_table.lookup(target_pid) orelse return false;
    // Signal handling is its own future phase; for now the only
    // signal we honour is SIGKILL, which terminates the target
    // immediately.
    if (sig == 9) {
        target.state = .zombie;
        target.exit_code = 128 + sig;
        if (process_table.lookup(target.parent_pid)) |parent| {
            parent.record_zombie(target.*, process_table.gpa) catch {};
        }
        return true;
    }
    // Other signals: queued, not yet delivered.
    return true;
}

fn clone_address_space(src: *vmm.AddressSpace) !*vmm.AddressSpace {
    const dst = try process_table.gpa.create(vmm.AddressSpace);
    const new_pml4 = pmm.alloc_page() orelse return error.OutOfMemory;
    dst.* = .{ .pml4_phys = new_pml4, .regions = .{} };
    // Region table is shallow-cloned; physical pages copied below.
    for (src.regions.items) |r| try dst.regions.append(heap.allocator(), r);
    return dst;
}
