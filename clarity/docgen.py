"""Clarity documentation generator — extract docs from source code."""

import os
import re
import sys

from . import ast_nodes as ast
from .lexer import tokenize
from .parser import parse
from .errors import ClarityError


# ── Doc entry types ────────────────────────────────────────

class DocEntry:
    """Base class for a documented item."""
    __slots__ = ('name', 'kind', 'line', 'doc', 'signature')

    def __init__(self, name, kind, line, doc="", signature=""):
        self.name = name
        self.kind = kind        # "function", "class", "enum", "interface", "constant"
        self.line = line
        self.doc = doc          # extracted doc comment text
        self.signature = signature


class FunctionDoc(DocEntry):
    """Documented function."""
    __slots__ = ('params', 'param_types', 'return_type', 'is_async')

    def __init__(self, name, line, doc="", params=None, param_types=None,
                 return_type=None, is_async=False):
        sig = self._build_sig(name, params or [], param_types or {}, return_type, is_async)
        super().__init__(name, "function", line, doc, sig)
        self.params = params or []
        self.param_types = param_types or {}
        self.return_type = return_type
        self.is_async = is_async

    @staticmethod
    def _build_sig(name, params, param_types, return_type, is_async):
        prefix = "async fn" if is_async else "fn"
        parts = []
        for p in params:
            if p in param_types:
                parts.append(f"{p}: {param_types[p]}")
            else:
                parts.append(p)
        sig = f"{prefix} {name}({', '.join(parts)})"
        if return_type:
            sig += f" -> {return_type}"
        return sig


class ClassDoc(DocEntry):
    """Documented class."""
    __slots__ = ('parent', 'interfaces', 'methods')

    def __init__(self, name, line, doc="", parent=None, interfaces=None, methods=None):
        sig = f"class {name}"
        if parent:
            sig += f" extends {parent}"
        if interfaces:
            sig += f" implements {', '.join(interfaces)}"
        super().__init__(name, "class", line, doc, sig)
        self.parent = parent
        self.interfaces = interfaces or []
        self.methods = methods or []  # list of FunctionDoc


class EnumDoc(DocEntry):
    """Documented enum."""
    __slots__ = ('members',)

    def __init__(self, name, line, doc="", members=None):
        super().__init__(name, "enum", line, doc, f"enum {name}")
        self.members = members or []  # list of (name, value)


class InterfaceDoc(DocEntry):
    """Documented interface."""
    __slots__ = ('method_sigs',)

    def __init__(self, name, line, doc="", method_sigs=None):
        super().__init__(name, "interface", line, doc, f"interface {name}")
        self.method_sigs = method_sigs or []  # list of (name, params, return_type)


class ConstantDoc(DocEntry):
    """Documented top-level constant."""
    __slots__ = ('type_annotation',)

    def __init__(self, name, line, doc="", type_annotation=None):
        sig = f"let {name}"
        if type_annotation:
            sig += f": {type_annotation}"
        super().__init__(name, "constant", line, doc, sig)
        self.type_annotation = type_annotation


# ── Source comment extractor ───────────────────────────────

_COMMENT_RE = re.compile(r'^\s*(?:--|//)\s?(.*)')


def extract_doc_comment(source_lines, decl_line):
    """Extract doc comment block immediately preceding a declaration line.

    Looks backwards from decl_line (1-indexed) for contiguous `--` or `//`
    comment lines.  Returns the combined text, stripped.
    """
    lines = []
    idx = decl_line - 2  # 0-indexed, line before declaration
    while idx >= 0:
        m = _COMMENT_RE.match(source_lines[idx])
        if m:
            lines.append(m.group(1))
            idx -= 1
        else:
            break
    lines.reverse()
    return '\n'.join(lines).strip()


# ── AST walker ─────────────────────────────────────────────

class DocExtractor:
    """Walks an AST + source to extract all documentation entries."""

    def __init__(self, source, tree, filename=""):
        self.source_lines = source.split('\n')
        self.tree = tree
        self.filename = filename
        self.entries = []

    def extract(self):
        """Walk the tree and return list of DocEntry."""
        for node in self.tree.body:
            self._visit(node)
        return self.entries

    def _visit(self, node):
        if isinstance(node, ast.FnStatement):
            self._visit_fn(node)
        elif isinstance(node, ast.ClassStatement):
            self._visit_class(node)
        elif isinstance(node, ast.EnumStatement):
            self._visit_enum(node)
        elif isinstance(node, ast.InterfaceStatement):
            self._visit_interface(node)
        elif isinstance(node, ast.LetStatement):
            self._visit_let(node)
        elif isinstance(node, ast.DecoratedStatement):
            self._visit(node.target)

    def _visit_fn(self, node, parent_class=None):
        doc = extract_doc_comment(self.source_lines, node.line)
        entry = FunctionDoc(
            name=node.name,
            line=node.line,
            doc=doc,
            params=node.params,
            param_types=node.param_types,
            return_type=node.return_type,
            is_async=node.is_async,
        )
        if parent_class is not None:
            parent_class.methods.append(entry)
        else:
            self.entries.append(entry)

    def _visit_class(self, node):
        doc = extract_doc_comment(self.source_lines, node.line)
        cls_doc = ClassDoc(
            name=node.name,
            line=node.line,
            doc=doc,
            parent=node.parent,
            interfaces=node.interfaces,
        )
        # Extract methods — node.methods is a list of FnStatement
        if node.methods:
            methods_list = node.methods
            if hasattr(node.methods, 'statements'):
                methods_list = node.methods.statements
            for stmt in methods_list:
                if isinstance(stmt, ast.FnStatement):
                    self._visit_fn(stmt, parent_class=cls_doc)
        self.entries.append(cls_doc)

    def _visit_enum(self, node):
        doc = extract_doc_comment(self.source_lines, node.line)
        self.entries.append(EnumDoc(
            name=node.name,
            line=node.line,
            doc=doc,
            members=node.members,
        ))

    def _visit_interface(self, node):
        doc = extract_doc_comment(self.source_lines, node.line)
        self.entries.append(InterfaceDoc(
            name=node.name,
            line=node.line,
            doc=doc,
            method_sigs=node.method_sigs,
        ))

    def _visit_let(self, node):
        # Only document top-level non-mutable lets (constants)
        if not node.mutable:
            doc = extract_doc_comment(self.source_lines, node.line)
            if doc:  # Only include if it has a doc comment
                self.entries.append(ConstantDoc(
                    name=node.name,
                    line=node.line,
                    doc=doc,
                    type_annotation=node.type_annotation,
                ))


# ── Output formatters ──────────────────────────────────────

def format_markdown(entries, title="API Documentation", filename=""):
    """Format doc entries as Markdown."""
    lines = [f"# {title}", ""]
    if filename:
        lines.append(f"*Source: `{filename}`*")
        lines.append("")

    # Group by kind
    groups = {}
    for entry in entries:
        groups.setdefault(entry.kind, []).append(entry)

    order = ["constant", "function", "class", "interface", "enum"]
    section_titles = {
        "constant": "Constants",
        "function": "Functions",
        "class": "Classes",
        "interface": "Interfaces",
        "enum": "Enums",
    }

    for kind in order:
        group = groups.get(kind, [])
        if not group:
            continue
        lines.append(f"## {section_titles[kind]}")
        lines.append("")

        for entry in group:
            if kind == "function":
                lines.extend(_fmt_function(entry))
            elif kind == "class":
                lines.extend(_fmt_class(entry))
            elif kind == "enum":
                lines.extend(_fmt_enum(entry))
            elif kind == "interface":
                lines.extend(_fmt_interface(entry))
            elif kind == "constant":
                lines.extend(_fmt_constant(entry))

    return '\n'.join(lines)


def _fmt_function(entry):
    lines = [f"### `{entry.signature}`", ""]
    if entry.doc:
        lines.append(entry.doc)
        lines.append("")
    if entry.params:
        lines.append("**Parameters:**")
        for p in entry.params:
            ptype = entry.param_types.get(p, "")
            type_str = f" `{ptype}`" if ptype else ""
            lines.append(f"- `{p}`{type_str}")
        lines.append("")
    if entry.return_type:
        lines.append(f"**Returns:** `{entry.return_type}`")
        lines.append("")
    lines.append(f"*Line {entry.line}*")
    lines.append("")
    return lines


def _fmt_class(entry):
    lines = [f"### `{entry.signature}`", ""]
    if entry.doc:
        lines.append(entry.doc)
        lines.append("")
    if entry.methods:
        lines.append("**Methods:**")
        lines.append("")
        for m in entry.methods:
            lines.append(f"#### `{m.signature}`")
            lines.append("")
            if m.doc:
                lines.append(m.doc)
                lines.append("")
    lines.append(f"*Line {entry.line}*")
    lines.append("")
    return lines


def _fmt_enum(entry):
    lines = [f"### `{entry.signature}`", ""]
    if entry.doc:
        lines.append(entry.doc)
        lines.append("")
    if entry.members:
        lines.append("**Members:**")
        for name, val in entry.members:
            if val is not None:
                lines.append(f"- `{name}` = `{val}`")
            else:
                lines.append(f"- `{name}`")
        lines.append("")
    lines.append(f"*Line {entry.line}*")
    lines.append("")
    return lines


def _fmt_interface(entry):
    lines = [f"### `{entry.signature}`", ""]
    if entry.doc:
        lines.append(entry.doc)
        lines.append("")
    if entry.method_sigs:
        lines.append("**Methods:**")
        for sig in entry.method_sigs:
            if len(sig) >= 3:
                name, params, ret = sig[0], sig[1], sig[2]
            else:
                name, params, ret = sig[0], sig[1] if len(sig) > 1 else [], None
            sig_str = f"fn {name}({', '.join(params) if isinstance(params, list) else params})"
            if ret:
                sig_str += f" -> {ret}"
            lines.append(f"- `{sig_str}`")
        lines.append("")
    lines.append(f"*Line {entry.line}*")
    lines.append("")
    return lines


def _fmt_constant(entry):
    lines = [f"### `{entry.signature}`", ""]
    if entry.doc:
        lines.append(entry.doc)
        lines.append("")
    lines.append(f"*Line {entry.line}*")
    lines.append("")
    return lines


# ── Terminal output (colored) ──────────────────────────────

BOLD = "\033[1m"
DIM = "\033[2m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
RESET = "\033[0m"


def format_terminal(entries, filename=""):
    """Print doc entries to terminal with colors."""
    lines = []
    lines.append(f"\n  {BOLD}Documentation{RESET}")
    if filename:
        lines.append(f"  {DIM}{filename}{RESET}")
    lines.append(f"  {DIM}{'─' * 56}{RESET}")

    for entry in entries:
        kind_color = {
            "function": CYAN,
            "class": GREEN,
            "enum": YELLOW,
            "interface": YELLOW,
            "constant": DIM,
        }.get(entry.kind, "")

        lines.append(f"\n  {kind_color}{entry.kind}{RESET}  {BOLD}{entry.signature}{RESET}")
        if entry.doc:
            for dline in entry.doc.split('\n'):
                lines.append(f"    {dline}")

        if isinstance(entry, ClassDoc) and entry.methods:
            for m in entry.methods:
                lines.append(f"    {CYAN}{m.signature}{RESET}")
                if m.doc:
                    for dline in m.doc.split('\n'):
                        lines.append(f"      {dline}")

        if isinstance(entry, EnumDoc) and entry.members:
            for name, val in entry.members:
                if val is not None:
                    lines.append(f"    {name} = {val}")
                else:
                    lines.append(f"    {name}")

    lines.append("")
    return '\n'.join(lines)


# ── Public API ─────────────────────────────────────────────

def generate_docs(source, filename="", output_format="terminal"):
    """Generate documentation from Clarity source code.

    Args:
        source: Clarity source code string
        filename: Optional filename for display
        output_format: "terminal", "markdown", or "json"

    Returns:
        Formatted documentation string, or list of DocEntry if format="entries"
    """
    try:
        tokens = tokenize(source, filename)
        tree = parse(tokens, source)
    except ClarityError as e:
        return f"Parse error: {e}"

    extractor = DocExtractor(source, tree, filename)
    entries = extractor.extract()

    if output_format == "entries":
        return entries
    elif output_format == "markdown":
        title = os.path.basename(filename) if filename else "API Documentation"
        return format_markdown(entries, title=title, filename=filename)
    elif output_format == "json":
        return _entries_to_json(entries)
    else:
        return format_terminal(entries, filename)


def _entries_to_json(entries):
    """Convert entries to a JSON-serializable dict list."""
    import json
    result = []
    for e in entries:
        item = {
            "name": e.name,
            "kind": e.kind,
            "line": e.line,
            "doc": e.doc,
            "signature": e.signature,
        }
        if isinstance(e, FunctionDoc):
            item["params"] = e.params
            item["param_types"] = e.param_types
            item["return_type"] = e.return_type
            item["is_async"] = e.is_async
        elif isinstance(e, ClassDoc):
            item["parent"] = e.parent
            item["interfaces"] = e.interfaces
            item["methods"] = [
                {
                    "name": m.name, "signature": m.signature,
                    "doc": m.doc, "params": m.params,
                    "param_types": m.param_types, "return_type": m.return_type,
                }
                for m in e.methods
            ]
        elif isinstance(e, EnumDoc):
            item["members"] = e.members
        elif isinstance(e, InterfaceDoc):
            item["method_sigs"] = e.method_sigs
        result.append(item)
    return json.dumps(result, indent=2)


def doc_file(path, output_format="terminal", output_path=None):
    """Generate docs for a Clarity file."""
    if not os.path.exists(path):
        print(f"  {RED}>> File not found: {path}{RESET}")
        sys.exit(1)

    with open(path) as f:
        source = f.read()

    result = generate_docs(source, filename=path, output_format=output_format)

    if output_path:
        with open(output_path, 'w') as f:
            f.write(result)
        print(f"  {GREEN}Documentation written to {output_path}{RESET}")
    else:
        print(result)


def doc_dir(dir_path, output_format="terminal", output_path=None):
    """Generate docs for all .clarity files in a directory."""
    if not os.path.isdir(dir_path):
        print(f"  {RED}>> Directory not found: {dir_path}{RESET}")
        sys.exit(1)

    all_entries = []
    files = sorted(f for f in os.listdir(dir_path) if f.endswith('.clarity'))

    for fname in files:
        fpath = os.path.join(dir_path, fname)
        with open(fpath) as f:
            source = f.read()
        entries = generate_docs(source, filename=fpath, output_format="entries")
        if entries:
            all_entries.extend(entries)

    if output_format == "markdown":
        result = format_markdown(all_entries, title=f"Documentation: {dir_path}")
    elif output_format == "json":
        result = _entries_to_json(all_entries)
    else:
        result = format_terminal(all_entries, dir_path)

    if output_path:
        with open(output_path, 'w') as f:
            f.write(result)
        print(f"  {GREEN}Documentation written to {output_path}{RESET}")
    else:
        print(result)
