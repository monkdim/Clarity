/* Where a user program is linked.
 *
 * Clear of the low identity-mapped window the boot stub installs, and far
 * below the kernel half.
 *
 * The ALIGN(0x1000) on each section is load-bearing, not tidiness. The kernel
 * loader maps a segment page by page, allocating a fresh zeroed frame for
 * each one, so if two PT_LOADs shared a page the second would be mapped over
 * the first and silently discard whatever had been copied into it. Aligning
 * every section to a page guarantees the segments the linker derives from
 * them never overlap. Verified: this script yields three PT_LOADs at
 * 0x40100000 (R E), 0x40101000 (R) and 0x40102000 (RW), the last with
 * p_memsz well over p_filesz — a real .bss for the loader to zero. */
ENTRY(_start)

SECTIONS {
    . = 0x40100000;

    .text : ALIGN(0x1000) {
        *(.text .text.*)
    }

    .rodata : ALIGN(0x1000) {
        *(.rodata .rodata.*)
    }

    .data : ALIGN(0x1000) {
        *(.data .data.*)
    }

    .bss : ALIGN(0x1000) {
        *(.bss .bss.*)
        *(COMMON)
    }

    /DISCARD/ : {
        *(.comment)
        *(.note.*)
        *(.eh_frame)
    }
}
