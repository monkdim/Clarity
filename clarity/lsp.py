"""Clarity Language Server Protocol (LSP) implementation.

Provides real-time diagnostics (syntax errors) for editors like VS Code.
Communicates over stdin/stdout using JSON-RPC 2.0.

Usage:
  clarity lsp     Start the language server
"""

import sys
import json
from .lexer import tokenize
from .parser import parse
from .errors import ClarityError


# ── JSON-RPC Transport ──────────────────────────────────

def read_message(stream=None):
    """Read a JSON-RPC message from stdin."""
    stream = stream or sys.stdin.buffer

    # Read headers
    headers = {}
    while True:
        line = stream.readline().decode("utf-8")
        if line == "\r\n" or line == "\n":
            break
        if ":" in line:
            key, _, value = line.partition(":")
            headers[key.strip()] = value.strip()

    # Read body
    content_length = int(headers.get("Content-Length", 0))
    if content_length == 0:
        return None

    body = stream.read(content_length).decode("utf-8")
    return json.loads(body)


def send_message(msg, stream=None):
    """Send a JSON-RPC message to stdout."""
    stream = stream or sys.stdout.buffer
    body = json.dumps(msg)
    header = f"Content-Length: {len(body)}\r\n\r\n"
    stream.write(header.encode("utf-8"))
    stream.write(body.encode("utf-8"))
    stream.flush()


def make_response(id, result):
    return {"jsonrpc": "2.0", "id": id, "result": result}


def make_notification(method, params):
    return {"jsonrpc": "2.0", "method": method, "params": params}


# ── Diagnostics ─────────────────────────────────────────

def check_source(source, uri):
    """Check source code for errors. Returns list of LSP diagnostics."""
    diagnostics = []
    try:
        tokens = tokenize(source)
        parse(tokens, source)
    except ClarityError as e:
        line = (e.line or 1) - 1  # LSP uses 0-based lines
        col = (e.column or 1) - 1
        diagnostics.append({
            "range": {
                "start": {"line": line, "character": col},
                "end": {"line": line, "character": col + 1},
            },
            "severity": 1,  # Error
            "source": "clarity",
            "message": e.message,
        })
    except Exception as e:
        diagnostics.append({
            "range": {
                "start": {"line": 0, "character": 0},
                "end": {"line": 0, "character": 0},
            },
            "severity": 1,
            "source": "clarity",
            "message": str(e),
        })
    return diagnostics


def get_hover_info(source, line, character):
    """Get hover information for a position. Returns markdown string or None."""
    # Find the word at position
    lines = source.split("\n")
    if line >= len(lines):
        return None
    src_line = lines[line]
    if character >= len(src_line):
        return None

    # Extract word
    start = character
    while start > 0 and (src_line[start - 1].isalnum() or src_line[start - 1] == "_"):
        start -= 1
    end = character
    while end < len(src_line) and (src_line[end].isalnum() or src_line[end] == "_"):
        end += 1
    word = src_line[start:end]

    if not word:
        return None

    # Check if it's a keyword
    from .tokens import KEYWORDS
    if word in KEYWORDS:
        return f"**{word}** — Clarity keyword"

    # Check if it's a builtin
    builtins_info = {
        "show": "**show** — Print values to output\n```\nshow value1, value2\n```",
        "let": "**let** — Declare an immutable variable\n```\nlet name = value\n```",
        "mut": "**mut** — Declare a mutable variable\n```\nmut counter = 0\n```",
        "fn": "**fn** — Declare a function\n```\nfn name(params) { body }\n```",
        "map": "**map(list, fn)** — Transform each element\n```\nmap([1,2,3], x => x * 2)\n```",
        "filter": "**filter(list, fn)** — Keep matching elements\n```\nfilter([1,2,3,4], x => x > 2)\n```",
        "reduce": "**reduce(list, fn, initial)** — Fold list to single value",
        "len": "**len(value)** — Get length of string, list, or map",
        "type": "**type(value)** — Get type name as string",
        "range": "**range(n)** or **range(start, end)** — Create a list of numbers",
        "push": "**push(list, item)** — Add item to end of list",
        "sort": "**sort(list)** — Return sorted copy of list",
        "keys": "**keys(map)** — Get list of map keys",
        "values": "**values(map)** — Get list of map values",
        "str": "**str(value)** — Convert to string",
        "int": "**int(value)** — Convert to integer",
        "float": "**float(value)** — Convert to float",
    }
    if word in builtins_info:
        return builtins_info[word]

    return None


def get_completions(source, line, character):
    """Get completion items for a position."""
    from .tokens import KEYWORDS

    items = []
    # Keywords
    for kw in KEYWORDS:
        items.append({
            "label": kw,
            "kind": 14,  # Keyword
            "detail": "keyword",
        })

    # Builtins
    builtins = [
        "show", "ask", "len", "type", "str", "int", "float", "bool",
        "map", "filter", "reduce", "each", "find", "every", "some",
        "sort", "reverse", "push", "pop", "keys", "values", "entries",
        "range", "join", "split", "replace", "trim", "upper", "lower",
        "abs", "round", "floor", "ceil", "min", "max", "sum", "sqrt",
        "print", "read", "write", "fetch", "serve",
    ]
    for name in builtins:
        items.append({
            "label": name,
            "kind": 3,  # Function
            "detail": "builtin",
        })

    return items


# ── Server ──────────────────────────────────────────────

class LanguageServer:
    """Simple Clarity language server."""

    def __init__(self):
        self.documents = {}  # uri -> source text
        self.running = True

    def run(self):
        """Main server loop."""
        while self.running:
            try:
                msg = read_message()
                if msg is None:
                    break
                self.handle(msg)
            except Exception as e:
                sys.stderr.write(f"LSP error: {e}\n")
                sys.stderr.flush()

    def handle(self, msg):
        method = msg.get("method", "")
        id = msg.get("id")
        params = msg.get("params", {})

        if method == "initialize":
            send_message(make_response(id, {
                "capabilities": {
                    "textDocumentSync": 1,  # Full sync
                    "hoverProvider": True,
                    "completionProvider": {
                        "triggerCharacters": [".", "|"],
                    },
                },
                "serverInfo": {
                    "name": "clarity-lsp",
                    "version": "0.1.0",
                },
            }))

        elif method == "initialized":
            pass  # Client is ready

        elif method == "shutdown":
            send_message(make_response(id, None))
            self.running = False

        elif method == "exit":
            self.running = False

        elif method == "textDocument/didOpen":
            doc = params.get("textDocument", {})
            uri = doc.get("uri", "")
            text = doc.get("text", "")
            self.documents[uri] = text
            self._publish_diagnostics(uri, text)

        elif method == "textDocument/didChange":
            doc = params.get("textDocument", {})
            uri = doc.get("uri", "")
            changes = params.get("contentChanges", [])
            if changes:
                text = changes[-1].get("text", "")
                self.documents[uri] = text
                self._publish_diagnostics(uri, text)

        elif method == "textDocument/didSave":
            doc = params.get("textDocument", {})
            uri = doc.get("uri", "")
            text = self.documents.get(uri, "")
            self._publish_diagnostics(uri, text)

        elif method == "textDocument/hover":
            doc = params.get("textDocument", {})
            uri = doc.get("uri", "")
            pos = params.get("position", {})
            text = self.documents.get(uri, "")
            info = get_hover_info(text, pos.get("line", 0), pos.get("character", 0))
            if info:
                send_message(make_response(id, {
                    "contents": {"kind": "markdown", "value": info},
                }))
            else:
                send_message(make_response(id, None))

        elif method == "textDocument/completion":
            doc = params.get("textDocument", {})
            uri = doc.get("uri", "")
            pos = params.get("position", {})
            text = self.documents.get(uri, "")
            items = get_completions(text, pos.get("line", 0), pos.get("character", 0))
            send_message(make_response(id, items))

        elif id is not None:
            # Unknown request — respond with null
            send_message(make_response(id, None))

    def _publish_diagnostics(self, uri, text):
        diagnostics = check_source(text, uri)
        send_message(make_notification("textDocument/publishDiagnostics", {
            "uri": uri,
            "diagnostics": diagnostics,
        }))


def start_server():
    """Entry point for the language server."""
    server = LanguageServer()
    server.run()
