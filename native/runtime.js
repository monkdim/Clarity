/**
 * Clarity Runtime — JavaScript builtins for transpiled Clarity code.
 * AUTO-GENERATED from stdlib/runtime_spec.clarity — do not edit by hand.
 * Regenerate with: clarity gen-runtime
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync, mkdirSync, unlinkSync, renameSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { createServer } from 'http';
import { resolve, dirname, basename, extname, join as pathJoin, sep } from 'path';
import { createHash, randomUUID } from 'crypto';
import { dlopen, FFIType, suffix as ffiSuffix, ptr as bunPtr, read as bunRead, CString, JSCallback } from 'bun:ffi';

// ── I/O ──────────────────────────────────────────────────

const _output = [];

export function show(...vals) {
  const text = vals.map(display).join(' ');
  console.log(text);
  _output.push(text);
}

export { show as print };

export function ask(prompt = '') {
  process.stdout.write(prompt);
  const buf = Buffer.alloc(1024);
  const fd = process.platform === 'win32'
    ? process.stdin.fd
    : require('fs').openSync('/dev/tty', 'rs');
  let n = 0;
  try { n = require('fs').readSync(fd, buf, 0, buf.length, null); } catch { }
  if (fd !== process.stdin.fd) require('fs').closeSync(fd);
  return buf.slice(0, n).toString().replace(/[\r\n]+$/, '');
}

export function read(path) { return readFileSync(path, 'utf-8'); }
export function write(path, content) { writeFileSync(path, display(content)); return true; }
export function append(path, content) { appendFileSync(path, display(content)); return true; }
export function exists(path) { return existsSync(path); }
export function lines(path) { return readFileSync(path, 'utf-8').split('\n'); }
export function read_bytes(path) { return Array.from(readFileSync(path)); }
export function write_bytes(path, bytes) { writeFileSync(path, Buffer.from(bytes)); return true; }

// ── Type conversions ─────────────────────────────────────

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
export function $bool(v) { return truthy(v); }

export function $eq(a, b) {
  if (a === b) return true;
  // Treat null and undefined as equal (Clarity only has null)
  if (a == null || b == null) return a == null && b == null;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!$eq(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    if (a.constructor !== Object || b.constructor !== Object) return false;
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    for (const k of ka) if (!$eq(a[k], b[k])) return false;
    return true;
  }
  return false;
}

export function $ne(a, b) { return !$eq(a, b); }

export function $index(obj, idx) {
  if ((Array.isArray(obj) || typeof obj === 'string') && typeof idx === 'number' && idx < 0) {
    idx = obj.length + idx;
  }
  const v = obj == null ? undefined : obj[idx];
  return v === undefined ? null : v;
}
export function type(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
  if (typeof v === 'string') return 'string';
  if (Array.isArray(v)) return 'list';
  if (v instanceof ClarityEnum) return 'enum';
  if (v instanceof ClarityInstance) return v._className;
  if (typeof v === 'function') return 'function';
  // Check for interpreter class instances by their _clarityType marker
  if (typeof v === 'object' && v._clarityType) {
    return v._clarityType;
  }
  if (typeof v === 'object') return 'map';
  return 'unknown';
}

// ── Collections ──────────────────────────────────────────

export function len(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'string' || Array.isArray(v)) return v.length;
  if (typeof v === 'object') return Object.keys(v).length;
  return 0;
}

export function push(list, item) { list.push(item); return list; }
export function pop(list) { return list.pop(); }
export function sort(list) { return [...list].sort((a, b) => a < b ? -1 : a > b ? 1 : 0); }
export function reverse(v) {
  if (typeof v === 'string') return v.split('').reverse().join('');
  return [...v].reverse();
}

export function range(...args) {
  let start = 0, end = 0, step = 1;
  if (args.length === 1) { end = args[0]; }
  else if (args.length === 2) { start = args[0]; end = args[1]; }
  else { start = args[0]; end = args[1]; step = args[2]; }
  const result = [];
  if (step > 0) for (let i = start; i < end; i += step) result.push(i);
  else for (let i = start; i > end; i += step) result.push(i);
  return result;
}

export function map(list, fn) { return list.map((v, i) => fn(v, i)); }
export function filter(list, fn) { return list.filter(fn); }
export function reduce(list, fn, init) {
  return init !== undefined ? list.reduce(fn, init) : list.reduce(fn);
}
export function each(list, fn) { list.forEach(fn); }
export function find(list, fn) { return list.find(fn) ?? null; }
export function every(list, fn) { return list.every(fn); }
export function some(list, fn) { return list.some(fn); }
export function flat(list) { return list.flat(); }
export function zip(...lists) {
  const minLen = Math.min(...lists.map(l => l.length));
  return Array.from({ length: minLen }, (_, i) => lists.map(l => l[i]));
}
export function unique(list) { return [...new Set(list)]; }
export function keys(obj) { return Object.keys(obj); }
export function values(obj) { return Object.values(obj); }
export function entries(obj) { return Object.entries(obj); }
export function merge(...objs) { return Object.assign({}, ...objs); }
export function has(obj, key) {
  if (Array.isArray(obj)) return obj.includes(key);
  if (typeof obj === 'string') return obj.includes(key);
  return obj != null && key in obj;
}

// ── Strings ──────────────────────────────────────────────

export function split(s, sep = ' ') { return s.split(sep); }
export function $join(list, sep = '') { return list.map(display).join(sep); }
export function replace(s, from, to) { return s.split(from).join(to); }
export function trim(s) { return s.trim(); }
export function upper(s) { return s.toUpperCase(); }
export function lower(s) { return s.toLowerCase(); }
export function contains(s, sub) {
  if (Array.isArray(s)) return s.includes(sub);
  return s.includes(sub);
}
export function starts(s, prefix) { return s.startsWith(prefix); }
export function ends(s, suffix) { return s.endsWith(suffix); }
export function chars(s) { return s.split(''); }
export function $repeat(s, n) { return s.repeat(n); }
export function pad_left(s, n, ch = ' ') { return s.padStart(n, ch); }
export function pad_right(s, n, ch = ' ') { return s.padEnd(n, ch); }
export function char_at(s, i) { return s[i] ?? null; }
export function char_code(s) { return s.charCodeAt(0); }
export function from_char_code(n) { return String.fromCharCode(n); }
export function index_of(s, sub) { return s.indexOf(sub); }
export function substring(s, start, end) { return s.substring(start, end); }
export function is_digit(c) { return c.length > 0 && /^\d+$/.test(c); }
export function is_alpha(c) { return c.length > 0 && /^[a-zA-Z]+$/.test(c); }
export function is_alnum(c) { return c.length > 0 && /^[a-zA-Z0-9]+$/.test(c); }
export function is_space(c) { return c.length > 0 && /^\s+$/.test(c); }

// ── Math ─────────────────────────────────────────────────

export const pi = Math.PI;
export const e = Math.E;
export const sqrt = Math.sqrt;
export const sin = Math.sin;
export const cos = Math.cos;
export const tan = Math.tan;
export const log = Math.log;
export function abs(n) { return Math.abs(n); }
export function round(n, d = 0) { const f = 10 ** d; return Math.round(n * f) / f; }
export function floor(n) { return Math.floor(n); }
export function ceil(n) { return Math.ceil(n); }
export function $min(...args) {
  if (args.length === 1 && Array.isArray(args[0])) return Math.min(...args[0]);
  return Math.min(...args);
}
export function $max(...args) {
  if (args.length === 1 && Array.isArray(args[0])) return Math.max(...args[0]);
  return Math.max(...args);
}
export function sum(list) { return list.reduce((a, b) => a + b, 0); }
export function random(...args) {
  if (args.length === 0) return Math.random();
  if (args.length === 1) return Math.floor(Math.random() * args[0]);
  return Math.floor(Math.random() * (args[1] - args[0])) + args[0];
}
export function pow(base, exp) { return base ** exp; }

// ── System ───────────────────────────────────────────────

export function exec(cmd) {
  try { return execSync(cmd, { encoding: 'utf-8' }).replace(/\n$/, ''); }
  catch (e) { return e.stdout || ''; }
}

export function exec_full(cmd) {
  try {
    const stdout = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { stdout, stderr: '', exit_code: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', exit_code: e.status || 1 };
  }
}

export function exit(code = 0) { process.exit(code); }
export function sleep(secs) { execSync(`sleep ${secs}`); }
export function time() { return Date.now() / 1000; }
export function env(name) { return process.env[name] || null; }
export function args() { return process.argv.slice(2); }
export function cwd() { return process.cwd(); }

// ── JSON ─────────────────────────────────────────────────

export function json_parse(s) { return JSON.parse(s); }
export function json_string(v, indent) { return JSON.stringify(v, null, indent); }

// ── Crypto / Encoding ────────────────────────────────────

export function hash(text, algo = 'sha256') {
  return createHash(algo).update(text).digest('hex');
}
export function encode64(text) { return Buffer.from(text).toString('base64'); }
export function decode64(text) { return Buffer.from(text, 'base64').toString(); }

// ── Functional ───────────────────────────────────────────

export function compose(...fns) {
  return (x) => fns.reduceRight((v, fn) => fn(v), x);
}
export function tap(v, fn) { fn(v); return v; }

// ── Set ──────────────────────────────────────────────────

export function $set(list) { return [...new Set(list)]; }

// ── Error ────────────────────────────────────────────────

export function error(msg) { return new Error(msg); }

// ── HTTP ─────────────────────────────────────────────────

export function fetch(url) {
  return execSync(`curl -sL '${url}'`, { encoding: 'utf-8' });
}

export function serve(port, handler) {
  const server = createServer((req, res) => {
    const result = handler(req.method, req.url);
    if (typeof result === 'object' && result !== null) {
      res.writeHead(result.status || 200, { 'Content-Type': result.type || 'text/html' });
      res.end(result.body || '');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(display(result));
    }
  });
  server.listen(port);
  console.log(`  Serving on http://localhost:${port}`);
}

// ── Regex ────────────────────────────────────────────────

export function regex_match(pattern, str) { return new RegExp(pattern).test(str); }
export function regex_search(pattern, str) { return new RegExp(pattern).test(str); }
export function regex_find(pattern, str) { return [...str.matchAll(new RegExp(pattern, 'g'))].map(m => m[0]); }
export function regex_replace(pattern, str, repl) { return str.replace(new RegExp(pattern, 'g'), repl); }
export function regex_split(pattern, str) { return str.split(new RegExp(pattern)); }
export function exec_full_regex(pattern, str) {
  const re = new RegExp(pattern);
  const m = re.exec(str);
  if (!m) return null;
  return { match: m[0], groups: m.slice(1), index: m.index };
}

// ── Classes support ──────────────────────────────────────

export class ClarityInstance {
  constructor(className, props = {}) {
    this._className = className;
    Object.assign(this, props);
  }
}

export class ClarityEnum {
  constructor(name, members) {
    this.name = name;
    this.members = members;
    // Expose enum members as properties: Color.RED, Color.GREEN, etc.
    for (const [k, v] of Object.entries(members)) {
      this[k] = v;
    }
  }
  toString() { return `<enum ${this.name}>`; }
}

// ── Path module ──────────────────────────────────────────

export const $path = {
  join: pathJoin,
  dir: dirname,
  name: basename,
  stem: (p) => basename(p, extname(p)),
  ext: extname,
  exists: existsSync,
  is_file: (p) => { try { return statSync(p).isFile(); } catch { return false; } },
  is_dir: (p) => { try { return statSync(p).isDirectory(); } catch { return false; } },
  abs: resolve,
  sep,
};

// ── OS module ────────────────────────────────────────────

export const $os = {
  env: (n) => process.env[n] || null,
  cwd: () => process.cwd(),
  args: () => process.argv.slice(2),
  exec: exec,
  ls: (p = '.') => readdirSync(p),
  mkdir: (p) => mkdirSync(p, { recursive: true }),
  rm: unlinkSync,
  rename: renameSync,
  home: () => process.env.HOME || process.env.USERPROFILE || '/',
  sep,
};

// ── Display helpers ──────────────────────────────────────

export function display(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return '[' + value.map(display).join(', ') + ']';
  if (value instanceof ClarityEnum) return value.toString();
  if (value instanceof ClarityInstance) return `<${value._className} instance>`;
  if (typeof value === 'function') return `<fn ${value.name || 'anonymous'}>`;
  if (typeof value === 'object') {
    const pairs = Object.entries(value).map(([k, v]) => `${k}: ${repr(v)}`);
    return '{' + pairs.join(', ') + '}';
  }
  return String(value);
}

export function repr(value) {
  if (typeof value === 'string') return `"${value}"`;
  return display(value);
}

export function truthy(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// ── Signal classes for control flow ──────────────────────

export class BreakSignal {}
export class ContinueSignal {}
export class ReturnSignal { constructor(value) { this.value = value; } }

// ── Error formatting with Clarity source mapping ─────────

/**
 * Parse /*@file:line*​/ comments from transpiled JS source to build
 * a readable Clarity stack trace.
 */
export function formatClarityError(err, source) {
  if (!(err instanceof Error)) return display(err);
  const jsStack = err.stack || '';
  const lines = jsStack.split('\n');

  // Extract Clarity source locations from the error's JS stack
  const clarityFrames = [];
  const linePattern = /at\s+(?:(\S+)\s+)?\(?.*?:(\d+):\d+\)?/;
  for (const line of lines) {
    const m = line.match(linePattern);
    if (m) {
      const fnName = m[1] || '<module>';
      clarityFrames.push(`  at ${fnName}`);
    }
  }

  let msg = `\x1b[31m\n  Clarity Error: ${err.message}\x1b[0m`;
  if (clarityFrames.length > 0) {
    msg += '\n' + clarityFrames.slice(0, 8).join('\n');
  }
  return msg;
}

/**
 * Wrap the entry point to catch errors and display Clarity-formatted traces.
 */
export function clarityMain(fn) {
  try {
    fn();
  } catch (err) {
    if (err instanceof BreakSignal || err instanceof ContinueSignal || err instanceof ReturnSignal) return;
    console.error(formatClarityError(err));
    process.exit(1);
  }
}

// ── FFI: Bun-backed C interop ────────────────────────────
// Maps Clarity type strings to Bun's FFIType enum.
const $FFI_TYPES = {
  void: FFIType.void,
  bool: FFIType.bool,
  int: FFIType.i32,
  i8: FFIType.i8, i16: FFIType.i16, i32: FFIType.i32, i64: FFIType.i64,
  u8: FFIType.u8, u16: FFIType.u16, u32: FFIType.u32, u64: FFIType.u64,
  float: FFIType.f32, f32: FFIType.f32, f64: FFIType.f64, double: FFIType.f64,
  ptr: FFIType.ptr, pointer: FFIType.ptr,
  string: FFIType.cstring, cstring: FFIType.cstring,
  char: FFIType.char,
};

function $ffi_type(name) {
  if (!(name in $FFI_TYPES)) {
    throw new Error(`FFIError: Unknown type '${name}'`);
  }
  return $FFI_TYPES[name];
}

// Resolve a library name to a path Bun's dlopen can load. "libc" and a few
// well-known names are mapped to the platform-correct shared library.
function $ffi_resolve_lib(name) {
  if (name.includes('/') || name.includes('.')) return name;
  if (name === 'libc' || name === 'c') {
    if (process.platform === 'darwin') return 'libSystem.dylib';
    if (process.platform === 'linux') return 'libc.so.6';
    if (process.platform === 'win32') return 'msvcrt.dll';
  }
  if (name === 'libm' || name === 'm') {
    if (process.platform === 'darwin') return 'libSystem.dylib';
    if (process.platform === 'linux') return 'libm.so.6';
  }
  return `${name}.${ffiSuffix}`;
}

// Open a shared library. Returns a handle ({ symbols, close }).
export function _ffi_open(libname, symbols_spec) {
  const path = $ffi_resolve_lib(libname);
  const symbols = {};
  for (const sym of Object.keys(symbols_spec)) {
    const spec = symbols_spec[sym];
    symbols[sym] = {
      args: (spec.args || []).map($ffi_type),
      returns: $ffi_type(spec.returns || 'void'),
    };
  }
  return dlopen(path, symbols);
}

// Bind a single symbol from a library and return a Clarity-callable function.
// args and ret are arrays/strings of Clarity type names.
export function _ffi_bind(libname, sym_name, args, ret) {
  const handle = _ffi_open(libname, { [sym_name]: { args: args || [], returns: ret || 'void' } });
  const fn = handle.symbols[sym_name];
  if (!fn) throw new Error(`FFIError: Symbol '${sym_name}' not found in '${libname}'`);
  const argTypes = (args || []).slice();
  return (...callArgs) => {
    // Marshal arguments: JS strings → null-terminated UTF-8 buffers for
    // cstring/string params; Pointer wrappers → their numeric addr; pass
    // primitives through unchanged.
    const marshalled = callArgs.map((a, i) => {
      const t = argTypes[i];
      if ((t === 'string' || t === 'cstring') && typeof a === 'string') {
        const bytes = new TextEncoder().encode(a);
        const buf = new Uint8Array(bytes.length + 1);
        buf.set(bytes);
        return buf;
      }
      if (a !== null && typeof a === 'object') {
        return _ffi_addr(a);
      }
      return a;
    });
    const result = fn(...marshalled);
    if (typeof result === 'object' && result !== null && typeof result.toString === 'function' && ret === 'cstring') {
      return result.toString();
    }
    // Bun returns u64/i64 as BigInt; coerce to Number so it interops with
    // the rest of Clarity's numeric stack.
    if (typeof result === 'bigint') return Number(result);
    return result;
  };
}

export function _ffi_close(handle) {
  if (handle && typeof handle.close === 'function') handle.close();
}

// ── FFI: Pointer & memory marshalling ────────────────────
// Pointer handles are JS objects: { addr, _buffer, size }.
// _buffer is non-null when this runtime allocated the memory and holds it
// alive against GC. addr is a numeric (or BigInt) address suitable for
// passing across the FFI boundary.

// Resolve any kind of "pointer-like" thing to a raw numeric address.
// For runtime-allocated buffers we ALWAYS recompute via bunPtr(buffer)
// because the JS engine moves TypedArrays during GC; caching the
// address gives back stale memory when read later.
function _ffi_addr(p) {
  if (p === null || p === undefined) return 0;
  if (typeof p === 'number' || typeof p === 'bigint') return p;
  if (typeof p === 'object') {
    if (p._buffer) return bunPtr(p._buffer);
    if ('addr' in p) return p.addr;
    // Clarity Pointer / Callback / StructInstance wrap the handle in
    // properties._handle (Clarity instance shape).
    if (p.properties && p.properties._handle) return _ffi_addr(p.properties._handle);
  }
  return p;
}

// Allocations use Buffer.allocUnsafeSlow (not Uint8Array, not Buffer.alloc):
// - JavaScriptCore moves TypedArrays during GC, silently invalidating any
//   address captured via bunPtr().
// - Buffer.alloc uses an internal pool for small (< 4KB) allocations
//   that can be relocated/reused, with the same problem.
// allocUnsafeSlow always returns a standalone, non-pooled buffer that
// stays at one address. We zero-fill ourselves since "unsafe" means
// "don't pre-fill".
export function _ffi_alloc(size) {
  const buffer = Buffer.allocUnsafeSlow(size).fill(0);
  return { _buffer: buffer, size };
}

export function _ffi_alloc_cstring(s) {
  const len = Buffer.byteLength(s, 'utf-8');
  const buffer = Buffer.allocUnsafeSlow(len + 1).fill(0);
  buffer.write(s, 0, 'utf-8');
  return { _buffer: buffer, size: buffer.length };
}

export function _ffi_read_cstring(p) {
  const addr = _ffi_addr(p);
  if (!addr) return null;
  return new CString(addr).toString();
}

export function _ffi_ptr_addr(p) { return _ffi_addr(p); }

// Reads. For runtime-owned buffers we read through the underlying DataView
// so writes go through the same view (Bun's read.* sometimes can't see
// modifications made via JS DataView writes on the same Uint8Array).
function _ffi_read_view(p) {
  if (typeof p === 'object' && p !== null && p._buffer) {
    return new DataView(p._buffer.buffer, p._buffer.byteOffset, p._buffer.byteLength);
  }
  return null;
}

export function _ffi_read_u8(p, offset = 0)  { const v = _ffi_read_view(p); return v ? v.getUint8(offset) : bunRead.u8(_ffi_addr(p), offset); }
export function _ffi_read_i8(p, offset = 0)  { const v = _ffi_read_view(p); return v ? v.getInt8(offset)  : bunRead.i8(_ffi_addr(p), offset); }
export function _ffi_read_u16(p, offset = 0) { const v = _ffi_read_view(p); return v ? v.getUint16(offset, true) : bunRead.u16(_ffi_addr(p), offset); }
export function _ffi_read_i16(p, offset = 0) { const v = _ffi_read_view(p); return v ? v.getInt16(offset, true)  : bunRead.i16(_ffi_addr(p), offset); }
export function _ffi_read_u32(p, offset = 0) { const v = _ffi_read_view(p); return v ? v.getUint32(offset, true) : bunRead.u32(_ffi_addr(p), offset); }
export function _ffi_read_i32(p, offset = 0) { const v = _ffi_read_view(p); return v ? v.getInt32(offset, true)  : bunRead.i32(_ffi_addr(p), offset); }
export function _ffi_read_i64(p, offset = 0) { const v = _ffi_read_view(p); return v ? Number(v.getBigInt64(offset, true))  : Number(bunRead.i64(_ffi_addr(p), offset)); }
export function _ffi_read_u64(p, offset = 0) { const v = _ffi_read_view(p); return v ? Number(v.getBigUint64(offset, true)) : Number(bunRead.u64(_ffi_addr(p), offset)); }
export function _ffi_read_f32(p, offset = 0) { const v = _ffi_read_view(p); return v ? v.getFloat32(offset, true) : bunRead.f32(_ffi_addr(p), offset); }
export function _ffi_read_f64(p, offset = 0) { const v = _ffi_read_view(p); return v ? v.getFloat64(offset, true) : bunRead.f64(_ffi_addr(p), offset); }
export function _ffi_read_ptr(p, offset = 0) { return bunRead.ptr(_ffi_addr(p), offset); }

function _ffi_view(p) {
  if (typeof p !== 'object' || !p._buffer) {
    throw new Error('FFIError: cannot write through a pointer this runtime did not allocate');
  }
  return new DataView(p._buffer.buffer, p._buffer.byteOffset, p._buffer.byteLength);
}

export function _ffi_write_u8(p, offset, val)  { _ffi_view(p).setUint8(offset, val); }
export function _ffi_write_i8(p, offset, val)  { _ffi_view(p).setInt8(offset, val); }
export function _ffi_write_u16(p, offset, val) { _ffi_view(p).setUint16(offset, val, true); }
export function _ffi_write_i16(p, offset, val) { _ffi_view(p).setInt16(offset, val, true); }
export function _ffi_write_u32(p, offset, val) { _ffi_view(p).setUint32(offset, val, true); }
export function _ffi_write_i32(p, offset, val) { _ffi_view(p).setInt32(offset, val, true); }
export function _ffi_write_i64(p, offset, val) { _ffi_view(p).setBigInt64(offset, BigInt(val), true); }
export function _ffi_write_u64(p, offset, val) { _ffi_view(p).setBigUint64(offset, BigInt(val), true); }
export function _ffi_write_f32(p, offset, val) { _ffi_view(p).setFloat32(offset, val, true); }
export function _ffi_write_f64(p, offset, val) { _ffi_view(p).setFloat64(offset, val, true); }

// Bulk fill a region of an owned pointer with a u32 pattern. Much faster
// than calling write_u32 in a Clarity loop — used by Framebuffer.clear and
// fill_rect to set hundreds of thousands of pixels at native speed.
export function _ffi_fill_u32(p, byte_offset, count, value) {
  if (!p || !p._buffer) {
    throw new Error('FFIError: fill_u32 requires a runtime-allocated pointer');
  }
  const buf = p._buffer;
  const pattern = Buffer.alloc(4);
  pattern.writeUInt32LE((value >>> 0), 0);
  // Buffer.fill repeats the 4-byte pattern across [start, end).
  buf.fill(pattern, byte_offset, byte_offset + count * 4);
}

// Source-over alpha blend a solid color across `count` 32-bit BGRA
// pixels starting at `byte_offset`. `color` is 0xAARRGGBB; the
// destination is treated as opaque, so results are opaque. Native
// loop — this is the compositor's translucent hot path (glass panels,
// soft shadows, scrims), which must not be an interpreted per-pixel
// loop in Clarity.
export function _ffi_blend_u32(p, byte_offset, count, color) {
  if (!p || !p._buffer) {
    throw new Error('FFIError: blend_u32 requires a runtime-allocated pointer');
  }
  const buf = p._buffer;
  const c = color >>> 0;
  const sa = (c >>> 24) & 0xFF;
  if (sa === 0) return;
  if (sa === 255) {
    const pattern = Buffer.alloc(4);
    pattern.writeUInt32LE(c, 0);
    buf.fill(pattern, byte_offset, byte_offset + count * 4);
    return;
  }
  const sr = (c >>> 16) & 0xFF;
  const sg = (c >>> 8) & 0xFF;
  const sb = c & 0xFF;
  const ia = 255 - sa;
  let o = byte_offset;
  for (let i = 0; i < count; i++) {
    // memory order is B, G, R, A (little-endian 0xAARRGGBB)
    buf[o]     = (sb * sa + buf[o]     * ia) / 255 | 0;
    buf[o + 1] = (sg * sa + buf[o + 1] * ia) / 255 | 0;
    buf[o + 2] = (sr * sa + buf[o + 2] * ia) / 255 | 0;
    buf[o + 3] = 255;
    o += 4;
  }
}

// Bulk copy from one owned (or wrapped) pointer to an owned destination.
export function _ffi_copy(dst, dst_offset, src, src_offset, length) {
  if (!dst || !dst._buffer) {
    throw new Error('FFIError: copy destination must be a runtime-allocated pointer');
  }
  const dbuf = dst._buffer;
  if (src && src._buffer) {
    src._buffer.copy(dbuf, dst_offset, src_offset, src_offset + length);
    return;
  }
  // Foreign source — pull bytes one at a time through bunRead.
  const addr = _ffi_addr(src);
  for (let i = 0; i < length; i++) {
    dbuf[dst_offset + i] = bunRead.u8(addr, src_offset + i);
  }
}

// Write the buffer's bytes to a file path. Useful for save_bmp and friends.
export function _ffi_write_buffer(p, path) {
  if (!p || !p._buffer) {
    throw new Error('FFIError: write_buffer requires a runtime-allocated pointer');
  }
  writeFileSync(path, p._buffer);
}

// Read a file as raw bytes into a Pointer-shaped handle. Handy for
// inspecting binary outputs and as a building block for image loaders.
export function _ffi_read_buffer(path) {
  const data = readFileSync(path);
  return { _buffer: data, size: data.length };
}

// Drop the JS-side buffer reference. The OS-level memory is reclaimed by GC.
// For pointers we didn't allocate (no _buffer), this is a no-op.
export function _ffi_pointer_release(p) {
  if (typeof p === 'object' && p !== null) p._buffer = null;
}

// Wrap a Clarity function as a C callback. The returned handle has an
// `addr` field suitable for passing to a `ptr` parameter, and a `_callback`
// reference that owns the underlying JSCallback (kept alive against GC
// for the lifetime of the handle).
export function _ffi_callback(fn, args, ret) {
  const cb = new JSCallback(fn, {
    args: (args || []).map($ffi_type),
    returns: $ffi_type(ret || 'void'),
  });
  return { addr: cb.ptr, _callback: cb };
}

export function _ffi_callback_close(handle) {
  if (handle && handle._callback) {
    handle._callback.close();
    handle._callback = null;
  }
}
