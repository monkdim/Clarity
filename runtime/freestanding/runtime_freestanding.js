// Clarity runtime — freestanding port (Phase 66 task 1).
//
// Mirrors native/runtime.js but without any direct Node/Bun imports.
// Every I/O call goes through ./host.js, which dispatches to the
// real Bun/Node fs APIs in development and to kernel syscalls when
// running on bare-metal ClarityOS.
//
// The transpiler emits the same JS from Clarity sources whether
// you use this runtime or the regular one — only the import path
// at the top of `clarity-entry.js` changes:
//
//   // dev:
//   import { ... } from './runtime.js';
//
//   // bare metal:
//   import { ... } from './runtime_freestanding.js';

import { fs, proc, env_, exec_, time } from './host.js';

// ── Display + I/O ──────────────────────────────────────

const _output = [];

export function display(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return '[' + v.map(display).join(', ') + ']';
    if (typeof v === 'object') {
        if (v._clarityType === 'enum_variant') return v._enum + '.' + v._variant;
        if (v._clarityType) return v._className || 'Object';
        return '{' + Object.entries(v).map(([k, vv]) => k + ': ' + display(vv)).join(', ') + '}';
    }
    return String(v);
}

export function show(...vals) {
    const text = vals.map(display).join(' ');
    _output.push(text);
    if (typeof globalThis !== 'undefined' && typeof globalThis.print === 'function') {
        globalThis.print(text);   // QuickJS / freestanding: provided by host_shim
    } else if (typeof console !== 'undefined') {
        console.log(text);
    }
}

export { show as print };

export function captured_output() { return _output.slice(); }
export function clear_output() { _output.length = 0; }

// ── Filesystem ─────────────────────────────────────────

export function read(path) { return fs.read_text(path); }
export function write(path, content) { fs.write_text(path, display(content)); return true; }
export function append(path, content) { fs.append_text(path, display(content)); return true; }
export function exists(path) { return fs.exists(path); }
export function lines(path) { return read(path).split('\n'); }

// ── Type conversions ─────────────────────────────────

export function $int(v) {
    if (typeof v === 'string') {
        const s = v.trim();
        if (/^[+-]?0x/i.test(s)) return parseInt(s, 16) || 0;
        if (/^[+-]?0o/i.test(s)) return parseInt(s.replace(/0o/i, ''), 8) || 0;
        if (/^[+-]?0b/i.test(s)) return parseInt(s.replace(/0b/i, ''), 2) || 0;
        return parseInt(s, 10) || 0;
    }
    return Math.trunc(Number(v));
}

export function $float(v) { return parseFloat(v); }
export function str(v) { return display(v); }
export function $bool(v) { return $truthy(v); }

export function $eq(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a == null && b == null;
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!$eq(a[i], b[i])) return false;
        return true;
    }
    if (typeof a === 'object' && typeof b === 'object') {
        const ka = Object.keys(a);
        if (ka.length !== Object.keys(b).length) return false;
        for (const k of ka) if (!$eq(a[k], b[k])) return false;
        return true;
    }
    return false;
}

export function $truthy(v) {
    if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
}

export function $index(obj, idx) {
    if ((Array.isArray(obj) || typeof obj === 'string') && typeof idx === 'number' && idx < 0) {
        idx = obj.length + idx;
    }
    const v = obj == null ? undefined : obj[idx];
    return v === undefined ? null : v;
}

export function len(v) {
    if (v == null) return 0;
    if (typeof v === 'string' || Array.isArray(v)) return v.length;
    if (typeof v === 'object') return Object.keys(v).length;
    return 0;
}

export function type(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
    if (typeof v === 'string') return 'string';
    if (Array.isArray(v)) return 'list';
    if (typeof v === 'function') return 'function';
    if (typeof v === 'object') return v._className || 'map';
    return 'unknown';
}

// ── Strings ────────────────────────────────────────────

export function trim(s) { return s.trim(); }
export function split(s, sep = ' ') { return s.split(sep); }
export function $join(arr, sep) { return arr.join(sep); }
export function starts(s, p) { return s.startsWith(p); }
export function ends(s, p) { return s.endsWith(p); }
export function contains(s, sub) { return Array.isArray(s) ? s.includes(sub) : s.includes(sub); }
export function substring(s, start, end) { return s.substring(start, end); }
export function index_of(s, sub) { return s.indexOf(sub); }
export function char_at(s, i) { return s[i] ?? null; }
export function from_char_code(n) { return String.fromCharCode(n); }
export function replace(s, a, b) { return s.split(a).join(b); }
export function upper(s) { return s.toUpperCase(); }
export function lower(s) { return s.toLowerCase(); }
export function is_digit(c) { return c.length > 0 && /^\d+$/.test(c); }

// ── Lists / maps ──────────────────────────────────────

export function push(list, item) { list.push(item); return list; }
export function pop(list) { return list.pop() ?? null; }
export function keys(obj) { return Object.keys(obj); }
export function values(obj) { return Object.values(obj); }
export function entries(obj) { return Object.entries(obj); }
export function has(obj, key) {
    if (Array.isArray(obj) || typeof obj === 'string') return obj.includes(key);
    return obj != null && key in obj;
}

// ── Process / env ──────────────────────────────────────

export function args() { return proc.args(); }
export function env(name, fallback = null) {
    const v = env_.get(name);
    return v == null ? fallback : v;
}
export function getpid() { return proc.getpid(); }
export function exit(code) { proc.exit(code | 0); }

// ── Exec ────────────────────────────────────────────

export function exec(cmd) { return exec_.run(cmd).stdout; }
export function exec_full(cmd) { return exec_.run(cmd); }

// ── Time ────────────────────────────────────────────

export function time_now() { return time.now_seconds(); }
export function sleep(seconds) { time.sleep_ms(seconds * 1000); }

// ── JSON ────────────────────────────────────────────

export function json_parse(s) { return JSON.parse(s); }
export function json_string(v, indent = 0) { return JSON.stringify(v, null, indent); }

// ── Class / enum infrastructure ────────────────────

export class ClarityEnum {
    constructor(name, variants) {
        this._name = name;
        for (const [k, v] of Object.entries(variants)) {
            this[k] = { _clarityType: 'enum_variant', _enum: name, _variant: k, value: v };
        }
    }
}

export class ClarityInstance {
    constructor(className) { this._clarityType = 'instance'; this._className = className; }
}

// ── Banner ─────────────────────────────────────────

export const __runtime_kind = 'freestanding';
