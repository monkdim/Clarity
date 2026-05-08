// ClarityOS boot stub — multiboot2 entry, switch to long mode,
// jump to kernel_main(boot_info).
//
// This is the only assembly file in the kernel. It runs in 32-bit
// protected mode (where multiboot2 hands us control), sets up
// identity-mapped paging for the first 4 GiB using 2 MiB pages,
// loads a flat 64-bit GDT, enables long mode, and jumps to the
// 64-bit kernel_main entry point.

.section .multiboot2, "a"
.align 8
.long 0xE85250D6                            // magic
.long 0                                      // arch (i386)
.long header_end - header_start              // header length
.long -(0xE85250D6 + (header_end - header_start))  // checksum
header_start:
    // Information request tag — ask for memory map + framebuffer.
    .word 1                                  // tag_type
    .word 0                                  // flags
    .long 8 + 4 * 2                          // size
    .long 6                                  // mmap
    .long 8                                  // framebuffer
    .long 0                                  // pad
    // End tag
    .word 0
    .word 0
    .long 8
header_end:

.section .bss
.align 16
stack_bottom:
    .skip 16384   // 16 KiB initial stack
stack_top:

.align 4096
boot_pml4:    .skip 4096
boot_pdpt:    .skip 4096
boot_pd:      .skip 4096

.section .text
.code32
.global _start
.type _start, @function
_start:
    // multiboot2 puts the magic in %eax and a pointer to the boot
    // info blob in %ebx. Save them; we'll pass the blob to
    // kernel_main as the long-mode argument.
    mov   $stack_top, %esp
    push  %ebx
    push  %eax

    // Build identity-map of the first 1 GiB using 2 MiB pages.
    mov   $boot_pml4, %edi
    mov   $boot_pdpt, %eax
    or    $0x3, %eax            // present + writable
    mov   %eax, (%edi)

    mov   $boot_pdpt, %edi
    mov   $boot_pd, %eax
    or    $0x3, %eax
    mov   %eax, (%edi)

    mov   $boot_pd, %edi
    mov   $0, %ecx
1:  mov   %ecx, %eax
    shl   $21, %eax
    or    $0x83, %eax           // present + writable + 2 MiB page
    mov   %eax, (%edi, %ecx, 8)
    inc   %ecx
    cmp   $512, %ecx
    jl    1b

    // CR3 = PML4
    mov   $boot_pml4, %eax
    mov   %eax, %cr3

    // Enable PAE
    mov   %cr4, %eax
    or    $(1 << 5), %eax
    mov   %eax, %cr4

    // Set EFER.LME
    mov   $0xC0000080, %ecx
    rdmsr
    or    $(1 << 8), %eax
    wrmsr

    // Enable paging — CR0.PG | CR0.PE
    mov   %cr0, %eax
    or    $(1 << 31), %eax
    mov   %eax, %cr0

    // Load 64-bit GDT, far-jump to long-mode CS.
    lgdt  gdt64_pointer
    ljmp  $0x08, $long_start

.code64
long_start:
    mov   $0x10, %ax
    mov   %ax, %ds
    mov   %ax, %es
    mov   %ax, %fs
    mov   %ax, %gs
    mov   %ax, %ss

    pop   %rax                  // multiboot magic (unused after this)
    pop   %rdi                  // boot info blob pointer → first arg

    call  kernel_main
.halt:
    cli
    hlt
    jmp   .halt

.section .rodata
.align 8
gdt64:
    .quad 0x0000000000000000    // null
    .quad 0x00AF9A000000FFFF    // 64-bit code
    .quad 0x00AF92000000FFFF    // 64-bit data
gdt64_end:
gdt64_pointer:
    .word gdt64_end - gdt64 - 1
    .quad gdt64
