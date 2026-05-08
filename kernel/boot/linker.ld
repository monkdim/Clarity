/* ClarityOS kernel link script.
 * Loads the kernel at the higher half (0xFFFF_FFFF_8000_0000)
 * with the multiboot2 header in the first 32 KiB so the boot
 * loader can find it.
 */

ENTRY(_start)

KERNEL_VMA = 0xFFFFFFFF80000000;
KERNEL_LMA = 0x100000;

SECTIONS {
    . = KERNEL_LMA;

    .multiboot2 : ALIGN(8) {
        KEEP(*(.multiboot2))
    }

    . += KERNEL_VMA;

    .text : AT(ADDR(.text) - KERNEL_VMA) ALIGN(4K) {
        *(.text .text.*)
    }

    .rodata : AT(ADDR(.rodata) - KERNEL_VMA) ALIGN(4K) {
        *(.rodata .rodata.*)
    }

    .data : AT(ADDR(.data) - KERNEL_VMA) ALIGN(4K) {
        *(.data .data.*)
    }

    .bss : AT(ADDR(.bss) - KERNEL_VMA) ALIGN(4K) {
        *(COMMON)
        *(.bss .bss.*)
    }

    /DISCARD/ : {
        *(.eh_frame)
        *(.note.*)
        *(.comment)
    }
}
