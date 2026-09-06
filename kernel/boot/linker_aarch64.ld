/* ClarityOS aarch64 kernel link script.
 *
 * QEMU's `virt` machine places RAM at 0x4000_0000; the conventional
 * AArch64 kernel load offset is +0x80000. QEMU's ELF loader honours the
 * program headers, so the kernel is linked (and loaded) flat at that
 * physical address. The MMU is off at this stage, so VMA == LMA; the
 * higher-half mapping arrives with the aarch64 MMU phase.
 */

ENTRY(_start)

SECTIONS {
    . = 0x40080000;

    .text : ALIGN(8) {
        KEEP(*(.text.boot))
        *(.text .text.*)
    }

    .rodata : ALIGN(8) {
        *(.rodata .rodata.*)
    }

    .data : ALIGN(8) {
        *(.data .data.*)
    }

    . = ALIGN(16);
    __bss_start = .;
    .bss : ALIGN(16) {
        *(COMMON)
        *(.bss .bss.*)
    }
    . = ALIGN(16);
    __bss_end = .;

    /* 64 KiB boot stack, grows down from __stack_top. */
    . = ALIGN(16);
    . += 0x10000;
    __stack_top = .;

    /DISCARD/ : {
        *(.eh_frame)
        *(.note.*)
        *(.comment)
    }
}
