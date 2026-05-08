//! Port I/O — wrappers for in/out instructions on x86_64.

pub inline fn in8(p: u16) u8 {
    return asm volatile ("inb %[port], %[ret]"
        : [ret] "={al}" (-> u8),
        : [port] "N{dx}" (p),
    );
}

pub inline fn in16(p: u16) u16 {
    return asm volatile ("inw %[port], %[ret]"
        : [ret] "={ax}" (-> u16),
        : [port] "N{dx}" (p),
    );
}

pub inline fn in32(p: u16) u32 {
    return asm volatile ("inl %[port], %[ret]"
        : [ret] "={eax}" (-> u32),
        : [port] "N{dx}" (p),
    );
}

pub inline fn out8(p: u16, v: u8) void {
    asm volatile ("outb %[v], %[port]"
        :
        : [v] "{al}" (v),
          [port] "N{dx}" (p),
    );
}

pub inline fn out16(p: u16, v: u16) void {
    asm volatile ("outw %[v], %[port]"
        :
        : [v] "{ax}" (v),
          [port] "N{dx}" (p),
    );
}

pub inline fn out32(p: u16, v: u32) void {
    asm volatile ("outl %[v], %[port]"
        :
        : [v] "{eax}" (v),
          [port] "N{dx}" (p),
    );
}
