//! A keyboard, over virtio-input.
//!
//! QEMU's `virt` machine has no PS/2 controller — the thing the x86 side
//! reads — so a key press arrives as a virtio-input event on the MMIO bus.
//! The same is true of Apple Silicon, where there is no legacy controller
//! either, so this is the shape the eventual real driver takes rather than a
//! detour around one.
//!
//! One virtqueue, the event queue, filled with eight-byte buffers the device
//! writes into. The split-queue layout is virtio 1.1 §2.6: a descriptor
//! table the driver writes, an available ring the driver writes and the
//! device reads, and a used ring the other way round.
//!
//! Polled rather than interrupt-driven, which is a decision to revisit and
//! not a finished one. Routing the virtio slots' interrupts means reading
//! the GIC mapping out of the device tree, and the caller today is a boot
//! selftest spinning on nothing else — so the queue is the part worth
//! getting right first, and this way there is one new moving part rather
//! than two.

const mmio = @import("virtio_mmio.zig");
const vm = @import("vm.zig");

/// How many events the device can leave here before the driver looks again.
///
/// Sixty-four rather than eight, and the difference is not "bigger is safer".
/// QEMU turns one key into four events — press, sync, release, sync — so the
/// queue bounds key presses at a quarter of its size, and eight bounded them
/// at six. That was measured: typing seven keys read back six.
///
/// Depth is not what makes the driver correct, though; poll() giving each
/// buffer back is. A queue of any size only postpones the same failure,
/// which is why tools/key_check.py sends more than three times QUEUE_SIZE
/// events through it — a test short enough to fit in the ring passes either
/// way.
const QUEUE_SIZE: u16 = 64;

/// virtio 1.1 §5.8.6. Little-endian, like everything else in virtio.
pub const Event = extern struct {
    type: u16,
    code: u16,
    value: u32,
};

/// The only event type this kernel acts on. The device also sends EV_SYN
/// (0) after each key to mark the end of a batch, and keyboard.zig drops it
/// along with everything else that is not a key.
pub const EV_KEY: u16 = 0x01;

const Desc = extern struct {
    addr: u64,
    len: u32,
    flags: u16,
    next: u16,
};

const DESC_F_WRITE: u16 = 2; // the device writes into this buffer

const Avail = extern struct {
    flags: u16,
    idx: u16,
    ring: [QUEUE_SIZE]u16,
    used_event: u16,
};

const UsedElem = extern struct {
    id: u32,
    len: u32,
};

const Used = extern struct {
    flags: u16,
    idx: u16,
    ring: [QUEUE_SIZE]UsedElem,
    avail_event: u16,
};

// One contiguous, page-aligned region holding all three rings.
//
// That layout is what the legacy transport requires — it is given a single
// page frame number and finds the rings at fixed offsets inside, with the
// used ring aligned to QueueAlign. The modern transport takes the three
// addresses separately and does not care how they are arranged, so using the
// legacy layout for both means one buffer and one set of offsets rather than
// two of each.
//
//   0      descriptor table   16 bytes each
//   128    available ring
//   4096   used ring          (aligned to QUEUE_ALIGN)
//
// Static, in .bss, because the device reads it by physical address and a page
// the allocator might later hand to something else is not somewhere to put
// it.
const QUEUE_ALIGN: usize = 4096;
const DESC_OFF: usize = 0;
const AVAIL_OFF: usize = @sizeOf(Desc) * QUEUE_SIZE;
const USED_OFF: usize = QUEUE_ALIGN;

var ring: [USED_OFF + @sizeOf(Used) + QUEUE_ALIGN]u8 align(QUEUE_ALIGN) = undefined;
var buffers: [QUEUE_SIZE]Event align(8) = undefined;

comptime {
    // The available ring must fit before the used ring's alignment boundary,
    // or the two overlap and the device writes over the driver's own writes.
    if (AVAIL_OFF + @sizeOf(Avail) > USED_OFF) @compileError("virtqueue rings overlap");
}

fn desc_at() *[QUEUE_SIZE]Desc {
    return @ptrCast(@alignCast(&ring[DESC_OFF]));
}
fn avail_at() *Avail {
    return @ptrCast(@alignCast(&ring[AVAIL_OFF]));
}
fn used_at() *Used {
    return @ptrCast(@alignCast(&ring[USED_OFF]));
}

/// Where the driver has got to in the used ring. The device's own index runs
/// ahead of this as events arrive.
var last_used: u16 = 0;
var device: ?mmio.Device = null;

/// Set up the first virtio-input device on the bus.
///
/// `slots` are the physical addresses of the bus's slots, from the device
/// tree. Returns false when there is no keyboard, which is a fact about how
/// QEMU was started rather than a failure.
pub fn init(slots: []const u64) bool {
    for (slots) |base| {
        const d = mmio.probe(base) orelse continue;
        if (d.device_id != mmio.DeviceId.INPUT) continue;
        if (setup(d)) {
            device = d;
            return true;
        }
        mmio.failed(d);
        return false;
    }
    return false;
}

fn setup(d: mmio.Device) bool {
    if (!mmio.begin(d)) return false;

    d.write(.queue_sel, 0);
    if (d.version == 2 and d.read(.queue_ready) != 0) return false; // in use
    const max = d.read(.queue_num_max);
    if (max == 0 or max < QUEUE_SIZE) return false;
    d.write(.queue_num, QUEUE_SIZE);

    const desc = desc_at();
    const avail = avail_at();

    // Zero the whole region first: the device reads the used ring's index
    // out of it before writing anything, and .bss is only zeroed for the
    // kernel's own variables — this is a byte array whose interpretation the
    // struct pointers impose afterwards.
    @memset(&ring, 0);

    // Every descriptor points at its own buffer and is marked device-writable:
    // this queue only ever carries events *from* the device.
    var i: u16 = 0;
    while (i < QUEUE_SIZE) : (i += 1) {
        buffers[i] = .{ .type = 0, .code = 0, .value = 0 };
        desc[i] = .{
            .addr = vm.virt_to_phys(@intFromPtr(&buffers[i])),
            .len = @sizeOf(Event),
            .flags = DESC_F_WRITE,
            .next = 0,
        };
        avail.ring[i] = i;
    }
    last_used = 0;

    const base_phys = vm.virt_to_phys(@intFromPtr(&ring));
    if (d.version == 1) {
        d.write(.queue_align, QUEUE_ALIGN);
        d.write(.queue_pfn, @truncate(base_phys / mmio.PAGE_SIZE));
    } else {
        const desc_phys = base_phys + DESC_OFF;
        const avail_phys = base_phys + AVAIL_OFF;
        const used_phys = base_phys + USED_OFF;
        d.write(.queue_desc_low, @truncate(desc_phys));
        d.write(.queue_desc_high, @truncate(desc_phys >> 32));
        d.write(.queue_driver_low, @truncate(avail_phys));
        d.write(.queue_driver_high, @truncate(avail_phys >> 32));
        d.write(.queue_device_low, @truncate(used_phys));
        d.write(.queue_device_high, @truncate(used_phys >> 32));
        d.write(.queue_ready, 1);
    }

    mmio.ready(d);

    // Offer every buffer, and only then tell the device. Publishing the index
    // before the ring entries it refers to would let the device read a slot
    // that has not been filled in — which is what the barrier prevents, and
    // what makes this a barrier rather than a comment.
    barrier();
    avail.idx = QUEUE_SIZE;
    barrier();
    d.write(.queue_notify, 0);
    return true;
}

inline fn barrier() void {
    asm volatile ("dmb sy" ::: "memory");
}

/// The next event the device has produced, or null.
///
/// Each buffer taken from the used ring goes straight back on the available
/// ring: a queue that is not refilled delivers exactly QUEUE_SIZE events and
/// then goes quiet, which looks like a keyboard that stopped working.
pub fn poll() ?Event {
    const d = device orelse return null;
    const avail = avail_at();
    const used = used_at();

    barrier();
    const device_idx = @as(*volatile u16, &used.idx).*;
    if (device_idx == last_used) return null;

    // Both of these are memory the *device* wrote, so both are read through
    // volatile. The barrier above already stops the compiler carrying a
    // stale value across it, which makes this belt and braces — but the
    // belt is an inline asm memory clobber a few lines up, and nothing in
    // the type of these two loads says they depend on it.
    const slot = last_used % QUEUE_SIZE;
    const used_elem: *volatile UsedElem = &used.ring[slot];
    const id: u16 = @truncate(used_elem.id);
    // A device that returns a buffer it was never given is broken. Believing
    // it would index past the end of an array with the kernel's own memory
    // after it, and this is the one number in this file that comes from
    // outside the kernel.
    if (id >= QUEUE_SIZE) return null;
    const ev_ptr: *volatile Event = &buffers[id];
    const ev = Event{ .type = ev_ptr.type, .code = ev_ptr.code, .value = ev_ptr.value };
    last_used +%= 1;

    // Hand the buffer back.
    const at = avail.idx % QUEUE_SIZE;
    avail.ring[at] = id;
    barrier();
    avail.idx +%= 1;
    barrier();
    d.write(.queue_notify, 0);

    return ev;
}
