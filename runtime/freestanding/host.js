// Clarity runtime — host adapter (Phase 66 task 1).
//
// Wraps the platform-specific I/O surface that runtime.js builds on
// (filesystem, process, time, env, exec). Exposes one stable shape
// regardless of host:
//
//   Bun / Node       direct fs/child_process imports
//   ClarityOS        kernel syscalls via globalThis.__claritos_syscall
//
// runtime.js (and the freestanding port runtime_freestanding.js)
// import this module instead of 'fs' / 'child_process' / 'crypto' /
// etc. Adding a new platform is a matter of providing a concrete
// implementation of HostInterface and a `detect()` branch.

const HOST_BUN = 'bun';
const HOST_NODE = 'node';
const HOST_CLARITOS = 'claritos';

let _host = null;
let _name = null;

export function host() {
    if (_host == null) {
        const detected = detect();
        _host = detected.host;
        _name = detected.name;
    }
    return _host;
}

export function host_name() { host(); return _name; }
export function is_bare_metal() { return host_name() === HOST_CLARITOS; }

export function override_host(name, impl) {
    _name = name;
    _host = impl;
}

export function reset_host() {
    _host = null;
    _name = null;
}

function detect() {
    if (typeof globalThis !== 'undefined' && globalThis.__claritos_syscall) {
        return { host: claritos_host(globalThis.__claritos_syscall), name: HOST_CLARITOS };
    }
    if (typeof Bun !== 'undefined') {
        return { host: bun_host(), name: HOST_BUN };
    }
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        return { host: node_host(), name: HOST_NODE };
    }
    throw new Error('no compatible host runtime detected');
}

// ── Bun / Node host (the dev / CI default) ─────────────

function bun_host() {
    // Bun is a strict superset of the Node fs / child_process API
    // for our purposes, so we share the Node implementation.
    return node_host();
}

function node_host() {
    const fs = require('fs');
    const cp = require('child_process');

    return {
        fs: {
            read_text(path) { return fs.readFileSync(path, 'utf-8'); },
            write_text(path, content) { fs.writeFileSync(path, content); },
            append_text(path, content) { fs.appendFileSync(path, content); },
            exists(path) { return fs.existsSync(path); },
            stat(path) {
                const s = fs.statSync(path);
                return {
                    size: s.size,
                    mtime: Math.floor(s.mtimeMs / 1000),
                    is_dir: s.isDirectory(),
                    is_file: s.isFile(),
                    mode: s.mode,
                };
            },
            list_dir(path) { return fs.readdirSync(path); },
            mkdir(path) { fs.mkdirSync(path, { recursive: true }); },
            unlink(path) { fs.unlinkSync(path); },
            rename(src, dst) { fs.renameSync(src, dst); },
        },
        proc: {
            getpid() { return typeof process !== 'undefined' ? process.pid : 0; },
            exit(code) { if (typeof process !== 'undefined') process.exit(code); throw 'exit:' + code; },
            args() { return typeof process !== 'undefined' ? process.argv.slice(2) : []; },
        },
        env: {
            get(name) { return (typeof process !== 'undefined' ? process.env[name] : undefined) || null; },
            set(name, value) { if (typeof process !== 'undefined') process.env[name] = String(value); },
        },
        exec: {
            run(cmd) {
                try {
                    return { stdout: cp.execSync(cmd, { encoding: 'utf-8' }).replace(/\n$/, ''), stderr: '', exit_code: 0 };
                } catch (e) {
                    return { stdout: e.stdout || '', stderr: e.stderr || String(e), exit_code: e.status || 1 };
                }
            },
        },
        time: {
            now_seconds() { return Date.now() / 1000; },
            sleep_ms(ms) {
                // Synchronous sleep; busy-wait under bun where bun:sleep isn't free.
                const end = Date.now() + ms;
                while (Date.now() < end) {}
            },
        },
    };
}

// ── ClarityOS host (bare metal) ─────────────────────

// Syscall numbers must mirror stdlib/kernel_abi.clarity.
const SYS_READ = 0;
const SYS_WRITE = 1;
const SYS_OPEN = 2;
const SYS_CLOSE = 3;
const SYS_STAT = 4;
const SYS_GETPID = 14;
const SYS_NANOSLEEP = 17;
const SYS_MKDIR = 30;
const SYS_RMDIR = 31;
const SYS_UNLINK = 32;
const SYS_RENAME = 33;
const SYS_READDIR = 34;
const SYS_EXIT = 12;
const SYS_CLOCK_GETTIME = 41;

const O_RDONLY = 0;
const O_WRONLY = 1;
const O_RDWR = 2;
const O_CREAT = 64;
const O_TRUNC = 512;
const O_APPEND = 1024;

function claritos_host(syscall) {
    function read_all(fd) {
        const chunks = [];
        let total = 0;
        while (true) {
            const buf = new Uint8Array(4096);
            const n = syscall(SYS_READ, fd, buf, buf.length);
            if (n <= 0) break;
            chunks.push(buf.subarray(0, n));
            total += n;
        }
        const out = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { out.set(c, off); off += c.length; }
        return new TextDecoder().decode(out);
    }

    function write_all(fd, data) {
        const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
        let off = 0;
        while (off < bytes.length) {
            const n = syscall(SYS_WRITE, fd, bytes.subarray(off), bytes.length - off);
            if (n <= 0) throw new Error('write failed: errno ' + (-n));
            off += n;
        }
    }

    return {
        fs: {
            read_text(path) {
                const fd = syscall(SYS_OPEN, path, O_RDONLY, 0);
                if (fd < 0) throw new Error('open failed: errno ' + (-fd));
                try { return read_all(fd); } finally { syscall(SYS_CLOSE, fd); }
            },
            write_text(path, content) {
                const fd = syscall(SYS_OPEN, path, O_WRONLY | O_CREAT | O_TRUNC, 0o644);
                if (fd < 0) throw new Error('open failed: errno ' + (-fd));
                try { write_all(fd, content); } finally { syscall(SYS_CLOSE, fd); }
            },
            append_text(path, content) {
                const fd = syscall(SYS_OPEN, path, O_WRONLY | O_CREAT | O_APPEND, 0o644);
                if (fd < 0) throw new Error('open failed: errno ' + (-fd));
                try { write_all(fd, content); } finally { syscall(SYS_CLOSE, fd); }
            },
            exists(path) {
                const fd = syscall(SYS_OPEN, path, O_RDONLY, 0);
                if (fd < 0) return false;
                syscall(SYS_CLOSE, fd);
                return true;
            },
            stat(path) {
                const stat_buf = new Uint8Array(64);
                const rc = syscall(SYS_STAT, path, stat_buf);
                if (rc < 0) throw new Error('stat failed: errno ' + (-rc));
                const view = new DataView(stat_buf.buffer);
                return {
                    size: Number(view.getBigUint64(0, true)),
                    mtime: Number(view.getBigUint64(8, true)),
                    is_dir: (view.getUint32(16, true) & 0xF000) === 0x4000,
                    is_file: (view.getUint32(16, true) & 0xF000) === 0x8000,
                    mode: view.getUint32(16, true),
                };
            },
            list_dir(path) {
                const result = syscall(SYS_READDIR, path);
                return Array.isArray(result) ? result : [];
            },
            mkdir(path) { syscall(SYS_MKDIR, path, 0o755); },
            unlink(path) { syscall(SYS_UNLINK, path); },
            rename(src, dst) { syscall(SYS_RENAME, src, dst); },
        },
        proc: {
            getpid() { return syscall(SYS_GETPID); },
            exit(code) { syscall(SYS_EXIT, code | 0); throw 'exit:' + code; },
            args() { return globalThis.__claritos_args || []; },
        },
        env: {
            get(name) {
                const env = globalThis.__claritos_env || {};
                return env[name] || null;
            },
            set(name, value) {
                if (!globalThis.__claritos_env) globalThis.__claritos_env = {};
                globalThis.__claritos_env[name] = String(value);
            },
        },
        exec: {
            run(_cmd) {
                // No subprocesses in userspace today; the kernel only
                // hands out fork+exec from spawn_user(). Callers that
                // really need to shell out should use fork/exec
                // directly through the syscall wrapper instead.
                return { stdout: '', stderr: 'exec: not supported on claritos', exit_code: 38 };
            },
        },
        time: {
            now_seconds() {
                const t = syscall(SYS_CLOCK_GETTIME);
                return Number(t) / 1e9;
            },
            sleep_ms(ms) {
                const ts = new Uint8Array(16);
                const view = new DataView(ts.buffer);
                view.setBigUint64(0, BigInt(Math.floor(ms / 1000)), true);
                view.setBigUint64(8, BigInt((ms % 1000) * 1_000_000), true);
                syscall(SYS_NANOSLEEP, ts);
            },
        },
    };
}

// ── Public façade ──────────────────────────────────

export const fs = new Proxy({}, { get: (_, k) => host().fs[k] });
export const proc = new Proxy({}, { get: (_, k) => host().proc[k] });
export const env_ = new Proxy({}, { get: (_, k) => host().env[k] });
export const exec_ = new Proxy({}, { get: (_, k) => host().exec[k] });
export const time = new Proxy({}, { get: (_, k) => host().time[k] });
