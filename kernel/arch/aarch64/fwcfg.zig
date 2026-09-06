//! QEMU's firmware configuration interface.
//!
//! This is how the machine tells a kernel what it has, and — through the DMA
//! half of the interface — how a kernel tells the machine something back.
//! Only the second direction is wanted here: configuring `ramfb`, which is a
//! display device that exists precisely so a kernel with no PCI driver can
//! still have a screen.
//!
//! The base address is 0x0902_0000 on QEMU's `virt` machine. That is not a
//! guess: it was read out of the device tree QEMU itself emits
//! (`-M virt,dumpdtb=…`), where the node is `/fw-cfg@9020000` with a region
//! 0x18 bytes long. Reading it from the device tree at boot instead would be
//! better and is a later change; it needs a flattened-device-tree parser,
//! which is its own piece of work.
//!
//! Register layout, from QEMU's docs/specs/fw_cfg.txt:
//!
//!   +0x00  data      one byte at a time, big-endian order for wide values
//!   +0x08  selector  16-bit, big-endian
//!   +0x10  DMA       64-bit, big-endian; writing an address starts a transfer
//!
//! Everything in this interface is big-endian, on a machine running
//! little-endian. Every multi-byte value therefore goes through @byteSwap,
//! and forgetting one is the failure mode: a selector of 0x1900 instead of
//! 0x0019 selects nothing and reads back zeroes, which looks exactly like a
//! device that is not there.

const BASE: u64 = 0x0902_0000;
const REG_DATA: u64 = BASE + 0x00;
const REG_SELECTOR: u64 = BASE + 0x08;
const REG_DMA: u64 = BASE + 0x10;

/// The file directory, which lists every other file by name.
const KEY_FILE_DIR: u16 = 0x0019;

/// Signature file, used to prove the interface is actually there before
/// trusting anything else it says.
const KEY_SIGNATURE: u16 = 0x0000;

// DMA control bits.
const DMA_ERROR: u32 = 1 << 0;
const DMA_READ: u32 = 1 << 1;
const DMA_SKIP: u32 = 1 << 2;
const DMA_SELECT: u32 = 1 << 3;
const DMA_WRITE: u32 = 1 << 4;

/// The command block a DMA transfer is described by. Every field is
/// big-endian. It lives in .bss rather than on the stack because the device
/// reads it directly out of memory, and a stack address is a fine thing to
/// hand a device right up until the frame is reused.
const DmaAccess = extern struct {
    control: u32,
    length: u32,
    address: u64,
};

var dma_cmd: DmaAccess align(8) = .{ .control = 0, .length = 0, .address = 0 };

fn mmio_write16(addr: u64, value: u16) void {
    const p: *volatile u16 = @ptrFromInt(addr);
    p.* = value;
}

fn mmio_write64(addr: u64, value: u64) void {
    const p: *volatile u64 = @ptrFromInt(addr);
    p.* = value;
}

fn mmio_read8(addr: u64) u8 {
    const p: *volatile u8 = @ptrFromInt(addr);
    return p.*;
}

fn select(key: u16) void {
    mmio_write16(REG_SELECTOR, @byteSwap(key));
}

/// Read `buf.len` bytes from the currently selected file, sequentially.
fn read_bytes(buf: []u8) void {
    for (buf) |*b| b.* = mmio_read8(REG_DATA);
}

/// Run one DMA command and wait for the device to finish with it.
///
/// The device clears `control` on success and sets bit 0 on failure, so the
/// poll below terminates either way — but only if it re-reads memory each
/// time, hence the volatile pointer. Without it the compiler is entitled to
/// hoist the load out of the loop and spin on a stale value forever.
fn run_dma(control: u32, length: u32, address: u64) bool {
    dma_cmd.control = @byteSwap(control);
    dma_cmd.length = @byteSwap(length);
    dma_cmd.address = @byteSwap(address);

    mmio_write64(REG_DMA, @byteSwap(@intFromPtr(&dma_cmd)));

    const ctl: *volatile u32 = &dma_cmd.control;
    var spins: u32 = 0;
    while (spins < 1_000_000) : (spins += 1) {
        const now = @byteSwap(ctl.*);
        if (now & DMA_ERROR != 0) return false;
        if (now == 0) return true;
    }
    return false;
}

/// Is a fw_cfg interface actually present?
///
/// Worth asking before anything else: the MMIO window is mapped whether or
/// not a device answers there, so a machine without one returns zeroes to
/// every read, and a file lookup would simply come back empty — the same
/// answer as "this QEMU has no ramfb", which is a different problem needing
/// a different message.
pub fn present() bool {
    select(KEY_SIGNATURE);
    var sig: [4]u8 = undefined;
    read_bytes(&sig);
    return sig[0] == 'Q' and sig[1] == 'E' and sig[2] == 'M' and sig[3] == 'U';
}

/// One entry of the file directory. Big-endian; `name` is NUL-padded.
const FileEntry = extern struct {
    size: u32,
    select_key: u16,
    reserved: u16,
    name: [56]u8,
};

/// The selector key for a named file, or null if this machine has no such
/// file. Reading the directory sequentially through the data register is
/// slower than a DMA read and much shorter to write; it happens once.
pub fn find(name: []const u8) ?u16 {
    select(KEY_FILE_DIR);
    var count_be: [4]u8 = undefined;
    read_bytes(&count_be);
    const count = (@as(u32, count_be[0]) << 24) | (@as(u32, count_be[1]) << 16) |
        (@as(u32, count_be[2]) << 8) | @as(u32, count_be[3]);

    // A machine with no fw_cfg answers zero, and a corrupt read could answer
    // anything; the directory on `virt` holds tens of entries, not millions.
    if (count == 0 or count > 4096) return null;

    var i: u32 = 0;
    while (i < count) : (i += 1) {
        var entry: FileEntry = undefined;
        const raw: [*]u8 = @ptrCast(&entry);
        read_bytes(raw[0..@sizeOf(FileEntry)]);

        var n: usize = 0;
        while (n < entry.name.len and entry.name[n] != 0) n += 1;
        if (n == name.len and eql(entry.name[0..n], name)) {
            return @byteSwap(entry.select_key);
        }
    }
    return null;
}

fn eql(a: []const u8, b: []const u8) bool {
    if (a.len != b.len) return false;
    for (a, b) |x, y| if (x != y) return false;
    return true;
}

/// Write `bytes` into the file identified by `key`.
///
/// The select and the write are one command: the high 16 bits of `control`
/// carry the selector when DMA_SELECT is set, so there is no window between
/// choosing the file and filling it.
pub fn write_file(key: u16, bytes: []const u8) bool {
    const control = (@as(u32, key) << 16) | DMA_SELECT | DMA_WRITE;
    return run_dma(control, @intCast(bytes.len), @intFromPtr(bytes.ptr));
}
