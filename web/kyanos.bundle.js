// web/build/runtime.js
var FFIType = new Proxy({}, { get: () => 0 });
function bunPtr() {
  throw new Error("bun:ffi ptr unavailable in browser build");
}
var bunRead = new Proxy({}, { get: () => () => {
  throw new Error("bun:ffi read unavailable in browser build");
} });
var process = typeof globalThis !== "undefined" && globalThis.process || {
  platform: "browser",
  env: {},
  argv: [],
  stdout: { write: () => {} },
  stdin: { fd: 0 },
  exit: () => {},
  cwd: () => "/"
};
function $int(v) {
  if (typeof v === "string") {
    const s = v.trim();
    if (/^[+-]?0x/i.test(s))
      return parseInt(s, 16) || 0;
    if (/^[+-]?0o/i.test(s))
      return parseInt(s.replace(/0o/i, ""), 8) || 0;
    if (/^[+-]?0b/i.test(s))
      return parseInt(s.replace(/0b/i, ""), 2) || 0;
    return parseInt(s, 10) || 0;
  }
  return Math.trunc(Number(v));
}
function str(v) {
  return display(v);
}
function $eq(a, b) {
  if (a === b)
    return true;
  if (a == null || b == null)
    return a == null && b == null;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length)
      return false;
    for (let i = 0;i < a.length; i++)
      if (!$eq(a[i], b[i]))
        return false;
    return true;
  }
  if (typeof a === "object" && typeof b === "object") {
    if (a.constructor !== Object || b.constructor !== Object)
      return false;
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length)
      return false;
    for (const k of ka)
      if (!$eq(a[k], b[k]))
        return false;
    return true;
  }
  return false;
}
function $ne(a, b) {
  return !$eq(a, b);
}
function $index(obj, idx) {
  if ((Array.isArray(obj) || typeof obj === "string") && typeof idx === "number" && idx < 0) {
    idx = obj.length + idx;
  }
  const v = obj == null ? undefined : obj[idx];
  return v === undefined ? null : v;
}
function len(v) {
  if (v === null || v === undefined)
    return 0;
  if (typeof v === "string" || Array.isArray(v))
    return v.length;
  if (typeof v === "object")
    return Object.keys(v).length;
  return 0;
}
function push(list, item) {
  list.push(item);
  return list;
}
function keys(obj) {
  return Object.keys(obj);
}
function entries(obj) {
  return Object.entries(obj);
}
function has(obj, key) {
  if (Array.isArray(obj))
    return obj.includes(key);
  if (typeof obj === "string")
    return obj.includes(key);
  return obj != null && key in obj;
}
function split(s, sep = " ") {
  return s.split(sep);
}
function trim(s) {
  return s.trim();
}
function contains(s, sub) {
  if (Array.isArray(s))
    return s.includes(sub);
  return s.includes(sub);
}
function chars(s) {
  return s.split("");
}
function char_at(s, i) {
  return s[i] ?? null;
}
function char_code(s) {
  return s.charCodeAt(0);
}
var sqrt = Math.sqrt;
function sleep(secs) {}
function _pty_supported() {
  return false;
}
function _pty_unavailable() {
  throw new Error("PtyError: pseudo-terminals are not available in the browser build");
}
function _pty_spawn() {
  _pty_unavailable();
}
function _pty_read() {
  _pty_unavailable();
}
function _pty_write() {
  _pty_unavailable();
}
function _pty_resize() {
  _pty_unavailable();
}
function _pty_poll() {
  return false;
}
function _pty_close() {
  return true;
}
function decode64(text) {
  if (typeof atob === "function")
    return decodeURIComponent(escape(atob(text)));
  return "";
}
class ClarityInstance {
  constructor(className, props = {}) {
    this._className = className;
    Object.assign(this, props);
  }
}

class ClarityEnum {
  constructor(name, members) {
    this.name = name;
    this.members = members;
    for (const [k, v] of Object.entries(members)) {
      this[k] = v;
    }
  }
  toString() {
    return `<enum ${this.name}>`;
  }
}
function display(value) {
  if (value === null || value === undefined)
    return "null";
  if (typeof value === "boolean")
    return value ? "true" : "false";
  if (typeof value === "number") {
    if (Number.isInteger(value))
      return String(value);
    return String(value);
  }
  if (typeof value === "string")
    return value;
  if (Array.isArray(value))
    return "[" + value.map(display).join(", ") + "]";
  if (value instanceof ClarityEnum)
    return value.toString();
  if (value instanceof ClarityInstance)
    return `<${value._className} instance>`;
  if (typeof value === "function")
    return `<fn ${value.name || "anonymous"}>`;
  if (typeof value === "object") {
    const pairs = Object.entries(value).map(([k, v]) => `${k}: ${repr(v)}`);
    return "{" + pairs.join(", ") + "}";
  }
  return String(value);
}
function repr(value) {
  if (typeof value === "string")
    return `"${value}"`;
  return display(value);
}
function truthy(value) {
  if (value === null || value === undefined)
    return false;
  if (typeof value === "boolean")
    return value;
  if (typeof value === "number")
    return value !== 0;
  if (typeof value === "string")
    return value.length > 0;
  if (Array.isArray(value))
    return value.length > 0;
  return true;
}
var $FFI_TYPES = {
  void: FFIType.void,
  bool: FFIType.bool,
  int: FFIType.i32,
  i8: FFIType.i8,
  i16: FFIType.i16,
  i32: FFIType.i32,
  i64: FFIType.i64,
  u8: FFIType.u8,
  u16: FFIType.u16,
  u32: FFIType.u32,
  u64: FFIType.u64,
  float: FFIType.f32,
  f32: FFIType.f32,
  f64: FFIType.f64,
  double: FFIType.f64,
  ptr: FFIType.ptr,
  pointer: FFIType.ptr,
  string: FFIType.cstring,
  cstring: FFIType.cstring,
  char: FFIType.char
};
function _ffi_addr(p) {
  if (p === null || p === undefined)
    return 0;
  if (typeof p === "number" || typeof p === "bigint")
    return p;
  if (typeof p === "object") {
    if (p._buffer)
      return bunPtr(p._buffer);
    if ("addr" in p)
      return p.addr;
    if (p.properties && p.properties._handle)
      return _ffi_addr(p.properties._handle);
  }
  return p;
}
function _ffi_alloc(size) {
  return { _buffer: new Uint8Array(size), size };
}
function _ffi_read_cstring(p) {
  if (typeof p === "object" && p !== null && p._buffer) {
    const buf = p._buffer;
    let end = 0;
    while (end < buf.length && buf[end] !== 0)
      end++;
    return new TextDecoder().decode(buf.subarray(0, end));
  }
  return null;
}
function _ffi_ptr_addr(p) {
  return _ffi_addr(p);
}
function _ffi_read_view(p) {
  if (typeof p === "object" && p !== null && p._buffer) {
    return new DataView(p._buffer.buffer, p._buffer.byteOffset, p._buffer.byteLength);
  }
  return null;
}
function _ffi_read_u8(p, offset = 0) {
  const v = _ffi_read_view(p);
  return v ? v.getUint8(offset) : bunRead.u8(_ffi_addr(p), offset);
}
function _ffi_read_i8(p, offset = 0) {
  const v = _ffi_read_view(p);
  return v ? v.getInt8(offset) : bunRead.i8(_ffi_addr(p), offset);
}
function _ffi_read_u16(p, offset = 0) {
  const v = _ffi_read_view(p);
  return v ? v.getUint16(offset, true) : bunRead.u16(_ffi_addr(p), offset);
}
function _ffi_read_i16(p, offset = 0) {
  const v = _ffi_read_view(p);
  return v ? v.getInt16(offset, true) : bunRead.i16(_ffi_addr(p), offset);
}
function _ffi_read_u32(p, offset = 0) {
  const v = _ffi_read_view(p);
  return v ? v.getUint32(offset, true) : bunRead.u32(_ffi_addr(p), offset);
}
function _ffi_read_i32(p, offset = 0) {
  const v = _ffi_read_view(p);
  return v ? v.getInt32(offset, true) : bunRead.i32(_ffi_addr(p), offset);
}
function _ffi_read_i64(p, offset = 0) {
  const v = _ffi_read_view(p);
  return v ? Number(v.getBigInt64(offset, true)) : Number(bunRead.i64(_ffi_addr(p), offset));
}
function _ffi_read_u64(p, offset = 0) {
  const v = _ffi_read_view(p);
  return v ? Number(v.getBigUint64(offset, true)) : Number(bunRead.u64(_ffi_addr(p), offset));
}
function _ffi_read_f32(p, offset = 0) {
  const v = _ffi_read_view(p);
  return v ? v.getFloat32(offset, true) : bunRead.f32(_ffi_addr(p), offset);
}
function _ffi_read_f64(p, offset = 0) {
  const v = _ffi_read_view(p);
  return v ? v.getFloat64(offset, true) : bunRead.f64(_ffi_addr(p), offset);
}
function _ffi_read_ptr(p, offset = 0) {
  return bunRead.ptr(_ffi_addr(p), offset);
}
function _ffi_view(p) {
  if (typeof p !== "object" || !p._buffer) {
    throw new Error("FFIError: cannot write through a pointer this runtime did not allocate");
  }
  return new DataView(p._buffer.buffer, p._buffer.byteOffset, p._buffer.byteLength);
}
function _ffi_write_u8(p, offset, val) {
  _ffi_view(p).setUint8(offset, val);
}
function _ffi_write_i8(p, offset, val) {
  _ffi_view(p).setInt8(offset, val);
}
function _ffi_write_u16(p, offset, val) {
  _ffi_view(p).setUint16(offset, val, true);
}
function _ffi_write_i16(p, offset, val) {
  _ffi_view(p).setInt16(offset, val, true);
}
function _ffi_write_u32(p, offset, val) {
  _ffi_view(p).setUint32(offset, val, true);
}
function _ffi_write_i32(p, offset, val) {
  _ffi_view(p).setInt32(offset, val, true);
}
function _ffi_write_i64(p, offset, val) {
  _ffi_view(p).setBigInt64(offset, BigInt(val), true);
}
function _ffi_write_u64(p, offset, val) {
  _ffi_view(p).setBigUint64(offset, BigInt(val), true);
}
function _ffi_write_f32(p, offset, val) {
  _ffi_view(p).setFloat32(offset, val, true);
}
function _ffi_write_f64(p, offset, val) {
  _ffi_view(p).setFloat64(offset, val, true);
}
function _ffi_fill_u32(p, byte_offset, count, value) {
  if (!p || !p._buffer) {
    throw new Error("FFIError: fill_u32 requires a runtime-allocated pointer");
  }
  const buf = p._buffer;
  const v = value >>> 0;
  if ((buf.byteOffset + byte_offset) % 4 === 0) {
    const u32 = new Uint32Array(buf.buffer, buf.byteOffset + byte_offset, count);
    u32.fill(v);
    return;
  }
  const b0 = v & 255, b1 = v >>> 8 & 255, b2 = v >>> 16 & 255, b3 = v >>> 24 & 255;
  let o = byte_offset;
  for (let i = 0;i < count; i++) {
    buf[o] = b0;
    buf[o + 1] = b1;
    buf[o + 2] = b2;
    buf[o + 3] = b3;
    o += 4;
  }
}
function _ffi_blend_u32(p, byte_offset, count, color) {
  if (!p || !p._buffer) {
    throw new Error("FFIError: blend_u32 requires a runtime-allocated pointer");
  }
  const buf = p._buffer;
  const c = color >>> 0;
  const sa = c >>> 24 & 255;
  if (sa === 0)
    return;
  if (sa === 255) {
    _ffi_fill_u32(p, byte_offset, count, c);
    return;
  }
  const sr = c >>> 16 & 255;
  const sg = c >>> 8 & 255;
  const sb = c & 255;
  const ia = 255 - sa;
  let o = byte_offset;
  for (let i = 0;i < count; i++) {
    buf[o] = (sb * sa + buf[o] * ia) / 255 | 0;
    buf[o + 1] = (sg * sa + buf[o + 1] * ia) / 255 | 0;
    buf[o + 2] = (sr * sa + buf[o + 2] * ia) / 255 | 0;
    buf[o + 3] = 255;
    o += 4;
  }
}
function _ffi_box_blur(p, width, height, radius, passes) {
  if (!p || !p._buffer) {
    throw new Error("FFIError: box_blur requires a runtime-allocated pointer");
  }
  if (radius < 1)
    return;
  const buf = p._buffer;
  const w = width | 0, h = height | 0, r = radius | 0;
  const win = 2 * r + 1;
  const line = new Int32Array(Math.max(w, h) * 3);
  for (let pass = 0;pass < passes; pass++) {
    for (let y = 0;y < h; y++) {
      const row = y * w * 4;
      for (let x = 0;x < w; x++) {
        const o = row + x * 4;
        line[x * 3] = buf[o + 2];
        line[x * 3 + 1] = buf[o + 1];
        line[x * 3 + 2] = buf[o];
      }
      let sr = 0, sg = 0, sb = 0;
      for (let i = -r;i <= r; i++) {
        const c = i < 0 ? 0 : i >= w ? w - 1 : i;
        sr += line[c * 3];
        sg += line[c * 3 + 1];
        sb += line[c * 3 + 2];
      }
      for (let x = 0;x < w; x++) {
        const o = row + x * 4;
        buf[o] = sb / win | 0;
        buf[o + 1] = sg / win | 0;
        buf[o + 2] = sr / win | 0;
        buf[o + 3] = 255;
        const oi = x - r, ii = x + r + 1;
        const oc = oi < 0 ? 0 : oi, ic = ii >= w ? w - 1 : ii;
        sr += line[ic * 3] - line[oc * 3];
        sg += line[ic * 3 + 1] - line[oc * 3 + 1];
        sb += line[ic * 3 + 2] - line[oc * 3 + 2];
      }
    }
    for (let x = 0;x < w; x++) {
      for (let y = 0;y < h; y++) {
        const o = (y * w + x) * 4;
        line[y * 3] = buf[o + 2];
        line[y * 3 + 1] = buf[o + 1];
        line[y * 3 + 2] = buf[o];
      }
      let sr = 0, sg = 0, sb = 0;
      for (let i = -r;i <= r; i++) {
        const c = i < 0 ? 0 : i >= h ? h - 1 : i;
        sr += line[c * 3];
        sg += line[c * 3 + 1];
        sb += line[c * 3 + 2];
      }
      for (let y = 0;y < h; y++) {
        const o = (y * w + x) * 4;
        buf[o] = sb / win | 0;
        buf[o + 1] = sg / win | 0;
        buf[o + 2] = sr / win | 0;
        buf[o + 3] = 255;
        const oi = y - r, ii = y + r + 1;
        const oc = oi < 0 ? 0 : oi, ic = ii >= h ? h - 1 : ii;
        sr += line[ic * 3] - line[oc * 3];
        sg += line[ic * 3 + 1] - line[oc * 3 + 1];
        sb += line[ic * 3 + 2] - line[oc * 3 + 2];
      }
    }
  }
}
function _ffi_blit_scaled_alpha(dstP, dstW, dstH, srcP, srcW, srcH, dx, dy, dw, dh, alpha) {
  if (!dstP || !dstP._buffer || !srcP || !srcP._buffer) {
    throw new Error("FFIError: blit_scaled_alpha requires runtime-allocated pointers");
  }
  const a = alpha | 0;
  if (a <= 0 || dw <= 0 || dh <= 0)
    return;
  const d = dstP._buffer, s = srcP._buffer;
  const DW = dstW | 0, DH = dstH | 0, SW = srcW | 0, SH = srcH | 0;
  const x0 = Math.max(0, dx | 0), y0 = Math.max(0, dy | 0);
  const x1 = Math.min(DW, dx + dw | 0), y1 = Math.min(DH, dy + dh | 0);
  if (x1 <= x0 || y1 <= y0)
    return;
  const ia = 255 - a;
  for (let y = y0;y < y1; y++) {
    let fv = (y - dy) / dh * SH;
    if (fv < 0)
      fv = 0;
    let sy = fv | 0;
    let vy = fv - sy;
    let sy2 = sy + 1;
    if (sy2 >= SH) {
      sy2 = SH - 1;
    }
    if (sy >= SH) {
      sy = SH - 1;
    }
    const rowd = y * DW * 4, row0 = sy * SW * 4, row1 = sy2 * SW * 4;
    for (let x = x0;x < x1; x++) {
      let fu = (x - dx) / dw * SW;
      if (fu < 0)
        fu = 0;
      let sx = fu | 0;
      let ux = fu - sx;
      let sx2 = sx + 1;
      if (sx2 >= SW) {
        sx2 = SW - 1;
      }
      if (sx >= SW) {
        sx = SW - 1;
      }
      const c0 = row0 + sx * 4, c1 = row0 + sx2 * 4, c2 = row1 + sx * 4, c3 = row1 + sx2 * 4;
      const w00 = (1 - ux) * (1 - vy), w10 = ux * (1 - vy), w01 = (1 - ux) * vy, w11 = ux * vy;
      const b = s[c0] * w00 + s[c1] * w10 + s[c2] * w01 + s[c3] * w11 | 0;
      const g = s[c0 + 1] * w00 + s[c1 + 1] * w10 + s[c2 + 1] * w01 + s[c3 + 1] * w11 | 0;
      const r = s[c0 + 2] * w00 + s[c1 + 2] * w10 + s[c2 + 2] * w01 + s[c3 + 2] * w11 | 0;
      const o = rowd + x * 4;
      if (a === 255) {
        d[o] = b;
        d[o + 1] = g;
        d[o + 2] = r;
        d[o + 3] = 255;
      } else {
        d[o] = (b * a + d[o] * ia) / 255 | 0;
        d[o + 1] = (g * a + d[o + 1] * ia) / 255 | 0;
        d[o + 2] = (r * a + d[o + 2] * ia) / 255 | 0;
        d[o + 3] = 255;
      }
    }
  }
}
function _ffi_copy(dst, dst_offset, src, src_offset, length) {
  if (!dst || !dst._buffer) {
    throw new Error("FFIError: copy destination must be a runtime-allocated pointer");
  }
  const dbuf = dst._buffer;
  if (src && src._buffer) {
    dbuf.set(src._buffer.subarray(src_offset, src_offset + length), dst_offset);
    return;
  }
  throw new Error("FFIError: copy source must be a runtime-allocated pointer in browser build");
}
function _ffi_write_buffer(p, path) {
  if (!p || !p._buffer) {
    throw new Error("FFIError: write_buffer requires a runtime-allocated pointer");
  }
}
function _ffi_pointer_release(p) {
  if (typeof p === "object" && p !== null)
    p._buffer = null;
}

// web/build/ffi.js
class Pointer {
  constructor(handle) {
    this._handle = handle;
  }
  addr() {
    return _ffi_ptr_addr(this._handle);
  }
  size() {
    return this._handle.size;
  }
  read_u8(offset) {
    return _ffi_read_u8(this._handle, offset ?? 0);
  }
  read_i8(offset) {
    return _ffi_read_i8(this._handle, offset ?? 0);
  }
  read_u16(offset) {
    return _ffi_read_u16(this._handle, offset ?? 0);
  }
  read_i16(offset) {
    return _ffi_read_i16(this._handle, offset ?? 0);
  }
  read_u32(offset) {
    return _ffi_read_u32(this._handle, offset ?? 0);
  }
  read_i32(offset) {
    return _ffi_read_i32(this._handle, offset ?? 0);
  }
  read_u64(offset) {
    return _ffi_read_u64(this._handle, offset ?? 0);
  }
  read_i64(offset) {
    return _ffi_read_i64(this._handle, offset ?? 0);
  }
  read_f32(offset) {
    return _ffi_read_f32(this._handle, offset ?? 0);
  }
  read_f64(offset) {
    return _ffi_read_f64(this._handle, offset ?? 0);
  }
  read_ptr(offset) {
    return _ffi_read_ptr(this._handle, offset ?? 0);
  }
  read_byte(offset) {
    return this.read_u8(offset);
  }
  read_int(offset) {
    return this.read_i32(offset);
  }
  read_long(offset) {
    return this.read_i64(offset);
  }
  read_float(offset) {
    return this.read_f32(offset);
  }
  read_double(offset) {
    return this.read_f64(offset);
  }
  read_string() {
    return _ffi_read_cstring(this._handle);
  }
  write_u8(offset, val) {
    _ffi_write_u8(this._handle, offset, val);
  }
  write_i8(offset, val) {
    _ffi_write_i8(this._handle, offset, val);
  }
  write_u16(offset, val) {
    _ffi_write_u16(this._handle, offset, val);
  }
  write_i16(offset, val) {
    _ffi_write_i16(this._handle, offset, val);
  }
  write_u32(offset, val) {
    _ffi_write_u32(this._handle, offset, val);
  }
  write_i32(offset, val) {
    _ffi_write_i32(this._handle, offset, val);
  }
  write_u64(offset, val) {
    _ffi_write_u64(this._handle, offset, val);
  }
  write_i64(offset, val) {
    _ffi_write_i64(this._handle, offset, val);
  }
  write_f32(offset, val) {
    _ffi_write_f32(this._handle, offset, val);
  }
  write_f64(offset, val) {
    _ffi_write_f64(this._handle, offset, val);
  }
  write_byte(offset, val) {
    this.write_u8(offset, val);
  }
  write_int(offset, val) {
    this.write_i32(offset, val);
  }
  write_long(offset, val) {
    this.write_i64(offset, val);
  }
  write_float(offset, val) {
    this.write_f32(offset, val);
  }
  write_double(offset, val) {
    this.write_f64(offset, val);
  }
  free() {
    _ffi_pointer_release(this._handle);
  }
}
function alloc(size) {
  return new Pointer(_ffi_alloc(size));
}

// web/build/graphics.js
function rgba(r, g, b, a) {
  return a * 16777216 + r * 65536 + g * 256 + b;
}
function rgb(r, g, b) {
  return rgba(r, g, b, 255);
}
var BLACK = rgb(0, 0, 0);
var WHITE = rgb(255, 255, 255);
var RED = rgb(255, 0, 0);
var GREEN = rgb(0, 255, 0);
var BLUE = rgb(0, 0, 255);
var YELLOW = rgb(255, 255, 0);
var CYAN = rgb(0, 255, 255);
var MAGENTA = rgb(255, 0, 255);
var GRAY = rgb(128, 128, 128);
var TRANSPARENT = rgba(0, 0, 0, 0);
class Framebuffer {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.stride = width * 4;
    this.size = this.stride * height;
    this.buffer = alloc(this.size);
  }
  _offset(x, y) {
    return $int(y) * this.stride + $int(x) * 4;
  }
  put_pixel(x, y, color) {
    if (truthy(x < 0 || x >= this.width || y < 0 || y >= this.height)) {
      return null;
    }
    this.buffer.write_u32(this._offset(x, y), color);
  }
  get_pixel(x, y) {
    if (truthy(x < 0 || x >= this.width || y < 0 || y >= this.height)) {
      return 0;
    }
    return this.buffer.read_u32(this._offset(x, y));
  }
  clear(color) {
    _ffi_fill_u32(this.buffer._handle, 0, this.width * this.height, color);
  }
  fill_rect(x0, y0, w, h, color) {
    let x_start = truthy(x0 < 0) ? 0 : $int(x0);
    let y_start = truthy(y0 < 0) ? 0 : $int(y0);
    let x_end = truthy(x0 + w > this.width) ? this.width : $int(x0 + w);
    let y_end = truthy(y0 + h > this.height) ? this.height : $int(y0 + h);
    if (truthy(x_end <= x_start || y_end <= y_start)) {
      return null;
    }
    let row_count = x_end - x_start;
    let y = y_start;
    while (truthy(y < y_end)) {
      _ffi_fill_u32(this.buffer._handle, this._offset(x_start, y), row_count, color);
      y += 1;
    }
  }
  blend_rect(x0, y0, w, h, color) {
    let x_start = truthy(x0 < 0) ? 0 : $int(x0);
    let y_start = truthy(y0 < 0) ? 0 : $int(y0);
    let x_end = truthy(x0 + w > this.width) ? this.width : $int(x0 + w);
    let y_end = truthy(y0 + h > this.height) ? this.height : $int(y0 + h);
    if (truthy(x_end <= x_start || y_end <= y_start)) {
      return null;
    }
    let count = x_end - x_start;
    let y = y_start;
    while (truthy(y < y_end)) {
      _ffi_blend_u32(this.buffer._handle, this._offset(x_start, y), count, color);
      y += 1;
    }
  }
  stroke_rect(x0, y0, w, h, color) {
    if (truthy(w <= 0 || h <= 0)) {
      return null;
    }
    this.fill_rect(x0, y0, w, 1, color);
    this.fill_rect(x0, y0 + h - 1, w, 1, color);
    this.fill_rect(x0, y0, 1, h, color);
    this.fill_rect(x0 + w - 1, y0, 1, h, color);
  }
  blit(src, src_x, src_y, dst_x, dst_y, w, h) {
    let sx = src_x;
    let sy = src_y;
    let dx = dst_x;
    let dy = dst_y;
    let cw = w;
    let ch = h;
    if (truthy(dx < 0)) {
      sx = sx - dx;
      cw = cw + dx;
      dx = 0;
    }
    if (truthy(dy < 0)) {
      sy = sy - dy;
      ch = ch + dy;
      dy = 0;
    }
    if (truthy(sx < 0)) {
      dx = dx - sx;
      cw = cw + sx;
      sx = 0;
    }
    if (truthy(sy < 0)) {
      dy = dy - sy;
      ch = ch + sy;
      sy = 0;
    }
    if (truthy(dx + cw > this.width)) {
      cw = this.width - dx;
    }
    if (truthy(dy + ch > this.height)) {
      ch = this.height - dy;
    }
    if (truthy(sx + cw > src.width)) {
      cw = src.width - sx;
    }
    if (truthy(sy + ch > src.height)) {
      ch = src.height - sy;
    }
    if (truthy(cw <= 0 || ch <= 0)) {
      return null;
    }
    let row_bytes = cw * 4;
    let row = 0;
    while (truthy(row < ch)) {
      let s_off = (sy + row) * src.stride + sx * 4;
      let d_off = (dy + row) * this.stride + dx * 4;
      _ffi_copy(this.buffer._handle, d_off, src.buffer._handle, s_off, row_bytes);
      row += 1;
    }
  }
  save_bmp(path) {
    let pixel_bytes = this.size;
    let file_size = 14 + 40 + pixel_bytes;
    let header = alloc(54 + pixel_bytes);
    header.write_u8(0, 66);
    header.write_u8(1, 77);
    header.write_u32(2, file_size);
    header.write_u32(6, 0);
    header.write_u32(10, 54);
    header.write_u32(14, 40);
    header.write_i32(18, this.width);
    header.write_i32(22, this.height);
    header.write_u16(26, 1);
    header.write_u16(28, 32);
    header.write_u32(30, 0);
    header.write_u32(34, pixel_bytes);
    header.write_i32(38, 2835);
    header.write_i32(42, 2835);
    header.write_u32(46, 0);
    header.write_u32(50, 0);
    let y = 0;
    while (truthy(y < this.height)) {
      let src_offset = y * this.stride;
      let dst_offset = 54 + (this.height - 1 - y) * this.stride;
      _ffi_copy(header._handle, dst_offset, this.buffer._handle, src_offset, this.stride);
      y += 1;
    }
    _ffi_write_buffer(header._handle, path);
  }
}
function framebuffer(width, height) {
  return new Framebuffer(width, height);
}

// web/build/compositor.js
class Compositor {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.screen = framebuffer(width, height);
    this.background = 4280163870;
    this.windows = [];
    this._dirty = [];
    this._all_dirty = true;
  }
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.screen = framebuffer(width, height);
    this._all_dirty = true;
    return true;
  }
  add(window) {
    push(this.windows, window);
    this.mark_window(window);
  }
  remove(window) {
    let out = [];
    for (let w of this.windows) {
      if (truthy($ne(w, window))) {
        push(out, w);
      }
    }
    this.windows = out;
    this.mark_window(window);
  }
  focus(window) {
    let others = [];
    let found = false;
    for (let w of this.windows) {
      if (truthy($eq(w, window))) {
        found = true;
      } else {
        push(others, w);
      }
    }
    if (truthy(!truthy(found))) {
      return null;
    }
    for (let w of this.windows) {
      if (truthy($ne(w, window) && w.focused)) {
        w.blur();
      }
    }
    window.focus();
    push(others, window);
    this.windows = others;
    this.mark_window(window);
  }
  top_window() {
    if (truthy($eq(len(this.windows), 0))) {
      return null;
    }
    return $index(this.windows, len(this.windows) - 1);
  }
  window_at(px, py) {
    let i = len(this.windows) - 1;
    while (truthy(i >= 0)) {
      let w = $index(this.windows, i);
      if (truthy(w.visible && !truthy(w.minimized) && w.contains(px, py))) {
        return w;
      }
      i -= 1;
    }
    return null;
  }
  set_background(color) {
    this.background = color;
    this._all_dirty = true;
  }
  paint(rect) {
    push(this._dirty, rect);
  }
  mark_window(window) {
    this.paint([window.x, window.y, window.width, window.height]);
  }
  mark_all() {
    this._all_dirty = true;
    this._dirty = [];
  }
  render() {
    if (truthy(!truthy(this._all_dirty) && $eq(len(this._dirty), 0))) {
      return 0;
    }
    let regions = truthy(this._all_dirty) ? [[0, 0, this.width, this.height]] : _coalesce(this._dirty);
    let touched = 0;
    for (let region of regions) {
      this._fill_region(region, this.background);
      for (let w of this.windows) {
        if (truthy(!truthy(w.visible) || w.minimized)) {
          continue;
        }
        if (truthy($ne(_intersect_rect(region, [w.x, w.y, w.width, w.height]), null))) {
          this._blit_window(w, region);
          touched += 1;
        }
      }
    }
    this._dirty = [];
    this._all_dirty = false;
    return touched;
  }
  render_full() {
    this._all_dirty = true;
    return this.render();
  }
  _fill_region(rect, color) {
    let x = truthy($index(rect, 0) < 0) ? 0 : $index(rect, 0);
    let y = truthy($index(rect, 1) < 0) ? 0 : $index(rect, 1);
    let r = $index(rect, 0) + $index(rect, 2);
    let b = $index(rect, 1) + $index(rect, 3);
    let xe = truthy(r > this.width) ? this.width : r;
    let ye = truthy(b > this.height) ? this.height : b;
    if (truthy(xe <= x || ye <= y)) {
      return null;
    }
    this.screen.fill_rect(x, y, xe - x, ye - y, color);
  }
  _blit_window(window, clip) {
    let win_rect = [window.x, window.y, window.width, window.height];
    let inter = _intersect_rect(win_rect, clip);
    if (truthy($eq(inter, null))) {
      return null;
    }
    let dx = $index(inter, 0);
    let dy = $index(inter, 1);
    let w = $index(inter, 2);
    let h = $index(inter, 3);
    let sx = dx - window.x;
    let sy = dy - window.y;
    this.screen.blit(window.framebuffer, sx, sy, dx, dy, w, h);
  }
}
function _intersect_rect(a, b) {
  let ax = $index(a, 0);
  let ay = $index(a, 1);
  let aw = $index(a, 2);
  let ah = $index(a, 3);
  let bx = $index(b, 0);
  let by = $index(b, 1);
  let bw = $index(b, 2);
  let bh = $index(b, 3);
  let x = truthy(ax > bx) ? ax : bx;
  let y = truthy(ay > by) ? ay : by;
  let xe = truthy(ax + aw < bx + bw) ? ax + aw : bx + bw;
  let ye = truthy(ay + ah < by + bh) ? ay + ah : by + bh;
  if (truthy(xe <= x || ye <= y)) {
    return null;
  }
  return [x, y, xe - x, ye - y];
}
function _coalesce(rects) {
  let working = [];
  for (let r of rects) {
    push(working, r);
  }
  let changed = true;
  while (truthy(changed)) {
    changed = false;
    let next_pass = [];
    let consumed = [];
    let i = 0;
    while (truthy(i < len(working))) {
      push(consumed, false);
      i += 1;
    }
    let n = len(working);
    let a = 0;
    while (truthy(a < n)) {
      if (truthy(!truthy($index(consumed, a)))) {
        let merged = $index(working, a);
        let b = a + 1;
        while (truthy(b < n)) {
          if (truthy(!truthy($index(consumed, b)) && $ne(_intersect_rect(merged, $index(working, b)), null))) {
            merged = _bounding(merged, $index(working, b));
            consumed[b] = true;
            changed = true;
          }
          b += 1;
        }
        push(next_pass, merged);
      }
      a += 1;
    }
    working = next_pass;
  }
  return working;
}
function _bounding(a, b) {
  let x = truthy($index(a, 0) < $index(b, 0)) ? $index(a, 0) : $index(b, 0);
  let y = truthy($index(a, 1) < $index(b, 1)) ? $index(a, 1) : $index(b, 1);
  let xe = truthy($index(a, 0) + $index(a, 2) > $index(b, 0) + $index(b, 2)) ? $index(a, 0) + $index(a, 2) : $index(b, 0) + $index(b, 2);
  let ye = truthy($index(a, 1) + $index(a, 3) > $index(b, 1) + $index(b, 3)) ? $index(a, 1) + $index(a, 3) : $index(b, 1) + $index(b, 3);
  return [x, y, xe - x, ye - y];
}
function compositor(width, height) {
  return new Compositor(width, height);
}

// web/build/window.js
class Window {
  constructor(title, x, y, width, height) {
    this.title = title;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.title_h = 24;
    this.border_w = 1;
    this.resize_h = 12;
    this.framebuffer = framebuffer(width, height);
    this.visible = true;
    this.focused = false;
    this.resizable = true;
    this.minimized = false;
    this.maximized = false;
    this._restored = null;
  }
  move(x, y) {
    this.x = x;
    this.y = y;
  }
  resize(w, h) {
    if (truthy($eq(w, this.width) && $eq(h, this.height))) {
      return null;
    }
    if (truthy(w < 1)) {
      w = 1;
    }
    if (truthy(h < 1)) {
      h = 1;
    }
    this.width = w;
    this.height = h;
    this.framebuffer = framebuffer(w, h);
  }
  content_rect() {
    let x = this.border_w;
    let y = this.title_h;
    let w = this.width - 2 * this.border_w;
    let h = this.height - this.title_h - this.border_w;
    return [x, truthy(y > 0) ? y : 0, truthy(w > 0) ? w : 0, truthy(h > 0) ? h : 0];
  }
  title_rect() {
    return [0, 0, this.width, this.title_h];
  }
  resize_rect() {
    if (truthy(!truthy(this.resizable))) {
      return null;
    }
    let s = this.resize_h;
    return [this.width - s, this.height - s, s, s];
  }
  contains(px, py) {
    return px >= this.x && px < this.x + this.width && py >= this.y && py < this.y + this.height;
  }
  hit_test(px, py) {
    if (truthy(!truthy(this.contains(px, py)))) {
      return null;
    }
    let lx = px - this.x;
    let ly = py - this.y;
    let rr = this.resize_rect();
    if (truthy($ne(rr, null) && lx >= $index(rr, 0) && ly >= $index(rr, 1))) {
      return "resize";
    }
    if (truthy(ly < this.title_h)) {
      return "title";
    }
    let cr = this.content_rect();
    if (truthy(lx >= $index(cr, 0) && lx < $index(cr, 0) + $index(cr, 2) && ly >= $index(cr, 1) && ly < $index(cr, 1) + $index(cr, 3))) {
      return "content";
    }
    return "border";
  }
  focus() {
    this.focused = true;
  }
  blur() {
    this.focused = false;
  }
  set_visible(v) {
    this.visible = v;
  }
  minimize() {
    this.minimized = true;
  }
  restore_from_min() {
    this.minimized = false;
  }
  maximize(screen_w, screen_h) {
    if (truthy(this.maximized)) {
      return null;
    }
    this._restored = [this.x, this.y, this.width, this.height];
    this.x = 0;
    this.y = 0;
    this.resize(screen_w, screen_h);
    this.maximized = true;
  }
  unmaximize() {
    if (truthy(!truthy(this.maximized) || $eq(this._restored, null))) {
      return null;
    }
    this.x = $index(this._restored, 0);
    this.y = $index(this._restored, 1);
    this.resize($index(this._restored, 2), $index(this._restored, 3));
    this.maximized = false;
    this._restored = null;
  }
}
function window(title, x, y, width, height) {
  return new Window(title, x, y, width, height);
}

// web/build/mouse.js
class MouseEvent {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.dx = 0;
    this.dy = 0;
    this.scroll_x = 0;
    this.scroll_y = 0;
    this.button = 0;
    this.is_press = false;
    this.is_release = false;
    this.is_motion = false;
    this.is_scroll = false;
  }
  is_click() {
    return this.is_press;
  }
}

// web/build/window_manager.js
var _DRAG_NONE = "none";
var _DRAG_MOVE = "move";
var _DRAG_RESIZE = "resize";

class WindowManager {
  constructor(compositor2) {
    this.compositor = compositor2;
    this._mode = _DRAG_NONE;
    this._target = null;
    this._anchor_x = 0;
    this._anchor_y = 0;
    this._origin_x = 0;
    this._origin_y = 0;
    this._origin_w = 0;
    this._origin_h = 0;
    this.snap_threshold = 12;
    this.min_window_w = 80;
    this.min_window_h = 40;
  }
  add(window2) {
    this.compositor.add(window2);
  }
  remove(window2) {
    this.compositor.remove(window2);
  }
  focus(window2) {
    this.compositor.focus(window2);
  }
  windows() {
    return this.compositor.windows;
  }
  attach_to_bus(bus) {
    let wm = this;
    bus.on_mouse((me) => wm.handle_mouse(me));
    bus.on_key((ke) => wm.handle_key(ke));
    return this;
  }
  handle_mouse(me) {
    if (truthy(me.is_press)) {
      return this._on_press(me);
    }
    if (truthy(me.is_release)) {
      return this._on_release(me);
    }
    if (truthy(me.is_motion)) {
      return this._on_motion(me);
    }
    return false;
  }
  _on_press(me) {
    let target = this.compositor.window_at(me.x, me.y);
    if (truthy($eq(target, null))) {
      return false;
    }
    this.compositor.focus(target);
    if (truthy($ne(me.button, 1))) {
      return true;
    }
    let zone = target.hit_test(me.x, me.y);
    if (truthy($eq(zone, "title"))) {
      this._mode = _DRAG_MOVE;
    } else if (truthy($eq(zone, "resize") && target.resizable)) {
      this._mode = _DRAG_RESIZE;
    } else {
      return true;
    }
    this._target = target;
    this._anchor_x = me.x;
    this._anchor_y = me.y;
    this._origin_x = target.x;
    this._origin_y = target.y;
    this._origin_w = target.width;
    this._origin_h = target.height;
    return true;
  }
  _on_release(me) {
    if (truthy($eq(this._mode, _DRAG_NONE))) {
      return false;
    }
    if (truthy($eq(this._mode, _DRAG_MOVE))) {
      this._snap(this._target);
    }
    this._mode = _DRAG_NONE;
    this._target = null;
    return true;
  }
  _on_motion(me) {
    if (truthy($eq(this._mode, _DRAG_NONE) || $eq(this._target, null))) {
      return false;
    }
    let dx = me.x - this._anchor_x;
    let dy = me.y - this._anchor_y;
    let win = this._target;
    let prev_rect = [win.x, win.y, win.width, win.height];
    if (truthy($eq(this._mode, _DRAG_MOVE))) {
      win.move(this._origin_x + dx, this._origin_y + dy);
    } else {
      let nw = this._origin_w + dx;
      let nh = this._origin_h + dy;
      if (truthy(nw < this.min_window_w)) {
        nw = this.min_window_w;
      }
      if (truthy(nh < this.min_window_h)) {
        nh = this.min_window_h;
      }
      win.resize(nw, nh);
    }
    this.compositor.paint(prev_rect);
    this.compositor.mark_window(win);
    return true;
  }
  _snap(window2) {
    if (truthy($eq(window2, null))) {
      return null;
    }
    let s = this.snap_threshold;
    let prev_rect = [window2.x, window2.y, window2.width, window2.height];
    let nx = window2.x;
    let ny = window2.y;
    if (truthy(window2.x < s)) {
      nx = 0;
    }
    if (truthy(window2.y < s)) {
      ny = 0;
    }
    let right_gap = this.compositor.width - (window2.x + window2.width);
    let bottom_gap = this.compositor.height - (window2.y + window2.height);
    if (truthy(right_gap >= 0 - s && right_gap < s)) {
      nx = this.compositor.width - window2.width;
    }
    if (truthy(bottom_gap >= 0 - s && bottom_gap < s)) {
      ny = this.compositor.height - window2.height;
    }
    if (truthy($ne(nx, window2.x) || $ne(ny, window2.y))) {
      window2.move(nx, ny);
      this.compositor.paint(prev_rect);
      this.compositor.mark_window(window2);
    }
  }
  handle_key(ke) {
    if (truthy(ke.is_press && $index(ke.modifiers, "alt") && $eq(ke.name, "Tab"))) {
      this.cycle_focus();
      return true;
    }
    return false;
  }
  cycle_focus() {
    let n = len(this.compositor.windows);
    if (truthy(n < 2)) {
      return null;
    }
    let current = this.compositor.top_window();
    let next_w = null;
    let i = n - 2;
    while (truthy(i >= 0 && $eq(next_w, null))) {
      let w = $index(this.compositor.windows, i);
      if (truthy(w.visible && !truthy(w.minimized))) {
        next_w = w;
      }
      i -= 1;
    }
    if (truthy($eq(next_w, null))) {
      return null;
    }
    this.compositor.focus(next_w);
  }
  is_dragging() {
    return $ne(this._mode, _DRAG_NONE);
  }
  drag_mode() {
    return this._mode;
  }
  drag_target() {
    return this._target;
  }
}
function window_manager(compositor2) {
  return new WindowManager(compositor2);
}

// web/build/draw.js
function hline(fb, x0, y, x1, color) {
  let xa = truthy(x0 < x1) ? x0 : x1;
  let xb = truthy(x0 < x1) ? x1 : x0;
  fb.fill_rect(xa, y, xb - xa + 1, 1, color);
}
function fill_rect(fb, x, y, w, h, color) {
  fb.fill_rect(x, y, w, h, color);
}
function circle(fb, cx, cy, r, color) {
  if (truthy(r < 0)) {
    return null;
  }
  let r2 = r * r;
  let dy = 0 - r;
  while (truthy(dy <= r)) {
    let dx = 0;
    while (truthy((dx + 1) * (dx + 1) + dy * dy <= r2)) {
      dx += 1;
    }
    hline(fb, cx - dx, cy + dy, cx + dx, color);
    dy += 1;
  }
}
function _aa_corners(fb, x, y, w, h, r, color) {
  let base_a = $int(color / 16777216) & 255;
  let rgb2 = color & 16777215;
  let quads = [[x, y, x + r, y + r], [x + w - r, y, x + w - r, y + r], [x, y + h - r, x + r, y + h - r], [x + w - r, y + h - r, x + w - r, y + h - r]];
  for (let q of quads) {
    let bx = $index(q, 0);
    let by = $index(q, 1);
    let ccx = $index(q, 2);
    let ccy = $index(q, 3);
    let yy = 0;
    while (truthy(yy < r)) {
      let xx = 0;
      while (truthy(xx < r)) {
        let px = bx + xx;
        let py = by + yy;
        let ex = px + 0.5 - ccx;
        let ey = py + 0.5 - ccy;
        let d = sqrt(ex * ex + ey * ey);
        let cov = r + 0.5 - d;
        if (truthy(cov > 1)) {
          cov = 1;
        }
        if (truthy(cov > 0)) {
          let a = $int(base_a * cov);
          if (truthy(a > 0)) {
            blend_pixel(fb, px, py, a * 16777216 + rgb2);
          }
        }
        xx = xx + 1;
      }
      yy = yy + 1;
    }
  }
}
function rounded_rect(fb, x, y, w, h, radius, color) {
  let r0 = truthy(radius * 2 > w) ? $int(w / 2) : radius;
  let r = truthy(r0 * 2 > h) ? $int(h / 2) : r0;
  if (truthy(r <= 0)) {
    fb.fill_rect(x, y, w, h, color);
    return null;
  }
  fb.fill_rect(x + r, y, w - 2 * r, h, color);
  fb.fill_rect(x, y + r, r, h - 2 * r, color);
  fb.fill_rect(x + w - r, y + r, r, h - 2 * r, color);
  _aa_corners(fb, x, y, w, h, r, color);
}
function fill_polygon(fb, points, color) {
  let n = len(points);
  if (truthy(n < 3)) {
    return null;
  }
  let min_y = $index($index(points, 0), 1);
  let max_y = $index($index(points, 0), 1);
  let i = 1;
  while (truthy(i < n)) {
    let py = $index($index(points, i), 1);
    if (truthy(py < min_y)) {
      min_y = py;
    }
    if (truthy(py > max_y)) {
      max_y = py;
    }
    i += 1;
  }
  if (truthy(min_y < 0)) {
    min_y = 0;
  }
  if (truthy(max_y > fb.height - 1)) {
    max_y = fb.height - 1;
  }
  let y = min_y;
  while (truthy(y <= max_y)) {
    let xs = [];
    let e2 = 0;
    while (truthy(e2 < n)) {
      let a = $index(points, e2);
      let b = $index(points, (e2 + 1) % n);
      let ay = $index(a, 1);
      let by = $index(b, 1);
      if (truthy(ay <= y && by > y || by <= y && ay > y)) {
        let t = (y - ay) / (by - ay);
        let x = $index(a, 0) + ($index(b, 0) - $index(a, 0)) * t;
        push(xs, x);
      }
      e2 += 1;
    }
    let a2 = 1;
    while (truthy(a2 < len(xs))) {
      let key = $index(xs, a2);
      let b2 = a2 - 1;
      while (truthy(b2 >= 0 && $index(xs, b2) > key)) {
        xs[b2 + 1] = $index(xs, b2);
        b2 -= 1;
      }
      xs[b2 + 1] = key;
      a2 += 1;
    }
    let p = 0;
    while (truthy(p + 1 < len(xs))) {
      let x0 = $int($index(xs, p));
      let x1 = $int($index(xs, p + 1));
      if (truthy(x1 >= x0)) {
        fill_rect(fb, x0, y, x1 - x0 + 1, 1, color);
      }
      p += 2;
    }
    y += 1;
  }
}
function blend_over(dst, src) {
  let sa = $int(src / 16777216) & 255;
  if (truthy($eq(sa, 255))) {
    return src;
  }
  if (truthy($eq(sa, 0))) {
    return dst;
  }
  let sr = $int(src / 65536) & 255;
  let sg = $int(src / 256) & 255;
  let sb = src & 255;
  let dr = $int(dst / 65536) & 255;
  let dg = $int(dst / 256) & 255;
  let db = dst & 255;
  let ia = 255 - sa;
  let orr = $int((sr * sa + dr * ia) / 255);
  let og = $int((sg * sa + dg * ia) / 255);
  let ob = $int((sb * sa + db * ia) / 255);
  return 255 * 16777216 + orr * 65536 + og * 256 + ob;
}
function blend_pixel(fb, x, y, color) {
  let sa = $int(color / 16777216) & 255;
  if (truthy($eq(sa, 255))) {
    fb.put_pixel(x, y, color);
    return null;
  }
  if (truthy($eq(sa, 0))) {
    return null;
  }
  fb.put_pixel(x, y, blend_over(fb.get_pixel(x, y), color));
}
function fill_rect_blend(fb, x, y, w, h, color) {
  let sa = $int(color / 16777216) & 255;
  if (truthy($eq(sa, 0))) {
    return null;
  }
  if (truthy($eq(sa, 255))) {
    fb.fill_rect(x, y, w, h, color);
    return null;
  }
  fb.blend_rect(x, y, w, h, color);
}
function lerp_rgba(a, b, t) {
  let aa = $int(a / 16777216) & 255;
  let ar = $int(a / 65536) & 255;
  let ag = $int(a / 256) & 255;
  let ab = a & 255;
  let ba = $int(b / 16777216) & 255;
  let br = $int(b / 65536) & 255;
  let bg = $int(b / 256) & 255;
  let bb = b & 255;
  let oa = $int(aa + (ba - aa) * t);
  let orr = $int(ar + (br - ar) * t);
  let og = $int(ag + (bg - ag) * t);
  let ob = $int(ab + (bb - ab) * t);
  return oa * 16777216 + orr * 65536 + og * 256 + ob;
}
function sample_stops(stops, t) {
  let clamped = t;
  if (truthy(clamped < 0)) {
    clamped = 0;
  }
  if (truthy(clamped > 1)) {
    clamped = 1;
  }
  let i = 0;
  while (truthy(i < len(stops) - 1)) {
    let s0 = $index(stops, i);
    let s1 = $index(stops, i + 1);
    if (truthy(clamped >= $index(s0, "t") && clamped <= $index(s1, "t"))) {
      let span = $index(s1, "t") - $index(s0, "t");
      let local = truthy($eq(span, 0)) ? 0 : (clamped - $index(s0, "t")) / span;
      return lerp_rgba($index(s0, "color"), $index(s1, "color"), local);
    }
    i += 1;
  }
  return $index($index(stops, len(stops) - 1), "color");
}
function linear_gradient(fb, x, y, w, h, stops, dir) {
  if (truthy(w <= 0 || h <= 0)) {
    return null;
  }
  if (truthy($eq(dir, "v"))) {
    let yy = 0;
    while (truthy(yy < h)) {
      let t = truthy(h <= 1) ? 0 : yy / (h - 1);
      let c = sample_stops(stops, t);
      fill_rect_blend(fb, x, y + yy, w, 1, c);
      yy += 1;
    }
  } else {
    let xx = 0;
    while (truthy(xx < w)) {
      let t = truthy(w <= 1) ? 0 : xx / (w - 1);
      let c = sample_stops(stops, t);
      fill_rect_blend(fb, x + xx, y, 1, h, c);
      xx += 1;
    }
  }
}
function _hline_blend(fb, x0, y, x1, color) {
  if (truthy(x1 < x0)) {
    return null;
  }
  fb.blend_rect(x0, y, x1 - x0 + 1, 1, color);
}
function rounded_rect_blend(fb, x, y, w, h, radius, color) {
  let sa = $int(color / 16777216) & 255;
  if (truthy($eq(sa, 0))) {
    return null;
  }
  if (truthy($eq(sa, 255))) {
    rounded_rect(fb, x, y, w, h, radius, color);
    return null;
  }
  let r0 = truthy(radius * 2 > w) ? $int(w / 2) : radius;
  let r = truthy(r0 * 2 > h) ? $int(h / 2) : r0;
  if (truthy(r <= 0)) {
    fill_rect_blend(fb, x, y, w, h, color);
    return null;
  }
  fill_rect_blend(fb, x + r, y, w - 2 * r, h, color);
  fill_rect_blend(fb, x, y + r, r, h - 2 * r, color);
  fill_rect_blend(fb, x + w - r, y + r, r, h - 2 * r, color);
  _aa_corners(fb, x, y, w, h, r, color);
}
function _rounded_blend_noaa(fb, x, y, w, h, radius, color) {
  let r0 = truthy(radius * 2 > w) ? $int(w / 2) : radius;
  let r = truthy(r0 * 2 > h) ? $int(h / 2) : r0;
  if (truthy(r <= 0)) {
    fill_rect_blend(fb, x, y, w, h, color);
    return null;
  }
  fill_rect_blend(fb, x + r, y, w - 2 * r, h, color);
  fill_rect_blend(fb, x, y + r, r, h - 2 * r, color);
  fill_rect_blend(fb, x + w - r, y + r, r, h - 2 * r, color);
  let dy = 0 - r;
  while (truthy(dy <= 0)) {
    let dx = 0;
    while (truthy((dx + 1) * (dx + 1) + dy * dy <= r * r)) {
      dx += 1;
    }
    let row_top = y + r + dy;
    let row_bot = y + h - 1 - r - dy;
    _hline_blend(fb, x + r - dx, row_top, x + w - r + dx - 1, color);
    _hline_blend(fb, x + r - dx, row_bot, x + w - r + dx - 1, color);
    dy += 1;
  }
}
function drop_shadow(fb, x, y, w, h, radius, color, blur) {
  if (truthy(blur <= 0)) {
    return null;
  }
  let a = $int(color / 16777216) & 255;
  let rgb2 = color & 16777215;
  let per = truthy(a < blur) ? 1 : $int(a / blur);
  let off = $int(blur / 2);
  let i = blur;
  while (truthy(i >= 1)) {
    _rounded_blend_noaa(fb, x - i, y - i + off, w + 2 * i, h + 2 * i, radius + i, per * 16777216 + rgb2);
    i -= 1;
  }
}
function _blit_corner(dst, src, ox, oy, box_x, box_y, cx, cy, r) {
  let yy = 0;
  while (truthy(yy < r)) {
    let xx = 0;
    while (truthy(xx < r)) {
      let px = box_x + xx;
      let py = box_y + yy;
      let ex = px + 0.5 - cx;
      let ey = py + 0.5 - cy;
      let d = sqrt(ex * ex + ey * ey);
      let cov = r + 0.5 - d;
      if (truthy(cov > 1)) {
        cov = 1;
      }
      if (truthy(cov > 0)) {
        let sp = src.get_pixel(px - ox, py - oy);
        if (truthy(cov >= 1)) {
          dst.put_pixel(px, py, sp);
        } else {
          let a = $int(255 * cov);
          blend_pixel(dst, px, py, a * 16777216 + (sp & 16777215));
        }
      }
      xx = xx + 1;
    }
    yy = yy + 1;
  }
}
function blit_rounded(dst, src, dx, dy, w, h, radius) {
  let r0 = truthy(radius * 2 > w) ? $int(w / 2) : radius;
  let r = truthy(r0 * 2 > h) ? $int(h / 2) : r0;
  if (truthy(r <= 0)) {
    dst.blit(src, 0, 0, dx, dy, w, h);
    return null;
  }
  dst.blit(src, r, 0, dx + r, dy, w - 2 * r, h);
  dst.blit(src, 0, r, dx, dy + r, r, h - 2 * r);
  dst.blit(src, w - r, r, dx + w - r, dy + r, r, h - 2 * r);
  _blit_corner(dst, src, dx, dy, dx, dy, dx + r, dy + r, r);
  _blit_corner(dst, src, dx, dy, dx + w - r, dy, dx + w - r, dy + r, r);
  _blit_corner(dst, src, dx, dy, dx, dy + h - r, dx + r, dy + h - r, r);
  _blit_corner(dst, src, dx, dy, dx + w - r, dy + h - r, dx + w - r, dy + h - r, r);
}
function blit_scaled_alpha(dst, src, dx, dy, dw, dh, alpha) {
  _ffi_blit_scaled_alpha(dst.buffer._handle, dst.width, dst.height, src.buffer._handle, src.width, src.height, $int(dx), $int(dy), $int(dw), $int(dh), $int(alpha));
}
function box_blur(fb, radius, passes) {
  if (truthy(radius < 1)) {
    return null;
  }
  _ffi_box_blur(fb.buffer._handle, fb.width, fb.height, radius, passes);
}
function frosted_panel(fb, x, y, w, h, radius, tint, blur) {
  if (truthy(w <= 0 || h <= 0)) {
    return null;
  }
  let snap = framebuffer(w, h);
  snap.blit(fb, x, y, 0, 0, w, h);
  box_blur(snap, blur, 2);
  blit_rounded(fb, snap, x, y, w, h, radius);
  rounded_rect_blend(fb, x, y, w, h, radius, tint);
}

// web/build/font.js
class Font {
  constructor(width, height, glyphs) {
    this.width = width;
    this.height = height;
    this.glyphs = glyphs;
  }
  has_glyph(code) {
    return has(this.glyphs, str(code));
  }
  glyph(code) {
    let key = str(code);
    if (truthy(has(this.glyphs, key))) {
      return $index(this.glyphs, key);
    }
    return null;
  }
}
function draw_text(fb, x, y, text, font, color) {
  let fw = font.width;
  let fh = font.height;
  let bx = $int(x);
  let by = $int(y);
  let chs = chars(text);
  let col_offset = 0;
  let i = 0;
  while (truthy(i < len(chs))) {
    let code = char_code($index(chs, i));
    let glyph = font.glyph(code);
    if (truthy($ne(glyph, null))) {
      let row = 0;
      while (truthy(row < fh)) {
        let byte = $index(glyph, row);
        let bit = 0;
        while (truthy(bit < fw)) {
          let mask = 1 << fw - 1 - bit;
          if (truthy($ne(byte & mask, 0))) {
            fb.put_pixel(bx + col_offset + bit, by + row, color);
          }
          bit += 1;
        }
        row += 1;
      }
    }
    col_offset += fw;
    i += 1;
  }
}
var _BUILTIN_GLYPHS = { ["32"]: [0, 0, 0, 0, 0, 0, 0, 0], ["33"]: [24, 24, 24, 24, 24, 0, 24, 0], ["34"]: [54, 54, 0, 0, 0, 0, 0, 0], ["35"]: [54, 54, 127, 54, 127, 54, 54, 0], ["36"]: [24, 62, 96, 60, 6, 124, 24, 0], ["37"]: [102, 108, 24, 48, 102, 102, 0, 0], ["38"]: [56, 108, 104, 118, 108, 110, 54, 0], ["39"]: [24, 24, 0, 0, 0, 0, 0, 0], ["40"]: [12, 24, 48, 48, 48, 24, 12, 0], ["41"]: [48, 24, 12, 12, 12, 24, 48, 0], ["42"]: [0, 102, 60, 255, 60, 102, 0, 0], ["43"]: [0, 24, 24, 126, 24, 24, 0, 0], ["44"]: [0, 0, 0, 0, 0, 24, 24, 48], ["45"]: [0, 0, 0, 126, 0, 0, 0, 0], ["46"]: [0, 0, 0, 0, 0, 0, 24, 0], ["47"]: [6, 12, 24, 48, 96, 192, 128, 0], ["48"]: [60, 102, 110, 118, 102, 102, 60, 0], ["49"]: [24, 56, 24, 24, 24, 24, 126, 0], ["50"]: [60, 102, 6, 12, 24, 48, 126, 0], ["51"]: [60, 102, 6, 28, 6, 102, 60, 0], ["52"]: [6, 14, 30, 102, 127, 6, 6, 0], ["53"]: [126, 96, 124, 6, 6, 102, 60, 0], ["54"]: [60, 102, 96, 124, 102, 102, 60, 0], ["55"]: [126, 102, 6, 12, 24, 24, 24, 0], ["56"]: [60, 102, 102, 60, 102, 102, 60, 0], ["57"]: [60, 102, 102, 62, 6, 102, 60, 0], ["58"]: [0, 24, 24, 0, 0, 24, 24, 0], ["59"]: [0, 24, 24, 0, 0, 24, 24, 48], ["60"]: [14, 24, 48, 96, 48, 24, 14, 0], ["61"]: [0, 0, 126, 0, 126, 0, 0, 0], ["62"]: [112, 24, 12, 6, 12, 24, 112, 0], ["63"]: [60, 102, 6, 12, 24, 0, 24, 0], ["64"]: [60, 102, 110, 110, 96, 102, 60, 0], ["65"]: [24, 60, 102, 102, 126, 102, 102, 0], ["66"]: [124, 102, 102, 124, 102, 102, 124, 0], ["67"]: [60, 102, 96, 96, 96, 102, 60, 0], ["68"]: [120, 108, 102, 102, 102, 108, 120, 0], ["69"]: [126, 96, 96, 120, 96, 96, 126, 0], ["70"]: [126, 96, 96, 120, 96, 96, 96, 0], ["71"]: [60, 102, 96, 110, 102, 102, 60, 0], ["72"]: [102, 102, 102, 126, 102, 102, 102, 0], ["73"]: [60, 24, 24, 24, 24, 24, 60, 0], ["74"]: [30, 12, 12, 12, 12, 108, 56, 0], ["75"]: [102, 108, 120, 112, 120, 108, 102, 0], ["76"]: [96, 96, 96, 96, 96, 96, 126, 0], ["77"]: [99, 119, 127, 107, 99, 99, 99, 0], ["78"]: [102, 118, 126, 126, 110, 102, 102, 0], ["79"]: [60, 102, 102, 102, 102, 102, 60, 0], ["80"]: [124, 102, 102, 124, 96, 96, 96, 0], ["81"]: [60, 102, 102, 102, 102, 60, 14, 0], ["82"]: [124, 102, 102, 124, 120, 108, 102, 0], ["83"]: [60, 102, 96, 60, 6, 102, 60, 0], ["84"]: [126, 24, 24, 24, 24, 24, 24, 0], ["85"]: [102, 102, 102, 102, 102, 102, 60, 0], ["86"]: [102, 102, 102, 102, 102, 60, 24, 0], ["87"]: [99, 99, 99, 107, 127, 119, 99, 0], ["88"]: [102, 102, 60, 24, 60, 102, 102, 0], ["89"]: [102, 102, 102, 60, 24, 24, 24, 0], ["90"]: [126, 6, 12, 24, 48, 96, 126, 0], ["91"]: [60, 48, 48, 48, 48, 48, 60, 0], ["92"]: [192, 96, 48, 24, 12, 6, 2, 0], ["93"]: [60, 12, 12, 12, 12, 12, 60, 0], ["94"]: [24, 60, 102, 0, 0, 0, 0, 0], ["95"]: [0, 0, 0, 0, 0, 0, 0, 255], ["96"]: [48, 24, 12, 0, 0, 0, 0, 0], ["97"]: [0, 0, 60, 6, 62, 102, 62, 0], ["98"]: [96, 96, 124, 102, 102, 102, 124, 0], ["99"]: [0, 0, 60, 102, 96, 102, 60, 0], ["100"]: [6, 6, 62, 102, 102, 102, 62, 0], ["101"]: [0, 0, 60, 102, 126, 96, 60, 0], ["102"]: [28, 54, 48, 120, 48, 48, 48, 0], ["103"]: [0, 0, 62, 102, 102, 62, 6, 124], ["104"]: [96, 96, 124, 102, 102, 102, 102, 0], ["105"]: [24, 0, 56, 24, 24, 24, 60, 0], ["106"]: [6, 0, 6, 6, 6, 6, 102, 60], ["107"]: [96, 96, 102, 108, 120, 108, 102, 0], ["108"]: [56, 24, 24, 24, 24, 24, 60, 0], ["109"]: [0, 0, 102, 127, 127, 107, 99, 0], ["110"]: [0, 0, 124, 102, 102, 102, 102, 0], ["111"]: [0, 0, 60, 102, 102, 102, 60, 0], ["112"]: [0, 0, 124, 102, 102, 124, 96, 96], ["113"]: [0, 0, 62, 102, 102, 62, 6, 6], ["114"]: [0, 0, 124, 102, 96, 96, 96, 0], ["115"]: [0, 0, 62, 96, 60, 6, 124, 0], ["116"]: [48, 48, 120, 48, 48, 54, 28, 0], ["117"]: [0, 0, 102, 102, 102, 102, 62, 0], ["118"]: [0, 0, 102, 102, 102, 60, 24, 0], ["119"]: [0, 0, 99, 107, 127, 127, 54, 0], ["120"]: [0, 0, 102, 60, 24, 60, 102, 0], ["121"]: [0, 0, 102, 102, 102, 62, 6, 124], ["122"]: [0, 0, 126, 12, 24, 48, 126, 0], ["123"]: [14, 24, 24, 112, 24, 24, 14, 0], ["124"]: [24, 24, 24, 24, 24, 24, 24, 0], ["125"]: [112, 24, 24, 14, 24, 24, 112, 0], ["126"]: [118, 220, 0, 0, 0, 0, 0, 0] };
function builtin_font() {
  return new Font(8, 8, _BUILTIN_GLYPHS);
}

// web/build/font_atlas.js
function atlas_data() {
  return { ["sizes"]: [15, 20, 30, 44], ["ascent"]: { ["15"]: 14, ["20"]: 19, ["30"]: 28, ["44"]: 40 }, ["glyphs"]: { ["15"]: { ["32"]: { ["w"]: 0, ["h"]: 0, ["adv"]: 4, ["left"]: 0, ["top"]: 0, ["cov"]: "" }, ["33"]: { ["w"]: 4, ["h"]: 11, ["adv"]: 4, ["left"]: 0, ["top"]: 11, ["cov"]: "AE9mAABMYwAASWAAAEZeAABEWwAAQVgAAD5VAAA7UwAAAAAAAFJkAABSZAA=" }, ["34"]: { ["w"]: 5, ["h"]: 11, ["adv"]: 5, ["left"]: 0, ["top"]: 11, ["cov"]: "K3oAUVQkcwBLTR1tAEVHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" }, ["35"]: { ["w"]: 9, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAEYwAARiEAAAAdSgAAYAYAAAA4LwABZAAASH9/f39/f38iAABmAwAsOwAAAANlAABFIgAAABhQAABdCgAAeH9/f39/f3IAAEkeAA1bAAAAAGIGACg/AAAAAWUAAEIjAAAA" }, ["36"]: { ["w"]: 9, ["h"]: 13, ["adv"]: 8, ["left"]: 0, ["top"]: 12, ["cov"]: "AAAAGloAAAAAABxeeH9wQgEADHg/JFwicz8AKXgAGloAIywAIn8SGloAAAAAAV52VmIGAAAAAAIwYH98UAgAAAAAGl0obVsAAAAAGloAIn4EJiEAGloAIXwCO3YsJ10galAAADVnen5tQgQAAAAAGloAAAAA" }, ["37"]: { ["w"]: 13, ["h"]: 11, ["adv"]: 13, ["left"]: 0, ["top"]: 11, ["cov"]: "AEZpaScAAAABZygAAB1tAxN0AgAAOFoAAAA1UgAAdg8ADXQQAAAANVIAAHcOAFU8AAAAABtvBBhyASRqAgAAAAAAQ2xqJARuHw5gaV4LAAAAAABCUABNQQBGRQAAAAATcwoAZSIAKF4AAAAAXjIAAGUiACheAAAALmMAAABMQABIRAAACHIXAAAADWBpWwk=" }, ["38"]: { ["w"]: 10, ["h"]: 10, ["adv"]: 10, ["left"]: 0, ["top"]: 10, ["cov"]: "AAADTnFyTQIAAAAAM2QEBWgwAAAAAD5OAANqLgAAAAAicCdmVQIAAAACN39pJAAAAAABW2M8cwgAJlgAJ3YGAFZTAFg7ADRpAAAIbVNxBgAVfDECBkV/WQ4JACZleHJTIVh4WA==" }, ["39"]: { ["w"]: 3, ["h"]: 11, ["adv"]: 3, ["left"]: 0, ["top"]: 11, ["cov"]: "G38KFH8DDX0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["40"]: { ["w"]: 5, ["h"]: 14, ["adv"]: 5, ["left"]: 0, ["top"]: 11, ["cov"]: "AAABXkMAAEBkAQAMeyEAAD9qAAAAYkYAAAB4LwAAA38lAAADfyQAAAB4LwAAAGJGAAAAPmgAAAAMex8AAABAYwEAAAFeQw==" }, ["41"]: { ["w"]: 5, ["h"]: 14, ["adv"]: 5, ["left"]: 0, ["top"]: 11, ["cov"]: "RF4BAAACZUAAAAAjegsAAABsPgAAAEliAAAAMXgAAAAnfwMAACd/AwAAMXcAAABJYQAAAGw9AAAjegsAAmQ/AABEXgEAAA==" }, ["42"]: { ["w"]: 6, ["h"]: 11, ["adv"]: 6, ["left"]: 0, ["top"]: 11, ["cov"]: "AABFNAAAKylCNTAgIEl3cEMYACddZxQAAVsQJUkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["43"]: { ["w"]: 9, ["h"]: 10, ["adv"]: 9, ["left"]: 0, ["top"]: 10, ["cov"]: "AAAAAhAAAAAAAAAAFHYAAAAAAAAAFHYAAAAAAAAAFHYAAAAAIn9/f39/f38CAggIGnYICAgAAAAAFHYAAAAAAAAAFHYAAAAAAAAABBcAAAAAAAAAAAAAAAAA" }, ["44"]: { ["w"]: 4, ["h"]: 4, ["adv"]: 4, ["left"]: 0, ["top"]: 2, ["cov"]: "AE5oAABOZgAAB1wAADM3AA==" }, ["45"]: { ["w"]: 5, ["h"]: 5, ["adv"]: 5, ["left"]: 0, ["top"]: 5, ["cov"]: "Kn9/fyoHFhYWBwAAAAAAAAAAAAAAAAAAAA==" }, ["46"]: { ["w"]: 4, ["h"]: 2, ["adv"]: 4, ["left"]: 0, ["top"]: 2, ["cov"]: "AFBmAABQZgA=" }, ["47"]: { ["w"]: 5, ["h"]: 11, ["adv"]: 4, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAPfQYAADNhAAAAVj8AAAF3HAAAHHcBAAA/VgAAAGI0AAAHfREAAChuAAAAS0sAAABuKQAAAA==" }, ["48"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AARJdXteEwAASmwaDk1vAwZ8JgAAA3csIH8HAAAAXEsuegAAAABPWjJ2AAAAAEteLnoAAAAAT1kefwgAAABeSQR6KQAABnkpAERuHBFTbAIAAkZ1e1sQAA==" }, ["49"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAMXH8MAAAAIHJSfwwAAAA4HB5/DAAAAAAAHn8MAAAAAAAefwwAAAAAAB5/DAAAAAAAHn8MAAAAAAAefwwAAAAAAB5/DAAAAA0QKn8aEAkAbn9/f39/Tg==" }, ["50"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AAlNc3liHgAAXmgcEU14DAdiHQAAA30rAAAAAAACfCwAAAAAADd3CAAAAAAmeigAAAAAM3orAAAAADp4IAAAAAApeRsAAAAABXFBEBAQEAkff39/f39/TA==" }, ["51"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AA1SdHhgGwAAZ18YElB2Cg1eEgAABn8oAAAAAAAGfiYAAAAADlNqAwAAAHp/ZREAAAAAERxMdhQAAAAAAABlTCBvCgAAAGVMBnFbGRE9fyMAE1d1emcsAA==" }, ["52"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAAACN/OgAAAAAHcXc6AAAAAE9PZjoAAAAlcQhmOgAACHIkAGY6AABRTgAAZjoAJ28HAABmOgBTf39/f39/dAMGBgYGZz0FAAAAAABmOgAAAAAAAGY6AA==" }, ["53"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AGR/f39/fw4Aaz8QEBAQAQBzLwAAAAAAAHooAAAAAAACf1RuemUiAAdqTxcTSn0YAAAAAAAAa0kAAAAAAABZVg83AwAAAW9DC3lQExNNeg8AG154dl0ZAA==" }, ["54"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAra3tpJgAAIXstDDl9EQBfSgAAAB4GBH4hAAAAAAAVfy9me2ooABx/ZBgJO34ZGX8oAAAAaEYLfyAAAABYUgBsPgAAAGtCADB4KQ9CfBEAADdwemQfAA==" }, ["55"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "Hn9/f39/f0wDEBAQEBV1KwAAAAAAQ18AAAAAAA97FwAAAAAATlMAAAAAAAx9GgAAAAAAPGoAAAAAAABiQwAAAAAABn0mAAAAAAAYfxIAAAAAACR/CQAAAA==" }, ["56"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AApOc3hgHAAAW2ANBUF4DQV+JgAAAn0uBH4oAAADfiwATWMQBkNwBgAIY39/dyEAAmVTCwQuehshfwsAAABfTSF/DQAAAGFMBnFTCwQrfiMAFVh1eWcsAA==" }, ["57"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "ABFWdHpZDQADbF0VEVBmABp/EgAAA3cgG38RAAAAbT0Db1oSEER3SwAVXnlxOFxOAAAAAAAAaEcAAAAAAAN8NAAdCgAAK38RAGZZEBtxUQAAEV56dkoEAA==" }, ["58"]: { ["w"]: 4, ["h"]: 8, ["adv"]: 4, ["left"]: 0, ["top"]: 8, ["cov"]: "AFBmAABQZgAAAAAAAAAAAAAAAAAAAAAAAFBmAABQZgA=" }, ["59"]: { ["w"]: 4, ["h"]: 10, ["adv"]: 4, ["left"]: 0, ["top"]: 8, ["cov"]: "AE5oAABOaAAAAAAAAAAAAAAAAAAAAAAAAE5oAABOZgAAB1sAADM3AA==" }, ["60"]: { ["w"]: 9, ["h"]: 9, ["adv"]: 9, ["left"]: 0, ["top"]: 9, ["cov"]: "AAAAAAAJNmYDAAABJVV6WioACkRzazsMAAAAInw3AAAAAAAACkVzazoMAAAAAAABJVZ6WSkAAAAAAAAJNmYDAAAAAAAAAAAAAAAAAAAAAAAA" }, ["61"]: { ["w"]: 9, ["h"]: 7, ["adv"]: 9, ["left"]: 0, ["top"]: 7, ["cov"]: "In9/f39/f38CAgoKCgoKCgoAAAAAAAAAAAAAIn9/f39/f38CAgoKCgoKCgoAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["62"]: { ["w"]: 9, ["h"]: 9, ["adv"]: 9, ["left"]: 0, ["top"]: 9, ["cov"]: "IFoqAwAAAAAABTVldkoZAAAAAAAAFUZ0aTkBAAAAAAAETH8EAAAAFUVzaToBBTRldkoaAAAAIFsrAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["63"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AAtOcnpoLgACZmooGz5/Kh9/FAAAAFZXAAUAAAAAUFkAAAAAABV5LQAAAAApeD4AAAAAIHwoAAAAAABTVgAAAAAAAAAAAAAAAAAAZlIAAAAAAABmUgAAAA==" }, ["64"]: { ["w"]: 15, ["h"]: 13, ["adv"]: 15, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAAAAc2YnJ2b08ZAAAAAAAAG29JFwIACDJyNAAAAAAXch0AAAAAAAAOchoAAAFqKQAaYHdsHmQWN1EAACRlABV4LgEPZHsDE2wAAE06AFZJAAAARGAACnQAAF4nAHghAAAAWEEAF2gAAGYfAX4aAAASfSgAO0gAAFkuAGZGARpbcSEVcRAAADZXABhoeV8SQ3dnHwAAAAhxJwAAAAAAAAACAAAAAAAcckQSAQAKKVlMAAAAAAAADENqd3duUykBAAAA" }, ["65"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAAA3Z6BwAAAAAAACtxbTIAAAAAAABcS0ZiAAAAAAAOfiEdfxIAAAAAPnUBAHFCAAAAAG5MAABHcQEAACB/IQAAG38jAABRf39/f39/UwAHekQMDAwMP3sHM34OAAAAAAp8M2NYAAAAAAAAVGM=" }, ["66"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "AGJ/f394Zi0AAABiVhAQF0Z/IgAAYlAAAAAAcEUAAGJQAAAAAHFAAABiUAAACD53EAAAYn9/f396MwAAAGJUDAwQJWxOAABiUAAAAAAmfw8AYlAAAAAAKH8QAGJWEBASJ21jAABif39/fW9KCgA=" }, ["67"]: { ["w"]: 11, ["h"]: 11, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAHQmx8dl8oAAAACGpwMBYdSH48AABMeQ0AAAAAOmEDAnpDAAAAAAAAAAAVfygAAAAAAAAAABt/HAAAAAAAAAAAEX8qAAAAAAAAAAABdUoAAAAAAAAAAABGfBMAAAAAI2cIAAZmdDYYHUN8QQAAAAU+ant2XicAAA==" }, ["68"]: { ["w"]: 11, ["h"]: 11, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AGJ/f393YTIBAAAAYlYQEBs9eFoCAABiUAAAAAAYezoAAGJQAAAAAABObQAAYlAAAAAAAC9/BQBiUAAAAAAAKH8KAGJQAAAAAAA0fgEAYlAAAAAAAFdjAABiUAAAAAAffjAAAGJWEBAZPHpTAAAAYn9/f3llMwAAAA==" }, ["69"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "AGJ/f39/f39/CABiVhISEhISEgEAYlAAAAAAAAAAAGJQAAAAAAAAAABiXCAgICAgFAAAYnpwcHBwcEYAAGJQAAAAAAAAAABiUAAAAAAAAAAAYlAAAAAAAAAAAGJWEhISEhISBgBif39/f39/fy4=" }, ["70"]: { ["w"]: 9, ["h"]: 11, ["adv"]: 9, ["left"]: 0, ["top"]: 11, ["cov"]: "AGJ/f39/f39IAGJWEhISEhIKAGJQAAAAAAAAAGJQAAAAAAAAAGJQAAAAAAAAAGJ/f39/f38yAGJXFBQUFBQHAGJQAAAAAAAAAGJQAAAAAAAAAGJQAAAAAAAAAGJQAAAAAAAA" }, ["71"]: { ["w"]: 12, ["h"]: 11, ["adv"]: 12, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAHQmt7d2U0AAAAAAlrbi8WG0B8TQAAAE53CgAAAAArawwAA3tAAAAAAAAAAAAAF38lAAAAAAAAAAAAHX8aAAAAan9/f0YAE38oAAAAEhYWY0YAAnZGAAAAAAAAXkYAAEd7EQAAAAAGbEYAAAVlczQXGDRubhIAAAAEPGh5eWY7BQAA" }, ["72"]: { ["w"]: 11, ["h"]: 11, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AGJQAAAAAABmTgAAYlAAAAAAAGZOAABiUAAAAAAAZk4AAGJQAAAAAABmTgAAYlwgICAgIGxOAABifHZ2dnZ2fU4AAGJQAAAAAABmTgAAYlAAAAAAAGZOAABiUAAAAAAAZk4AAGJQAAAAAABmTgAAYlAAAAAAAGZOAA==" }, ["73"]: { ["w"]: 4, ["h"]: 11, ["adv"]: 4, ["left"]: 0, ["top"]: 11, ["cov"]: "AE5kAABOZAAATmQAAE5kAABOZAAATmQAAE5kAABOZAAATmQAAE5kAABOZAA=" }, ["74"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAAfn9/MgAAAAAREn8yAAAAAAAAfzIAAAAAAAB/MgAAAAAAAH8yAAAAAAAAfzIAAAAAAAB/MgAAAAAAAH8wAEVbAAAPfyEAJ385GFZwBAAANm96YBYAAA==" }, ["75"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "AGJQAAAABmVgBABiUAAAAlxnBwAAYlAAAFJuCwAAAGJQAEZzEQAAAABiUDp9FwAAAAAAYnF2fDcAAAAAAGJuETN9IAAAAABiUAAAUHUPAAAAYlAAAARoZgQAAGJQAAAAEXdRAABiUAAAAAAmfzg=" }, ["76"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AGJQAAAAAAAAYlAAAAAAAABiUAAAAAAAAGJQAAAAAAAAYlAAAAAAAABiUAAAAAAAAGJQAAAAAAAAYlAAAAAAAABiUAAAAAAAAGJWEhISEg8AYn9/f39/bA==" }, ["77"]: { ["w"]: 13, ["h"]: 11, ["adv"]: 12, ["left"]: 0, ["top"]: 11, ["cov"]: "AGJ/HgAAAAAAWn8iAABid0wAAAAACXl7IgAAYlZ2AwAAADRbeyIAAGI8cycAAABhMn8iAABiPEdVAAAPfAl/IgAAYjwaewcAO1gAfyIAAGI8AGwwAGgrAH8iAABiPAA+XhR5BAB/IgAAYjwAEH1EUAAAfyIAAGI8AABjeSMAAH8iAABiPAAANXQBAAB/IgA=" }, ["78"]: { ["w"]: 11, ["h"]: 11, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AGJ9FQAAAABUTgAAYndeAAAAAFROAABiQ3gpAAAAVE4AAGI7OG8EAABUTgAAYjwCaz8AAFROAABiPAAjeg4AVE4AAGI8AABZVABUTgAAYjwAABJ8H1NOAABiPAAAAERoUE4AAGI8AAAABnN2TgAAYjwAAAAAL39OAA==" }, ["79"]: { ["w"]: 12, ["h"]: 11, ["adv"]: 12, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAIQ2x8dl8qAAAAAApsbS4WG0J8SQAAAFJ1CQAAAAAvfyQABn07AAAAAAAAalUAHX8gAAAAAAAATm0AI38UAAAAAAAAQnYAGX8hAAAAAAAAT2wABHo/AAAAAAAAalEAAEx3DAAAAAAsfx4AAAhqbzAVGkB7QQAAAAAGQGt7dl4nAAAA" }, ["80"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "AGJ/f39+bkQFAABiVhAQEyxzUgAAYlAAAAAAMX8HAGJQAAAAABx/FgBiUAAAAAAtfwcAYlAAAAIbbVMAAGJ/f39/e08HAABiVQ4ODAEAAAAAYlAAAAAAAAAAAGJQAAAAAAAAAABiUAAAAAAAAAA=" }, ["81"]: { ["w"]: 12, ["h"]: 14, ["adv"]: 12, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAIQ2x8dl8qAAAAAApsbS4WG0J8SAAAAFJ2CQAAAAAvfyMABn08AAAAAAAAalUAHH8gAAAAAAAAT20AI38UAAAAAAAAQncAGn8hAAAAAAAAT28ABXs+AAAAAAAAaVQAAE92CgAAAAArfyEAAApsbSwRFjx7RwAAAAAIRG1+fWAsAAAAAAAAAAA4egcAAAAAAAAAAAAKd1QNCAAAAAAAAAAAIGl7SgAA" }, ["82"]: { ["w"]: 11, ["h"]: 11, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AGJ/f39/eWUqAAAAYlYQEBAYRH8mAABiUAAAAAAAY1EAAGJQAAAAAABiUwAAYlAAAAAIN38nAABif39/f39sMAAAAGJVDg4Qc0MAAAAAYlAAAAAyfBEAAABiUAAAAAFqWAAAAGJQAAAAACV/IgAAYlAAAAAAAF9qAg==" }, ["83"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAwZXd8dFwdAAA6ejAPChQ6PAAAZE0AAAAAAAAAAFtlBAAAAAAAAAAfe25EJAUAAAAAABFHa397VA8AAAAAAAALMnBwBAAAAAAAAAAZfx8AAAAAAAAAGH8dCmZEGg8QJ2lmAQAdVnJ8eWpACAA=" }, ["84"]: { ["w"]: 9, ["h"]: 11, ["adv"]: 9, ["left"]: 0, ["top"]: 11, ["cov"]: "VH9/f39/f39oCxISH38wEhIOAAAAEH8kAAAAAAAAEH8kAAAAAAAAEH8kAAAAAAAAEH8kAAAAAAAAEH8kAAAAAAAAEH8kAAAAAAAAEH8kAAAAAAAAEH8kAAAAAAAAEH8kAAAA" }, ["85"]: { ["w"]: 11, ["h"]: 11, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AGxIAAAAAABcVgAAbEgAAAAAAFxWAABsSAAAAAAAXFYAAGxIAAAAAABcVgAAbEgAAAAAAFxWAABsSAAAAAAAXFYAAGtIAAAAAABcVQAAZFMAAAAAAGpLAABHcwUAAAAXfisAAA10YSQXL3FhAgAAAA9SdHxuQwUAAA==" }, ["86"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "X1sAAAAAAABbXy5+DAAAAAALfi4EeDkAAAAAOHgFAExnAAAAAGdMAAAbfxYAABV/GwAAAGpFAABEagAAAAA5cgEBcToAAAAACn0jIX0LAAAAAABXTktYAAAAAAAAJnVyJwAAAAAAAAFydAIAAAA=" }, ["87"]: { ["w"]: 15, ["h"]: 11, ["adv"]: 14, ["left"]: 0, ["top"]: 11, ["cov"]: "ZlQAAAAAW3IAAAAAPXkCQ3UAAAACeXoTAAAAXlgAH38XAAAdcls1AAADezUAAnk4AAA/VT9WAAAgfxEAAFhaAABgNh92AQBBbgAAADV5AgR8FgN7GQBiSgAAABF/HSJ1AABfOgZ9JwAAAABuPEFVAAA/WSN9BgAAAABKWV81AAAedkJgAAAAAAAndnkUAAADe288AAAAAAAGfXQAAAAAXn8ZAAAA" }, ["88"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "DHZCAAAAAD14DgAqfRkAABN8MAAAAFJpAwBhWQAAAAAIckI1dwwAAAAAACN9eS0AAAAAAAAEc3wMAAAAAAAASWhgWQAAAAAAIX0ZEnsuAAAAB3FCAAA8dwwAAFBqAwAAAmdYACh+GwAAAAAZfi0=" }, ["89"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "L34XAAAAABV9LgBfYAAAAABeXgAAFHwtAAAqfBMAAABCcgYEcEAAAAAABG5EQW0EAAAAAAAkfHsiAAAAAAAAAGFfAAAAAAAAAABaWAAAAAAAAAAAWlgAAAAAAAAAAFpYAAAAAAAAAABaWAAAAAA=" }, ["90"]: { ["w"]: 9, ["h"]: 11, ["adv"]: 9, ["left"]: 0, ["top"]: 11, ["cov"]: "AH5/f39/f38sABESEhISTXQLAAAAAAAcfSUAAAAAAAZuSgAAAAAAAFFqBAAAAAAALHwXAAAAAAAPeDkAAAAAAAFhXQAAAAAAAD92DQAAAAAAHH06EhISEhIMRH9/f39/f39Y" }, ["91"]: { ["w"]: 5, ["h"]: 14, ["adv"]: 4, ["left"]: 0, ["top"]: 11, ["cov"]: "AHh6eAUAeCwAAAB4LAAAAHgsAAAAeCwAAAB4LAAAAHgsAAAAeCwAAAB4LAAAAHgsAAAAeCwAAAB4LAAAAHgsAAAAeHp4BQ==" }, ["92"]: { ["w"]: 5, ["h"]: 11, ["adv"]: 4, ["left"]: 0, ["top"]: 11, ["cov"]: "biUAAABMSAAAAClrAAAACH4OAAAAZDEAAABBVAAAAB52AQAAAnkbAAAAWT4AAAA2YQAAABN9Bg==" }, ["93"]: { ["w"]: 4, ["h"]: 14, ["adv"]: 4, ["left"]: 0, ["top"]: 11, ["cov"]: "aXl/DAAWfwwAFn8MABZ/DAAWfwwAFn8MABZ/DAAWfwwAFn8MABZ/DAAWfwwAFn8MABZ/DGl5fww=" }, ["94"]: { ["w"]: 7, ["h"]: 11, ["adv"]: 7, ["left"]: 0, ["top"]: 11, ["cov"]: "AABAekIAAAALdh12DQAASkgARk0AEXcLAAp3FVNDAAAAP1kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }, ["95"]: { ["w"]: 10, ["h"]: 3, ["adv"]: 8, ["left"]: -1, ["top"]: 0, ["cov"]: "AAAAAAAAAAAAAAAAAAAAAAAAAAAcenp6enp6eno+" }, ["96"]: { ["w"]: 5, ["h"]: 11, ["adv"]: 5, ["left"]: 0, ["top"]: 11, ["cov"]: "B1xaAQAAAD5EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" }, ["97"]: { ["w"]: 9, ["h"]: 8, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "ABZdd3liGwAAAGRSCQZIcwEAAAAAAAAXfxEAAB9ccnd3fxYADnpHBgAVfxYAKH8IAAAyfxYAGX8oAidgfyEAAEF2eVYKW3Yj" }, ["98"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AH4qAAAAAAAAfioAAAAAAAB+KgAAAAAAAH42XXtuNQAAfm8jCDR/IQB+RQAAAGxKAH4wAAAAW1gAfi8AAABbVAB+QgAAAGxFAH5uHAMvfxkBfzFee24yAA==" }, ["99"]: { ["w"]: 8, ["h"]: 8, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "AAxWeXhbEwAAXVwQDFJoABN/GQAAAAAAJn8HAAAAAAAmfwgAAAAAABN/HgAAAAAAAF5jFBJNbwEADVZ5eV4YAA==" }, ["100"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAAAAAAfioAAAAAAAB+KgAAAAAAAH4qABViem0nfSoAbVYHC1d+Khp/FwAAF38qKX8GAAADfyotfwcAAAV/Kh5/GAAAG38qA3RYDBJcfSoAGGR7bid2LA==" }, ["101"]: { ["w"]: 8, ["h"]: 8, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "AAlQdnhiHgAAWVoMAzN7DxJ/EQAAAGc+Jn9/f39/f08lfwoCAgICARF/IQAAAAAAAFloFAIhbhkACVF3fGs0AA==" }, ["102"]: { ["w"]: 5, ["h"]: 11, ["adv"]: 4, ["left"]: 0, ["top"]: 11, ["cov"]: "ABhtexUATGcJAgBVUgAAX359ehYAVlIAAABWUgAAAFZSAAAAVlIAAABWUgAAAFZSAAAAVlIAAA==" }, ["103"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "ABZiemohdiwCclgJEF99Kh1/FwAAH38qLH8FAAADfyotfwQAAAJ/KiB/FAAAHX8qBHZRBg1ZfioAHGd6Zht+KQAEBAAADH8aAGtWCglQbgMAFF15d1wVAA==" }, ["104"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AHouAAAAAAAAei4AAAAAAAB6LQAAAAAAAHo0Vnp0PgAAemwkBjV/FgB6QgAAAX0rAHovAAAAejAAei4AAAB6MAB6LgAAAHowAHouAAAAejAAei4AAAB6MA==" }, ["105"]: { ["w"]: 3, ["h"]: 11, ["adv"]: 3, ["left"]: 0, ["top"]: 11, ["cov"]: "AH8qACILAAAAAH8qAH8qAH8qAH8qAH8qAH8qAH8qAH8q" }, ["106"]: { ["w"]: 4, ["h"]: 14, ["adv"]: 3, ["left"]: -1, ["top"]: 11, ["cov"]: "AAB/KgAAIgsAAAAAAAB/KgAAfyoAAH8qAAB/KgAAfyoAAH8qAAB/KgAAfyoAAH8pAxx/ICt8XQI=" }, ["107"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 11, ["cov"]: "AH4qAAAAAAAAfioAAAAAAAB+KgAAAAAAAH4qAABRaQgAfioARW0MAAB+KjdyEAAAAH5UfywAAAAAfnNXbgcAAAB+KwRpVAAAAH4qABR6MwAAfioAADF7Fg==" }, ["108"]: { ["w"]: 3, ["h"]: 11, ["adv"]: 3, ["left"]: 0, ["top"]: 11, ["cov"]: "AH4qAH4qAH4qAH4qAH4qAH4qAH4qAH4qAH4qAH4qAH4q" }, ["109"]: { ["w"]: 13, ["h"]: 8, ["adv"]: 12, ["left"]: 0, ["top"]: 8, ["cov"]: "AHwtXXttHS9xeVIBAAB6aBoJXnBNCh1+KAAAej4AADV/CAAAazsAAHotAAAwdwAAAGZAAAB6LAAAMHYAAABmQAAAeiwAADB2AAAAZkAAAHosAAAwdgAAAGZAAAB6LAAAMHYAAABmQAA=" }, ["110"]: { ["w"]: 8, ["h"]: 8, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "AHwqVnp0PgAAemsjBTV/FgB6QwAAAX0rAHovAAAAejAAei4AAAB6MAB6LgAAAHowAHouAAAAejAAei4AAAB6MA==" }, ["111"]: { ["w"]: 8, ["h"]: 8, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "AApQcXhjIQAAYGAOBDd+GBZ/HAAAAG5GKH8IAAAAW1gofwcAAABcVxR/HAAAAG9EAF1fDQU8fBQADFR4d2AcAA==" }, ["112"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "AX8xXntvNgAAfm8fBzR/IwB+RAAAAGxKAH4uAAAAW1gAfi8AAABbVAB+QgAAAGtFAH5vHAIvfxkAfjhee24yAAB+KgAAAAAAAH4qAAAAAAAAfioAAAAAAA==" }, ["113"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "ABViem0ndi0AbVYHC1d+Khp/FwAAF38qKX8GAAADfyopfwcAAAV/Kht/GAAAHH8qAXBYDBJdfSoAGWR7bid9KgAAAAAAAH4qAAAAAAAAfioAAAAAAAB+Kg==" }, ["114"]: { ["w"]: 5, ["h"]: 8, ["adv"]: 5, ["left"]: 0, ["top"]: 8, ["cov"]: "AH4ualwAe2gxFwB6SQAAAHoyAAAAei4AAAB6LgAAAHouAAAAei4AAA==" }, ["115"]: { ["w"]: 8, ["h"]: 8, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "AC1qe3ZTCQAPfikDDl1PABl/IQAAAgAAAEd+Z0UbAAAAAA0xVX08AAQOAAAAOXIALnQdAwtTXwAAPG58dVYPAA==" }, ["116"]: { ["w"]: 5, ["h"]: 10, ["adv"]: 4, ["left"]: 0, ["top"]: 10, ["cov"]: "AEM8AAAAWzwAAF1/fHAAAG48AAAAbjwAAABuPAAAAG48AAAAbjwAAABpTwoBADV6cwY=" }, ["117"]: { ["w"]: 8, ["h"]: 8, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "BH8mAAACfyYEfyYAAAJ/JgR/JgAAAn8mBH8mAAACfyYEfyYAAAN/JgF+KgAAF38mAGtaCBFWfCYAIGp8aR12KA==" }, ["118"]: { ["w"]: 8, ["h"]: 8, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "Y08AAAAQfyE1dwIAADxxAQl9JQAAaEIAAFhQABN/EwAAKncDQGMAAAADdyRrNAAAAABNXXwIAAAAAB9/VQAAAA==" }, ["119"]: { ["w"]: 12, ["h"]: 8, ["adv"]: 11, ["left"]: -1, ["top"]: 8, ["cov"]: "AHAzAAA1fx8AAEZdAE1TAABWaUAAAGc4AClyAAF2MGAACH4UAAd+EhluBnoEKG8AAABiMjpNAGUhSUsAAAA/UVstAEZBaSYAAAAbbnkNACdoewUAAAABdmwAAAh+XgAA" }, ["120"]: { ["w"]: 8, ["h"]: 8, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "LnoQAABPZgIAVVsAIHsVAAAJczBsNwAAAAAlf18AAAAAADd5bgYAAAATeh5gTgAAAWRJABJ7JgA+bwUAADt0Cg==" }, ["121"]: { ["w"]: 8, ["h"]: 11, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "Y08AAAAMfiMwegYAADdxAQV4MAAAYkEAAEthAA5+EQAAGX8QOWAAAAAAZjxlLwAAAAA0cnkFAAAAAAd6TgAAAAAADnwZAAAAAxBgWAAAAAA+fFoJAAAAAA==" }, ["122"]: { ["w"]: 8, ["h"]: 8, ["adv"]: 8, ["left"]: 0, ["top"]: 8, ["cov"]: "En9/f39/TAAAAgICKn0eAAAAAA93PQAAAAACY10BAAAAAEV0CwAAAAAkfiEAAAAADXVDAgICAQAyf39/f39gAA==" }, ["123"]: { ["w"]: 5, ["h"]: 14, ["adv"]: 5, ["left"]: 0, ["top"]: 11, ["cov"]: "AABGeloADH8kAAAWfwYAABZ/BgAAGX8FAAZKagAAXngYAAACTWUAAAAbfwQAABZ/BgAAFn8GAAAVfwgAAAd+KwAAADx5Wg==" }, ["124"]: { ["w"]: 4, ["h"]: 14, ["adv"]: 4, ["left"]: 0, ["top"]: 11, ["cov"]: "AFRIAABUSAAAVEgAAFRIAABUSAAAVEgAAFRIAABUSAAAVEgAAFRIAABUSAAAVEgAAFRIAABUSAA=" }, ["125"]: { ["w"]: 5, ["h"]: 14, ["adv"]: 5, ["left"]: 0, ["top"]: 11, ["cov"]: "W3lEAAAAKH8KAAAJfxQAAAh/FAAAB38WAAAAbUgFAAAbeVwAAGlKAgAFfxgAAAh/FAAACH8UAAAKfxMAAC59BgBbeDoAAA==" }, ["126"]: { ["w"]: 9, ["h"]: 7, ["adv"]: 9, ["left"]: 0, ["top"]: 7, ["cov"]: "A1J6Wg8AABQKKU4KNXApC2MLHAQAABVldUIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } }, ["20"]: { ["32"]: { ["w"]: 0, ["h"]: 0, ["adv"]: 6, ["left"]: 0, ["top"]: 0, ["cov"]: "" }, ["33"]: { ["w"]: 6, ["h"]: 14, ["adv"]: 6, ["left"]: 0, ["top"]: 14, ["cov"]: "ABV/XAAAABJ/WQAAAA9/VgAAAAx/UwAAAAl/UAAAAAZ/TQAAAAN/SgAAAAB/RwAAAAB9RAAAAAB5QQAAAAAAAAAAAAAAAAAAABh/WgAAABh/WgAA" }, ["34"]: { ["w"]: 7, ["h"]: 14, ["adv"]: 7, ["left"]: 0, ["top"]: 14, ["cov"]: "EX9OAEN/HAp/RwA8fxUEf0AANn8OAH05AC9/BwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }, ["35"]: { ["w"]: 12, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAAnsMAAAuWwAAAAAAGXAAAABJQAAAAAAANVQAAABlJAAAAAAAUDkAAAN8CQAANH9/f39/f39/f38EAAAHfgcAADZTAAAAAAAfbgAAAE86AAAAAAA3VQAAAGciAAAAAABQPAAAAnwKAAAAdH9/f39/f39/f0QAAAd9BAAAOFMAAAAAACFoAAAAUzgAAAAAADtOAAAAbhwAAAAAAFU0AAAIfAQAAAAA" }, ["36"]: { ["w"]: 11, ["h"]: 18, ["adv"]: 11, ["left"]: 0, ["top"]: 16, ["cov"]: "AAAAAAB4IgAAAAAAAAAAAHgiAAAAAAAAJVxzf3pmOgMAAEB/ZDx7T2F/VwAFe2QBAHgiAFJ/HxB/SAAAeCIAECgKA31pBAB4IgAAAAAAQ39oM3kiAAAAAAAAN3R/f1wzCwAAAAAAAR57bX58QgAAAAAAAHgiDVp/LgAAAAAAeCIABHpXNGAGAAB4IgAAeGEzf0gAAHgiAC5/RAJaf2lGe1Faf2wJAAIxYXV/eWQ9BAAAAAAAAHgiAAAAAAAAAAAAeCIAAAAA" }, ["37"]: { ["w"]: 18, ["h"]: 14, ["adv"]: 18, ["left"]: 0, ["top"]: 14, ["cov"]: "AA1ad3BAAQAAAAAAV2kCAAAAAGZjEiR7MAAAAAApfhsAAAAAEX8oAABYXQAAAAhzRwAAAAAAIH8YAABIbQAAAE5vBQAAAAAAHX8YAABJbAAAIH8iAAAAAAAADH8qAABcWwAEbU8AAAAAAAAAAF1mGC19KgBFdAkGUHR5UgYAAA9cfHVAABl+KgBScBocc0QAAAAAAAAAAmdYAAF7PQAARXMAAAAAAAAAPHgNAAx/LAAANX8DAAAAAAASezIAAAl/LAAANH8DAAAAAABfXwAAAAB5PAAAR3EAAAAAADJ7EgAAAABLbxkedkAAAAAADHg7AAAAAAAGT3V4TQQA" }, ["38"]: { ["w"]: 14, ["h"]: 14, ["adv"]: 13, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAAC9penFGBQAAAAAAAAAnf0cdMXpNAAAAAAAAAFFtAAAASnMAAAAAAAAAVWcAAABdaAAAAAAAAAA/ewcLUX8mAAAAAAAAABN/Y3tvJQAAAAAAAAARV39/NQMAAAAAAAAAGnZvO35DAAAAT04AAAFrcAoAS3wUAAR6QQAAGH87AAAIcmkFN34SAAAifzMAAAAfflV2SgAAAAx+XQAAAABCf3wLAAAAAEl/XjArRXl1f2g6OgIAAC1jdnxpPgYtaH10Aw==" }, ["39"]: { ["w"]: 4, ["h"]: 14, ["adv"]: 4, ["left"]: 0, ["top"]: 14, ["cov"]: "AHtkAAB0XQAAblYAAGdPAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }, ["40"]: { ["w"]: 7, ["h"]: 19, ["adv"]: 7, ["left"]: 0, ["top"]: 15, ["cov"]: "AAAAAEV8GQAAACh/NwAAAAZ1ZAAAAAA9fyYAAAABdWwAAAAAG39JAAAAADx/KAAAAABOfxYAAAAAWH8MAAAAAF9/BAAAAABYfwwAAAAATX8WAAAAADx/KAAAAAAaf0kAAAAAAXVsAAAAAAA8fyYAAAAABnVkAAAAAAAnfzcAAAAAAEV8GQ==" }, ["41"]: { ["w"]: 7, ["h"]: 19, ["adv"]: 7, ["left"]: 0, ["top"]: 15, ["cov"]: "QXwbAAAAAAFgcAkAAAAAEX5OAAAAAABSfRAAAAAAGX9IAAAAAAB0bQAAAAAAU38PAAAAAEB/IAAAAAA2fysAAAAALn8zAAAAADZ/KwAAAABAfyEAAAAAU38PAAAAAHRtAAAAABl/SQAAAABSfREAAAARfk8AAAABYHEKAAAAQX0cAAAAAA==" }, ["42"]: { ["w"]: 8, ["h"]: 14, ["adv"]: 8, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAXUYAAAADAABXQQACADptOltMQ3MfFDtbf3pUNAwAADZveRsAAAAbfCNCbwgAADBPAAViGgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" }, ["43"]: { ["w"]: 12, ["h"]: 12, ["adv"]: 12, ["left"]: 0, ["top"]: 12, ["cov"]: "AAAAAAAVDQAAAAAAAAAAAABwRgAAAAAAAAAAAABwRgAAAAAAAAAAAABwRgAAAAAAAAAAAABwRgAAAAAAAn9/f39/f39/f1gAADY2NjZ2XjY2NiUAAAAAAABwRgAAAAAAAAAAAABwRgAAAAAAAAAAAABwRgAAAAAAAAAAAABCKQAAAAAAAAAAAAAAAAAAAAAA" }, ["44"]: { ["w"]: 6, ["h"]: 5, ["adv"]: 6, ["left"]: 0, ["top"]: 2, ["cov"]: "ABJ/YgAAABJ/YQAAAAAuXQAAAABHSQAAAAV3GgAA" }, ["45"]: { ["w"]: 7, ["h"]: 6, ["adv"]: 7, ["left"]: 0, ["top"]: 6, ["cov"]: "Dn9/f39iAAdISEhINwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["46"]: { ["w"]: 6, ["h"]: 2, ["adv"]: 6, ["left"]: 0, ["top"]: 2, ["cov"]: "ABZ/XgAAABZ/XgAA" }, ["47"]: { ["w"]: 6, ["h"]: 15, ["adv"]: 6, ["left"]: 0, ["top"]: 15, ["cov"]: "AAAAD382AAAAMX8UAAAAVHIAAAAAdVAAAAAYfy4AAAA6fw0AAABdagAAAAN7SAAAACF/JgAAAEN9BgAAAGZiAAAACX5AAAAAKn8eAAAATHkCAAAAb1oAAAAA" }, ["48"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAHR3B8c04MAAAABGZ/UzlLfG8JAAA4fzgAAAAof0YAAGZ4AwAAAABsdAADfl4AAAAAAE9/ERN/TwAAAAAAQH8iGX9JAAAAAAA6fykZf0kAAAAAADp/KBJ/UAAAAAAAQX8hAn1gAAAAAABSfw8AY3oFAAAAAXFwAAAzfz4AAAAyfz8AAAJhf1U7T35oBQAAAAVEcHxxSAgAAA==" }, ["49"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAAkJ+ZgAAAAAAABFkeH5mAAAAAAAGeWYRfGYAAAAAAAlJAwB8ZgAAAAAAAAAAAHxmAAAAAAAAAAAAfGYAAAAAAAAAAAB8ZgAAAAAAAAAAAHxmAAAAAAAAAAAAfGYAAAAAAAAAAAB8ZgAAAAAAAAAAAHxmAAAAAAAAAAAAfGYAAAAAAB5AQEB+c0BAQAkAPH9/f39/f39/Eg==" }, ["50"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAKR2x7cFYWAAAACm9/Vj5PfHwdAABKfzEAAAAnf1oAAERZAQAAAAB6cAAAAAAAAAAAA31mAAAAAAAAAAA3fzgAAAAAAAAAH3xlAwAAAAAAACx8aAsAAAAAAABAf10HAAAAAAAATH9KAgAAAAAAAEZ/PQAAAAAAAAAnf0gAAAAAAAAAAG1/RUBAQEBAQAgAf39/f39/f39/EA==" }, ["51"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAPTW57b1QWAAAAF3h8UD5QfHwcAABcfyAAAAAnf1kAAEtMAAAAAAF9agAAAAAAAAAAEH9XAAAAAAAAByBneRkAAAAAAHh/f1QQAAAAAAAAP0pef2UTAAAAAAAAAAAde2oBAAAAAAAAAABWfxQMZlAAAAAAAFZ/GQBufBkAAAAQeHkEACB9e08+S3h/NQAAABhTb3x3XiYAAA==" }, ["52"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAAAAAS39OAAAAAAAAACR/f04AAAAAAAAJc1p/TgAAAAAAAFV1E39OAAAAAAAvfyYIf04AAAAAD3hMAAh/TgAAAAFgbQUACH9OAAAAO30bAAAIf04AABd8OwAAAAh/TgAARX9/f39/f39/f0QbMjIyMjI2f2EyGgAAAAAAAAh/TgAAAAAAAAAACH9OAAAAAAAAAAAIf04AAA==" }, ["53"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "ADB/f39/f39/PgAAOH9QQEBAQEAfAAA/fxoAAAAAAAAAAEd/EgAAAAAAAAAAT38KAAAAAAAAAABXfzNleXhdHwAAAF9/d049UH1+KAAAKjULAAAAHn5zAgAAAAAAAAAAWX8ZAAAAAAAAAABLfyEFLicAAAAAAF5/EgFzeRIAAAAif2kAACp+d0k8UX16HAAAAB9Zcn1yURMAAA==" }, ["54"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAJGF5d10dAAAAAC5/az1Bc3sbAAAKeWcEAAASfE4AADl/JAAAAAAEAAAAW3sDAAAAAAAAAABwaxFWd3tkJwAAAHltck8zQHV/LQAAfH8zAAAAEHtzAQB2fgQAAAAAV38WAGZ+AgAAAABKfx0ASX8ZAAAAAFp/EAAZf1sCAAAXfmsAAABGf2U+SHl9IQAAAAAzaHx4WxwAAA==" }, ["55"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AHx/f39/f39/fxAAPkBAQEBAQG96CAAAAAAAAAAdfzoAAAAAAAAAAmtpAgAAAAAAAAA5fyAAAAAAAAAACHhYAAAAAAAAAABCfxgAAAAAAAAABHdhAAAAAAAAAAAwfy8AAAAAAAAAAFt+CQAAAAAAAAACemYAAAAAAAAAABl/TwAAAAAAAAAALH8+AAAAAAAAAAA1fzcAAAAAAA==" }, ["56"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAQT257b1MVAAAAFnh1Piw7cXwfAABTfyAAAAAWf18AAGR/AwAAAAB5cAAAUX8UAAAACH9dAAAWeWMYBBJYfB8AAAAXa39/f3AeAAAAEWx0Piw5bXUeAABgexEAAAAIc3ACBX9gAAAAAABSfxYKf2MAAAAAAFV/GgBvfBEAAAAHdXkEACh+cz0sOGt/NQAAAB1YdX53XSYAAA==" }, ["57"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AAARUXN9cEYGAAAAE3d+TzxYf2MCAABXfysAAABAfzUAAHpvAAAAAAR4YwAFf2AAAAAAAGV8AQB7bwAAAAAAaH8OAFl/KAAAACJ/fxQAF3p9SzZMeGB/EAAAGFx6eFoYVX8HAAAAAAAAAABrcwAAAAgAAAAAE39QAABIfx4AAAFZfxsAABV5eEU7Y39FAAAAABtbdntnMAAAAA==" }, ["58"]: { ["w"]: 6, ["h"]: 11, ["adv"]: 6, ["left"]: 0, ["top"]: 11, ["cov"]: "ABZ/XgAAABZ/XgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABZ/XgAAABZ/XgAA" }, ["59"]: { ["w"]: 6, ["h"]: 14, ["adv"]: 6, ["left"]: 0, ["top"]: 11, ["cov"]: "ABJ/YgAAABJ/YgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABJ/YgAAABJ/YQAAAAAuXAAAAABHSAAAAAV3GQAA" }, ["60"]: { ["w"]: 12, ["h"]: 12, ["adv"]: 12, ["left"]: 0, ["top"]: 12, ["cov"]: "AAAAAAAAAAAGOEsAAAAAAAAAC0J3fDwAAAAAABFLe3pHDQAAAAAZVH53QQkAAAAAAV5/dDsGAAAAAAAAAn9kCAAAAAAAAAAAAV5/czsGAAAAAAAAAAAaVX53QAkAAAAAAAAAABFLe3pGDQAAAAAAAAAAC0J3fDsAAAAAAAAAAAAGOUsAAAAAAAAAAAAAAAAA" }, ["61"]: { ["w"]: 12, ["h"]: 10, ["adv"]: 12, ["left"]: 0, ["top"]: 10, ["cov"]: "An9/f39/f39/f1gAADo6Ojo6Ojo6OicAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAn9/f39/f39/f1gAADo6Ojo6Ojo6OicAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["62"]: { ["w"]: 12, ["h"]: 12, ["adv"]: 12, ["left"]: 0, ["top"]: 12, ["cov"]: "AWEmAAAAAAAAAAAAAV9/ai8CAAAAAAAAAAAcWn9xOAYAAAAAAAAAABdUfndCCwAAAAAAAAAAEk59ezsAAAAAAAAAAAAdeFoAAAAAAAAAEk58ezsAAAAAABdTfndCCwAAAAAcWX9xOQYAAAAAAV9/ajACAAAAAAAAAWEmAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["63"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAOTXB8cl8oAAAAFHZ/ZE1UeH9KAABefzMAAAAKbX8TCX9nAAAAAAA7fysABggAAAAAAEJ/IAAAAAAAAAAOdW4DAAAAAAAAIXNzGQAAAAAAADp+XQwAAAAAAAAdf1UBAAAAAAAAAEZ/FAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFx/GAAAAAAAAAAAXH8YAAAAAA==" }, ["64"]: { ["w"]: 20, ["h"]: 18, ["adv"]: 20, ["left"]: 0, ["top"]: 15, ["cov"]: "AAAAAAAAAitVb3t5a1MkAQAAAAAAAAAAAB5teE4wIiQzWH1fDAAAAAAAAAAwfk4HAAAAAAAAFWptBgAAAAAAI346AAAAAAAAAAAAC3ROAAAAAAZyVAAAC0txel8WNWICMnwIAAAAOngJAA9vbzIkSHFlZwAGfC0AAABsSQAAXnMMAAAAT39KAABtPQAAEH8iABx/NQAAAAAwfy0AAGJGAAAmfwkAQ38MAAAAADt/EQAAaT4AADJ9AABUeAAAAAAAYHUAAAN7LQAAMH0BAFV3AAAAABd/XgAAI38MAAAjfwsARH8QAAAHaHdQAABfVgAAAA9/KQASfWUsM21BYmkhUnQQAAAAAGJZAAApbHxqMgAncXhZEwAAAAAAJ38qAAAAAAAAAAAAAAAAAAAAAAAATHwzAAAAAAAAAAk+KgAAAAAAAAABP35rPisiKT1bfW8pAAAAAAAAAAAAEkNmdH12ZUsjAgAAAAAA" }, ["65"]: { ["w"]: 14, ["h"]: 14, ["adv"]: 13, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAAABGf3gEAAAAAAAAAAAAA3Vwfy8AAAAAAAAAAAAsfyp0YQAAAAAAAAAAAF90AkZ/FAAAAAAAAAATf0QAE39GAAAAAAAAAEZ/EQAAYHUDAAAAAAADdV0AAAAsfysAAAAAAC1/KQAAAAN0XQAAAAAAYH9/f39/f39/EQAAABN/Wjo6Ojo6P39CAAAARn8YAAAAAAAAaHMCAAN2awAAAAAAAAA8fycALX8/AAAAAAAAABB/WgBgfxIAAAAAAAAAAGR+Dg==" }, ["66"]: { ["w"]: 13, ["h"]: 14, ["adv"]: 13, ["left"]: 0, ["top"]: 14, ["cov"]: "AC5/f39/f3ppQwkAAAAuf2BAQEBLbX9rBQAALn9AAAAAAAFffywAAC5/QAAAAAAAOH85AAAuf0AAAAAAAEl/JAAALn9AAAAADDR8XQAAAC5/f39/f39/SwMAAAAuf106OjpBVHtnEwAALn9AAAAAAAAUeWoCAC5/QAAAAAAAAFd/FgAuf0AAAAAAAABZfx4ALn9AAAAAAAAVenoGAC5/YEBAQEVWfH8yAAAuf39/f399c1YeAAA=" }, ["67"]: { ["w"]: 14, ["h"]: 14, ["adv"]: 14, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAAClYcnx1Zj4MAAAAAAdcf3hXR1Buf3UeAAAAWn9WCQAAAAA0fXcKACV/ZgIAAAAAAABBYR0AU38oAAAAAAAAAAAAAABvfwYAAAAAAAAAAAAAAHp3AAAAAAAAAAAAAAAAd3gAAAAAAAAAAAAAAABqfwkAAAAAAAAAAAAAAE1/LwAAAAAAAAAAAAAAH39tBQAAAAAAAB5pJAAAUX9gDQAAAAAldnoTAAAFVX97WUdNaH90IAAAAAAAJlZve3VkOwoAAA==" }, ["68"]: { ["w"]: 14, ["h"]: 14, ["adv"]: 14, ["left"]: 0, ["top"]: 14, ["cov"]: "AC5/f39/fHRdOQcAAAAALn9gQEBDUG9/dSIAAAAuf0AAAAAAAC55exoAAC5/QAAAAAAAACh/YwAALn9AAAAAAAAAAGV/EwAuf0AAAAAAAAAAQ38vAC5/QAAAAAAAAAA1fzkALn9AAAAAAAAAADp/NQAuf0AAAAAAAAAASn8oAC5/QAAAAAAAAABxfQoALn9AAAAAAAAAN39XAAAuf0AAAAAAATR9eA4AAC5/YEBAQU5vf3IcAAAALn9/f39/dWQ6CQAAAA==" }, ["69"]: { ["w"]: 13, ["h"]: 14, ["adv"]: 13, ["left"]: 0, ["top"]: 14, ["cov"]: "AC5/f39/f39/f39/CgAuf2JERERERERERAUALn9AAAAAAAAAAAAAAC5/QAAAAAAAAAAAAAAuf0AAAAAAAAAAAAAALn9AAAAAAAAAAAAAAC5/f39/f39/f39AAAAuf2BAQEBAQEBAIAAALn9AAAAAAAAAAAAAAC5/QAAAAAAAAAAAAAAuf0AAAAAAAAAAAAAALn9AAAAAAAAAAAAAAC5/YkREREREREREIAAuf39/f39/f39/fz4=" }, ["70"]: { ["w"]: 12, ["h"]: 14, ["adv"]: 12, ["left"]: 0, ["top"]: 14, ["cov"]: "AC5/f39/f39/f382AC5/YkREREREREQcAC5/QAAAAAAAAAAAAC5/QAAAAAAAAAAAAC5/QAAAAAAAAAAAAC5/QAAAAAAAAAAAAC5/QAAAAAAAAAAAAC5/f39/f39/f38YAC5/Y0ZGRkZGRkYNAC5/QAAAAAAAAAAAAC5/QAAAAAAAAAAAAC5/QAAAAAAAAAAAAC5/QAAAAAAAAAAAAC5/QAAAAAAAAAAA" }, ["71"]: { ["w"]: 16, ["h"]: 14, ["adv"]: 16, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAAClXcXx3akkWAAAAAAAACF5/eFdHTWV/fTEAAAAAAF1/UwgAAAAAIXZ+GgAAACh/YwEAAAAAAAApay8AAABWfyYAAAAAAAAAAAAAAAAAcX8GAAAAAAAAAAAAAAAAAHx3AAAAAAAAAAAAAAAAAAB5eAAAAAAAYn9/f39/CAAAa38IAAAAADdISEhsfwgAAE1/LQAAAAAAAAAAVH8IAAAdf2sEAAAAAAAAAFR/CAAAAE1/XgwAAAAAAzV6egUAAAAETn97WUZHVnZ/ahcAAAAAAAAgUGx6em5SKgEAAAA=" }, ["72"]: { ["w"]: 14, ["h"]: 14, ["adv"]: 14, ["left"]: 0, ["top"]: 14, ["cov"]: "AC5/QAAAAAAAAAZ/aAAALn9AAAAAAAAABn9oAAAuf0AAAAAAAAAGf2gAAC5/QAAAAAAAAAZ/aAAALn9AAAAAAAAABn9oAAAuf0AAAAAAAAAGf2gAAC5/f39/f39/f39/aAAALn9kSEhISEhISn9oAAAuf0AAAAAAAAAGf2gAAC5/QAAAAAAAAAZ/aAAALn9AAAAAAAAABn9oAAAuf0AAAAAAAAAGf2gAAC5/QAAAAAAAAAZ/aAAALn9AAAAAAAAABn9oAA==" }, ["73"]: { ["w"]: 6, ["h"]: 14, ["adv"]: 6, ["left"]: 0, ["top"]: 14, ["cov"]: "ABR/XAAAABR/XAAAABR/XAAAABR/XAAAABR/XAAAABR/XAAAABR/XAAAABR/XAAAABR/XAAAABR/XAAAABR/XAAAABR/XAAAABR/XAAAABR/XAAA" }, ["74"]: { ["w"]: 10, ["h"]: 14, ["adv"]: 10, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAAH5/f39CAAAAAABCRFh/QgAAAAAAAAAsf0IAAAAAAAAALH9CAAAAAAAAACx/QgAAAAAAAAAsf0IAAAAAAAAALH9CAAAAAAAAACx/QgAAAAAAAAAsf0IAAAAAAAAALH9BADhxIgAAADh/OAAof1sBAAJlfxoAAV9/ZUhnf1cAAAAHRW58cEMDAAA=" }, ["75"]: { ["w"]: 14, ["h"]: 14, ["adv"]: 13, ["left"]: 0, ["top"]: 14, ["cov"]: "AC5/QAAAAAAAK35lBwAALn9AAAAAACZ9aAgAAAAuf0AAAAAhe2oKAAAAAC5/QAAAHHltDAAAAAAALn9AABd3cA4AAAAAAAAuf0ATdHIRAAAAAAAAAC5/T3F/ZQQAAAAAAAAALn9/aUp/UwAAAAAAAAAuf1wFAFZ/PwAAAAAAAC5/QAAABml/KwAAAAAALn9AAAAAEHZ7GgAAAAAuf0AAAAAAIX1zDgAAAC5/QAAAAAAANn9nBQAALn9AAAAAAAAATn9XAA==" }, ["76"]: { ["w"]: 11, ["h"]: 14, ["adv"]: 11, ["left"]: 0, ["top"]: 14, ["cov"]: "AC5/QAAAAAAAAAAALn9AAAAAAAAAAAAuf0AAAAAAAAAAAC5/QAAAAAAAAAAALn9AAAAAAAAAAAAuf0AAAAAAAAAAAC5/QAAAAAAAAAAALn9AAAAAAAAAAAAuf0AAAAAAAAAAAC5/QAAAAAAAAAAALn9AAAAAAAAAAAAuf0AAAAAAAAAAAC5/YkRERERERB4ALn9/f39/f39/Og==" }, ["77"]: { ["w"]: 17, ["h"]: 14, ["adv"]: 17, ["left"]: 0, ["top"]: 14, ["cov"]: "AC5/fyMAAAAAAAAASH9/AgAALn9+VAAAAAAAAAJ0fn8CAAAuf2N7CAAAAAAAJn9kfwIAAC5/Pn80AAAAAABVcVB/AgAALn8mb2QAAAAACHxGU38CAAAufyZBfxQAAAA0fxdUfwIAAC5/JhF/RAAAAGNnAFR/AgAALn8mAGByAQASfzcAVH8CAAAufyYAMH8kAEJ9CgBUfwIAAC5/JgAFeVQAcFgAAFR/AgAALn8mAABPeSB/KAAAVH8CAAAufyYAAB9/YnYDAABUfwIAAC5/JgAAAG5/SQAAAFR/AgAALn8mAAAAPn8ZAAAAVH8CAA==" }, ["78"]: { ["w"]: 14, ["h"]: 14, ["adv"]: 14, ["left"]: 0, ["top"]: 14, ["cov"]: "AC5/fBMAAAAAAABuaAAALn9/XgAAAAAAAG5oAAAuf15/LQAAAAAAbmgAAC5/Jm90CAAAAABuaAAALn8lJX9MAAAAAG5oAAAufyYAVn4bAAAAbmgAAC5/JgANeWgBAABuaAAALn8mAAA4fzkAAG5oAAAufyYAAAFneQ4AbmgAAC5/JgAAABt+VwBtaAAALn8mAAAAAEx/JmloAAAufyYAAAAACHRwaWgAAC5/JgAAAAAALn9/aAAALn8mAAAAAAAAX39oAA==" }, ["79"]: { ["w"]: 16, ["h"]: 14, ["adv"]: 16, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAACpYcnx2Z0EPAAAAAAAACV9/eFZHS2V/ei4AAAAAAV9/UAcAAAAAIHV/IQAAACx/XgAAAAAAAAAdf24AAABbfx8AAAAAAAAAAFt/HQAAd3sCAAAAAAAAAAA4fzkAAn9vAAAAAAAAAAAAKn9GAAF9cAAAAAAAAAAAACp/RAAAcXwDAAAAAAAAAAA5fzcAAFN/JAAAAAAAAAAAW38YAAAkf2MBAAAAAAAAG35oAAAAAFV/VQgAAAAAHHN9GgAAAAAGV394VUVJYn93JQAAAAAAAAAmVm97dmY+DAAAAAA=" }, ["80"]: { ["w"]: 13, ["h"]: 14, ["adv"]: 13, ["left"]: 0, ["top"]: 14, ["cov"]: "AC5/f39/f350WR8AAAAuf2BAQEBFWH1/LwAALn9AAAAAAAAbfHcDAC5/QAAAAAAAAFt/GwAuf0AAAAAAAABTfx8ALn9AAAAAAAACbn8LAC5/QAAAAAQWVn9RAAAuf39/f39/f39VBQAALn9ePDw8OzEUAAAAAC5/QAAAAAAAAAAAAAAuf0AAAAAAAAAAAAAALn9AAAAAAAAAAAAAAC5/QAAAAAAAAAAAAAAuf0AAAAAAAAAAAAA=" }, ["81"]: { ["w"]: 16, ["h"]: 18, ["adv"]: 16, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAAACpYcnx2Z0EPAAAAAAAACV9/eFdHS2V/ei4AAAAAAV9/UQcAAAAAIHV/IQAAACx/XwAAAAAAAAAdf24AAABafyAAAAAAAAAAAFt/HQAAdnsCAAAAAAAAAAA4fzgAAn9vAAAAAAAAAAAAKn9FAAF+cAAAAAAAAAAAACp/RwAAc3wDAAAAAAAAAAA4fzoAAFZ/IgAAAAAAAAAAWn8dAAAof2EBAAAAAAAAGX5rAAAAAFx/UQYAAAAAGHF+IAAAAAAIX391Tz9DXX56LAAAAAAAAAErW3J/f2lFEAAAAAAAAAAAAAAAV38kAAAAAAAAAAAAAAAAACZ/YgEAAAAAAAAAAAAAAAAAXX9iODUAAAAAAAAAAAAAAAZIcnldAAAA" }, ["82"]: { ["w"]: 14, ["h"]: 14, ["adv"]: 14, ["left"]: 0, ["top"]: 14, ["cov"]: "AC5/f39/f398bksNAAAALn9gQEBAQElmf3URAAAuf0AAAAAAAABBf1MAAC5/QAAAAAAAAAR+cwAALn9AAAAAAAAAAHp0AAAuf0AAAAAAAAAef14AAC5/QAAAAAAIJ3B/IwAALn9/f39/f39/dy8AAAAuf148PDxAfm4EAAAAAC5/QAAAAABFfzkAAAAALn9AAAAAAARtexQAAAAuf0AAAAAAAB9/ZQIAAC5/QAAAAAAAAEx/PwAALn9AAAAAAAAAB3J9GA==" }, ["83"]: { ["w"]: 13, ["h"]: 14, ["adv"]: 13, ["left"]: 0, ["top"]: 14, ["cov"]: "AAABMl51fXtuUBUAAAAAWX9xRjg9V314HAAAI39mBAAAAAAlf2QAADV/OAAAAAAAAC4iAQAif0gAAAAAAAAAAAAAAVx/Tx8CAAAAAAAAAAADOWx/e2BCHQAAAAAAAAAAETBNcH9mFgAAAAAAAAAAAAAgdXMHAAAAAAAAAAAAAD9/JwFNXAEAAAAAAABGfzAAXH9EAAAAAAAUdn4TAA9vf25KPkNXfX87AAAABjtidn57bVAcAAA=" }, ["84"]: { ["w"]: 12, ["h"]: 14, ["adv"]: 12, ["left"]: 0, ["top"]: 14, ["cov"]: "Rn9/f39/f39/f39iJURERER1f0VEREQ0AAAAAABqfwQAAAAAAAAAAABqfwQAAAAAAAAAAABqfwQAAAAAAAAAAABqfwQAAAAAAAAAAABqfwQAAAAAAAAAAABqfwQAAAAAAAAAAABqfwQAAAAAAAAAAABqfwQAAAAAAAAAAABqfwQAAAAAAAAAAABqfwQAAAAAAAAAAABqfwQAAAAAAAAAAABqfwQAAAAA" }, ["85"]: { ["w"]: 14, ["h"]: 14, ["adv"]: 14, ["left"]: 0, ["top"]: 14, ["cov"]: "ADp/NAAAAAAAAAB6dAAAOn80AAAAAAAAAHp0AAA6fzQAAAAAAAAAenQAADp/NAAAAAAAAAB6dAAAOn80AAAAAAAAAHp0AAA6fzQAAAAAAAAAenQAADp/NAAAAAAAAAB6dAAAOn80AAAAAAAAAHp0AAA5fzUAAAAAAAAAe3IAAC9/QwAAAAAAAAd/ZgAAGH9jAAAAAAAALX9LAAAAYn87AAAAABZzfBUAAAAPb39pTUVafXwuAAAAAAAGPmd4e25MFQAAAA==" }, ["86"]: { ["w"]: 14, ["h"]: 14, ["adv"]: 13, ["left"]: 0, ["top"]: 14, ["cov"]: "Wn8eAAAAAAAAAAFxfAknf08AAAAAAAAAJH9SAAFyegYAAAAAAABVfx8AAEB/MgAAAAAACXxsAAAADn5kAAAAAAA3fzkAAAAAWn8VAAAAAGd8CQAAAAAnf0cAAAAZf1IAAAAAAAFxdQIAAEp/HwAAAAAAAEB/KQADdmsAAAAAAAAADn5bACt/OAAAAAAAAAAAWX4KWXsJAAAAAAAAAAAmfzp8UgAAAAAAAAAAAAFxen8eAAAAAAAAAAAAAD9/awAAAAAAAA==" }, ["87"]: { ["w"]: 19, ["h"]: 14, ["adv"]: 19, ["left"]: 0, ["top"]: 14, ["cov"]: "Yn8VAAAAAABKfz8AAAAAACN/VT1/OAAAAAAAbX9iAAAAAABGfzAYf1wAAAAAEH9ofQcAAAAAaX8LAHJ7BAAAADR/L38oAAAADH9lAABOfyMAAABXdAN7SwAAAC5/QAAAKX9GAAACeFMAXW4AAABRfxsAAAZ9agAAHX8xADx/EQAAc3UBAAAAX38OAEB/DwAZfzQAFn9RAAAAADp/MQBjbQAAAXZXADh/LAAAAAAVf1EGfUoAAABVdwFafggAAAAAAG9vI38oAAAAM38ZeWEAAAAAAABLf01+BwAAABF/TH88AAAAAAAAJn98YwAAAAAAb3t/FwAAAAAAAAV7f0EAAAAAAE1/cgAAAAA=" }, ["88"]: { ["w"]: 13, ["h"]: 14, ["adv"]: 13, ["left"]: 0, ["top"]: 14, ["cov"]: "AmN/IQAAAAAABGx8FwAReHEIAAAAAEh/OgAAAC5/UgAAAB9/XwAAAAAAUn8rAAZvdw4AAAAAAAdudw1LfyoAAAAAAAAAHH1qf1AAAAAAAAAAAABEf3kHAAAAAAAAAAAEan5/MwAAAAAAAAAAS38qaXoRAAAAAAAAJ39OABh9YwEAAAAADXZvBgAAQH8+AAAAAV5+HwAAAAJnfRkAADx/RgAAAAAAFnxrBBp9agMAAAAAAAA9f0k=" }, ["89"]: { ["w"]: 13, ["h"]: 14, ["adv"]: 13, ["left"]: 0, ["top"]: 14, ["cov"]: "H39kAQAAAAAAADx/SgBMfzYAAAAAABB6cQYAB3J4DQAAAABafyQAAAAmf1YAAAAqf1EAAAAAAFR/JgAGcnUJAAAAAAALdnEGSH8sAAAAAAAAAC9/Wn5ZAAAAAAAAAAAAXH94DQAAAAAAAAAAACN/TQAAAAAAAAAAAAAif0wAAAAAAAAAAAAAIn9MAAAAAAAAAAAAACJ/TAAAAAAAAAAAAAAif0wAAAAAAAAAAAAAIn9MAAAAAAA=" }, ["90"]: { ["w"]: 12, ["h"]: 14, ["adv"]: 12, ["left"]: 0, ["top"]: 14, ["cov"]: "AFR/f39/f39/f38SACxERERERERNf3YIAAAAAAAAAABbfyQAAAAAAAAAADx/QgAAAAAAAAAAH35gAQAAAAAAAAALcnQMAAAAAAAAAAFdfiIAAAAAAAAAAD9/QAAAAAAAAAAAIX5eAQAAAAAAAAAMdHMLAAAAAAAAAAFgfiAAAAAAAAAAAEN/PQAAAAAAAAAAHH96REREREREREQoLn9/f39/f39/f39M" }, ["91"]: { ["w"]: 6, ["h"]: 19, ["adv"]: 6, ["left"]: 0, ["top"]: 15, ["cov"]: "AEp/f380AEp/LSINAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/EAAAAEp/LSINAEp/f380" }, ["92"]: { ["w"]: 6, ["h"]: 15, ["adv"]: 6, ["left"]: 0, ["top"]: 15, ["cov"]: "b1YAAAAATXcBAAAAK38bAAAACn89AAAAAGdgAAAAAEV8BQAAACN/JAAAAAR8RgAAAABfaQAAAAA9fwsAAAAbfy0AAAABd08AAAAAV3IAAAAANX8UAAAAE382" }, ["93"]: { ["w"]: 6, ["h"]: 19, ["adv"]: 6, ["left"]: 0, ["top"]: 15, ["cov"]: "bH9/fxAAHCJWfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAAABIfxAAHCJWfxAAbH9/fxAA" }, ["94"]: { ["w"]: 10, ["h"]: 14, ["adv"]: 9, ["left"]: 0, ["top"]: 14, ["cov"]: "AAAASX9yBAAAAAAADnxCezgAAAAAAExyA0l0BQAAABB9NgANezwAAABQcgMAAEh3BwATfjcAAAAMe0AAU3MEAAAAAEh5CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }, ["95"]: { ["w"]: 13, ["h"]: 5, ["adv"]: 11, ["left"]: -1, ["top"]: 0, ["cov"]: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJn9/f39/f39/f39/LAoiIiIiIiIiIiIiIgs=" }, ["96"]: { ["w"]: 7, ["h"]: 15, ["adv"]: 7, ["left"]: 0, ["top"]: 15, ["cov"]: "AFR/OAAAAAAAQnwbAAAAAAAubAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["97"]: { ["w"]: 12, ["h"]: 11, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAYVHF8b1APAAAAABV5dT4vQXhzCQAAADx4KAAAADV/NQAAAAAAAAAAAB5/RgAAAAAoWXB5fH9/SAAAADx/ajcnIjR/SAAAA3l0BgAAACF/SAAAEH9YAAAAAEB/SAAABX9mAAAAE3R/SgAAAFt/SyxBdSp+bB0EAAtTdXpiIgBBeXUN" }, ["98"]: { ["w"]: 11, ["h"]: 15, ["adv"]: 11, ["left"]: 0, ["top"]: 15, ["cov"]: "AFR/DgAAAAAAAAAAVH8OAAAAAAAAAABUfw4AAAAAAAAAAFR/DgAAAAAAAAAAVH8RRnJ8bDQAAABUf1lfND1xfzAAAFR/XwEAABF8bgAAVH8rAAAAAF9/DgBUfxUAAAAATn8dAFR/DwAAAABJfyIAVH8TAAAAAE1/HQBUfyYAAAAAX38MAFR/VwAAAA58agAAVH9dWjA1bX8sAABXfwhHc3xrMAAA" }, ["99"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAPUXR7bEAFAAANdHpFNFB/XQAATn8gAAAATHgcAHdvAAAAAAAAAAx/XQAAAAAAAAASf1kAAAAAAAAADH9fAAAAAAAAAAB3dAAAAAAAAAAAT38pAAAAQXkjAA50ekY1Tn5lAwAAEFJ1fG5ECAA=" }, ["100"]: { ["w"]: 11, ["h"]: 15, ["adv"]: 11, ["left"]: 0, ["top"]: 15, ["cov"]: "AAAAAAAAAAB+ZAAAAAAAAAAAAH5kAAAAAAAAAAAAfmQAAAAAAAAAAAB+ZAAAACVmfHVQCX1kAAAdfnU5LlFifWQAAFt/GgAAAEl/ZAABe24AAAAAF39kAA1/XQAAAAAEf2QAEn9ZAAAAAAB/ZAAOf10AAAAABn9kAAJ8bgAAAAAcf2QAAF9/GwAAAFB/ZAAAJH92QDJWX3dkAAAAK2l8dVAIcWYA" }, ["101"]: { ["w"]: 11, ["h"]: 11, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAMS3F9dFMSAAAAC3B9RSw9d3YSAABMfy4AAAAaf1UAAHZ0AAAAAABlewIMf20wMDAwMGN/ExJ/fnx8fHx8fHwbC39hAAAAAAAAAAAAdnQBAAAAAAAAAABMfzAAAAAFZUgAAAtxfkktNml+KQAAAAxLcX11WiAAAA==" }, ["102"]: { ["w"]: 6, ["h"]: 15, ["adv"]: 6, ["left"]: 0, ["top"]: 15, ["cov"]: "AAAtb3xFAAd7djggABl/SwAAAB5/RAAAXH9/f39MGTl/VCQVAB5/RAAAAB5/RAAAAB5/RAAAAB5/RAAAAB5/RAAAAB5/RAAAAB5/RAAAAB5/RAAAAB5/RAAA" }, ["103"]: { ["w"]: 11, ["h"]: 15, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAkZXt0SARxZgAAHn52PC9eWXhkAABcfxoAAAFff2QAAXtsAAAAACR/ZAANf1oAAAAAB39kABJ/VAAAAAAAfmQAD39ZAAAAAAV/ZAACfWkAAAAAIX9kAABjfhQAAAFcf2QAACp/cjgtXFB8ZAAAADFsfHFBAn1iAAAAAAAAAAAKf1gAADJkGwAAADZ/OgAAGntzPTBJfXAIAAAAHFl0fXJODQAA" }, ["104"]: { ["w"]: 11, ["h"]: 15, ["adv"]: 11, ["left"]: 0, ["top"]: 15, ["cov"]: "AE5/EgAAAAAAAAAATn8SAAAAAAAAAABOfxIAAAAAAAAAAE5/EQAAAAAAAAAATn8QPG97bDkAAABOf1BjNzdrfzIAAE5/YAIAABR/WgAATn8nAAAAAHxnAABOfxUAAAAAeGoAAE5/EgAAAAB4agAATn8SAAAAAHhqAABOfxIAAAAAeGoAAE5/EgAAAAB4agAATn8SAAAAAHhqAABOfxIAAAAAeGoA" }, ["105"]: { ["w"]: 4, ["h"]: 15, ["adv"]: 4, ["left"]: 0, ["top"]: 15, ["cov"]: "AFR/DAA5WAgAAAAAAAAAAABUfwwAVH8MAFR/DABUfwwAVH8MAFR/DABUfwwAVH8MAFR/DABUfwwAVH8M" }, ["106"]: { ["w"]: 5, ["h"]: 19, ["adv"]: 4, ["left"]: -1, ["top"]: 15, ["cov"]: "AABUfwwAADlYCAAAAAAAAAAAAAAAAFR/DAAAVH8MAABUfwwAAFR/DAAAVH8MAABUfwwAAFR/DAAAVH8MAABUfwwAAFR/DAAAVH8MAABUfwwAAFx/Bho9fG8AOn5uIgA=" }, ["107"]: { ["w"]: 11, ["h"]: 15, ["adv"]: 10, ["left"]: 0, ["top"]: 15, ["cov"]: "AFR/DgAAAAAAAAAAVH8OAAAAAAAAAABUfw4AAAAAAAAAAFR/DgAAAAAAAAAAVH8OAAABVn8uAABUfw4AAEd/OQAAAFR/DgA1f0UAAAAAVH8OJn5QAAAAAABUfyd6YgIAAAAAAFR/eX94EAAAAAAAVH9eKH5iAQAAAABUfw4AQ39BAAAAAFR/DgACZX4eAAAAVH8OAAATenEIAABUfw4AAAAxf1UA" }, ["108"]: { ["w"]: 4, ["h"]: 15, ["adv"]: 4, ["left"]: 0, ["top"]: 15, ["cov"]: "AFR/DgBUfw4AVH8OAFR/DgBUfw4AVH8OAFR/DgBUfw4AVH8OAFR/DgBUfw4AVH8OAFR/DgBUfw4AVH8O" }, ["109"]: { ["w"]: 17, ["h"]: 11, ["adv"]: 17, ["left"]: 0, ["top"]: 11, ["cov"]: "AFF/BEd0emAUAkNyeWIZAAAATn9OWTRMf2hIXTVFfXQDAABOf1kAAABdf2EBAABPfx0AAE5/JgAAAEZ/MQAAADh/KQAATn8VAAAAQH8hAAAAMn8sAABOfxIAAABAfx4AAAAyfywAAE5/EgAAAEB/HgAAADJ/LAAATn8SAAAAQH8eAAAAMn8sAABOfxIAAABAfx4AAAAyfywAAE5/EgAAAEB/HgAAADJ/LAAATn8SAAAAQH8eAAAAMn8sAA==" }, ["110"]: { ["w"]: 11, ["h"]: 11, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AFF/Ajxve2w4AAAATn9KYjc3an8xAABOf2ABAAAVf1oAAE5/KAAAAAB8ZwAATn8WAAAAAHhqAABOfxIAAAAAeGoAAE5/EgAAAAB4agAATn8SAAAAAHhqAABOfxIAAAAAeGoAAE5/EgAAAAB4agAATn8SAAAAAHhqAA==" }, ["111"]: { ["w"]: 11, ["h"]: 11, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAPT3J9dVkbAAAADnR5Pyo8dXweAABQfyYAAAAVfmQAAHhzAAAAAABifwoMf14AAAAAAE5/HBJ/WQAAAAAASX8iDH9fAAAAAABPfxsAd3QAAAAAAGR/CABOfyYAAAAXfl4AAA1zeD0oOXN5FwAAAA9Pc310UxQAAA==" }, ["112"]: { ["w"]: 11, ["h"]: 15, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AFd/CEhzfGw0AAAAVH9aXjU9cX8yAABUf2ABAAAQfG8AAFR/LAAAAABffw4AVH8WAAAAAE5/HQBUfw8AAAAASX8iAFR/EwAAAABOfx0AVH8mAAAAAF9/DABUf1YAAAAOfGoAAFR/YFkwNW5/LAAAVH8TSHN8azAAAABUfw4AAAAAAAAAAFR/DgAAAAAAAAAAVH8OAAAAAAAAAABUfw4AAAAAAAAA" }, ["113"]: { ["w"]: 11, ["h"]: 15, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AAAlZnx1Twh0aAAAHX50OS5SYXtlAABbfxoAAABKf2QAAXtuAAAAABd/ZAANf10AAAAABH9kABJ/WQAAAAAAf2QADn9dAAAAAAZ/ZAACfG8AAAAAHX9kAABffxwAAABTf2QAACN/d0AyV196ZAAAACpofHZRCH1kAAAAAAAAAAAAfmQAAAAAAAAAAAB+ZAAAAAAAAAAAAH5kAAAAAAAAAAAAfmQA" }, ["114"]: { ["w"]: 7, ["h"]: 11, ["adv"]: 7, ["left"]: 0, ["top"]: 11, ["cov"]: "AFR/CF17JgBRf0tuUx0ATn9hBQAAAE5/MQAAAABOfxsAAAAATn8SAAAAAE5/EgAAAABOfxIAAAAATn8SAAAAAE5/EgAAAABOfxIAAAA=" }, ["115"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "AAM6aHh5aT0CAABOf1AwMFF/TQAAemIAAAAAQFIBAHd0DQAAAAAAAAA7f3pVMw4AAAAAACRZe39/WxAAAAAAAAQiT39tAwAAAAAAAABKfxocbiwAAAAASX8ZA2t7STExS35jAAAKSG16eWk+BgA=" }, ["116"]: { ["w"]: 6, ["h"]: 13, ["adv"]: 6, ["left"]: 0, ["top"]: 13, ["cov"]: "AAV9JAAAACN/JAAAWn9/f38eGU9/PSQIADx/JAAAADx/JAAAADx/JAAAADx/JAAAADx/JAAAADx/JAAAADp/KAAAACl/YjUZAAJWenEp" }, ["117"]: { ["w"]: 11, ["h"]: 11, ["adv"]: 11, ["left"]: 0, ["top"]: 11, ["cov"]: "AFp/CAAAAAJ/XgAAWn8IAAAAAn9eAABafwgAAAACf14AAFp/CAAAAAJ/XgAAWn8IAAAAAn9eAABafwgAAAACf14AAFp/CAAAAAZ/XgAAWH8MAAAAGX9eAABLfyUAAABSf14AACN/cTk1W1V2XgAAADBqe3NIBHJhAA==" }, ["118"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "Yn8NAAAAAA5/YDV/NQAAAAA4fzIKfV8AAAAAY3wIAFt+CgAADn9WAAAvfzEAADh/KAAABntbAABjdwMAAABVfAcOf0wAAAAAKH8sN38eAAAAAAN4UF5wAAAAAAAAT3R9QgAAAAAAACJ/fxQAAAA=" }, ["119"]: { ["w"]: 16, ["h"]: 11, ["adv"]: 14, ["left"]: -1, ["top"]: 11, ["cov"]: "AHJpAAAAAGp/JQAAACx/LgBQfwgAAAp/d0QAAABMfwsALX8mAAAqfUtjAAAAa2cAAAt/RAAASmQsfQUAC39EAAAAaGMAAGpGDn8hACt/IQAAAEZ9BQp/JwBwQABLegMAAAAjfyAqfwkAUl8AaloAAAAABHw/SmkAADN7DX83AAAAAABeWmpKAAAVf0R/FAAAAAAAPHh/KgAAAHZ3cAAAAAAAABl/fwsAAABZf00AAAA=" }, ["120"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "In9TAAAAAFt+HgBLfyIAACl/RwAABm9tAwVxbAQAAAAgf0BFfhwAAAAAAEp8fUUAAAAAAAAZf38WAAAAAAABY3R2YQAAAAAAOn8rMH83AAAAE3taAABfehIAAWN6DwAAE3xiATl/OAAAAAA+fzk=" }, ["121"]: { ["w"]: 10, ["h"]: 15, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "Yn4OAAAAAAl9ZDF/OwAAAAAxfzQGeWoAAAAAW3wJAE9/GQAAB3xWAAAef0cAAC9/JwAAAGx0AgBYdQIAAAA8fyMGe0gAAAAADH5NLX8ZAAAAAABadVpqAAAAAAAAKX9/OgAAAAAAAAJ1fg0AAAAAAAAJeVcAAAAAAAAATX8bAAAAABI0WH9KAAAAAAAne3RCAgAAAAAA" }, ["122"]: { ["w"]: 10, ["h"]: 11, ["adv"]: 10, ["left"]: 0, ["top"]: 11, ["cov"]: "AG5/f39/f39mAAAnLi4uLld/UQAAAAAAABJ5cgkAAAAAAAJkfiAAAAAAAABCf0QAAAAAAAAefmYCAAAAAAAHcHoTAAAAAAAAU38zAAAAAAAAL39XAAAAAAAAC3h+Ny4uLi4uABh/f39/f39/fwA=" }, ["123"]: { ["w"]: 7, ["h"]: 19, ["adv"]: 7, ["left"]: 0, ["top"]: 15, ["cov"]: "AAAAQ3R/KgAAJH9iKAsAAEB/GgAAAABIfwsAAAAASH8KAAAAAEh/CgAAAABJfwoAAAAAWn4DAAAFL35PAAAAVn9ZAgAAABlMf0AAAAAAAGJ7AQAAAABKfwkAAAAASH8KAAAAAEh/CgAAAABIfwoAAAAAQX8ZAAAAACR/YScLAAAAQnV/Kg==" }, ["124"]: { ["w"]: 5, ["h"]: 19, ["adv"]: 5, ["left"]: 0, ["top"]: 15, ["cov"]: "ABx/NAAAHH80AAAcfzQAABx/NAAAHH80AAAcfzQAABx/NAAAHH80AAAcfzQAABx/NAAAHH80AAAcfzQAABx/NAAAHH80AAAcfzQAABx/NAAAHH80AAAcfzQAABx/NAA=" }, ["125"]: { ["w"]: 7, ["h"]: 19, ["adv"]: 7, ["left"]: 0, ["top"]: 15, ["cov"]: "Vn5qHwAAABYzeHICAAAAAEd/EgAAAAA3fxoAAAAANn8aAAAAADZ/GgAAAAA2fxsAAAAALX8rAAAAAAh1ahgBAAAAF3N/KAAABGp2NQoAACp/MwAAAAA1fxwAAAAANn8aAAAAADZ/GgAAAAA3fxoAAAAARn8TAAAWMnhyAgAAVn5pHgAAAA==" }, ["126"]: { ["w"]: 12, ["h"]: 8, ["adv"]: 12, ["left"]: 0, ["top"]: 8, ["cov"]: "AC5se2c5BgAAADMAC35JM096dkgxWmMACysAAAAJQXB8YxsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } }, ["30"]: { ["32"]: { ["w"]: 0, ["h"]: 0, ["adv"]: 8, ["left"]: 0, ["top"]: 0, ["cov"]: "" }, ["33"]: { ["w"]: 8, ["h"]: 21, ["adv"]: 8, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAgf39MAAAAAB1/f0kAAAAAGn9/RgAAAAAXf39DAAAAABR/f0AAAAAAEX9/PQAAAAAOf386AAAAAAt/fzYAAAAACH9/MwAAAAAFf38wAAAAAAJ/fy0AAAAAAH5/KgAAAAAAfH8nAAAAAAB5fyQAAAAAAHV/IQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmf39GAAAAACZ/f0YAAAAAJn9/RgAA" }, ["34"]: { ["w"]: 11, ["h"]: 21, ["adv"]: 11, ["left"]: 0, ["top"]: 21, ["cov"]: "AFl/eAAAJX9/LAAAUn9xAAAef38lAABLf2oAABh/fx4AAEV/YwAAEn9/FwAAPn9cAAALf38QAAA3f1UAAAV/fwkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["35"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAAAdFkAAAAAAntQAAAAAAAAABB/PgAAAAAZfzQAAAAAAAAALH8iAAAAADR/GQAAAAAAAABIfwcAAAAAUHsCAAAAAAAAAGRrAAAAAABrYgAAAAAAAAADfE8AAAAAB39HAAAAEH9/f39/f39/f39/f39/f0QQf39/f39/f39/f39/f39/RAAAAABFfwwAAAAAT3wEAAAAAAAAAGJuAAAAAABsZAAAAAAAAAADfFAAAAAACX9GAAAAAAAAAB1/MgAAAAAmfykAAAAAAAAAO38UAAAAAEN/DAAAAABwf39/f39/f39/f39/f39mAHB/f39/f39/f39/f39/f2YAAAAFfkoAAAAADX9EAAAAAAAAAB1/MAAAAAAofygAAAAAAAAAOH8VAAAAAEN/DQAAAAAAAABSegEAAAAAXXIAAAAAAAAAAGxhAAAAAAB3VgAAAAAAAAAHf0cAAAAAEn87AAAAAAAA" }, ["36"]: { ["w"]: 17, ["h"]: 24, ["adv"]: 17, ["left"]: 0, ["top"]: 22, ["cov"]: "AAAAAAAAADR/NAAAAAAAAAAAAAAAAAAANH80AAAAAAAAAAAAAAY1W3J9f31xWS8CAAAAAAAdcn9/f39/f39/f2cMAAAADHh/eUIePH8/KF1/f2QBAABAf38fAAA0fzQAAEx/fykAAFh/bwAAADR/NAAACHx0PQAAWX9tAAAANH80AAAACAAAAABEf38gAAA0fzQAAAAAAAAAABF7f3o8CzR/NAAAAAAAAAAAACZ6f39/dH9MDwAAAAAAAAAAABBOeX9/f39/a0EMAAAAAAAAAAADI1h/f39/f3oyAAAAAAAAAAAANH85JlF8f38rAAAAAAAAAAA0fzQAABd3f20AAAAAAAAAADR/NAAAAD5/fw4aQFYBAAAANH80AAAAK39/Fzp/fycAAAA0fzQAAAA9f38LC3t/dRMAADR/NAAAE3V/ZQAANH9/fE4tRH9DK018f30eAAAAM3l/f39/f39/f390JAAAAAAACzpdcn1/fXFaNQYAAAAAAAAAAAAANH80AAAAAAAAAAAAAAAAAAA0fzQAAAAAAAAA" }, ["37"]: { ["w"]: 27, ["h"]: 21, ["adv"]: 27, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAFQm18d1oZAAAAAAAAAAAAL39wBgAAAAAAAAFgf3FOW397GgAAAAAAAAALdn8kAAAAAAAAACx/bgYAAD1/YAAAAAAAAABUf1EAAAAAAAAAAFV/PQAAAAh+fwsAAAAAACZ/dQkAAAAAAAAAAGx/JgAAAABwfyEAAAAABnF/LAAAAAAAAAAAAHV/HQAAAABofyoAAAAASn9aAAAAAAAAAAAAAHR/HgAAAABofyoAAAAdf3kOAAAAAAAAAAAAAGp/KAAAAAByfx8AAANrfzUAAAAAAAAAAAAAAFJ/QQAAAA1/fggAAEF/YQAAAAAAAAAAAAAAACZ/cgsAAEt/WgAAFn18FAAANGZ6emMrAAAAAABZf3ZYZ393FAABZH89AABEf3tYWnx/NAAAAAADP218dlYUAAA4f2gCABB+fhoAACN/eQYAAAAAAAAAAAAAABB6fhoAADd/XQAAAABqfykAAAAAAAAAAAAAAFx/RgAAAE1/RQAAAABTf0AAAAAAAAAAAAAAL39uBQAAAFZ/PAAAAABKf0oAAAAAAAAAAAALdn8hAAAAAFd/OwAAAABKf0oAAAAAAAAAAABUf04AAAAAAE1/RQAAAABUf0AAAAAAAAAAACZ/cwgAAAAAADZ/XQAAAABufycAAAAAAAAABnF/KQAAAAAAAA59fhkAACp/dgQAAAAAAAAASn9XAAAAAAAAAAA/f3pVWX1/LAAAAAAAAAAdf3gNAAAAAAAAAAAAMGZ7emAjAAAA" }, ["38"]: { ["w"]: 20, ["h"]: 21, ["adv"]: 20, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAAACkVre3trQwcAAAAAAAAAAAAAAA9yf31sa35/bgwAAAAAAAAAAAAAVn9uEwAAFXF/TQAAAAAAAAAAAAJ8fywAAAAAM39xAAAAAAAAAAAAC39/FgAAAAApf3UAAAAAAAAAAAAEf38hAAAAAFt/WQAAAAAAAAAAAABsfzoAAAVQf3wZAAAAAAAAAAAAAEd/agY4cn96JwAAAAAAAAAAAAAAFX9/en9/WREAAAAAAAAAAAAAABVZf39/UxoAAAAAAAAAAAAAAAA6fX99f38qAAAAAAAvZDYAAAAAP39/WBFUf3AGAAAAAFV/TwAAABt/f0wAAA96f0oAAAAGe38mAAAAUn9zBAAAADZ/fyYAADV/cgEAAABvf1AAAAAAAF1/dhADcH86AAAAAHR/RQAAAAAADHR/akR/cwUAAAAAaH9aAAAAAAAAH31/f38tAAAAAABFf34bAAAAAAAATn9/eAkAAAAAAAx3f3czCAABHFN/f39/by0NDRAAAB10f39/eH1/f3w9NH5/f39/RgAAAAk7YXZ9d2RBDQAAFlJyfXQ0" }, ["39"]: { ["w"]: 6, ["h"]: 21, ["adv"]: 6, ["left"]: 0, ["top"]: 21, ["cov"]: "ADl/fxgAADJ/fxEAACt/fwoAACV/fwMAAB5/fAAAABd/dQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["40"]: { ["w"]: 10, ["h"]: 28, ["adv"]: 10, ["left"]: 0, ["top"]: 22, ["cov"]: "AAAAAAAAGXp/MwAAAAAADHJ/SwAAAAAAAFt/bAQAAAAAAC9/fx8AAAAAAAVzf1gAAAAAAAA2f38cAAAAAAAAbH9mAAAAAAAAGX9/PAAAAAAAAD1/fxcAAAAAAABaf3kBAAAAAAAAcH9kAAAAAAAAAn5/VAAAAAAAAAp/f0kAAAAAAAAPf39EAAAAAAAAD39/RAAAAAAAAAp/f0kAAAAAAAACfn9UAAAAAAAAAHF/ZAAAAAAAAABaf3kBAAAAAAAAPn9/FgAAAAAAABl/fzsAAAAAAAAAbn9mAAAAAAAAADd/fxsAAAAAAAAFc39YAAAAAAAAAC9/fx8AAAAAAAAAW39sBAAAAAAAAAxzf0sAAAAAAAAAGXp/Mw==" }, ["41"]: { ["w"]: 10, ["h"]: 28, ["adv"]: 10, ["left"]: 0, ["top"]: 22, ["cov"]: "NX95FwAAAAAAAABNf3EKAAAAAAAABW1/WAAAAAAAAAAgf38sAAAAAAAAAFl/cAQAAAAAAAAdf38yAAAAAAAAAGd/aQAAAAAAAAA8f38UAAAAAAAAF39/OgAAAAAAAAF5f1cAAAAAAAAAZH9tAAAAAAAAAFR/fAEAAAAAAABKf38HAAAAAAAARH9/DQAAAAAAAEV/fw0AAAAAAABKf38IAAAAAAAAVH99AQAAAAAAAGR/bgAAAAAAAAF5f1gAAAAAAAAXf387AAAAAAAAPH9/FgAAAAAAAGd/agAAAAAAABx/fzQAAAAAAABYf3EEAAAAAAAgf38tAAAAAAAFbX9ZAAAAAAAATH9xCgAAAAAANX96GAAAAAAAAA==" }, ["42"]: { ["w"]: 12, ["h"]: 21, ["adv"]: 12, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAA5/bQAAAAAAAAAAAAl/ZwAAAAAAAAEAAAR/YgAAAAAACHJCDgB+XQAcUVkALn9/fld9bmh/f30IAh5BZH5/f3hYNRMAAAAAAF5/fzEAAAAAAAAAOn9NcHkRAAAAAAAafXYJLH9iAQAAAARufzUAAGR/PQAAAAAnWgEAAB5bEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["43"]: { ["w"]: 18, ["h"]: 18, ["adv"]: 18, ["left"]: 0, ["top"]: 18, ["cov"]: "AAAAAAAAAAsiHAAAAAAAAAAAAAAAAAAAACp/agAAAAAAAAAAAAAAAAAAACp/agAAAAAAAAAAAAAAAAAAACp/agAAAAAAAAAAAAAAAAAAACp/agAAAAAAAAAAAAAAAAAAACp/agAAAAAAAAAAAAAAAAAAACp/agAAAAAAAAAAAER/f39/f39/f39/f39/fwYAAER/f39/f39/f39/f39/fwYAAAkSEhISEjZ/bRISEhISEgAAAAAAAAAAACp/agAAAAAAAAAAAAAAAAAAACp/agAAAAAAAAAAAAAAAAAAACp/agAAAAAAAAAAAAAAAAAAACp/agAAAAAAAAAAAAAAAAAAACp/agAAAAAAAAAAAAAAAAAAABE0KwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["44"]: { ["w"]: 8, ["h"]: 7, ["adv"]: 8, ["left"]: 0, ["top"]: 3, ["cov"]: "AAAcf39SAAAAABx/f1IAAAAAHH9/UAAAAAAAAHtKAAAAAAASfzkAAAAAAD9/GAAAAAAJdmEAAAA=" }, ["45"]: { ["w"]: 10, ["h"]: 9, ["adv"]: 10, ["left"]: 0, ["top"]: 9, ["cov"]: "AFZ/f39/f39UAABWf39/f39/VAAAHSwsLCwsLBwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["46"]: { ["w"]: 8, ["h"]: 3, ["adv"]: 8, ["left"]: 0, ["top"]: 3, ["cov"]: "AAAif39MAAAAACJ/f0wAAAAAIn9/TAAA" }, ["47"]: { ["w"]: 9, ["h"]: 22, ["adv"]: 8, ["left"]: 0, ["top"]: 22, ["cov"]: "AAAAAAAPf38YAAAAAAAzf3UAAAAAAABWf1MAAAAAAAF3fzAAAAAAABx/fw4AAAAAAD9/awAAAAAAAGJ/SAAAAAAAB31/JgAAAAAAKH99BgAAAAAAS39gAAAAAAAAbn8+AAAAAAAQf38bAAAAAAA0f3cBAAAAAABXf1YAAAAAAAF3fzMAAAAAAB1/fxAAAAAAAEB/bgAAAAAAAGN/SwAAAAAAB35/KQAAAAAAKX9+CAAAAAAATH9jAAAAAAAAbn9BAAAAAAAA" }, ["48"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAU6Y3V8cVgpAAAAAAAAAAAWb39/f39/f39YAwAAAAAACXF/fkkgFSZdf39QAAAAAABGf38sAAAAAABTf38bAAAAA3l/XgAAAAAAAAp8f1IAAAAif38wAAAAAAAAAFp/dwIAAD5/fxMAAAAAAAAAPX9/FQAAUn9+AgAAAAAAAAAsf38oAABff3UAAAAAAAAAAB9/fzYAAGR/cAAAAAAAAAAAGn9/PAAAaH9tAAAAAAAAAAAXf39AAABkf3AAAAAAAAAAABp/fzsAAF5/dQAAAAAAAAAAIH9/NQAAUH9/AwAAAAAAAAAuf38mAAA8f38WAAAAAAAAAEJ/fxEAAB5/fzQAAAAAAAAAYn9yAAAAAXV/ZAAAAAAAABN/f0oAAAAAPX9/MwAAAAADX399EQAAAAAFa39/TCEXK2V/f0AAAAAAAAAQan9/f39/f39KAAAAAAAAAAADN2J2fHBTIAAAAAAA" }, ["49"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAAAEWR/fxoAAAAAAAAAAAAAAC55f39/GgAAAAAAAAAAAAdSf39sf38aAAAAAAAAAAAHb392Jjp/fxoAAAAAAAAAAA5/Yw8AOn9/GgAAAAAAAAAADUYCAAA6f38aAAAAAAAAAAAAAAAAADp/fxoAAAAAAAAAAAAAAAAAOn9/GgAAAAAAAAAAAAAAAAA6f38aAAAAAAAAAAAAAAAAADp/fxoAAAAAAAAAAAAAAAAAOn9/GgAAAAAAAAAAAAAAAAA6f38aAAAAAAAAAAAAAAAAADp/fxoAAAAAAAAAAAAAAAAAOn9/GgAAAAAAAAAAAAAAAAA6f38aAAAAAAAAAAAAAAAAADp/fxoAAAAAAAAAAAAAAAAAOn9/GgAAAAAAAAAAAAAAAAA6f38aAAAAAAAAAAAVHh4eHkp/fzEeHh4eBgAAAFx/f39/f39/f39/f38cAAAAXH9/f39/f39/f39/fxwA" }, ["50"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAxAZXh9dmE8CQAAAAAAAAAoeH9/f39/f39zGwAAAAAAH31/fk0nGytef392CQAAAABpf38mAAAAAABPf38/AAAAF39/VAAAAAAAAAp/f18AAAASPkoiAAAAAAAAAHR/agAAAAAAAAAAAAAAAAAAeX9hAAAAAAAAAAAAAAAAABx/f0EAAAAAAAAAAAAAAAAAYH96DgAAAAAAAAAAAAAAAEZ/fzcAAAAAAAAAAAAAAAFLf39NAAAAAAAAAAAAAAAGWn9/TAEAAAAAAAAAAAAAD2h/fz4AAAAAAAAAAAAAABp0f3srAAAAAAAAAAAAAAAZeH90GgAAAAAAAAAAAAAAFXZ/bQ8AAAAAAAAAAAAAAAdwf28NAAAAAAAAAAAAAAAAT398GAAAAAAAAAAAAAAAABV+f1oeHh4eHh4eHh4eBQAAPX9/f39/f39/f39/f38WAAA+f39/f39/f39/f39/fxYA" }, ["51"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAABRIaXl9dWA6CAAAAAAAAAA6fX9/f39/f39zHAAAAAAAM39/eD8jGy1gf393CwAAAAV3f3YRAAAAAABRf38/AAAAKH9/OQAAAAAAAA9/f1wAAAAYPEYQAAAAAAAAAHp/YgAAAAAAAAAAAAAAAAAJf39TAAAAAAAAAAAAAAAAAEh/fyUAAAAAAAAAAAABDiRdf39EAAAAAAAAAAAAdH9/f3xaJAAAAAAAAAAAAAB0f39/dVgtAQAAAAAAAAAAACAkKj1mf39iCAAAAAAAAAAAAAAAAAA1f39WAAAAAAAAAAAAAAAAAABXf38QAAAAAAAAAAAAAAAAADV/fygAAEFbZAMAAAAAAAAANn9/KAAAUH9/JAAAAAAAAABUf38XAAAif39vCgAAAAAAIn5/cAAAAABXf392PyUcLFF+f38qAAAAAARVf39/f39/f398NQAAAAAAAAAfT2t5fXdkQxAAAAAA" }, ["52"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAAAAAAAG35/dAAAAAAAAAAAAAAAAARrf390AAAAAAAAAAAAAAAARn9/f3QAAAAAAAAAAAAAAB1+fl5/dAAAAAAAAAAAAAAFbX9JSn90AAAAAAAAAAAAAEl/bwZKf3QAAAAAAAAAAAAgf38gAEp/dAAAAAAAAAAABm9/SgAASn90AAAAAAAAAABMf24FAABKf3QAAAAAAAAAIn9/HwAAAEp/dAAAAAAAAAdxf0gAAAAASn90AAAAAAAAT39tBQAAAABKf3QAAAAAACV/fh4AAAAAAEp/dAAAAAAIcn9AAAAAAAAASn90AAAAACd/f39/f39/f39/f39/f2gAKH9/f39/f39/f39/f39/aAADCgoKCgoKCgoKTn90CgoIAAAAAAAAAAAAAABKf3QAAAAAAAAAAAAAAAAAAEp/dAAAAAAAAAAAAAAAAAAASn90AAAAAAAAAAAAAAAAAABKf3QAAAAA" }, ["53"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AABGf39/f39/f39/f38cAAAAAE5/f39/f39/f39/fxwAAAAAV39yHh4eHh4eHh4eBgAAAABff2cAAAAAAAAAAAAAAAAAAGd/XwAAAAAAAAAAAAAAAAAAb39XAAAAAAAAAAAAAAAAAAB4f04AAAAAAAAAAAAAAAAAAX9/RiJVcX14ZkAJAAAAAAAIf391f39/f39/f3YfAAAAABB/f39rNxwXKlt/f3kUAAAAD1JSPwIAAAAAAEJ/f1wAAAAAAAAAAAAAAAAAAGd/fwwAAAAAAAAAAAAAAAAAO39/KAAAAAAAAAAAAAAAAAArf38yAAAAAAAAAAAAAAAAAC5/fy4AAAAHEwAAAAAAAAAARH9/HgAAUn9/FwAAAAAAAAJvf3oDAAArf39iBQAAAAAASX9/SAAAAAFif39tNR4XK19/f20IAAAAAAlgf39/f39/f39mDwAAAAAAAAAoVXB8fHFXLAEAAAAA" }, ["54"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAARRmt6e2tHDgAAAAAAAAAALHl/f39/f395IQAAAAAAACJ9f3M2GB1Be393CwAAAAADb39zDgAAAAApf39EAAAAADN/fykAAAAAAABDOBsAAAAAXn9vAQAAAAAAAAAAAAAAAAR9f0sAAAAAAAAAAAAAAAAAGH9/MQAAAAAAAAAAAAAAAAArf38gAjVjdntvThYAAAAAADN/fyBlf39/f39/fjUAAAAAOX9/aHg5EgYROHh/fyUAAAA5f398FwAAAAAAGnx/aQAAADJ/f08AAAAAAAAAUX9/EgAAKH9/NwAAAAAAAAAyf38mAAASf386AAAAAAAAACp/fyoAAAF2f1AAAAAAAAAANn9/IQAAAE1/dwcAAAAAAABZf34IAAAAFX5/UwEAAAAAJX9/WQAAAAAARH9/XyUTHER8f3oVAAAAAAAAS39/f39/f393IgAAAAAAAAAAIFNxfHhmQQsAAAAA" }, ["55"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "ADx/f39/f39/f39/f39/FgAAPH9/f39/f39/f39/f38WAAAOHh4eHh4eHh4eHlt/cQYAAAAAAAAAAAAAAAAafn8nAAAAAAAAAAAAAAAAAmh/VwAAAAAAAAAAAAAAAAA6f3oPAAAAAAAAAAAAAAAAC3h/PgAAAAAAAAAAAAAAAABOf3EEAAAAAAAAAAAAAAAAE35/LwAAAAAAAAAAAAAAAABTf20BAAAAAAAAAAAAAAAAEX5/NgAAAAAAAAAAAAAAAABHf3oHAAAAAAAAAAAAAAAABHd/TgAAAAAAAAAAAAAAAAAof38lAAAAAAAAAAAAAAAAAFJ/egQAAAAAAAAAAAAAAAAAdH9cAAAAAAAAAAAAAAAAABN/f0QAAAAAAAAAAAAAAAAAK39/LgAAAAAAAAAAAAAAAAA+f38dAAAAAAAAAAAAAAAAAEp/fxYAAAAAAAAAAAAAAAAAUX9/DwAAAAAAAAAA" }, ["56"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAABVJaXl9dWA6CAAAAAAAAAA7fX9/f39/f39zHQAAAAAAMH9/aSYKARA8en94DgAAAAByf3YLAAAAAAAyf39HAAAAEn9/UAAAAAAAAAR+f2YAAAAWf39DAAAAAAAAAHN/agAAAAV/f1QAAAAAAAADfH9XAAAAAFV/ehEAAAAAAC5/fygAAAAAEHF/by0OBBNAe39VAAAAAAAADlB7f39/f39tOwEAAAAAAAAaV3l/f39/f3NLDAAAAAAAK35/YSIGAhI1c390EwAAAA16f18CAAAAAAANdn9jAAAAPX9/HwAAAAAAAABFf38VAABUf38HAAAAAAAAADF/fyoAAFV/fwkAAAAAAAAANH9/KgAARX9/IwAAAAAAAABMf38aAAAef39fAQAAAAAADnh/cQEAAABYf39fIQYACixvf38sAAAAAAVWf39/f39/f398NQAAAAAAAAAgT2x5fXZkQxAAAAAA" }, ["57"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAA5EZ3h8cFEcAAAAAAAAAAAte39/f39/f39BAAAAAAAAI35/eT8bFjBvf381AAAAAAFsf3wbAAAAAAltf3gJAAAAH39/SQAAAAAAACR/fzgAAAA7f38gAAAAAAAAAHJ/YAAAAEd/fxAAAAAAAAAAWn95AAAASH9/DwAAAAAAAABQf38OAAA8f38gAAAAAAAAAFp/fxgAACF/f0cAAAAAAAAGeX9/HgAAAXF/excAAAAAAVF/f38fAAAAK39/dzcSDydgf19/fxgAAAAAPX9/f39/f39GN39/EAAAAAAAHVVzfHFUHwBHf3wBAAAAAAAAAAAAAAAAAF9/aAAAAAAAAAAAAAAAAAAIfX9EAAAABTVJLAAAAAAAAD1/fxgAAAAAcH9xCgAAAAAae39XAAAAAAAzf39sLhUaP3p/dA8AAAAAAABPf39/f39/f28ZAAAAAAAAAAAnWXN9dmQ7BgAAAAAA" }, ["58"]: { ["w"]: 8, ["h"]: 16, ["adv"]: 8, ["left"]: 0, ["top"]: 16, ["cov"]: "AAAif39MAAAAACJ/f0wAAAAAIn9/TAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJ/f0wAAAAAIn9/TAAAAAAif39MAAA=" }, ["59"]: { ["w"]: 8, ["h"]: 20, ["adv"]: 8, ["left"]: 0, ["top"]: 16, ["cov"]: "AAAcf39SAAAAABx/f1IAAAAAHH9/UgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABx/f1IAAAAAHH9/UgAAAAAcf39QAAAAAAAAe0oAAAAAABJ/OAAAAAAAP38WAAAAAAl2YAAAAA==" }, ["60"]: { ["w"]: 18, ["h"]: 17, ["adv"]: 18, ["left"]: 0, ["top"]: 17, ["cov"]: "AAAAAAAAAAAAAAAAAAMtYgcAAAAAAAAAAAAAAAAQRHV/fwgAAAAAAAAAAAABJlp+f39xPgIAAAAAAAAACzxwf39/XikBAAAAAAAAAB5TfH9/eEkUAAAAAAAAAAY1aX9/f2k0BgAAAAAAAAAAAEJ/f31UHwAAAAAAAAAAAAAAAEJ/cRgAAAAAAAAAAAAAAAAAAEJ/f31UHgAAAAAAAAAAAAAAAAg3a39/f2kzBQAAAAAAAAAAAAAAACBVfX9/eEgTAAAAAAAAAAAAAAAADD5xf39/XigBAAAAAAAAAAAAAAABJ1t/f39xPQIAAAAAAAAAAAAAAAARRXV/fwgAAAAAAAAAAAAAAAAAAAMuYgcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["61"]: { ["w"]: 18, ["h"]: 15, ["adv"]: 18, ["left"]: 0, ["top"]: 15, ["cov"]: "AER/f39/f39/f39/f39/fwYAAER/f39/f39/f39/f39/fwYAAAsWFhYWFhYWFhYWFhYWFgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAER/f39/f39/f39/f39/fwYAAER/f39/f39/f39/f39/fwYAAAsWFhYWFhYWFhYWFhYWFgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["62"]: { ["w"]: 18, ["h"]: 17, ["adv"]: 18, ["left"]: 0, ["top"]: 17, ["cov"]: "ADpKFQAAAAAAAAAAAAAAAAAAAEJ/f2AsAwAAAAAAAAAAAAAAABdWfX9/dEIPAAAAAAAAAAAAAAAADkF0f39+WSQBAAAAAAAAAAAAAAACLGJ/f39vOwoAAAAAAAAAAAAAAAAXTXp/f3xSHQAAAAAAAAAAAAAAAAg4bH9/fwgAAAAAAAAAAAAAAAAAAUV/fwgAAAAAAAAAAAAAAAc3bH9/fwgAAAAAAAAAAAAXTHp/f31UHwAAAAAAAAACLGF/f39wPQsAAAAAAAAADUFzf39+WyYBAAAAAAAAABdWfX9/dUQQAAAAAAAAAAAAAEJ/f2EtAwAAAAAAAAAAAAAAADtKFgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["63"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAA1AY3Z9eGlMGwAAAAAAAAAxen9/f39/f39/TgIAAAAALn9/f1s5LztTfn9/TQAAAAh4f30lAAAAAAAUcX9/FQAANX9/PgAAAAAAAAAtf385AABUf38PAAAAAAAAABB/f0YAAAQMEwAAAAAAAAAAFn9/QAAAAAAAAAAAAAAAAABFf38gAAAAAAAAAAAAAAAAIn1/YQAAAAAAAAAAAAAAADZ8f2wNAAAAAAAAAAAAAAlaf39ZCAAAAAAAAAAAAAAMbH99NwAAAAAAAAAAAAAAAFx/fCEAAAAAAAAAAAAAAAAXf39AAAAAAAAAAAAAAAAAADB/fxUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASn9/IgAAAAAAAAAAAAAAAABKf38iAAAAAAAAAAAAAAAAAEp/fyIAAAAAAAAA" }, ["64"]: { ["w"]: 30, ["h"]: 26, ["adv"]: 30, ["left"]: 0, ["top"]: 22, ["cov"]: "AAAAAAAAAAAAAAASO1dueH55blo7EgAAAAAAAAAAAAAAAAAAAAAAIF9/f399dG5yfX9/f1oUAAAAAAAAAAAAAAAAAAdQf39pOxcDAAAAAhpBc398MQAAAAAAAAAAAAAADmt/cCcAAAAAAAAAAAAABk9/fzIAAAAAAAAAAAALb39aBwAAAAAAAAAAAAAAAAA3f3wWAAAAAAAAAAFif1gCAAAAAAAAAAAAAAAAAAAAUX9dAAAAAAAAADh/bAYAAAABMF93e21DBwBBWC8ACHl/FQAAAAAAB3h/IAAAAAljf399c35/agl4fysAAE5/PAAAAAAAOn9dAAAACWt/dC8DAAQ3fGF/fw0AACx/VgAAAAAAaX8nAAAAT391EwAAAAAAOX9/bgAAABh/ZgAAAAAQf3oEAAAYf38wAAAAAAAADn9/TwAAABJ/awAAAAAqf18AAABGf3IBAAAAAAAACH9/MQAAABh/YwAAAABAf0kAAABrf0wAAAAAAAAAH39/EgAAACJ/WQAAAABKfz0AAAB7fzgAAAAAAAAASH90AAAAAD1/RQAAAABQfzcAAAd/fy8AAAAAAAAEd39YAAAAAF5/IwAAAABMfzsAAAJ/fzoAAAAAAABKf39CAAAAE392BAAAAABBf0kAAABrf14AAAAAADN9bX80AAAAXH87AAAAAAArf2MAAAA+f38+BgASTX89V39DAAVQf2kFAAAAAAALf34LAAAEZn9/f3p/f0QAPX9/aXt/bQwAAAAAAAAAXn9CAAAABkJtfHNYIAAAA0pzfGxBBgAAAAAAAAAAI397FAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFV/bQ0AAAAAAAAAAAAAAAAAAAoAAAAAAAAAAAAAAAdof3IjAAAAAAAAAAAAAAAWUHwWAAAAAAAAAAAAAAAJX39/YTEQAAAAAAsjQGl/f3QlAAAAAAAAAAAAAAAAADNyf39/e3J0fH9/f39qOQUAAAAAAAAAAAAAAAAAAAACJ0xldn17c2lSORUAAAAAAAAAAAAA" }, ["65"]: { ["w"]: 20, ["h"]: 21, ["adv"]: 20, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAAAAABcf39sAAAAAAAAAAAAAAAAAAAAEH5/f38fAAAAAAAAAAAAAAAAAABCf3Rtf1IAAAAAAAAAAAAAAAAAAnN/TUV/ewgAAAAAAAAAAAAAAAApf38jG39/NwAAAAAAAAAAAAAAAFx/dQEAbn9pAAAAAAAAAAAAAAAQf39JAAA/f38cAAAAAAAAAAAAAEN/fxoAABB/f08AAAAAAAAAAAACc39rAAAAAGF/egcAAAAAAAAAACp/fzwAAAAAMX9/NAAAAAAAAAAAXX9+DgAAAAAHe39mAAAAAAAAABF/f14AAAAAAABTf38ZAAAAAAAARH9/LwAAAAAAACN/f0sAAAAAAAJ0f39/f39/f39/f39/eAUAAAAAKn9/f39/f39/f39/f39/MQAAAABef38oGBgYGBgYGBgjf39jAAAAEX9/ZQAAAAAAAAAAAABef38WAABEf38wAAAAAAAAAAAAACp/f0gAAnR/dwQAAAAAAAAAAAAAAnN/dwQrf39IAAAAAAAAAAAAAAAAQn9/LV5/fxQAAAAAAAAAAAAAAAAPfn9g" }, ["66"]: { ["w"]: 20, ["h"]: 21, ["adv"]: 20, ["left"]: 0, ["top"]: 21, ["cov"]: "AABEf39/f39/f3x1ZEcaAAAAAAAAAER/f39/f39/f39/f39OAgAAAAAARH9/OB4eHh4hLlB8f39DAAAAAABEf38iAAAAAAAAAB19f3kDAAAAAER/fyIAAAAAAAAAAFt/fxUAAAAARH9/IgAAAAAAAAAATH9/GgAAAABEf38iAAAAAAAAAABbf34IAAAAAER/fyIAAAAAAAAAFn1/VgAAAAAARH9/IgAAAAADEjd2f2kMAAAAAABEf39/f39/f39/f3JCBwAAAAAAAER/f39/f39/f39/e2E0AgAAAAAARH9/MxgYGBgYHzJZf39lCQAAAABEf38iAAAAAAAAAAAof39ZAAAAAER/fyIAAAAAAAAAAABVf38UAAAARH9/IgAAAAAAAAAAADl/fy4AAABEf38iAAAAAAAAAAAAOn9/MAAAAER/fyIAAAAAAAAAAABZf38fAAAARH9/IgAAAAAAAAAAKn9/cwIAAABEf384Hh4eHh4jM1l/f38pAAAAAER/f39/f39/f39/f392KwAAAAAARH9/f39/f39/e3JbNwkAAAAA" }, ["67"]: { ["w"]: 22, ["h"]: 21, ["adv"]: 22, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAAAASlNaXV9eW1XMgYAAAAAAAAAAAAAJm1/f39/f39/f392MwAAAAAAAAAAPX9/f25HMCcxQ29/f39LAAAAAAAAMH9/fDUBAAAAAAABL3t/fzUAAAAADXt/fiQAAAAAAAAAAAAgfn94CAAAAEZ/f0UAAAAAAAAAAAAAAEtdMwcAAAB0f3wLAAAAAAAAAAAAAAAAAAAAAAAUf39dAAAAAAAAAAAAAAAAAAAAAAAAKn9/QQAAAAAAAAAAAAAAAAAAAAAAADR/fzUAAAAAAAAAAAAAAAAAAAAAAAA6f38wAAAAAAAAAAAAAAAAAAAAAAAANX9/NwAAAAAAAAAAAAAAAAAAAAAAACh/f0cAAAAAAAAAAAAAAAAAAAAAAAASf39lAAAAAAAAAAAAAAAAAAAAAAAAAHF/fxUAAAAAAAAAAAAAAAplKQAAAABCf39XAAAAAAAAAAAAAABPf38nAAAACnd/fzkAAAAAAAAAAAAxf39oAQAAAAAtf39/RwYAAAAAAAI/f396FQAAAAAAADh/f392TzMpLURwf395IQAAAAAAAAAAIm1/f39/f39/f39hEwAAAAAAAAAAAAABJ09peH55aUwgAAAAAAAA" }, ["68"]: { ["w"]: 22, ["h"]: 21, ["adv"]: 22, ["left"]: 0, ["top"]: 21, ["cov"]: "AABEf39/f39/fXVsVDcMAAAAAAAAAAAARH9/f39/f39/f39/fE8KAAAAAAAAAER/fzgeHh4gKTpZfX9/chwAAAAAAABEf38iAAAAAAAAAA9Vf392EgAAAAAARH9/IgAAAAAAAAAAAEV/f2UAAAAAAER/fyIAAAAAAAAAAAABYX9/JwAAAABEf38iAAAAAAAAAAAAACJ/f1YAAAAARH9/IgAAAAAAAAAAAAABd392AQAAAER/fyIAAAAAAAAAAAAAAFx/fwwAAABEf38iAAAAAAAAAAAAAABRf38WAAAARH9/IgAAAAAAAAAAAAAATX9/GwAAAER/fyIAAAAAAAAAAAAAAFl/fxUAAABEf38iAAAAAAAAAAAAAABmf38HAAAARH9/IgAAAAAAAAAAAAAKfn9uAAAAAER/fyIAAAAAAAAAAAAAM39/SgAAAABEf38iAAAAAAAAAAAAB3J/fxcAAAAARH9/IgAAAAAAAAAAAlV/f1UAAAAAAER/fyIAAAAAAAAADWB/f3IMAAAAAABEf384Hh4eHiIyU3t/f3IVAAAAAAAARH9/f39/f39/f39/f1MLAAAAAAAAAER/f39/f39/fXViQhQAAAAAAAAA" }, ["69"]: { ["w"]: 20, ["h"]: 21, ["adv"]: 20, ["left"]: 0, ["top"]: 21, ["cov"]: "AABEf39/f39/f39/f39/f39/EAAAAER/f39/f39/f39/f39/f38QAAAARH9/PCQkJCQkJCQkJCQkJAQAAABEf38iAAAAAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAAAAAABEf39/f39/f39/f39/f38eAAAAAER/f39/f39/f39/f39/fx4AAAAARH9/OSAgICAgICAgICAgBwAAAABEf38iAAAAAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAAAAAABEf388JCQkJCQkJCQkJCQkGQAAAER/f39/f39/f39/f39/f39cAAAARH9/f39/f39/f39/f39/f1wA" }, ["70"]: { ["w"]: 18, ["h"]: 21, ["adv"]: 18, ["left"]: 0, ["top"]: 21, ["cov"]: "AABEf39/f39/f39/f39/f38QAABEf39/f39/f39/f39/f38QAABEf388JCQkJCQkJCQkJCQEAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf39/f39/f39/f39/f2IAAABEf39/f39/f39/f39/f2IAAABEf38/KCgoKCgoKCgoKB4AAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAA" }, ["71"]: { ["w"]: 23, ["h"]: 21, ["adv"]: 23, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAAAASdKZ3N8e3JfQRQAAAAAAAAAAAAAACZsf39/f39/f39/f1IIAAAAAAAAAAA/f39/bUcwJy89Yn9/f2kKAAAAAAAAM39/ezEBAAAAAAAAGGp/f1sAAAAAAA98f30eAAAAAAAAAAAACnB/fycAAAAASX9/PwAAAAAAAAAAAAAAJmpCFAAAAAB2f3oIAAAAAAAAAAAAAAAAAAAAAAAAFn9/WQAAAAAAAAAAAAAAAAAAAAAAAAAsf38/AAAAAAAAAAAAAAAAAAAAAAAAADZ/fzMAAAAAAAAAAAAAAAAAAAAAAAAAPH9/LgAAAAAAAABUf39/f39/f38MAAA3f381AAAAAAAAAFR/f39/f39/fwwAACp/f0QAAAAAAAAAHCwsLCwsVH9/DAAAE39/YQAAAAAAAAAAAAAAAAA+f38MAAAAcH9+EQAAAAAAAAAAAAAAAD5/fwwAAAA/f39RAAAAAAAAAAAAAAAAPn9/DAAAAAh1f38yAAAAAAAAAAAAAAZef38MAAAAACd/f39DBQAAAAAAAAApbH9/aQQAAAAAADF9f391TTEmKDNNcH9/f1kGAAAAAAAAABtmf39/f39/f39/f2koAAAAAAAAAAAAAAAfSGR2fXluYEEcAQAAAAAA" }, ["72"]: { ["w"]: 22, ["h"]: 21, ["adv"]: 22, ["left"]: 0, ["top"]: 21, ["cov"]: "AABEf38iAAAAAAAAAAAAAEp/fxwAAAAARH9/IgAAAAAAAAAAAABKf38cAAAAAER/fyIAAAAAAAAAAAAASn9/HAAAAABEf38iAAAAAAAAAAAAAEp/fxwAAAAARH9/IgAAAAAAAAAAAABKf38cAAAAAER/fyIAAAAAAAAAAAAASn9/HAAAAABEf38iAAAAAAAAAAAAAEp/fxwAAAAARH9/IgAAAAAAAAAAAABKf38cAAAAAER/fyIAAAAAAAAAAAAASn9/HAAAAABEf39/f39/f39/f39/f39/fxwAAAAARH9/f39/f39/f39/f39/f38cAAAAAER/f0IsLCwsLCwsLCwsXH9/HAAAAABEf38iAAAAAAAAAAAAAEp/fxwAAAAARH9/IgAAAAAAAAAAAABKf38cAAAAAER/fyIAAAAAAAAAAAAASn9/HAAAAABEf38iAAAAAAAAAAAAAEp/fxwAAAAARH9/IgAAAAAAAAAAAABKf38cAAAAAER/fyIAAAAAAAAAAAAASn9/HAAAAABEf38iAAAAAAAAAAAAAEp/fxwAAAAARH9/IgAAAAAAAAAAAABKf38cAAAAAER/fyIAAAAAAAAAAAAASn9/HAAA" }, ["73"]: { ["w"]: 8, ["h"]: 21, ["adv"]: 8, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAef39IAAAAAB5/f0gAAAAAHn9/SAAAAAAef39IAAAAAB5/f0gAAAAAHn9/SAAAAAAef39IAAAAAB5/f0gAAAAAHn9/SAAAAAAef39IAAAAAB5/f0gAAAAAHn9/SAAAAAAef39IAAAAAB5/f0gAAAAAHn9/SAAAAAAef39IAAAAAB5/f0gAAAAAHn9/SAAAAAAef39IAAAAAB5/f0gAAAAAHn9/SAAA" }, ["74"]: { ["w"]: 15, ["h"]: 21, ["adv"]: 15, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAAAfn9/f39/ZAAAAAAAAAAAfn9/f39/ZAAAAAAAAAAAIyQkJX9/ZAAAAAAAAAAAAAAAAn9/ZAAAAAAAAAAAAAAAAn9/ZAAAAAAAAAAAAAAAAn9/ZAAAAAAAAAAAAAAAAn9/ZAAAAAAAAAAAAAAAAn9/ZAAAAAAAAAAAAAAAAn9/ZAAAAAAAAAAAAAAAAn9/ZAAAAAAAAAAAAAAAAn9/ZAAAAAAAAAAAAAAAAn9/ZAAAAAAAAAAAAAAAAn9/ZAAAAAAAAAAAAAAAAn9/ZAAAAAAAAAAAAAAAA39/YgAAIlpwKgAAAAAAEH9/WwAAI39/UgAAAAAAKX9/RgAAAnR/fyEAAAACZn9/HwAAADN/f3xFKC9jf39dAAAAAABGf39/f39/f2UKAAAAAAAAIldzfXhiNgMAAAAA" }, ["75"]: { ["w"]: 20, ["h"]: 21, ["adv"]: 20, ["left"]: 0, ["top"]: 21, ["cov"]: "AABEf38iAAAAAAAAAAAlfX9xEAAAAER/fyIAAAAAAAAAH3t/dBMAAAAARH9/IgAAAAAAABt5f3YWAAAAAABEf38iAAAAAAAWdn93GAAAAAAAAER/fyIAAAAAEnN/eRwAAAAAAAAARH9/IgAAAA5wf3sfAAAAAAAAAABEf38iAAALbH98IwAAAAAAAAAAAER/fyIACGh/fSYAAAAAAAAAAAAARH9/IgZjf34qAAAAAAAAAAAAAABEf38mXn9/dg8AAAAAAAAAAAAAAER/f3B/fX9/aAYAAAAAAAAAAAAARH9/f3MdQ39/WQEAAAAAAAAAAABEf39gCwABWn9/RQAAAAAAAAAAAER/fyIAAAAHa39/MQAAAAAAAAAARH9/IgAAAAATd399HwAAAAAAAABEf38iAAAAAAAkfn92EQAAAAAAAER/fyIAAAAAAAA7f39rBwAAAAAARH9/IgAAAAAAAABSf39cAQAAAABEf38iAAAAAAAAAARmf39JAAAAAER/fyIAAAAAAAAAAA50f380AAAARH9/IgAAAAAAAAAAAB18f30i" }, ["76"]: { ["w"]: 17, ["h"]: 21, ["adv"]: 17, ["left"]: 0, ["top"]: 21, ["cov"]: "AABEf38iAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAABEf388JCQkJCQkJCQkGAAAAER/f39/f39/f39/f39YAAAARH9/f39/f39/f39/f1gA" }, ["77"]: { ["w"]: 25, ["h"]: 21, ["adv"]: 25, ["left"]: 0, ["top"]: 21, ["cov"]: "AABEf39/KQAAAAAAAAAAAAAAIH9/f0QAAAAARH9/f1oAAAAAAAAAAAAAAE9/f39EAAAAAER/e399DAAAAAAAAAAAAAV5f3t/RAAAAABEf29tfzoAAAAAAAAAAAAtf21xf0QAAAAARH9yRX9qAAAAAAAAAAAAXH9IdX9EAAAAAER/dRx/fxoAAAAAAAAADX5/IHl/RAAAAABEf3gAcX9KAAAAAAAAADt/cwF8f0QAAAAARH96AEN/dgMAAAAAAABqf0UAfn9EAAAAAER/egATf38qAAAAAAAZf38WAH5/RAAAAABEf3oAAGN/WgAAAAAASX9mAAB+f0QAAAAARH96AAAyf34MAAAAAnV/NwAAfn9EAAAAAER/egAAB3t/OgAAACd/fQoAAH5/RAAAAABEf3oAAABSf2oAAABWf1cAAAB+f0QAAAAARH96AAAAIn9/GgAJfH8oAAAAfn9EAAAAAER/egAAAAFwf0kANH92AgAAAH5/RAAAAABEf3oAAAAAQX9xAGB/SQAAAAB+f0QAAAAARH96AAAAABF/fyB+fxkAAAAAfn9EAAAAAER/egAAAAAAYX9kf2oAAAAAAH5/RAAAAABEf3oAAAAAADB/f386AAAAAAB+f0QAAAAARH96AAAAAAAGen9+DAAAAAAAfn9EAAAAAER/egAAAAAAAFB/WwAAAAAAAH5/RAAA" }, ["78"]: { ["w"]: 22, ["h"]: 21, ["adv"]: 22, ["left"]: 0, ["top"]: 21, ["cov"]: "AABEf393CwAAAAAAAAAAACZ/fxwAAAAARH9/f1IAAAAAAAAAAAAmf38cAAAAAER/f39/IQAAAAAAAAAAJn9/HAAAAABEf29wf2wDAAAAAAAAACZ/fxwAAAAARH9vJ39/PwAAAAAAAAAmf38cAAAAAER/cwBYf3wSAAAAAAAAJn9/HAAAAABEf3cAD3p/XQAAAAAAACZ/fxwAAAAARH95AAA7f38sAAAAAAAmf38cAAAAAER/egAAAml/cwcAAAAAJn9/HAAAAABEf3oAAAAef39LAAAAACZ/fxwAAAAARH96AAAAAE5/fhsAAAAmf38cAAAAAER/egAAAAAJdn9nAQAAJn9/HAAAAABEf3oAAAAAADF/fzgAACZ/fxwAAAAARH96AAAAAAAAYn95DQAmf38cAAAAAER/egAAAAAAABZ9f1YAJH9/HAAAAABEf3oAAAAAAAAARX9/JSB/fxwAAAAARH96AAAAAAAAAAVwf28ff38cAAAAAER/egAAAAAAAAAAJ39/V39/HAAAAABEf3oAAAAAAAAAAABYf39/fxwAAAAARH96AAAAAAAAAAAAD3p/f38cAAAAAER/egAAAAAAAAAAAAA7f39/HAAA" }, ["79"]: { ["w"]: 23, ["h"]: 21, ["adv"]: 23, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAAAAilMaHR9em9ZNgkAAAAAAAAAAAAAACluf39/f39/f39/e0IEAAAAAAAAAABEf39/bUcwJy09YH9/f2QKAAAAAAAAOX9/ejABAAAAAAAAG2t/f2ICAAAAABV9f3sbAAAAAAAAAAAACWl/fzoAAAAAUn9/OQAAAAAAAAAAAAAAFn5/dQQAAAR8f3YEAAAAAAAAAAAAAAAAVX9/KgAAIX9/UQAAAAAAAAAAAAAAAAAqf39MAAA4f381AAAAAAAAAAAAAAAAAA5/f2IAAEF/fykAAAAAAAAAAAAAAAAAAn9/bQAASH9/JAAAAAAAAAAAAAAAAAAAfH9yAABDf38rAAAAAAAAAAAAAAAAAAN/f2wAADZ/fzoAAAAAAAAAAAAAAAAAEH9/XgAAH39/VgAAAAAAAAAAAAAAAAArf39HAAADeX97CQAAAAAAAAAAAAAAAFZ/fyQAAABMf39EAAAAAAAAAAAAAAAVfX9wAQAAABB7f34lAAAAAAAAAAAAB2h/fzAAAAAAADV/f302AgAAAAAAABdof39YAAAAAAAAAEB/f39uRi4kKjpdf39/XAUAAAAAAAAAACZvf39/f39/f39/eDsBAAAAAAAAAAAAAAIoT2l4fnpuVzMHAAAAAAAA" }, ["80"]: { ["w"]: 20, ["h"]: 21, ["adv"]: 20, ["left"]: 0, ["top"]: 21, ["cov"]: "AABEf39/f39/f398c105CAAAAAAAAER/f39/f39/f39/f391JAAAAAAARH9/OB4eHh4eIzZgf398HAAAAABEf38iAAAAAAAAAAA6f39mAAAAAER/fyIAAAAAAAAAAABkf38TAAAARH9/IgAAAAAAAAAAAD9/fysAAABEf38iAAAAAAAAAAAANH9/MwAAAER/fyIAAAAAAAAAAAA8f38rAAAARH9/IgAAAAAAAAAAAFt/fxQAAABEf38iAAAAAAAAAAAif39oAAAAAER/fyIAAAAAAAQWQXx/fiEAAAAARH9/f39/f39/f39/f3wwAAAAAABEf39/f39/f39/f3hTFgAAAAAAAER/fzYcHBwcHBkRAQAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAAAAAABEf38iAAAAAAAAAAAAAAAAAAAAAER/fyIAAAAAAAAAAAAAAAAAAAAARH9/IgAAAAAAAAAAAAAAAAAA" }, ["81"]: { ["w"]: 23, ["h"]: 27, ["adv"]: 23, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAAAAilMaHR9em9ZNgkAAAAAAAAAAAAAACluf39/f39/f39/e0IDAAAAAAAAAABEf39/bUcwJy09YH9/f2QJAAAAAAAAOX9/ejABAAAAAAAAG2t/f2ECAAAAABV9f3sbAAAAAAAAAAAACWp/fzkAAAAAUX9/OQAAAAAAAAAAAAAAFn5/dQQAAAR8f3YEAAAAAAAAAAAAAAAAVn9/KQAAIX9/UQAAAAAAAAAAAAAAAAAqf39MAAA4f382AAAAAAAAAAAAAAAAAA5/f2IAAEF/fykAAAAAAAAAAAAAAAAAAn9/bQAASH9/JAAAAAAAAAAAAAAAAAAAfH9xAABEf38qAAAAAAAAAAAAAAAAAAJ/f2oAADd/fzgAAAAAAAAAAAAAAAAAD39/XwAAIH9/VQAAAAAAAAAAAAAAAAAqf39GAAAEen96BwAAAAAAAAAAAAAAAFR/fyUAAABPf39BAAAAAAAAAAAAAAASfX9xAQAAABJ9f30gAAAAAAAAAAAABWR/fzEAAAAAADt/f3swAAAAAAAAABNkf39aAAAAAAAAAEh/f39qQCgeJDRXfX9/YAUAAAAAAAAAAC90f39/f39/f39/ej8CAAAAAAAAAAAAAAUwVm98f392VTUIAAAAAAAAAAAAAAAAAAAAAA5/f2YAAAAAAAAAAAAAAAAAAAAAAAAAAGJ/fxkAAAAAAAAAAAAAAAAAAAAAAAAALH9/YwIAAAAAAAAAAAAAAAAAAAAAAAABZX9/ZycRGAoAAAAAAAAAAAAAAAAAAAAQcX9/f39/KgAAAAAAAAAAAAAAAAAAAAAKRm59eWkdAAAA" }, ["82"]: { ["w"]: 22, ["h"]: 21, ["adv"]: 22, ["left"]: 0, ["top"]: 21, ["cov"]: "AABEf39/f39/f39/fXRhQA4AAAAAAAAARH9/f39/f39/f39/f397NAAAAAAAAER/fzgeHh4eHh4iMll/f38vAAAAAABEf38iAAAAAAAAAAAAKH5/dgMAAAAARH9/IgAAAAAAAAAAAABTf38jAAAAAER/fyIAAAAAAAAAAAAANH9/NAAAAABEf38iAAAAAAAAAAAAADN/fzQAAAAARH9/IgAAAAAAAAAAAABQf38iAAAAAER/fyIAAAAAAAAAAAAbfX90AwAAAABEf38iAAAAAAAAAxQ+en9/MAAAAAAARH9/f39/f39/f39/f39+OwAAAAAAAER/f39/f39/f39/f3NMFgAAAAAAAABEf382HBwcHBwmfX9mAQAAAAAAAAAARH9/IgAAAAAAAER/fzoAAAAAAAAAAER/fyIAAAAAAAAFcH97EQAAAAAAAABEf38iAAAAAAAAACh/f14AAAAAAAAARH9/IgAAAAAAAAAAWX9/MQAAAAAAAER/fyIAAAAAAAAAABB7f3cMAAAAAABEf38iAAAAAAAAAAAAPX9/VgAAAAAARH9/IgAAAAAAAAAAAANsf38oAAAAAER/fyIAAAAAAAAAAAAAIX9/cgcA" }, ["83"]: { ["w"]: 20, ["h"]: 21, ["adv"]: 20, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAAAXRGBze314alQvAwAAAAAAAAAEUX9/f39/f39/f39wGwAAAAAAAFt/f2s4HRESHjdof393EAAAAAAkf39YAwAAAAAAAAJPf39UAAAAAEh/fxYAAAAAAAAAAAR1f2wEAAAAU39/CgAAAAAAAAAAAA8FAAAAAABHf38tAAAAAAAAAAAAAAAAAAAAAB9/f3owAQAAAAAAAAAAAAAAAAAAAFF/f39xSyoNAAAAAAAAAAAAAAAAAkF7f39/f39vUS0JAAAAAAAAAAAAAAw9ZX5/f39/f3xODwAAAAAAAAAAAAAACCRCYHt/f392HgAAAAAAAAAAAAAAAAAABClmf39xBgAAAAAAAAAAAAAAAAAAAAJcf381AAAAAAAAAAAAAAAAAAAAACB/f0wAABg9VhUAAAAAAAAAAAAAFn9/TAAAM39/UAAAAAAAAAAAAAA1f385AAAGc39/PgEAAAAAAAAAG3d/fA4AAAAifX9/bUEnGxkgNFh+f381AAAAAAAcbH9/f39/f39/f39zLAAAAAAAAAABJkxldXx9d2lSLQUAAAAA" }, ["84"]: { ["w"]: 18, ["h"]: 21, ["adv"]: 18, ["left"]: 0, ["top"]: 21, ["cov"]: "Kn9/f39/f39/f39/f39/f39SKn9/f39/f39/f39/f39/f39SCyQkJCQkJDl/f1YkJCQkJCQXAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAAAAAAAAAAAB5/f0YAAAAAAAAA" }, ["85"]: { ["w"]: 22, ["h"]: 21, ["adv"]: 22, ["left"]: 0, ["top"]: 21, ["cov"]: "AABYf38OAAAAAAAAAAAAADh/fywAAAAAWH9/DgAAAAAAAAAAAAA4f38sAAAAAFh/fw4AAAAAAAAAAAAAOH9/LAAAAABYf38OAAAAAAAAAAAAADh/fywAAAAAWH9/DgAAAAAAAAAAAAA4f38sAAAAAFh/fw4AAAAAAAAAAAAAOH9/LAAAAABYf38OAAAAAAAAAAAAADh/fywAAAAAWH9/DgAAAAAAAAAAAAA4f38sAAAAAFh/fw4AAAAAAAAAAAAAOH9/LAAAAABYf38OAAAAAAAAAAAAADh/fywAAAAAWH9/DgAAAAAAAAAAAAA4f38sAAAAAFh/fw4AAAAAAAAAAAAAOH9/LAAAAABYf38OAAAAAAAAAAAAADh/fysAAAAAVX9/EgAAAAAAAAAAAAA/f38nAAAAAEt/fyAAAAAAAAAAAAAAUH9/GgAAAAAzf39BAAAAAAAAAAAAAnJ/ewQAAAAADH1/dAkAAAAAAAAAADd/f1IAAAAAAABFf39iCwAAAAAAADB9f3gSAAAAAAAAAl5/f3lLLiQpPWd/f34mAAAAAAAAAAAERn5/f39/f39/f20cAAAAAAAAAAAAAAATP2NxfHZqUigDAAAAAAAA" }, ["86"]: { ["w"]: 20, ["h"]: 21, ["adv"]: 20, ["left"]: 0, ["top"]: 21, ["cov"]: "Vn9/IgAAAAAAAAAAAAAAACF/f1Yjf39TAAAAAAAAAAAAAAAAUn9/IgBuf3wIAAAAAAAAAAAAAAd7f24AADx/fzYAAAAAAAAAAAAANH9/PAAAC31/ZwAAAAAAAAAAAABlf30LAAAAVX9/GAAAAAAAAAAAFn9/VQAAAAAif39KAAAAAAAAAABHf38iAAAAAABtf3cEAAAAAAAAA3V/bgAAAAAAADt/fywAAAAAAAAqf387AAAAAAAACnx/XgAAAAAAAFt/fQsAAAAAAAAAVH9/EAAAAAANfn9UAAAAAAAAAAAgf39AAAAAAD1/fyEAAAAAAAAAAABsf3ABAAAAbX9tAAAAAAAAAAAAADp/fyMAAB9/fzoAAAAAAAAAAAAACnx/VAAAUH98CgAAAAAAAAAAAAAAU397BQR5f1QAAAAAAAAAAAAAAAAff38rJ39/IAAAAAAAAAAAAAAAAABrf1VSf2wAAAAAAAAAAAAAAAAAADh/enl/OgAAAAAAAAAAAAAAAAAACXt/f3wKAAAAAAAAAAAAAAAAAAAAUX9/UwAAAAAAAAAA" }, ["87"]: { ["w"]: 29, ["h"]: 21, ["adv"]: 28, ["left"]: 0, ["top"]: 21, ["cov"]: "XX9/FwAAAAAAAAAAJn9/VQAAAAAAAAAAAGx/fgo4f386AAAAAAAAAABJf393AQAAAAAAAAAOf39kABN/f14AAAAAAAAAAGx/f38bAAAAAAAAADJ/fz8AAG5/fAUAAAAAAAAPf39rfz4AAAAAAAAAVH9/GgAASX9/JQAAAAAAADN/cUJ/YgAAAAAAAAF2f3QAAAAkf39IAAAAAAAAVn9UJn99BwAAAAAAGn9/UAAAAAR6f2wAAAAAAAF3fzYJf38oAAAAAAA9f38rAAAAAFl/fw8AAAAAHH9/FQBof0sAAAAAAGB/fQgAAAAANH9/MwAAAAA/f3MAAEZ/bgAAAAAFfH9hAAAAAAAPf39WAAAAAGJ/UQAAJH9/EQAAACV/fzwAAAAAAABqf3gCAAAHfX8vAAAFfH80AAAASH9/FgAAAAAAAEV/fx0AACd/fw0AAABff1cAAABqf3EAAAAAAAAAIH9/QQAASn9rAAAAAD1/eAIADX9/TAAAAAAAAAACeH9jAABsf0gAAAAAG39/HAAvf38nAAAAAAAAAABVf30EDX9/JgAAAAABd387AFF/fAYAAAAAAAAAADB/fyAsf30GAAAAAABWf1sAcH9dAAAAAAAAAAAADH9/Pkp/YQAAAAAAADR/eA9/fzgAAAAAAAAAAAAAZn9cZ38+AAAAAAAAEn9/Qn9/EwAAAAAAAAAAAABBf3l9fxwAAAAAAAAAb393f24AAAAAAAAAAAAAABx/f394AQAAAAAAAABNf39/SQAAAAAAAAAAAAAAAXV/f1cAAAAAAAAAACt/f38kAAAAAAAA" }, ["88"]: { ["w"]: 20, ["h"]: 21, ["adv"]: 20, ["left"]: 0, ["top"]: 21, ["cov"]: "AC5/f1oAAAAAAAAAAAAAU39/NgAAAFJ/fzMAAAAAAAAAACp/f1sAAAAAB29/ehIAAAAAAAALdX91DAAAAAAAHH1/ZAIAAAAAAFd/fycAAAAAAAAAPn9/QAAAAAAuf39MAAAAAAAAAAABYX99GwAADXd/bAUAAAAAAAAAAAAOd39tBQBbf30aAAAAAAAAAAAAAAAqf39MMn9/PAAAAAAAAAAAAAAAAABOf397f2EBAAAAAAAAAAAAAAAAAAVsf394DwAAAAAAAAAAAAAAAAAAAWB/f3kQAAAAAAAAAAAAAAAAAAA+f399f2EBAAAAAAAAAAAAAAAAHH1/Tzh/fzsAAAAAAAAAAAAAAAdvf3AHAWF/fBcAAAAAAAAAAAAAUn9/IAAAEXp/aQMAAAAAAAAAAC9/f0YAAAAANX9/RgAAAAAAAAAReX9qBAAAAAAAXn9/IAAAAAAAAmR/fRkAAAAAAAAPeX9wBwAAAABDf38+AAAAAAAAAAAyf39RAAAAIH5/ZAEAAAAAAAAAAABbf38qAAlyf3oTAAAAAAAAAAAAAA13f3YM" }, ["89"]: { ["w"]: 20, ["h"]: 21, ["adv"]: 20, ["left"]: 0, ["top"]: 21, ["cov"]: "C3d/eA0AAAAAAAAAAAAADHd/dgsAMH9/VgAAAAAAAAAAAABUf38vAAAAXX9/JQAAAAAAAAAAI39/XAAAAAAQen9wBQAAAAAAAARuf3kPAAAAAAA4f39GAAAAAAAAQ39/NgAAAAAAAAFkf30XAAAAABV9f2IBAAAAAAAAABZ9f2QBAAAAYn98FAAAAAAAAAAAAEB/fzYAADN/fz0AAAAAAAAAAAAAA2p/eA0Ld39oAgAAAAAAAAAAAAAAHH5/VlJ/fhkAAAAAAAAAAAAAAAAASH9/f39FAAAAAAAAAAAAAAAAAAAFcH9/bQQAAAAAAAAAAAAAAAAAAAA3f38zAAAAAAAAAAAAAAAAAAAAADR/fzAAAAAAAAAAAAAAAAAAAAAANH9/MAAAAAAAAAAAAAAAAAAAAAA0f38wAAAAAAAAAAAAAAAAAAAAADR/fzAAAAAAAAAAAAAAAAAAAAAANH9/MAAAAAAAAAAAAAAAAAAAAAA0f38wAAAAAAAAAAAAAAAAAAAAADR/fzAAAAAAAAAAAAAAAAAAAAAANH9/MAAAAAAAAAAA" }, ["90"]: { ["w"]: 18, ["h"]: 21, ["adv"]: 18, ["left"]: 0, ["top"]: 21, ["cov"]: "AAB+f39/f39/f39/f39/f1oAAAB+f39/f39/f39/f39/f1oAAAAjJCQkJCQkJCQkJGl/fywAAAAAAAAAAAAAAAAANH9/TAAAAAAAAAAAAAAAAAAYfH9nBAAAAAAAAAAAAAAAAAdtf3gSAAAAAAAAAAAAAAAAAFV/fysAAAAAAAAAAAAAAAAAN39/SgAAAAAAAAAAAAAAAAAafH9mAwAAAAAAAAAAAAAAAAhvf3gRAAAAAAAAAAAAAAAAAFh/fykAAAAAAAAAAAAAAAAAOn9/SAAAAAAAAAAAAAAAAAAcfX9kAwAAAAAAAAAAAAAAAAlxf3cQAAAAAAAAAAAAAAAAAFt/fycAAAAAAAAAAAAAAAAAPH9/RgAAAAAAAAAAAAAAAAAffn9jAgAAAAAAAAAAAAAAAAtyf3YOAAAAAAAAAAAAAAAAAF1/f0gkJCQkJCQkJCQkJCQOBn9/f39/f39/f39/f39/f38yBn9/f39/f39/f39/f39/f38y" }, ["91"]: { ["w"]: 9, ["h"]: 28, ["adv"]: 8, ["left"]: 0, ["top"]: 22, ["cov"]: "AABuf39/f38MAABuf3tycnIKAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf1gAAAAAAABuf3tycnIKAABuf39/f38M" }, ["92"]: { ["w"]: 9, ["h"]: 22, ["adv"]: 8, ["left"]: 0, ["top"]: 22, ["cov"]: "bn85AAAAAAAATH9cAAAAAAAAKX97AwAAAAAACH5/IgAAAAAAAGR/RQAAAAAAAEF/aAAAAAAAAB9/fwsAAAAAAAJ5fy4AAAAAAABZf1EAAAAAAAA3f3MAAAAAAAAUf38XAAAAAAAAcX86AAAAAAAAT39dAAAAAAAALH97BAAAAAAACn9/IwAAAAAAAGd/RgAAAAAAAER/aQAAAAAAACJ/fwwAAAAAAAR7fy8AAAAAAABcf1IAAAAAAAA6f3QAAAAAAAAXf38Y" }, ["93"]: { ["w"]: 8, ["h"]: 28, ["adv"]: 8, ["left"]: 0, ["top"]: 22, ["cov"]: "Yn9/f39/GgBXcnJ3f38aAAAAAC5/fxoAAAAALn9/GgAAAAAuf38aAAAAAC5/fxoAAAAALn9/GgAAAAAuf38aAAAAAC5/fxoAAAAALn9/GgAAAAAuf38aAAAAAC5/fxoAAAAALn9/GgAAAAAuf38aAAAAAC5/fxoAAAAALn9/GgAAAAAuf38aAAAAAC5/fxoAAAAALn9/GgAAAAAuf38aAAAAAC5/fxoAAAAALn9/GgAAAAAuf38aAAAAAC5/fxoAAAAALn9/GgAAAAAuf38aAFdycnd/fxoAYn9/f39/GgA=" }, ["94"]: { ["w"]: 14, ["h"]: 21, ["adv"]: 14, ["left"]: 0, ["top"]: 21, ["cov"]: "AAAAAABbf39hAAAAAAAAAAAAGn95eX8gAAAAAAAAAABZf0VFf18AAAAAAAAAGH98DAx7fx4AAAAAAABWf0wAAEt/XQAAAAAAFX9+EQAAEH1/HAAAAABUf1MAAAAAUH9cAAAAE35/FgAAAAAUfn8bAABRf1kAAAAAAABVf1oAEX5/HAAAAAAAABh/fxlOf2AAAAAAAAAAAFp/WAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["95"]: { ["w"]: 19, ["h"]: 6, ["adv"]: 17, ["left"]: -1, ["top"]: 0, ["cov"]: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADp/f39/f39/f39/f39/f39/fwI0dHR0dHR0dHR0dHR0dHR0dHQB" }, ["96"]: { ["w"]: 10, ["h"]: 23, ["adv"]: 10, ["left"]: 0, ["top"]: 23, ["cov"]: "ACd/f28GAAAAAAAAL35/TAAAAAAAAAAofH8kAAAAAAAAACF5cggAAAAAAAAAG3ZOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }, ["97"]: { ["w"]: 17, ["h"]: 16, ["adv"]: 17, ["left"]: 0, ["top"]: 16, ["cov"]: "AAAAASlVbnp9dmA4BAAAAAAAAARdf39/f39/f39rCwAAAAAAR39/VxsIBBRKf39ZAAAAAABgc3ABAAAAAABaf38NAAAAAAAAAAAAAAAAADd/fyQAAAAAAAAAAAAAAAAAKn9/KwAAAAAABC5RaHJ4en1/f38sAAAAABlvf39/fnZyb3N/fywAAAAIdH9+RRYBAAAAKn9/LAAAADh/fz0AAAAAAAAwf38sAAAAU39/CwAAAAAAAEh/fywAAABZf38DAAAAAAAJd39/LAAAAEt/fx0AAAAABFt6f38xAAAAJX9/ahwDCitpfSl/f1EAAAAAVn9/f39/f3wsAGt/f2tJAAACOWh7emxJFAAAGWR7c0Y=" }, ["98"]: { ["w"]: 17, ["h"]: 22, ["adv"]: 17, ["left"]: 0, ["top"]: 22, ["cov"]: "AAB+f1QAAAAAAAAAAAAAAAAAAH5/VAAAAAAAAAAAAAAAAAAAfn9UAAAAAAAAAAAAAAAAAAB+f1QAAAAAAAAAAAAAAAAAAH5/VAAAAAAAAAAAAAAAAAAAfn9UAAAAAAAAAAAAAAAAAAB+f1MAIFZyfHVcJwAAAAAAAH5/UTd/f39/f39/RwAAAAAAfn9kfVsfCQsudX9/JQAAAAB+f39aAQAAAAAdf39gAAAAAH5/fxgAAAAAAABjf34IAAAAfn9zAAAAAAAAAEV/fx4AAAB+f2AAAAAAAAAANX9/LQAAAH5/VwAAAAAAAAAvf38zAAAAfn9VAAAAAAAAAC5/fzIAAAB+f1wAAAAAAAAANX9/KwAAAH5/bgAAAAAAAABEf38bAAAAfn9/EQAAAAAAAGJ/fQUAAAB+f39QAAAAAAAaf39aAAAAAH5/aX5OEwACJXF/fx4AAAAAf39KOn9/fX9/f389AAAAAAR/f0IAIlhzfXVaIgAAAAA=" }, ["99"]: { ["w"]: 15, ["h"]: 16, ["adv"]: 15, ["left"]: 0, ["top"]: 16, ["cov"]: "AAAAABFJa3l8bUoSAAAAAAAAMX1/f39/f397LQAAAAAjf39pKA0RMHN/fhsAAABsf3EIAAAAABl9f10AAB5/fzwAAAAAAABddWoDAD1/fx0AAAAAAAAAAAAAAFB/fwwAAAAAAAAAAAAAAFh/fwYAAAAAAAAAAAAAAFh/fwcAAAAAAAAAAAAAAFB/fw8AAAAAAAAAAAAAADx/fyMAAAAAAAAAAAAAAB5/f0kAAAAAAABNd28LAABsf3oSAAAAAA93f2oAAAAjf39zMBASLm9/fygAAAAAMn1/f39/f399NwAAAAAAABJKbHp8bk4XAAAA" }, ["100"]: { ["w"]: 17, ["h"]: 22, ["adv"]: 17, ["left"]: 0, ["top"]: 22, ["cov"]: "AAAAAAAAAAAAAAAAfH9UAAAAAAAAAAAAAAAAAAB8f1QAAAAAAAAAAAAAAAAAAHx/VAAAAAAAAAAAAAAAAAAAfH9UAAAAAAAAAAAAAAAAAAB8f1QAAAAAAAAAAAAAAAAAAHx/VAAAAAAAAjdleHptSA8AfH9UAAAAAARgf39/fX9/dhp6f1QAAAAARn9/WxUAAiFnbXt/VAAAAAd8f2wDAAAAAAdxf39UAAAAK39/OQAAAAAAADl/f1QAAABEf38cAAAAAAAAFn9/VAAAAFR/fwwAAAAAAAAFf39UAAAAWn9/BgAAAAAAAAB+f1QAAABbf38GAAAAAAAAAH9/VAAAAFV/fwwAAAAAAAAJf39UAAAAR39/HAAAAAAAAB1/f1QAAAAwf385AAAAAAAAQ39/VAAAAAt+f20EAAAAAA53f39UAAAAAFB/f2AeBwwtcGl1f1QAAAAACGh/f39/f391GG9/VgAAAAAABDxneXptSA4AaH9bAAA=" }, ["101"]: { ["w"]: 17, ["h"]: 16, ["adv"]: 17, ["left"]: 0, ["top"]: 16, ["cov"]: "AAAAAAtBZXZ9c1wxAgAAAAAAAAAneX9/f31/f39nCwAAAAAAHX5/dS8GAA1Afn9mAQAAAABpf3wYAAAAAAA4f38zAAAAHX9/SwAAAAAAAAJyf2QAAAA9f38jAAAAAAAAAE5/fgUAAFB/fxAAAAAAAAAAOH9/GwAAWH9/f39/f39/f39/f38lAABXf39/f39/f39/f39/fywAAE9/fwsCAgICAgICAgICAAAAOn9/GAAAAAAAAAAAAAAAAAAbf389AAAAAAAAAAAAAAAAAABof3YOAAAAAAABWmI3AAAAAB1+f3EuCQEJJmF/fywAAAAAACh6f39/f39/f306AAAAAAAAAAtBZXZ9dGdEFQAAAAA=" }, ["102"]: { ["w"]: 9, ["h"]: 22, ["adv"]: 8, ["left"]: 0, ["top"]: 22, ["cov"]: "AAAABkZsfHgpAAAAXn9/f38wAAASf39qGQwHAAAnf38zAAAAAAArf38lAAAAAAAsf38kAAAASn9/f39/f38wRHZ5f394dnYsAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAAAAAsf38kAAAA" }, ["103"]: { ["w"]: 17, ["h"]: 22, ["adv"]: 17, ["left"]: 0, ["top"]: 16, ["cov"]: "AAAAAjZjd3pqQAgAaH9bAAAAAAVgf39/fn9/bRBwf1YAAAAASH9/XxkBCTV5YXV/VAAAAAh8f20EAAAAACB+f39UAAAALH9/NwAAAAAAAFJ/f1QAAABEf38YAAAAAAAAJn9/VAAAAFR/fwcAAAAAAAAKf39UAAAAWn9/AAAAAAAAAAB+f1QAAABbf38AAAAAAAAAAH1/VAAAAFZ/fwUAAAAAAAAIf39UAAAASX9/FAAAAAAAACN/f1QAAAA0f38wAAAAAAAAT39/VAAAABB/f2QBAAAAAB1+f39UAAAAAFl/f1QTAAczeFV6f1QAAAAADnB/f399f39jCXp/VAAAAAAACURse3dlNwMAe39SAAAAAAAAAAAAAAAAAAN/f0kAAAAAARATAAAAAAAAHn9/NQAAAAFzf3IGAAAAAABYf34RAAAAAD9/f2UjCAMZVX9/TwAAAAAAAlR/f39/f39/f1wFAAAAAAAAACZWcXx8cVcpAQAAAAA=" }, ["104"]: { ["w"]: 17, ["h"]: 22, ["adv"]: 17, ["left"]: 0, ["top"]: 22, ["cov"]: "AAB2f1wAAAAAAAAAAAAAAAAAAHZ/XAAAAAAAAAAAAAAAAAAAdn9cAAAAAAAAAAAAAAAAAAB2f1wAAAAAAAAAAAAAAAAAAHZ/XAAAAAAAAAAAAAAAAAAAdn9bAAAAAAAAAAAAAAAAAAB2f1kAE01vfHljNAEAAAAAAHZ/VSJ5f39/f39/UQAAAAAAdn9cdl4fCAsqc39/HQAAAAB2f39ZAQAAAAAof39DAAAAAHZ/fxEAAAAAAAV/f1YAAAAAdn9rAAAAAAAAAHp/XAAAAAB2f14AAAAAAAAAdn9eAAAAAHZ/XAAAAAAAAAB2f14AAAAAdn9cAAAAAAAAAHZ/XgAAAAB2f1wAAAAAAAAAdn9eAAAAAHZ/XAAAAAAAAAB2f14AAAAAdn9cAAAAAAAAAHZ/XgAAAAB2f1wAAAAAAAAAdn9eAAAAAHZ/XAAAAAAAAAB2f14AAAAAdn9cAAAAAAAAAHZ/XgAAAAB2f1wAAAAAAAAAdn9eAAA=" }, ["105"]: { ["w"]: 7, ["h"]: 22, ["adv"]: 7, ["left"]: 0, ["top"]: 22, ["cov"]: "AAB/f1IAAAAAf39SAAAAAEJCKgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/f1IAAAAAf39SAAAAAH9/UgAAAAB/f1IAAAAAf39SAAAAAH9/UgAAAAB/f1IAAAAAf39SAAAAAH9/UgAAAAB/f1IAAAAAf39SAAAAAH9/UgAAAAB/f1IAAAAAf39SAAAAAH9/UgAAAAB/f1IAAA==" }, ["106"]: { ["w"]: 8, ["h"]: 28, ["adv"]: 7, ["left"]: -1, ["top"]: 22, ["cov"]: "AAAAf39SAAAAAAB/f1IAAAAAAEJCKgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf39SAAAAAAB/f1IAAAAAAH9/UgAAAAAAf39SAAAAAAB/f1IAAAAAAH9/UgAAAAAAf39SAAAAAAB/f1IAAAAAAH9/UgAAAAAAf39SAAAAAAB/f1IAAAAAAH9/UgAAAAAAf39SAAAAAAB/f1IAAAAAAH9/UgAAAAAAf39SAAAAAAB/f1IAAAAAAn9/UQAAAAAOf39MAAALEE1/fzgAAF5/f396DgAAVn14XxkAAAA=" }, ["107"]: { ["w"]: 16, ["h"]: 22, ["adv"]: 15, ["left"]: 0, ["top"]: 22, ["cov"]: "AAB+f1QAAAAAAAAAAAAAAAAAfn9UAAAAAAAAAAAAAAAAAH5/VAAAAAAAAAAAAAAAAAB+f1QAAAAAAAAAAAAAAAAAfn9UAAAAAAAAAAAAAAAAAH5/VAAAAAAAAAAAAAAAAAB+f1QAAAAAAAVlf3whAAAAfn9UAAAAAAJbf34oAAAAAH5/VAAAAABQf38vAAAAAAB+f1QAAABDf383AAAAAAAAfn9UAAA2f38/AAAAAAAAAH5/VAApfn9IAAAAAAAAAAB+f1QffH9SAAAAAAAAAAAAfn9md39/XQEAAAAAAAAAAH5/f39zf38+AAAAAAAAAAB+f39NBWV/fh4AAAAAAAAAfn9bAAAReH9yCQAAAAAAAH5/VAAAACx/f1oAAAAAAAB+f1QAAAAATn9/OQAAAAAAfn9UAAAAAAVrf30bAAAAAH5/VAAAAAAAF3t/bwcAAAB+f1QAAAAAAAA1f39WAA==" }, ["108"]: { ["w"]: 7, ["h"]: 22, ["adv"]: 7, ["left"]: 0, ["top"]: 22, ["cov"]: "AAB+f1QAAAAAfn9UAAAAAH5/VAAAAAB+f1QAAAAAfn9UAAAAAH5/VAAAAAB+f1QAAAAAfn9UAAAAAH5/VAAAAAB+f1QAAAAAfn9UAAAAAH5/VAAAAAB+f1QAAAAAfn9UAAAAAH5/VAAAAAB+f1QAAAAAfn9UAAAAAH5/VAAAAAB+f1QAAAAAfn9UAAAAAH5/VAAAAAB+f1QAAA==" }, ["109"]: { ["w"]: 25, ["h"]: 16, ["adv"]: 25, ["left"]: 0, ["top"]: 16, ["cov"]: "AAB8f0EAIVp0e25GCQAAGlRyfXNSEgAAAAAAeH9GMH9/f39/f2cEKnx/f39/f3YNAAAAAHZ/WntLEwYZYX9/P3lVFwYUVX9/SAAAAAB2f39LAAAAAA9/f39aAAAAAAR2f2oAAAAAdn9+CwAAAAAAbn9/GwAAAAAAWn96AAAAAHZ/aQAAAAAAAGN/ewEAAAAAAE9/fwEAAAB2f1wAAAAAAABgf3AAAAAAAABMf38CAAAAdn9aAAAAAAAAYH9uAAAAAAAATH9/AgAAAHZ/WgAAAAAAAGB/bgAAAAAAAEx/fwIAAAB2f1oAAAAAAABgf24AAAAAAABMf38CAAAAdn9aAAAAAAAAYH9uAAAAAAAATH9/AgAAAHZ/WgAAAAAAAGB/bgAAAAAAAEx/fwIAAAB2f1oAAAAAAABgf24AAAAAAABMf38CAAAAdn9aAAAAAAAAYH9uAAAAAAAATH9/AgAAAHZ/WgAAAAAAAGB/bgAAAAAAAEx/fwIAAAB2f1oAAAAAAABgf24AAAAAAABMf38CAA==" }, ["110"]: { ["w"]: 17, ["h"]: 16, ["adv"]: 17, ["left"]: 0, ["top"]: 16, ["cov"]: "AAB8f0AAFU5vfHhkNgEAAAAAAHh/RSN6f39/f39/UwAAAAAAdn9Xdl0eCAsoc39/HgAAAAB2f39aAQAAAAAqf39DAAAAAHZ/fxIAAAAAAAZ/f1YAAAAAdn9tAAAAAAAAAHp/XAAAAAB2f18AAAAAAAAAdn9eAAAAAHZ/XAAAAAAAAAB2f14AAAAAdn9cAAAAAAAAAHZ/XgAAAAB2f1wAAAAAAAAAdn9eAAAAAHZ/XAAAAAAAAAB2f14AAAAAdn9cAAAAAAAAAHZ/XgAAAAB2f1wAAAAAAAAAdn9eAAAAAHZ/XAAAAAAAAAB2f14AAAAAdn9cAAAAAAAAAHZ/XgAAAAB2f1wAAAAAAAAAdn9eAAA=" }, ["111"]: { ["w"]: 17, ["h"]: 16, ["adv"]: 17, ["left"]: 0, ["top"]: 16, ["cov"]: "AAAAABBGaHd9dWE9CAAAAAAAAAA0fX9/f3x/f393HwAAAAAAJ39/bikFAAk1eX95DwAAAAFwf3gOAAAAAAAmf39PAAAAIn9/RQAAAAAAAABpf3oDAABAf38hAAAAAAAAAEd/fxkAAFJ/fw4AAAAAAAAANX9/KgAAWn9/BgAAAAAAAAAuf38yAABaf38GAAAAAAAAAC9/fzEAAFJ/fw4AAAAAAAAANn9/KQAAPn9/IgAAAAAAAABJf38WAAAff39HAAAAAAAAAGx/dwEAAABsf3kPAAAAAAAtf39GAAAAACJ/f24mAwAMOnt/cQgAAAAAAC98f39/fX9/f24UAAAAAAAAAA9GaHh9dF01AwAAAAA=" }, ["112"]: { ["w"]: 17, ["h"]: 22, ["adv"]: 17, ["left"]: 0, ["top"]: 16, ["cov"]: "AAR/f0IAIFdyfHVbJgAAAAAAAH9/STV+f39/f39/RgAAAAAAfn9kfFofCgsudH9/JgAAAAB+f39cAQAAAAAcf39hAAAAAH5/fxoAAAAAAABif38JAAAAfn92AAAAAAAAAER/fx8AAAB+f2AAAAAAAAAANH9/LAAAAH5/WAAAAAAAAAAuf38zAAAAfn9VAAAAAAAAAC9/fzIAAAB+f1wAAAAAAAAANX9/KwAAAH5/bgAAAAAAAABEf38bAAAAfn9/EAAAAAAAAGJ/fQUAAAB+f39OAAAAAAAZf39aAAAAAH5/aX5MEgACJnF/fx4AAAAAfn9SO39/fX9/f389AAAAAAB+f1MAIVdyfHVaIgAAAAAAAH5/VAAAAAAAAAAAAAAAAAAAfn9UAAAAAAAAAAAAAAAAAAB+f1QAAAAAAAAAAAAAAAAAAH5/VAAAAAAAAAAAAAAAAAAAfn9UAAAAAAAAAAAAAAAAAAB+f1QAAAAAAAAAAAAAAAA=" }, ["113"]: { ["w"]: 17, ["h"]: 22, ["adv"]: 17, ["left"]: 0, ["top"]: 16, ["cov"]: "AAAAAjdleHptSQ4Aa39cAAAAAARgf39/fX9/dRhzf1cAAAAARn9/XRYAAyJobHp/VAAAAAd8f20EAAAAAAhyf39UAAAAK39/OgAAAAAAADp/f1QAAABEf38cAAAAAAAAF39/VAAAAFR/fwwAAAAAAAAFf39UAAAAWn9/BgAAAAAAAAB+f1QAAABbf38GAAAAAAAAAH9/VAAAAFV/fwwAAAAAAAAJf39UAAAAR39/HAAAAAAAAB5/f1QAAAAvf385AAAAAAAARX9/VAAAAAt+f20EAAAAABB4f39UAAAAAE9/f2AeBwwucWh5f1QAAAAACGh/f39/f391Fnl/VAAAAAAABDxneXpuSg8Ae39UAAAAAAAAAAAAAAAAAAB8f1QAAAAAAAAAAAAAAAAAAHx/VAAAAAAAAAAAAAAAAAAAfH9UAAAAAAAAAAAAAAAAAAB8f1QAAAAAAAAAAAAAAAAAAHx/VAAAAAAAAAAAAAAAAAAAfH9UAAA=" }, ["114"]: { ["w"]: 10, ["h"]: 16, ["adv"]: 10, ["left"]: 0, ["top"]: 16, ["cov"]: "AAB+f0ABPW57OQAAen9EPH9/f0AAAHh/TXduQDghAAB2f3VnBQAAAAAAdn9/IQAAAAAAAHZ/eAEAAAAAAAB2f2UAAAAAAAAAdn9dAAAAAAAAAHZ/XAAAAAAAAAB2f1wAAAAAAAAAdn9cAAAAAAAAAHZ/XAAAAAAAAAB2f1wAAAAAAAAAdn9cAAAAAAAAAHZ/XAAAAAAAAAB2f1wAAAAAAA==" }, ["115"]: { ["w"]: 15, ["h"]: 16, ["adv"]: 15, ["left"]: 0, ["top"]: 16, ["cov"]: "AAAAFkppeX55aUoVAAAAAAAzfn9/f39/f399MgAAABF9f2klCwIMLG1/fhMAADh/fxYAAAAAAAt6fzwAAD9/fw4AAAAAAAAMAwAAACl/f1sOAAAAAAAAAAAAAAJhf39+YD4eAgAAAAAAAAAFSnx/f39/eFMdAAAAAAAAAAkwU3R/f39/SgAAAAAAAAAAAAAWQHd/fzAAAAAAAAAAAAAAAA93f2YAABIrEAAAAAAAAABZf3IABXt/VAAAAAAAAAJtf2MAAEd/f1giCwEGHFh/fzEAAANaf39/f39/f39/RwAAAAAAKFRten55aUwaAAAA" }, ["116"]: { ["w"]: 9, ["h"]: 20, ["adv"]: 8, ["left"]: 0, ["top"]: 20, ["cov"]: "AAAAdnYAAAAAAAAQf3YAAAAAAAApf3YAAAAAAABBf3YAAAAARn9/f39/f24AQHZ9f392dmUAAABcf3YAAAAAAABcf3YAAAAAAABcf3YAAAAAAABcf3YAAAAAAABcf3YAAAAAAABcf3YAAAAAAABcf3YAAAAAAABcf3YAAAAAAABcf3YAAAAAAABcf3YAAAAAAABZf30BAAAAAABKf389DxgEAAAgf39/f38OAAAAM2x8d2MJ" }, ["117"]: { ["w"]: 17, ["h"]: 16, ["adv"]: 17, ["left"]: 0, ["top"]: 16, ["cov"]: "AAZ/f0wAAAAAAAAEf39OAAAABn9/TAAAAAAAAAR/f04AAAAGf39MAAAAAAAABH9/TgAAAAZ/f0wAAAAAAAAEf39OAAAABn9/TAAAAAAAAAR/f04AAAAGf39MAAAAAAAABH9/TgAAAAZ/f0wAAAAAAAAEf39OAAAABn9/TAAAAAAAAAR/f04AAAAGf39MAAAAAAAABH9/TgAAAAZ/f0wAAAAAAAAHf39OAAAABX9/TwAAAAAAABZ/f04AAAAAfn9bAAAAAAAAOn9/TgAAAABsf3cGAAAAAA51f39OAAAAAEd/f1waBwstcFh0f04AAAAAC3J/f39/f39oCnB/TwAAAAAADEltfHloPgUAan9TAAA=" }, ["118"]: { ["w"]: 15, ["h"]: 16, ["adv"]: 15, ["left"]: 0, ["top"]: 16, ["cov"]: "W39+DAAAAAAAAAALfn9aLX9/NQAAAAAAAAA2f38qBXl/YAAAAAAAAABif3cDAFF/fgwAAAAAAA9/f0wAACN/fzUAAAAAADt/fx0AAAFzf2AAAAAAAGd/bQAAAABHf34MAAAAE39/PgAAAAAZf381AAAAP39/EAAAAAAAa39fAAAAa39gAAAAAAAAPX9+DAAYf38wAAAAAAAAD39/NABDf3oGAAAAAAAAAGF/WwBtf1IAAAAAAAAAADN/exl/fyMAAAAAAAAAAAh8f19/cgEAAAAAAAAAAABXf39/RAAAAAAAAAAAAAApf39/FQAAAAAA" }, ["119"]: { ["w"]: 23, ["h"]: 16, ["adv"]: 22, ["left"]: -1, ["top"]: 16, ["cov"]: "AHN/VwAAAAAAAFl/fzEAAAAAAAJ6f0sAUX92AAAAAAABeH9/UgAAAAAAHX9/JwAtf38WAAAAABt/bX9yAAAAAAA+f3wGAAp/fzYAAAAAPX9Ib38SAAAAAF5/XgAAAGZ/VgAAAABefytUfzIAAAADe386AAAAQ391AAAAA3t/DDZ/UgAAACB/fxYAAAAff38VAAAhf2sAFn9yAAAAQH9yAAAAAAJ5fzUAAEJ/SwAAdn8TAABhf00AAAAAAFh/VAAAY38rAABYfzMABXx/KQAAAAAANX90AAZ9fwsAADl/UwAif30HAAAAAAARf38TJn9qAAAAGn9zAEN/YQAAAAAAAABufzFHf0oAAAABeH8TY388AAAAAAAAAEp/TGh/KQAAAABbfzV9fxgAAAAAAAAAJ39ufn8KAAAAADx/bH9zAAAAAAAAAAAGfX9/aAAAAAAAHX9/f1AAAAAAAAAAAABgf39IAAAAAAACen9/LAAAAAA=" }, ["120"]: { ["w"]: 15, ["h"]: 16, ["adv"]: 15, ["left"]: 0, ["top"]: 16, ["cov"]: "D3h/aAIAAAAAAAVwf3QKAC9/fzsAAAAAAEd/fycAAABWf3sRAAAAGX5/TQAAAAAKc39eAAABZn9uBgAAAAAAJX9/LwA5f34dAAAAAAAAAEx/dhp6f0MAAAAAAAAAAAVuf3x/ZwMAAAAAAAAAAAAff39/FwAAAAAAAAAAAABBf39/PgAAAAAAAAAAABp9f2V/fRkAAAAAAAAABGx/YgNpf2oEAAAAAAAASX97EwAafn9HAAAAAAAhf387AAAARX9/IQAAAAdwf2UBAAAABG1/cQcAAFB/fRYAAAAAAB9/f1EAKH9/PwAAAAAAAABLf38p" }, ["121"]: { ["w"]: 15, ["h"]: 22, ["adv"]: 15, ["left"]: 0, ["top"]: 16, ["cov"]: "XX99DAAAAAAAAAAGe39fKn9/OgAAAAAAAAAtf38uAnV/aQAAAAAAAABZf3gFAEV/fxoAAAAAAAd8f00AABN/f0oAAAAAADB/fxwAAABgf3YDAAAAAFt/awAAAAAuf38qAAAACX1/OgAAAAAEd39aAAAAMn99DAAAAAAASX9+DAAAXn9ZAAAAAAAAFn9/OAALfn8oAAAAAAAAAGR/YwA1f3UCAAAAAAAAADF/fw9jf0cAAAAAAAAAAAV5f0p/fxYAAAAAAAAAAABMf39/ZQAAAAAAAAAAAAAaf39/NAAAAAAAAAAAAAAAZ397CAAAAAAAAAAAAAACcH9QAAAAAAAAAAAAAAA0f38YAAAAAAAAAAAAABN3f1gAAAAAAAAAAAsNL3N/eREAAAAAAAAAAn9/f397JAAAAAAAAAAAAXV+dVYXAAAAAAAAAAAA" }, ["122"]: { ["w"]: 15, ["h"]: 16, ["adv"]: 15, ["left"]: 0, ["top"]: 16, ["cov"]: "ACR/f39/f39/f39/fxoAACR/f39/f39/f39/fxoAAAEEBAQEBAQEJ39/ZwMAAAAAAAAAAAAMdH95EgAAAAAAAAAAAAFef38sAAAAAAAAAAAAAD9/f00AAAAAAAAAAAAAH35/aQQAAAAAAAAAAAAKcn96FQAAAAAAAAAAAABaf38xAAAAAAAAAAAAADp/f1IAAAAAAAAAAAAAG31/bAYAAAAAAAAAAAAHb398GAAAAAAAAAAAAABVf381AAAAAAAAAAAAADR/f1kEBAQEBAQEBAIAAGR/f39/f39/f39/f0AAAGR/f39/f39/f39/f0AA" }, ["123"]: { ["w"]: 10, ["h"]: 28, ["adv"]: 10, ["left"]: 0, ["top"]: 22, ["cov"]: "AAAAAANFcX5/QAAAAABMf39/dTkAAAAMfn9pEAAAAAAAIX9/KgAAAAAAAC1/fxQAAAAAAAAuf38OAAAAAAAALn9/DgAAAAAAAC5/fw4AAAAAAAAuf38OAAAAAAAAL39/DgAAAAAAAD5/fwgAAAAAAABmf24AAAAAAhdUf38rAAAAAEB/f2gnAAAAAAA6f394PgAAAAAAAAdFf387AAAAAAAAAF9/dQAAAAAAAAA8f38JAAAAAAAAL39/DgAAAAAAAC5/fw4AAAAAAAAuf38OAAAAAAAALn9/DgAAAAAAAC5/fw4AAAAAAAAtf38VAAAAAAAAH39/LAAAAAAAAAp8f2oRAAAAAAAAR39/f3U5AAAAAAJCcH5/QA==" }, ["124"]: { ["w"]: 8, ["h"]: 28, ["adv"]: 8, ["left"]: 0, ["top"]: 22, ["cov"]: "AAAof38OAAAAACh/fw4AAAAAKH9/DgAAAAAof38OAAAAACh/fw4AAAAAKH9/DgAAAAAof38OAAAAACh/fw4AAAAAKH9/DgAAAAAof38OAAAAACh/fw4AAAAAKH9/DgAAAAAof38OAAAAACh/fw4AAAAAKH9/DgAAAAAof38OAAAAACh/fw4AAAAAKH9/DgAAAAAof38OAAAAACh/fw4AAAAAKH9/DgAAAAAof38OAAAAACh/fw4AAAAAKH9/DgAAAAAof38OAAAAACh/fw4AAAAAKH9/DgAAAAAof38OAAA=" }, ["125"]: { ["w"]: 10, ["h"]: 28, ["adv"]: 10, ["left"]: 0, ["top"]: 22, ["cov"]: "QH9+b0ACAAAAADl2f39/QgAAAAAAABJsf3sGAAAAAAAALX9/GAAAAAAAABd/fyUAAAAAAAAQf38mAAAAAAAAEH9/JgAAAAAAABB/fyYAAAAAAAAQf38mAAAAAAAAEH9/JwAAAAAAAAp/fzUAAAAAAAAAcX9fAAAAAAAAAC5/f1AWAgAAAAAAKmp/fz4AAAAAAUN5f384AAAAAEB/fz8GAAAAAAB4f1YAAAAAAAALf38zAAAAAAAAEH9/JgAAAAAAABB/fyYAAAAAAAAQf38mAAAAAAAAEH9/JgAAAAAAABB/fyYAAAAAAAAXf38lAAAAAAAAL39/FwAAAAAAE21/eQUAAAA5dn9/fz4AAAAAQH9+bz0BAAAAAA==" }, ["126"]: { ["w"]: 18, ["h"]: 12, ["adv"]: 18, ["left"]: 0, ["top"]: 12, ["cov"]: "AAAoXXd6aksfAAAAAAAAKhQAAEB/f39/f39/bDwVAxNIfxYAAFRwLgsNIkp0f39/f39/eg4AADkIAAAAAAACKVd0fXJQEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } }, ["44"]: { ["32"]: { ["w"]: 0, ["h"]: 0, ["adv"]: 12, ["left"]: 0, ["top"]: 0, ["cov"]: "" }, ["33"]: { ["w"]: 12, ["h"]: 30, ["adv"]: 12, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAH1/f38cAAAAAAAAAHp/f38ZAAAAAAAAAHd/f38WAAAAAAAAAHR/f38TAAAAAAAAAHF/f38QAAAAAAAAAG5/f38NAAAAAAAAAGt/f38KAAAAAAAAAGh/f38HAAAAAAAAAGV/f38EAAAAAAAAAGJ/f38BAAAAAAAAAF9/f34AAAAAAAAAAFx/f3sAAAAAAAAAAFl/f3gAAAAAAAAAAFZ/f3UAAAAAAAAAAFN/f3IAAAAAAAAAAFB/f28AAAAAAAAAAE1/f2wAAAAAAAAAAEp/f2kAAAAAAAAAAEd/f2YAAAAAAAAAAER/f2MAAAAAAAAAAEF/f2AAAAAAAAAAAD1/f10AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABH9/f38SAAAAAAAABH9/f38SAAAAAAAABH9/f38SAAAAAAAABH9/f38SAAAA" }, ["34"]: { ["w"]: 16, ["h"]: 30, ["adv"]: 16, ["left"]: 0, ["top"]: 30, ["cov"]: "AA1/f39mAAAAF39/f1wAAAAHf39/YAAAABF/f39WAAAAAX9/f1oAAAAMf39/UAAAAAB8f39UAAAABn9/f0oAAAAAdn9/TgAAAAF/f39EAAAAAHB/f0gAAAAAe39/PgAAAABqf39CAAAAAHV/fzgAAAAAZH9/PAAAAABwf38yAAAAAF9/fzYAAAAAan9/LAAAAABZf38wAAAAAGV/fyYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["35"]: { ["w"]: 25, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAEfX8sAAAAAAAAAG1/QAAAAAAAAAAAAAAAHX9/EQAAAAAAAAh/fyUAAAAAAAAAAAAAADh/dgAAAAAAAAAjf38KAAAAAAAAAAAAAABUf1sAAAAAAAAAPn9vAAAAAAAAAAAAAAAAb39AAAAAAAAAAFl/VAAAAAAAAAAAAAAACn9/JgAAAAAAAABzfzoAAAAAAAAAAAAAACZ/fwsAAAAAAAAPf38fAAAAAAAAAAAAAABBf3AAAAAAAAAAKn9+BQAAAAAAAAAAAAAAXH9VAAAAAAAAAER/aQAAAAAAAFp/f39/f39/f39/f39/f39/f39/f39/IABaf39/f39/f39/f39/f39/f39/f39/fyAAAAAAAAAzf30EAAAAAAAAH39/EgAAAAAAAAAAAAAATn9mAAAAAAAAADp/dwAAAAAAAAAAAAAAAGl/SgAAAAAAAABVf1wAAAAAAAAAAAAAAAV+fy8AAAAAAAAAcH9CAAAAAAAAAAAAAAAef38TAAAAAAAACn9/JwAAAAAAAAAAAAAAOX93AAAAAAAAACV/fwwAAAAAAAAAAAAAAFR/XAAAAAAAAABAf3EAAAAAAAAAAAAAAABuf0EAAAAAAAAAWn9XAAAAAAAAAGh/f39/f39/f39/f39/f39/f39/f39/FABof39/f39/f39/f39/f39/f39/f39/fxQAAAAAAEt/YgAAAAAAAAA3f3oBAAAAAAAAAAAAAABlf0kAAAAAAAAAUX9hAAAAAAAAAAAAAAACfH8vAAAAAAAAAGt/RgAAAAAAAAAAAAAAGH9/FgAAAAAAAAZ/fysAAAAAAAAAAAAAADJ/ewEAAAAAAAAgf38QAAAAAAAAAAAAAABMf2MAAAAAAAAAOn91AAAAAAAAAAAAAAAAZX9JAAAAAAAAAFR/WwAAAAAAAAAAAAAAAnx/MAAAAAAAAABvf0AAAAAAAAAAAAAAABl/fxYAAAAAAAAJf38lAAAAAAAAAAAA" }, ["36"]: { ["w"]: 24, ["h"]: 36, ["adv"]: 24, ["left"]: 0, ["top"]: 33, ["cov"]: "AAAAAAAAAAAAAABwf2YAAAAAAAAAAAAAAAAAAAAAAAAAAABwf2YAAAAAAAAAAAAAAAAAAAAAAAAAAABwf2YAAAAAAAAAAAAAAAAAAAAADTdVa3d/f393alExBwAAAAAAAAAAAAxTfn9/f39/f39/f39/ej0CAAAAAAAAGHZ/f39/f39/f39/f39/f39aAwAAAAAJdX9/f3JAHgxwf2gXM2F/f39/SQAAAABHf39/WQYAAABwf2YAAAAyf39/fxYAAAByf392BwAAAABwf2YAAAAAQ39/f1AAAAl/f39TAAAAAABwf2YAAAAAB3x/f3QBABF/f39JAAAAAABwf2YAAAAAADIuFgIAAAt/f39YAAAAAABwf2YAAAAAAAAAAAAAAAB2f397DAAAAABwf2YAAAAAAAAAAAAAAABPf39/ZAsAAABwf2YAAAAAAAAAAAAAAAAReX9/f3U9DgBwf2YAAAAAAAAAAAAAAAAAJ3x/f39/f2d6f2cAAAAAAAAAAAAAAAAAAB1sf39/f39/f39yUS0JAAAAAAAAAAAAAAADMmN/f39/f39/f399WB4AAAAAAAAAAAAAAAAONFd9f39/f39/f39VCAAAAAAAAAAAAAAAAABwf3NXeX9/f39/awkAAAAAAAAAAAAAAABwf2YAAydcf39/f1cAAAAAAAAAAAAAAABwf2YAAAAALn5/f38XAAAAAAAAAAAAAABwf2YAAAAAAEF/f38+AAAAAAAAAAAAAABwf2YAAAAAAA5/f39VAAASLgwAAAAAAABwf2YAAAAAAAB8f39eKnZ/fzQAAAAAAABwf2YAAAAAAAJ+f39YGH9/f2oBAAAAAABwf2YAAAAAACB/f39IAGZ/f39CAAAAAABwf2YAAAAAA2J/f38iACR/f39/SwcAAABwf2YAAAAOXX9/f2cBAABHf39/f3lRMiBzf2ogNFZ8f39/eRkAAAAARX9/f39/f39/f39/f39/f391HwAAAAAAAB9kf39/f39/f39/f39/fFALAAAAAAAAAAAAFj1ZbXl/f392aVMzCwAAAAAAAAAAAAAAAAAAAABwf2YAAAAAAAAAAAAAAAAAAAAAAAAAAABwf2YAAAAAAAAAAAAAAAAAAAAAAAAAAABwf2YAAAAAAAAAAAAA" }, ["37"]: { ["w"]: 39, ["h"]: 30, ["adv"]: 39, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAU7YnV8dFwvAAAAAAAAAAAAAAAAAAAARH9/aAIAAAAAAAAAAAAAFHF/f39/f39/XwUAAAAAAAAAAAAAAAAafn99GQAAAAAAAAAAAAAFcH9/bjstQHV/f1QAAAAAAAAAAAAAAANpf39CAAAAAAAAAAAAAAA9f39rBgAAABF5f38bAAAAAAAAAAAAAEF/f2oDAAAAAAAAAAAAAABsf38rAAAAAABHf39KAAAAAAAAAAAAGH1/fhoAAAAAAAAAAAAAAA1/f34HAAAAAAAjf39sAAAAAAAAAAACaH9/RAAAAAAAAAAAAAAAACN/f3AAAAAAAAAOf39+AwAAAAAAAAA/f39rAwAAAAAAAAAAAAAAAC9/f2QAAAAAAAACf39/DgAAAAAAABZ8f34cAAAAAAAAAAAAAAAAADV/f18AAAAAAAAAfX9/FAAAAAAAAWZ/f0YAAAAAAAAAAAAAAAAAADR/f2AAAAAAAAAAfn9/FAAAAAAAPH9/bAQAAAAAAAAAAAAAAAAAAC5/f2UAAAAAAAAEf39/DQAAAAAUfH9+HQAAAAAAAAAAAAAAAAAAAB9/f3MAAAAAAAASf398AgAAAAFkf39IAAAAAAAAAAAAAAAAAAAAAAl/f38LAAAAAAArf39nAAAAADp/f24FAAAAKFdyfHdnQgoAAAAAAABkf38zAAAAAABVf39BAAAAE3t/fx8AAANYf39/f39/f3YcAAAAAAAyf39yDQAAACJ+f30SAAABYX9/SgAAAEx/f31QNj5rf393CwAAAAABZn9/dUc5T3x/f0QAAAA3f39vBQAAE35/fyUAAAAEYn9/SQAAAAAADGl/f39/f39/UQEAABF6f38hAAAAQH9/WQAAAAAAH39/dgIAAAAAAAM2YXZ9c1gmAAAAAF9/f0wAAAAAYX9/MwAAAAAAAXh/fxsAAAAAAAAAAAAAAAAAAAAANH9/cAYAAAAAdn9/HQAAAAAAAGN/fzAAAAAAAAAAAAAAAAAAAAAPeX9/IwAAAAACf39/EAAAAAAAAFd/fz0AAAAAAAAAAAAAAAAAAABdf39OAAAAAAAJf39/DAAAAAAAAFJ/f0QAAAAAAAAAAAAAAAAAADJ/f3EHAAAAAAAJf39/CwAAAAAAAFJ/f0QAAAAAAAAAAAAAAAAADnh/fyUAAAAAAAACf39/EAAAAAAAAFd/fz0AAAAAAAAAAAAAAAAAWn9/UAAAAAAAAAAAdn9/HQAAAAAAAGV/fy8AAAAAAAAAAAAAAAAvf39zCAAAAAAAAAAAX39/NAAAAAAAAnp/fxgAAAAAAAAAAAAAAAx3f38mAAAAAAAAAAAAPX9/WgAAAAAAJn9/cQEAAAAAAAAAAAAAAFh/f1IAAAAAAAAAAAAAD31/fyMAAAAGaX9/PwAAAAAAAAAAAAAALX9/dAkAAAAAAAAAAAAAAEN/f3xLMjxtf39uBQAAAAAAAAAAAAALdn9/KAAAAAAAAAAAAAAAAAFPf39/f39/f24RAAAAAAAAAAAAAABWf39UAAAAAAAAAAAAAAAAAAAAJFZyfHZjOgQAAAAA" }, ["38"]: { ["w"]: 29, ["h"]: 30, ["adv"]: 29, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAAABNEY3V9eWtPIAAAAAAAAAAAAAAAAAAAAAAAAABDfn9/f39/f39/WQgAAAAAAAAAAAAAAAAAAAAARn9/f3pbT1t0f39/ZAIAAAAAAAAAAAAAAAAAABd+f39aCQAAAARCf39/NAAAAAAAAAAAAAAAAAAARX9/cwUAAAAAAABXf39gAAAAAAAAAAAAAAAAAABef39MAAAAAAAAADB/f3IAAAAAAAAAAAAAAAAAAGd/fz4AAAAAAAAANX9/cAAAAAAAAAAAAAAAAAAAYH9/RAAAAAAAAABff39ZAAAAAAAAAAAAAAAAAABNf39ZAAAAAAAAPH9/fycAAAAAAAAAAAAAAAAAAC9/f3gDAAAAB09/f39XAAAAAAAAAAAAAAAAAAAACn1/fysACD11f39/XAUAAAAAAAAAAAAAAAAAAAAAWX9/aE56f39/fD8BAAAAAAAAAAAAAAAAAAAAAAAjf39/f39/flQTAAAAAAAAAAAAAAAAAAAAAAAEPHV/f39/ekwUAAAAAAAAAAAAAAAAAAAAAAAAIW5/f39/f38zAAAAAAAAAAAFbkwnAwAAAAAAADl+f39/b2x/f3QHAAAAAAAAACZ/f30IAAAAAAA3f39/eTUBGn5/f0wAAAAAAAAATH9/XwAAAAAAGn1/f3IUAAAAS39/fyUAAAAAAAN3f382AAAAAABdf399GQAAAAAHcH9/dAwAAAAAK39/ewgAAAAADX9/f08AAAAAAAAgf39/YQIAAABlf39PAAAAAAAqf39/JwAAAAAAAABFf39/SgAAJH9/fhUAAAAAADZ/f38XAAAAAAAAAAJhf39/OAJqf39SAAAAAAAAMn9/fxwAAAAAAAAAAA10f39+WX9/fBEAAAAAAAAlf39/NQAAAAAAAAAAABt7f39/f38+AAAAAAAAAAd9f39qAQAAAAAAAAAAACx/f39/bwMAAAAAAAAAAFV/f39NAQAAAAAAAAADSH9/f39/OwAAAAAAAAAAEnp/f39kJgQAAAAPN3B/f39/f39/YioNBhAZAAAAInt/f39/fW9qdX9/f39/Vjh+f39/f39/f1QAAAAAFGJ/f39/f39/f39/aiwAACVxf39/f39/VAAAAAAAABpEYHJ6fHJkRSEAAAAAAAU0XHJ9eGkz" }, ["39"]: { ["w"]: 8, ["h"]: 30, ["adv"]: 8, ["left"]: 0, ["top"]: 30, ["cov"]: "AABff39/FAAAAFl/f38OAAAAU39/fwgAAABOf39/AgAAAEh/f3wAAAAAQn9/dgAAAAA8f39wAAAAADZ/f2oAAAAAMX9/ZAAAAAArf39eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["40"]: { ["w"]: 15, ["h"]: 41, ["adv"]: 15, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAAAAAAAAAAAl9/f3ELAAAAAAAAAAAAT39/ehgAAAAAAAAAAAA2f39/LgAAAAAAAAAAABZ7f39WAAAAAAAAAAAAAmh/f3UKAAAAAAAAAAAAN39/fzUAAAAAAAAAAAAJd39/awIAAAAAAAAAAABBf39/LgAAAAAAAAAAAAR1f390AwAAAAAAAAAAADF/f39BAAAAAAAAAAAAAFx/f38XAAAAAAAAAAAACX1/f24AAAAAAAAAAAAAKX9/f0sAAAAAAAAAAAAARX9/fy8AAAAAAAAAAAAAYX9/fxMAAAAAAAAAAAAAc39/fgIAAAAAAAAAAAAEf39/cAAAAAAAAAAAAAARf39/YQAAAAAAAAAAAAAYf39/WgAAAAAAAAAAAAAdf39/VQAAAAAAAAAAAAAhf39/UQAAAAAAAAAAAAAdf39/VAAAAAAAAAAAAAAYf39/WQAAAAAAAAAAAAASf39/YAAAAAAAAAAAAAAEf39/bwAAAAAAAAAAAAAAc39/fQEAAAAAAAAAAAAAYH9/fxMAAAAAAAAAAAAARX9/fy4AAAAAAAAAAAAAKX9/f0oAAAAAAAAAAAAACX1/f20AAAAAAAAAAAAAAF1/f38WAAAAAAAAAAAAADF/f39BAAAAAAAAAAAAAAV2f39zAwAAAAAAAAAAAABBf39/LgAAAAAAAAAAAAAJd39/awIAAAAAAAAAAAAAN39/fzUAAAAAAAAAAAAAAml/f3UKAAAAAAAAAAAAABZ7f39WAAAAAAAAAAAAAAA3f39/LwAAAAAAAAAAAAAAT39/ehgAAAAAAAAAAAAAAl9/f3EL" }, ["41"]: { ["w"]: 15, ["h"]: 41, ["adv"]: 15, ["left"]: 0, ["top"]: 32, ["cov"]: "Kn9/fzYAAAAAAAAAAAAAAEB/f34kAAAAAAAAAAAAAABaf394EQAAAAAAAAAAAAAMdn9/YwIAAAAAAAAAAAAALH9/fz4AAAAAAAAAAAAAAGF/f3sPAAAAAAAAAAAAABt/f39TAAAAAAAAAAAAAABbf39/FAAAAAAAAAAAAAAjf39/TQAAAAAAAAAAAAAAbX9/ewcAAAAAAAAAAAAAQ39/fy4AAAAAAAAAAAAAGn9/f1kAAAAAAAAAAAAAAHZ/f3kBAAAAAAAAAAAAAFt/f38YAAAAAAAAAAAAAD9/f380AAAAAAAAAAAAACx/f39GAAAAAAAAAAAAABx/f39WAAAAAAAAAAAAAA1/f39lAAAAAAAAAAAAAAZ/f39rAAAAAAAAAAAAAAF/f39wAAAAAAAAAAAAAAB9f390AAAAAAAAAAAAAAF/f39wAAAAAAAAAAAAAAZ/f39rAAAAAAAAAAAAAA1/f39lAAAAAAAAAAAAABx/f39WAAAAAAAAAAAAACx/f39GAAAAAAAAAAAAAD9/f380AAAAAAAAAAAAAFt/f38YAAAAAAAAAAAAAHZ/f3kBAAAAAAAAAAAAGn9/f1kAAAAAAAAAAAAAQ39/fy8AAAAAAAAAAAAAbX9/fAcAAAAAAAAAAAAjf39/TQAAAAAAAAAAAABaf39/FAAAAAAAAAAAABt/f39TAAAAAAAAAAAAAGF/f3sPAAAAAAAAAAAALH9/fz4AAAAAAAAAAAAMdn9/YwIAAAAAAAAAAABaf395EQAAAAAAAAAAAEB/f34kAAAAAAAAAAAAKX9/fzYAAAAAAAAAAAAA" }, ["42"]: { ["w"]: 17, ["h"]: 30, ["adv"]: 17, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAGl/fwYAAAAAAAAAAAAAAAAAZH9/AQAAAAAAAAAAAAAAAABff3sAAAAAAAAAAAAAAAAAAFp/dQAAAAAAAAAAQFooAgAAVX9vAAAAIFBMAABtf390RRNQf2kPPm5/f3kFEXl/f39/f3l/fH5/f39/fCAAAhw8XHp/f39/f3xgQCAEAAAAAAAAAk9/f39ZBAAAAAAAAAAAAAAgfX90f38nAAAAAAAAAAAADXR/dxBuf3cQAAAAAAAAAAJjf38yACZ/f2YDAAAAAAAASn9/YQAAAFl/f0wAAAAAAAxyf3wUAAAAEXt/dg8AAAAAAAZEPQAAAAAAPksJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["43"]: { ["w"]: 26, ["h"]: 26, ["adv"]: 26, ["left"]: 0, ["top"]: 26, ["cov"]: "AAAAAAAAAAAAAAARGBgKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF5/fzYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXn9/NgAAAAAAAAAAAAAAAAAAAAAAAAAAAABef382AAAAAAAAAAAAAAAAAAAAAAAAAAAAAF5/fzYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXn9/NgAAAAAAAAAAAAAAAAAAAAAAAAAAAABef382AAAAAAAAAAAAAAAAAAAAAAAAAAAAAF5/fzYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXn9/NgAAAAAAAAAAAAAAAAAAAAAAAAAAAABef382AAAAAAAAAAAAAAAAAGx/f39/f39/f39/f39/f39/f39/f0QAAAAAbH9/f39/f39/f39/f39/f39/f39/RAAAAABsf39/f39/f39/f39/f39/f39/f39EAAAAAA8SEhISEhISEmJ/f0ASEhISEhISEgkAAAAAAAAAAAAAAAAAXn9/NgAAAAAAAAAAAAAAAAAAAAAAAAAAAABef382AAAAAAAAAAAAAAAAAAAAAAAAAAAAAF5/fzYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXn9/NgAAAAAAAAAAAAAAAAAAAAAAAAAAAABef382AAAAAAAAAAAAAAAAAAAAAAAAAAAAAF5/fzYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXn9/NgAAAAAAAAAAAAAAAAAAAAAAAAAAAABef382AAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4qKhEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" }, ["44"]: { ["w"]: 12, ["h"]: 10, ["adv"]: 12, ["left"]: 0, ["top"]: 5, ["cov"]: "AAAAAHZ/f38iAAAAAAAAAHZ/f38iAAAAAAAAAHZ/f38iAAAAAAAAAHZ/f38hAAAAAAAAAHZ/f38bAAAAAAAAAAALf38TAAAAAAAAAAAgf3sCAAAAAAAAAABKf14AAAAAAAAAAA17fy8AAAAAAAAAAFl/bAIAAAAA" }, ["45"]: { ["w"]: 15, ["h"]: 13, ["adv"]: 15, ["left"]: 0, ["top"]: 13, ["cov"]: "AAZ/f39/f39/f39/WgAAAAZ/f39/f39/f39/WgAAAAZ/f39/f39/f39/WgAAAAI4ODg4ODg4ODg4JwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["46"]: { ["w"]: 12, ["h"]: 5, ["adv"]: 12, ["left"]: 0, ["top"]: 5, ["cov"]: "AAAAAH5/f38aAAAAAAAAAH5/f38aAAAAAAAAAH5/f38aAAAAAAAAAH5/f38aAAAAAAAAAH5/f38aAAAA" }, ["47"]: { ["w"]: 13, ["h"]: 32, ["adv"]: 12, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAAAAAAAAAof39/CwAAAAAAAAAAS39/ZwAAAAAAAAAAAG5/f0QAAAAAAAAAABF/f38hAAAAAAAAAAA1f396AwAAAAAAAAAAWH9/WwAAAAAAAAAAAnl/fzgAAAAAAAAAAB9/f38VAAAAAAAAAABCf39yAAAAAAAAAAAAZX9/UAAAAAAAAAAACX5/fy0AAAAAAAAAACx/f38KAAAAAAAAAABPf39nAAAAAAAAAAAAcn9/RAAAAAAAAAAAFn9/fyEAAAAAAAAAADl/f3oDAAAAAAAAAABdf39bAAAAAAAAAAAEe39/OAAAAAAAAAAAI39/fxUAAAAAAAAAAEZ/f3IAAAAAAAAAAABqf39PAAAAAAAAAAANf39/LAAAAAAAAAAAMH9/fwoAAAAAAAAAAFR/f2YAAAAAAAAAAAF2f39DAAAAAAAAAAAaf39/IQAAAAAAAAAAPn9/egMAAAAAAAAAAGF/f1sAAAAAAAAAAAZ9f384AAAAAAAAAAAof39/FQAAAAAAAAAAS39/cgAAAAAAAAAAAG5/f08AAAAAAAAAAAA=" }, ["48"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAguVmp2fHFkRBkAAAAAAAAAAAAAAAAAMXd/f39/f39/f39YDAAAAAAAAAAAAABOf39/f39/f39/f39/dRIAAAAAAAAAAEB/f39/YDEdFiJEdX9/f24JAAAAAAAAE31/f34zAAAAAAAADGR/f39JAAAAAAAAVH9/fz8AAAAAAAAAAAx1f398DwAAAAAIfX9/dAMAAAAAAAAAAAA7f39/PwAAAAAuf39/QwAAAAAAAAAAAAAKfn9/ZwAAAABSf39/IgAAAAAAAAAAAAAAaH9/fwwAAABof39/BgAAAAAAAAAAAAAAS39/fyIAAAF7f39zAAAAAAAAAAAAAAAAOX9/fzYAAA5/f39kAAAAAAAAAAAAAAAAK39/f0kAABZ/f39aAAAAAAAAAAAAAAAAIH9/f1EAABt/f39WAAAAAAAAAAAAAAAAHH9/f1cAACF/f39SAAAAAAAAAAAAAAAAGH9/f10AACF/f39RAAAAAAAAAAAAAAAAGH9/f1wAABt/f39WAAAAAAAAAAAAAAAAHX9/f1YAABV/f39aAAAAAAAAAAAAAAAAIX9/f1AAAA1/f39lAAAAAAAAAAAAAAAALX9/f0cAAAB5f391AAAAAAAAAAAAAAAAPX9/fzMAAABlf39/CAAAAAAAAAAAAAAAUX9/fx4AAABNf39/JgAAAAAAAAAAAAAAcH9/fQcAAAAmf39/SgAAAAAAAAAAAAAVf39/XgAAAAAEen9/eAYAAAAAAAAAAABKf39/NAAAAAAASH9/f0gAAAAAAAAAABh8f391BwAAAAAACnl/f385AAAAAAAAFnB/f383AAAAAAAAADB/f39/YzIeGCdOe39/f18CAAAAAAAAAAA/f39/f39/f39/f39/aAcAAAAAAAAAAAAAKHN/f39/f39/f35HBAAAAAAAAAAAAAAAAAUsVmt3e29hPBAAAAAAAAAA" }, ["49"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAAACp4f396AAAAAAAAAAAAAAAAAAAAAAADS39/f396AAAAAAAAAAAAAAAAAAAAABJnf39/f396AAAAAAAAAAAAAAAAAAAALHl/f3p9f396AAAAAAAAAAAAAAAAAARMf39/bBV4f396AAAAAAAAAAAAAAAAAFd/f39WBwB4f396AAAAAAAAAAAAAAAAAGJ/fjsAAAB4f396AAAAAAAAAAAAAAAAAGJ0IAAAAAB4f396AAAAAAAAAAAAAAAAAEQNAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAAAAAAAAAAAB4f396AAAAAAAAAAAAAAAAFyQkJCQkJCR6f397JCQkJCQkJAsAAAAAUn9/f39/f39/f39/f39/f39/fyoAAAAAUn9/f39/f39/f39/f39/f39/fyoAAAAAUn9/f39/f39/f39/f39/f39/fyoA" }, ["50"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAk3V294fXZrUjIGAAAAAAAAAAAAAAADQ3t/f39/f39/f395OAAAAAAAAAAAAAlmf39/f39/f39/f39/f1QBAAAAAAAAA2Z/f39/YTUfGiRBcn9/f39AAAAAAAAAQH9/f3wsAAAAAAAABVZ/f397DAAAAAAEd39/fy4AAAAAAAAAAANtf39/NAAAAAAof39/ZwAAAAAAAAAAAAA4f39/UQAAAAA/f39/PwAAAAAAAAAAAAAff39/XQAAAAAAAw4aDAAAAAAAAAAAAAAdf39/XQAAAAAAAAAAAAAAAAAAAAAAAAAtf39/TQAAAAAAAAAAAAAAAAAAAAAAAABTf39/KQAAAAAAAAAAAAAAAAAAAAAAABJ9f390AwAAAAAAAAAAAAAAAAAAAAAAAmN/f38wAAAAAAAAAAAAAAAAAAAAAAAAUn9/f1oAAAAAAAAAAAAAAAAAAAAAAAJRf39/awcAAAAAAAAAAAAAAAAAAAAACF1/f39sDQAAAAAAAAAAAAAAAAAAAAAVbn9/f2QKAAAAAAAAAAAAAAAAAAAAACh5f39/VgUAAAAAAAAAAAAAAAAAAAAAP39/f39BAAAAAAAAAAAAAAAAAAAAAARWf39/eSkAAAAAAAAAAAAAAAAAAAAABl5/f39wFgAAAAAAAAAAAAAAAAAAAAAEYH9/f2MLAAAAAAAAAAAAAAAAAAAAAAFXf39/XQQAAAAAAAAAAAAAAAAAAAAAAEB/f39cAwAAAAAAAAAAAAAAAAAAAAAAHn5/f2sHAAAAAAAAAAAAAAAAAAAAAAABan9/fhYAAAAAAAAAAAAAAAAAAAAAAAAvf39/YSQkJCQkJCQkJCQkJCQkJAkAAABhf39/f39/f39/f39/f39/f39/fyIAAABkf39/f39/f39/f39/f39/f39/fyIAAABkf39/f39/f39/f39/f39/f39/fyIA" }, ["51"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAABNBXnJ6fHVoTy0EAAAAAAAAAAAAAAAOV39/f39/f39/f392MgAAAAAAAAAAABt3f39/f39/f39/f39/f1ABAAAAAAAAEXl/f397TywdGyhFdX9/f38+AAAAAAAAX39/f2kSAAAAAAAACF1/f397CwAAAAAZf39/dwwAAAAAAAAAAAZzf39/MwAAAABDf39/PwAAAAAAAAAAAABCf39/SwAAAABVfn9/GgAAAAAAAAAAAAAqf39/VgAAAAAAAAgSAgAAAAAAAAAAAAApf39/UQAAAAAAAAAAAAAAAAAAAAAAAABAf39/PAAAAAAAAAAAAAAAAAAAAAAAAAdyf39+EwAAAAAAAAAAAAAAAAAAAAAACmB/f39LAAAAAAAAAAAAAAAAAAACCyBGd39/f1gDAAAAAAAAAAAAAAAIf39/f39/f39wMgAAAAAAAAAAAAAAAAAIf39/f39/bjYCAAAAAAAAAAAAAAAAAAAIf39/f39/f390RwsAAAAAAAAAAAAAAAACLi4wN0difn9/f3cjAAAAAAAAAAAAAAAAAAAAAAAAD1N/f397GwAAAAAAAAAAAAAAAAAAAAAAAABEf39/aAEAAAAAAAAAAAAAAAAAAAAAAAABb39/fxwAAAAAAAAAAAAAAAAAAAAAAAAAS39/fzgAAAklMDwzAAAAAAAAAAAAAAAAQX9/f0EAABd/f39zAAAAAAAAAAAAAAAATH9/fzgAAAF5f39/IgAAAAAAAAAAAAAAbH9/fygAAABNf39/aAQAAAAAAAAAAAAuf39/fQcAAAAVfH9/f14MAAAAAAAAAC18f39/UAAAAAAAPH9/f395Ti4fHCQ8Zn9/f391DAAAAAAAAEN/f39/f39/f39/f39/f3YYAAAAAAAAAAAja39/f39/f39/f39+VAsAAAAAAAAAAAAAAB9GYHJ6fXZtVzoOAAAAAAAA" }, ["52"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAAAAAAAAA+f39/dgAAAAAAAAAAAAAAAAAAAAAAABh9f39/dgAAAAAAAAAAAAAAAAAAAAAABGp/f39/dgAAAAAAAAAAAAAAAAAAAAAAR39/f39/dgAAAAAAAAAAAAAAAAAAAAAff39/cn9/dgAAAAAAAAAAAAAAAAAAAAdvf39TXH9/dgAAAAAAAAAAAAAAAAAAAE9/f3kOXH9/dgAAAAAAAAAAAAAAAAAAJ39/fzIAXH9/dgAAAAAAAAAAAAAAAAAKdH9/WQAAXH9/dgAAAAAAAAAAAAAAAABXf391CwAAXH9/dgAAAAAAAAAAAAAAADB/f38oAAAAXH9/dgAAAAAAAAAAAAAAD3h/f08AAAAAXH9/dgAAAAAAAAAAAAAAX39/bwYAAAAAXH9/dgAAAAAAAAAAAAA4f39+HgAAAAAAXH9/dgAAAAAAAAAAABR7f39EAAAAAAAAXH9/dgAAAAAAAAAAAmZ/f2gDAAAAAAAAXH9/dgAAAAAAAAAAQX9/fBYAAAAAAAAAXH9/dgAAAAAAAAAbfn9/OQAAAAAAAAAAXH9/dgAAAAAAAARsf39cAAAAAAAAAAAAXH9/dgAAAAAAAEp/f3EKAAAAAAAAAAAAXH9/dgAAAAAAAH1/f39/f39/f39/f39/f39/f39/f38YAH5/f39/f39/f39/f39/f39/f39/f38YAH5/f39/f39/f39/f39/f39/f39/f38YAAUGBgYGBgYGBgYGBgYGXX9/dgYGBgYBAAAAAAAAAAAAAAAAAAAAXH9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAXH9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAXH9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAXH9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAXH9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAXH9/dgAAAAAA" }, ["53"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMH9/f39/f39/f39/f39/f39uAAAAAAAAOH9/f39/f39/f39/f39/f39uAAAAAAAAQH9/f39/f39/f39/f39/f39uAAAAAAAASH9/fzEkJCQkJCQkJCQkJCQeAAAAAAAAUH9/fwwAAAAAAAAAAAAAAAAAAAAAAAAAWH9/fwQAAAAAAAAAAAAAAAAAAAAAAAAAYH9/fQAAAAAAAAAAAAAAAAAAAAAAAAAAaH9/dQAAAAAAAAAAAAAAAAAAAAAAAAAAcH9/bQAAAAAAAAAAAAAAAAAAAAAAAAAAeH9/ZgAAAAAAAAAAAAAAAAAAAAAAAAAAfn9/XgAAAAAAAAAAAAAAAAAAAAAAAAAIf39/VgASQmB0fHlvWjkLAAAAAAAAAAAQf39/WVF/f39/f39/f397RgMAAAAAAAAXf39/f39/f39/f39/f39/f2YKAAAAAAAff39/f391RycaGCRCc39/f39iAwAAAAAnf39/f0MFAAAAAAAAA0p/f39/OgAAAAAOKioqGgAAAAAAAAAAAABMf39/dwMAAAAAAAAAAAAAAAAAAAAAAAAHdn9/fyEAAAAAAAAAAAAAAAAAAAAAAAAAT39/fz0AAAAAAAAAAAAAAAAAAAAAAAAAOn9/f0kAAAAAAAAAAAAAAAAAAAAAAAAANX9/f0sAAAAAAAAAAAAAAAAAAAAAAAAAQH9/f0AAAAUkM0I+AAAAAAAAAAAAAAAAW39/fzAAAAd9f399DwAAAAAAAAAAAAAOfX9/fw4AAABcf39/VgAAAAAAAAAAAABYf39/YAAAAAAhf39/f0sEAAAAAAAABlJ/f39/HgAAAAAATn9/f39wQCMXGCZFdX9/f39CAAAAAAAAA1V/f39/f39/f39/f39/f0cAAAAAAAAAAAA1dn9/f39/f39/f39qJgAAAAAAAAAAAAAABCtPaHZ9e3JjRiMAAAAAAAAA" }, ["54"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAGNFpxfHx0Xz4PAAAAAAAAAAAAAAAAADJ3f39/f39/f399QwEAAAAAAAAAAAAAS39/f39/f39/f39/f1cBAAAAAAAAAABBf39/f10tGhosXX9/f389AAAAAAAAABl/f398LgAAAAAAADR/f396CwAAAAAAAF5/f380AAAAAAAAAABPf39/OwAAAAAAHn9/f18AAAAAAAAAAAAUXkcwEwAAAAAASX9/fyMAAAAAAAAAAAAAAAAAAAAAAAAAcn9/dQAAAAAAAAAAAAAAAAAAAAAAAAATf39/UgAAAAAAAAAAAAAAAAAAAAAAAAAof39/OQAAAAAAAAAAAAAAAAAAAAAAAAA+f39/JgAAF0hneX11ZkYaAAAAAAAAAABNf39/FwNJf39/f39/f39/WAoAAAAAAABUf39/FGJ/f39/f39/f39/f3AQAAAAAABaf39/U399TB8HAAggTn1/f39oBAAAAABgf39/f3YaAAAAAAAAACB5f39/OgAAAABcf39/fyMAAAAAAAAAAAAvf39/dAEAAABWf39/ZgAAAAAAAAAAAAABbn9/fxgAAABPf39/RwAAAAAAAAAAAAAAS39/fzIAAABAf39/PgAAAAAAAAAAAAAAOn9/fz0AAAAqf39/RAAAAAAAAAAAAAAANH9/f0AAAAATf39/VgAAAAAAAAAAAAAAPH9/fzcAAAAAbn9/dQIAAAAAAAAAAAAAVH9/fygAAAAAQ39/fy0AAAAAAAAAAAAFd39/fwoAAAAAEn1/f3MKAAAAAAAAAABBf39/YAAAAAAAAEZ/f39nDAAAAAAAADJ+f39/IgAAAAAAAAdrf39/eEIeERYvX39/f39OAAAAAAAAAAANb39/f39/f39/f39/f1oDAAAAAAAAAAAACU9/f39/f39/f395PgEAAAAAAAAAAAAAAAAVP2NxfHlvWDYJAAAAAAAA" }, ["55"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AABgf39/f39/f39/f39/f39/f39/fyIAAABgf39/f39/f39/f39/f39/f39/fyIAAABgf39/f39/f39/f39/f39/f39/fyIAAAAbJCQkJCQkJCQkJCQkJCQkZn9/dgsAAAAAAAAAAAAAAAAAAAAAAAAlf39/LwAAAAAAAAAAAAAAAAAAAAAAAAhyf39cAAAAAAAAAAAAAAAAAAAAAAAAAFB/f3oPAAAAAAAAAAAAAAAAAAAAAAAAI39/fzsAAAAAAAAAAAAAAAAAAAAAAAADbH9/aQIAAAAAAAAAAAAAAAAAAAAAAAA8f39/HwAAAAAAAAAAAAAAAAAAAAAAAA56f39UAAAAAAAAAAAAAAAAAAAAAAAAAFF/f3sPAAAAAAAAAAAAAAAAAAAAAAAAFX5/f0UAAAAAAAAAAAAAAAAAAAAAAAAAV39/eQoAAAAAAAAAAAAAAAAAAAAAAAAZf39/RQAAAAAAAAAAAAAAAAAAAAAAAABTf39+EAAAAAAAAAAAAAAAAAAAAAAAAA19f39ZAAAAAAAAAAAAAAAAAAAAAAAAAEN/f38jAAAAAAAAAAAAAAAAAAAAAAAAAXN/f3IAAAAAAAAAAAAAAAAAAAAAAAAAIH9/f0sAAAAAAAAAAAAAAAAAAAAAAAAATH9/fyQAAAAAAAAAAAAAAAAAAAAAAAAAcn9/eQMAAAAAAAAAAAAAAAAAAAAAAAASf39/XQAAAAAAAAAAAAAAAAAAAAAAAAAyf39/RgAAAAAAAAAAAAAAAAAAAAAAAABNf39/LwAAAAAAAAAAAAAAAAAAAAAAAABhf39/GAAAAAAAAAAAAAAAAAAAAAAAAAB1f39/CQAAAAAAAAAAAAAAAAAAAAAAAAN/f39/AgAAAAAAAAAAAAAAAAAAAAAAAAp/f396AAAAAAAAAAAAAAAAAAAAAAAAABB/f39zAAAAAAAAAAAAAAAA" }, ["56"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAABZCXnJ6fXVoTywDAAAAAAAAAAAAAAAQXH9/f39/f39/f392MgAAAAAAAAAAAB55f39/f351cnt/f39/f1IBAAAAAAAAEHl/f39jJgUAAAEWR31/f39FAAAAAAAAV39/f1UBAAAAAAAAACV+f39+EwAAAAAJfX9/egoAAAAAAAAAAABUf39/PwAAAAAif39/XAAAAAAAAAAAAAAsf39/WQAAAAAtf39/TQAAAAAAAAAAAAAdf39/ZAAAAAAnf39/UAAAAAAAAAAAAAAgf39/XwAAAAAQf39/ZQAAAAAAAAAAAAAyf39/SAAAAAAAZn9/fxYAAAAAAAAAAABcf39/HgAAAAAAJH9/f2kKAAAAAAAAADN/f39cAAAAAAAAAEF/f390OxYFAgslV39/f24MAAAAAAAAAAAwdH9/f39/f39/f39+VAoAAAAAAAAAAAAAEFZ/f39/f39/f3AvAQAAAAAAAAAAAAlOfX9/f395dn5/f39/cTAAAAAAAAAAEG5/f39dJggAAAEWPnZ/f39LAAAAAAADaH9/fzkAAAAAAAAAAAtnf39/NAAAAAA2f39/UAAAAAAAAAAAAAARfH9/dQQAAABlf39/FwAAAAAAAAAAAAAAWH9/fyQAAAF+f398AAAAAAAAAAAAAAAAQn9/fz0AAAl/f392AAAAAAAAAAAAAAAAPX9/f0UAAAJ/f39+AgAAAAAAAAAAAAAAR39/fz0AAABzf39/HQAAAAAAAAAAAAAAYX9/fy0AAABPf39/UwAAAAAAAAAAAAAUfn9/fgsAAAAbf39/fzYAAAAAAAAAAAhmf39/VQAAAAAAS39/f39aJQgAAAASOHJ/f393DwAAAAAAAVJ/f39/f395dnx/f39/f3cbAAAAAAAAAAAucn9/f39/f39/f39+Vg0AAAAAAAAAAAAAASVJYnJ6fXZtVzsPAAAAAAAA" }, ["57"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAABI9XXB5e29fOQ4AAAAAAAAAAAAAAAAJUn5/f39/f39/f3xAAwAAAAAAAAAAABVvf39/f39/f39/f39/XQMAAAAAAAAACW9/f39+UikYGCxZf39/f1MAAAAAAAAAUH9/f3cdAAAAAAAAK31/f38kAAAAAAAQfX9/fyEAAAAAAAAAADN/f39pAAAAAAA5f39/WAAAAAAAAAAAAABkf39/GgAAAABZf39/KgAAAAAAAAAAAAAvf39/RAAAAABqf39/DwAAAAAAAAAAAAANf39/ZgAAAABzf39/BAAAAAAAAAAAAAAAd39/egEAAABzf39/BAAAAAAAAAAAAAAAbn9/fxEAAABqf39/DgAAAAAAAAAAAAAAcX9/fx8AAABZf39/KAAAAAAAAAAAAAAFfn9/fyUAAAA7f39/VAAAAAAAAAAAAAAzf39/fywAAAASfn9/fhsAAAAAAAAAAAtxf39/fzAAAAAAVn9/f3EUAAAAAAAAEGZ/fX9/fyoAAAAADnZ/f397RRwLDR9IeX97Un9/fyQAAAAAACF5f39/f39/f39/f30rRn9/fx0AAAAAAAAZaX9/f39/f39/bR8AUX9/fw8AAAAAAAAAAStTbnp8cFYrAgAAZn9/eAAAAAAAAAAAAAAAAAAAAAAAAAADe39/YwAAAAAAAAAAAAAAAAAAAAAAAAAjf39/RAAAAAAAAAAAAAAAAAAAAAAAAABPf39/GQAAAAALOk5iQQAAAAAAAAAAABB9f39tAAAAAAAHfH9/eQkAAAAAAAAAAV9/f38uAAAAAAAAUX9/f2IFAAAAAAAFU39/f2YAAAAAAAAAEXp/f39yOR4RHDtvf39/dhMAAAAAAAAAACx+f39/f39/f39/f394HAAAAAAAAAAAAAAmcn9/f39/f39/f1wOAAAAAAAAAAAAAAAABTBWbnp9cmVGGQAAAAAAAAAA" }, ["58"]: { ["w"]: 12, ["h"]: 24, ["adv"]: 12, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAAAH5/f38aAAAAAAAAAH5/f38aAAAAAAAAAH5/f38aAAAAAAAAAH5/f38aAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH5/f38aAAAAAAAAAH5/f38aAAAAAAAAAH5/f38aAAAAAAAAAH5/f38aAAAA" }, ["59"]: { ["w"]: 12, ["h"]: 30, ["adv"]: 12, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAAAHZ/f38iAAAAAAAAAHZ/f38iAAAAAAAAAHZ/f38iAAAAAAAAAHZ/f38iAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHZ/f38iAAAAAAAAAHZ/f38iAAAAAAAAAHZ/f38iAAAAAAAAAHZ/f38gAAAAAAAAAAAKf38aAAAAAAAAAAAYf38RAAAAAAAAAAA2f3oBAAAAAAAAAABif1wAAAAAAAAAABp/fy0AAAAAAAAAAGF/awEAAAAA" }, ["60"]: { ["w"]: 26, ["h"]: 26, ["adv"]: 26, ["left"]: 0, ["top"]: 26, ["cov"]: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAD0U9AAAAAAAAAAAAAAAAAAAAAAAAAAAAHlV+f0YAAAAAAAAAAAAAAAAAAAAAAAADLmZ/f39/RgAAAAAAAAAAAAAAAAAAAAALP3N/f39/f2MeAAAAAAAAAAAAAAAAAAAXT3x/f39/flUcAAAAAAAAAAAAAAAAAAEoYH9/f39/eEcPAAAAAAAAAAAAAAAAAAc4b39/f39/bzgHAAAAAAAAAAAAAAAAABJJeX9/f39/YyoBAAAAAAAAAAAAAAAAACFZf39/f39+VRsAAAAAAAAAAAAAAAAAAABbf39/f394Rg8AAAAAAAAAAAAAAAAAAAAAAGp/f39vOAYAAAAAAAAAAAAAAAAAAAAAAAAAan9/UgMAAAAAAAAAAAAAAAAAAAAAAAAAAABqf39/bzcGAAAAAAAAAAAAAAAAAAAAAAAAAF5/f39/f3hFDgAAAAAAAAAAAAAAAAAAAAAAACZdf39/f399UxoAAAAAAAAAAAAAAAAAAAAAAAAVTHt/f39/f2EoAQAAAAAAAAAAAAAAAAAAAAAACTxxf39/f39tNgUAAAAAAAAAAAAAAAAAAAAAAAIrYn9/f39/d0MNAAAAAAAAAAAAAAAAAAAAAAAAGlF8f39/f31RGAAAAAAAAAAAAAAAAAAAAAAAAAxBdH9/f39/XxwAAAAAAAAAAAAAAAAAAAAAAAADMGd/f39/RgAAAAAAAAAAAAAAAAAAAAAAAAAAAB9Wfn9GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQRj0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" }, ["61"]: { ["w"]: 26, ["h"]: 22, ["adv"]: 26, ["left"]: 0, ["top"]: 22, ["cov"]: "AABsf39/f39/f39/f39/f39/f39/f39EAAAAAGx/f39/f39/f39/f39/f39/f39/f0QAAAAAbH9/f39/f39/f39/f39/f39/f39/RAAAAAAUGBgYGBgYGBgYGBgYGBgYGBgYGBgMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAbH9/f39/f39/f39/f39/f39/f39/RAAAAABsf39/f39/f39/f39/f39/f39/f39EAAAAAGx/f39/f39/f39/f39/f39/f39/f0QAAAAAFBgYGBgYGBgYGBgYGBgYGBgYGBgYDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }, ["62"]: { ["w"]: 26, ["h"]: 26, ["adv"]: 26, ["left"]: 0, ["top"]: 26, ["cov"]: "AABWNQYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGp/d0YQAAAAAAAAAAAAAAAAAAAAAAAAAAAAan9/f35WHgAAAAAAAAAAAAAAAAAAAAAAAAA0cX9/f39/Zi8DAAAAAAAAAAAAAAAAAAAAAAACLGV/f39/f3Q/CwAAAAAAAAAAAAAAAAAAAAAAAB5Xfn9/f398UBgAAAAAAAAAAAAAAAAAAAAAAAARSHl/f39/f2ApAQAAAAAAAAAAAAAAAAAAAAAABzpxf39/f39vOQcAAAAAAAAAAAAAAAAAAAAAAAIsZH9/f39/eUoTAAAAAAAAAAAAAAAAAAAAAAAAHlZ+f39/f384AAAAAAAAAAAAAAAAAAAAAAAAABBIeX9/f0YAAAAAAAAAAAAAAAAAAAAAAAAAAAAPan9/RgAAAAAAAAAAAAAAAAAAAAAAAAAQR3l/f39GAAAAAAAAAAAAAAAAAAAAAAAcVX5/f39/fzoAAAAAAAAAAAAAAAAAAAEqY39/f39/e04WAAAAAAAAAAAAAAAAAAY4b39/f39/cj0JAAAAAAAAAAAAAAAAAA9GeH9/f39/YywCAAAAAAAAAAAAAAAAABpTfX9/f399UxsAAAAAAAAAAAAAAAAAAShhf39/f391Qg0AAAAAAAAAAAAAAAAAADFuf39/f39oMQQAAAAAAAAAAAAAAAAAAAAAan9/f35YIAAAAAAAAAAAAAAAAAAAAAAAAABqf3hHEAAAAAAAAAAAAAAAAAAAAAAAAAAAAFY2BgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" }, ["63"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAo3VW12fXhvXEEXAAAAAAAAAAAAAAAHS3x/f39/f39/f39/YhgAAAAAAAAAABRxf39/f39/f39/f39/f30yAAAAAAAAD3N/f39/d1dBOj9Pb39/f39/KQAAAAAAW39/f3w8BQAAAAAAACl0f39/cgYAAAAgf39/fiUAAAAAAAAAAAATeH9/fy4AAABSf39/SQAAAAAAAAAAAAAAPX9/f1MAAAB1f39/EAAAAAAAAAAAAAAAGH9/f2IAAApudn1vAAAAAAAAAAAAAAAADX9/f2gAAAAAAAADAAAAAAAAAAAAAAAAF39/f14AAAAAAAAAAAAAAAAAAAAAAAAAO39/f0MAAAAAAAAAAAAAAAAAAAAAAAALd39/fxYAAAAAAAAAAAAAAAAAAAAAAAVcf39/UQAAAAAAAAAAAAAAAAAAAAAADGR/f39rBwAAAAAAAAAAAAAAAAAAAAAndn9/f2ULAAAAAAAAAAAAAAAAAAAAA0p/f39/TAQAAAAAAAAAAAAAAAAAAAAGYX9/f3YoAAAAAAAAAAAAAAAAAAAAAAJhf39/Zw8AAAAAAAAAAAAAAAAAAAAAAD1/f39lBQAAAAAAAAAAAAAAAAAAAAAAAnZ/f3sOAAAAAAAAAAAAAAAAAAAAAAAAHn9/f08AAAAAAAAAAAAAAAAAAAAAAAAAL39/fzUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATH9/f0wAAAAAAAAAAAAAAAAAAAAAAAAATH9/f0wAAAAAAAAAAAAAAAAAAAAAAAAATH9/f0wAAAAAAAAAAAAAAAAAAAAAAAAATH9/f0wAAAAAAAAAAAAA" }, ["64"]: { ["w"]: 45, ["h"]: 38, ["adv"]: 45, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAAAAAAAAAAAAAAAAAAAAACIj5WanJ6fXdwX0suCgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAG093f39/f39/f39/f39/f14mAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABpcf39/f39/cmdfXGJsfX9/f39/ZRkAAAAAAAAAAAAAAAAAAAAAAAAAAAAERn5/f39vRiEIAAAAAAAAAxtAb39/f344AAAAAAAAAAAAAAAAAAAAAAAAABBqf39/ZCYAAAAAAAAAAAAAAAAAAStxf39/SAAAAAAAAAAAAAAAAAAAAAAAGHN/f3gwAAAAAAAAAAAAAAAAAAAAAAAGVH9/fzsAAAAAAAAAAAAAAAAAAAASdn9/aA4AAAAAAAAAAAAAAAAAAAAAAAAAAEl/f34bAAAAAAAAAAAAAAAAAAhsf39hBwAAAAAAAAAAAAAAAAAAAAAAAAAAAAFZf39pAQAAAAAAAAAAAAAAAFZ/f2wIAAAAAAAAEEJjdnxvXjAEAAAPRERECAAMd39/KQAAAAAAAAAAAAAAJn9/ehMAAAAAAAVHfn9/f39/f39sEQA0f395AQAAPX9/YQAAAAAAAAAAAAADcH9/OwAAAAAADWd/f39/bmFnfH9/dAlUf39eAAAACHt/fgsAAAAAAAAAAAAxf39rAgAAAAAIa39/f1UTAAAABTp8f1Bzf39BAAAAAFl/fy8AAAAAAAAAAABrf38wAAAAAABYf39/OQAAAAAAAAAkfn9/f38lAAAAADZ/f0YAAAAAAAAAABx/f3QDAAAAACp/f39HAAAAAAAAAAAAUn9/f38JAAAAACB/f1sAAAAAAAAAAER/f0kAAAAAAWx/f28EAAAAAAAAAAAAJ39/f2wAAAAAABJ/f2QAAAAAAAAAAGt/fyMAAAAAI39/fzIAAAAAAAAAAAAAF39/f1AAAAAAAAp/f2sAAAAAAAAABn9/fQMAAAAAUH9/fAYAAAAAAAAAAAAAHH9/fzQAAAAAAA1/f2oAAAAAAAAAHH9/awAAAAAAcn9/XwAAAAAAAAAAAAAALH9/fxcAAAAAABZ/f2UAAAAAAAAAMH9/VQAAAAANf39/PAAAAAAAAAAAAAAARn9/eQEAAAAAAB9/f1kAAAAAAAAAOX9/SgAAAAAgf39/KwAAAAAAAAAAAAAAZ39/XwAAAAAAADN/f0gAAAAAAAAAQH9/QwAAAAAqf39/IAAAAAAAAAAAAAAPf39/RAAAAAAAAFB/fzAAAAAAAAAARH9/PwAAAAAuf39/FwAAAAAAAAAAAABEf39/KwAAAAAAAG1/fxIAAAAAAAAAPn9/RQAAAAAof39/HAAAAAAAAAAAAAt4f39/FQAAAAAAF39/awAAAAAAAAAAN39/TwAAAAAdf39/LgAAAAAAAAAAAFR/f39/BAAAAAAATX9/PQAAAAAAAAAAJn9/YwAAAAAFfn9/UQAAAAAAAAAAOn94f394AAAAAAAWfX96CQAAAAAAAAAAEH9/egMAAAAAXn9/fBIAAAAAAAA8f383f393AAAAAAZpf389AAAAAAAAAAAAAHF/fyMAAAAAJ39/f20dAAABIGB/f0kUf39/FgAAE2Z/f2MDAAAAAAAAAAAAAEt/f1IAAAAAAFV/f39/c2t4f39/VQIEe39/dlVgfn9/awwAAAAAAAAAAAAAAB1/f30PAAAAAARXf39/f39/f3s+AQAAQX9/f39/f39YCgAAAAAAAAAAAAAAAABif39YAAAAAAAAJlZyfHllQQ4AAAAAACpgdHxxUyEAAAAAAAAAAAAAAAAAAAAff39/MgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATH9/fSgAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAABGR/f346AQAAAAAAAAAAAAAAAAAAAAAAACBfZwAAAAAAAAAAAAAAAAAAAAAAAApof39/ZB8AAAAAAAAAAAAAAAAAAAk0Z39/fycAAAAAAAAAAAAAAAAAAAAAAAAGWX9/f39nPBgDAAAAAAAADiY+X31/f39/YBoAAAAAAAAAAAAAAAAAAAAAAAAAAC91f39/f399bmZhaHB5f39/f39/f2EhAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNmx/f39/f39/f39/f39/f2k9EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUOFFlc3l+d29nWUAnDQAAAAAAAAAAAAAAAAAAAAAA" }, ["65"]: { ["w"]: 30, ["h"]: 30, ["adv"]: 29, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAAAAAAYn9/f38nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXf39/f39bAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMf39/f39+EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZ5f39ef39/QwAAAAAAAAAAAAAAAAAAAAAAAAAAADV/f38iaH9/dAIAAAAAAAAAAAAAAAAAAAAAAAAAAGl/f3QBPX9/fysAAAAAAAAAAAAAAAAAAAAAAAAAHn9/f0gAEH9/f18AAAAAAAAAAAAAAAAAAAAAAAAAU39/fxkAAGB/f38TAAAAAAAAAAAAAAAAAAAAAAALfH9/aAAAAC5/f39GAAAAAAAAAAAAAAAAAAAAAAA8f39/NgAAAAR3f392BAAAAAAAAAAAAAAAAAAAAAFvf397CAAAAABJf39/LgAAAAAAAAAAAAAAAAAAACZ/f39QAAAAAAAXf39/YgAAAAAAAAAAAAAAAAAAAFp/f38eAAAAAAAAZH9/fxYAAAAAAAAAAAAAAAAAEH5/f2sAAAAAAAAAMX9/f0oAAAAAAAAAAAAAAAAARH9/fzkAAAAAAAAABXl/f3gFAAAAAAAAAAAAAAADdX9/fAkAAAAAAAAAAEx/f38xAAAAAAAAAAAAAAAtf39/UwAAAAAAAAAAABp/f39lAAAAAAAAAAAAAABif39/IQAAAAAAAAAAAABnf39/GQAAAAAAAAAAABZ/f39/f39/f39/f39/f39/f39/TQAAAAAAAAAAAEt/f39/f39/f39/f39/f39/f39/egcAAAAAAAAABnl/f39/f39/f39/f39/f39/f39/fzUAAAAAAAAANH9/f14aGhoaGhoaGhoaGhoaMX9/f2gAAAAAAAAAaX9/fygAAAAAAAAAAAAAAAAAAG9/f38cAAAAAAAef39/cwIAAAAAAAAAAAAAAAAAAD5/f39QAAAAAABSf39/QgAAAAAAAAAAAAAAAAAAAA1+f397CAAAAAp8f39/EAAAAAAAAAAAAAAAAAAAAABZf39/OAAAADx/f39dAAAAAAAAAAAAAAAAAAAAAAAmf39/bAAAAW9/f38qAAAAAAAAAAAAAAAAAAAAAAABcn9/fyAAJX9/f3UCAAAAAAAAAAAAAAAAAAAAAAAAQX9/f1QAWX9/f0UAAAAAAAAAAAAAAAAAAAAAAAAAEH9/f3wL" }, ["66"]: { ["w"]: 29, ["h"]: 30, ["adv"]: 29, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMn9/f39/f39/f39/enRoVDoSAAAAAAAAAAAAAAAyf39/f39/f39/f39/f39/f39eGQAAAAAAAAAAADJ/f39/f39/f39/f39/f39/f398LAAAAAAAAAAAMn9/f2YkJCQkJCQkKTRLcX9/f399FwAAAAAAAAAyf39/XAAAAAAAAAAAAAACNn1/f39ZAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAO39/f3wGAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAIfn9/fxYAAAAAAAAyf39/XAAAAAAAAAAAAAAAAABzf39/HwAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAHR/f38XAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAKfn9/ewIAAAAAAAAyf39/XAAAAAAAAAAAAAAAADt/f39RAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAle39/eRAAAAAAAAAAMn9/f1wAAAAAAAAABRIrWH9/f3sjAAAAAAAAAAAyf39/f39/f39/f39/f39/f39cFAAAAAAAAAAAADJ/f39/f39/f39/f39/f394QxMAAAAAAAAAAAAAMn9/f39/f39/f39/f39/f39/f2krAAAAAAAAAAAyf39/YxoaGhoaGhobISxBZX9/f39VBAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAHW1/f39TAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAC3V/f38kAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAO39/f1cAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAbf39/dQAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAABN/f39/AQAAAAAyf39/XAAAAAAAAAAAAAAAAAAAHn9/f3kAAAAAADJ/f39cAAAAAAAAAAAAAAAAAABBf39/aQAAAAAAMn9/f1wAAAAAAAAAAAAAAAAADnh/f39DAAAAAAAyf39/XAAAAAAAAAAAAAAAAB5uf39/ehAAAAAAADJ/f39mJCQkJCQkJCQoMUVnf39/f380AAAAAAAAMn9/f39/f39/f39/f39/f39/f399NQAAAAAAAAAyf39/f39/f39/f39/f39/f39/XBYAAAAAAAAAADJ/f39/f39/f39/f398dWpUOQ8AAAAAAAAA" }, ["67"]: { ["w"]: 32, ["h"]: 30, ["adv"]: 32, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAAAAAXOFhncXt8dWtWPBUAAAAAAAAAAAAAAAAAAAAAAAEubH9/f39/f39/f39/f2gqAAAAAAAAAAAAAAAAAAAXbH9/f39/f39/f39/f39/f39dDAAAAAAAAAAAAAAAK3p/f39/f29NPjMxO1Fxf39/f39yEQAAAAAAAAAAACZ/f39/f1gXAAAAAAAAAAAjZX9/f39xCQAAAAAAAAASd39/f3soAAAAAAAAAAAAAAABRH9/f39WAAAAAAAAAGB/f398HAAAAAAAAAAAAAAAAAAARH9/f38fAAAAAAAdf39/fzYAAAAAAAAAAAAAAAAAAAACZn9/f0gAAAAAAFl/f39nAAAAAAAAAAAAAAAAAAAAAAAlaDwRAAAAAAAEfH9/fy4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACB/f398BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPn9/f2MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABLf39/SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFV/f38/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXn9/fzcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABef39/OQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFh/f39CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATH9/f08AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4f39/bQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB9/f39/DQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnl/f39BAAAAAAAAAAAAAAAAAAAAAAAAQU4PAAAAAAAAUX9/f3YHAAAAAAAAAAAAAAAAAAAAABB7f3xIAQAAAAAaf39/f1MAAAAAAAAAAAAAAAAAAAABYX9/f1YAAAAAAABWf39/fzkAAAAAAAAAAAAAAAAAAEx/f398EwAAAAAAAA53f39/f0QBAAAAAAAAAAAAAARQf39/fzYAAAAAAAAAACF9f39/f2soAgAAAAAAAAEpbX9/f39PAAAAAAAAAAAAACV6f39/f394VkI3MjtSc39/f39/TgEAAAAAAAAAAAAAABZlf39/f39/f39/f39/f39/ejMAAAAAAAAAAAAAAAAAAAEuaX9/f39/f39/f39/e0sMAAAAAAAAAAAAAAAAAAAAAAAAFjxWa3Z9fHRmTi4GAAAAAAAAAAAA" }, ["68"]: { ["w"]: 32, ["h"]: 30, ["adv"]: 32, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMn9/f39/f39/f394b2dYPCAFAAAAAAAAAAAAAAAAAAAyf39/f39/f39/f39/f39/f3lJEgAAAAAAAAAAAAAAADJ/f39/f39/f39/f39/f39/f39/TQUAAAAAAAAAAAAAMn9/f2YkJCQkJCQsNUJfen9/f39/axcAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAADMGh/f39/dxkAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAT9+f39/cgoAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAACh/f39/UwAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAADx/f39/GQAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAW1/f39QAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAL39/f3gDAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAHfn9/fxwAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAABlf39/NQAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAE9/f39FAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAARX9/f1AAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAAA8f39/VAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAD9/f39QAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAAR39/f0kAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAABZf39/OwAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAHJ/f38mAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAWf39/fgsAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAEd/f39kAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAMeX9/fzUAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAFR/f393BQAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAA9f39/fzUAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAADRn9/f39hAQAAAAAAAAAyf39/XAAAAAAAAAAAAAABKWp/f39/bwoAAAAAAAAAADJ/f39mJCQkJCQkJCs4UXV/f39/f2oOAAAAAAAAAAAAMn9/f39/f39/f39/f39/f39/f39NBwAAAAAAAAAAAAAyf39/f39/f39/f39/f39/f39ZHAAAAAAAAAAAAAAAADJ/f39/f39/f39/f3x1Z1EzDAAAAAAAAAAAAAAA" }, ["69"]: { ["w"]: 29, ["h"]: 30, ["adv"]: 29, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMn9/f39/f39/f39/f39/f39/f39/f39KAAAAAAAyf39/f39/f39/f39/f39/f39/f39/f0oAAAAAADJ/f39/f39/f39/f39/f39/f39/f39/SgAAAAAAMn9/f2guLi4uLi4uLi4uLi4uLi4uLi4aAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/f39/f39/f39/f39/f39/f39/JAAAAAAAADJ/f39/f39/f39/f39/f39/f39/f38kAAAAAAAAMn9/f39/f39/f39/f39/f39/f39/fyQAAAAAAAAyf39/ZygoKCgoKCgoKCgoKCgoKCgoCwAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39oLi4uLi4uLi4uLi4uLi4uLi4uLhQAAAAAMn9/f39/f39/f39/f39/f39/f39/f39/OgAAAAAyf39/f39/f39/f39/f39/f39/f39/f386AAAAADJ/f39/f39/f39/f39/f39/f39/f39/fzoA" }, ["70"]: { ["w"]: 27, ["h"]: 30, ["adv"]: 27, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMn9/f39/f39/f39/f39/f39/f39/fw4AAAAAMn9/f39/f39/f39/f39/f39/f39/fw4AAAAAMn9/f39/f39/f39/f39/f39/f39/fw4AAAAAMn9/f2guLi4uLi4uLi4uLi4uLi4uLgUAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f39/f39/f39/f39/f39/f39/TAAAAAAAMn9/f39/f39/f39/f39/f39/f39/TAAAAAAAMn9/f39/f39/f39/f39/f39/f39/TAAAAAAAMn9/f2oyMjIyMjIyMjIyMjIyMjIyHQAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["71"]: { ["w"]: 34, ["h"]: 30, ["adv"]: 34, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAAAAAVNFRlb3h+eHJjUDMRAAAAAAAAAAAAAAAAAAAAAAAAAS1pf39/f39/f39/f39/f18lAAAAAAAAAAAAAAAAAAAAF2x/f39/f39/f39/f39/f39/f1UHAAAAAAAAAAAAAAAALnt/f39/f25OPjQwNURaeH9/f39/ZwsAAAAAAAAAAAAAKX9/f39+UhQAAAAAAAAAAAMtbX9/f39gAgAAAAAAAAAAFnl/f392HwAAAAAAAAAAAAAAAANRf39/fz4AAAAAAAAAAGR/f393EwAAAAAAAAAAAAAAAAAAAFV/f395CQAAAAAAACJ/f39/KQAAAAAAAAAAAAAAAAAAAAAHa1YxDAAAAAAAAABdf39/XQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFfX9/fyQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI39/f3gBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEF/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABNf39/RAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAV39/fzsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGB/f38zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgf39/NQAAAAAAAAAAAAAAcn9/f39/f39/f39/eAAAAAAAWX9/fz4AAAAAAAAAAAAAAHJ/f39/f39/f39/f3gAAAAAAE1/f39KAAAAAAAAAAAAAAByf39/f39/f39/f394AAAAAAA5f39/ZgAAAAAAAAAAAAAAMTg4ODg4ODg4dH9/eAAAAAAAH39/f34HAAAAAAAAAAAAAAAAAAAAAAAAAGx/f3gAAAAAAAJ3f39/OAAAAAAAAAAAAAAAAAAAAAAAAABsf394AAAAAAAATX9/f3ACAAAAAAAAAAAAAAAAAAAAAAAAbH9/eAAAAAAAABV/f39/RwAAAAAAAAAAAAAAAAAAAAAAAGx/f3gAAAAAAAAAT39/f38tAAAAAAAAAAAAAAAAAAAAAAt0f394AAAAAAAAAAlyf39/fzwAAAAAAAAAAAAAAAAAACd0f39/eAAAAAAAAAAAGHp/f39/ZiUBAAAAAAAAAAAIMmh/f39/fjgAAAAAAAAAAAAbdH9/f39/dlQ9MywzPEtofn9/f39/cyQAAAAAAAAAAAAAAA5Zf39/f39/f39/f39/f39/f398SAkAAAAAAAAAAAAAAAAAACNdf39/f39/f39/f39/f29ADQAAAAAAAAAAAAAAAAAAAAAAAA0yT2Nzen57dGVSOBgAAAAAAAAAAAAA" }, ["72"]: { ["w"]: 32, ["h"]: 30, ["adv"]: 32, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAdn9/fxgAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAB2f39/GAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAHZ/f38YAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAdn9/fxgAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAB2f39/GAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAHZ/f38YAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAdn9/fxgAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAB2f39/GAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAHZ/f38YAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAdn9/fxgAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAB2f39/GAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAHZ/f38YAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAdn9/fxgAAAAAAAAyf39/f39/f39/f39/f39/f39/f39/f39/GAAAAAAAADJ/f39/f39/f39/f39/f39/f39/f39/f38YAAAAAAAAMn9/f39/f39/f39/f39/f39/f39/f39/fxgAAAAAAAAyf39/azg4ODg4ODg4ODg4ODg4ODh6f39/GAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAHZ/f38YAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAdn9/fxgAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAB2f39/GAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAHZ/f38YAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAdn9/fxgAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAB2f39/GAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAHZ/f38YAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAdn9/fxgAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAB2f39/GAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAHZ/f38YAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAdn9/fxgAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAB2f39/GAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAHZ/f38YAAAA" }, ["73"]: { ["w"]: 12, ["h"]: 30, ["adv"]: 12, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAAAAAAAHh/f38WAAAA" }, ["74"]: { ["w"]: 22, ["h"]: 30, ["adv"]: 22, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAWf39/f39/f39/XgAAAAAAAAAAAAAAFn9/f39/f39/f14AAAAAAAAAAAAAABZ/f39/f39/f39eAAAAAAAAAAAAAAAHLi4uLi5Kf39/XgAAAAAAAAAAAAAAAAAAAAAALH9/f14AAAAAAAAAAAAAAAAAAAAAACx/f39eAAAAAAAAAAAAAAAAAAAAAAAsf39/XgAAAAAAAAAAAAAAAAAAAAAALH9/f14AAAAAAAAAAAAAAAAAAAAAACx/f39eAAAAAAAAAAAAAAAAAAAAAAAsf39/XgAAAAAAAAAAAAAAAAAAAAAALH9/f14AAAAAAAAAAAAAAAAAAAAAACx/f39eAAAAAAAAAAAAAAAAAAAAAAAsf39/XgAAAAAAAAAAAAAAAAAAAAAALH9/f14AAAAAAAAAAAAAAAAAAAAAACx/f39eAAAAAAAAAAAAAAAAAAAAAAAsf39/XgAAAAAAAAAAAAAAAAAAAAAALH9/f14AAAAAAAAAAAAAAAAAAAAAACx/f39eAAAAAAAAAAAAAAAAAAAAAAAsf39/XgAAAAAAAAAAAAAAAAAAAAAALH9/f14AAAAAAAAAAAAAAAAAAAAAACx/f39dAAAACzhOZGAAAAAAAAAAAAAxf39/VgAAABB/f399BwAAAAAAAAAAP39/f0wAAAAAcH9/fzMAAAAAAAAAAF9/f380AAAAAEN/f39xCAAAAAAAABl/f39/EgAAAAAQfH9/f18IAAAAABBuf39/WgAAAAAAAEB/f39/dEQuMUx6f39/exYAAAAAAAABV39/f39/f39/f39/fSsAAAAAAAAAAAJCfX9/f39/f39/byAAAAAAAAAAAAAAAA5AYHR9eW5ULgIAAAAAAAAA" }, ["75"]: { ["w"]: 29, ["h"]: 30, ["adv"]: 29, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMn9/f1wAAAAAAAAAAAAAAAAAHXp/f39RAQAAAAAyf39/XAAAAAAAAAAAAAAAABt4f39/UgEAAAAAADJ/f39cAAAAAAAAAAAAAAAYd39/f1MBAAAAAAAAMn9/f1wAAAAAAAAAAAAAFnZ/f39UAQAAAAAAAAAyf39/XAAAAAAAAAAAABR0f39/VQIAAAAAAAAAADJ/f39cAAAAAAAAAAARcn9/f1cCAAAAAAAAAAAAMn9/f1wAAAAAAAAAD3B/f39YAgAAAAAAAAAAAAAyf39/XAAAAAAAAA5uf39/WQMAAAAAAAAAAAAAADJ/f39cAAAAAAAMbH9/f1oDAAAAAAAAAAAAAAAAMn9/f1wAAAAACmp/f39bAwAAAAAAAAAAAAAAAAAyf39/XAAAAAlof39/XAMAAAAAAAAAAAAAAAAAADJ/f39cAAAHZn9/f10EAAAAAAAAAAAAAAAAAAAAMn9/f1wABmN/f39eBAAAAAAAAAAAAAAAAAAAAAAyf39/XAVgf39/f1MAAAAAAAAAAAAAAAAAAAAAADJ/f39gXX9/f39/f0EAAAAAAAAAAAAAAAAAAAAAMn9/f39/f39ff39/fzAAAAAAAAAAAAAAAAAAAAAyf39/f397MwBBf39/fSAAAAAAAAAAAAAAAAAAADJ/f39/bRgAAABVf39/dxQAAAAAAAAAAAAAAAAAMn9/f2oHAAAAAARmf39/bwsAAAAAAAAAAAAAAAAyf39/XAAAAAAAAA1yf39/ZAQAAAAAAAAAAAAAADJ/f39cAAAAAAAAABp7f39/VQAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAACt/f39/RQAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAD9/f39/MwAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAFR/f399IwAAAAAAAAAAMn9/f1wAAAAAAAAAAAAABGV/f394FgAAAAAAAAAyf39/XAAAAAAAAAAAAAAADHJ/f39xDAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAGXp/f39mBQAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAKn9/f39YAQAAAAAyf39/XAAAAAAAAAAAAAAAAAAAPn9/f39IAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAU39/f382" }, ["76"]: { ["w"]: 24, ["h"]: 30, ["adv"]: 24, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f2guLi4uLi4uLi4uLi4uLi4AAAAAMn9/f39/f39/f39/f39/f39/f38CAAAAMn9/f39/f39/f39/f39/f39/f38CAAAAMn9/f39/f39/f39/f39/f39/f38C" }, ["77"]: { ["w"]: 37, ["h"]: 30, ["adv"]: 37, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMn9/f39/GAAAAAAAAAAAAAAAAAAAAAAANH9/f39/BgAAAAAAADJ/f39/f0oAAAAAAAAAAAAAAAAAAAAAAGV/f39/fwYAAAAAAAAyf39/f393BAAAAAAAAAAAAAAAAAAAABV/f39/f38GAAAAAAAAMn9/f31/fy0AAAAAAAAAAAAAAAAAAABGf399f39/BgAAAAAAADJ/f39gf39fAAAAAAAAAAAAAAAAAAACdH9/Y39/fwYAAAAAAAAyf39/PH9/fxEAAAAAAAAAAAAAAAAAKH9/e0Z/f38GAAAAAAAAMn9/fxx6f39CAAAAAAAAAAAAAAAAAFl/f1lGf39/BgAAAAAAADJ/f38aVX9/cgEAAAAAAAAAAAAAAAt9f38wSn9/fwYAAAAAAAAyf39/HSp/f38mAAAAAAAAAAAAAAA6f398CE5/f38GAAAAAAAAMn9/fyAFeX9/VwAAAAAAAAAAAAAAan9/VQBSf39/BgAAAAAAADJ/f38iAE5/f30LAAAAAAAAAAAAHH9/fyQAVH9/fwYAAAAAAAAyf39/IgAcf39/OwAAAAAAAAAAAEx/f3IBAFR/f38GAAAAAAAAMn9/fyIAAGt/f2wAAAAAAAAAAAR4f39CAABUf39/BgAAAAAAADJ/f38iAAA5f39/HgAAAAAAAAAuf39/EgAAVH9/fwYAAAAAAAAyf39/IgAACn1/f1AAAAAAAAAAX39/YAAAAFR/f38GAAAAAAAAMn9/fyIAAABWf396BwAAAAAAEH9/fzAAAABUf39/BgAAAAAAADJ/f38iAAAAJH9/fzMAAAAAAEB/f3kFAAAAVH9/fwYAAAAAAAAyf39/IgAAAAFxf39lAAAAAABvf39OAAAAAFR/f38GAAAAAAAAMn9/fyIAAAAAQX9/fxcAAAAhf39/HQAAAABUf39/BgAAAAAAADJ/f38iAAAAABB/f39IAAAAUn9/awAAAAAAVH9/fwYAAAAAAAAyf39/IgAAAAAAXn9/dgMAB3t/fzsAAAAAAFR/f38GAAAAAAAAMn9/fyIAAAAAACx/f38kADJ/f30MAAAAAABUf39/BgAAAAAAADJ/f38iAAAAAAADdn9/SgBcf39ZAAAAAAAAVH9/fwYAAAAAAAAyf39/IgAAAAAAAEl/f3AHfX9/KAAAAAAAAFR/f38GAAAAAAAAMn9/fyIAAAAAAAAXf39/Pn9/dAIAAAAAAABUf39/BgAAAAAAADJ/f38iAAAAAAAAAGV/f3d/f0YAAAAAAAAAVH9/fwYAAAAAAAAyf39/IgAAAAAAAAA0f39/f38VAAAAAAAAAFR/f38GAAAAAAAAMn9/fyIAAAAAAAAAB3p/f39kAAAAAAAAAABUf39/BgAAAAAAADJ/f38iAAAAAAAAAABQf39/MwAAAAAAAAAAVH9/fwYAAAAAAAAyf39/IgAAAAAAAAAAH39/ewcAAAAAAAAAAFR/f38GAAAA" }, ["78"]: { ["w"]: 32, ["h"]: 30, ["adv"]: 32, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMn9/f39YAAAAAAAAAAAAAAAAAAAAQH9/fxgAAAAAAAAyf39/f38qAAAAAAAAAAAAAAAAAABAf39/GAAAAAAAADJ/f39/f3MIAAAAAAAAAAAAAAAAAEB/f38YAAAAAAAAMn9/f39/f00AAAAAAAAAAAAAAAAAQH9/fxgAAAAAAAAyf39/dn9/fx8AAAAAAAAAAAAAAABAf39/GAAAAAAAADJ/f380f39/bAMAAAAAAAAAAAAAAEB/f38YAAAAAAAAMn9/fxNWf39/QgAAAAAAAAAAAAAAQH9/fxgAAAAAAAAyf39/Fwx4f399FgAAAAAAAAAAAABAf39/GAAAAAAAADJ/f38bADN/f39kAQAAAAAAAAAAAEB/f38YAAAAAAAAMn9/fx8AAGF/f382AAAAAAAAAAAAQH9/fxgAAAAAAAAyf39/IQAAFHx/f3kOAAAAAAAAAABAf39/GAAAAAAAADJ/f38iAAAAQH9/f1oAAAAAAAAAAEB/f38YAAAAAAAAMn9/fyIAAAADa39/fysAAAAAAAAAQH9/fxgAAAAAAAAyf39/IgAAAAAef39/dAgAAAAAAABAf39/GAAAAAAAADJ/f38iAAAAAABMf39/TgAAAAAAAEB/f38YAAAAAAAAMn9/fyIAAAAAAAdzf39/IQAAAAAAQH9/fxgAAAAAAAAyf39/IgAAAAAAACl/f39tBAAAAABAf39/GAAAAAAAADJ/f38iAAAAAAAAAFh/f39DAAAAAEB/f38YAAAAAAAAMn9/fyIAAAAAAAAADXl/f30XAAAAQH9/fxgAAAAAAAAyf39/IgAAAAAAAAAANX9/f2UBAAA/f39/GAAAAAAAADJ/f38iAAAAAAAAAAABY39/fzgAAD5/f38YAAAAAAAAMn9/fyIAAAAAAAAAAAAWfX9/eg8AOn9/fxgAAAAAAAAyf39/IgAAAAAAAAAAAABBf39/WwA1f39/GAAAAAAAADJ/f38iAAAAAAAAAAAAAANsf39/LS9/f38YAAAAAAAAMn9/fyIAAAAAAAAAAAAAAB9/f391Mn9/fxgAAAAAAAAyf39/IgAAAAAAAAAAAAAAAE5/f39uf39/GAAAAAAAADJ/f38iAAAAAAAAAAAAAAAACHR/f39/f38YAAAAAAAAMn9/fyIAAAAAAAAAAAAAAAAAK39/f39/fxgAAAAAAAAyf39/IgAAAAAAAAAAAAAAAAAAWn9/f39/GAAAAAAAADJ/f38iAAAAAAAAAAAAAAAAAAAPeX9/f38YAAAA" }, ["79"]: { ["w"]: 34, ["h"]: 30, ["adv"]: 34, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAAAAAYN1dncHl9dm1aQyACAAAAAAAAAAAAAAAAAAAAAAAAAzJtf39/f39/f39/f39/dUEKAAAAAAAAAAAAAAAAAAAAHXB/f39/f39/f39/f39/f39/djEAAAAAAAAAAAAAAAAANX1/f39/f25NPjQyPEhnf39/f39/TAIAAAAAAAAAAAAANH9/f39+URMAAAAAAAAAAAxGe39/f39PAAAAAAAAAAAAHX1/f390HAAAAAAAAAAAAAAAABFsf39/fzYAAAAAAAAAAm9/f39zDwAAAAAAAAAAAAAAAAAACGh/f395DwAAAAAAADB/f39+IQAAAAAAAAAAAAAAAAAAAAATen9/f0sAAAAAAABsf39/UgAAAAAAAAAAAAAAAAAAAAAAAD5/f396CAAAAAATf39/fxgAAAAAAAAAAAAAAAAAAAAAAAAJen9/fy0AAAAANH9/f2wAAAAAAAAAAAAAAAAAAAAAAAAAAFZ/f39RAAAAAFJ/f39OAAAAAAAAAAAAAAAAAAAAAAAAAAA4f39/aQAAAABff39/NQAAAAAAAAAAAAAAAAAAAAAAAAAAHn9/f3wAAAAAaX9/fysAAAAAAAAAAAAAAAAAAAAAAAAAABR/f39/BgAAAHJ/f38jAAAAAAAAAAAAAAAAAAAAAAAAAAALf39/fw0AAAByf39/JQAAAAAAAAAAAAAAAAAAAAAAAAAADX9/f38LAAAAbH9/fy4AAAAAAAAAAAAAAAAAAAAAAAAAABZ/f39/BQAAAF9/f385AAAAAAAAAAAAAAAAAAAAAAAAAAAgf39/eAAAAABLf39/VQAAAAAAAAAAAAAAAAAAAAAAAAAAOn9/f2MAAAAAMX9/f3MAAAAAAAAAAAAAAAAAAAAAAAAAAFd/f39JAAAAAA1/f39/JQAAAAAAAAAAAAAAAAAAAAAAAAl7f39/IwAAAAAAYX9/f18AAAAAAAAAAAAAAAAAAAAAAAA8f39/cwMAAAAAACl/f39/MQAAAAAAAAAAAAAAAAAAAAAReX9/fz0AAAAAAAAAZH9/f3oaAAAAAAAAAAAAAAAAAAAGZX9/f3EGAAAAAAAAABd7f39/eSUAAAAAAAAAAAAAAAANaH9/f34kAAAAAAAAAAAALH9/f39/VhUAAAAAAAAAAAhAeX9/f386AAAAAAAAAAAAAAAufX9/f39/bEo6Ly44RGJ9f39/f344AAAAAAAAAAAAAAAAABxqf39/f39/f39/f39/f39/f24hAAAAAAAAAAAAAAAAAAAAAjJrf39/f39/f39/f39/bzYEAAAAAAAAAAAAAAAAAAAAAAAAABc8Vmp2fH13bFg/GwAAAAAAAAAAAAAA" }, ["80"]: { ["w"]: 29, ["h"]: 30, ["adv"]: 29, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMn9/f39/f39/f39/f352blg+EwAAAAAAAAAAAAAyf39/f39/f39/f39/f39/f39/XhQAAAAAAAAAADJ/f39/f39/f39/f39/f39/f39/fC4AAAAAAAAAMn9/f2YkJCQkJCQkJCgxR2x/f39/fiYAAAAAAAAyf39/XAAAAAAAAAAAAAAAACh1f39/cgUAAAAAADJ/f39cAAAAAAAAAAAAAAAAABd8f39/NQAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAEl/f39bAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAIn9/f3MAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAASf39/fQAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAABB/f399AAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAHn9/f3MAAAAAADJ/f39cAAAAAAAAAAAAAAAAAABAf39/WgAAAAAAMn9/f1wAAAAAAAAAAAAAAAAACXV/f380AAAAAAAyf39/XAAAAAAAAAAAAAAAAAxjf39/cgUAAAAAADJ/f39cAAAAAAAAAAADCyFGd39/f38pAAAAAAAAMn9/f39/f39/f39/f39/f39/f39/NwAAAAAAAAAyf39/f39/f39/f39/f39/f39/cSIAAAAAAAAAADJ/f39/f39/f39/f39/f394XC8DAAAAAAAAAAAAMn9/f2UgICAgICAgIB8YDwEAAAAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["81"]: { ["w"]: 34, ["h"]: 38, ["adv"]: 34, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAAAAAXN1ZmcHl9dm1aQx8CAAAAAAAAAAAAAAAAAAAAAAAAAjBtf39/f39/f39/f39/dD8JAAAAAAAAAAAAAAAAAAAAHG9/f39/f39/f39/f39/f39/dS8AAAAAAAAAAAAAAAAAM3x/f39/f25NPjQyPEhnf39/f39/SgEAAAAAAAAAAAAAMn9/f39+URQAAAAAAAAAAAxGe39/f39MAAAAAAAAAAAAHHx/f391HQAAAAAAAAAAAAAAABFsf39/fzQAAAAAAAAAAW1/f390EQAAAAAAAAAAAAAAAAAACGh/f394DQAAAAAAAC5/f39/IwAAAAAAAAAAAAAAAAAAAAAUen9/f0kAAAAAAABqf39/UwAAAAAAAAAAAAAAAAAAAAAAAD5/f396BwAAAAASf39/fxoAAAAAAAAAAAAAAAAAAAAAAAAJe39/fywAAAAAMn9/f20AAAAAAAAAAAAAAAAAAAAAAAAAAFZ/f39QAAAAAFF/f39PAAAAAAAAAAAAAAAAAAAAAAAAAAA5f39/aAAAAABff39/NgAAAAAAAAAAAAAAAAAAAAAAAAAAH39/f3sAAAAAaH9/fywAAAAAAAAAAAAAAAAAAAAAAAAAABV/f39/BgAAAHJ/f38jAAAAAAAAAAAAAAAAAAAAAAAAAAALf39/fw0AAAByf39/JAAAAAAAAAAAAAAAAAAAAAAAAAAADX9/f38KAAAAbH9/fy0AAAAAAAAAAAAAAAAAAAAAAAAAABV/f39/AgAAAGB/f384AAAAAAAAAAAAAAAAAAAAAAAAAAAff39/eAAAAABNf39/VAAAAAAAAAAAAAAAAAAAAAAAAAAAOX9/f2MAAAAAM39/f3IAAAAAAAAAAAAAAAAAAAAAAAAAAFV/f39GAAAAABB/f39/IgAAAAAAAAAAAAAAAAAAAAAAAAd6f39/JgAAAAAAZH9/f1sAAAAAAAAAAAAAAAAAAAAAAAA5f39/cgIAAAAAAC5/f39/KwAAAAAAAAAAAAAAAAAAAAAOdn9/fz8AAAAAAAABaX9/f3gUAAAAAAAAAAAAAAAAAAAEYH9/f3EHAAAAAAAAAB19f39/dx4AAAAAAAAAAAAAAAAJYn9/f38jAAAAAAAAAAAANn9/f39+TQ0AAAAAAAAAAAM3dH9/f388AAAAAAAAAAAAAAA5f39/f39+Y0AwJSQuOll5f39/f389AAAAAAAAAAAAAAAAACNzf39/f39/f39/f39/f39/f3EkAAAAAAAAAAAAAAAAAAAABj50f39/f39/f39/f39/bjwHAAAAAAAAAAAAAAAAAAAAAAAAASNEX3B8f39/f1U6HgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC35/f38ZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABcf39/UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJn9/f34bAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABnf39/cRMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHH5/f396RB0NDhsOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4f39/f39/f39/LAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADF6f39/f39/fywAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACz9jdn14bVcYAAAAAAA=" }, ["82"]: { ["w"]: 32, ["h"]: 30, ["adv"]: 32, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAMn9/f39/f39/f39/f39/enNnTjAGAAAAAAAAAAAAAAAyf39/f39/f39/f39/f39/f39/f3pGBQAAAAAAAAAAADJ/f39/f39/f39/f39/f39/f39/f39uEAAAAAAAAAAAMn9/f2YkJCQkJCQkJCQlKzlUeX9/f39wCQAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAHSX9/f39MAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAARH9/f3wGAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAEeH9/fygAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAABZf39/OAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAAE9/f39BAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAAAAWX9/fzkAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAJ3f39/IwAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAO39/f3kFAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAADJ+f39/RAAAAAAAAAAyf39/XAAAAAAAAAAAAAAGFDFif39/f2wFAAAAAAAAADJ/f39/f39/f39/f39/f39/f39/f39tDwAAAAAAAAAAMn9/f39/f39/f39/f39/f39/f399SwcAAAAAAAAAAAAyf39/f39/f39/f39/f39/f39dNwwAAAAAAAAAAAAAADJ/f39lICAgICAgICAgXH9/f04AAAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAQe39/fyIAAAAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAA8f39/bwUAAAAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAJqf39/SAAAAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAB5/f39+HAAAAAAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAE9/f39rAwAAAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAACXZ/f39BAAAAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAMX9/f30XAAAAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAYX9/f2UBAAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAVfX9/fzsAAAAAAAAAMn9/f1wAAAAAAAAAAAAAAAAAAABEf39/exIAAAAAAAAyf39/XAAAAAAAAAAAAAAAAAAAAAVvf39/YAAAAAAAADJ/f39cAAAAAAAAAAAAAAAAAAAAACV/f39/NAAA" }, ["83"]: { ["w"]: 29, ["h"]: 30, ["adv"]: 29, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAAAAFKUleb3Z9fHdvXkopBwAAAAAAAAAAAAAAAAAKSHt/f39/f39/f39/f395RgYAAAAAAAAAAAAAHXV/f39/f39/f39/f39/f39/bREAAAAAAAAAABZ7f39/f1w3IRMOEBcpSHR/f39/bQgAAAAAAAAAZn9/f2gVAAAAAAAAAAAABEN/f39/SAAAAAAAABp/f392CwAAAAAAAAAAAAAAAEF/f399DAAAAAAAOH9/f0kAAAAAAAAAAAAAAAAAAm9/f385AAAAAABFf39/OAAAAAAAAAAAAAAAAAAALUErFQIAAAAAAEJ/f39FAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMH9/f3QHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALfX9/f2YRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABFf39/f31OIQMAAAAAAAAAAAAAAAAAAAAAAAAAAANcf39/f39/elw+IQYAAAAAAAAAAAAAAAAAAAAAAAJCfX9/f39/f39/fmdJJQQAAAAAAAAAAAAAAAAAAAAPSHd/f39/f39/f39/e1cgAAAAAAAAAAAAAAAAAAAAAiJFZn1/f39/f39/f39mGwAAAAAAAAAAAAAAAAAAAAAABSA8Wnd/f39/f399LAAAAAAAAAAAAAAAAAAAAAAAAAAAARpAcX9/f398GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACPH5/f39cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOH9/f34JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACdn9/fx8AAAAAAxozAwAAAAAAAAAAAAAAAAAAAABjf39/JgAAAFx9f38oAAAAAAAAAAAAAAAAAAAAAGl/f38cAAAATn9/f2gBAAAAAAAAAAAAAAAAAAAOfn9/fgoAAAAZf39/f04BAAAAAAAAAAAAAAAAAlp/f39dAAAAAABOf39/f2AZAAAAAAAAAAAAABlif39/fh8AAAAAAARif39/f39nRTAiHBwiMEVnf39/f38+AAAAAAAAAAZRf39/f39/f39/f39/f39/f398NAAAAAAAAAAAAAAiYH9/f39/f39/f39/f397Tw8AAAAAAAAAAAAAAAAADjRPY3J4fnx1blxGKQUAAAAAAAAA" }, ["84"]: { ["w"]: 27, ["h"]: 30, ["adv"]: 27, ["left"]: 0, ["top"]: 30, ["cov"]: "An9/f39/f39/f39/f39/f39/f39/f39/f3AAAn9/f39/f39/f39/f39/f39/f39/f39/f3AAAn9/f39/f39/f39/f39/f39/f39/f39/f3AAAC4uLi4uLi4uLi5ff39/VC4uLi4uLi4uLigAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOf39/PAAAAAAAAAAAAAAA" }, ["85"]: { ["w"]: 32, ["h"]: 30, ["adv"]: 32, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAATn9/f0AAAAAAAAAAAAAAAAAAAAAAWn9/fzAAAAAAAABOf39/QAAAAAAAAAAAAAAAAAAAAABaf39/MAAAAAAAAE5/f39AAAAAAAAAAAAAAAAAAAAAAFp/f38wAAAAAAAATn9/f0AAAAAAAAAAAAAAAAAAAAAAWn9/fzAAAAAAAABOf39/QAAAAAAAAAAAAAAAAAAAAABaf39/MAAAAAAAAE5/f39AAAAAAAAAAAAAAAAAAAAAAFp/f38wAAAAAAAATn9/f0AAAAAAAAAAAAAAAAAAAAAAWn9/fzAAAAAAAABOf39/QAAAAAAAAAAAAAAAAAAAAABaf39/MAAAAAAAAE5/f39AAAAAAAAAAAAAAAAAAAAAAFp/f38wAAAAAAAATn9/f0AAAAAAAAAAAAAAAAAAAAAAWn9/fzAAAAAAAABOf39/QAAAAAAAAAAAAAAAAAAAAABaf39/MAAAAAAAAE5/f39AAAAAAAAAAAAAAAAAAAAAAFp/f38wAAAAAAAATn9/f0AAAAAAAAAAAAAAAAAAAAAAWn9/fzAAAAAAAABOf39/QAAAAAAAAAAAAAAAAAAAAABaf39/MAAAAAAAAE5/f39AAAAAAAAAAAAAAAAAAAAAAFp/f38wAAAAAAAATn9/f0AAAAAAAAAAAAAAAAAAAAAAWn9/fzAAAAAAAABOf39/QAAAAAAAAAAAAAAAAAAAAABaf39/MAAAAAAAAE5/f39AAAAAAAAAAAAAAAAAAAAAAFp/f38wAAAAAAAATX9/f0EAAAAAAAAAAAAAAAAAAAAAXX9/fy4AAAAAAABJf39/SQAAAAAAAAAAAAAAAAAAAABmf39/KAAAAAAAAEB/f39WAAAAAAAAAAAAAAAAAAAAAHd/f38bAAAAAAAAK39/f3MAAAAAAAAAAAAAAAAAAAAYf39/fgUAAAAAAAAMf39/fyAAAAAAAAAAAAAAAAAAAEt/f39gAAAAAAAAAABff39/YQEAAAAAAAAAAAAAAAAXfH9/fzEAAAAAAAAAACF/f39/SAAAAAAAAAAAAAAAEXB/f39tAgAAAAAAAAAAAFB/f39/WxUAAAAAAAAABDV4f39/fh0AAAAAAAAAAAAABWF/f39/f2NENCwxO1V2f39/f38vAAAAAAAAAAAAAAAABVJ/f39/f39/f39/f39/f392JQAAAAAAAAAAAAAAAAAAACVmf39/f39/f39/f395RwkAAAAAAAAAAAAAAAAAAAAAAAAYPltueX57dGNMKwUAAAAAAAAAAAAA" }, ["86"]: { ["w"]: 30, ["h"]: 30, ["adv"]: 29, ["left"]: 0, ["top"]: 30, ["cov"]: "Tn9/f1sAAAAAAAAAAAAAAAAAAAAAAAAALX9/f3UDGX9/f34PAAAAAAAAAAAAAAAAAAAAAAAAYH9/f0QAAGR/f39AAAAAAAAAAAAAAAAAAAAAAAASf39/fhEAAC9/f39xAQAAAAAAAAAAAAAAAAAAAABFf39/WwAAAAR2f39/JgAAAAAAAAAAAAAAAAAAAAJ0f39/JgAAAABGf39/WQAAAAAAAAAAAAAAAAAAACp/f39wAQAAAAASf39/fg0AAAAAAAAAAAAAAAAAAFx/f389AAAAAAAAXH9/fz8AAAAAAAAAAAAAAAAAEH5/f3wLAAAAAAAAKH9/f3ABAAAAAAAAAAAAAAAAQX9/f1MAAAAAAAAAAXF/f38kAAAAAAAAAAAAAAABcn9/fx4AAAAAAAAAAD5/f39XAAAAAAAAAAAAAAAmf39/aQAAAAAAAAAAAAx9f399DAAAAAAAAAAAAABZf39/NQAAAAAAAAAAAABVf39/PQAAAAAAAAAAAA1+f395BwAAAAAAAAAAAAAgf39/bwAAAAAAAAAAAD5/f39LAAAAAAAAAAAAAAAAa39/fyIAAAAAAAAAAW9/f38XAAAAAAAAAAAAAAAAN39/f1UAAAAAAAAAI39/f2IAAAAAAAAAAAAAAAAAB3p/f30LAAAAAAAAVn9/fy0AAAAAAAAAAAAAAAAAAE1/f387AAAAAAALfX9/dQMAAAAAAAAAAAAAAAAAABh/f39tAAAAAAA7f39/RAAAAAAAAAAAAAAAAAAAAABkf39/IAAAAABtf39+EAAAAAAAAAAAAAAAAAAAAAAvf39/UwAAACB/f39aAAAAAAAAAAAAAAAAAAAAAAAEdn9/fAcAAE9/f38mAAAAAAAAAAAAAAAAAAAAAAAARX9/fy8AA3h/f3ABAAAAAAAAAAAAAAAAAAAAAAAAEX9/f1sAJ39/fzwAAAAAAAAAAAAAAAAAAAAAAAAAAFx/f30JU39/fAsAAAAAAAAAAAAAAAAAAAAAAAAAACd/f383en9/UwAAAAAAAAAAAAAAAAAAAAAAAAAAAAFxf395f39/HgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+f39/f39pAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALfX9/f380AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVH9/f3kGAAAAAAAAAAAAAAAA" }, ["87"]: { ["w"]: 42, ["h"]: 30, ["adv"]: 42, ["left"]: 0, ["top"]: 30, ["cov"]: "VX9/f04AAAAAAAAAAAAAAAAAJn9/f3QAAAAAAAAAAAAAAAAABn1/f38cL39/f3IAAAAAAAAAAAAAAAAAS39/f38aAAAAAAAAAAAAAAAAKH9/f3UBCn5/f38XAAAAAAAAAAAAAAAAb39/f38+AAAAAAAAAAAAAAAATH9/f1AAAGN/f387AAAAAAAAAAAAAAAUf39/f39iAAAAAAAAAAAAAAAAcH9/fyoAAD1/f39gAAAAAAAAAAAAAAA4f396f39+CAAAAAAAAAAAAAAUf39/fQcAABd/f399BwAAAAAAAAAAAABcf39Oe39/KgAAAAAAAAAAAAA5f39/XgAAAABwf39/KQAAAAAAAAAAAAV7f38uYn9/TgAAAAAAAAAAAABdf39/OAAAAABKf39/TgAAAAAAAAAAACV/f38RRX9/cQAAAAAAAAAAAAV8f39/EgAAAAAkf39/cgAAAAAAAAAAAEl/f3MAKH9/fxYAAAAAAAAAACV/f39sAAAAAAAEen9/fxcAAAAAAAAAAG5/f1MACn9/fzoAAAAAAAAAAEl/f39GAAAAAAAAWH9/fzsAAAAAAAAAEn9/fzEAAGh/f14AAAAAAAAAAGx/f38gAAAAAAAAMn9/f2AAAAAAAAAANn9/fw8AAEV/f3wFAAAAAAAAEX9/f3gCAAAAAAAADH9/f30HAAAAAAAAWn9/bAAAACJ/f38mAAAAAAAANX9/f1QAAAAAAAAAAGZ/f38pAAAAAAADen9/SQAAAAN6f39KAAAAAAAAWX9/fy4AAAAAAAAAAEB/f39OAAAAAAAif39/JgAAAABbf39uAAAAAAACeX9/fgoAAAAAAAAAABp/f39yAAAAAABGf399BgAAAAA4f39/EgAAAAAgf39/YgAAAAAAAAAAAABzf39/FwAAAABpf39gAAAAAAAVf39/NgAAAABEf39/PAAAAAAAAAAAAABOf39/OwAAAA1/f389AAAAAAAAcX9/WgAAAABnf39/FgAAAAAAAAAAAAAof39/YAAAADF/f38ZAAAAAAAATn9/egMAAAt/f39wAAAAAAAAAAAAAAAFfH9/fQUAAFR/f3UAAAAAAAAAK39/fx8AAC5/f39KAAAAAAAAAAAAAAAAXH9/fyEAAHV/f1IAAAAAAAAACX5/f0AAAFF/f38kAAAAAAAAAAAAAAAANn9/f0AAFn9/fy8AAAAAAAAAAGR/f2EAAHJ/f3oEAAAAAAAAAAAAAAAAD39/f18ANX9/fwwAAAAAAAAAAEF/f3wEEX9/f1gAAAAAAAAAAAAAAAAAAGl/f3sDU39/aAAAAAAAAAAAAB1/f38gL39/fzIAAAAAAAAAAAAAAAAAAEN/f38dcX9/RQAAAAAAAAAAAAJ4f38+T39/fw0AAAAAAAAAAAAAAAAAAB1/f39Kf39/IQAAAAAAAAAAAABXf39cbX9/ZgAAAAAAAAAAAAAAAAAAAAF2f397f396AwAAAAAAAAAAAAAzf397f39/QAAAAAAAAAAAAAAAAAAAAABRf39/f39aAAAAAAAAAAAAAAAQf39/f39/GgAAAAAAAAAAAAAAAAAAAAArf39/f382AAAAAAAAAAAAAAAAbX9/f39zAAAAAAAAAAAAAAAAAAAAAAAHfX9/f38TAAAAAAAAAAAAAAAASX9/f39OAAAAAAAAAAAA" }, ["88"]: { ["w"]: 29, ["h"]: 30, ["adv"]: 29, ["left"]: 0, ["top"]: 30, ["cov"]: "AAFff39/YAEAAAAAAAAAAAAAAAAAACp/f399GgAAAA11f39/PQAAAAAAAAAAAAAAAAAMdn9/fzoAAAAAACV/f399GwAAAAAAAAAAAAAAAFt/f39cAAAAAAAAAEZ/f39tBgAAAAAAAAAAAAA1f39/dAsAAAAAAAAAAmR/f39PAAAAAAAAAAAAE3p/f38kAAAAAAAAAAAAEHh/f38rAAAAAAAAAAJlf39/RgAAAAAAAAAAAAAAK39/f3cOAAAAAAAAQH9/f2YDAAAAAAAAAAAAAAAATX9/f2ABAAAAABt9f395EgAAAAAAAAAAAAAAAAAEaX9/fz0AAAAFbH9/fy8AAAAAAAAAAAAAAAAAAAAVen9/fRsAAEt/f39SAAAAAAAAAAAAAAAAAAAAAAAyf39/bgYkf39/bgcAAAAAAAAAAAAAAAAAAAAAAABTf39/VXN/f30bAAAAAAAAAAAAAAAAAAAAAAAAAAduf39/f39/PAAAAAAAAAAAAAAAAAAAAAAAAAAAABp8f39/f14BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFh/f39/MwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmf39/f394EAAAAAAAAAAAAAAAAAAAAAAAAAAADnZ/f35/f39iAQAAAAAAAAAAAAAAAAAAAAAAAAFhf39/MGJ/f38/AAAAAAAAAAAAAAAAAAAAAAAAQn9/f1QAEXl/f34cAAAAAAAAAAAAAAAAAAAAACF+f39xCAAAMn9/f28HAAAAAAAAAAAAAAAAAAALc39/fiAAAAAAWX9/f1EAAAAAAAAAAAAAAAAAAFx/f39EAAAAAAALdX9/fywAAAAAAAAAAAAAAAA8f39/ZgIAAAAAAAAof39/eA8AAAAAAAAAAAAAHX1/f3oUAAAAAAAAAABPf39/YgEAAAAAAAAAAAhwf39/NAAAAAAAAAAAAAZvf39/PwAAAAAAAAAAV39/f1kAAAAAAAAAAAAAAB5+f399HAAAAAAAADd/f390CgAAAAAAAAAAAAAAAEV/f39uBgAAAAAZfH9/fyQAAAAAAAAAAAAAAAAAA2h/f39RAAAABm1/f39JAAAAAAAAAAAAAAAAAAAAF3x/f38sAABSf39/agQAAAAAAAAAAAAAAAAAAAAAOn9/f3gP" }, ["89"]: { ["w"]: 29, ["h"]: 30, ["adv"]: 29, ["left"]: 0, ["top"]: 30, ["cov"]: "AFl/f39lAQAAAAAAAAAAAAAAAAAAAAA5f39/dw0ADXd/f386AAAAAAAAAAAAAAAAAAAAEHp/f38wAAAAMH9/f3sRAAAAAAAAAAAAAAAAAABdf39/WgAAAAAAW39/f18AAAAAAAAAAAAAAAAAMH9/f3gNAAAAAAAOeH9/fzIAAAAAAAAAAAAAAAt3f39/MAAAAAAAAAAxf39/eA0AAAAAAAAAAAAAVX9/f1sAAAAAAAAAAABcf39/WAAAAAAAAAAAACd/f394DQAAAAAAAAAAAA54f39/KgAAAAAAAAAHcn9/fzEAAAAAAAAAAAAAADN/f390CQAAAAAAAEx/f39bAAAAAAAAAAAAAAAAAF1/f39QAAAAAAAff39/eA4AAAAAAAAAAAAAAAAAD3l/f38jAAAABGx/f38xAAAAAAAAAAAAAAAAAAAANH9/f3AFAABDf39/XAAAAAAAAAAAAAAAAAAAAAAAX39/f0gAGH1/f3gOAAAAAAAAAAAAAAAAAAAAAAAQen9/fh5mf39/MQAAAAAAAAAAAAAAAAAAAAAAAAA2f39/en9/f1wAAAAAAAAAAAAAAAAAAAAAAAAAAABgf39/f394DgAAAAAAAAAAAAAAAAAAAAAAAAAAABF6f39/fzIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD9/f39lAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/WAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/WAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/WAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMn9/f1gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyf39/WAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ/f39YAAAAAAAAAAAAAAAA" }, ["90"]: { ["w"]: 27, ["h"]: 30, ["adv"]: 27, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAEf39/f39/f39/f39/f39/f39/f39/QAAAAAAEf39/f39/f39/f39/f39/f39/f39/QAAAAAAEf39/f39/f39/f39/f39/f39/f39/QAAAAAABLi4uLi4uLi4uLi4uLi4uLlB/f395FAAAAAAAAAAAAAAAAAAAAAAAAAAAEXd/f38qAAAAAAAAAAAAAAAAAAAAAAAAAAAEZ39/f0YAAAAAAAAAAAAAAAAAAAAAAAAAAABQf39/YAIAAAAAAAAAAAAAAAAAAAAAAAAAADV/f39yCwAAAAAAAAAAAAAAAAAAAAAAAAAAG3x/f30dAAAAAAAAAAAAAAAAAAAAAAAAAAALcX9/fzcAAAAAAAAAAAAAAAAAAAAAAAAAAAFff39/UwAAAAAAAAAAAAAAAAAAAAAAAAAAAEV/f39pBQAAAAAAAAAAAAAAAAAAAAAAAAAAKn9/f3gSAAAAAAAAAAAAAAAAAAAAAAAAAAAUeX9/fygAAAAAAAAAAAAAAAAAAAAAAAAAAAZrf39/QwAAAAAAAAAAAAAAAAAAAAAAAAAAAFV/f39eAQAAAAAAAAAAAAAAAAAAAAAAAAAAOn9/f3EKAAAAAAAAAAAAAAAAAAAAAAAAAAAgfn9/fBsAAAAAAAAAAAAAAAAAAAAAAAAAAA10f39/NAAAAAAAAAAAAAAAAAAAAAAAAAAAA2N/f39QAAAAAAAAAAAAAAAAAAAAAAAAAAAAS39/f2gEAAAAAAAAAAAAAAAAAAAAAAAAAAAvf39/dxEAAAAAAAAAAAAAAAAAAAAAAAAAABd7f39/JgAAAAAAAAAAAAAAAAAAAAAAAAAACG5/f39BAAAAAAAAAAAAAAAAAAAAAAAAAAAAWn9/f1wBAAAAAAAAAAAAAAAAAAAAAAAAAABAf39/cAkAAAAAAAAAAAAAAAAAAAAAAAAAACR+f39/Ry4uLi4uLi4uLi4uLi4uLi4uLhcAAE5/f39/f39/f39/f39/f39/f39/f39/f0AAAE5/f39/f39/f39/f39/f39/f39/f39/f0AAAE5/f39/f39/f39/f39/f39/f39/f39/f0AA" }, ["91"]: { ["w"]: 12, ["h"]: 41, ["adv"]: 12, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAAbn9/f39/f39wAAAAbn9/f39/f39wAAAAbn9/fGJiYmJVAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/cAAAAAAAAAAAbn9/fGJiYmJVAAAAbn9/f39/f39wAAAAbn9/f39/f39w" }, ["92"]: { ["w"]: 13, ["h"]: 32, ["adv"]: 12, ["left"]: 0, ["top"]: 32, ["cov"]: "bn9/QwAAAAAAAAAAAEx/f2YAAAAAAAAAAAApf39/CgAAAAAAAAAAB35/fy0AAAAAAAAAAABjf39QAAAAAAAAAAAAQH9/cwAAAAAAAAAAAB1/f38XAAAAAAAAAAABeH9/OgAAAAAAAAAAAFd/f10AAAAAAAAAAAA0f398BQAAAAAAAAAAEX9/fyQAAAAAAAAAAABuf39HAAAAAAAAAAAAS39/awAAAAAAAAAAACh/f38OAAAAAAAAAAAHfX9/MQAAAAAAAAAAAGJ/f1UAAAAAAAAAAABAf392AQAAAAAAAAAAHX9/fxsAAAAAAAAAAAF4f38/AAAAAAAAAAAAV39/YgAAAAAAAAAAADR/f30HAAAAAAAAAAAQf39/KQAAAAAAAAAAAG5/f0wAAAAAAAAAAABLf39vAAAAAAAAAAAAKH9/fxIAAAAAAAAAAAd9f382AAAAAAAAAAAAYn9/WQAAAAAAAAAAAD9/f3kDAAAAAAAAAAAcf39/IAAAAAAAAAAAAXd/f0MAAAAAAAAAAABWf39mAAAAAAAAAAAAM39/fws=" }, ["93"]: { ["w"]: 12, ["h"]: 41, ["adv"]: 12, ["left"]: 0, ["top"]: 32, ["cov"]: "VH9/f39/f39/DAAAVH9/f39/f39/DAAAQGJiYmJ1f39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAAAAAAABUf39/DAAAQGJiYmJ1f39/DAAAVH9/f39/f39/DAAAVH9/f39/f39/DAAA" }, ["94"]: { ["w"]: 21, ["h"]: 30, ["adv"]: 21, ["left"]: 0, ["top"]: 30, ["cov"]: "AAAAAAAAABF+f39/XQAAAAAAAAAAAAAAAAAAAE9/f39/fx0AAAAAAAAAAAAAAAAAEH1/fl1/f1wAAAAAAAAAAAAAAAAATX9/VBF+f38cAAAAAAAAAAAAAAAPfX9/GABSf39cAAAAAAAAAAAAAABMf39aAAAVf39/GwAAAAAAAAAAAA58f38dAAAAVn9/WwAAAAAAAAAAAEp/f2AAAAAAGX9/fxsAAAAAAAAADXx/fyMAAAAAAFt/f1oAAAAAAAAASX9/ZgAAAAAAAB1/f38aAAAAAAAMe39/KQAAAAAAAABff39ZAAAAAABHf39rAQAAAAAAAAAif39/GQAAAAt7f38vAAAAAAAAAAAAZH9/WQAAAEZ/f3ACAAAAAAAAAAAAJn9/fxkACnp/fzUAAAAAAAAAAAAAAGh/f1gARH9/dAQAAAAAAAAAAAAAACt/f38YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["95"]: { ["w"]: 26, ["h"]: 9, ["adv"]: 24, ["left"]: -1, ["top"]: 0, ["cov"]: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVn9/f39/f39/f39/f39/f39/f39/f39/f3xWf39/f39/f39/f39/f39/f39/f39/f39/fERmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZi" }, ["96"]: { ["w"]: 15, ["h"]: 33, ["adv"]: 15, ["left"]: 0, ["top"]: 33, ["cov"]: "AABTf39/eBAAAAAAAAAAAAAGXX9/f2IBAAAAAAAAAAAAAlF/f39AAAAAAAAAAAAAAABEf39+HQAAAAAAAAAAAAAAN35/bwcAAAAAAAAAAAAAACp8f1IAAAAAAAAAAAAAAAAfeH8kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, ["97"]: { ["w"]: 25, ["h"]: 24, ["adv"]: 24, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAAAAAAAB5HYXN6fXVoTicBAAAAAAAAAAAAAAAAF2N/f39/f39/f39/bBoAAAAAAAAAAAAAH3l/f39/f3x7f39/f398HwAAAAAAAAAACXN/f39mKAkAAAYlYn9/f3QFAAAAAAAAAD5/f39mBAAAAAAAAAFff39/OQAAAAAAAABrf39/JQAAAAAAAAAAHX9/f14AAAAAAAACVWJueQQAAAAAAAAAAAJ8f392AAAAAAAAAAAAAAAAAAAAAAAAAAAAcn9/fgEAAAAAAAAAAAAAAAAAAAAAAAAAAHB/f38EAAAAAAAAAAAABSpFW2ZwdXd5fH5/f39/BAAAAAAAAAAHSXp/f39/f39/f39/f39/fwQAAAAAAAARcX9/f39/e29oZGFfXHt/f38EAAAAAAADbX9/f3pCFQEAAAAAAABwf39/BAAAAAAAOX9/f3YVAAAAAAAAAAAAcH9/fwQAAAAAAGV/f38xAAAAAAAAAAAAAHx/f38EAAAAAAF+f39+BAAAAAAAAAAAABF/f39/BAAAAAALf39/cgAAAAAAAAAAAABAf39/fwQAAAAAC39/f3AAAAAAAAAAAAAIc39/f38EAAAAAAJ8f39+CAAAAAAAAAAAVn9/f39/CQAAAAAAYn9/fz8AAAAAAAAFVH9uYX9/fxcAAAAAADN/f39+QAoAARA6b39+IEt/f39GAAAAAAADZn9/f39/d31/f39/NAArf39/f19QKgAAAA1mf39/f39/f392KgAAA2p/f39/fzwAAAAAAi9Zcnx8cVo1BgAAAAAMUHR+eGop" }, ["98"]: { ["w"]: 24, ["h"]: 32, ["adv"]: 24, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/aQAAAypXa3h6b1gxAwAAAAAAAAAEf39/aAAab39/f39/f39/bBsAAAAAAAAEf39/ZhR5f39/f39/f39/f3gYAAAAAAAEf39/Y2V/dzwVBAMVQXx/f39qAQAAAAAEf39/fX9tDAAAAAAAAB58f39/LwAAAAAEf39/f34WAAAAAAAAAABFf39/XQAAAAAEf39/f1YAAAAAAAAAAAAQf39/fQcAAAAEf39/fy4AAAAAAAAAAAAAbX9/fx4AAAAEf39/fxEAAAAAAAAAAAAAV39/fzIAAAAEf39/fQEAAAAAAAAAAAAAR39/f0EAAAAEf39/cgAAAAAAAAAAAAAAP39/f0cAAAAEf39/bQAAAAAAAAAAAAAAOn9/f00AAAAEf39/awAAAAAAAAAAAAAAOn9/f0wAAAAEf39/cAAAAAAAAAAAAAAAP39/f0YAAAAEf39/eAAAAAAAAAAAAAAARn9/fz8AAAAEf39/fwoAAAAAAAAAAAAAVn9/fy4AAAAEf39/fyQAAAAAAAAAAAAAbH9/fxkAAAAEf39/f0oAAAAAAAAAAAANf39/egQAAAAEf39/f3oKAAAAAAAAAABBf39/VQAAAAAEf39/f39dAwAAAAAAABZ6f39/JAAAAAAEf39/ZGt/aSgEAAAHM3d/f39fAAAAAAAGf39/XBl6f39+dHN+f39/f3IPAAAAAAAJf39/VgAdcX9/f39/f39/ZRMAAAAAAAAPf39/TgAABCxYbHl6b1YsAQAAAAAA" }, ["99"]: { ["w"]: 22, ["h"]: 24, ["adv"]: 22, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAAAAAAABU/YXF7em9WMQUAAAAAAAAAAAAACU5+f39/f39/f391LAAAAAAAAAAADGp/f39/f39/f39/f39BAAAAAAAAAmd/f39vNBMHCyFUf39/fy4AAAAAAD1/f39gBQAAAAAAAD5/f390BQAAAAN2f397DAAAAAAAAAAAY39/fzAAAAAsf39/TgAAAAAAAAAAADZ4b2U6AAAAT39/fyoAAAAAAAAAAAAAAAAAAAAAAGh/f38TAAAAAAAAAAAAAAAAAAAAAAB8f39/AwAAAAAAAAAAAAAAAAAAAAAFf39/egAAAAAAAAAAAAAAAAAAAAAADH9/f3UAAAAAAAAAAAAAAAAAAAAAAAx/f393AAAAAAAAAAAAAAAAAAAAAAAFf39/fAAAAAAAAAAAAAAAAAAAAAAAAHx/f38HAAAAAAAAAAAAAAAAAAAAAABof39/GgAAAAAAAAAAAAAAAAAAAAAAT39/fzgAAAAAAAAAAAAUenJpSgAAACx/f39gAAAAAAAAAAAANH9/f0oAAAAEd39/fyAAAAAAAAAAAWl/f38iAAAAAD9/f39yEQAAAAAAAEl/f39qAAAAAAADaX9/f3lAGAkNKGF/f39+HgAAAAAAAA5sf39/f39/f39/f39/LwAAAAAAAAAAClB/f39/f39/f39wIQAAAAAAAAAAAAAAFT9icXt6b1UuAgAAAAAA" }, ["100"]: { ["w"]: 24, ["h"]: 32, ["adv"]: 24, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAE0JmdHxxZEASAAAuf39/QAAAAAAAAAA/fH9/f39/f39+RgEtf39/QAAAAAAAAEV/f39/f3lxen9/f04rf39/QAAAAAAAJH9/f39XGAAAABZJfn9Tf39/QAAAAAAAaH9/f04AAAAAAAAAKH5/f39/QAAAAAAaf39/dwYAAAAAAAAAAEp/f39/QAAAAABCf39/SQAAAAAAAAAAAA9/f39/QAAAAABef39/KAAAAAAAAAAAAABnf39/QAAAAABzf39/EgAAAAAAAAAAAABPf39/QAAAAAR/f39/AwAAAAAAAAAAAAA8f39/QAAAAAp/f396AAAAAAAAAAAAAAA1f39/QAAAABB/f391AAAAAAAAAAAAAAAvf39/QAAAABF/f392AAAAAAAAAAAAAAAyf39/QAAAAAx/f396AAAAAAAAAAAAAAA3f39/QAAAAAV/f39/AwAAAAAAAAAAAABEf39/QAAAAAB3f39/EgAAAAAAAAAAAABXf39/QAAAAABjf39/KAAAAAAAAAAAAAB0f39/QAAAAABKf39/SgAAAAAAAAAAAB5/f39/QAAAAAAjf39/eAcAAAAAAAAAAF1/f39/QAAAAAACcn9/f1MBAAAAAAAAQX99f39/QAAAAAAAMn9/f39hJggBCyhef39Ff39/QAAAAAAAAVV/f39/f39/f39/f0kef39/QgAAAAAAAANMf39/f39/f39/RgEYf39/RQAAAAAAAAAAGUdpdnxyZEETAAAOf39/TAAA" }, ["101"]: { ["w"]: 24, ["h"]: 24, ["adv"]: 24, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAAAAAAAAs1WG13fHJnSSMAAAAAAAAAAAAAAAADQXp/f39/f39/f39mHQAAAAAAAAAAAAdgf39/f392cXt/f39/fCkAAAAAAAAAAF1/f393OgwAAAEdWH9/f34bAAAAAAAANn9/f3ESAAAAAAAAAD5/f39oAgAAAAACc39/fx0AAAAAAAAAAABdf39/JwAAAAAqf39/WgAAAAAAAAAAAAAff39/VwAAAABNf39/LQAAAAAAAAAAAAAAdn9/egEAAABpf39/EAAAAAAAAAAAAAAAWX9/fxQAAAB8f39/AgAAAAAAAAAAAAAAR39/fyoAAAV/f39/f39/f39/f39/f39/f39/fzQAAA1/f39/f39/f39/f39/f39/f39/fzsAAAt/f39/fHx8fHx8fHx8fHx8fHx8fD8AAAN/f397AAAAAAAAAAAAAAAAAAAAAAAAAAB6f39/AwAAAAAAAAAAAAAAAAAAAAAAAABlf39/FgAAAAAAAAAAAAAAAAAAAAAAAABKf39/MgAAAAAAAAAAAAAAAAAAAAAAAAAmf39/YAAAAAAAAAAAAAAAAAAAAAAAAAABcX9/fyUAAAAAAAAAAAABYl48GQAAAAAANX9/f3YXAAAAAAAAAANOf39/SgAAAAAAAF1/f397QxUAAAIPNmp/f39zCgAAAAAAAAdff39/f399dn9/f39/f3UZAAAAAAAAAAADQHl/f39/f39/f39/WA4AAAAAAAAAAAAAAAozVm13fnpvXD4UAAAAAAAA" }, ["102"]: { ["w"]: 13, ["h"]: 32, ["adv"]: 12, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAAAAAEOGJ3fnpuHAAAAAAGZ39/f39/fyYAAAAAQ39/f39/f38mAAAAAG9/f39ZGAgQBwAAAAV/f395BAAAAAAAAAAMf39/ZAAAAAAAAAAADn9/f2AAAAAAAAAAAA5/f39gAAAAAAAwf39/f39/f39/f38mMH9/f39/f39/f39/JidoaGp/f396aGhoaB4AAAAOf39/YAAAAAAAAAAADn9/f2AAAAAAAAAAAA5/f39gAAAAAAAAAAAOf39/YAAAAAAAAAAADn9/f2AAAAAAAAAAAA5/f39gAAAAAAAAAAAOf39/YAAAAAAAAAAADn9/f2AAAAAAAAAAAA5/f39gAAAAAAAAAAAOf39/YAAAAAAAAAAADn9/f2AAAAAAAAAAAA5/f39gAAAAAAAAAAAOf39/YAAAAAAAAAAADn9/f2AAAAAAAAAAAA5/f39gAAAAAAAAAAAOf39/YAAAAAAAAAAADn9/f2AAAAAAAAAAAA5/f39gAAAAAAAAAAAOf39/YAAAAAAAAAAADn9/f2AAAAAAAAAAAA5/f39gAAAAAAA=" }, ["103"]: { ["w"]: 24, ["h"]: 33, ["adv"]: 24, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAAAAAAEUBkc314ZD4KAAAPf39/TAAAAAAAAAA+fH9/f39/f395JwAYf39/RgAAAAAAAEd/f39/f3xze39/fjEff39/QgAAAAAAJn9/f39cHQAAAiVpf3o0f39/QAAAAAAAa39/f1EAAAAAAAAFY393f39/QAAAAAAcf39/dgYAAAAAAAAACHV/f39/QAAAAABEf39/RwAAAAAAAAAAADp/f39/QAAAAABff39/JAAAAAAAAAAAAAd9f39/QAAAAAB0f39/DAAAAAAAAAAAAABjf39/QAAAAAR/f397AAAAAAAAAAAAAABGf39/QAAAAAp/f39zAAAAAAAAAAAAAAA7f39/QAAAABB/f39uAAAAAAAAAAAAAAAxf39/QAAAABJ/f39tAAAAAAAAAAAAAAAwf39/QAAAAAx/f39yAAAAAAAAAAAAAAA5f39/QAAAAAd/f395AAAAAAAAAAAAAABEf39/QAAAAAB6f39/CAAAAAAAAAAAAABff39/QAAAAABnf39/HQAAAAAAAAAAAAR8f39/QAAAAABQf39/PQAAAAAAAAAAADV/f39/QAAAAAArf39/bQEAAAAAAAAABnJ/f39/QAAAAAAHeX9/fz4AAAAAAAAEX39yf39/QAAAAAAAQH9/f39OFAAAASJmf3U2f39/QAAAAAAABWR/f39/f3hwen9/eyAsf39/QAAAAAAAAAlbf39/f39/f39uHAAsf39/QAAAAAAAAAAAJFBteX1yWjADAAAuf39/OwAAAAAAAAAAAAAAAAAAAAAAAAA1f39/MwAAAAAAAAAAAAAAAAAAAAAAAABIf39/JwAAAAAAAAANFgAAAAAAAAAAAABof39/CwAAAAAHZ3p/ewkAAAAAAAAAAB9/f39pAAAAAAAAY39/f1YCAAAAAAAADm5/f38yAAAAAAAAIH9/f39kKwsAAA83dH9/f2YDAAAAAAAAADt/f39/f398fX9/f39/cBAAAAAAAAAAAAArc39/f39/f39/f39WCgAAAAAAAAAAAAAABS1Sanh+eXFeQBQAAAAAAAAA" }, ["104"]: { ["w"]: 24, ["h"]: 32, ["adv"]: 24, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAAen9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAAAAAAAAAAAAAen9/dAAAACFQbHp9dGFACwAAAAAAAAAAen9/cQAHWH9/f39/f39/eiwAAAAAAAAAen9/bQRjf39/f39/f39/f34eAAAAAAAAen9/Z0p/eD4UAwQTPHp/f39kAAAAAAAAen9/dX5uEAAAAAAAAB9/f39/EgAAAAAAen9/f3wXAAAAAAAAAABaf39/LQAAAAAAen9/f04AAAAAAAAAAAA6f39/QAAAAAAAen9/fyAAAAAAAAAAAAAsf39/SAAAAAAAen9/fwYAAAAAAAAAAAAmf39/TQAAAAAAen9/egAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAA" }, ["105"]: { ["w"]: 10, ["h"]: 32, ["adv"]: 10, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAIf39/aAAAAAAACH9/f2gAAAAAAAh/f39oAAAAAAAFWlpaSQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAh/f39oAAAAAAAIf39/aAAAAAAACH9/f2gAAAAAAAh/f39oAAAAAAAIf39/aAAAAAAACH9/f2gAAAAAAAh/f39oAAAAAAAIf39/aAAAAAAACH9/f2gAAAAAAAh/f39oAAAAAAAIf39/aAAAAAAACH9/f2gAAAAAAAh/f39oAAAAAAAIf39/aAAAAAAACH9/f2gAAAAAAAh/f39oAAAAAAAIf39/aAAAAAAACH9/f2gAAAAAAAh/f39oAAAAAAAIf39/aAAAAAAACH9/f2gAAAAAAAh/f39oAAAAAAAIf39/aAAAAAAACH9/f2gAAAA=" }, ["106"]: { ["w"]: 12, ["h"]: 41, ["adv"]: 10, ["left"]: -2, ["top"]: 32, ["cov"]: "AAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAVaWlpJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAh/f39oAAAAAAAAAAp/f39nAAAAAAAAABN/f39hAAAAAAAAAC9/f39VAAAAAQ8LJ3J/f388AAAACn9/f39/f30QAAAACn9/f39/fzoAAAAACHB7fndeJgAAAAAA" }, ["107"]: { ["w"]: 23, ["h"]: 32, ["adv"]: 22, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAR/f39qAAAAAAAAAAAAAAAAAAAAAAAABH9/f2oAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAR/f39qAAAAAAAAAAAAAAAAAAAAAAAABH9/f2oAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAR/f39qAAAAAAAAAAAAAAAAAAAAAAAABH9/f2oAAAAAAAAAAAA0f39/eBcAAAAEf39/agAAAAAAAAAAJX5/f3seAAAAAAR/f39qAAAAAAAAABp6f39+JwAAAAAABH9/f2oAAAAAAAAQdH9/fzAAAAAAAAAEf39/agAAAAAACGt/f386AAAAAAAAAAR/f39qAAAAAANhf39/RQAAAAAAAAAABH9/f2oAAAAAVH9/f1AAAAAAAAAAAAAEf39/agAAAEV/f39ZAgAAAAAAAAAAAAR/f39qAAA1f39/YQQAAAAAAAAAAAAABH9/f2oAJ35/f2kIAAAAAAAAAAAAAAAEf39/aht6f39/LQAAAAAAAAAAAAAAAAR/f390dH9/f390CwAAAAAAAAAAAAAABH9/f39/f39/f39cAAAAAAAAAAAAAAAEf39/f390KHR/f385AAAAAAAAAAAAAAR/f39/ahAAJX9/f3wZAAAAAAAAAAAABH9/f3IHAAAASX9/f20GAAAAAAAAAAAEf39/agAAAAADaX9/f1AAAAAAAAAAAAR/f39qAAAAAAAVe39/fywAAAAAAAAABH9/f2oAAAAAAAA1f39/eBAAAAAAAAAEf39/agAAAAAAAABZf39/ZAIAAAAAAAR/f39qAAAAAAAAAApzf39/QwAAAAAABH9/f2oAAAAAAAAAACJ/f39+IAAAAAAEf39/agAAAAAAAAAAAEZ/f39yCQAAAAR/f39qAAAAAAAAAAAAA2Z/f39ZAA==" }, ["108"]: { ["w"]: 10, ["h"]: 32, ["adv"]: 10, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAEf39/agAAAAAABH9/f2oAAAAAAAR/f39qAAAAAAAEf39/agAAAAAABH9/f2oAAAAAAAR/f39qAAAAAAAEf39/agAAAAAABH9/f2oAAAAAAAR/f39qAAAAAAAEf39/agAAAAAABH9/f2oAAAAAAAR/f39qAAAAAAAEf39/agAAAAAABH9/f2oAAAAAAAR/f39qAAAAAAAEf39/agAAAAAABH9/f2oAAAAAAAR/f39qAAAAAAAEf39/agAAAAAABH9/f2oAAAAAAAR/f39qAAAAAAAEf39/agAAAAAABH9/f2oAAAAAAAR/f39qAAAAAAAEf39/agAAAAAABH9/f2oAAAAAAAR/f39qAAAAAAAEf39/agAAAAAABH9/f2oAAAAAAAR/f39qAAAAAAAEf39/agAAAAAABH9/f2oAAAA=" }, ["109"]: { ["w"]: 37, ["h"]: 24, ["adv"]: 37, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAFf39/TQAAAy1cb3x5aEUOAAAAAAAgUW57e3BUJAAAAAAAAAAAAH9/f1MAEWt/f39/f39/eiUAAARUf39/f39/f39SAgAAAAAAAAB8f39YCG9/f39/f39/f395DwFbf39/f39/f39/fz4AAAAAAAAAe39/XFF/ZSYIAQ84en9/f0o5f3k7EAEGImR/f396BQAAAAAAAHp/f3R/WAIAAAAAACt/f392eHYVAAAAAAAFcH9/fykAAAAAAAB6f39/dAcAAAAAAAAAc39/f38wAAAAAAAAAD5/f39CAAAAAAAAen9/f0AAAAAAAAAAAFd/f390AQAAAAAAAAAhf39/VAAAAAAAAHp/f38ZAAAAAAAAAABIf39/UAAAAAAAAAAAEn9/f1oAAAAAAAB6f39+AwAAAAAAAAAAQn9/fzkAAAAAAAAAAAx/f39fAAAAAAAAen9/dwAAAAAAAAAAAEB/f38vAAAAAAAAAAAKf39/YAAAAAAAAHp/f3IAAAAAAAAAAABAf39/KgAAAAAAAAAACn9/f2AAAAAAAAB6f39yAAAAAAAAAAAAQH9/fyoAAAAAAAAAAAp/f39gAAAAAAAAen9/cgAAAAAAAAAAAEB/f38qAAAAAAAAAAAKf39/YAAAAAAAAHp/f3IAAAAAAAAAAABAf39/KgAAAAAAAAAACn9/f2AAAAAAAAB6f39yAAAAAAAAAAAAQH9/fyoAAAAAAAAAAAp/f39gAAAAAAAAen9/cgAAAAAAAAAAAEB/f38qAAAAAAAAAAAKf39/YAAAAAAAAHp/f3IAAAAAAAAAAABAf39/KgAAAAAAAAAACn9/f2AAAAAAAAB6f39yAAAAAAAAAAAAQH9/fyoAAAAAAAAAAAp/f39gAAAAAAAAen9/cgAAAAAAAAAAAEB/f38qAAAAAAAAAAAKf39/YAAAAAAAAHp/f3IAAAAAAAAAAABAf39/KgAAAAAAAAAACn9/f2AAAAAAAAB6f39yAAAAAAAAAAAAQH9/fyoAAAAAAAAAAAp/f39gAAAAAAAAen9/cgAAAAAAAAAAAEB/f38qAAAAAAAAAAAKf39/YAAAAAAAAHp/f3IAAAAAAAAAAABAf39/KgAAAAAAAAAACn9/f2AAAAAAAAB6f39yAAAAAAAAAAAAQH9/fyoAAAAAAAAAAAp/f39gAAAA" }, ["110"]: { ["w"]: 24, ["h"]: 24, ["adv"]: 24, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAFf39/TQAAACJRbXp9dGFACwAAAAAAAAAAf39/UwAHWn9/f39/f39/eisAAAAAAAAAfH9/WARlf39/f39/f39/f34dAAAAAAAAe39/XEt/eD0UAwQROnp/f39jAAAAAAAAen9/dH5uDwAAAAAAAB9/f39/EgAAAAAAen9/f30XAAAAAAAAAABdf39/LQAAAAAAen9/f08AAAAAAAAAAAA8f39/QAAAAAAAen9/fyMAAAAAAAAAAAAsf39/SAAAAAAAen9/fwgAAAAAAAAAAAAmf39/TQAAAAAAen9/fAAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAAAAAAen9/dgAAAAAAAAAAAAAkf39/TgAA" }, ["111"]: { ["w"]: 24, ["h"]: 24, ["adv"]: 24, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAAAAAAABI7XG54fXRqTy8FAAAAAAAAAAAAAAAKT35/f39/f39/f390NgAAAAAAAAAAABFtf39/f393cXt/f39/f04CAAAAAAAABG1/f390NAsAAAAXS39/f38+AAAAAAAARn9/f20LAAAAAAAAACx/f398EwAAAAAHen9/fxoAAAAAAAAAAABRf39/RwAAAAAzf39/XAAAAAAAAAAAAAAYf39/dQEAAABUf39/NAAAAAAAAAAAAAAAcn9/fxQAAABuf39/GAAAAAAAAAAAAAAAWn9/fywAAAJ/f39/BQAAAAAAAAAAAAAASH9/fz0AAAl/f397AAAAAAAAAAAAAAAAQH9/f0UAABB/f392AAAAAAAAAAAAAAAAOn9/f0wAABB/f392AAAAAAAAAAAAAAAAO39/f0sAAAh/f397AAAAAAAAAAAAAAAAQH9/f0QAAAF+f39/BgAAAAAAAAAAAAAASn9/fzwAAABrf39/GQAAAAAAAAAAAAAAXX9/fygAAABRf39/NgAAAAAAAAAAAAABdn9/fw4AAAAuf39/XwAAAAAAAAAAAAAff39/bQAAAAAEd39/fxwAAAAAAAAAAABcf39/OgAAAAAAPn9/f24LAAAAAAAAADp/f391CQAAAAAAAmd/f39zMQcAAAEeVn9/f38nAAAAAAAAAAxpf39/f351cnx/f39/fjQAAAAAAAAAAAAIS31/f39/f39/f39oIQAAAAAAAAAAAAAAABE7XW95fHNmSCQAAAAAAAAA" }, ["112"]: { ["w"]: 24, ["h"]: 33, ["adv"]: 24, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAPf39/UAAABDNbcnx6b1gwAwAAAAAAAAAJf39/WAAZb39/f39/f39/bBsAAAAAAAAGf39/XhN4f39/f39/f39/f3gZAAAAAAAFf39/ZGJ/dD0WBgMVQ3x/f39rAgAAAAAEf39/fn9qCgAAAAAAAB99f39/MgAAAAAEf39/f34WAAAAAAAAAABFf39/XwAAAAAEf39/f1YAAAAAAAAAAAAPf39/fgkAAAAEf39/fywAAAAAAAAAAAAAbX9/fx8AAAAEf39/fxAAAAAAAAAAAAAAV39/fzQAAAAEf39/fAAAAAAAAAAAAAAARn9/f0EAAAAEf39/cQAAAAAAAAAAAAAAP39/f0cAAAAEf39/bAAAAAAAAAAAAAAAOn9/f00AAAAEf39/awAAAAAAAAAAAAAAOn9/f0wAAAAEf39/cAAAAAAAAAAAAAAAP39/f0UAAAAEf39/eAAAAAAAAAAAAAAAR39/fz8AAAAEf39/fwoAAAAAAAAAAAAAV39/fy4AAAAEf39/fyMAAAAAAAAAAAAAbH9/fxkAAAAEf39/f0kAAAAAAAAAAAAOf39/eQMAAAAEf39/f3kKAAAAAAAAAABCf39/VQAAAAAEf39/f39cAgAAAAAAABh6f39/JAAAAAAEf39/ZmZ/aCgEAAAHNHh/f39fAAAAAAAEf39/aBd6f39+dHN+f39/f3EOAAAAAAAEf39/aQAXbn9/f39/f39/ZRMAAAAAAAAEf39/aQAAAytYbHh6b1YrAQAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAAAAAEf39/agAAAAAAAAAAAAAAAAAAAAAA" }, ["113"]: { ["w"]: 24, ["h"]: 33, ["adv"]: 24, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAAAAAAE0JmdHxyZUITAAASf39/TgAAAAAAAAA/fH9/f39/f39/RwEcf39/SAAAAAAAAEV/f39/f3lxen9/f00if39/RAAAAAAAJH9/f39YGAAAABZLfn9Pf39/QgAAAAAAaH9/f04AAAAAAAAALH9/f39/QAAAAAAaf39/dwYAAAAAAAAAAE1/f39/QAAAAABCf39/SgAAAAAAAAAAABF/f39/QAAAAABef39/KAAAAAAAAAAAAABpf39/QAAAAABzf39/EgAAAAAAAAAAAABQf39/QAAAAAR/f39/AwAAAAAAAAAAAAA9f39/QAAAAAp/f396AAAAAAAAAAAAAAA1f39/QAAAABB/f391AAAAAAAAAAAAAAAvf39/QAAAABF/f392AAAAAAAAAAAAAAAyf39/QAAAAAx/f396AAAAAAAAAAAAAAA4f39/QAAAAAV/f39/AwAAAAAAAAAAAABFf39/QAAAAAB3f39/EgAAAAAAAAAAAABYf39/QAAAAABif39/KQAAAAAAAAAAAAF2f39/QAAAAABJf39/SwAAAAAAAAAAACJ/f39/QAAAAAAif39/eAcAAAAAAAAAAGF/f39/QAAAAAACcX9/f1UBAAAAAAAARn99f39/QAAAAAAAMX9/f39iJggBCylgf39Hf39/QAAAAAAAAVR/f39/f39/f39/f0Upf39/QAAAAAAAAANLf39/f39/f39/RAAsf39/QAAAAAAAAAAAGUdpdn54aEkXAAAtf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAAAAAAAAAAAAAAAAAAAAAAAAAuf39/QAAA" }, ["114"]: { ["w"]: 15, ["h"]: 24, ["adv"]: 15, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAIf39/TAAAI1x3e2MAAAAEf39/UQAwf39/f3YAAAAAf39/VQ16f39/f3YAAAAAfX9/WkZ/f2RLSU8AAAAAe39/YHV4IwAAAAAAAAAAen9/fX8pAAAAAAAAAAAAen9/f2UAAAAAAAAAAAAAen9/fzgAAAAAAAAAAAAAen9/fxkAAAAAAAAAAAAAen9/fwYAAAAAAAAAAAAAen9/fAAAAAAAAAAAAAAAen9/dwAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAen9/dgAAAAAAAAAAAAAAen9/dgAAAAAAAAAA" }, ["115"]: { ["w"]: 22, ["h"]: 24, ["adv"]: 22, ["left"]: 0, ["top"]: 24, ["cov"]: "AAAAAAAEK1BndXx9dmhRLQQAAAAAAAAAAAAsc39/f39/f39/f390LgAAAAAAAAA3f39/f39+eXt/f39/f387AAAAAAATfH9/fUYYAwAACCJTf39/fxgAAAAARX9/fzAAAAAAAAAAACt/f39SAAAAAF9/f3sCAAAAAAAAAAAAWn5wVwAAAABof396AAAAAAAAAAAAAAYCAAAAAAAAXH9/fycAAAAAAAAAAAAAAAAAAAAAADp/f396MwIAAAAAAAAAAAAAAAAAAAAHb39/f392US0MAAAAAAAAAAAAAAAAABRvf39/f39/f2tJJAIAAAAAAAAAAAAAB0l7f39/f39/f392RQkAAAAAAAAAAAAABzBYeX9/f39/f392IwAAAAAAAAAAAAAAAAIfQWN+f39/f3wcAAAAAAAAAAAAAAAAAAAACjt4f39/ZwAAAAAAAAAAAAAAAAAAAAAAFHl/f38WAAAAAAAAAAAAAAAAAAAAAABEf39/LAAAABIrMAAAAAAAAAAAAAAAMH9/fy8AAFB/f3sOAAAAAAAAAAAAAEF/f38hAAAof39/YgcAAAAAAAAAAA91f394BAAAAGR/f39yOxYDAAADFjx1f39/PwAAAAAOcX9/f39/f3p6f39/f39/VwIAAAAAAAtWf39/f39/f39/f394OgEAAAAAAAAAABM7WWx4fXx2aFEuBgAAAAAA" }, ["116"]: { ["w"]: 12, ["h"]: 29, ["adv"]: 12, ["left"]: 0, ["top"]: 29, ["cov"]: "AAAAADx/fxwAAAAAAAAAAFl/fxwAAAAAAAAAAHV/fxwAAAAAAAAAE39/fxwAAAAAAAAAL39/fxwAAAAAKn9/f39/f39/f39CKn9/f39/f39/f39CImhod39/f21oaGg1AAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUn9/fxwAAAAAAAAAUX9/fyQAAAAAAAAAS39/fzsAAAAAAAAAOX9/f3QpDhMiAAAAE39/f39/f390AAAAAEd/f39/f390AAAAAAA0Z3t8c2JC" }, ["117"]: { ["w"]: 24, ["h"]: 24, ["adv"]: 24, ["left"]: 0, ["top"]: 24, ["cov"]: "AAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAAA6f39/NgAAAAASf39/YAAAAAAAAAAAAABAf39/NgAAAAARf39/YQAAAAAAAAAAAABMf39/NgAAAAAMf39/aAAAAAAAAAAAAABnf39/NgAAAAAFf39/dwAAAAAAAAAAABR/f39/NgAAAAAAcn9/fxkAAAAAAAAAAFd/f39/NgAAAAAAV39/f1kAAAAAAAAAQH92f39/NgAAAAAAKX9/f39ZIAgBCSZff3ozf39/NgAAAAAAAWF/f39/f39/f39/fywdf39/OAAAAAAAAAtif39/f39/f394KwAYf39/OwAAAAAAAAABKVRventvXzYJAAASf39/QQAA" }, ["118"]: { ["w"]: 22, ["h"]: 24, ["adv"]: 22, ["left"]: 0, ["top"]: 24, ["cov"]: "Vn9/fzgAAAAAAAAAAAAAAAA1f39/VCl/f39iAAAAAAAAAAAAAAAAYH9/fyYDeH9/fw0AAAAAAAAAAAAADH5/f3UCAE9/f381AAAAAAAAAAAAADZ/f39JAAAif39/XwAAAAAAAAAAAABhf39/GwAAAXN/f34KAAAAAAAAAAANf39/bQAAAABIf39/MgAAAAAAAAAAN39/fz8AAAAAG39/f1wAAAAAAAAAAGJ/f38RAAAAAABtf399CAAAAAAAAA5/f39iAAAAAAAAQX9/fy8AAAAAAAA4f39/NAAAAAAAABN/f39ZAAAAAAAAY39/fAkAAAAAAAAAZ39/fAYAAAAADn9/f1cAAAAAAAAAADp/f38sAAAAADl/f38pAAAAAAAAAAANfn9/VgAAAABkf393AwAAAAAAAAAAAGB/f3oFAAAPf39/TQAAAAAAAAAAAAAzf39/KQAAOX9/fx4AAAAAAAAAAAAACHx/f1AAAGN/f3AAAAAAAAAAAAAAAABZf390AA1/f39CAAAAAAAAAAAAAAAALH9/fxg1f39/FAAAAAAAAAAAAAAAAAV5f387Wn9/ZQAAAAAAAAAAAAAAAAAAUn9/Y3p/fzcAAAAAAAAAAAAAAAAAACV/f39/f30LAAAAAAAAAAAAAAAAAAACdX9/f39bAAAAAAAAAAAAAAAAAAAAAEp/f39/LQAAAAAAAAAA" }, ["119"]: { ["w"]: 33, ["h"]: 24, ["adv"]: 32, ["left"]: -1, ["top"]: 24, ["cov"]: "AHV/f3EAAAAAAAAAAAAkf39/fw0AAAAAAAAAAAV9f39fAFR/f38PAAAAAAAAAABFf39/fywAAAAAAAAAACJ/f388ADF/f38uAAAAAAAAAABlf39/f0wAAAAAAAAAAEJ/f38YAA5/f39NAAAAAAAAAAd+f3B+f2sAAAAAAAAAAGF/f3QAAABsf39rAAAAAAAAACd/f1Fqf38LAAAAAAAABHx/f1EAAABJf39/CgAAAAAAAEd/fzZQf38qAAAAAAAAIX9/fy4AAAAmf39/KAAAAAAAAGh/fxk1f39JAAAAAAAAQX9/fwsAAAAGfX9/RwAAAAAACX9/eQEZf39pAAAAAAAAYX9/ZgAAAAAAYX9/ZgAAAAAAKX9/XAABeX9/CQAAAAAEfH9/QwAAAAAAPn9/fgYAAAAASn9/PQAAXH9/KAAAAAAhf39/HwAAAAAAG39/fyMAAAAAan9/HgAAPn9/RwAAAABAf395AgAAAAAAAXd/f0IAAAALf398AwAAH39/ZgAAAABgf39YAAAAAAAAAFZ/f2AAAAArf39gAAAABHx/fgcAAAR8f380AAAAAAAAADN/f3sDAABMf39AAAAAAGJ/fyUAACB/f38RAAAAAAAAABB/f38dAABtf38hAAAAAER/f0UAAEB/f20AAAAAAAAAAABtf388AA1/f30FAAAAACV/f2QAAGB/f0oAAAAAAAAAAABLf39bAC5/f2IAAAAAAAh+f30GA3t/fyYAAAAAAAAAAAAof393AE5/f0MAAAAAAABof38hH39/fAYAAAAAAAAAAAAHfX9/Em9/fyMAAAAAAABKf38/PH9/XwAAAAAAAAAAAAAAYn9/On9/fQYAAAAAAAArf39dWH9/OwAAAAAAAAAAAAAAQH9/bn9/ZAAAAAAAAAANf395dH9/GAAAAAAAAAAAAAAAHX9/f39/RAAAAAAAAAAAbn9/f390AAAAAAAAAAAAAAAAAXh/f39/JQAAAAAAAAAAUH9/f39RAAAAAAAAAAAAAAAAAFd/f39+BwAAAAAAAAAAMX9/f38tAAAAAAAA" }, ["120"]: { ["w"]: 22, ["h"]: 24, ["adv"]: 22, ["left"]: 0, ["top"]: 24, ["cov"]: "AWN/f387AAAAAAAAAAAAAEt/f39YAAATe39/ehAAAAAAAAAAABt+f392CwAAADd/f39aAAAAAAAAAAFnf39/KwAAAAAAYH9/fykAAAAAAAA4f39/VAAAAAAAABB5f39yBgAAAAANeX9/dAoAAAAAAAAANH9/f0gAAAAAVn9/fycAAAAAAAAAAABdf39+GQAAJX9/f1AAAAAAAAAAAAAADnh/f2UBBG9/f3IIAAAAAAAAAAAAAAAwf39/NkN/f38kAAAAAAAAAAAAAAAAAFp/f3l9f39NAAAAAAAAAAAAAAAAAAAMdn9/f39vBgAAAAAAAAAAAAAAAAAAADZ/f39/KwAAAAAAAAAAAAAAAAAAAAFjf39/f10AAAAAAAAAAAAAAAAAAAA7f39/f39/NQAAAAAAAAAAAAAAAAAUe39/XWd/f3oRAAAAAAAAAAAAAAABZH9/ehEafn9/YQEAAAAAAAAAAAAAPH9/fzoAAEd/f385AAAAAAAAAAAAFXx/f2YBAAAFcH9/exQAAAAAAAAAAmZ/f30YAAAAACV/f39kAQAAAAAAAD5/f39EAAAAAAAAVH9/fz0AAAAAABZ8f39uBAAAAAAAAAt3f398FwAAAAJnf39/IQAAAAAAAAAAMX9/f2gCAAA/f39/TgAAAAAAAAAAAABff39/QQAXfX9/dAgAAAAAAAAAAAAAEnt/f30a" }, ["121"]: { ["w"]: 22, ["h"]: 33, ["adv"]: 22, ["left"]: 0, ["top"]: 24, ["cov"]: "WX9/fzUAAAAAAAAAAAAAAAArf39/XSh/f39kAAAAAAAAAAAAAAAAVX9/fy4CdH9/fxMAAAAAAAAAAAAABXp/f3kFAEV/f39CAAAAAAAAAAAAACp/f39OAAAUf39/cAAAAAAAAAAAAABUf39/HwAAAGJ/f38fAAAAAAAAAAAEen9/bwAAAAAxf39/TgAAAAAAAAAAKX9/fz8AAAAABnl/f3gEAAAAAAAAAFR/f38QAAAAAABOf39/LAAAAAAAAAR5f39gAAAAAAAAHX9/f1sAAAAAAAAof39/MAAAAAAAAABrf39+DAAAAAAAU39/egYAAAAAAAAAOn9/fzkAAAAAA3l/f1EAAAAAAAAAAAt9f39oAAAAACd/f38hAAAAAAAAAAAAV39/fxYAAABSf39xAQAAAAAAAAAAACZ/f39BAAADeH9/QgAAAAAAAAAAAAABcn9/bAAAJ39/fxMAAAAAAAAAAAAAAEN/f38WAFJ/f2MAAAAAAAAAAAAAAAASf39/QAR5f38zAAAAAAAAAAAAAAAAAGB/f2oqf397CAAAAAAAAAAAAAAAAAAvf39/Z39/VAAAAAAAAAAAAAAAAAAABXh/f39/fyQAAAAAAAAAAAAAAAAAAABMf39/f3MBAAAAAAAAAAAAAAAAAAAAGn9/f39FAAAAAAAAAAAAAAAAAAAAAABpf39/FQAAAAAAAAAAAAAAAAAAAAACc39/YwAAAAAAAAAAAAAAAAAAAAAALX9/fy4AAAAAAAAAAAAAAAAAAAAAAmt/f3ECAAAAAAAAAAAAAAAAAAAAAD9/f382AAAAAAAAAAAAAAAAAAAAAC5+f39uAwAAAAAAAAAAAAAACAgFGk9/f399IAAAAAAAAAAAAAAAAEh/f39/f39/NQAAAAAAAAAAAAAAAABIf39/f397MQAAAAAAAAAAAAAAAAAAOnR9eWpGEQAAAAAAAAAAAAAAAAAA" }, ["122"]: { ["w"]: 22, ["h"]: 24, ["adv"]: 22, ["left"]: 0, ["top"]: 24, ["cov"]: "AAA+f39/f39/f39/f39/f39/fy4AAAAAPn9/f39/f39/f39/f39/f38uAAAAAD1+fn5+fn5+fn5+fn5/f39/LQAAAAAAAAAAAAAAAAAAAABLf39/cgkAAAAAAAAAAAAAAAAAAAAnf39/fiAAAAAAAAAAAAAAAAAAAAANdn9/f0IAAAAAAAAAAAAAAAAAAAABXn9/f2QCAAAAAAAAAAAAAAAAAAAAPH9/f3kRAAAAAAAAAAAAAAAAAAAAGn1/f38uAAAAAAAAAAAAAAAAAAAABm1/f39SAAAAAAAAAAAAAAAAAAAAAFB/f39uBwAAAAAAAAAAAAAAAAAAACt/f399GwAAAAAAAAAAAAAAAAAAAA94f39/PQAAAAAAAAAAAAAAAAAAAAFif39/XwEAAAAAAAAAAAAAAAAAAABAf39/dg4AAAAAAAAAAAAAAAAAAAAdfn9/fygAAAAAAAAAAAAAAAAAAAAHcH9/f0wAAAAAAAAAAAAAAAAAAAAAVH9/f2sEAAAAAAAAAAAAAAAAAAAAMH9/f3wXAAAAAAAAAAAAAAAAAAAAEnl/f383AAAAAAAAAAAAAAAAAAAAAmV/f39aAAAAAAAAAAAAAAAAAAAAABt/f39/fn5+fn5+fn5+fn5+fmYAAAAcf39/f39/f39/f39/f39/f39oAAAAHH9/f39/f39/f39/f39/f39/aAAA" }, ["123"]: { ["w"]: 15, ["h"]: 41, ["adv"]: 15, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAAAAAAAAtFa3p/f3YAAAAAAAAAFHN/f39/f3YAAAAAAAAAZ39/f39yY1oAAAAAAAAff39/eSUAAAAAAAAAAAA/f39/PAAAAAAAAAAAAABOf39/EgAAAAAAAAAAAABTf39+AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABYf395AAAAAAAAAAAAAABnf390AAAAAAAAAAAAAA1+f39eAAAAAAAAAAAAAVR/f38tAAAAAAAAAAklX39/f1UAAAAAAAAAIn9/f396RQEAAAAAAAAAIn9/f3w7BAAAAAAAAAAAGWl+f39/bxUAAAAAAAAAAAAIRH9/f3IIAAAAAAAAAAAAAEB/f39AAAAAAAAAAAAAAAZ7f39mAAAAAAAAAAAAAABif392AAAAAAAAAAAAAABXf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABUf396AAAAAAAAAAAAAABTf39+AQAAAAAAAAAAAABNf39/EwAAAAAAAAAAAAA8f39/PgAAAAAAAAAAAAAaf39/eiYAAAAAAAAAAAAAYH9/f39yY1oAAAAAAAAAD25/f39/f3YAAAAAAAAAAAhBant/f3YA" }, ["124"]: { ["w"]: 11, ["h"]: 41, ["adv"]: 11, ["left"]: 0, ["top"]: 32, ["cov"]: "AAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAAAAAAh/f39AAAAAAAAACH9/f0AAAAAAAAAIf39/QAAAAA==" }, ["125"]: { ["w"]: 15, ["h"]: 41, ["adv"]: 15, ["left"]: 0, ["top"]: 32, ["cov"]: "In9/f3ZdLAAAAAAAAAAAIn9/f39/f08AAAAAAAAAGmJne39/f38wAAAAAAAAAAAABk5/f39oAAAAAAAAAAAAAAJsf39/CQAAAAAAAAAAAABDf39/FwAAAAAAAAAAAAAwf39/HQAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAApf39/IQAAAAAAAAAAAAAkf39/MQAAAAAAAAAAAAAQf39/VgAAAAAAAAAAAAAAYX9/fiIAAAAAAAAAAAAAFXh/f3xEGAQAAAAAAAAAABhnf39/f3QAAAAAAAAAAAAUYH9/f3QAAAAAAAAAADp+f39/dloAAAAAAAAALX9/f28kAQAAAAAAAAABcH9/eQ8AAAAAAAAAAAAXf39/SwAAAAAAAAAAAAAmf39/LAAAAAAAAAAAAAAqf39/IAAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAqf39/HgAAAAAAAAAAAAAwf39/HQAAAAAAAAAAAABFf39/FgAAAAAAAAAAAAJuf39+BwAAAAAAAAAABlB/f39kAAAAAAAAGmJme39/f38pAAAAAAAAIn9/f39/f0YAAAAAAAAAIn9/f3ZbJgAAAAAAAAAA" }, ["126"]: { ["w"]: 26, ["h"]: 17, ["adv"]: 26, ["left"]: 0, ["top"]: 17, ["cov"]: "AAAADD1gdX11aVg8HAEAAAAAAAAAABREAAAAAD58f39/f39/f39/d1UyFQIABCBOfVwAAAACf39/f39/f39/f39/f39/f3p/f39/XAAAAAJ/eEMbBwEMGzdUdH9/f39/f39/f3csAAAAAVMJAAAAAAAAAAAAGDtZb3t9dWA7CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" } } } };
}

// web/build/atlas_font.js
class AtlasFont {
  constructor(data) {
    this.data = data;
    this.sizes = $index(data, "sizes");
    this.ascent = $index(data, "ascent");
    this.glyphs = $index(data, "glyphs");
    this._cov_cache = {};
  }
  nearest_size(target) {
    let best = $index(this.sizes, 0);
    let best_d = _atlas_abs(target - best);
    let i = 1;
    while (truthy(i < len(this.sizes))) {
      let s = $index(this.sizes, i);
      let d = _atlas_abs(target - s);
      if (truthy(d < best_d)) {
        best = s;
        best_d = d;
      }
      i += 1;
    }
    return best;
  }
  ascent_for(size_key) {
    return $index(this.ascent, size_key);
  }
  glyph(size_key, code) {
    let gs = $index(this.glyphs, size_key);
    let ck = str(code);
    if (truthy(has(gs, ck))) {
      return $index(gs, ck);
    }
    return null;
  }
  coverage(size_key, code) {
    let key = size_key + ":" + str(code);
    if (truthy(has(this._cov_cache, key))) {
      return $index(this._cov_cache, key);
    }
    let g = this.glyph(size_key, code);
    let out = [];
    if (truthy($ne(g, null) && $ne($index(g, "cov"), ""))) {
      let s = decode64($index(g, "cov"));
      let n = len(s);
      let i = 0;
      while (truthy(i < n)) {
        push(out, char_code(char_at(s, i)) * 2);
        i += 1;
      }
    }
    this._cov_cache[key] = out;
    return out;
  }
}
function _atlas_abs(v) {
  if (truthy(v < 0)) {
    return 0 - v;
  }
  return v;
}
function _atlas_floor_i(v) {
  let i = $int(v);
  if (truthy(v < 0 && i > v)) {
    return i - 1;
  }
  return i;
}
function load_atlas() {
  return new AtlasFont(atlas_data());
}
var _ATLAS_SHARED = null;
function shared_atlas() {
  if (truthy($eq(_ATLAS_SHARED, null))) {
    _ATLAS_SHARED = load_atlas();
  }
  return _ATLAS_SHARED;
}
function measure_atlas_text(atlas, text, size, tracking) {
  let track = truthy($eq(tracking, null)) ? 0 : tracking;
  let target = truthy($eq(size, null)) ? $index(atlas.sizes, 0) : size;
  let base = atlas.nearest_size(target);
  let scale = target * 1 / base;
  let sk = str(base);
  let chs = chars(text);
  let n = len(chs);
  if (truthy($eq(n, 0))) {
    return [0, target];
  }
  let w = 0;
  let i = 0;
  while (truthy(i < n)) {
    let g = atlas.glyph(sk, char_code($index(chs, i)));
    if (truthy($ne(g, null))) {
      w = w + $index(g, "adv") * scale;
    }
    if (truthy(i < n - 1)) {
      w = w + track;
    }
    i += 1;
  }
  return [$int(w + 0.5), target];
}
function draw_atlas_text(fb, x, y, text, atlas, color, opts) {
  let o = opts ?? {};
  let target = truthy(has(o, "size")) ? $index(o, "size") : $index(atlas.sizes, 0);
  let track = truthy(has(o, "tracking")) ? $index(o, "tracking") : 0;
  let base = atlas.nearest_size(target);
  let scale = target * 1 / base;
  let sk = str(base);
  let asc = atlas.ascent_for(sk);
  let base_a = $int(color / 16777216) & 255;
  let rgb2 = color & 16777215;
  if (truthy($eq(base_a, 0))) {
    return 0;
  }
  let ox = $int(x);
  let oy = $int(y);
  let chs = chars(text);
  let n = len(chs);
  let pen = ox * 1;
  let i = 0;
  while (truthy(i < n)) {
    let code = char_code($index(chs, i));
    let g = atlas.glyph(sk, code);
    if (truthy($ne(g, null))) {
      let gw = $index(g, "w");
      let gh = $index(g, "h");
      if (truthy(gw > 0 && gh > 0)) {
        let cov = atlas.coverage(sk, code);
        let gx = pen + $index(g, "left") * scale;
        let gy = oy + (asc - $index(g, "top")) * scale;
        if (truthy(scale > 0.999 && scale < 1.001)) {
          _atlas_blit_glyph(fb, $int(gx), $int(gy), cov, gw, gh, base_a, rgb2);
        } else {
          _atlas_scale_glyph(fb, gx, gy, cov, gw, gh, scale, base_a, rgb2);
        }
      }
      pen = pen + $index(g, "adv") * scale + track;
    }
    i += 1;
  }
  return $int(pen) - ox;
}
function _atlas_blit_glyph(fb, gx, gy, cov, gw, gh, base_a, rgb2) {
  let row = 0;
  while (truthy(row < gh)) {
    let rbase = row * gw;
    let col = 0;
    while (truthy(col < gw)) {
      let c = $index(cov, rbase + col);
      if (truthy(c > 0)) {
        let a = $int(c * base_a / 255);
        if (truthy(a > 0)) {
          blend_pixel(fb, gx + col, gy + row, a * 16777216 + rgb2);
        }
      }
      col += 1;
    }
    row += 1;
  }
}
function _atlas_scale_glyph(fb, gx, gy, cov, gw, gh, scale, base_a, rgb2) {
  let dw = $int(gw * scale + 0.5);
  let dh = $int(gh * scale + 0.5);
  if (truthy(dw <= 0 || dh <= 0)) {
    return null;
  }
  let bx = $int(gx);
  let by = $int(gy);
  let j = 0;
  while (truthy(j < dh)) {
    let fy = (j + 0.5) / scale - 0.5;
    let r0 = _atlas_floor_i(fy);
    let ty = fy - r0;
    let i = 0;
    while (truthy(i < dw)) {
      let fx = (i + 0.5) / scale - 0.5;
      let c0 = _atlas_floor_i(fx);
      let tx = fx - c0;
      let v00 = _atlas_cover(cov, gw, gh, c0, r0);
      let v10 = _atlas_cover(cov, gw, gh, c0 + 1, r0);
      let v01 = _atlas_cover(cov, gw, gh, c0, r0 + 1);
      let v11 = _atlas_cover(cov, gw, gh, c0 + 1, r0 + 1);
      let top = v00 + (v10 - v00) * tx;
      let bot = v01 + (v11 - v01) * tx;
      let cv = top + (bot - top) * ty;
      if (truthy(cv > 1)) {
        let a = $int(cv * base_a / 255);
        if (truthy(a > 0)) {
          blend_pixel(fb, bx + i, by + j, a * 16777216 + rgb2);
        }
      }
      i += 1;
    }
    j += 1;
  }
}
function _atlas_cover(cov, gw, gh, col, row) {
  if (truthy(col < 0 || col >= gw || row < 0 || row >= gh)) {
    return 0;
  }
  return $index(cov, row * gw + col) * 1;
}

// web/build/theme_kyan.js
var _RADIUS = { ["window"]: 12, ["card"]: 12, ["control"]: 8, ["pill"]: 9999, ["tag"]: 6 };
var _SPACING = { ["xs"]: 4, ["sm"]: 8, ["md"]: 12, ["lg"]: 16, ["xl"]: 24, ["xxl"]: 40 };
var _TYPE = { ["display"]: 40, ["title"]: 28, ["h1"]: 22, ["h2"]: 18, ["h3"]: 15, ["body"]: 15, ["caption"]: 13, ["micro"]: 11 };
var _MOTION = { ["fast_ms"]: 150, ["base_ms"]: 200, ["slow_ms"]: 320, ["easing"]: "ease_out_cubic" };
var _BASE_SHARED = { ["radius"]: _RADIUS, ["spacing"]: _SPACING, ["typography"]: _TYPE, ["motion"]: _MOTION, ["border_width"]: 1, ["shadow_blur"]: 24, ["shadow_dy"]: 8 };
function _merge(a, b) {
  let out = {};
  for (let kv of entries(a)) {
    out[$index(kv, 0)] = $index(kv, 1);
  }
  for (let kv of entries(b)) {
    out[$index(kv, 0)] = $index(kv, 1);
  }
  return out;
}
var KYAN_VIOLET = 4286331629;
var KYAN_INDIGO = 4283385573;
var KYAN_CYAN = 4280472558;
function kyan_gradient_stops() {
  return [{ ["t"]: 0, ["color"]: KYAN_VIOLET }, { ["t"]: 0.5, ["color"]: KYAN_INDIGO }, { ["t"]: 1, ["color"]: KYAN_CYAN }];
}
var OBS_VOID = 4278519306;
var OBS_SURFACE = 4279046426;
var OBS_RAISED = 4279573289;
var OBS_HAIRLINE = 4280560962;
var OBS_TEXT = 4293520886;
var OBS_MUTED = 4287403692;
var OBS_INK_SOFT = 4290955995;
var OBS_ACCENT = 4280998128;
var OBS_SHADOW = 1711539728;
function kyan_obsidian() {
  return _merge(_BASE_SHARED, { ["name"]: "Obsidian", ["id"]: "kyan-obsidian", ["background"]: OBS_VOID, ["surface"]: OBS_SURFACE, ["surface_elevated"]: OBS_RAISED, ["border"]: OBS_HAIRLINE, ["foreground"]: OBS_TEXT, ["foreground_muted"]: OBS_MUTED, ["ink_soft"]: OBS_INK_SOFT, ["primary"]: OBS_ACCENT, ["primary_dark"]: 4279999924, ["accent"]: OBS_ACCENT, ["accent_secondary"]: KYAN_VIOLET, ["accent_tertiary"]: KYAN_INDIGO, ["highlight"]: KYAN_CYAN, ["selection"]: 1076549872, ["danger"]: 4294668677, ["warning"]: 4294688548, ["success"]: 4281652121, ["focus_ring"]: OBS_ACCENT, ["disabled"]: 4282008150, ["shadow"]: OBS_SHADOW, ["gradient_stops"]: kyan_gradient_stops(), ["scheme"]: "dark", ["font"]: builtin_font() });
}

// web/build/branding_kyan.js
var _ICON_SS = 3;
var _KNOWN_ICONS = ["prism", "voidrunner", "terminal", "files", "editor", "monitor", "settings", "calc", "viewer", "mail", "chat", "store"];
function paint_kyan_icon(fb, app_id, x, y, size, theme) {
  let matched = contains(_KNOWN_ICONS, app_id);
  let ss = _ICON_SS;
  let n = size * ss;
  let tmp = framebuffer(n, n);
  let yy = 0;
  while (truthy(yy < n)) {
    let sy = y + $int(yy / ss);
    let xx = 0;
    while (truthy(xx < n)) {
      tmp.put_pixel(xx, yy, fb.get_pixel(x + $int(xx / ss), sy));
      xx = xx + 1;
    }
    yy = yy + 1;
  }
  _kyan_mark(tmp, app_id, 0, 0, n, theme);
  let cnt = ss * ss;
  let dy = 0;
  while (truthy(dy < size)) {
    let dx = 0;
    while (truthy(dx < size)) {
      let r = 0;
      let g = 0;
      let b = 0;
      let oy = 0;
      while (truthy(oy < ss)) {
        let ox = 0;
        while (truthy(ox < ss)) {
          let p = tmp.get_pixel(dx * ss + ox, dy * ss + oy);
          r = r + ($int(p / 65536) & 255);
          g = g + ($int(p / 256) & 255);
          b = b + (p & 255);
          ox = ox + 1;
        }
        oy = oy + 1;
      }
      fb.put_pixel(x + dx, y + dy, 4278190080 + $int(r / cnt) * 65536 + $int(g / cnt) * 256 + $int(b / cnt));
      dx = dx + 1;
    }
    dy = dy + 1;
  }
  return matched;
}
function _kyan_mark(fb, app, x, y, s, theme) {
  let cyan = $index(theme, "accent");
  let violet = $index(theme, "accent_secondary");
  let indigo = $index(theme, "accent_tertiary");
  let ink = $index(theme, "foreground");
  let muted = $index(theme, "foreground_muted");
  let glass = $index(theme, "surface_elevated");
  let pad = $int(s * 0.14);
  let iw = s - 2 * pad;
  let cx = x + $int(s / 2);
  let cy = y + $int(s / 2);
  if (truthy($eq(app, "prism") || $eq(app, "voidrunner"))) {
    let top = y + $int(s * 0.2);
    let bot = y + $int(s * 0.8);
    let half = $int(s * 0.3);
    fill_polygon(fb, [[cx, top], [cx + half, bot], [cx - half, bot]], violet);
    fill_polygon(fb, [[cx, top], [cx + $int(half / 2), $int((top + bot) / 2)], [cx, bot]], cyan);
    fill_rect(fb, cx - $max2(1, $int(s / 32)), top, $max2(2, $int(s / 16)), bot - top, 4293588735);
    return null;
  }
  if (truthy($eq(app, "terminal"))) {
    rounded_rect(fb, x + pad, y + pad, iw, iw, $int(s * 0.14), 4278914840);
    fill_rect(fb, x + pad, y + pad, iw, $int(s * 0.16), glass);
    let bx = x + $int(s * 0.3);
    let by = cy;
    let cw = $int(s * 0.16);
    fill_polygon(fb, [[bx, by - cw], [bx + cw, by], [bx, by + cw], [bx - $int(cw / 2), by + cw], [bx + $int(cw / 2), by], [bx - $int(cw / 2), by - cw]], cyan);
    fill_rect(fb, cx + $int(s * 0.02), by + $int(cw * 0.6), $int(s * 0.22), $max2(2, $int(s / 22)), cyan);
    return null;
  }
  if (truthy($eq(app, "files"))) {
    let fw = iw;
    let fy = y + $int(s * 0.3);
    rounded_rect(fb, x + pad, fy - $int(s * 0.1), $int(fw * 0.5), $int(s * 0.14), $int(s * 0.05), violet);
    rounded_rect(fb, x + pad, fy, fw, $int(s * 0.42), $int(s * 0.06), cyan);
    return null;
  }
  if (truthy($eq(app, "editor"))) {
    rounded_rect(fb, x + pad, y + pad, iw, iw, $int(s * 0.1), 4293586679);
    fill_polygon(fb, [[x + s - pad - $int(iw * 0.34), y + pad], [x + s - pad, y + pad], [x + s - pad, y + pad + $int(iw * 0.34)]], glass);
    let lx = x + pad + $int(s * 0.1);
    let lw = iw - $int(s * 0.2);
    fill_rect(fb, lx, cy - $int(s * 0.1), lw, $max2(2, $int(s / 24)), violet);
    fill_rect(fb, lx, cy, $int(lw * 0.75), $max2(2, $int(s / 24)), muted);
    fill_rect(fb, lx, cy + $int(s * 0.1), $int(lw * 0.5), $max2(2, $int(s / 24)), muted);
    return null;
  }
  if (truthy($eq(app, "monitor"))) {
    let base = y + s - pad;
    let bw = $int(s * 0.16);
    let gap = $int(s * 0.08);
    let x0 = cx - $int((3 * bw + 2 * gap) / 2);
    rounded_rect(fb, x0, base - $int(s * 0.28), bw, $int(s * 0.28), $int(bw / 3), indigo);
    rounded_rect(fb, x0 + bw + gap, base - $int(s * 0.46), bw, $int(s * 0.46), $int(bw / 3), violet);
    rounded_rect(fb, x0 + 2 * (bw + gap), base - $int(s * 0.62), bw, $int(s * 0.62), $int(bw / 3), cyan);
    return null;
  }
  if (truthy($eq(app, "settings"))) {
    let rows = [{ ["y"]: 0.34, ["kx"]: 0.66, ["c"]: cyan }, { ["y"]: 0.5, ["kx"]: 0.38, ["c"]: violet }, { ["y"]: 0.66, ["kx"]: 0.58, ["c"]: indigo }];
    for (let row of rows) {
      let ry = y + $int(s * $index(row, "y"));
      fill_rect(fb, x + pad, ry - $max2(1, $int(s / 40)), iw, $max2(2, $int(s / 20)), glass);
      circle(fb, x + pad + $int(iw * $index(row, "kx")), ry, $int(s * 0.075), $index(row, "c"));
    }
    return null;
  }
  if (truthy($eq(app, "calc"))) {
    rounded_rect(fb, x + pad, y + pad, iw, iw, $int(s * 0.12), glass);
    fill_rect(fb, x + pad + $int(s * 0.08), y + pad + $int(s * 0.08), iw - $int(s * 0.16), $int(s * 0.16), 4278914840);
    let gy2 = y + pad + $int(s * 0.34);
    let ri = 0;
    while (truthy(ri < 2)) {
      let cxi = x + pad + $int(s * 0.1);
      let cc = 0;
      while (truthy(cc < 3)) {
        let col = truthy($eq(ri, 0) && $eq(cc, 2)) ? cyan : muted;
        circle(fb, cxi, gy2, $int(s * 0.045), col);
        cxi = cxi + $int(s * 0.24);
        cc = cc + 1;
      }
      gy2 = gy2 + $int(s * 0.2);
      ri = ri + 1;
    }
    return null;
  }
  if (truthy($eq(app, "viewer"))) {
    rounded_rect(fb, x + pad, y + pad, iw, iw, $int(s * 0.1), glass);
    circle(fb, x + pad + $int(iw * 0.72), y + pad + $int(iw * 0.28), $int(s * 0.07), 4294688548);
    fill_polygon(fb, [[x + pad, y + s - pad], [x + pad + $int(iw * 0.4), cy], [x + pad + $int(iw * 0.7), y + s - pad]], cyan);
    fill_polygon(fb, [[x + pad + $int(iw * 0.45), y + s - pad], [x + pad + $int(iw * 0.75), y + $int(s * 0.5)], [x + s - pad, y + s - pad]], violet);
    return null;
  }
  if (truthy($eq(app, "mail"))) {
    rounded_rect(fb, x + pad, y + $int(s * 0.28), iw, $int(s * 0.44), $int(s * 0.06), cyan);
    fill_polygon(fb, [[x + pad, y + $int(s * 0.3)], [cx, cy], [x + s - pad, y + $int(s * 0.3)]], 4278916388);
    return null;
  }
  if (truthy($eq(app, "chat"))) {
    rounded_rect(fb, x + pad, y + pad, iw, $int(iw * 0.72), $int(s * 0.14), violet);
    fill_polygon(fb, [[x + pad + $int(iw * 0.2), y + pad + $int(iw * 0.66)], [x + pad + $int(iw * 0.14), y + s - pad], [x + pad + $int(iw * 0.44), y + pad + $int(iw * 0.66)]], violet);
    circle(fb, cx - $int(s * 0.14), y + pad + $int(iw * 0.34), $int(s * 0.035), 4293588735);
    circle(fb, cx, y + pad + $int(iw * 0.34), $int(s * 0.035), 4293588735);
    circle(fb, cx + $int(s * 0.14), y + pad + $int(iw * 0.34), $int(s * 0.035), 4293588735);
    return null;
  }
  if (truthy($eq(app, "store"))) {
    fill_polygon(fb, [[cx, y + pad], [x + s - pad, cy], [cx, y + s - pad], [x + pad, cy]], violet);
    fill_polygon(fb, [[cx, y + $int(s * 0.3)], [x + s - $int(s * 0.34), cy], [cx, y + $int(s * 0.7)], [x + $int(s * 0.34), cy]], cyan);
    return null;
  }
  rounded_rect(fb, x + pad, y + pad, iw, iw, $int(s * 0.12), glass);
  circle(fb, cx, cy, $int(s * 0.16), cyan);
}
function $max2(a, b) {
  if (truthy(a > b)) {
    return a;
  }
  return b;
}

// web/build/kyan_apps.js
var _GAME_ARTS = [[{ ["t"]: 0, ["color"]: 4286331629 }, { ["t"]: 1, ["color"]: 4280472558 }], [{ ["t"]: 0, ["color"]: 4294668677 }, { ["t"]: 1, ["color"]: 4283385573 }], [{ ["t"]: 0, ["color"]: 4279150057 }, { ["t"]: 1, ["color"]: 4281652121 }], [{ ["t"]: 0, ["color"]: 4294688548 }, { ["t"]: 1, ["color"]: 4286331629 }]];
var _GAME_NAMES = ["Hexfield", "Orbit Decay", "Verdant", "Ash Fable"];
var _GAME_META = ["Strategy", "Arcade", "Puzzle", "RPG"];
function prism_play_rect(x, y, w, h) {
  return [x + 168, y + 104, 90, 24];
}
function paint_prism(fb, x, y, w, h, theme, focused) {
  let t = theme;
  let atlas = shared_atlas();
  let sw = 132;
  fill_rect(fb, x, y, sw, h, $index(t, "surface_elevated"));
  fill_rect(fb, x + sw - 1, y, 1, h, $index(t, "border"));
  _prism_head(fb, x + 14, y + 14, "PLAY", t, atlas);
  _prism_item(fb, x + 10, y + 32, sw - 20, "Library", t, atlas, true);
  _prism_item(fb, x + 10, y + 56, sw - 20, "Store", t, atlas, false);
  _prism_item(fb, x + 10, y + 80, sw - 20, "Friends", t, atlas, false);
  _prism_head(fb, x + 14, y + 110, "BUILD", t, atlas);
  _prism_item(fb, x + 10, y + 128, sw - 20, "Forge", t, atlas, false);
  _prism_item(fb, x + 10, y + 152, sw - 20, "Assets", t, atlas, false);
  let mx = x + sw + 18;
  let mw = w - sw - 36;
  if (truthy(mw < 40)) {
    return null;
  }
  let fh = 120;
  let fy = y + 18;
  linear_gradient(fb, mx, fy, mw, fh, [{ ["t"]: 0, ["color"]: 4279439394 }, { ["t"]: 1, ["color"]: 4278920256 }], "h");
  linear_gradient(fb, mx, fy, mw, 3, kyan_gradient_stops(), "h");
  draw_atlas_text(fb, mx + 18, fy + 14, "FEATURED - BUILT IN CLARITY", atlas, $index(t, "accent"), { ["size"]: 12, ["tracking"]: 1 });
  draw_atlas_text(fb, mx + 18, fy + 32, "Voidrunner", atlas, 4294967295, { ["size"]: 30 });
  draw_atlas_text(fb, mx + 18, fy + 70, "Outrun the collapse of a dying star system.", atlas, $index(t, "foreground_muted"), { ["size"]: 14 });
  let pr = prism_play_rect(x, y, w, h);
  rounded_rect(fb, $index(pr, 0), $index(pr, 1), $index(pr, 2), $index(pr, 3), 8, $index(t, "accent"));
  draw_atlas_text(fb, $index(pr, 0) + 14, $index(pr, 1) + 4, "> Play", atlas, 4278519306, { ["size"]: 15 });
  let gy = fy + fh + 18;
  let cols = 4;
  let gap = 12;
  let cw = $int((mw - (cols - 1) * gap) / cols);
  let ch = 96;
  let i = 0;
  while (truthy(i < cols)) {
    let gx = mx + i * (cw + gap);
    if (truthy(gy + ch < y + h)) {
      _prism_game(fb, gx, gy, cw, ch, i, t, atlas);
    }
    i = i + 1;
  }
}
function _prism_head(fb, x, y, text, t, atlas) {
  draw_atlas_text(fb, x, y, text, atlas, $index(t, "foreground_muted"), { ["size"]: 12, ["tracking"]: 1 });
}
function _prism_item(fb, x, y, w, text, t, atlas, active) {
  if (truthy(active)) {
    rounded_rect(fb, x, y, w, 20, 6, $index(t, "accent_tertiary"));
    draw_atlas_text(fb, x + 10, y + 3, text, atlas, 4294967295, { ["size"]: 14 });
  } else {
    draw_atlas_text(fb, x + 10, y + 3, text, atlas, $index(t, "foreground_muted"), { ["size"]: 14 });
  }
}
function _prism_game(fb, x, y, w, h, idx, t, atlas) {
  let art_h = h - 26;
  linear_gradient(fb, x, y, w, art_h, $index(_GAME_ARTS, idx), "h");
  draw_atlas_text(fb, x + 4, y + art_h + 2, $index(_GAME_NAMES, idx), atlas, $index(t, "foreground"), { ["size"]: 14 });
  draw_atlas_text(fb, x + 4, y + art_h + 16, $index(_GAME_META, idx), atlas, $index(t, "foreground_muted"), { ["size"]: 12 });
}
function paint_terminal_content(fb, x, y, w, h, theme, focused) {
  let t = theme;
  let atlas = shared_atlas();
  fill_rect(fb, x, y, w, h, 4278519306);
  let lines2 = ["kyan > clarity os build", "-> kernel: zig build ... ok", "-> runtime: native vm ... ok", "-> iso: kyanos-1.1.iso (238 MB) ok", "kyan > clarity test stdlib/", "42 passed, 0 failed"];
  let ly = y + 10;
  for (let ln of lines2) {
    let col = truthy($eq(char_at(ln, 0), "k")) ? $index(t, "accent") : $index(t, "foreground_muted");
    draw_atlas_text(fb, x + 12, ly, ln, atlas, col, { ["size"]: 15 });
    ly = ly + 20;
  }
  fill_rect(fb, x + 12, ly + 2, 8, 13, $index(t, "accent"));
}
var _FILE_ROWS = [{ ["name"]: "clarity", ["meta"]: "173 items", ["dir"]: true }, { ["name"]: "kyanos-themes", ["meta"]: "12 items", ["dir"]: true }, { ["name"]: "theme_kyan.clarity", ["meta"]: "8.2 KB", ["dir"]: false }, { ["name"]: "prism_library.clarity", ["meta"]: "14.6 KB", ["dir"]: false }, { ["name"]: "voidrunner.clarity", ["meta"]: "31.0 KB", ["dir"]: false }];
function paint_files_content(fb, x, y, w, h, theme, focused) {
  let t = theme;
  let atlas = shared_atlas();
  fill_rect(fb, x, y, w, h, $index(t, "surface"));
  let ry = y + 10;
  let i = 0;
  for (let row of _FILE_ROWS) {
    if (truthy($eq(i, 1))) {
      fill_rect(fb, x + 6, ry - 3, w - 12, 24, $index(t, "accent_tertiary"));
    }
    let ic = truthy($index(row, "dir")) ? $index(t, "accent_secondary") : $index(t, "accent");
    fill_rect(fb, x + 12, ry + 3, 12, 10, ic);
    let name_col = truthy($eq(i, 1)) ? 4294967295 : $index(t, "foreground");
    draw_atlas_text(fb, x + 32, ry, $index(row, "name"), atlas, name_col, { ["size"]: 15 });
    let mw = $index(measure_atlas_text(atlas, $index(row, "meta"), 14, 0), 0);
    draw_atlas_text(fb, x + w - mw - 14, ry + 1, $index(row, "meta"), atlas, $index(t, "foreground_muted"), { ["size"]: 14 });
    ry = ry + 26;
    i = i + 1;
  }
}
function app_painters() {
  return { ["prism"]: paint_prism, ["terminal"]: paint_terminal_content, ["files"]: paint_files_content };
}

// web/build/kyan_game.js
var _SHIP_W = 34;
var _SHIP_H = 22;
var _OBST = 26;
var _SPAWN_MS = 620;
function new_voidrunner(w, h) {
  return { ["w"]: w, ["h"]: h, ["ship_x"]: $int(w / 2) - $int(_SHIP_W / 2), ["obs"]: [], ["score"]: 0, ["best"]: 0, ["dead"]: false, ["seed"]: 2463534242, ["spawn_acc"]: 0, ["scroll"]: 0 };
}
function _rand01(s) {
  let next = ($index(s, "seed") * 1664525 + 1013904223) % 4294967296;
  s["seed"] = next;
  return next / 4294967296;
}
function voidrunner_update(s, dt_ms, keys2) {
  let dt = truthy(dt_ms > 60) ? 60 : dt_ms;
  let restart = has(keys2, "r") && $index(keys2, "r");
  if (truthy($index(s, "dead"))) {
    if (truthy(restart)) {
      let prev_best = $index(s, "best");
      let prev_score = $int($index(s, "score"));
      let ns = new_voidrunner($index(s, "w"), $index(s, "h"));
      for (let kv of entries(ns)) {
        s[$index(kv, 0)] = $index(kv, 1);
      }
      s["best"] = truthy(prev_score > prev_best) ? prev_score : prev_best;
    }
    return s;
  }
  let speed = 0.42 * dt;
  let left = has(keys2, "ArrowLeft") && $index(keys2, "ArrowLeft") || has(keys2, "a") && $index(keys2, "a");
  let right = has(keys2, "ArrowRight") && $index(keys2, "ArrowRight") || has(keys2, "d") && $index(keys2, "d");
  if (truthy(left)) {
    s["ship_x"] = $index(s, "ship_x") - $int(speed);
  }
  if (truthy(right)) {
    s["ship_x"] = $index(s, "ship_x") + $int(speed);
  }
  if (truthy($index(s, "ship_x") < 0)) {
    s["ship_x"] = 0;
  }
  if (truthy($index(s, "ship_x") > $index(s, "w") - _SHIP_W)) {
    s["ship_x"] = $index(s, "w") - _SHIP_W;
  }
  let fall = (0.14 + $index(s, "score") * 0.00006) * dt;
  let spawn_ms = truthy(_SPAWN_MS - $index(s, "score") * 0.9 < 200) ? 200 : _SPAWN_MS - $index(s, "score") * 0.9;
  let ship_y = $index(s, "h") - _SHIP_H - 8;
  let next_obs = [];
  for (let o of $index(s, "obs")) {
    let ny = $index(o, "y") + fall;
    if (truthy(ny < $index(s, "h"))) {
      if (truthy(ny + _OBST >= ship_y && ny <= ship_y + _SHIP_H && $index(o, "x") + _OBST >= $index(s, "ship_x") && $index(o, "x") <= $index(s, "ship_x") + _SHIP_W)) {
        s["dead"] = true;
      }
      push(next_obs, { ["x"]: $index(o, "x"), ["y"]: ny });
    }
  }
  s["obs"] = next_obs;
  s["spawn_acc"] = $index(s, "spawn_acc") + dt;
  if (truthy($index(s, "spawn_acc") >= spawn_ms)) {
    s["spawn_acc"] = 0;
    let ox = $int(_rand01(s) * ($index(s, "w") - _OBST));
    push($index(s, "obs"), { ["x"]: ox, ["y"]: 0 - _OBST });
  }
  s["scroll"] = $index(s, "scroll") + fall;
  if (truthy(!truthy($index(s, "dead")))) {
    s["score"] = $index(s, "score") + dt * 0.03;
  }
  return s;
}
function voidrunner_paint(fb, x, y, w, h, theme, s) {
  fill_rect(fb, x, y, w, h, 4278519306);
  let band = $int($index(s, "scroll")) % 40;
  let gy = y - 40 + band;
  while (truthy(gy < y + h)) {
    if (truthy(gy >= y)) {
      fill_rect(fb, x, gy, w, 1, 4279244063);
    }
    gy = gy + 40;
  }
  for (let o of $index(s, "obs")) {
    let ox = x + $index(o, "x");
    let oy = y + $int($index(o, "y"));
    rounded_rect(fb, ox, oy, _OBST, _OBST, 5, 4286331629);
    fill_rect(fb, ox + 8, oy + 8, _OBST - 16, _OBST - 16, 4280472558);
  }
  let sx = x + $index(s, "ship_x");
  let sy = y + h - _SHIP_H - 8;
  fill_polygon(fb, [[sx + $int(_SHIP_W / 2), sy], [sx + _SHIP_W, sy + _SHIP_H], [sx + $int(_SHIP_W / 2), sy + _SHIP_H - 6], [sx, sy + _SHIP_H]], 4280998128);
  fill_rect(fb, sx + $int(_SHIP_W / 2) - 3, sy + _SHIP_H - 4, 6, 5, 4287323382);
  let atlas = shared_atlas();
  draw_atlas_text(fb, x + 10, y + 9, "SCORE " + str($int($index(s, "score"))), atlas, 4280998128, { ["size"]: 15 });
  let best = truthy($int($index(s, "score")) > $index(s, "best")) ? $int($index(s, "score")) : $index(s, "best");
  let bstr = "BEST " + str(best);
  draw_atlas_text(fb, x + w - $index(measure_atlas_text(atlas, bstr, 15, 0), 0) - 10, y + 9, bstr, atlas, $index(theme, "foreground_muted"), { ["size"]: 15 });
  if (truthy($index(s, "dead"))) {
    fill_rect(fb, x, y + $int(h / 2) - 34, w, 68, rgba(5, 6, 10, 210));
    let over = "VOIDRUNNER DOWN";
    let ow = $index(measure_atlas_text(atlas, over, 26, 1), 0);
    draw_atlas_text(fb, x + $int(w / 2) - $int(ow / 2), y + $int(h / 2) - 28, over, atlas, 4294668677, { ["size"]: 26, ["tracking"]: 1 });
    let hint = "press R to run again";
    draw_atlas_text(fb, x + $int(w / 2) - $int($index(measure_atlas_text(atlas, hint, 14, 0), 0) / 2), y + $int(h / 2) + 8, hint, atlas, $index(theme, "foreground"), { ["size"]: 14 });
  }
}

// web/build/terminal_emulator.js
class Cell {
  constructor(ch, fg, bg, bold) {
    this.ch = ch;
    this.fg = fg;
    this.bg = bg;
    this.bold = bold;
  }
}
var _DEFAULT_FG = 4293322470;
var _DEFAULT_BG = 4279900698;
var _ANSI_PALETTE = [4278190080, 4291637553, 4279090297, 4293256464, 4280578760, 4290527164, 4279347405, 4293256677, 4284900966, 4294003788, 4280537483, 4294309187, 4282093290, 4292243670, 4280924379, 4294967295];

class Terminal {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.cursor_row = 0;
    this.cursor_col = 0;
    this.fg = _DEFAULT_FG;
    this.bg = _DEFAULT_BG;
    this.bold = false;
    this.scrollback_limit = 1000;
    this._grid = [];
    this._scrollback = [];
    this._scroll_offset = 0;
    this._blank_row = [];
    let i = 0;
    while (truthy(i < cols)) {
      push(this._blank_row, new Cell(" ", _DEFAULT_FG, _DEFAULT_BG, false));
      i += 1;
    }
    let r = 0;
    while (truthy(r < rows)) {
      push(this._grid, this._make_blank_row());
      r += 1;
    }
    this._parse_state = "normal";
    this._csi_buffer = "";
  }
  _make_blank_row() {
    let row = [];
    let i = 0;
    while (truthy(i < this.cols)) {
      push(row, new Cell(" ", _DEFAULT_FG, _DEFAULT_BG, false));
      i += 1;
    }
    return row;
  }
  feed(text) {
    let chs = chars(text);
    for (let c of chs) {
      this._consume(c);
    }
  }
  cell_at(row, col) {
    if (truthy(row < 0 || row >= this.rows || col < 0 || col >= this.cols)) {
      return null;
    }
    return $index($index(this._grid, row), col);
  }
  line_text(row) {
    if (truthy(row < 0 || row >= this.rows)) {
      return "";
    }
    let s = "";
    for (let cell of $index(this._grid, row)) {
      s = s + cell.ch;
    }
    return s;
  }
  scroll_back(n) {
    this._scroll_offset += n;
  }
  scroll_forward(n) {
    this._scroll_offset -= n;
    if (truthy(this._scroll_offset < 0)) {
      this._scroll_offset = 0;
    }
  }
  jump_to_live() {
    this._scroll_offset = 0;
  }
  resize(cols, rows) {
    let nc = cols;
    let nr = rows;
    if (truthy(nc < 1)) {
      nc = 1;
    }
    if (truthy(nr < 1)) {
      nr = 1;
    }
    if (truthy($eq(nc, this.cols) && $eq(nr, this.rows))) {
      return null;
    }
    this._blank_row = [];
    let i = 0;
    while (truthy(i < nc)) {
      push(this._blank_row, new Cell(" ", _DEFAULT_FG, _DEFAULT_BG, false));
      i += 1;
    }
    let new_grid = [];
    let r = 0;
    while (truthy(r < nr)) {
      let row = [];
      let c = 0;
      while (truthy(c < nc)) {
        if (truthy(r < this.rows && c < this.cols)) {
          push(row, $index($index(this._grid, r), c));
        } else {
          push(row, new Cell(" ", _DEFAULT_FG, _DEFAULT_BG, false));
        }
        c += 1;
      }
      push(new_grid, row);
      r += 1;
    }
    this._grid = new_grid;
    this.cols = nc;
    this.rows = nr;
    if (truthy(this.cursor_row >= nr)) {
      this.cursor_row = nr - 1;
    }
    if (truthy(this.cursor_col >= nc)) {
      this.cursor_col = nc - 1;
    }
  }
  _consume(c) {
    if (truthy($eq(this._parse_state, "esc"))) {
      if (truthy($eq(c, "["))) {
        this._parse_state = "csi";
        this._csi_buffer = "";
        return null;
      }
      this._parse_state = "normal";
      return null;
    }
    if (truthy($eq(this._parse_state, "csi"))) {
      let code = char_code(c);
      if (truthy(code >= 64 && code <= 126)) {
        this._dispatch_csi(c, this._csi_buffer);
        this._parse_state = "normal";
        this._csi_buffer = "";
        return null;
      }
      this._csi_buffer = this._csi_buffer + c;
      return null;
    }
    let cc = char_code(c);
    if (truthy($eq(cc, 27))) {
      this._parse_state = "esc";
      return null;
    }
    if (truthy($eq(cc, 10))) {
      this._line_feed();
      return null;
    }
    if (truthy($eq(cc, 13))) {
      this.cursor_col = 0;
      return null;
    }
    if (truthy($eq(cc, 8))) {
      if (truthy(this.cursor_col > 0)) {
        this.cursor_col -= 1;
      }
      return null;
    }
    if (truthy($eq(cc, 9))) {
      this.cursor_col = (this.cursor_col / 8 + 1) * 8;
      if (truthy(this.cursor_col >= this.cols)) {
        this.cursor_col = this.cols - 1;
      }
      return null;
    }
    if (truthy(cc < 32)) {
      return null;
    }
    this._put_glyph(c);
  }
  _put_glyph(ch) {
    if (truthy(this.cursor_col >= this.cols)) {
      this._line_feed();
      this.cursor_col = 0;
    }
    $index(this._grid, this.cursor_row)[this.cursor_col] = new Cell(ch, this.fg, this.bg, this.bold);
    this.cursor_col += 1;
  }
  _line_feed() {
    this.cursor_row += 1;
    if (truthy(this.cursor_row >= this.rows)) {
      this.cursor_row = this.rows - 1;
      push(this._scrollback, $index(this._grid, 0));
      let new_grid = [];
      let i = 1;
      while (truthy(i < this.rows)) {
        push(new_grid, $index(this._grid, i));
        i += 1;
      }
      push(new_grid, this._make_blank_row());
      this._grid = new_grid;
      while (truthy(len(this._scrollback) > this.scrollback_limit)) {
        let sb = [];
        let j = 1;
        while (truthy(j < len(this._scrollback))) {
          push(sb, $index(this._scrollback, j));
          j += 1;
        }
        this._scrollback = sb;
      }
    }
  }
  _dispatch_csi(final_byte, params_str) {
    let params = _parse_csi_params(params_str);
    if (truthy($eq(final_byte, "A"))) {
      let n = truthy(len(params) > 0 && $index(params, 0) > 0) ? $index(params, 0) : 1;
      this.cursor_row -= n;
      if (truthy(this.cursor_row < 0)) {
        this.cursor_row = 0;
      }
      return null;
    }
    if (truthy($eq(final_byte, "B"))) {
      let n = truthy(len(params) > 0 && $index(params, 0) > 0) ? $index(params, 0) : 1;
      this.cursor_row += n;
      if (truthy(this.cursor_row >= this.rows)) {
        this.cursor_row = this.rows - 1;
      }
      return null;
    }
    if (truthy($eq(final_byte, "C"))) {
      let n = truthy(len(params) > 0 && $index(params, 0) > 0) ? $index(params, 0) : 1;
      this.cursor_col += n;
      if (truthy(this.cursor_col >= this.cols)) {
        this.cursor_col = this.cols - 1;
      }
      return null;
    }
    if (truthy($eq(final_byte, "D"))) {
      let n = truthy(len(params) > 0 && $index(params, 0) > 0) ? $index(params, 0) : 1;
      this.cursor_col -= n;
      if (truthy(this.cursor_col < 0)) {
        this.cursor_col = 0;
      }
      return null;
    }
    if (truthy($eq(final_byte, "H") || $eq(final_byte, "f"))) {
      let row = truthy(len(params) > 0 && $index(params, 0) > 0) ? $index(params, 0) - 1 : 0;
      let col = truthy(len(params) > 1 && $index(params, 1) > 0) ? $index(params, 1) - 1 : 0;
      this.cursor_row = row;
      this.cursor_col = col;
      if (truthy(this.cursor_row >= this.rows)) {
        this.cursor_row = this.rows - 1;
      }
      if (truthy(this.cursor_col >= this.cols)) {
        this.cursor_col = this.cols - 1;
      }
      return null;
    }
    if (truthy($eq(final_byte, "K"))) {
      let mode = truthy(len(params) > 0) ? $index(params, 0) : 0;
      this._erase_in_line(mode);
      return null;
    }
    if (truthy($eq(final_byte, "J"))) {
      let mode = truthy(len(params) > 0) ? $index(params, 0) : 0;
      this._erase_in_display(mode);
      return null;
    }
    if (truthy($eq(final_byte, "m"))) {
      this._apply_sgr(truthy($eq(len(params), 0)) ? [0] : params);
      return null;
    }
  }
  _erase_in_line(mode) {
    let row = this.cursor_row;
    if (truthy($eq(mode, 0))) {
      let c = this.cursor_col;
      while (truthy(c < this.cols)) {
        $index(this._grid, row)[c] = new Cell(" ", this.fg, this.bg, false);
        c += 1;
      }
    } else if (truthy($eq(mode, 1))) {
      let c = 0;
      while (truthy(c <= this.cursor_col)) {
        $index(this._grid, row)[c] = new Cell(" ", this.fg, this.bg, false);
        c += 1;
      }
    } else if (truthy($eq(mode, 2))) {
      this._grid[row] = this._make_blank_row();
    }
  }
  _erase_in_display(mode) {
    if (truthy($eq(mode, 2))) {
      let r = 0;
      while (truthy(r < this.rows)) {
        this._grid[r] = this._make_blank_row();
        r += 1;
      }
      this.cursor_row = 0;
      this.cursor_col = 0;
      return null;
    }
    if (truthy($eq(mode, 0))) {
      this._erase_in_line(0);
      let r = this.cursor_row + 1;
      while (truthy(r < this.rows)) {
        this._grid[r] = this._make_blank_row();
        r += 1;
      }
      return null;
    }
    if (truthy($eq(mode, 1))) {
      this._erase_in_line(1);
      let r = 0;
      while (truthy(r < this.cursor_row)) {
        this._grid[r] = this._make_blank_row();
        r += 1;
      }
    }
  }
  _apply_sgr(params) {
    let i = 0;
    while (truthy(i < len(params))) {
      let p = $index(params, i);
      if (truthy($eq(p, 0))) {
        this.fg = _DEFAULT_FG;
        this.bg = _DEFAULT_BG;
        this.bold = false;
      } else if (truthy($eq(p, 1))) {
        this.bold = true;
      } else if (truthy($eq(p, 22))) {
        this.bold = false;
      } else if (truthy(p >= 30 && p <= 37)) {
        this.fg = $index(_ANSI_PALETTE, p - 30);
      } else if (truthy($eq(p, 39))) {
        this.fg = _DEFAULT_FG;
      } else if (truthy(p >= 40 && p <= 47)) {
        this.bg = $index(_ANSI_PALETTE, p - 40);
      } else if (truthy($eq(p, 49))) {
        this.bg = _DEFAULT_BG;
      } else if (truthy(p >= 90 && p <= 97)) {
        this.fg = $index(_ANSI_PALETTE, 8 + (p - 90));
      } else if (truthy(p >= 100 && p <= 107)) {
        this.bg = $index(_ANSI_PALETTE, 8 + (p - 100));
      } else if (truthy($eq(p, 38) || $eq(p, 48))) {
        if (truthy(i + 1 < len(params) && $eq($index(params, i + 1), 5))) {
          if (truthy(i + 2 < len(params))) {
            let color = _xterm_256($index(params, i + 2));
            if (truthy($eq(p, 38))) {
              this.fg = color;
            } else {
              this.bg = color;
            }
            i += 2;
          }
        } else if (truthy(i + 1 < len(params) && $eq($index(params, i + 1), 2))) {
          if (truthy(i + 4 < len(params))) {
            let color = rgb($index(params, i + 2), $index(params, i + 3), $index(params, i + 4));
            if (truthy($eq(p, 38))) {
              this.fg = color;
            } else {
              this.bg = color;
            }
            i += 4;
          }
        }
      }
      i += 1;
    }
  }
}
function _parse_csi_params(s) {
  if (truthy($eq(len(s), 0))) {
    return [];
  }
  let out = [];
  for (let tok of split(s, ";")) {
    let t = trim(tok);
    if (truthy($eq(len(t), 0))) {
      push(out, 0);
    } else {
      push(out, $int(t));
    }
  }
  return out;
}
function _xterm_256(n) {
  if (truthy(n < 16)) {
    return $index(_ANSI_PALETTE, n);
  }
  if (truthy(n < 232)) {
    let i = n - 16;
    let r = i / 36 % 6;
    let g = i / 6 % 6;
    let b = i % 6;
    let levels = [0, 95, 135, 175, 215, 255];
    return rgb($index(levels, r), $index(levels, g), $index(levels, b));
  }
  let v = 8 + (n - 232) * 10;
  return rgb(v, v, v);
}

// web/build/pty.js
function pty_supported() {
  return _pty_supported();
}

class PtySession {
  constructor(cmd, argv, cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.closed = false;
    this.exited = false;
    let h = _pty_spawn(cmd, argv, cols, rows);
    this.master = $index(h, "master");
    this.pid = $index(h, "pid");
  }
  read() {
    if (truthy(this.closed)) {
      return null;
    }
    return _pty_read(this.master, 65536);
  }
  write(text) {
    if (truthy(this.closed)) {
      return 0;
    }
    return _pty_write(this.master, text);
  }
  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    if (truthy(!truthy(this.closed))) {
      _pty_resize(this.master, cols, rows);
    }
  }
  alive() {
    if (truthy(this.closed || this.exited)) {
      return false;
    }
    let running = _pty_poll(this.master);
    if (truthy(!truthy(running))) {
      this.exited = true;
    }
    return running;
  }
  drain(budget_ms) {
    let out = "";
    let waited = 0;
    let step = 15;
    while (truthy(waited < budget_ms)) {
      let chunk = this.read();
      if (truthy($eq(chunk, null))) {
        break;
      }
      if (truthy(len(chunk) > 0)) {
        out = out + chunk;
      } else {
        sleep(step / 1000);
        waited = waited + step;
      }
    }
    return out;
  }
  close() {
    if (truthy(this.closed)) {
      return true;
    }
    this.closed = true;
    _pty_close(this.master);
    return true;
  }
}
function pty_spawn_shell(cols, rows) {
  return new PtySession("/bin/sh", ["/bin/sh", "-i"], cols, rows);
}

// web/build/kyan_desktop.js
var TITLE_H = 32;
var WIN_RADIUS = 12;
var DOCK_ICON = 44;
var DOCK_GAP = 12;
var DOCK_PAD = 12;
var DOCK_MARGIN = 16;
var WIN_ANIM_MS = 220;
var LAUNCHER_ANIM_MS = 190;
var DEFAULT_PINNED = ["prism", "terminal", "files", "editor", "monitor", "settings"];
function _ease_out_cubic(t) {
  let u = 1 - t;
  return 1 - u * u * u;
}
function _ease_out_back(t) {
  let c1 = 1.70158;
  let c3 = c1 + 1;
  let u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}
var APP_TITLES = { ["prism"]: "Prism", ["terminal"]: "Terminal", ["files"]: "Files", ["editor"]: "Editor", ["monitor"]: "System Monitor", ["settings"]: "Settings", ["calc"]: "Calculator", ["viewer"]: "Image Viewer" };

class KyanDesktop {
  constructor(width, height, theme) {
    this.width = width;
    this.height = height;
    this.theme = theme ?? kyan_obsidian();
    this.comp = compositor(width, height);
    this.comp.set_background($index(this.theme, "background"));
    this.wm = window_manager(this.comp);
    this.font = builtin_font();
    this._atlas = shared_atlas();
    this.pinned = DEFAULT_PINNED;
    this.windows = {};
    this.painters = app_painters();
    this.launcher_open = false;
    this.frames = 0;
    this._wallpaper = null;
    this.app_state = {};
    this.keys = {};
    this._last_tick = null;
    this._icon_cache = {};
    this._win_sig = {};
    this._dirty = true;
    this._anim = {};
    this._launcher_t0 = -1;
    this._terminals = {};
  }
  needs_redraw() {
    if (truthy(this._dirty)) {
      return true;
    }
    if (truthy(len(keys(this.app_state)) > 0)) {
      return true;
    }
    for (let kv of entries(this._anim)) {
      if (truthy($index(kv, 1) < 0)) {
        return true;
      }
      if (truthy($ne(this._last_tick, null) && this._last_tick - $index(kv, 1) < WIN_ANIM_MS)) {
        return true;
      }
    }
    if (truthy(this.launcher_open && this._launcher_t0 >= 0 && $ne(this._last_tick, null) && this._last_tick - this._launcher_t0 < LAUNCHER_ANIM_MS)) {
      return true;
    }
    return false;
  }
  _app_of(win) {
    for (let kv of entries(this.windows)) {
      if (truthy($eq($index(kv, 1), win))) {
        return $index(kv, 0);
      }
    }
    return null;
  }
  _icon(app, size, bg) {
    let key = app + ":" + str(size) + ":" + str(bg);
    if (truthy(!truthy(has(this._icon_cache, key)))) {
      let f = framebuffer(size, size);
      f.clear(bg);
      paint_kyan_icon(f, app, 0, 0, size, this.theme);
      this._icon_cache[key] = f;
    }
    return $index(this._icon_cache, key);
  }
  boot(pinned) {
    if (truthy($ne(pinned, null))) {
      this.pinned = pinned;
    }
    return true;
  }
  open(app_id, x, y, w, h) {
    this._dirty = true;
    if (truthy(has(this.windows, app_id))) {
      let win2 = $index(this.windows, app_id);
      win2.set_visible(true);
      win2.restore_from_min();
      this.comp.focus(win2);
      return win2;
    }
    let title = truthy(has(APP_TITLES, app_id)) ? $index(APP_TITLES, app_id) : app_id;
    let win = window(title, x, y, w, h);
    win.title_h = TITLE_H;
    win.border_w = 0;
    this.windows[app_id] = win;
    this.comp.add(win);
    this.comp.focus(win);
    this._anim[app_id] = -1;
    if (truthy($eq(app_id, "voidrunner"))) {
      let cr = win.content_rect();
      this.app_state["voidrunner"] = new_voidrunner($index(cr, 2), $index(cr, 3));
    }
    if (truthy($eq(app_id, "terminal") && pty_supported() && !truthy(has(this._terminals, "terminal")))) {
      let cr = win.content_rect();
      let cols = $int($index(cr, 2) / 8);
      let rows = $int($index(cr, 3) / 16);
      this._terminals["terminal"] = { ["term"]: Terminal(cols, rows), ["pty"]: pty_spawn_shell(cols, rows), ["dead"]: false };
    }
    return win;
  }
  close(app_id) {
    this._dirty = true;
    if (truthy(!truthy(has(this.windows, app_id)))) {
      return false;
    }
    this.comp.remove($index(this.windows, app_id));
    let next = {};
    for (let kv of entries(this.windows)) {
      if (truthy($ne($index(kv, 0), app_id))) {
        next[$index(kv, 0)] = $index(kv, 1);
      }
    }
    this.windows = next;
    if (truthy(has(this._win_sig, app_id))) {
      let nsig = {};
      for (let kv of entries(this._win_sig)) {
        if (truthy($ne($index(kv, 0), app_id))) {
          nsig[$index(kv, 0)] = $index(kv, 1);
        }
      }
      this._win_sig = nsig;
    }
    if (truthy(has(this.app_state, app_id))) {
      let ns = {};
      for (let kv of entries(this.app_state)) {
        if (truthy($ne($index(kv, 0), app_id))) {
          ns[$index(kv, 0)] = $index(kv, 1);
        }
      }
      this.app_state = ns;
    }
    if (truthy(has(this._terminals, app_id))) {
      $index($index(this._terminals, app_id), "pty").close();
      let nt = {};
      for (let kv of entries(this._terminals)) {
        if (truthy($ne($index(kv, 0), app_id))) {
          nt[$index(kv, 0)] = $index(kv, 1);
        }
      }
      this._terminals = nt;
    }
    return true;
  }
  focus(app_id) {
    if (truthy(!truthy(has(this.windows, app_id)))) {
      return false;
    }
    this.comp.focus($index(this.windows, app_id));
    this._dirty = true;
    return true;
  }
  running() {
    return keys(this.windows);
  }
  handle_mouse(me) {
    this._dirty = true;
    if (truthy(this.launcher_open)) {
      if (truthy(me.is_press)) {
        return this._launcher_click(me.x, me.y);
      }
      return true;
    }
    if (truthy(me.is_press)) {
      let hit = this._dock_hit(me.x, me.y);
      if (truthy($ne(hit, null))) {
        this._activate(hit);
        return true;
      }
      if (truthy(this._content_click(me.x, me.y))) {
        return true;
      }
    }
    return this.wm.handle_mouse(me);
  }
  _content_click(px, py) {
    let top = this.comp.top_window();
    if (truthy($eq(top, null))) {
      return false;
    }
    let app_id = null;
    for (let kv of entries(this.windows)) {
      if (truthy($eq($index(kv, 1), top))) {
        app_id = $index(kv, 0);
      }
    }
    if (truthy($ne(app_id, "prism"))) {
      return false;
    }
    let cr = top.content_rect();
    let r = prism_play_rect(top.x + $index(cr, 0), top.y + $index(cr, 1), $index(cr, 2), $index(cr, 3));
    if (truthy(this._in(px, py, $index(r, 0), $index(r, 1), $index(r, 2), $index(r, 3)))) {
      this._activate("voidrunner");
      return true;
    }
    return false;
  }
  handle_key(ke) {
    return this.wm.handle_key(ke);
  }
  set_key(name, down) {
    this.keys[name] = down;
    this._dirty = true;
  }
  terminal_input(text) {
    if (truthy(!truthy(has(this._terminals, "terminal")))) {
      return false;
    }
    $index($index(this._terminals, "terminal"), "pty").write(text);
    this._dirty = true;
    return true;
  }
  terminal_session(app_id) {
    if (truthy(has(this._terminals, app_id))) {
      return $index(this._terminals, app_id);
    }
    return null;
  }
  tick(now_ms) {
    if (truthy($ne(this._last_tick, null))) {
      let dt = now_ms - this._last_tick;
      if (truthy(has(this.windows, "voidrunner") && has(this.app_state, "voidrunner"))) {
        voidrunner_update($index(this.app_state, "voidrunner"), dt, this.keys);
      }
    }
    for (let kv of entries(this._terminals)) {
      let app_id = $index(kv, 0);
      let sess = $index(kv, 1);
      if (truthy(has(this.windows, app_id))) {
        let cr = $index(this.windows, app_id).content_rect();
        let cols = $int($index(cr, 2) / 8);
        let rows = $int($index(cr, 3) / 16);
        if (truthy(cols >= 1 && rows >= 1 && ($ne(cols, $index(sess, "term").cols) || $ne(rows, $index(sess, "term").rows)))) {
          $index(sess, "term").resize(cols, rows);
          $index(sess, "pty").resize(cols, rows);
          this._dirty = true;
        }
      }
      let out = $index(sess, "pty").read();
      if (truthy($eq(out, null))) {
        sess["dead"] = true;
      } else if (truthy(len(out) > 0)) {
        $index(sess, "term").feed(out);
        this._dirty = true;
      }
    }
    for (let kv of entries(this._anim)) {
      if (truthy($index(kv, 1) < 0)) {
        this._anim[$index(kv, 0)] = now_ms;
      }
    }
    if (truthy(this.launcher_open && this._launcher_t0 < 0)) {
      this._launcher_t0 = now_ms;
    }
    this._last_tick = now_ms;
    return true;
  }
  toggle_launcher() {
    this.launcher_open = !truthy(this.launcher_open);
    this._launcher_t0 = -1;
    this._dirty = true;
    return this.launcher_open;
  }
  resize(w, h) {
    let nw = w;
    let nh = h;
    if (truthy(nw < 320)) {
      nw = 320;
    }
    if (truthy(nh < 240)) {
      nh = 240;
    }
    if (truthy($eq(nw, this.width) && $eq(nh, this.height))) {
      return false;
    }
    this.width = nw;
    this.height = nh;
    this.comp.resize(nw, nh);
    this._wallpaper = null;
    this._dirty = true;
    return true;
  }
  _anim_state(app_id) {
    if (truthy($eq(app_id, null) || !truthy(has(this._anim, app_id)) || $eq(this._last_tick, null))) {
      return { ["active"]: false, ["scale"]: 1, ["alpha"]: 255 };
    }
    let start = $index(this._anim, app_id);
    if (truthy(start < 0)) {
      return { ["active"]: false, ["scale"]: 1, ["alpha"]: 255 };
    }
    let p = (this._last_tick - start) / WIN_ANIM_MS;
    if (truthy(p >= 1)) {
      let next = {};
      for (let kv of entries(this._anim)) {
        if (truthy($ne($index(kv, 0), app_id))) {
          next[$index(kv, 0)] = $index(kv, 1);
        }
      }
      this._anim = next;
      return { ["active"]: false, ["scale"]: 1, ["alpha"]: 255 };
    }
    let scale = 0.92 + 0.08 * _ease_out_back(p);
    let alpha = $int(255 * _ease_out_cubic(p));
    return { ["active"]: true, ["scale"]: scale, ["alpha"]: alpha };
  }
  _activate(app_id) {
    if (truthy(has(this.windows, app_id))) {
      this.comp.focus($index(this.windows, app_id));
      return $index(this.windows, app_id);
    }
    let b = this._default_bounds(app_id);
    return this.open(app_id, $index(b, 0), $index(b, 1), $index(b, 2), $index(b, 3));
  }
  _default_bounds(app_id) {
    let idx = len(keys(this.windows));
    let bx = $int(this.width * 0.12) + idx % 5 * 40;
    let by = $int(this.height * 0.14) + idx % 5 * 30;
    if (truthy($eq(app_id, "prism"))) {
      return [bx, by, 680, 460];
    }
    if (truthy($eq(app_id, "files"))) {
      return [bx, by, 420, 320];
    }
    if (truthy($eq(app_id, "terminal"))) {
      return [bx, by, 460, 280];
    }
    if (truthy($eq(app_id, "voidrunner"))) {
      return [bx, by, 560, 440];
    }
    return [bx, by, 500, 340];
  }
  _in(px, py, x, y, w, h) {
    return px >= x && px < x + w && py >= y && py < y + h;
  }
  _dock_layout() {
    let n = len(this.pinned);
    if (truthy($eq(n, 0))) {
      return null;
    }
    let dw = n * DOCK_ICON + (n - 1) * DOCK_GAP + 2 * DOCK_PAD;
    let dh = DOCK_ICON + 2 * DOCK_PAD;
    let dx = $int(this.width / 2) - $int(dw / 2);
    let dy = this.height - dh - DOCK_MARGIN;
    let icons = [];
    let ix = dx + DOCK_PAD;
    for (let app of this.pinned) {
      push(icons, { ["app"]: app, ["x"]: ix, ["y"]: dy + DOCK_PAD, ["size"]: DOCK_ICON });
      ix = ix + DOCK_ICON + DOCK_GAP;
    }
    return { ["x"]: dx, ["y"]: dy, ["w"]: dw, ["h"]: dh, ["icons"]: icons };
  }
  _dock_hit(px, py) {
    let layout = this._dock_layout();
    if (truthy($eq(layout, null))) {
      return null;
    }
    for (let ic of $index(layout, "icons")) {
      if (truthy(this._in(px, py, $index(ic, "x"), $index(ic, "y"), $index(ic, "size"), $index(ic, "size")))) {
        return $index(ic, "app");
      }
    }
    return null;
  }
  compose() {
    let s = this.comp.screen;
    if (truthy($eq(this._wallpaper, null))) {
      this._wallpaper = framebuffer(this.width, this.height);
      this._paint_wallpaper(this._wallpaper);
    }
    s.blit(this._wallpaper, 0, 0, 0, 0, this.width, this.height);
    for (let win of this.comp.windows) {
      if (truthy(!truthy(win.visible) || win.minimized)) {
        continue;
      }
      let app_id = this._app_of(win);
      let live = $ne(app_id, null) && has(this.app_state, app_id);
      let sig = str(win.focused) + ":" + str(win.width) + ":" + str(win.height);
      let cached = $ne(app_id, null) && has(this._win_sig, app_id) && $eq($index(this._win_sig, app_id), sig);
      if (truthy(live || !truthy(cached))) {
        this._paint_chrome(win);
        if (truthy($ne(app_id, null))) {
          this._win_sig[app_id] = sig;
        }
      }
      let anim = this._anim_state(app_id);
      if (truthy($index(anim, "active"))) {
        let cx = win.x + $int(win.width / 2);
        let cy = win.y + $int(win.height / 2);
        let dw = $int(win.width * $index(anim, "scale"));
        let dh = $int(win.height * $index(anim, "scale"));
        let dx = cx - $int(dw / 2);
        let dy = cy - $int(dh / 2);
        let sh_a = $int(150 * $index(anim, "alpha") / 255);
        drop_shadow(s, dx, dy, dw, dh, WIN_RADIUS, rgba(0, 0, 0, sh_a), 7);
        blit_scaled_alpha(s, win.framebuffer, dx, dy, dw, dh, $index(anim, "alpha"));
      } else {
        drop_shadow(s, win.x, win.y, win.width, win.height, WIN_RADIUS, rgba(0, 0, 0, 150), 7);
        blit_rounded(s, win.framebuffer, win.x, win.y, win.width, win.height, WIN_RADIUS);
      }
    }
    this._paint_dock(s);
    if (truthy(this.launcher_open)) {
      this._paint_launcher(s);
    }
    this.frames = this.frames + 1;
    this._dirty = false;
    return s;
  }
  screenshot(path) {
    this.compose();
    this.comp.screen.save_bmp(path);
    return path;
  }
  _paint_wallpaper(fb) {
    let t = this.theme;
    fb.clear($index(t, "background"));
    let top_h = $int(this.height * 0.62);
    linear_gradient(fb, 0, 0, this.width, top_h, [{ ["t"]: 0, ["color"]: rgba(124, 58, 237, 64) }, { ["t"]: 1, ["color"]: rgba(124, 58, 237, 0) }], "v");
    let bot_y = $int(this.height * 0.45);
    linear_gradient(fb, 0, bot_y, this.width, this.height - bot_y, [{ ["t"]: 0, ["color"]: rgba(34, 211, 238, 0) }, { ["t"]: 1, ["color"]: rgba(34, 211, 238, 48) }], "v");
  }
  _paint_chrome(win) {
    let fb = win.framebuffer;
    let t = this.theme;
    let w = win.width;
    let h = win.height;
    let th = win.title_h;
    fb.clear($index(t, "surface"));
    fill_rect(fb, 0, 0, w, th, $index(t, "surface_elevated"));
    if (truthy(win.focused)) {
      linear_gradient(fb, 0, 0, w, 3, kyan_gradient_stops(), "h");
    } else {
      fill_rect(fb, 0, 0, w, 3, $index(t, "border"));
    }
    let dy = $int(th / 2) - 5;
    fill_rect(fb, 14, dy, 10, 10, 4294668677);
    fill_rect(fb, 30, dy, 10, 10, 4294688548);
    fill_rect(fb, 46, dy, 10, 10, 4281652121);
    let tw = $index(measure_atlas_text(this._atlas, win.title, 15, 0), 0);
    let tx = $int(w / 2) - $int(tw / 2);
    let tcol = truthy(win.focused) ? $index(t, "foreground") : $index(t, "foreground_muted");
    draw_atlas_text(fb, tx, $int((th - 15) / 2), win.title, this._atlas, tcol, { ["size"]: 15 });
    fill_rect(fb, 0, th - 1, w, 1, $index(t, "border"));
    this._paint_content(win);
  }
  _paint_content(win) {
    let fb = win.framebuffer;
    let t = this.theme;
    let cr = win.content_rect();
    let cx = $index(cr, 0);
    let cy = $index(cr, 1);
    let cw = $index(cr, 2);
    let ch = $index(cr, 3);
    if (truthy(cw <= 0 || ch <= 0)) {
      return null;
    }
    let app_id = null;
    for (let kv of entries(this.windows)) {
      if (truthy($eq($index(kv, 1), win))) {
        app_id = $index(kv, 0);
      }
    }
    if (truthy($eq(app_id, "voidrunner") && has(this.app_state, "voidrunner"))) {
      voidrunner_paint(fb, cx, cy, cw, ch, t, $index(this.app_state, "voidrunner"));
      return null;
    }
    if (truthy($eq(app_id, "terminal") && has(this._terminals, "terminal"))) {
      this._render_terminal(fb, cx, cy, cw, ch, $index(this._terminals, "terminal"));
      return null;
    }
    if (truthy($ne(app_id, null) && has(this.painters, app_id))) {
      $index(this.painters, app_id)(fb, cx, cy, cw, ch, t, win.focused);
      return null;
    }
    let i = 0;
    while (truthy(i < 5)) {
      let ry = cy + 12 + i * 22;
      if (truthy(ry < cy + ch - 8)) {
        fill_rect(fb, cx + 20, ry, $int((cw - 40) * (0.8 - i * 0.1)), 8, $index(t, "border"));
      }
      i = i + 1;
    }
  }
  _render_terminal(fb, x, y, w, h, sess) {
    let term = $index(sess, "term");
    fill_rect(fb, x, y, w, h, 4278519306);
    let cw = 8;
    let chh = 16;
    let r = 0;
    while (truthy(r < term.rows)) {
      let c = 0;
      while (truthy(c < term.cols)) {
        let cell = term.cell_at(r, c);
        if (truthy($ne(cell, null))) {
          let gx = x + c * cw;
          let gy = y + r * chh;
          if (truthy(gx + cw <= x + w && gy + chh <= y + h)) {
            if (truthy($ne(cell.bg, 4279900698))) {
              fill_rect(fb, gx, gy, cw, chh, cell.bg);
            }
            if (truthy($ne(cell.ch, " "))) {
              draw_text(fb, gx, gy + 4, cell.ch, this.font, cell.fg);
            }
          }
        }
        c = c + 1;
      }
      r = r + 1;
    }
    if (truthy($eq(term._scroll_offset, 0))) {
      let curx = x + term.cursor_col * cw;
      let cury = y + term.cursor_row * chh;
      if (truthy(curx + cw <= x + w && cury + chh <= y + h)) {
        fill_rect(fb, curx, cury + chh - 2, cw, 2, $index(this.theme, "accent"));
      }
    }
  }
  _paint_dock(fb) {
    let layout = this._dock_layout();
    if (truthy($eq(layout, null))) {
      return null;
    }
    let dx = $index(layout, "x");
    let dy = $index(layout, "y");
    let dw = $index(layout, "w");
    let dh = $index(layout, "h");
    drop_shadow(fb, dx, dy, dw, dh, 18, rgba(0, 0, 0, 120), 7);
    frosted_panel(fb, dx, dy, dw, dh, 18, rgba(13, 17, 26, 150), 6);
    for (let ic of $index(layout, "icons")) {
      let bg = fb.get_pixel($index(ic, "x"), $index(ic, "y"));
      fb.blit(this._icon($index(ic, "app"), $index(ic, "size"), bg), 0, 0, $index(ic, "x"), $index(ic, "y"), $index(ic, "size"), $index(ic, "size"));
      if (truthy(has(this.windows, $index(ic, "app")))) {
        fill_rect(fb, $index(ic, "x") + $int($index(ic, "size") / 2) - 2, dy + dh - 5, 4, 4, $index(this.theme, "accent"));
      }
    }
  }
  _paint_launcher(fb) {
    let t = this.theme;
    let p = 1;
    if (truthy(this._launcher_t0 >= 0 && $ne(this._last_tick, null))) {
      p = (this._last_tick - this._launcher_t0) / LAUNCHER_ANIM_MS;
      if (truthy(p > 1)) {
        p = 1;
      }
    }
    let off = $int((1 - _ease_out_back(p)) * -14);
    let scrim_a = $int(170 * _ease_out_cubic(p));
    fill_rect_blend(fb, 0, 0, this.width, this.height, rgba(5, 6, 10, scrim_a));
    let bw = $int(this.width * 0.5);
    let bx = $int(this.width / 2) - $int(bw / 2);
    let by = $int(this.height * 0.24) + off;
    drop_shadow(fb, bx, by, bw, 44, 12, rgba(0, 0, 0, 140), 8);
    frosted_panel(fb, bx, by, bw, 44, 12, rgba(13, 17, 26, 205), 7);
    linear_gradient(fb, bx, by, bw, 3, kyan_gradient_stops(), "h");
    draw_atlas_text(fb, bx + 18, by + 13, "Search apps, files, commands", this._atlas, $index(t, "foreground_muted"), { ["size"]: 18 });
    let layout = this._launcher_layout();
    let cell = $index(layout, "cell");
    let gy = $index(layout, "gy") + off;
    for (let c of $index(layout, "cells")) {
      let ix = $index(c, "x") + $int((cell - 52) / 2);
      let bg = fb.get_pixel(ix, gy);
      fb.blit(this._icon($index(c, "app"), 52, bg), 0, 0, ix, gy, 52, 52);
      let label = truthy(has(APP_TITLES, $index(c, "app"))) ? $index(APP_TITLES, $index(c, "app")) : $index(c, "app");
      let lw = $index(measure_atlas_text(this._atlas, label, 14, 0), 0);
      draw_atlas_text(fb, $index(c, "x") + $int((cell - lw) / 2), gy + 58, label, this._atlas, $index(t, "foreground"), { ["size"]: 14 });
    }
  }
  _launcher_layout() {
    let cols = len(this.pinned);
    let cell = 84;
    let gw = cols * cell;
    let gx = $int(this.width / 2) - $int(gw / 2);
    let by = $int(this.height * 0.24);
    let gy = by + 92;
    let cells = [];
    let cx = gx;
    for (let app of this.pinned) {
      push(cells, { ["app"]: app, ["x"]: cx, ["y"]: gy - 6, ["w"]: cell, ["h"]: 80 });
      cx = cx + cell;
    }
    return { ["by"]: by, ["gy"]: gy, ["gx"]: gx, ["cell"]: cell, ["cells"]: cells };
  }
  _launcher_click(px, py) {
    let layout = this._launcher_layout();
    for (let c of $index(layout, "cells")) {
      if (truthy(this._in(px, py, $index(c, "x"), $index(c, "y"), $index(c, "w"), $index(c, "h")))) {
        this.launcher_open = false;
        this._activate($index(c, "app"));
        return true;
      }
    }
    this.launcher_open = false;
    return true;
  }
}
function kyan_desktop(width, height, ...rest) {
  let theme = truthy(len(rest) > 0) ? $index(rest, 0) : kyan_obsidian();
  return new KyanDesktop(width, height, theme);
}

// web/build/entry.js
function createDesktop(w, h) {
  const desk = kyan_desktop(w, h, kyan_obsidian());
  desk.boot(null);
  return desk;
}
function composeToBytes(desk) {
  const fb = desk.compose();
  return {
    bytes: fb.buffer._handle._buffer,
    width: fb.width,
    height: fb.height
  };
}
function sendMouse(desk, x, y, kind, button = 0) {
  const me = new MouseEvent;
  me.x = x | 0;
  me.y = y | 0;
  me.button = button | 0;
  me.is_press = kind === "press";
  me.is_release = kind === "release";
  me.is_motion = kind === "motion";
  desk.handle_mouse(me);
  return me;
}
function openApp(desk, appId, x, y, w, h) {
  return desk.open(appId, x, y, w, h);
}
function toggleLauncher(desk) {
  return desk.toggle_launcher();
}
function setKey(desk, name, down) {
  desk.set_key(name, !!down);
}
function tick(desk, nowMs) {
  desk.tick(nowMs);
}
function needsRedraw(desk) {
  return desk.needs_redraw();
}
globalThis.KyanOS = { createDesktop, composeToBytes, sendMouse, openApp, toggleLauncher, setKey, tick, needsRedraw, MouseEvent };
export {
  toggleLauncher,
  tick,
  setKey,
  sendMouse,
  openApp,
  needsRedraw,
  createDesktop,
  composeToBytes,
  MouseEvent
};
