"""Clarity runtime — built-in functions and modules."""

import os
import sys
import time
import json
import math
import random
import re as _re
import subprocess
import hashlib
import base64
from pathlib import Path


def get_builtins(interpreter):
    """Return all built-in functions available in Clarity."""

    def _to_display(v):
        return interpreter._to_display(v)

    # ── I/O ──────────────────────────────────────────────

    def clarity_print(*args):
        output = " ".join(_to_display(a) for a in args)
        print(output)
        interpreter.output.append(output)

    def clarity_show(*args):
        """Alias for print — Clarity's natural output."""
        clarity_print(*args)

    def clarity_ask(prompt=""):
        return input(_to_display(prompt))

    def clarity_read(path):
        """Read entire file contents."""
        with open(path, "r") as f:
            return f.read()

    def clarity_write(path, content):
        """Write content to file."""
        with open(path, "w") as f:
            f.write(_to_display(content))
        return True

    def clarity_append(path, content):
        """Append content to file."""
        with open(path, "a") as f:
            f.write(_to_display(content))
        return True

    def clarity_exists(path):
        """Check if file/directory exists."""
        return os.path.exists(path)

    def clarity_lines(path):
        """Read file as list of lines."""
        with open(path, "r") as f:
            return f.read().splitlines()

    # ── Type conversions ─────────────────────────────────

    def clarity_int(v):
        if isinstance(v, str):
            return int(float(v))
        return int(v)

    def clarity_float(v):
        return float(v)

    def clarity_str(v):
        return _to_display(v)

    def clarity_bool(v):
        return interpreter._is_truthy(v)

    def clarity_type(v):
        from .interpreter import type_name
        return type_name(v)

    # ── Collections ──────────────────────────────────────

    def clarity_len(v):
        return len(v)

    def clarity_push(lst, item):
        lst.append(item)
        return lst

    def clarity_pop(lst):
        return lst.pop()

    def clarity_sort(lst, key=None):
        return sorted(lst, key=key)

    def clarity_reverse(lst):
        if isinstance(lst, str):
            return lst[::-1]
        return list(reversed(lst))

    def clarity_range(*args):
        if len(args) == 1:
            return list(range(args[0]))
        elif len(args) == 2:
            return list(range(args[0], args[1]))
        elif len(args) == 3:
            return list(range(args[0], args[1], args[2]))
        raise Exception("range() takes 1-3 arguments")

    def clarity_map(lst, fn):
        result = []
        for item in lst:
            result.append(interpreter._call(fn, [item], 0))
        return result

    def clarity_filter(lst, fn):
        result = []
        for item in lst:
            if interpreter._is_truthy(interpreter._call(fn, [item], 0)):
                result.append(item)
        return result

    def clarity_reduce(lst, fn, initial=None):
        acc = initial if initial is not None else lst[0]
        start = 0 if initial is not None else 1
        for i in range(start, len(lst)):
            acc = interpreter._call(fn, [acc, lst[i]], 0)
        return acc

    def clarity_each(lst, fn):
        for item in lst:
            interpreter._call(fn, [item], 0)
        return None

    def clarity_find(lst, fn):
        for item in lst:
            if interpreter._is_truthy(interpreter._call(fn, [item], 0)):
                return item
        return None

    def clarity_every(lst, fn):
        return all(interpreter._is_truthy(interpreter._call(fn, [item], 0)) for item in lst)

    def clarity_some(lst, fn):
        return any(interpreter._is_truthy(interpreter._call(fn, [item], 0)) for item in lst)

    def clarity_flat(lst):
        result = []
        for item in lst:
            if isinstance(item, list):
                result.extend(item)
            else:
                result.append(item)
        return result

    def clarity_zip(*lists):
        return [list(t) for t in zip(*lists)]

    def clarity_unique(lst):
        seen = []
        result = []
        for item in lst:
            key = repr(item)
            if key not in seen:
                seen.append(key)
                result.append(item)
        return result

    def clarity_keys(m):
        return list(m.keys())

    def clarity_values(m):
        return list(m.values())

    def clarity_entries(m):
        return [[k, v] for k, v in m.items()]

    def clarity_merge(*maps):
        result = {}
        for m in maps:
            result.update(m)
        return result

    def clarity_has(collection, key):
        if isinstance(collection, dict):
            return key in collection
        if isinstance(collection, list):
            return key in collection
        if isinstance(collection, str):
            return key in collection
        return False

    # ── String functions ─────────────────────────────────

    def clarity_split(s, sep=" "):
        return s.split(sep)

    def clarity_join(lst, sep=""):
        return sep.join(_to_display(x) for x in lst)

    def clarity_replace(s, old, new):
        return s.replace(old, new)

    def clarity_trim(s):
        return s.strip()

    def clarity_upper(s):
        return s.upper()

    def clarity_lower(s):
        return s.lower()

    def clarity_contains(haystack, needle):
        return needle in haystack

    def clarity_starts(s, prefix):
        return s.startswith(prefix)

    def clarity_ends(s, suffix):
        return s.endswith(suffix)

    def clarity_chars(s):
        return list(s)

    def clarity_repeat(s, n):
        return s * n

    def clarity_pad_left(s, length, char=" "):
        return s.rjust(length, char)

    def clarity_pad_right(s, length, char=" "):
        return s.ljust(length, char)

    def clarity_char_at(s, i):
        """Get character at index."""
        if i < 0 or i >= len(s):
            return None
        return s[i]

    def clarity_char_code(c):
        """Get Unicode code point of character (ord)."""
        return ord(c[0]) if c else None

    def clarity_from_char_code(n):
        """Character from Unicode code point (chr)."""
        return chr(n)

    def clarity_index_of(s, sub, start=0):
        """Find index of substring, returns -1 if not found."""
        return s.find(sub, start)

    def clarity_substring(s, start, end=None):
        """Extract substring from start to end."""
        if end is None:
            return s[start:]
        return s[start:end]

    def clarity_is_digit(c):
        """Check if character is a digit."""
        return c.isdigit() if isinstance(c, str) and len(c) == 1 else False

    def clarity_is_alpha(c):
        """Check if character is a letter."""
        return c.isalpha() if isinstance(c, str) and len(c) == 1 else False

    def clarity_is_alnum(c):
        """Check if character is alphanumeric."""
        return c.isalnum() if isinstance(c, str) and len(c) == 1 else False

    def clarity_is_space(c):
        """Check if character is whitespace."""
        return c.isspace() if isinstance(c, str) and len(c) == 1 else False

    # ── Math ─────────────────────────────────────────────

    def clarity_abs(n):
        return abs(n)

    def clarity_round(n, digits=0):
        return round(n, digits)

    def clarity_floor(n):
        return math.floor(n)

    def clarity_ceil(n):
        return math.ceil(n)

    def clarity_min(*args):
        if len(args) == 1 and isinstance(args[0], list):
            return min(args[0])
        return min(args)

    def clarity_max(*args):
        if len(args) == 1 and isinstance(args[0], list):
            return max(args[0])
        return max(args)

    def clarity_sum(lst):
        return sum(lst)

    def clarity_random(*args):
        if len(args) == 0:
            return random.random()
        elif len(args) == 1:
            return random.randint(0, args[0])
        else:
            return random.randint(args[0], args[1])

    # ── System ───────────────────────────────────────────

    def clarity_exec(cmd):
        """Run a shell command and return output."""
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.stdout.strip()

    def clarity_exec_full(cmd):
        """Run a shell command and return {stdout, stderr, exit_code}."""
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
        }

    def clarity_exit(code=0):
        sys.exit(code)

    def clarity_sleep(seconds):
        time.sleep(seconds)

    def clarity_time():
        return time.time()

    def clarity_env(key, default=None):
        return os.environ.get(key, default)

    def clarity_args():
        return sys.argv[1:]

    def clarity_cwd():
        return os.getcwd()

    # ── Net / HTTP ───────────────────────────────────────

    def clarity_fetch(url, options=None):
        """Simple HTTP request. Returns response body as string."""
        try:
            import urllib.request
            import urllib.parse

            if options and isinstance(options, dict):
                method = options.get("method", "GET").upper()
                headers = options.get("headers", {})
                body = options.get("body", None)

                if body and isinstance(body, (dict, list)):
                    body = json.dumps(body).encode()
                    if "Content-Type" not in headers:
                        headers["Content-Type"] = "application/json"
                elif body:
                    body = str(body).encode()

                req = urllib.request.Request(url, data=body, method=method)
                for k, v in headers.items():
                    req.add_header(k, v)
            else:
                req = urllib.request.Request(url)

            with urllib.request.urlopen(req) as resp:
                return resp.read().decode()
        except Exception as e:
            raise Exception(f"fetch failed: {e}")

    def clarity_serve(port, handler):
        """Start a simple HTTP server."""
        from http.server import HTTPServer, BaseHTTPRequestHandler

        class ClarityHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                request = {"method": "GET", "path": self.path, "headers": dict(self.headers)}
                response = interpreter._call(handler, [request], 0)

                if isinstance(response, dict):
                    status = response.get("status", 200)
                    body = response.get("body", "")
                    content_type = response.get("type", "text/html")
                else:
                    status = 200
                    body = _to_display(response)
                    content_type = "text/html"

                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.end_headers()
                self.wfile.write(body.encode())

            def do_POST(self):
                length = int(self.headers.get("Content-Length", 0))
                post_body = self.rfile.read(length).decode() if length else ""
                request = {
                    "method": "POST", "path": self.path,
                    "headers": dict(self.headers), "body": post_body
                }
                response = interpreter._call(handler, [request], 0)

                if isinstance(response, dict):
                    status = response.get("status", 200)
                    body = response.get("body", "")
                    content_type = response.get("type", "text/html")
                else:
                    status = 200
                    body = _to_display(response)
                    content_type = "text/html"

                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.end_headers()
                self.wfile.write(body.encode())

            def log_message(self, format, *args):
                clarity_print(f"[serve] {args[0]}")

        server = HTTPServer(("", port), ClarityHandler)
        clarity_print(f"Clarity server running on port {port}")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.shutdown()

    # ── JSON ─────────────────────────────────────────────

    def clarity_json_parse(text):
        return json.loads(text)

    def clarity_json_string(value):
        return json.dumps(value, indent=2, default=str)

    # ── Crypto / Encoding ────────────────────────────────

    def clarity_hash(text, algo="sha256"):
        h = hashlib.new(algo)
        h.update(text.encode())
        return h.hexdigest()

    def clarity_encode64(text):
        return base64.b64encode(text.encode()).decode()

    def clarity_decode64(text):
        return base64.b64decode(text.encode()).decode()

    # ── Functional ───────────────────────────────────────

    def clarity_compose(*fns):
        """Compose functions right-to-left."""
        def composed(x):
            result = x
            for fn in reversed(fns):
                result = interpreter._call(fn, [result], 0)
            return result
        return composed

    def clarity_tap(value, fn):
        """Call fn with value for side effects, return value."""
        interpreter._call(fn, [value], 0)
        return value

    # ── Sets ──────────────────────────────────────────────

    def clarity_set(lst=None):
        """Create a set from a list."""
        if lst is None:
            return set()
        return set(lst)

    # ── Throw ─────────────────────────────────────────────

    def clarity_error(message):
        """Create an error value (string) for throwing."""
        return str(message)

    # ── Build the builtins dict ──────────────────────────

    return {
        # I/O
        "print": clarity_print,
        "show": clarity_show,
        "ask": clarity_ask,
        "read": clarity_read,
        "write": clarity_write,
        "append": clarity_append,
        "exists": clarity_exists,
        "lines": clarity_lines,

        # Types
        "int": clarity_int,
        "float": clarity_float,
        "str": clarity_str,
        "bool": clarity_bool,
        "type": clarity_type,

        # Collections
        "len": clarity_len,
        "push": clarity_push,
        "pop": clarity_pop,
        "sort": clarity_sort,
        "reverse": clarity_reverse,
        "range": clarity_range,
        "map": clarity_map,
        "filter": clarity_filter,
        "reduce": clarity_reduce,
        "each": clarity_each,
        "find": clarity_find,
        "every": clarity_every,
        "some": clarity_some,
        "flat": clarity_flat,
        "zip": clarity_zip,
        "unique": clarity_unique,
        "keys": clarity_keys,
        "values": clarity_values,
        "entries": clarity_entries,
        "merge": clarity_merge,
        "has": clarity_has,

        # Strings
        "split": clarity_split,
        "join": clarity_join,
        "replace": clarity_replace,
        "trim": clarity_trim,
        "upper": clarity_upper,
        "lower": clarity_lower,
        "contains": clarity_contains,
        "starts": clarity_starts,
        "ends": clarity_ends,
        "chars": clarity_chars,
        "repeat": clarity_repeat,
        "pad_left": clarity_pad_left,
        "pad_right": clarity_pad_right,
        "char_at": clarity_char_at,
        "char_code": clarity_char_code,
        "from_char_code": clarity_from_char_code,
        "index_of": clarity_index_of,
        "substring": clarity_substring,
        "is_digit": clarity_is_digit,
        "is_alpha": clarity_is_alpha,
        "is_alnum": clarity_is_alnum,
        "is_space": clarity_is_space,

        # Math
        "abs": clarity_abs,
        "round": clarity_round,
        "floor": clarity_floor,
        "ceil": clarity_ceil,
        "min": clarity_min,
        "max": clarity_max,
        "sum": clarity_sum,
        "random": clarity_random,
        "pi": math.pi,
        "e": math.e,
        "sqrt": math.sqrt,
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "log": math.log,
        "pow": math.pow,

        # System
        "exec": clarity_exec,
        "exec_full": clarity_exec_full,
        "exit": clarity_exit,
        "sleep": clarity_sleep,
        "time": clarity_time,
        "env": clarity_env,
        "args": clarity_args,
        "cwd": clarity_cwd,

        # Net
        "fetch": clarity_fetch,
        "serve": clarity_serve,

        # JSON
        "json_parse": clarity_json_parse,
        "json_string": clarity_json_string,

        # Crypto
        "hash": clarity_hash,
        "encode64": clarity_encode64,
        "decode64": clarity_decode64,

        # Functional
        "compose": clarity_compose,
        "tap": clarity_tap,

        # Sets
        "set": clarity_set,

        # Errors
        "error": clarity_error,
    }


# ── Modules ──────────────────────────────────────────────

def get_module(name):
    """Get a Clarity module by name."""
    modules = {
        "math": {
            "pi": math.pi,
            "e": math.e,
            "sqrt": math.sqrt,
            "pow": math.pow,
            "abs": abs,
            "floor": math.floor,
            "ceil": math.ceil,
            "round": round,
            "sin": math.sin,
            "cos": math.cos,
            "tan": math.tan,
            "log": math.log,
            "log2": math.log2,
            "log10": math.log10,
            "min": min,
            "max": max,
            "inf": math.inf,
            "nan": math.nan,
        },
        "json": {
            "parse": json.loads,
            "string": lambda v: json.dumps(v, indent=2, default=str),
        },
        "os": {
            "env": os.environ.get,
            "cwd": os.getcwd,
            "args": lambda: sys.argv[1:],
            "exec": lambda cmd: subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip(),
            "ls": lambda path=".": os.listdir(path),
            "mkdir": lambda path: os.makedirs(path, exist_ok=True),
            "rm": os.remove,
            "rename": os.rename,
            "home": lambda: str(Path.home()),
            "sep": os.sep,
        },
        "path": {
            "join": lambda *parts: str(Path(*parts)),
            "dir": lambda p: str(Path(p).parent),
            "name": lambda p: Path(p).name,
            "stem": lambda p: Path(p).stem,
            "ext": lambda p: Path(p).suffix,
            "exists": lambda p: Path(p).exists(),
            "is_file": lambda p: Path(p).is_file(),
            "is_dir": lambda p: Path(p).is_dir(),
            "abs": lambda p: str(Path(p).resolve()),
        },
        "random": {
            "int": random.randint,
            "float": random.random,
            "choice": random.choice,
            "shuffle": lambda lst: (random.shuffle(lst), lst)[1],
            "sample": random.sample,
            "seed": random.seed,
        },
        "time": {
            "now": time.time,
            "sleep": time.sleep,
            "format": lambda fmt="%Y-%m-%d %H:%M:%S": time.strftime(fmt),
            "clock": time.perf_counter,
        },
        "crypto": {
            "sha256": lambda t: hashlib.sha256(t.encode()).hexdigest(),
            "md5": lambda t: hashlib.md5(t.encode()).hexdigest(),
            "sha1": lambda t: hashlib.sha1(t.encode()).hexdigest(),
            "encode64": lambda t: base64.b64encode(t.encode()).decode(),
            "decode64": lambda t: base64.b64decode(t.encode()).decode(),
            "uuid": lambda: __import__("uuid").uuid4().hex,
        },
        "regex": {
            "match": lambda pattern, s: _re.match(pattern, s) is not None,
            "search": lambda pattern, s: _re.search(pattern, s) is not None,
            "find": lambda pattern, s: _re.findall(pattern, s),
            "replace": lambda pattern, repl, s: _re.sub(pattern, repl, s),
            "split": lambda pattern, s: _re.split(pattern, s),
            "groups": lambda pattern, s: list(_re.search(pattern, s).groups()) if _re.search(pattern, s) else [],
        },
    }
    return modules.get(name)
