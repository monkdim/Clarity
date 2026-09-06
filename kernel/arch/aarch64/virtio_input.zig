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
//! Interrupt-driven, with polling underneath it.
//!
//! It was polled first, and only a read polled it, so nothing emptied the
//! device's queue while a program was doing anything else. Sixty-four events
//! is sixteen key presses; past that the device has nowhere to put the next
//! one and it is gone. Measured, at the shell: forty characters typed at a
//! waiting prompt all arrived, the same forty sent while `help` printed
//! arrived as nine — and so did the Enter after them, so the shell was left
//! holding half a command it could never run.
//!
//! Now the device's interrupt — an SPI named in the device tree, routed
//! through the GIC — empties the queue into a ring here, and reads take from
//! that ring. The two halves are separate on purpose: the interrupt is what
//! makes the queue get emptied promptly, and the ring is what gives the
//! events somewhere to wait until somebody asks. Neither alone is enough,
//! and the ring is what keeps this working on a machine whose interrupt the
//! device tree does not describe.

const mmio = @import("virtio_mmio.zig");
const vm = @import("vm.zig");
const gic = @import("gic.zig");

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
/// The INTID this device raises, once the GIC has been told to deliver it.
var intid: ?u32 = null;
/// Which of the slots `init` was given turned out to hold the keyboard.
///
/// The caller needs it to find the matching interrupt, and only this file
/// knows which slot answered: `init` walks the bus because a virtio device
/// is discoverable only by reading its registers.
var found_slot: ?usize = null;

// The software ring: where events wait between the interrupt that collected
// them and the read that wants them.
//
// Five hundred and twelve events is a hundred and twenty-eight key presses,
// against the sixty-four events — sixteen presses — the device queue holds.
// The size is not the point, though. The device queue is bounded by how fast
// the *driver* empties it, and it is emptied from an interrupt now; this one
// is bounded by how fast the *program* reads, which no interrupt can help
// with. A number is needed and this is a generous one, and `overruns` below
// is what says whether it was generous enough rather than leaving it to be
// assumed.
const EVENT_RING: usize = 512;
var events: [EVENT_RING]Event = undefined;
/// Written only by the producer (`drain`), read by both.
var head: usize = 0;
/// Written only by the consumer (`poll`), read by both.
var tail: usize = 0;

/// Events the ring had no room for. A read of this that is not zero means
/// somebody typed faster than anything read, for longer than the ring is
/// deep — which is a real thing to know and not the same as a lost buffer.
pub var overruns: u64 = 0;

/// Interrupts this device's handler has serviced. Zero after keys were
/// pressed means the GIC routing did not work and the polling underneath is
/// carrying the whole load, which is exactly the failure that would
/// otherwise be invisible: everything still works, just as badly as before.
pub var interrupts: u64 = 0;

/// Set up the first virtio-input device on the bus.
///
/// `slots` are the physical addresses of the bus's slots, from the device
/// tree. Returns false when there is no keyboard, which is a fact about how
/// QEMU was started rather than a failure.
pub fn init(slots: []const u64) bool {
    for (slots, 0..) |base, i| {
        const d = mmio.probe(base) orelse continue;
        if (d.device_id != mmio.DeviceId.INPUT) continue;
        if (setup(d)) {
            device = d;
            found_slot = i;
            return true;
        }
        mmio.failed(d);
        return false;
    }
    return false;
}

/// Which slot the keyboard was found in, or null if there is no keyboard.
pub fn found_in() ?usize {
    return found_slot;
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

/// The next event, or null.
///
/// The device queue is emptied first, because this has to work whether or
/// not the interrupt is being delivered — on a machine whose device tree
/// does not name it, or before the GIC has been told about it, this is the
/// only thing that ever empties it.
///
/// Interrupts are masked across that, because the handler empties the same
/// queue: two emptiers sharing `last_used` and the available ring would each
/// hand back buffers the other had already handed back. The ring below needs
/// no such protection — one producer, one consumer, and each index written
/// by only one of them.
pub fn poll() ?Event {
    const daif = mask_irqs();
    drain();
    restore_irqs(daif);

    const t = tail;
    if (t == load(&head)) return null;
    // The index was read before the slot. Without this the compiler is
    // entitled to load the slot first, which would be reading it before the
    // producer had finished writing it.
    barrier();
    const ev = events[t % EVENT_RING];
    store(&tail, t + 1);
    return ev;
}

/// Service this device's interrupt. Returns false if it was not ours.
///
/// The device's own status register is acknowledged before the queue is
/// emptied rather than after. Either order empties the queue; this one
/// cannot lose an event, because an event arriving in the window between the
/// two is left pending in the status register and raises the interrupt
/// again, whereas the other order would clear a status bit set by an event
/// this pass never looked at.
pub fn handle_irq(which: u32) bool {
    const mine = intid orelse return false;
    if (which != mine) return false;
    const d = device orelse return false;

    interrupts +%= 1;
    const status = d.read(.interrupt_status);
    if (status != 0) d.write(.interrupt_ack, status);
    drain();
    return true;
}

/// Ask the GIC to deliver this device's interrupt.
///
/// Called after `init`, with the INTID from the device tree. Not called from
/// `init` itself: `init` is given bus addresses and knows nothing about
/// which slot's interrupt is which, and inventing a mapping between the two
/// here is exactly the kind of guess the device tree exists to remove.
pub fn route(id: u32) void {
    gic.enable(id);
    intid = id;
}

/// The two ring indices are each written by one side and read by both, so
/// every crossing read goes through volatile: a plain one may be hoisted out
/// of the loop that is waiting for it to change.
fn load(p: *const usize) usize {
    return @as(*const volatile usize, p).*;
}

fn store(p: *usize, v: usize) void {
    @as(*volatile usize, p).* = v;
}

fn mask_irqs() u64 {
    const daif = asm volatile ("mrs %[out], daif"
        : [out] "=r" (-> u64),
    );
    asm volatile ("msr daifset, #2" ::: "memory");
    return daif;
}

fn restore_irqs(daif: u64) void {
    asm volatile ("msr daif, %[v]"
        :
        : [v] "r" (daif),
        : "memory"
    );
}

/// Move everything the device has produced into the ring.
///
/// Must run with interrupts masked, or from the interrupt handler itself.
fn drain() void {
    while (take()) |ev| {
        const h = head;
        if (h - load(&tail) >= EVENT_RING) {
            overruns +%= 1;
            // Kept: the buffer still goes back to the device, which is what
            // stops a full ring from also stopping the queue. The event is
            // dropped, and dropping the oldest instead would mean a burst of
            // typing arrived as its own tail rather than its own head.
            continue;
        }
        events[h % EVENT_RING] = ev;
        // The event is in place before the index says so. A consumer that
        // saw the index first would read the slot it is about to overwrite.
        barrier();
        store(&head, h + 1);
    }
}

/// One event straight off the used ring, or null.
///
/// Each buffer taken from the used ring goes straight back on the available
/// ring: a queue that is not refilled delivers exactly QUEUE_SIZE events and
/// then goes quiet, which looks like a keyboard that stopped working.
fn take() ?Event {
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
