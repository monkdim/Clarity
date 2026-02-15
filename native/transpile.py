#!/usr/bin/env python3
"""Clarity-to-JavaScript transpiler.

Reads Clarity source, parses to AST, emits JavaScript.
The output runs on Bun/Node with the Clarity runtime.

Usage:
  python native/transpile.py <file.clarity>           # Transpile single file
  python native/transpile.py --bundle                 # Transpile CLI + stdlib → single JS
  python native/transpile.py --bundle --compile        # + compile to native binary via Bun
"""

import os
import sys
import textwrap

# Add native/ to path so local modules are found
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lexer import tokenize
from parser import parse
import ast_nodes as ast


class JSEmitter:
    """Transpiles a Clarity AST to JavaScript source code."""

    def __init__(self, module_name="<main>"):
        self.indent = 0
        self.module_name = module_name
        self.imports = set()  # Track Clarity imports to resolve
        self.classes = set()  # Track class names for `new` insertion
        self.source_map = []  # (js_line, clarity_file, clarity_line) entries
        self.hoisted_imports = []  # Imports found inside blocks, hoisted to top

    def emit(self, program):
        """Emit a full program."""
        lines = []
        for stmt in program.body:
            lines.append(self.emit_stmt(stmt))
        # Prepend any imports that were inside function/block bodies
        if self.hoisted_imports:
            hoisted = '\n'.join(self.hoisted_imports)
            return hoisted + '\n' + '\n'.join(lines)
        return '\n'.join(lines)

    def _indent(self):
        return '  ' * self.indent

    # ── Statements ────────────────────────────────────────

    def emit_stmt(self, node):
        name = node.__class__.__name__
        method = getattr(self, f'emit_{name}', None)
        if method is None:
            return f'{self._indent()}/* TODO: {name} */'
        result = method(node)
        # Emit source location comment for debuggable stack traces
        line = getattr(node, 'line', None)
        if line is not None:
            result = f'{self._indent()}/*@{self.module_name}:{line}*/\n{result}'
        return result

    def emit_ExpressionStatement(self, node):
        return f'{self._indent()}{self.emit_expr(node.expression)};'

    def emit_LetStatement(self, node):
        keyword = 'let' if node.mutable else 'const'
        val = self.emit_expr(node.value)
        name = self._safe_name(node.name)
        return f'{self._indent()}{keyword} {name} = {val};'

    def emit_DestructureLetStatement(self, node):
        keyword = 'let' if node.mutable else 'const'
        val = self.emit_expr(node.value)
        if node.kind == 'list':
            targets = ', '.join(self._safe_name(t) if isinstance(t, str) else self.emit_expr(t) for t in node.targets)
            return f'{self._indent()}{keyword} [{targets}] = {val};'
        else:
            targets = ', '.join(self._safe_name(t) if isinstance(t, str) else self.emit_expr(t) for t in node.targets)
            return f'{self._indent()}{keyword} {{{targets}}} = {val};'

    def emit_AssignStatement(self, node):
        target = self.emit_expr(node.target)
        val = self.emit_expr(node.value)
        op = node.operator
        return f'{self._indent()}{target} {op} {val};'

    def emit_MultiAssignStatement(self, node):
        lines = []
        for t, v in zip(node.targets, node.values):
            lines.append(f'{self._indent()}{self.emit_expr(t)} = {self.emit_expr(v)};')
        return '\n'.join(lines)

    def emit_FnStatement(self, node):
        name = self._safe_name(node.name)
        params = ', '.join(self._emit_param(p) for p in node.params)
        prefix = 'async ' if node.is_async else ''
        body = self._emit_block_body(node.body)
        return f'{self._indent()}{prefix}function {name}({params}) {{\n{body}\n{self._indent()}}}'

    def emit_ReturnStatement(self, node):
        if node.value:
            return f'{self._indent()}return {self.emit_expr(node.value)};'
        return f'{self._indent()}return;'

    def emit_IfStatement(self, node):
        cond = self.emit_expr(node.condition)
        body = self._emit_block_body(node.body)
        result = f'{self._indent()}if ($truthy({cond})) {{\n{body}\n{self._indent()}}}'

        if node.elif_clauses:
            for elif_cond, elif_body in node.elif_clauses:
                c = self.emit_expr(elif_cond)
                b = self._emit_block_body(elif_body)
                result += f' else if ($truthy({c})) {{\n{b}\n{self._indent()}}}'

        if node.else_body:
            b = self._emit_block_body(node.else_body)
            result += f' else {{\n{b}\n{self._indent()}}}'

        return result

    def emit_ForStatement(self, node):
        var = self._safe_name(node.variable)
        iterable = self.emit_expr(node.iterable)
        body = self._emit_block_body(node.body)
        return f'{self._indent()}for (const {var} of {iterable}) {{\n{body}\n{self._indent()}}}'

    def emit_WhileStatement(self, node):
        cond = self.emit_expr(node.condition)
        body = self._emit_block_body(node.body)
        return f'{self._indent()}while ($truthy({cond})) {{\n{body}\n{self._indent()}}}'

    def emit_TryCatch(self, node):
        try_body = self._emit_block_body(node.try_body)
        var = self._safe_name(node.catch_var) if node.catch_var else '_e'
        catch_body = self._emit_block_body(node.catch_body)
        result = f'{self._indent()}try {{\n{try_body}\n{self._indent()}}}'
        result += f' catch ({var}) {{\n{catch_body}\n{self._indent()}}}'
        if node.finally_body:
            fin = self._emit_block_body(node.finally_body)
            result += f' finally {{\n{fin}\n{self._indent()}}}'
        return result

    def emit_BreakStatement(self, node):
        return f'{self._indent()}break;'

    def emit_ContinueStatement(self, node):
        return f'{self._indent()}continue;'

    def emit_ThrowStatement(self, node):
        val = self.emit_expr(node.value)
        return f'{self._indent()}throw {val};'

    def emit_ShowStatement(self, node):
        vals = ', '.join(self.emit_expr(v) for v in node.values)
        return f'{self._indent()}$show({vals});'

    def emit_ImportStatement(self, node):
        if node.path:
            # File import: from "file.clarity" import x, y
            self.imports.add(node.path)
            js_path = node.path.replace('.clarity', '.js')
            if not js_path.startswith('./') and not js_path.startswith('/'):
                js_path = './' + js_path
            if node.names:
                names = ', '.join(self._safe_name(n) for n in node.names)
                import_line = f'import {{ {names} }} from "{js_path}";'
            else:
                alias = self._safe_name(node.alias or node.path.replace('.clarity', ''))
                import_line = f'import * as {alias} from "{js_path}";'
            # JS imports must be at module top level — hoist if nested
            if self.indent > 0:
                self.hoisted_imports.append(import_line)
                return f'{self._indent()}/* import hoisted: {js_path} */'
            return f'{self._indent()}{import_line}'
        elif node.module:
            # Module import: import math
            return f'{self._indent()}// module import: {node.module} (provided by runtime)'
        return f'{self._indent()}/* import */'

    def emit_ClassStatement(self, node):
        name = self._safe_name(node.name)
        self.classes.add(node.name)
        parent = f' extends {self._safe_name(node.parent)}' if node.parent else ''
        lines = [f'{self._indent()}class {name}{parent} {{']
        self.indent += 1
        for method in node.methods:
            if isinstance(method, ast.FnStatement):
                mname = method.name
                if mname == 'init':
                    mname = 'constructor'
                params = ', '.join(self._emit_param(p) for p in method.params)
                body = self._emit_block_body(method.body)
                lines.append(f'{self._indent()}{mname}({params}) {{')
                lines.append(body)
                lines.append(f'{self._indent()}}}')
        self.indent -= 1
        lines.append(f'{self._indent()}}}')
        return '\n'.join(lines)

    def emit_InterfaceStatement(self, node):
        return f'{self._indent()}/* interface {node.name} */'

    def emit_MatchStatement(self, node):
        subject = self.emit_expr(node.subject)
        tmp = '__match_val'
        lines = [f'{self._indent()}const {tmp} = {subject};']
        first = True
        for arm in node.arms:
            if len(arm) == 3:
                pattern, guard, body = arm
            else:
                pattern, body = arm[0], arm[1]
                guard = None
            kw = 'if' if first else 'else if'
            pat = self.emit_expr(pattern)
            cond = f'{tmp} === {pat}'
            if guard:
                cond += f' && $truthy({self.emit_expr(guard)})'
            b = self._emit_block_body(body)
            lines.append(f'{self._indent()}{kw} ({cond}) {{')
            lines.append(b)
            lines.append(f'{self._indent()}}}')
            first = False
        if node.default:
            b = self._emit_block_body(node.default)
            lines.append(f'{self._indent()}else {{')
            lines.append(b)
            lines.append(f'{self._indent()}}}')
        return '\n'.join(lines)

    def emit_EnumStatement(self, node):
        name = self._safe_name(node.name)
        members = []
        for i, (mname, mval) in enumerate(node.members):
            if mval is not None:
                members.append(f'"{mname}": {self.emit_expr(mval)}')
            else:
                members.append(f'"{mname}": {i}')
        inner = ', '.join(members)
        return f'{self._indent()}const {name} = new $ClarityEnum("{node.name}", {{{inner}}});'

    def emit_DecoratedStatement(self, node):
        # Emit the target, then wrap it
        target_code = self.emit_stmt(node.target)
        name = node.target.name if hasattr(node.target, 'name') else None
        if name and node.decorators:
            lines = [target_code]
            for dec in reversed(node.decorators):
                dec_expr = self.emit_expr(dec)
                safe = self._safe_name(name)
                lines.append(f'{self._indent()}{safe} = {dec_expr}({safe});')
            return '\n'.join(lines)
        return target_code

    def emit_Block(self, node):
        return self._emit_block_body(node)

    # ── Expressions ───────────────────────────────────────

    def emit_expr(self, node):
        if node is None:
            return 'null'
        name = node.__class__.__name__
        method = getattr(self, f'expr_{name}', None)
        if method is None:
            return f'/* TODO expr: {name} */'
        return method(node)

    def expr_NumberLiteral(self, node):
        return str(node.value)

    def expr_StringLiteral(self, node):
        # Convert Clarity string interpolation to JS template literals
        s = node.value
        if '{' in s and '}' in s:
            # Replace {expr} with ${expr}
            result = self._convert_interpolation(s)
            return f'`{result}`'
        # Escape backticks and use regular string
        escaped = s.replace('\\', '\\\\').replace('"', '\\"')
        return f'"{escaped}"'

    def expr_BoolLiteral(self, node):
        return 'true' if node.value else 'false'

    def expr_NullLiteral(self, node):
        return 'null'

    def expr_Identifier(self, node):
        return self._safe_name(node.name)

    def expr_ThisExpression(self, node):
        return 'this'

    def expr_ListLiteral(self, node):
        elements = []
        for el in node.elements:
            if isinstance(el, ast.SpreadExpression):
                elements.append(f'...{self.emit_expr(el.value)}')
            else:
                elements.append(self.emit_expr(el))
        return '[' + ', '.join(elements) + ']'

    def expr_MapLiteral(self, node):
        pairs = []
        for key, val in node.pairs:
            if key is None and isinstance(val, ast.SpreadExpression):
                pairs.append(f'...{self.emit_expr(val.value)}')
            else:
                k = self.emit_expr(key)
                v = self.emit_expr(val)
                pairs.append(f'[{k}]: {v}')
        return '{' + ', '.join(pairs) + '}'

    def expr_BinaryOp(self, node):
        left = self.emit_expr(node.left)
        right = self.emit_expr(node.right)
        op = node.operator

        # Map Clarity operators to JS
        op_map = {
            'and': '&&', 'or': '||',
            '**': '**',
        }
        js_op = op_map.get(op, op)

        if op == '+':
            # Clarity: string + anything = string concat (same in JS)
            return f'({left} + {right})'
        return f'({left} {js_op} {right})'

    def expr_UnaryOp(self, node):
        operand = self.emit_expr(node.operand)
        op = node.operator
        if op == 'not':
            return f'(!$truthy({operand}))'
        return f'({op}{operand})'

    def expr_CallExpression(self, node):
        callee = self.emit_expr(node.callee)
        args = ', '.join(self.emit_expr(a) for a in node.arguments)
        # In Clarity, class instantiation looks like a function call.
        # In JS, classes require `new`.
        if isinstance(node.callee, ast.Identifier) and node.callee.name in self.classes:
            return f'new {callee}({args})'
        return f'{callee}({args})'

    def expr_MemberExpression(self, node):
        obj = self.emit_expr(node.object)
        prop = node.property
        if isinstance(node.object, ast.Identifier) and node.object.name in ('this',):
            return f'{obj}.{prop}'
        # Use bracket notation for safety
        return f'{obj}.{self._safe_name(prop)}'

    def expr_OptionalMemberExpression(self, node):
        obj = self.emit_expr(node.object)
        prop = node.property
        return f'{obj}?.{self._safe_name(prop)}'

    def expr_IndexExpression(self, node):
        obj = self.emit_expr(node.object)
        idx = self.emit_expr(node.index)
        return f'{obj}[{idx}]'

    def expr_SliceExpression(self, node):
        obj = self.emit_expr(node.object)
        start = self.emit_expr(node.start) if node.start else '0'
        end = self.emit_expr(node.end) if node.end else ''
        if end:
            return f'{obj}.slice({start}, {end})'
        return f'{obj}.slice({start})'

    def expr_FnExpression(self, node):
        params = ', '.join(self._emit_param(p) for p in node.params)
        if len(node.body.statements) == 1 and isinstance(node.body.statements[0], ast.ReturnStatement):
            # Arrow function shorthand
            val = self.emit_expr(node.body.statements[0].value)
            return f'(({params}) => {val})'
        body = self._emit_block_body(node.body)
        return f'(function({params}) {{\n{body}\n{self._indent()}}})'

    def expr_PipeExpression(self, node):
        val = self.emit_expr(node.value)
        fn = node.function
        if isinstance(fn, ast.CallExpression):
            callee = self.emit_expr(fn.callee)
            args = ', '.join(self.emit_expr(a) for a in fn.arguments)
            if args:
                return f'{callee}({val}, {args})'
            return f'{callee}({val})'
        return f'{self.emit_expr(fn)}({val})'

    def expr_RangeExpression(self, node):
        start = self.emit_expr(node.start)
        end = self.emit_expr(node.end) if node.end else 'undefined'
        return f'$range({start}, {end})'

    def expr_AskExpression(self, node):
        prompt = self.emit_expr(node.prompt)
        return f'$ask({prompt})'

    def expr_NullCoalesce(self, node):
        left = self.emit_expr(node.left)
        right = self.emit_expr(node.right)
        return f'(({left}) ?? ({right}))'

    def expr_SpreadExpression(self, node):
        return f'...{self.emit_expr(node.value)}'

    def expr_IfExpression(self, node):
        cond = self.emit_expr(node.condition)
        true_expr = self.emit_expr(node.true_expr)
        false_expr = self.emit_expr(node.false_expr)
        return f'($truthy({cond}) ? {true_expr} : {false_expr})'

    def expr_ComprehensionExpression(self, node):
        var = self._safe_name(node.variable)
        iterable = self.emit_expr(node.iterable)
        expr = self.emit_expr(node.expr)
        if node.condition:
            cond = self.emit_expr(node.condition)
            return f'{iterable}.filter(({var}) => $truthy({cond})).map(({var}) => {expr})'
        return f'{iterable}.map(({var}) => {expr})'

    def expr_MapComprehensionExpression(self, node):
        var = self._safe_name(node.variables) if isinstance(node.variables, str) else ', '.join(self._safe_name(v) for v in node.variables)
        iterable = self.emit_expr(node.iterable)
        key_expr = self.emit_expr(node.key_expr)
        val_expr = self.emit_expr(node.value_expr)
        if node.condition:
            cond = self.emit_expr(node.condition)
            return f'Object.fromEntries({iterable}.filter(({var}) => $truthy({cond})).map(({var}) => [{key_expr}, {val_expr}]))'
        return f'Object.fromEntries({iterable}.map(({var}) => [{key_expr}, {val_expr}]))'

    def expr_AwaitExpression(self, node):
        return f'(await {self.emit_expr(node.value)})'

    def expr_YieldExpression(self, node):
        if node.value:
            return f'(yield {self.emit_expr(node.value)})'
        return '(yield)'

    # ── Helpers ───────────────────────────────────────────

    def _emit_block_body(self, block):
        self.indent += 1
        lines = []
        stmts = block.statements if hasattr(block, 'statements') else block.body if hasattr(block, 'body') else []
        for stmt in stmts:
            lines.append(self.emit_stmt(stmt))
        self.indent -= 1
        return '\n'.join(lines)

    def _emit_param(self, param):
        if isinstance(param, str):
            return self._safe_name(param)
        if isinstance(param, tuple):
            name, default = param[0], param[1] if len(param) > 1 else None
            if isinstance(name, str) and name.startswith('...'):
                return f'...{self._safe_name(name[3:])}'
            safe = self._safe_name(name) if isinstance(name, str) else str(name)
            if default is not None:
                return f'{safe} = {self.emit_expr(default)}'
            return safe
        return str(param)

    def _safe_name(self, name):
        """Rename Clarity identifiers that clash with JS reserved words or runtime."""
        if not isinstance(name, str):
            return str(name)
        js_reserved = {
            'int': '$int', 'float': '$float', 'bool': '$bool',
            'set': '$set', 'min': '$min', 'max': '$max',
            'join': '$join', 'repeat': '$repeat',
            'class': '$class', 'new': '$new', 'delete': '$delete',
            'switch': '$switch', 'case': '$case', 'default': '$default',
            'typeof': '$typeof', 'void': '$void', 'with': '$with',
            'yield': '$yield', 'debugger': '$debugger',
            'instanceof': '$instanceof', 'in': '$in',
            'var': '$var', 'const': '$const',
        }
        return js_reserved.get(name, name)

    def _convert_interpolation(self, s):
        """Convert Clarity string interpolation {expr} to JS template ${expr}."""
        result = []
        i = 0
        while i < len(s):
            if s[i] == '{':
                # Find matching close brace
                depth = 1
                j = i + 1
                while j < len(s) and depth > 0:
                    if s[j] == '{': depth += 1
                    elif s[j] == '}': depth -= 1
                    j += 1
                expr = s[i+1:j-1]
                result.append('${' + self._safe_name(expr) + '}')
                i = j
            elif s[i] == '`':
                result.append('\\`')
                i += 1
            elif s[i] == '\\':
                result.append(s[i:i+2] if i + 1 < len(s) else '\\')
                i += 2
            else:
                result.append(s[i])
                i += 1
        return ''.join(result)


# ── Public API ────────────────────────────────────────────

def transpile_source(source, filename="<input>"):
    """Transpile Clarity source code to JavaScript."""
    tokens = tokenize(source, filename)
    tree = parse(tokens, source)
    emitter = JSEmitter(module_name=filename)
    js_code = emitter.emit(tree)
    return js_code, emitter.imports


def transpile_file(path):
    """Transpile a .clarity file to .js."""
    with open(path) as f:
        source = f.read()
    js_code, imports = transpile_source(source, os.path.basename(path))
    return js_code, imports


def transpile_with_runtime(path):
    """Transpile a file and prepend the runtime import."""
    js_code, imports = transpile_file(path)

    # Add runtime imports
    header = (
        '// Generated by Clarity transpiler — do not edit\n'
        'import { show as $show, ask as $ask, read, write, append, exists, lines,\n'
        '  $int, $float, str, $bool, type, len, push, pop, sort, reverse, range as $range,\n'
        '  map, filter, reduce, each, find, every, some, flat, zip, unique,\n'
        '  keys, values, entries, merge, has, split, $join, replace, trim,\n'
        '  upper, lower, contains, starts, ends, chars, $repeat,\n'
        '  pad_left, pad_right, char_at, char_code, from_char_code, index_of, substring,\n'
        '  is_digit, is_alpha, is_alnum, is_space,\n'
        '  abs, round, floor, ceil, $min, $max, sum, random, pow,\n'
        '  pi, e, sqrt, sin, cos, tan, log,\n'
        '  exec, exec_full, exit, sleep, time, env, args, cwd,\n'
        '  json_parse, json_string, hash, encode64, decode64,\n'
        '  fetch, serve, compose, tap, $set, error as $error,\n'
        '  display, repr, truthy as $truthy, ClarityEnum as $ClarityEnum,\n'
        '  ClarityInstance as $ClarityInstance,\n'
        '  formatClarityError, clarityMain\n'
        '} from "./runtime.js";\n\n'
    )

    return header + js_code


# ── CLI ───────────────────────────────────────────────────

def main():
    import argparse
    ap = argparse.ArgumentParser(description='Clarity → JavaScript transpiler')
    ap.add_argument('file', nargs='?', help='Clarity source file to transpile')
    ap.add_argument('--bundle', action='store_true', help='Bundle CLI + stdlib into single JS')
    ap.add_argument('--compile', action='store_true', help='Compile to native binary via Bun')
    ap.add_argument('--out', '-o', help='Output path')
    args = ap.parse_args()

    if args.file:
        js = transpile_with_runtime(args.file)
        out = args.out or args.file.replace('.clarity', '.js')
        with open(out, 'w') as f:
            f.write(js)
        print(f'  Transpiled: {args.file} → {out}')

    elif args.bundle:
        bundle(compile_native=args.compile)

    else:
        ap.print_help()


def bundle(compile_native=False):
    """Bundle the entire Clarity CLI + stdlib into a single JS program."""
    import subprocess

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    native_dir = os.path.join(project_root, 'native')
    stdlib_dir = os.path.join(project_root, 'stdlib')
    dist_dir = os.path.join(native_dir, 'dist')
    os.makedirs(dist_dir, exist_ok=True)

    # Transpile all stdlib files
    stdlib_files = [
        'tokens.clarity', 'lexer.clarity', 'ast_nodes.clarity',
        'parser.clarity', 'interpreter.clarity', 'terminal.clarity',
        'process.clarity', 'shell.clarity', 'repl.clarity',
        'package.clarity', 'lsp.clarity', 'bytecode.clarity',
        'runtime.clarity',
        'linter.clarity', 'formatter.clarity', 'type_checker.clarity',
        'docgen.clarity', 'debugger.clarity', 'profiler.clarity',
        'collections.clarity', 'datetime.clarity', 'path.clarity',
        'net.clarity', 'db.clarity', 'crypto.clarity',
        'semver.clarity', 'registry.clarity',
        'highlight.clarity', 'completer.clarity', 'pretty.clarity',
        'channel.clarity', 'task.clarity', 'mutex.clarity', 'worker.clarity',
        'transpile.clarity',
        'build.clarity', 'test_smoke.clarity',
        'runtime_spec.clarity', 'runtime_gen.clarity',
        'cli.clarity',
    ]

    print('  Transpiling stdlib...')
    for fname in stdlib_files:
        src = os.path.join(stdlib_dir, fname)
        if os.path.exists(src):
            try:
                js = transpile_with_runtime(src)
                out = os.path.join(dist_dir, fname.replace('.clarity', '.js'))
                with open(out, 'w') as f:
                    f.write(js)
                print(f'    {fname} → {os.path.basename(out)}')
            except Exception as e:
                print(f'    {fname} — SKIP ({e})')

    # Copy runtime
    import shutil
    runtime_src = os.path.join(native_dir, 'runtime.js')
    runtime_dst = os.path.join(dist_dir, 'runtime.js')
    shutil.copy2(runtime_src, runtime_dst)
    print(f'    runtime.js copied')

    # Create entry point
    entry = os.path.join(dist_dir, 'clarity-entry.js')
    with open(entry, 'w') as f:
        f.write('#!/usr/bin/env bun\n')
        f.write('// Clarity native entry point\n')
        f.write('import { clarityMain } from "./runtime.js";\n')
        f.write('clarityMain(() => {\n')
        f.write('  import("./cli.js");\n')
        f.write('});\n')
    print(f'    clarity-entry.js created')

    # Create package.json for the bundle
    pkg_json = os.path.join(dist_dir, 'package.json')
    with open(pkg_json, 'w') as f:
        f.write('{"type": "module"}\n')

    if compile_native:
        print()
        print('  Compiling to native binary...')
        out_bin = os.path.join(dist_dir, 'clarity')
        try:
            subprocess.check_call(
                ['bun', 'build', '--compile', entry, '--outfile', out_bin],
                cwd=dist_dir,
            )
            size = os.path.getsize(out_bin) / (1024 * 1024)
            print(f'  Native binary: {out_bin} ({size:.1f} MB)')
            print()
            print('  Install:')
            print(f'    sudo cp {out_bin} /usr/local/bin/clarity')
            print('    clarity shell')
        except FileNotFoundError:
            print('  ERROR: Bun not found. Install it:')
            print('    curl -fsSL https://bun.sh/install | bash')
        except subprocess.CalledProcessError as e:
            print(f'  ERROR: Bun compile failed: {e}')
    else:
        print()
        print(f'  Bundle ready at: {dist_dir}/')
        print(f'  Run with:   bun {entry}')
        print(f'  Compile:    bun build --compile {entry} --outfile clarity')


if __name__ == '__main__':
    main()
