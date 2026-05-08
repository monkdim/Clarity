//! Bytecode opcodes — must match stdlib/bytecode.clarity exactly.
//! When you add an opcode there, mirror it here and update vm.zig's
//! switch.

pub const Opcode = enum(u8) {
    // ── Stack ───────────────────────────────────────
    @"const" = 0,
    pop = 1,

    // ── Arithmetic / unary ──────────────────────────
    add = 2,
    sub = 3,
    mul = 4,
    div = 5,
    mod = 6,
    pow = 7,
    neg = 8,
    not = 9,

    // ── Comparison ──────────────────────────────────
    eq = 10,
    neq = 11,
    lt = 12,
    gt = 13,
    lte = 14,
    gte = 15,

    // ── Variables ───────────────────────────────────
    load = 16,
    store = 17,
    store_new = 18,

    // ── Control flow ────────────────────────────────
    jump = 19,
    jump_false = 20,
    call = 21,
    @"return" = 22,

    // ── Aggregates ──────────────────────────────────
    make_list = 23,
    make_map = 24,
    get_idx = 25,
    set_idx = 26,
    get_prop = 27,
    set_prop = 28,

    // ── Misc ────────────────────────────────────────
    print = 29,
    make_fn = 30,
    dup = 31,
    iter_init = 32,
    iter_next = 33,

    // ── Logical / bitwise ───────────────────────────
    @"and" = 34,
    @"or" = 35,
    bit_and = 36,
    bit_or = 37,
    bit_xor = 38,
    bit_not = 39,
    lshift = 40,
    rshift = 41,
    range = 42,

    // ── Constants ───────────────────────────────────
    null_ = 43,
    true_ = 44,
    false_ = 45,

    // ── Strings / pipes ─────────────────────────────
    concat = 46,
    pipe = 47,

    // ── Exceptions ──────────────────────────────────
    throw = 48,
    setup_try = 51,
    pop_try = 52,

    // ── Classes / slicing ───────────────────────────
    make_class = 49,
    slice = 50,

    // ── Stack juggling ──────────────────────────────
    swap = 53,
    rot3 = 54,
    jump_true = 55,

    halt = 255,
    _,
};
