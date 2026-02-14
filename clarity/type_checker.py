"""Clarity static type checker — compile-time type analysis."""

from . import ast_nodes as ast


class TypeDiagnostic:
    """A single type-check diagnostic."""
    __slots__ = ('message', 'line', 'column', 'severity')

    def __init__(self, message, line=None, column=None, severity="error"):
        self.message = message
        self.line = line
        self.column = column
        self.severity = severity

    def __repr__(self):
        loc = f":{self.line}" if self.line else ""
        return f"[{self.severity}]{loc} {self.message}"


class TypeScope:
    """Tracks variable types in a scope."""

    def __init__(self, parent=None):
        self.parent = parent
        self.vars = {}       # name -> type_string
        self.functions = {}  # name -> (param_types, return_type)
        self.classes = {}    # name -> {method_name: (param_types, return_type)}
        self.enums = set()   # enum names
        self.interfaces = {} # name -> [(method, params, param_types, return_type)]

    def get_type(self, name):
        if name in self.vars:
            return self.vars[name]
        if self.parent:
            return self.parent.get_type(name)
        return None

    def set_type(self, name, type_str):
        self.vars[name] = type_str

    def get_function(self, name):
        if name in self.functions:
            return self.functions[name]
        if self.parent:
            return self.parent.get_function(name)
        return None

    def get_class(self, name):
        if name in self.classes:
            return self.classes[name]
        if self.parent:
            return self.parent.get_class(name)
        return None

    def has_name(self, name):
        if name in self.vars or name in self.functions or name in self.classes or name in self.enums:
            return True
        if self.parent:
            return self.parent.has_name(name)
        return False


# Known builtin functions and their return types
BUILTIN_TYPES = {
    "len": "int", "type": "string", "str": "string", "int": "int",
    "float": "float", "bool": "bool", "abs": "number", "round": "int",
    "floor": "int", "ceil": "int", "min": "any", "max": "any",
    "sum": "number", "sqrt": "float", "pow": "number",
    "sin": "float", "cos": "float", "tan": "float", "log": "float",
    "upper": "string", "lower": "string", "trim": "string",
    "split": "list", "join": "string", "replace": "string",
    "contains": "bool", "starts": "bool", "ends": "bool",
    "chars": "list", "repeat": "string",
    "keys": "list", "values": "list", "entries": "list",
    "merge": "map", "has": "bool",
    "push": "null", "pop": "any", "sort": "list", "reverse": "list",
    "map": "list", "filter": "list", "reduce": "any", "find": "any",
    "every": "bool", "some": "bool", "each": "null",
    "flat": "list", "zip": "list", "unique": "list",
    "range": "list", "display": "string", "repr": "string",
    "json_parse": "any", "json_string": "string",
    "read": "string", "write": "null", "append": "null",
    "exists": "bool", "lines": "list",
    "encode64": "string", "decode64": "string",
    "hash": "string", "random": "float",
    "time": "float", "sleep": "null",
    "is_digit": "bool", "is_alpha": "bool", "is_alnum": "bool", "is_space": "bool",
    "char_at": "string", "char_code": "int", "from_char_code": "string",
    "index_of": "int", "substring": "string",
    "pad_left": "string", "pad_right": "string",
    "pi": "float", "e": "float",
}

BUILTINS = set(BUILTIN_TYPES.keys()) | {
    "show", "ask", "exec", "exec_full", "exit", "env", "args", "cwd",
    "fetch", "serve", "compose", "tap", "set", "error",
}


def types_compatible(declared, inferred):
    """Check if an inferred type is compatible with a declared type."""
    if declared is None or inferred is None:
        return True
    if declared == "any" or inferred == "any":
        return True
    if declared == inferred:
        return True
    if declared == "number" and inferred in ("int", "float"):
        return True
    if declared == "float" and inferred == "int":
        return True  # int widening to float is safe
    return False


class TypeChecker:
    """Static type checker for Clarity ASTs."""

    def __init__(self):
        self.diagnostics = []
        self.scope = TypeScope()
        # Pre-populate builtins
        for name, ret in BUILTIN_TYPES.items():
            self.scope.set_type(name, "function")
        for name in BUILTINS:
            if name not in self.scope.vars:
                self.scope.set_type(name, "function")

    def check(self, program):
        """Type-check a Program node. Returns list of TypeDiagnostic."""
        self.diagnostics = []
        for stmt in program.body:
            self._check_stmt(stmt)
        return self.diagnostics

    def _diag(self, msg, node, severity="error"):
        line = getattr(node, 'line', None)
        col = getattr(node, 'column', None)
        self.diagnostics.append(TypeDiagnostic(msg, line, col, severity))

    def _push_scope(self):
        self.scope = TypeScope(self.scope)

    def _pop_scope(self):
        self.scope = self.scope.parent

    # ── Statements ──────────────────────────────────────────

    def _check_stmt(self, node):
        method = getattr(self, f'_check_{node.__class__.__name__}', None)
        if method:
            method(node)

    def _check_LetStatement(self, node):
        inferred = self._infer(node.value)
        if node.type_annotation:
            if not types_compatible(node.type_annotation, inferred):
                self._diag(
                    f"Type mismatch: '{node.name}' declared as {node.type_annotation}, "
                    f"but assigned {inferred}",
                    node
                )
            self.scope.set_type(node.name, node.type_annotation)
        else:
            self.scope.set_type(node.name, inferred)

    def _check_DestructureLetStatement(self, node):
        self._infer(node.value)
        for target in node.targets:
            name = target if isinstance(target, str) else getattr(target, 'name', str(target))
            self.scope.set_type(name, "any")

    def _check_AssignStatement(self, node):
        inferred = self._infer(node.value)
        if isinstance(node.target, ast.Identifier):
            declared = self.scope.get_type(node.target.name)
            if declared and declared != "any" and declared != "function":
                if not types_compatible(declared, inferred):
                    self._diag(
                        f"Type mismatch: '{node.target.name}' is {declared}, "
                        f"but reassigned to {inferred}",
                        node
                    )

    def _check_FnStatement(self, node):
        self.scope.functions[node.name] = (node.param_types, node.return_type)
        self.scope.set_type(node.name, "function")
        self._push_scope()
        for p in node.params:
            ptype = node.param_types.get(p, "any")
            self.scope.set_type(p, ptype)
        # Check body
        self._check_body(node.body)
        # Check return type
        if node.return_type:
            returns = self._collect_returns(node.body)
            for ret_node, ret_type in returns:
                if not types_compatible(node.return_type, ret_type):
                    self._diag(
                        f"Function '{node.name}' should return {node.return_type}, "
                        f"but returns {ret_type}",
                        ret_node
                    )
        self._pop_scope()

    def _check_ReturnStatement(self, node):
        if node.value:
            self._infer(node.value)

    def _check_IfStatement(self, node):
        self._infer(node.condition)
        self._push_scope()
        self._check_body(node.body)
        self._pop_scope()
        for cond, body in node.elif_clauses:
            self._infer(cond)
            self._push_scope()
            self._check_body(body)
            self._pop_scope()
        if node.else_body:
            self._push_scope()
            self._check_body(node.else_body)
            self._pop_scope()

    def _check_ForStatement(self, node):
        self._infer(node.iterable)
        self._push_scope()
        name = node.variable if isinstance(node.variable, str) else getattr(node.variable, 'name', str(node.variable))
        self.scope.set_type(name, "any")
        self._check_body(node.body)
        self._pop_scope()

    def _check_WhileStatement(self, node):
        self._infer(node.condition)
        self._push_scope()
        self._check_body(node.body)
        self._pop_scope()

    def _check_TryCatch(self, node):
        self._push_scope()
        self._check_body(node.try_body)
        self._pop_scope()
        if node.catch_body:
            self._push_scope()
            if node.catch_var:
                self.scope.set_type(node.catch_var, "any")
            self._check_body(node.catch_body)
            self._pop_scope()
        if node.finally_body:
            self._push_scope()
            self._check_body(node.finally_body)
            self._pop_scope()

    def _check_ClassStatement(self, node):
        methods = {}
        for method in node.methods:
            if isinstance(method, ast.FnStatement):
                methods[method.name] = (method.param_types, method.return_type)
        self.scope.classes[node.name] = methods
        self.scope.set_type(node.name, "class")
        # Check each method body
        for method in node.methods:
            if isinstance(method, ast.FnStatement):
                self._push_scope()
                self.scope.set_type("this", node.name)
                for p in method.params:
                    ptype = method.param_types.get(p, "any")
                    self.scope.set_type(p, ptype)
                self._check_body(method.body)
                if method.return_type and method.name != "init":
                    returns = self._collect_returns(method.body)
                    for ret_node, ret_type in returns:
                        if not types_compatible(method.return_type, ret_type):
                            self._diag(
                                f"Method '{node.name}.{method.name}' should return "
                                f"{method.return_type}, but returns {ret_type}",
                                ret_node
                            )
                self._pop_scope()

    def _check_InterfaceStatement(self, node):
        self.scope.interfaces[node.name] = node.method_sigs
        self.scope.set_type(node.name, "interface")

    def _check_EnumStatement(self, node):
        self.scope.enums.add(node.name)
        self.scope.set_type(node.name, "enum")

    def _check_MatchStatement(self, node):
        self._infer(node.subject)
        for pattern, body in node.arms:
            self._push_scope()
            self._check_body(body if isinstance(body, list) else [body])
            self._pop_scope()
        if node.default:
            self._push_scope()
            self._check_body(node.default if isinstance(node.default, list) else [node.default])
            self._pop_scope()

    def _check_ShowStatement(self, node):
        for v in node.values:
            self._infer(v)

    def _check_ThrowStatement(self, node):
        self._infer(node.value)

    def _check_ImportStatement(self, node):
        if node.names:
            for name in node.names:
                self.scope.set_type(name, "any")
        elif node.alias:
            self.scope.set_type(node.alias, "any")
        elif node.module:
            self.scope.set_type(node.module, "any")

    def _check_ExpressionStatement(self, node):
        self._infer(node.expression)

    def _check_DecoratedStatement(self, node):
        self._check_stmt(node.target)

    def _check_MultiAssignStatement(self, node):
        for v in node.values:
            self._infer(v)

    def _check_Block(self, node):
        self._check_body(node.statements)

    def _check_body(self, body):
        if isinstance(body, list):
            for stmt in body:
                self._check_stmt(stmt)
        elif isinstance(body, ast.Block):
            for stmt in body.statements:
                self._check_stmt(stmt)
        elif body is not None:
            self._check_stmt(body)

    # ── Return collection ───────────────────────────────────

    def _collect_returns(self, body):
        """Collect (ReturnStatement, inferred_type) from a body."""
        results = []
        stmts = body if isinstance(body, list) else getattr(body, 'statements', [body]) if body else []
        for stmt in stmts:
            if isinstance(stmt, ast.ReturnStatement):
                ret_type = self._infer(stmt.value) if stmt.value else "null"
                results.append((stmt, ret_type))
            elif isinstance(stmt, ast.IfStatement):
                results.extend(self._collect_returns(stmt.body))
                for _, elif_body in stmt.elif_clauses:
                    results.extend(self._collect_returns(elif_body))
                if stmt.else_body:
                    results.extend(self._collect_returns(stmt.else_body))
            elif isinstance(stmt, ast.TryCatch):
                results.extend(self._collect_returns(stmt.try_body))
                if stmt.catch_body:
                    results.extend(self._collect_returns(stmt.catch_body))
            elif isinstance(stmt, ast.Block):
                results.extend(self._collect_returns(stmt.statements))
        return results

    # ── Type inference ──────────────────────────────────────

    def _infer(self, node):
        """Infer the type of an expression node. Returns type string or None."""
        if node is None:
            return "null"
        method = getattr(self, f'_infer_{node.__class__.__name__}', None)
        if method:
            return method(node)
        return "any"

    def _infer_NumberLiteral(self, node):
        return "float" if isinstance(node.value, float) else "int"

    def _infer_StringLiteral(self, node):
        return "string"

    def _infer_BoolLiteral(self, node):
        return "bool"

    def _infer_NullLiteral(self, node):
        return "null"

    def _infer_ListLiteral(self, node):
        for el in node.elements:
            self._infer(el)
        return "list"

    def _infer_MapLiteral(self, node):
        for key, val in node.pairs:
            self._infer(val)
        return "map"

    def _infer_Identifier(self, node):
        t = self.scope.get_type(node.name)
        if t:
            return t
        return "any"

    def _infer_ThisExpression(self, node):
        return self.scope.get_type("this") or "any"

    def _infer_BinaryOp(self, node):
        left = self._infer(node.left)
        right = self._infer(node.right)
        if node.operator in ("+", "-", "*", "/", "%", "**"):
            if left == "string" or right == "string":
                if node.operator == "+":
                    return "string"
            if left in ("int", "float", "number") and right in ("int", "float", "number"):
                if node.operator == "/" or left == "float" or right == "float":
                    return "float"
                return "int"
            return "number"
        if node.operator in ("==", "!=", "<", ">", "<=", ">=", "and", "or"):
            return "bool"
        return "any"

    def _infer_UnaryOp(self, node):
        inner = self._infer(node.operand)
        if node.operator == "not":
            return "bool"
        if node.operator == "-":
            return inner
        return "any"

    def _infer_CallExpression(self, node):
        callee_type = self._infer(node.callee)
        # Check argument count for known functions
        if isinstance(node.callee, ast.Identifier):
            name = node.callee.name
            # Check builtin return types
            if name in BUILTIN_TYPES:
                return BUILTIN_TYPES[name]
            # Check user-defined functions
            fn_sig = self.scope.get_function(name)
            if fn_sig:
                param_types, return_type = fn_sig
                # Validate argument types against parameter types
                if param_types:
                    for i, arg in enumerate(node.arguments):
                        arg_type = self._infer(arg)
                        # Find which param this corresponds to
                        # (we'd need param names, which are in FnStatement)
                return return_type or "any"
            # Check if it's a class constructor
            cls = self.scope.get_class(name)
            if cls is not None:
                return name
        for arg in node.arguments:
            self._infer(arg)
        return "any"

    def _infer_MemberExpression(self, node):
        self._infer(node.object)
        return "any"

    def _infer_OptionalMemberExpression(self, node):
        self._infer(node.object)
        return "any"

    def _infer_IndexExpression(self, node):
        self._infer(node.object)
        self._infer(node.index)
        return "any"

    def _infer_SliceExpression(self, node):
        obj_type = self._infer(node.object)
        if node.start:
            self._infer(node.start)
        if node.end:
            self._infer(node.end)
        if obj_type == "string":
            return "string"
        if obj_type == "list":
            return "list"
        return "any"

    def _infer_FnExpression(self, node):
        return "function"

    def _infer_PipeExpression(self, node):
        self._infer(node.value)
        return self._infer(node.function)

    def _infer_RangeExpression(self, node):
        return "list"

    def _infer_AskExpression(self, node):
        return "string"

    def _infer_NullCoalesce(self, node):
        left = self._infer(node.left)
        right = self._infer(node.right)
        return right if left == "null" else left

    def _infer_SpreadExpression(self, node):
        return self._infer(node.value)

    def _infer_IfExpression(self, node):
        self._infer(node.condition)
        t = self._infer(node.true_expr)
        f = self._infer(node.false_expr)
        if t == f:
            return t
        return "any"

    def _infer_ComprehensionExpression(self, node):
        return "list"

    def _infer_MapComprehensionExpression(self, node):
        return "map"

    def _infer_AwaitExpression(self, node):
        return "any"

    def _infer_YieldExpression(self, node):
        return "any"

    def _infer_ExpressionStatement(self, node):
        return self._infer(node.expression)


def check_types(source_or_tree, source_path=None):
    """Type-check Clarity source code or an AST.

    Returns a list of TypeDiagnostic objects.
    """
    if isinstance(source_or_tree, ast.Program):
        tree = source_or_tree
    else:
        from .lexer import tokenize
        from .parser import parse
        tokens = tokenize(source_or_tree, source_path)
        tree = parse(tokens, source_or_tree)

    checker = TypeChecker()
    return checker.check(tree)
