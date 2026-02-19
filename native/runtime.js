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

// ── Type conversions ─────────────────────────────────────

export function $int(v) {
  if (typeof v === 'string') return parseInt(v, 10) || 0;
  return Math.trunc(Number(v));
}

export function $float(v) { return parseFloat(v); }
export function str(v) { return display(v); }
export function $bool(v) { return truthy(v); }
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
