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
function chars(s) {
  return s.split("");
}
function char_at(s, i) {
  return s[i] ?? null;
}
function char_code(s) {
  return s.charCodeAt(0);
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
function line(fb, x0, y0, x1, y1, color) {
  let x = x0;
  let y = y0;
  let dx = truthy(x1 > x0) ? x1 - x0 : x0 - x1;
  let dy = truthy(y1 > y0) ? y1 - y0 : y0 - y1;
  let sx = truthy(x0 < x1) ? 1 : -1;
  let sy = truthy(y0 < y1) ? 1 : -1;
  let nd = -dy;
  let err = dx + nd;
  let done = false;
  while (truthy(!truthy(done))) {
    fb.put_pixel(x, y, color);
    if (truthy($eq(x, x1) && $eq(y, y1))) {
      done = true;
    } else {
      let e2 = 2 * err;
      if (truthy(e2 >= nd)) {
        err += nd;
        x += sx;
      }
      if (truthy(e2 <= dx)) {
        err += dx;
        y += sy;
      }
    }
  }
}
function hline(fb, x0, y, x1, color) {
  let xa = truthy(x0 < x1) ? x0 : x1;
  let xb = truthy(x0 < x1) ? x1 : x0;
  fb.fill_rect(xa, y, xb - xa + 1, 1, color);
}
function rect(fb, x, y, w, h, color) {
  fb.stroke_rect(x, y, w, h, color);
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
function rounded_rect(fb, x, y, w, h, radius, color) {
  let r = truthy(radius * 2 > w) ? w / 2 : radius;
  let r2 = truthy(r * 2 > h) ? h / 2 : r;
  if (truthy(r2 <= 0)) {
    fb.fill_rect(x, y, w, h, color);
    return null;
  }
  fb.fill_rect(x + r2, y, w - 2 * r2, h, color);
  fb.fill_rect(x, y + r2, r2, h - 2 * r2, color);
  fb.fill_rect(x + w - r2, y + r2, r2, h - 2 * r2, color);
  let dy = 0 - r2;
  while (truthy(dy <= 0)) {
    let dx = 0;
    while (truthy((dx + 1) * (dx + 1) + dy * dy <= r2 * r2)) {
      dx += 1;
    }
    let row_top = y + r2 + dy;
    let row_bot = y + h - 1 - r2 - dy;
    hline(fb, x + r2 - dx, row_top, x + w - r2 + dx - 1, color);
    hline(fb, x + r2 - dx, row_bot, x + w - r2 + dx - 1, color);
    dy += 1;
  }
}
function polygon(fb, points, color) {
  let n = len(points);
  if (truthy(n < 2)) {
    return null;
  }
  let i = 0;
  while (truthy(i < n)) {
    let a = $index(points, i);
    let b = $index(points, (i + 1) % n);
    line(fb, $index(a, 0), $index(a, 1), $index(b, 0), $index(b, 1), color);
    i += 1;
  }
}
function polyline(fb, points, color) {
  let n = len(points);
  if (truthy(n < 2)) {
    return null;
  }
  let i = 0;
  while (truthy(i < n - 1)) {
    let a = $index(points, i);
    let b = $index(points, i + 1);
    line(fb, $index(a, 0), $index(a, 1), $index(b, 0), $index(b, 1), color);
    i += 1;
  }
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
  let r = truthy(radius * 2 > w) ? w / 2 : radius;
  let r2 = truthy(r * 2 > h) ? h / 2 : r;
  if (truthy(r2 <= 0)) {
    fill_rect_blend(fb, x, y, w, h, color);
    return null;
  }
  fill_rect_blend(fb, x + r2, y, w - 2 * r2, h, color);
  fill_rect_blend(fb, x, y + r2, r2, h - 2 * r2, color);
  fill_rect_blend(fb, x + w - r2, y + r2, r2, h - 2 * r2, color);
  let dy = 0 - r2;
  while (truthy(dy <= 0)) {
    let dx = 0;
    while (truthy((dx + 1) * (dx + 1) + dy * dy <= r2 * r2)) {
      dx += 1;
    }
    let row_top = y + r2 + dy;
    let row_bot = y + h - 1 - r2 - dy;
    _hline_blend(fb, x + r2 - dx, row_top, x + w - r2 + dx - 1, color);
    _hline_blend(fb, x + r2 - dx, row_bot, x + w - r2 + dx - 1, color);
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
    rounded_rect_blend(fb, x - i, y - i + off, w + 2 * i, h + 2 * i, radius + i, per * 16777216 + rgb2);
    i -= 1;
  }
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
function measure_text(font, text) {
  return [len(text) * font.width, font.height];
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
function draw_text_scaled(fb, x, y, text, font, color, scale, tracking) {
  let s = truthy($eq(scale, null) || scale < 1) ? 1 : scale;
  let track = truthy($eq(tracking, null)) ? 0 : tracking;
  let fw = font.width;
  let fh = font.height;
  let sa = $int(color / 16777216) & 255;
  let by = $int(y);
  let chs = chars(text);
  let cx = $int(x);
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
            let px = cx + bit * s;
            let py = by + row * s;
            if (truthy($eq(sa, 255))) {
              fb.fill_rect(px, py, s, s, color);
            } else {
              fill_rect_blend(fb, px, py, s, s, color);
            }
          }
          bit += 1;
        }
        row += 1;
      }
    }
    cx += fw * s + track;
    i += 1;
  }
  return cx - x;
}
var _BUILTIN_GLYPHS = { ["32"]: [0, 0, 0, 0, 0, 0, 0, 0], ["33"]: [24, 24, 24, 24, 24, 0, 24, 0], ["34"]: [54, 54, 0, 0, 0, 0, 0, 0], ["35"]: [54, 54, 127, 54, 127, 54, 54, 0], ["36"]: [24, 62, 96, 60, 6, 124, 24, 0], ["37"]: [102, 108, 24, 48, 102, 102, 0, 0], ["38"]: [56, 108, 104, 118, 108, 110, 54, 0], ["39"]: [24, 24, 0, 0, 0, 0, 0, 0], ["40"]: [12, 24, 48, 48, 48, 24, 12, 0], ["41"]: [48, 24, 12, 12, 12, 24, 48, 0], ["42"]: [0, 102, 60, 255, 60, 102, 0, 0], ["43"]: [0, 24, 24, 126, 24, 24, 0, 0], ["44"]: [0, 0, 0, 0, 0, 24, 24, 48], ["45"]: [0, 0, 0, 126, 0, 0, 0, 0], ["46"]: [0, 0, 0, 0, 0, 0, 24, 0], ["47"]: [6, 12, 24, 48, 96, 192, 128, 0], ["48"]: [60, 102, 110, 118, 102, 102, 60, 0], ["49"]: [24, 56, 24, 24, 24, 24, 126, 0], ["50"]: [60, 102, 6, 12, 24, 48, 126, 0], ["51"]: [60, 102, 6, 28, 6, 102, 60, 0], ["52"]: [6, 14, 30, 102, 127, 6, 6, 0], ["53"]: [126, 96, 124, 6, 6, 102, 60, 0], ["54"]: [60, 102, 96, 124, 102, 102, 60, 0], ["55"]: [126, 102, 6, 12, 24, 24, 24, 0], ["56"]: [60, 102, 102, 60, 102, 102, 60, 0], ["57"]: [60, 102, 102, 62, 6, 102, 60, 0], ["58"]: [0, 24, 24, 0, 0, 24, 24, 0], ["59"]: [0, 24, 24, 0, 0, 24, 24, 48], ["60"]: [14, 24, 48, 96, 48, 24, 14, 0], ["61"]: [0, 0, 126, 0, 126, 0, 0, 0], ["62"]: [112, 24, 12, 6, 12, 24, 112, 0], ["63"]: [60, 102, 6, 12, 24, 0, 24, 0], ["64"]: [60, 102, 110, 110, 96, 102, 60, 0], ["65"]: [24, 60, 102, 102, 126, 102, 102, 0], ["66"]: [124, 102, 102, 124, 102, 102, 124, 0], ["67"]: [60, 102, 96, 96, 96, 102, 60, 0], ["68"]: [120, 108, 102, 102, 102, 108, 120, 0], ["69"]: [126, 96, 96, 120, 96, 96, 126, 0], ["70"]: [126, 96, 96, 120, 96, 96, 96, 0], ["71"]: [60, 102, 96, 110, 102, 102, 60, 0], ["72"]: [102, 102, 102, 126, 102, 102, 102, 0], ["73"]: [60, 24, 24, 24, 24, 24, 60, 0], ["74"]: [30, 12, 12, 12, 12, 108, 56, 0], ["75"]: [102, 108, 120, 112, 120, 108, 102, 0], ["76"]: [96, 96, 96, 96, 96, 96, 126, 0], ["77"]: [99, 119, 127, 107, 99, 99, 99, 0], ["78"]: [102, 118, 126, 126, 110, 102, 102, 0], ["79"]: [60, 102, 102, 102, 102, 102, 60, 0], ["80"]: [124, 102, 102, 124, 96, 96, 96, 0], ["81"]: [60, 102, 102, 102, 102, 60, 14, 0], ["82"]: [124, 102, 102, 124, 120, 108, 102, 0], ["83"]: [60, 102, 96, 60, 6, 102, 60, 0], ["84"]: [126, 24, 24, 24, 24, 24, 24, 0], ["85"]: [102, 102, 102, 102, 102, 102, 60, 0], ["86"]: [102, 102, 102, 102, 102, 60, 24, 0], ["87"]: [99, 99, 99, 107, 127, 119, 99, 0], ["88"]: [102, 102, 60, 24, 60, 102, 102, 0], ["89"]: [102, 102, 102, 60, 24, 24, 24, 0], ["90"]: [126, 6, 12, 24, 48, 96, 126, 0], ["91"]: [60, 48, 48, 48, 48, 48, 60, 0], ["92"]: [192, 96, 48, 24, 12, 6, 2, 0], ["93"]: [60, 12, 12, 12, 12, 12, 60, 0], ["94"]: [24, 60, 102, 0, 0, 0, 0, 0], ["95"]: [0, 0, 0, 0, 0, 0, 0, 255], ["96"]: [48, 24, 12, 0, 0, 0, 0, 0], ["97"]: [0, 0, 60, 6, 62, 102, 62, 0], ["98"]: [96, 96, 124, 102, 102, 102, 124, 0], ["99"]: [0, 0, 60, 102, 96, 102, 60, 0], ["100"]: [6, 6, 62, 102, 102, 102, 62, 0], ["101"]: [0, 0, 60, 102, 126, 96, 60, 0], ["102"]: [28, 54, 48, 120, 48, 48, 48, 0], ["103"]: [0, 0, 62, 102, 102, 62, 6, 124], ["104"]: [96, 96, 124, 102, 102, 102, 102, 0], ["105"]: [24, 0, 56, 24, 24, 24, 60, 0], ["106"]: [6, 0, 6, 6, 6, 6, 102, 60], ["107"]: [96, 96, 102, 108, 120, 108, 102, 0], ["108"]: [56, 24, 24, 24, 24, 24, 60, 0], ["109"]: [0, 0, 102, 127, 127, 107, 99, 0], ["110"]: [0, 0, 124, 102, 102, 102, 102, 0], ["111"]: [0, 0, 60, 102, 102, 102, 60, 0], ["112"]: [0, 0, 124, 102, 102, 124, 96, 96], ["113"]: [0, 0, 62, 102, 102, 62, 6, 6], ["114"]: [0, 0, 124, 102, 96, 96, 96, 0], ["115"]: [0, 0, 62, 96, 60, 6, 124, 0], ["116"]: [48, 48, 120, 48, 48, 54, 28, 0], ["117"]: [0, 0, 102, 102, 102, 102, 62, 0], ["118"]: [0, 0, 102, 102, 102, 60, 24, 0], ["119"]: [0, 0, 99, 107, 127, 127, 54, 0], ["120"]: [0, 0, 102, 60, 24, 60, 102, 0], ["121"]: [0, 0, 102, 102, 102, 62, 6, 124], ["122"]: [0, 0, 126, 12, 24, 48, 126, 0], ["123"]: [14, 24, 24, 112, 24, 24, 14, 0], ["124"]: [24, 24, 24, 24, 24, 24, 24, 0], ["125"]: [112, 24, 24, 14, 24, 24, 112, 0], ["126"]: [118, 220, 0, 0, 0, 0, 0, 0] };
function builtin_font() {
  return new Font(8, 8, _BUILTIN_GLYPHS);
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
function kyan_gradient(theme, t) {
  let clamped = t;
  if (truthy(clamped < 0)) {
    clamped = 0;
  }
  if (truthy(clamped > 1)) {
    clamped = 1;
  }
  return _lerp_along(kyan_gradient_stops(), clamped);
}
function _lerp_along(stops, t) {
  let i = 0;
  while (truthy(i < len(stops) - 1)) {
    let a = $index(stops, i);
    let b = $index(stops, i + 1);
    if (truthy(t >= $index(a, "t") && t <= $index(b, "t"))) {
      let span = $index(b, "t") - $index(a, "t");
      let local = truthy($eq(span, 0)) ? 0 : (t - $index(a, "t")) / span;
      return _lerp_color($index(a, "color"), $index(b, "color"), local);
    }
    i = i + 1;
  }
  return $index($index(stops, len(stops) - 1), "color");
}
function _lerp_color(a, b, t) {
  let aa = $int(a / 16777216) & 255;
  let ar = $int(a / 65536) & 255;
  let ag = $int(a / 256) & 255;
  let ab = a & 255;
  let ba = $int(b / 16777216) & 255;
  let br = $int(b / 65536) & 255;
  let bg = $int(b / 256) & 255;
  let bb = b & 255;
  let oa = $int(aa + (ba - aa) * t);
  let or_ = $int(ar + (br - ar) * t);
  let og = $int(ag + (bg - ag) * t);
  let ob = $int(ab + (bb - ab) * t);
  return oa * 16777216 + or_ * 65536 + og * 256 + ob;
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

// web/build/branding_modern.js
var APP_ICONS = { ["terminal"]: { ["mark"]: "wave", ["accent"]: "primary" }, ["files"]: { ["mark"]: "stack", ["accent"]: "secondary" }, ["editor"]: { ["mark"]: "stripes", ["accent"]: "tertiary" }, ["calc"]: { ["mark"]: "grid", ["accent"]: "highlight" }, ["viewer"]: { ["mark"]: "frame", ["accent"]: "primary_dark" }, ["monitor"]: { ["mark"]: "pulse", ["accent"]: "secondary" }, ["browser"]: { ["mark"]: "ring", ["accent"]: "highlight" }, ["mail"]: { ["mark"]: "envelope", ["accent"]: "tertiary" }, ["chat"]: { ["mark"]: "bubble", ["accent"]: "primary" }, ["store"]: { ["mark"]: "diamond", ["accent"]: "secondary" }, ["settings"]: { ["mark"]: "cog", ["accent"]: "ink_soft" } };
function _accent_color(theme, key) {
  if (truthy(has(theme, key))) {
    return $index(theme, key);
  }
  return $index(theme, "primary");
}
function paint_icon(fb, app_id, x, y, size, theme) {
  if (truthy(!truthy(has(APP_ICONS, app_id)))) {
    _draw_blank(fb, x, y, size, theme);
    return false;
  }
  let recipe = $index(APP_ICONS, app_id);
  let accent = _accent_color(theme, $index(recipe, "accent"));
  let radius = $int(size / 5);
  rounded_rect(fb, x, y, size, size, radius, $index(theme, "surface"));
  fill_rect(fb, x, y, size, $max2(2, $int(size / 16)), accent);
  let inset = $int(size * 0.22);
  let cx = x + size / 2;
  let cy = y + size / 2;
  let r = $int((size - inset * 2) / 2);
  let mark = $index(recipe, "mark");
  if (truthy($eq(mark, "wave"))) {
    _mark_wave(fb, cx, cy, r, accent);
  } else if (truthy($eq(mark, "stack"))) {
    _mark_stack(fb, cx, cy, r, accent);
  } else if (truthy($eq(mark, "stripes"))) {
    _mark_stripes(fb, cx, cy, r, accent);
  } else if (truthy($eq(mark, "grid"))) {
    _mark_grid(fb, cx, cy, r, accent);
  } else if (truthy($eq(mark, "frame"))) {
    _mark_frame(fb, cx, cy, r, accent);
  } else if (truthy($eq(mark, "pulse"))) {
    _mark_pulse(fb, cx, cy, r, accent);
  } else if (truthy($eq(mark, "ring"))) {
    _mark_ring(fb, cx, cy, r, accent);
  } else if (truthy($eq(mark, "envelope"))) {
    _mark_envelope(fb, cx, cy, r, accent);
  } else if (truthy($eq(mark, "bubble"))) {
    _mark_bubble(fb, cx, cy, r, accent);
  } else if (truthy($eq(mark, "diamond"))) {
    _mark_diamond(fb, cx, cy, r, accent);
  } else if (truthy($eq(mark, "cog"))) {
    _mark_cog(fb, cx, cy, r, accent);
  }
  return true;
}
function _draw_blank(fb, x, y, size, theme) {
  rounded_rect(fb, x, y, size, size, $int(size / 5), $index(theme, "surface"));
  fill_rect(fb, x, y, size, $max2(2, $int(size / 16)), $index(theme, "accent"));
}
function _mark_wave(fb, cx, cy, r, color) {
  fill_rect(fb, cx - r, cy - r / 2 - 4, r * 2, 4, color);
  fill_rect(fb, cx - r + r / 3, cy - 2, r * 2 - r / 3, 4, color);
  fill_rect(fb, cx - r, cy + r / 2 - 4, r * 2 - r / 3, 4, color);
}
function _mark_stack(fb, cx, cy, r, color) {
  fill_rect(fb, cx - r + 2, cy - r + 2, r * 2 - 4, r * 2 / 3, color);
  fill_rect(fb, cx - r, cy - r + r / 3, r * 2, r * 2 / 3, color);
  fill_rect(fb, cx - r + 2, cy - r + r * 2 / 3 - 2, r * 2 - 4, r * 2 / 3, color);
}
function _mark_stripes(fb, cx, cy, r, color) {
  fill_rect(fb, cx - r, cy - r, r * 2, 3, color);
  fill_rect(fb, cx - r, cy - 1, r * 7 / 4, 3, color);
  fill_rect(fb, cx - r, cy + r - 4, r * 6 / 4, 3, color);
}
function _mark_grid(fb, cx, cy, r, color) {
  let d = $max2(3, r / 3);
  fill_rect(fb, cx - r, cy - r, d, d, color);
  fill_rect(fb, cx + r - d, cy - r, d, d, color);
  fill_rect(fb, cx - r, cy + r - d, d, d, color);
  fill_rect(fb, cx + r - d, cy + r - d, d, d, color);
  fill_rect(fb, cx - d / 2, cy - d / 2, d, d, color);
}
function _mark_frame(fb, cx, cy, r, color) {
  rect(fb, cx - r, cy - r, r * 2, r * 2, color);
  fill_rect(fb, cx - r + 4, cy + r / 2, r * 2 - 8, 2, color);
  circle(fb, cx + r / 3, cy - r / 4, $max2(2, r / 5), color);
}
function _mark_pulse(fb, cx, cy, r, color) {
  fill_rect(fb, cx - r, cy - 1, r / 2, 3, color);
  fill_rect(fb, cx - r / 2, cy - r, 3, r * 2, color);
  fill_rect(fb, cx - r / 2, cy - r, r / 3, 3, color);
  fill_rect(fb, cx - r / 6, cy + r - 3, 3, 3, color);
  fill_rect(fb, cx - r / 6, cy + r - 3, r * 5 / 6, 3, color);
}
function _mark_ring(fb, cx, cy, r, color) {
  circle(fb, cx, cy, r, color);
}
function _mark_envelope(fb, cx, cy, r, color) {
  rect(fb, cx - r, cy - r * 2 / 3, r * 2, r * 4 / 3, color);
  line(fb, cx - r, cy - r * 2 / 3, cx, cy + r / 4, color);
  line(fb, cx + r, cy - r * 2 / 3, cx, cy + r / 4, color);
}
function _mark_bubble(fb, cx, cy, r, color) {
  rounded_rect(fb, cx - r, cy - r, r * 2, r * 5 / 4, $max2(3, r / 3), color);
  polygon(fb, [[cx - r / 2 + 2, cy + r / 4], [cx - r + 2, cy + r], [cx, cy + r / 4]], color);
}
function _mark_diamond(fb, cx, cy, r, color) {
  polygon(fb, [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]], color);
}
function _mark_cog(fb, cx, cy, r, color) {
  circle(fb, cx, cy, r, color);
  let tooth_w = $max2(3, r / 4);
  let tooth_h = $max2(3, r / 3);
  fill_rect(fb, cx - tooth_w / 2, cy - r - tooth_h, tooth_w, tooth_h, color);
  fill_rect(fb, cx - tooth_w / 2, cy + r, tooth_w, tooth_h, color);
  fill_rect(fb, cx - r - tooth_h, cy - tooth_w / 2, tooth_h, tooth_w, color);
  fill_rect(fb, cx + r, cy - tooth_w / 2, tooth_h, tooth_w, color);
}
function $max2(a, b) {
  if (truthy(a > b)) {
    return a;
  }
  return b;
}

// web/build/branding_kyan.js
function paint_prism_icon(fb, x, y, size, theme) {
  let radius = $int(size / 5);
  rounded_rect(fb, x, y, size, size, radius, $index(theme, "surface"));
  let edge = kyan_gradient(theme, 0.85);
  fill_rect(fb, x, y, size, $max3(2, $int(size / 16)), edge);
  let cx = x + size / 2;
  let top = y + $int(size * 0.24);
  let bot = y + $int(size * 0.74);
  let half = $int(size * 0.26);
  polyline(fb, [[cx, top], [cx + half, bot], [cx - half, bot], [cx, top]], edge);
  line(fb, cx, top, cx, bot, $index(theme, "accent_secondary"));
}
function paint_kyan_icon(fb, app_id, x, y, size, theme) {
  if (truthy($eq(app_id, "prism"))) {
    paint_prism_icon(fb, x, y, size, theme);
    return true;
  }
  return paint_icon(fb, app_id, x, y, size, theme);
}
function $max3(a, b) {
  if (truthy(a > b)) {
    return a;
  }
  return b;
}

// web/build/kyan_apps.js
var _GAME_ARTS = [[{ ["t"]: 0, ["color"]: 4286331629 }, { ["t"]: 1, ["color"]: 4280472558 }], [{ ["t"]: 0, ["color"]: 4294668677 }, { ["t"]: 1, ["color"]: 4283385573 }], [{ ["t"]: 0, ["color"]: 4279150057 }, { ["t"]: 1, ["color"]: 4281652121 }], [{ ["t"]: 0, ["color"]: 4294688548 }, { ["t"]: 1, ["color"]: 4286331629 }]];
var _GAME_NAMES = ["Hexfield", "Orbit Decay", "Verdant", "Ash Fable"];
var _GAME_META = ["Strategy", "Arcade", "Puzzle", "RPG"];
function paint_prism(fb, x, y, w, h, theme, focused) {
  let t = theme;
  let font = builtin_font();
  let sw = 132;
  fill_rect(fb, x, y, sw, h, $index(t, "surface_elevated"));
  fill_rect(fb, x + sw - 1, y, 1, h, $index(t, "border"));
  _prism_head(fb, x + 14, y + 16, "PLAY", t, font);
  _prism_item(fb, x + 10, y + 32, sw - 20, "Library", t, font, true);
  _prism_item(fb, x + 10, y + 56, sw - 20, "Store", t, font, false);
  _prism_item(fb, x + 10, y + 80, sw - 20, "Friends", t, font, false);
  _prism_head(fb, x + 14, y + 112, "BUILD", t, font);
  _prism_item(fb, x + 10, y + 128, sw - 20, "Forge", t, font, false);
  _prism_item(fb, x + 10, y + 152, sw - 20, "Assets", t, font, false);
  let mx = x + sw + 18;
  let mw = w - sw - 36;
  if (truthy(mw < 40)) {
    return null;
  }
  let fh = 120;
  let fy = y + 18;
  linear_gradient(fb, mx, fy, mw, fh, [{ ["t"]: 0, ["color"]: 4279439394 }, { ["t"]: 1, ["color"]: 4278920256 }], "h");
  linear_gradient(fb, mx, fy, mw, 3, kyan_gradient_stops(), "h");
  draw_text(fb, mx + 18, fy + 16, "FEATURED - BUILT IN CLARITY", font, $index(t, "accent"));
  draw_text_scaled(fb, mx + 18, fy + 34, "Voidrunner", font, 4294967295, 2, 1);
  draw_text(fb, mx + 18, fy + 66, "Outrun the collapse of a dying star system.", font, $index(t, "foreground_muted"));
  rounded_rect(fb, mx + 18, fy + fh - 34, 90, 24, 8, $index(t, "accent"));
  draw_text(fb, mx + 34, fy + fh - 27, "> Play", font, 4278519306);
  let gy = fy + fh + 18;
  let cols = 4;
  let gap = 12;
  let cw = $int((mw - (cols - 1) * gap) / cols);
  let ch = 96;
  let i = 0;
  while (truthy(i < cols)) {
    let gx = mx + i * (cw + gap);
    if (truthy(gy + ch < y + h)) {
      _prism_game(fb, gx, gy, cw, ch, i, t, font);
    }
    i = i + 1;
  }
}
function _prism_head(fb, x, y, text, t, font) {
  draw_text(fb, x, y, text, font, $index(t, "foreground_muted"));
}
function _prism_item(fb, x, y, w, text, t, font, active) {
  if (truthy(active)) {
    rounded_rect(fb, x, y, w, 20, 6, $index(t, "accent_tertiary"));
    draw_text(fb, x + 10, y + 6, text, font, 4294967295);
  } else {
    draw_text(fb, x + 10, y + 6, text, font, $index(t, "foreground_muted"));
  }
}
function _prism_game(fb, x, y, w, h, idx, t, font) {
  let art_h = h - 26;
  linear_gradient(fb, x, y, w, art_h, $index(_GAME_ARTS, idx), "h");
  draw_text(fb, x + 4, y + art_h + 4, $index(_GAME_NAMES, idx), font, $index(t, "foreground"));
  draw_text(fb, x + 4, y + art_h + 16, $index(_GAME_META, idx), font, $index(t, "foreground_muted"));
}
function paint_terminal_content(fb, x, y, w, h, theme, focused) {
  let t = theme;
  let font = builtin_font();
  fill_rect(fb, x, y, w, h, 4278519306);
  let lines2 = ["kyan > clarity os build", "-> kernel: zig build ... ok", "-> runtime: native vm ... ok", "-> iso: kyanos-1.1.iso (238 MB) ok", "kyan > clarity test stdlib/", "42 passed, 0 failed"];
  let ly = y + 12;
  for (let ln of lines2) {
    let col = truthy($eq(char_at(ln, 0), "k")) ? $index(t, "accent") : $index(t, "foreground_muted");
    draw_text(fb, x + 12, ly, ln, font, col);
    ly = ly + 16;
  }
  fill_rect(fb, x + 12, ly, 8, 12, $index(t, "accent"));
}
var _FILE_ROWS = [{ ["name"]: "clarity", ["meta"]: "173 items", ["dir"]: true }, { ["name"]: "kyanos-themes", ["meta"]: "12 items", ["dir"]: true }, { ["name"]: "theme_kyan.clarity", ["meta"]: "8.2 KB", ["dir"]: false }, { ["name"]: "prism_library.clarity", ["meta"]: "14.6 KB", ["dir"]: false }, { ["name"]: "voidrunner.clarity", ["meta"]: "31.0 KB", ["dir"]: false }];
function paint_files_content(fb, x, y, w, h, theme, focused) {
  let t = theme;
  let font = builtin_font();
  fill_rect(fb, x, y, w, h, $index(t, "surface"));
  let ry = y + 10;
  let i = 0;
  for (let row of _FILE_ROWS) {
    if (truthy($eq(i, 1))) {
      fill_rect(fb, x + 6, ry - 3, w - 12, 22, $index(t, "accent_tertiary"));
    }
    let ic = truthy($index(row, "dir")) ? $index(t, "accent_secondary") : $index(t, "accent");
    fill_rect(fb, x + 12, ry + 2, 12, 10, ic);
    let name_col = truthy($eq(i, 1)) ? 4294967295 : $index(t, "foreground");
    draw_text(fb, x + 32, ry + 2, $index(row, "name"), font, name_col);
    let mw = $index(measure_text(font, $index(row, "meta")), 0);
    draw_text(fb, x + w - mw - 14, ry + 2, $index(row, "meta"), font, $index(t, "foreground_muted"));
    ry = ry + 24;
    i = i + 1;
  }
}
function app_painters() {
  return { ["prism"]: paint_prism, ["terminal"]: paint_terminal_content, ["files"]: paint_files_content };
}

// web/build/kyan_desktop.js
var TITLE_H = 32;
var DOCK_ICON = 44;
var DOCK_GAP = 12;
var DOCK_PAD = 12;
var DOCK_MARGIN = 16;
var DEFAULT_PINNED = ["prism", "terminal", "files", "editor", "monitor", "settings"];
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
    this.pinned = DEFAULT_PINNED;
    this.windows = {};
    this.painters = app_painters();
    this.launcher_open = false;
    this.frames = 0;
    this._wallpaper = null;
  }
  boot(pinned) {
    if (truthy($ne(pinned, null))) {
      this.pinned = pinned;
    }
    return true;
  }
  open(app_id, x, y, w, h) {
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
    return win;
  }
  close(app_id) {
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
    return true;
  }
  focus(app_id) {
    if (truthy(!truthy(has(this.windows, app_id)))) {
      return false;
    }
    this.comp.focus($index(this.windows, app_id));
    return true;
  }
  running() {
    return keys(this.windows);
  }
  handle_mouse(me) {
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
    }
    return this.wm.handle_mouse(me);
  }
  handle_key(ke) {
    return this.wm.handle_key(ke);
  }
  toggle_launcher() {
    this.launcher_open = !truthy(this.launcher_open);
    return this.launcher_open;
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
      this._paint_chrome(win);
      drop_shadow(s, win.x, win.y, win.width, win.height, 12, rgba(0, 0, 0, 150), 7);
      s.blit(win.framebuffer, 0, 0, win.x, win.y, win.width, win.height);
    }
    this._paint_dock(s);
    if (truthy(this.launcher_open)) {
      this._paint_launcher(s);
    }
    this.frames = this.frames + 1;
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
    let tw = $index(measure_text(this.font, win.title), 0);
    let tx = $int(w / 2) - $int(tw / 2);
    let tcol = truthy(win.focused) ? $index(t, "foreground") : $index(t, "foreground_muted");
    draw_text(fb, tx, $int(th / 2) - 4, win.title, this.font, tcol);
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
    rounded_rect_blend(fb, dx, dy, dw, dh, 18, rgba(13, 17, 26, 205));
    for (let ic of $index(layout, "icons")) {
      paint_kyan_icon(fb, $index(ic, "app"), $index(ic, "x"), $index(ic, "y"), $index(ic, "size"), this.theme);
      if (truthy(has(this.windows, $index(ic, "app")))) {
        fill_rect(fb, $index(ic, "x") + $int($index(ic, "size") / 2) - 2, dy + dh - 5, 4, 4, $index(this.theme, "accent"));
      }
    }
  }
  _paint_launcher(fb) {
    let t = this.theme;
    fill_rect_blend(fb, 0, 0, this.width, this.height, rgba(5, 6, 10, 170));
    let bw = $int(this.width * 0.5);
    let bx = $int(this.width / 2) - $int(bw / 2);
    let by = $int(this.height * 0.24);
    drop_shadow(fb, bx, by, bw, 44, 12, rgba(0, 0, 0, 140), 8);
    rounded_rect_blend(fb, bx, by, bw, 44, 12, rgba(13, 17, 26, 235));
    linear_gradient(fb, bx, by, bw, 3, kyan_gradient_stops(), "h");
    draw_text(fb, bx + 18, by + 18, "Search apps, files, commands", this.font, $index(t, "foreground_muted"));
    let layout = this._launcher_layout();
    let cell = $index(layout, "cell");
    let gy = $index(layout, "gy");
    for (let c of $index(layout, "cells")) {
      paint_kyan_icon(fb, $index(c, "app"), $index(c, "x") + $int((cell - 52) / 2), gy, 52, t);
      let label = truthy(has(APP_TITLES, $index(c, "app"))) ? $index(APP_TITLES, $index(c, "app")) : $index(c, "app");
      let lw = $index(measure_text(this.font, label), 0);
      draw_text(fb, $index(c, "x") + $int((cell - lw) / 2), gy + 60, label, this.font, $index(t, "foreground"));
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
globalThis.KyanOS = { createDesktop, composeToBytes, sendMouse, openApp, toggleLauncher, MouseEvent };
export {
  toggleLauncher,
  sendMouse,
  openApp,
  createDesktop,
  composeToBytes,
  MouseEvent
};
