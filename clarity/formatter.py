"""Clarity code formatter.

Parses Clarity source to AST, then pretty-prints it with consistent style.
Handles all 22 statement types and 25+ expression types.

Usage:
    from clarity.formatter import format_source
    formatted = format_source(source_code)
"""

from clarity.lexer import tokenize
from clarity.parser import parse
from clarity import ast_nodes as ast


class Formatter:
    """AST pretty-printer that emits canonical Clarity source code."""

    def __init__(self, indent_size=4, max_width=100):
        self.indent_size = indent_size
        self.max_width = max_width
        self.indent_level = 0

    def format(self, program):
        """Format a full Program AST."""
        parts = []
        prev_kind = None
        for stmt in program.body:
            kind = self._stmt_kind(stmt)
            # Add blank line between different kinds of top-level constructs
            if prev_kind and parts and self._needs_blank_line(prev_kind, kind):
                parts.append('')
            parts.append(self.fmt_stmt(stmt))
            prev_kind = kind
        result = '\n'.join(parts)
        # Ensure single trailing newline
        if result and not result.endswith('\n'):
            result += '\n'
        return result

    def _indent(self):
        return ' ' * (self.indent_size * self.indent_level)

    def _stmt_kind(self, node):
        """Classify statement for blank-line logic."""
        name = node.__class__.__name__
        if name in ('FnStatement', 'ClassStatement', 'InterfaceStatement'):
            return 'definition'
        if name == 'ImportStatement':
            return 'import'
        if name in ('EnumStatement',):
            return 'definition'
        return 'statement'

    def _needs_blank_line(self, prev, current):
        """Whether to insert a blank line between statement kinds."""
        if prev == 'import' and current != 'import':
            return True
        if current == 'definition':
            return True
        if prev == 'definition':
            return True
        return False

    # ── Statements ────────────────────────────────────────

    def fmt_stmt(self, node):
        name = node.__class__.__name__
        method = getattr(self, f'fmt_{name}', None)
        if method is None:
            return f'{self._indent()}-- TODO: {name}'
        return method(node)

    def fmt_LetStatement(self, node):
        keyword = 'mut' if node.mutable else 'let'
        val = self.fmt_expr(node.value)
        ann = f': {node.type_annotation}' if node.type_annotation else ''
        return f'{self._indent()}{keyword} {node.name}{ann} = {val}'

    def fmt_DestructureLetStatement(self, node):
        keyword = 'mut' if node.mutable else 'let'
        val = self.fmt_expr(node.value)
        if node.kind == 'list':
            targets = ', '.join(t if isinstance(t, str) else self.fmt_expr(t) for t in node.targets)
            return f'{self._indent()}{keyword} [{targets}] = {val}'
        else:
            targets = ', '.join(t if isinstance(t, str) else self.fmt_expr(t) for t in node.targets)
            return f'{self._indent()}{keyword} {{{targets}}} = {val}'

    def fmt_AssignStatement(self, node):
        target = self.fmt_expr(node.target)
        val = self.fmt_expr(node.value)
        return f'{self._indent()}{target} {node.operator} {val}'

    def fmt_MultiAssignStatement(self, node):
        parts = []
        for t, v in zip(node.targets, node.values):
            parts.append(f'{self._indent()}{self.fmt_expr(t)} = {self.fmt_expr(v)}')
        return '\n'.join(parts)

    def fmt_FnStatement(self, node):
        prefix = 'async ' if node.is_async else ''
        params = ', '.join(self._fmt_param(p) for p in node.params)
        body = self._fmt_block(node.body)
        return f'{self._indent()}{prefix}fn {node.name}({params}) {{\n{body}\n{self._indent()}}}'

    def fmt_ReturnStatement(self, node):
        if node.value:
            return f'{self._indent()}return {self.fmt_expr(node.value)}'
        return f'{self._indent()}return'

    def fmt_IfStatement(self, node):
        cond = self.fmt_expr(node.condition)
        body = self._fmt_block(node.body)
        result = f'{self._indent()}if {cond} {{\n{body}\n{self._indent()}}}'

        if node.elif_clauses:
            for elif_cond, elif_body in node.elif_clauses:
                c = self.fmt_expr(elif_cond)
                b = self._fmt_block(elif_body)
                result += f' elif {c} {{\n{b}\n{self._indent()}}}'

        if node.else_body:
            b = self._fmt_block(node.else_body)
            result += f' else {{\n{b}\n{self._indent()}}}'

        return result

    def fmt_ForStatement(self, node):
        var = node.variable
        iterable = self.fmt_expr(node.iterable)
        body = self._fmt_block(node.body)
        return f'{self._indent()}for {var} in {iterable} {{\n{body}\n{self._indent()}}}'

    def fmt_WhileStatement(self, node):
        cond = self.fmt_expr(node.condition)
        body = self._fmt_block(node.body)
        return f'{self._indent()}while {cond} {{\n{body}\n{self._indent()}}}'

    def fmt_TryCatch(self, node):
        try_body = self._fmt_block(node.try_body)
        var = node.catch_var or 'e'
        catch_body = self._fmt_block(node.catch_body)
        result = f'{self._indent()}try {{\n{try_body}\n{self._indent()}}}'
        result += f' catch {var} {{\n{catch_body}\n{self._indent()}}}'
        if node.finally_body:
            fin = self._fmt_block(node.finally_body)
            result += f' finally {{\n{fin}\n{self._indent()}}}'
        return result

    def fmt_BreakStatement(self, node):
        return f'{self._indent()}break'

    def fmt_ContinueStatement(self, node):
        return f'{self._indent()}continue'

    def fmt_ThrowStatement(self, node):
        val = self.fmt_expr(node.value)
        return f'{self._indent()}throw {val}'

    def fmt_ShowStatement(self, node):
        vals = ', '.join(self.fmt_expr(v) for v in node.values)
        return f'{self._indent()}show {vals}'

    def fmt_ImportStatement(self, node):
        if node.path:
            if node.names:
                names = ', '.join(node.names)
                return f'{self._indent()}from "{node.path}" import {names}'
            elif node.alias:
                return f'{self._indent()}from "{node.path}" import {node.alias}'
            else:
                return f'{self._indent()}import "{node.path}"'
        elif node.module:
            if node.alias:
                return f'{self._indent()}import {node.module} as {node.alias}'
            return f'{self._indent()}import {node.module}'
        return f'{self._indent()}import ...'

    def fmt_ClassStatement(self, node):
        parent = f' : {node.parent}' if node.parent else ''
        lines = [f'{self._indent()}class {node.name}{parent} {{']
        self.indent_level += 1
        for i, method in enumerate(node.methods):
            if i > 0:
                lines.append('')
            lines.append(self.fmt_stmt(method))
        self.indent_level -= 1
        lines.append(f'{self._indent()}}}')
        return '\n'.join(lines)

    def fmt_InterfaceStatement(self, node):
        lines = [f'{self._indent()}interface {node.name} {{']
        self.indent_level += 1
        for sig in node.method_sigs:
            name = sig[0] if isinstance(sig, (list, tuple)) else sig
            params = sig[1] if isinstance(sig, (list, tuple)) and len(sig) > 1 else []
            p_str = ', '.join(str(p) for p in params) if params else ''
            lines.append(f'{self._indent()}fn {name}({p_str})')
        self.indent_level -= 1
        lines.append(f'{self._indent()}}}')
        return '\n'.join(lines)

    def fmt_MatchStatement(self, node):
        subject = self.fmt_expr(node.subject)
        lines = [f'{self._indent()}match {subject} {{']
        self.indent_level += 1
        for arm in node.arms:
            if len(arm) == 3:
                pattern, guard, body = arm
                pat = self.fmt_expr(pattern)
                g = self.fmt_expr(guard)
                b = self._fmt_block(body)
                lines.append(f'{self._indent()}when {pat} if {g} {{')
                lines.append(b)
                lines.append(f'{self._indent()}}}')
            else:
                pattern, body = arm[0], arm[1]
                pat = self.fmt_expr(pattern)
                b = self._fmt_block(body)
                lines.append(f'{self._indent()}when {pat} {{')
                lines.append(b)
                lines.append(f'{self._indent()}}}')
        if node.default:
            b = self._fmt_block(node.default)
            lines.append(f'{self._indent()}else {{')
            lines.append(b)
            lines.append(f'{self._indent()}}}')
        self.indent_level -= 1
        lines.append(f'{self._indent()}}}')
        return '\n'.join(lines)

    def fmt_EnumStatement(self, node):
        members = []
        for name, val in node.members:
            if val is not None:
                members.append(f'{name} = {self.fmt_expr(val)}')
            else:
                members.append(name)
        inner = ', '.join(members)
        return f'{self._indent()}enum {node.name} {{ {inner} }}'

    def fmt_DecoratedStatement(self, node):
        lines = []
        for dec in node.decorators:
            lines.append(f'{self._indent()}@{self.fmt_expr(dec)}')
        lines.append(self.fmt_stmt(node.target))
        return '\n'.join(lines)

    def fmt_ExpressionStatement(self, node):
        return f'{self._indent()}{self.fmt_expr(node.expression)}'

    def fmt_Block(self, node):
        return self._fmt_block(node)

    # ── Expressions ───────────────────────────────────────

    def fmt_expr(self, node):
        if node is None:
            return 'null'
        name = node.__class__.__name__
        method = getattr(self, f'expr_{name}', None)
        if method is None:
            return f'/* {name} */'
        return method(node)

    def expr_NumberLiteral(self, node):
        return str(node.value)

    def expr_StringLiteral(self, node):
        escaped = node.value.replace('\\', '\\\\').replace('"', '\\"')
        return f'"{escaped}"'

    def expr_BoolLiteral(self, node):
        return 'true' if node.value else 'false'

    def expr_NullLiteral(self, node):
        return 'null'

    def expr_Identifier(self, node):
        return node.name

    def expr_ThisExpression(self, node):
        return 'this'

    def expr_ListLiteral(self, node):
        if not node.elements:
            return '[]'
        elements = []
        for el in node.elements:
            if isinstance(el, ast.SpreadExpression):
                elements.append(f'...{self.fmt_expr(el.value)}')
            else:
                elements.append(self.fmt_expr(el))
        inner = ', '.join(elements)
        result = f'[{inner}]'
        if len(result) > self.max_width - len(self._indent()):
            # Multi-line list
            self.indent_level += 1
            lines = [f'{self._indent()}{e},' for e in elements]
            self.indent_level -= 1
            return '[\n' + '\n'.join(lines) + '\n' + self._indent() + ']'
        return result

    def expr_MapLiteral(self, node):
        if not node.pairs:
            return '{}'
        pairs = []
        for key, val in node.pairs:
            if key is None and isinstance(val, ast.SpreadExpression):
                pairs.append(f'...{self.fmt_expr(val.value)}')
            else:
                pairs.append(f'{self.fmt_expr(key)}: {self.fmt_expr(val)}')
        inner = ', '.join(pairs)
        result = f'{{{inner}}}'
        if len(result) > self.max_width - len(self._indent()):
            self.indent_level += 1
            lines = [f'{self._indent()}{p},' for p in pairs]
            self.indent_level -= 1
            return '{\n' + '\n'.join(lines) + '\n' + self._indent() + '}'
        return result

    def expr_BinaryOp(self, node):
        left = self.fmt_expr(node.left)
        right = self.fmt_expr(node.right)
        return f'{left} {node.operator} {right}'

    def expr_UnaryOp(self, node):
        operand = self.fmt_expr(node.operand)
        if node.operator == 'not':
            return f'not {operand}'
        return f'{node.operator}{operand}'

    def expr_CallExpression(self, node):
        callee = self.fmt_expr(node.callee)
        args = ', '.join(self.fmt_expr(a) for a in node.arguments)
        return f'{callee}({args})'

    def expr_MemberExpression(self, node):
        obj = self.fmt_expr(node.object)
        return f'{obj}.{node.property}'

    def expr_OptionalMemberExpression(self, node):
        obj = self.fmt_expr(node.object)
        return f'{obj}?.{node.property}'

    def expr_IndexExpression(self, node):
        obj = self.fmt_expr(node.object)
        idx = self.fmt_expr(node.index)
        return f'{obj}[{idx}]'

    def expr_SliceExpression(self, node):
        obj = self.fmt_expr(node.object)
        start = self.fmt_expr(node.start) if node.start else ''
        end = self.fmt_expr(node.end) if node.end else ''
        return f'{obj}[{start}:{end}]'

    def expr_FnExpression(self, node):
        params = ', '.join(self._fmt_param(p) for p in node.params)
        stmts = node.body.statements if hasattr(node.body, 'statements') else node.body.body if hasattr(node.body, 'body') else []
        # Single-expression body: fn(x) { return x * 2 }
        if len(stmts) == 1 and isinstance(stmts[0], ast.ReturnStatement) and stmts[0].value:
            val = self.fmt_expr(stmts[0].value)
            return f'fn({params}) {{ return {val} }}'
        body = self._fmt_block(node.body)
        return f'fn({params}) {{\n{body}\n{self._indent()}}}'

    def expr_PipeExpression(self, node):
        val = self.fmt_expr(node.value)
        fn = self.fmt_expr(node.function)
        return f'{val} |> {fn}'

    def expr_RangeExpression(self, node):
        start = self.fmt_expr(node.start)
        if node.end:
            end = self.fmt_expr(node.end)
            return f'{start}..{end}'
        return f'{start}..'

    def expr_AskExpression(self, node):
        prompt = self.fmt_expr(node.prompt)
        return f'ask({prompt})'

    def expr_NullCoalesce(self, node):
        left = self.fmt_expr(node.left)
        right = self.fmt_expr(node.right)
        return f'{left} ?? {right}'

    def expr_SpreadExpression(self, node):
        return f'...{self.fmt_expr(node.value)}'

    def expr_IfExpression(self, node):
        cond = self.fmt_expr(node.condition)
        true_expr = self.fmt_expr(node.true_expr)
        false_expr = self.fmt_expr(node.false_expr)
        return f'if {cond} {{ {true_expr} }} else {{ {false_expr} }}'

    def expr_ComprehensionExpression(self, node):
        expr = self.fmt_expr(node.expr)
        var = node.variable
        iterable = self.fmt_expr(node.iterable)
        if node.condition:
            cond = self.fmt_expr(node.condition)
            return f'[{expr} for {var} in {iterable} if {cond}]'
        return f'[{expr} for {var} in {iterable}]'

    def expr_MapComprehensionExpression(self, node):
        key_expr = self.fmt_expr(node.key_expr)
        val_expr = self.fmt_expr(node.value_expr)
        var = node.variables if isinstance(node.variables, str) else ', '.join(node.variables)
        iterable = self.fmt_expr(node.iterable)
        if node.condition:
            cond = self.fmt_expr(node.condition)
            return f'{{{key_expr}: {val_expr} for {var} in {iterable} if {cond}}}'
        return f'{{{key_expr}: {val_expr} for {var} in {iterable}}}'

    def expr_AwaitExpression(self, node):
        return f'await {self.fmt_expr(node.value)}'

    def expr_YieldExpression(self, node):
        if node.value:
            return f'yield {self.fmt_expr(node.value)}'
        return 'yield'

    # ── Helpers ───────────────────────────────────────────

    def _fmt_block(self, block):
        stmts = block.statements if hasattr(block, 'statements') else block.body if hasattr(block, 'body') else []
        self.indent_level += 1
        lines = []
        for stmt in stmts:
            formatted = self.fmt_stmt(stmt)
            if formatted:
                lines.append(formatted)
        self.indent_level -= 1
        return '\n'.join(lines)

    def _fmt_param(self, param):
        if isinstance(param, str):
            if param.startswith('...'):
                return param
            return param
        if isinstance(param, tuple):
            name = param[0]
            default = param[1] if len(param) > 1 else None
            if isinstance(name, str) and name.startswith('...'):
                return name
            if default is not None:
                return f'{name} = {self.fmt_expr(default)}'
            return str(name)
        return str(param)


# ── Public API ────────────────────────────────────────────

def format_source(source, indent_size=4, max_width=100, filename="<input>"):
    """Format Clarity source code string, return formatted string."""
    tokens = tokenize(source, filename)
    tree = parse(tokens, source)
    formatter = Formatter(indent_size=indent_size, max_width=max_width)
    return formatter.format(tree)


def format_file(path, write=False, check=False, indent_size=4):
    """Format a .clarity file. Returns (formatted, changed)."""
    with open(path) as f:
        original = f.read()
    formatted = format_source(original, indent_size=indent_size, filename=path)
    changed = formatted != original
    if write and changed:
        with open(path, 'w') as f:
            f.write(formatted)
    return formatted, changed
