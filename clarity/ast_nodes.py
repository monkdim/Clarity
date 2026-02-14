"""Clarity AST node definitions."""


class Node:
    """Base AST node."""
    _fields = ()

    def __init__(self, line=None, column=None):
        self.line = line
        self.column = column

    def __repr__(self):
        fields = ", ".join(f"{f}={getattr(self, f, None)!r}" for f in self._fields)
        return f"{self.__class__.__name__}({fields})"


# ── Program ──────────────────────────────────────────────

class Program(Node):
    _fields = ("body",)

    def __init__(self, body):
        super().__init__()
        self.body = body


# ── Statements ───────────────────────────────────────────

class LetStatement(Node):
    _fields = ("name", "value", "mutable", "type_annotation")

    def __init__(self, name, value, mutable=False, type_annotation=None, line=None, column=None):
        super().__init__(line, column)
        self.name = name
        self.value = value
        self.mutable = mutable
        self.type_annotation = type_annotation  # optional type string


class DestructureLetStatement(Node):
    """let [a, b] = list  OR  let {x, y} = map"""
    _fields = ("targets", "value", "mutable", "kind")

    def __init__(self, targets, value, mutable=False, kind="list", line=None, column=None):
        super().__init__(line, column)
        self.targets = targets
        self.value = value
        self.mutable = mutable
        self.kind = kind  # "list" or "map"


class AssignStatement(Node):
    _fields = ("target", "operator", "value")

    def __init__(self, target, operator, value, line=None, column=None):
        super().__init__(line, column)
        self.target = target
        self.operator = operator
        self.value = value


class FnStatement(Node):
    _fields = ("name", "params", "body", "is_async", "param_types", "return_type")

    def __init__(self, name, params, body, is_async=False, param_types=None, return_type=None, line=None, column=None):
        super().__init__(line, column)
        self.name = name
        self.params = params
        self.body = body
        self.is_async = is_async
        self.param_types = param_types or {}  # {param_name: type_string}
        self.return_type = return_type         # optional type string


class ReturnStatement(Node):
    _fields = ("value",)

    def __init__(self, value=None, line=None, column=None):
        super().__init__(line, column)
        self.value = value


class IfStatement(Node):
    _fields = ("condition", "body", "elif_clauses", "else_body")

    def __init__(self, condition, body, elif_clauses=None, else_body=None, line=None, column=None):
        super().__init__(line, column)
        self.condition = condition
        self.body = body
        self.elif_clauses = elif_clauses or []
        self.else_body = else_body


class ForStatement(Node):
    _fields = ("variable", "iterable", "body")

    def __init__(self, variable, iterable, body, line=None, column=None):
        super().__init__(line, column)
        self.variable = variable
        self.iterable = iterable
        self.body = body


class WhileStatement(Node):
    _fields = ("condition", "body")

    def __init__(self, condition, body, line=None, column=None):
        super().__init__(line, column)
        self.condition = condition
        self.body = body


class TryCatch(Node):
    _fields = ("try_body", "catch_var", "catch_body", "finally_body")

    def __init__(self, try_body, catch_var, catch_body, finally_body=None, line=None, column=None):
        super().__init__(line, column)
        self.try_body = try_body
        self.catch_var = catch_var
        self.catch_body = catch_body
        self.finally_body = finally_body


class BreakStatement(Node):
    _fields = ()

    def __init__(self, line=None, column=None):
        super().__init__(line, column)


class ContinueStatement(Node):
    _fields = ()

    def __init__(self, line=None, column=None):
        super().__init__(line, column)


class ThrowStatement(Node):
    _fields = ("value",)

    def __init__(self, value, line=None, column=None):
        super().__init__(line, column)
        self.value = value


class ShowStatement(Node):
    _fields = ("values",)

    def __init__(self, values, line=None, column=None):
        super().__init__(line, column)
        self.values = values


class ImportStatement(Node):
    _fields = ("module", "alias", "names", "path")

    def __init__(self, module=None, alias=None, names=None, path=None, line=None, column=None):
        super().__init__(line, column)
        self.module = module
        self.alias = alias
        self.names = names
        self.path = path


class ClassStatement(Node):
    _fields = ("name", "methods", "parent", "interfaces")

    def __init__(self, name, methods, parent=None, interfaces=None, line=None, column=None):
        super().__init__(line, column)
        self.name = name
        self.methods = methods
        self.parent = parent
        self.interfaces = interfaces or []  # list of interface names


class InterfaceStatement(Node):
    """interface Drawable { fn draw(), fn area() -> number }"""
    _fields = ("name", "method_sigs")

    def __init__(self, name, method_sigs, line=None, column=None):
        super().__init__(line, column)
        self.name = name
        self.method_sigs = method_sigs  # list of (name, params, return_type)


class MatchStatement(Node):
    _fields = ("subject", "arms", "default")

    def __init__(self, subject, arms, default=None, line=None, column=None):
        super().__init__(line, column)
        self.subject = subject
        self.arms = arms
        self.default = default


class MultiAssignStatement(Node):
    """a, b = b, a"""
    _fields = ("targets", "values")

    def __init__(self, targets, values, line=None, column=None):
        super().__init__(line, column)
        self.targets = targets   # list of assignment target expressions
        self.values = values     # list of value expressions


class EnumStatement(Node):
    """enum Color { Red, Green, Blue }"""
    _fields = ("name", "members")

    def __init__(self, name, members, line=None, column=None):
        super().__init__(line, column)
        self.name = name
        self.members = members  # list of (name, value_or_None) tuples


class DecoratedStatement(Node):
    """@decorator fn ... — wraps a fn or class with decorators."""
    _fields = ("target", "decorators")

    def __init__(self, target, decorators, line=None, column=None):
        super().__init__(line, column)
        self.target = target        # FnStatement or ClassStatement
        self.decorators = decorators  # list of expressions


class ExpressionStatement(Node):
    _fields = ("expression",)

    def __init__(self, expression, line=None, column=None):
        super().__init__(line, column)
        self.expression = expression


class Block(Node):
    _fields = ("statements",)

    def __init__(self, statements, line=None, column=None):
        super().__init__(line, column)
        self.statements = statements


# ── Expressions ──────────────────────────────────────────

class NumberLiteral(Node):
    _fields = ("value",)

    def __init__(self, value, line=None, column=None):
        super().__init__(line, column)
        self.value = value


class StringLiteral(Node):
    _fields = ("value",)

    def __init__(self, value, line=None, column=None, raw=False):
        super().__init__(line, column)
        self.value = value
        self.raw = raw


class BoolLiteral(Node):
    _fields = ("value",)

    def __init__(self, value, line=None, column=None):
        super().__init__(line, column)
        self.value = value


class NullLiteral(Node):
    _fields = ()

    def __init__(self, line=None, column=None):
        super().__init__(line, column)


class Identifier(Node):
    _fields = ("name",)

    def __init__(self, name, line=None, column=None):
        super().__init__(line, column)
        self.name = name


class ThisExpression(Node):
    _fields = ()

    def __init__(self, line=None, column=None):
        super().__init__(line, column)


class ListLiteral(Node):
    _fields = ("elements",)

    def __init__(self, elements, line=None, column=None):
        super().__init__(line, column)
        self.elements = elements


class MapLiteral(Node):
    _fields = ("pairs",)

    def __init__(self, pairs, line=None, column=None):
        super().__init__(line, column)
        self.pairs = pairs


class BinaryOp(Node):
    _fields = ("left", "operator", "right")

    def __init__(self, left, operator, right, line=None, column=None):
        super().__init__(line, column)
        self.left = left
        self.operator = operator
        self.right = right


class UnaryOp(Node):
    _fields = ("operator", "operand")

    def __init__(self, operator, operand, line=None, column=None):
        super().__init__(line, column)
        self.operator = operator
        self.operand = operand


class CallExpression(Node):
    _fields = ("callee", "arguments")

    def __init__(self, callee, arguments, line=None, column=None):
        super().__init__(line, column)
        self.callee = callee
        self.arguments = arguments


class MemberExpression(Node):
    _fields = ("object", "property")

    def __init__(self, object, property, line=None, column=None):
        super().__init__(line, column)
        self.object = object
        self.property = property


class OptionalMemberExpression(Node):
    """obj?.property"""
    _fields = ("object", "property")

    def __init__(self, object, property, line=None, column=None):
        super().__init__(line, column)
        self.object = object
        self.property = property


class IndexExpression(Node):
    _fields = ("object", "index")

    def __init__(self, object, index, line=None, column=None):
        super().__init__(line, column)
        self.object = object
        self.index = index


class SliceExpression(Node):
    """obj[start..end]"""
    _fields = ("object", "start", "end")

    def __init__(self, object, start=None, end=None, line=None, column=None):
        super().__init__(line, column)
        self.object = object
        self.start = start
        self.end = end


class FnExpression(Node):
    _fields = ("params", "body", "param_types", "return_type")

    def __init__(self, params, body, param_types=None, return_type=None, line=None, column=None):
        super().__init__(line, column)
        self.params = params
        self.body = body
        self.param_types = param_types or {}
        self.return_type = return_type


class PipeExpression(Node):
    _fields = ("value", "function")

    def __init__(self, value, function, line=None, column=None):
        super().__init__(line, column)
        self.value = value
        self.function = function


class RangeExpression(Node):
    _fields = ("start", "end")

    def __init__(self, start, end, line=None, column=None):
        super().__init__(line, column)
        self.start = start
        self.end = end


class AskExpression(Node):
    _fields = ("prompt",)

    def __init__(self, prompt, line=None, column=None):
        super().__init__(line, column)
        self.prompt = prompt


class NullCoalesce(Node):
    _fields = ("left", "right")

    def __init__(self, left, right, line=None, column=None):
        super().__init__(line, column)
        self.left = left
        self.right = right


class SpreadExpression(Node):
    _fields = ("value",)

    def __init__(self, value, line=None, column=None):
        super().__init__(line, column)
        self.value = value


class IfExpression(Node):
    """Inline if used as expression"""
    _fields = ("condition", "true_expr", "false_expr")

    def __init__(self, condition, true_expr, false_expr, line=None, column=None):
        super().__init__(line, column)
        self.condition = condition
        self.true_expr = true_expr
        self.false_expr = false_expr


class ComprehensionExpression(Node):
    """[expr for x in iterable if cond]"""
    _fields = ("expr", "variable", "iterable", "condition")

    def __init__(self, expr, variable, iterable, condition=None, line=None, column=None):
        super().__init__(line, column)
        self.expr = expr
        self.variable = variable
        self.iterable = iterable
        self.condition = condition


class MapComprehensionExpression(Node):
    """{key_expr: val_expr for x in iterable if cond}"""
    _fields = ("key_expr", "value_expr", "variables", "iterable", "condition")

    def __init__(self, key_expr, value_expr, variables, iterable, condition=None, line=None, column=None):
        super().__init__(line, column)
        self.key_expr = key_expr
        self.value_expr = value_expr
        self.variables = variables  # list of var names (supports k, v destructuring)
        self.iterable = iterable
        self.condition = condition


class AwaitExpression(Node):
    """await expr"""
    _fields = ("value",)

    def __init__(self, value, line=None, column=None):
        super().__init__(line, column)
        self.value = value


class YieldExpression(Node):
    """yield expr"""
    _fields = ("value",)

    def __init__(self, value=None, line=None, column=None):
        super().__init__(line, column)
        self.value = value
