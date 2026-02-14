"""Clarity linter — static analysis for common code issues."""

from . import ast_nodes as ast


class LintDiagnostic:
    """A single lint diagnostic."""
    __slots__ = ('message', 'line', 'column', 'severity', 'code')

    def __init__(self, message, line=None, column=None, severity="warning", code=None):
        self.message = message
        self.line = line
        self.column = column
        self.severity = severity
        self.code = code  # e.g. "W001"

    def __repr__(self):
        loc = f":{self.line}" if self.line else ""
        c = f" [{self.code}]" if self.code else ""
        return f"[{self.severity}]{loc}{c} {self.message}"


BUILTINS = {
    "show", "ask", "len", "type", "str", "int", "float", "bool",
    "abs", "round", "floor", "ceil", "min", "max", "sum", "sqrt",
    "pow", "sin", "cos", "tan", "log", "pi", "e", "random",
    "upper", "lower", "trim", "split", "join", "replace",
    "contains", "starts", "ends", "chars", "repeat",
    "keys", "values", "entries", "merge", "has",
    "push", "pop", "sort", "reverse",
    "map", "filter", "reduce", "find", "every", "some", "each",
    "flat", "zip", "unique", "range",
    "display", "repr", "json_parse", "json_string",
    "read", "write", "append", "exists", "lines",
    "encode64", "decode64", "hash",
    "exec", "exec_full", "exit", "sleep", "time", "env", "args", "cwd",
    "fetch", "serve", "compose", "tap", "set", "error",
    "is_digit", "is_alpha", "is_alnum", "is_space",
    "char_at", "char_code", "from_char_code", "index_of", "substring",
    "pad_left", "pad_right",
}


class LintScope:
    """Track variable usage in a scope."""

    def __init__(self, parent=None, scope_type="block"):
        self.parent = parent
        self.scope_type = scope_type  # "block", "function", "class", "module"
        self.declared = {}    # name -> (line, mutable, used, assigned)
        self.assigned = set() # names that were reassigned

    def declare(self, name, line, mutable=False):
        self.declared[name] = {"line": line, "mutable": mutable, "used": False}

    def mark_used(self, name):
        if name in self.declared:
            self.declared[name]["used"] = True
            return True
        if self.parent:
            return self.parent.mark_used(name)
        return False

    def mark_assigned(self, name):
        self.assigned.add(name)
        if self.parent:
            self.parent.mark_assigned(name)

    def is_declared(self, name):
        if name in self.declared:
            return True
        if self.parent:
            return self.parent.is_declared(name)
        return False

    def is_declared_locally(self, name):
        return name in self.declared


class Linter:
    """Static linter for Clarity ASTs."""

    def __init__(self):
        self.diagnostics = []
        self.scope = LintScope(scope_type="module")
        # Pre-register builtins
        for b in BUILTINS:
            self.scope.declare(b, 0)
            self.scope.mark_used(b)

    def lint(self, program):
        """Lint a Program node. Returns list of LintDiagnostic."""
        self.diagnostics = []
        for stmt in program.body:
            self._lint_stmt(stmt)
        # Check unused at module level (skip builtins)
        self._check_unused(self.scope, skip_builtins=True)
        return self.diagnostics

    def _diag(self, msg, node_or_line, severity="warning", code=None):
        if isinstance(node_or_line, int):
            line = node_or_line
        else:
            line = getattr(node_or_line, 'line', None)
        self.diagnostics.append(LintDiagnostic(msg, line, severity=severity, code=code))

    def _push_scope(self, scope_type="block"):
        self.scope = LintScope(self.scope, scope_type)

    def _pop_scope(self, check_unused=True):
        if check_unused:
            self._check_unused(self.scope)
        self.scope = self.scope.parent

    def _check_unused(self, scope, skip_builtins=False):
        for name, info in scope.declared.items():
            if skip_builtins and name in BUILTINS:
                continue
            if info["line"] == 0:
                continue
            if not info["used"] and not name.startswith("_"):
                self._diag(
                    f"Unused variable '{name}'",
                    info["line"], code="W001"
                )
            if info["mutable"] and name not in scope.assigned and not name.startswith("_"):
                if info["used"]:  # only warn if the var is used but never reassigned
                    self._diag(
                        f"Variable '{name}' declared as mutable but never reassigned",
                        info["line"], code="W002"
                    )

    # ── Statement dispatch ──────────────────────────────────

    def _lint_stmt(self, node):
        method = getattr(self, f'_lint_{node.__class__.__name__}', None)
        if method:
            method(node)

    def _lint_LetStatement(self, node):
        # Check shadowing
        if self.scope.is_declared_locally(node.name):
            self._diag(
                f"Variable '{node.name}' is already declared in this scope",
                node, code="W003"
            )
        elif self.scope.parent and self.scope.parent.is_declared(node.name) and node.name not in BUILTINS:
            self._diag(
                f"Variable '{node.name}' shadows outer variable",
                node, severity="info", code="W004"
            )

        self.scope.declare(node.name, getattr(node, 'line', 0) or 0, node.mutable)
        self._lint_expr(node.value)

    def _lint_DestructureLetStatement(self, node):
        for target in node.targets:
            name = target if isinstance(target, str) else getattr(target, 'name', str(target))
            self.scope.declare(name, getattr(node, 'line', 0) or 0, node.mutable)
        self._lint_expr(node.value)

    def _lint_AssignStatement(self, node):
        if isinstance(node.target, ast.Identifier):
            self.scope.mark_assigned(node.target.name)
        self._lint_expr(node.target)
        self._lint_expr(node.value)

    def _lint_FnStatement(self, node):
        self.scope.declare(node.name, getattr(node, 'line', 0) or 0)
        self._push_scope("function")
        for p in node.params:
            self.scope.declare(p, getattr(node, 'line', 0) or 0)
        self._lint_body(node.body)
        # Check unreachable code
        self._check_unreachable(node.body)
        self._pop_scope()

    def _lint_ReturnStatement(self, node):
        if node.value:
            self._lint_expr(node.value)

    def _lint_IfStatement(self, node):
        self._lint_expr(node.condition)
        # Check constant condition
        if isinstance(node.condition, ast.BoolLiteral):
            self._diag("Condition is always " + str(node.condition.value).lower(), node, code="W005")

        self._push_scope()
        self._lint_body(node.body)
        self._pop_scope()

        for cond, body in node.elif_clauses:
            self._lint_expr(cond)
            self._push_scope()
            self._lint_body(body)
            self._pop_scope()

        if node.else_body:
            self._push_scope()
            self._lint_body(node.else_body)
            self._pop_scope()

    def _lint_ForStatement(self, node):
        self._lint_expr(node.iterable)
        self._push_scope()
        name = node.variable if isinstance(node.variable, str) else getattr(node.variable, 'name', str(node.variable))
        self.scope.declare(name, getattr(node, 'line', 0) or 0)
        self._lint_body(node.body)
        self._pop_scope()

    def _lint_WhileStatement(self, node):
        self._lint_expr(node.condition)
        if isinstance(node.condition, ast.BoolLiteral) and node.condition.value:
            self._diag("Infinite loop: condition is always true", node, code="W005")
        self._push_scope()
        self._lint_body(node.body)
        self._pop_scope()

    def _lint_TryCatch(self, node):
        self._push_scope()
        self._lint_body(node.try_body)
        self._pop_scope()
        if node.catch_body:
            self._push_scope()
            if node.catch_var:
                self.scope.declare(node.catch_var, getattr(node, 'line', 0) or 0)
            self._lint_body(node.catch_body)
            self._pop_scope()
        if node.finally_body:
            self._push_scope()
            self._lint_body(node.finally_body)
            self._pop_scope()

    def _lint_ClassStatement(self, node):
        self.scope.declare(node.name, getattr(node, 'line', 0) or 0)
        for method in node.methods:
            if isinstance(method, ast.FnStatement):
                self._push_scope("function")
                self.scope.declare("this", 0)
                self.scope.mark_used("this")
                for p in method.params:
                    self.scope.declare(p, getattr(method, 'line', 0) or 0)
                self._lint_body(method.body)
                self._check_unreachable(method.body)
                self._pop_scope()

    def _lint_InterfaceStatement(self, node):
        self.scope.declare(node.name, getattr(node, 'line', 0) or 0)

    def _lint_EnumStatement(self, node):
        self.scope.declare(node.name, getattr(node, 'line', 0) or 0)

    def _lint_MatchStatement(self, node):
        self._lint_expr(node.subject)
        for pattern, body in node.arms:
            self._push_scope()
            body_stmts = body if isinstance(body, list) else [body]
            self._lint_body(body_stmts)
            self._pop_scope()
        if node.default:
            self._push_scope()
            default_stmts = node.default if isinstance(node.default, list) else [node.default]
            self._lint_body(default_stmts)
            self._pop_scope()

    def _lint_ShowStatement(self, node):
        for v in node.values:
            self._lint_expr(v)

    def _lint_ThrowStatement(self, node):
        self._lint_expr(node.value)

    def _lint_ImportStatement(self, node):
        if node.names:
            for name in node.names:
                self.scope.declare(name, getattr(node, 'line', 0) or 0)
        elif node.alias:
            self.scope.declare(node.alias, getattr(node, 'line', 0) or 0)
        elif node.module:
            self.scope.declare(node.module, getattr(node, 'line', 0) or 0)

    def _lint_ExpressionStatement(self, node):
        self._lint_expr(node.expression)

    def _lint_DecoratedStatement(self, node):
        for dec in node.decorators:
            self._lint_expr(dec)
        self._lint_stmt(node.target)

    def _lint_MultiAssignStatement(self, node):
        for v in node.values:
            self._lint_expr(v)

    def _lint_Block(self, node):
        self._lint_body(node.statements)

    def _lint_body(self, body):
        if isinstance(body, list):
            for stmt in body:
                self._lint_stmt(stmt)
        elif isinstance(body, ast.Block):
            for stmt in body.statements:
                self._lint_stmt(stmt)
        elif body is not None:
            self._lint_stmt(body)

    # ── Expression dispatch ─────────────────────────────────

    def _lint_expr(self, node):
        if node is None:
            return
        method = getattr(self, f'_lintexpr_{node.__class__.__name__}', None)
        if method:
            method(node)

    def _lintexpr_Identifier(self, node):
        self.scope.mark_used(node.name)

    def _lintexpr_BinaryOp(self, node):
        self._lint_expr(node.left)
        self._lint_expr(node.right)
        # Comparison with null — suggest ??
        if node.operator in ("==", "!=") and (
            isinstance(node.left, ast.NullLiteral) or isinstance(node.right, ast.NullLiteral)
        ):
            self._diag(
                "Consider using null coalescing (??) instead of comparing with null",
                node, severity="info", code="W006"
            )

    def _lintexpr_UnaryOp(self, node):
        self._lint_expr(node.operand)

    def _lintexpr_CallExpression(self, node):
        self._lint_expr(node.callee)
        for arg in node.arguments:
            self._lint_expr(arg)

    def _lintexpr_MemberExpression(self, node):
        self._lint_expr(node.object)

    def _lintexpr_OptionalMemberExpression(self, node):
        self._lint_expr(node.object)

    def _lintexpr_IndexExpression(self, node):
        self._lint_expr(node.object)
        self._lint_expr(node.index)

    def _lintexpr_SliceExpression(self, node):
        self._lint_expr(node.object)
        if node.start:
            self._lint_expr(node.start)
        if node.end:
            self._lint_expr(node.end)

    def _lintexpr_ListLiteral(self, node):
        for el in node.elements:
            self._lint_expr(el)

    def _lintexpr_MapLiteral(self, node):
        for key, val in node.pairs:
            self._lint_expr(val)

    def _lintexpr_FnExpression(self, node):
        self._push_scope("function")
        for p in node.params:
            self.scope.declare(p, getattr(node, 'line', 0) or 0)
        self._lint_body(node.body)
        self._pop_scope()

    def _lintexpr_PipeExpression(self, node):
        self._lint_expr(node.value)
        self._lint_expr(node.function)

    def _lintexpr_RangeExpression(self, node):
        self._lint_expr(node.start)
        self._lint_expr(node.end)

    def _lintexpr_AskExpression(self, node):
        self._lint_expr(node.prompt)

    def _lintexpr_NullCoalesce(self, node):
        self._lint_expr(node.left)
        self._lint_expr(node.right)

    def _lintexpr_SpreadExpression(self, node):
        self._lint_expr(node.value)

    def _lintexpr_IfExpression(self, node):
        self._lint_expr(node.condition)
        self._lint_expr(node.true_expr)
        self._lint_expr(node.false_expr)

    def _lintexpr_ComprehensionExpression(self, node):
        self._lint_expr(node.iterable)
        self._lint_expr(node.expr)
        if node.condition:
            self._lint_expr(node.condition)

    def _lintexpr_MapComprehensionExpression(self, node):
        self._lint_expr(node.iterable)
        self._lint_expr(node.key_expr)
        self._lint_expr(node.value_expr)
        if node.condition:
            self._lint_expr(node.condition)

    def _lintexpr_AwaitExpression(self, node):
        self._lint_expr(node.value)

    def _lintexpr_YieldExpression(self, node):
        if node.value:
            self._lint_expr(node.value)

    # ── Unreachable code detection ──────────────────────────

    def _check_unreachable(self, body):
        """Check for code after return/break/continue."""
        stmts = body if isinstance(body, list) else getattr(body, 'statements', []) if body else []
        found_terminal = False
        for stmt in stmts:
            if found_terminal:
                self._diag("Unreachable code", stmt, code="W007")
                break
            if isinstance(stmt, (ast.ReturnStatement, ast.BreakStatement, ast.ContinueStatement, ast.ThrowStatement)):
                found_terminal = True


def lint(source_or_tree, source_path=None):
    """Lint Clarity source code or an AST.

    Returns a list of LintDiagnostic objects.
    """
    if isinstance(source_or_tree, ast.Program):
        tree = source_or_tree
    else:
        from .lexer import tokenize
        from .parser import parse
        tokens = tokenize(source_or_tree, source_path)
        tree = parse(tokens, source_or_tree)

    linter = Linter()
    return linter.lint(tree)
