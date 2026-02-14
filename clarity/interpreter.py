"""Clarity interpreter — walks the AST and executes it."""

import re
import os
import concurrent.futures
from . import ast_nodes as ast
from .errors import RuntimeError, TypeError, NameError


# ── Signal classes for control flow ──────────────────────

class ReturnSignal(Exception):
    def __init__(self, value):
        self.value = value

class BreakSignal(Exception):
    pass

class ContinueSignal(Exception):
    pass

class ThrowSignal(Exception):
    def __init__(self, value):
        self.value = value

class YieldSignal(Exception):
    def __init__(self, value):
        self.value = value


# ── Environment (scope) ─────────────────────────────────

class Environment:
    def __init__(self, parent=None):
        self.vars = {}
        self.mutables = set()
        self.parent = parent

    def get(self, name, line=None):
        if name in self.vars:
            return self.vars[name]
        if self.parent:
            return self.parent.get(name, line)
        raise NameError(f"'{name}' is not defined", line=line)

    def set(self, name, value, mutable=False):
        self.vars[name] = value
        if mutable:
            self.mutables.add(name)

    def assign(self, name, value, line=None):
        if name in self.vars:
            if name not in self.mutables and name not in _BUILTIN_NAMES:
                env = self
                while env:
                    if name in env.mutables:
                        break
                    env = env.parent
                else:
                    raise RuntimeError(
                        f"Cannot reassign '{name}' — use 'mut' to make it mutable",
                        line=line
                    )
            self.vars[name] = value
            return
        if self.parent:
            self.parent.assign(name, value, line)
            return
        raise NameError(f"'{name}' is not defined — use 'let' to create it", line=line)

    def has(self, name):
        if name in self.vars:
            return True
        if self.parent:
            return self.parent.has(name)
        return False


_BUILTIN_NAMES = set()


# ── Clarity Types ────────────────────────────────────────

class ClarityFunction:
    def __init__(self, name, params, body, closure, is_async=False):
        self.name = name or "<anonymous>"
        self.params = params
        self.body = body
        self.closure = closure
        self.is_async = is_async

    def __repr__(self):
        return f"<fn {self.name}({', '.join(self.params)})>"


class ClarityClass:
    def __init__(self, name, methods, parent=None):
        self.name = name
        self.methods = methods  # dict of name -> ClarityFunction
        self.parent = parent    # optional ClarityClass

    def __repr__(self):
        return f"<class {self.name}>"


class ClarityInstance:
    def __init__(self, klass):
        self.klass = klass
        self.properties = {}

    def get(self, name):
        if name in self.properties:
            return self.properties[name]
        method = self._find_method(name)
        if method:
            return self._bind_method(method)
        return None

    def _find_method(self, name):
        klass = self.klass
        while klass:
            if name in klass.methods:
                return klass.methods[name]
            klass = klass.parent
        return None

    def _bind_method(self, method):
        instance = self
        def bound(*args):
            fn_env = Environment(method.closure)
            fn_env.set("this", instance, mutable=True)
            # Handle rest params
            regular_params = [p for p in method.params if not p.startswith("...")]
            rest_param = next((p for p in method.params if p.startswith("...")), None)
            for i, param in enumerate(regular_params):
                fn_env.set(param, args[i] if i < len(args) else None, mutable=True)
            if rest_param:
                fn_env.set(rest_param[3:], list(args[len(regular_params):]), mutable=True)
            try:
                from .interpreter import Interpreter
                interp = method.closure._interpreter if hasattr(method.closure, '_interpreter') else None
                block_env = Environment(fn_env)
                result = None
                for stmt in method.body.statements:
                    result = bound._interpreter.execute(stmt, block_env)
                return None
            except ReturnSignal as ret:
                return ret.value
        bound._interpreter = None  # will be set
        return bound

    def __repr__(self):
        return f"<{self.klass.name} instance>"


class ClarityInterface:
    """Represents an interface contract."""
    def __init__(self, name, method_sigs):
        self.name = name
        self.method_sigs = method_sigs  # list of (name, params, param_types, return_type)

    def __repr__(self):
        return f"<interface {self.name}>"


class ClarityEnum:
    """Represents an enum type with named members."""
    def __init__(self, name, members):
        self.name = name
        self.members = members  # dict of name -> value

    def __repr__(self):
        return f"<enum {self.name}>"


class ClarityFuture:
    """Wraps a concurrent.futures.Future for async/await."""
    def __init__(self, future):
        self.future = future

    def __repr__(self):
        return "<future>"


class ClarityGenerator:
    """A generator that yields values lazily using Python's generator protocol."""
    def __init__(self, name):
        self.name = name or "<generator>"

    def __repr__(self):
        return f"<generator {self.name}>"


# ── Interpreter ──────────────────────────────────────────

class Interpreter:
    def __init__(self, builtins=None, source_dir=None):
        self.global_env = Environment()
        self._setup_builtins(builtins or {})
        self.output = []
        self.source_dir = source_dir or os.getcwd()
        self._imported = {}  # cache for file imports
        self._call_stack = []  # for stack traces
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=8)

    def _setup_builtins(self, extra_builtins):
        from .runtime import get_builtins
        builtins = get_builtins(self)
        builtins.update(extra_builtins)
        for name, value in builtins.items():
            self.global_env.set(name, value, mutable=True)
            _BUILTIN_NAMES.add(name)

    def run(self, program):
        return self.exec_block_body(program.body, self.global_env)

    def exec_block_body(self, statements, env):
        result = None
        for stmt in statements:
            result = self.execute(stmt, env)
        return result

    def execute(self, node, env):
        method = f"exec_{node.__class__.__name__}"
        executor = getattr(self, method, None)
        if executor is None:
            raise RuntimeError(f"Unknown node type: {node.__class__.__name__}", line=node.line)
        return executor(node, env)

    def evaluate(self, node, env):
        method = f"eval_{node.__class__.__name__}"
        evaluator = getattr(self, method, None)
        if evaluator is None:
            raise RuntimeError(f"Unknown expression type: {node.__class__.__name__}", line=node.line)
        return evaluator(node, env)

    # ── Statement executors ──────────────────────────────

    def exec_LetStatement(self, node, env):
        value = self.evaluate(node.value, env)
        # Runtime type check if annotation present
        if node.type_annotation:
            self._check_type(value, node.type_annotation, node.line)
        env.set(node.name, value, mutable=node.mutable)
        return value

    def exec_DestructureLetStatement(self, node, env):
        value = self.evaluate(node.value, env)
        if node.kind == "list":
            if not isinstance(value, list):
                raise TypeError("Cannot destructure non-list into list pattern", line=node.line)
            for i, target in enumerate(node.targets):
                if target.startswith("..."):
                    rest_name = target[3:]
                    env.set(rest_name, value[i:], mutable=node.mutable)
                    break
                elif i < len(value):
                    env.set(target, value[i], mutable=node.mutable)
                else:
                    env.set(target, None, mutable=node.mutable)
        elif node.kind == "map":
            if not isinstance(value, dict):
                raise TypeError("Cannot destructure non-map into map pattern", line=node.line)
            for target in node.targets:
                env.set(target, value.get(target), mutable=node.mutable)
        return value

    def exec_MultiAssignStatement(self, node, env):
        # Evaluate all values first (enables swaps like a, b = b, a)
        values = [self.evaluate(v, env) for v in node.values]
        if len(values) != len(node.targets):
            raise RuntimeError(
                f"Multi-assignment: {len(node.targets)} targets but {len(values)} values",
                line=node.line
            )
        for target, value in zip(node.targets, values):
            if isinstance(target, ast.Identifier):
                env.assign(target.name, value, line=node.line)
            elif isinstance(target, ast.MemberExpression):
                obj = self.evaluate(target.object, env)
                if isinstance(obj, ClarityInstance):
                    obj.properties[target.property] = value
                elif isinstance(obj, dict):
                    obj[target.property] = value
            elif isinstance(target, ast.IndexExpression):
                obj = self.evaluate(target.object, env)
                index = self.evaluate(target.index, env)
                obj[index] = value
            else:
                raise RuntimeError("Invalid multi-assignment target", line=node.line)
        return None

    def exec_AssignStatement(self, node, env):
        value = self.evaluate(node.value, env)

        if isinstance(node.target, ast.Identifier):
            if node.operator == "=":
                env.assign(node.target.name, value, line=node.line)
            else:
                current = env.get(node.target.name, line=node.line)
                value = self._compound_assign(current, node.operator, value, node.line)
                env.assign(node.target.name, value, line=node.line)

        elif isinstance(node.target, ast.MemberExpression):
            obj = self.evaluate(node.target.object, env)
            if isinstance(obj, ClarityInstance):
                if node.operator == "=":
                    obj.properties[node.target.property] = value
                else:
                    current = obj.properties.get(node.target.property)
                    obj.properties[node.target.property] = self._compound_assign(current, node.operator, value, node.line)
            elif isinstance(obj, dict):
                if node.operator == "=":
                    obj[node.target.property] = value
                else:
                    current = obj.get(node.target.property)
                    obj[node.target.property] = self._compound_assign(current, node.operator, value, node.line)
            else:
                raise TypeError(f"Cannot set property on {type_name(obj)}", line=node.line)

        elif isinstance(node.target, ast.IndexExpression):
            obj = self.evaluate(node.target.object, env)
            index = self.evaluate(node.target.index, env)
            if node.operator == "=":
                obj[index] = value
            else:
                current = obj[index]
                obj[index] = self._compound_assign(current, node.operator, value, node.line)
        else:
            raise RuntimeError("Invalid assignment target", line=node.line)

        return value

    def _compound_assign(self, current, operator, value, line):
        ops = {"+=": "+", "-=": "-", "*=": "*", "/=": "/"}
        return self._binary_op(current, ops[operator], value, line)

    def exec_FnStatement(self, node, env):
        fn = ClarityFunction(node.name, node.params, node.body, env, is_async=node.is_async)
        env.set(node.name, fn, mutable=True)
        return fn

    def exec_ReturnStatement(self, node, env):
        value = self.evaluate(node.value, env) if node.value else None
        raise ReturnSignal(value)

    def exec_IfStatement(self, node, env):
        if self._is_truthy(self.evaluate(node.condition, env)):
            return self.exec_Block(node.body, env)

        for elif_cond, elif_body in node.elif_clauses:
            if self._is_truthy(self.evaluate(elif_cond, env)):
                return self.exec_Block(elif_body, env)

        if node.else_body:
            return self.exec_Block(node.else_body, env)
        return None

    def exec_ForStatement(self, node, env):
        iterable = self.evaluate(node.iterable, env)
        if not hasattr(iterable, '__iter__'):
            raise TypeError(f"Cannot iterate over {type_name(iterable)}", line=node.line)

        result = None
        for item in iterable:
            loop_env = Environment(env)
            loop_env.set(node.variable, item, mutable=True)
            try:
                result = self.exec_Block(node.body, loop_env)
            except BreakSignal:
                break
            except ContinueSignal:
                continue
        return result

    def exec_WhileStatement(self, node, env):
        result = None
        while self._is_truthy(self.evaluate(node.condition, env)):
            try:
                result = self.exec_Block(node.body, env)
            except BreakSignal:
                break
            except ContinueSignal:
                continue
        return result

    def exec_TryCatch(self, node, env):
        try:
            return self.exec_Block(node.try_body, env)
        except ThrowSignal as e:
            catch_env = Environment(env)
            if node.catch_var:
                catch_env.set(node.catch_var, e.value, mutable=True)
            return self.exec_Block(node.catch_body, catch_env)
        except (RuntimeError, TypeError, NameError, Exception) as e:
            if isinstance(e, (ReturnSignal, BreakSignal, ContinueSignal)):
                raise
            catch_env = Environment(env)
            if node.catch_var:
                msg = e.message if hasattr(e, 'message') else str(e)
                catch_env.set(node.catch_var, msg, mutable=True)
            return self.exec_Block(node.catch_body, catch_env)
        finally:
            if node.finally_body:
                self.exec_Block(node.finally_body, env)

    def exec_ThrowStatement(self, node, env):
        value = self.evaluate(node.value, env)
        raise ThrowSignal(value)

    def exec_BreakStatement(self, node, env):
        raise BreakSignal()

    def exec_ContinueStatement(self, node, env):
        raise ContinueSignal()

    def exec_ShowStatement(self, node, env):
        values = [self.evaluate(v, env) for v in node.values]
        output = " ".join(self._to_display(v) for v in values)
        print(output)
        self.output.append(output)
        return None

    def exec_InterfaceStatement(self, node, env):
        iface = ClarityInterface(node.name, node.method_sigs)
        env.set(node.name, iface, mutable=True)
        return iface

    def exec_ClassStatement(self, node, env):
        parent = None
        if node.parent:
            parent = env.get(node.parent, line=node.line)
            if not isinstance(parent, ClarityClass):
                raise TypeError(f"'{node.parent}' is not a class", line=node.line)

        methods = {}
        for fn_node in node.methods:
            fn = ClarityFunction(fn_node.name, fn_node.params, fn_node.body, env)
            methods[fn_node.name] = fn

        # Check interface compliance
        for iface_name in node.interfaces:
            iface = env.get(iface_name, line=node.line)
            if not isinstance(iface, ClarityInterface):
                raise TypeError(f"'{iface_name}' is not an interface", line=node.line)
            for sig_name, sig_params, sig_ptypes, sig_ret in iface.method_sigs:
                if sig_name not in methods:
                    # Check parent methods too
                    found = False
                    p = parent
                    while p:
                        if sig_name in p.methods:
                            found = True
                            break
                        p = p.parent
                    if not found:
                        raise TypeError(
                            f"Class '{node.name}' must implement '{sig_name}()' from interface '{iface_name}'",
                            line=node.line
                        )

        klass = ClarityClass(node.name, methods, parent)
        env.set(node.name, klass, mutable=True)
        return klass

    def exec_MatchStatement(self, node, env):
        subject = self.evaluate(node.subject, env)

        for pattern_expr, body in node.arms:
            pattern_val = self.evaluate(pattern_expr, env)
            if subject == pattern_val:
                return self.exec_Block(body, env)

        if node.default:
            return self.exec_Block(node.default, env)
        return None

    def exec_DecoratedStatement(self, node, env):
        # First, execute the target (fn or class), which defines it in env
        self.execute(node.target, env)
        name = node.target.name

        # Apply decorators: innermost first
        current = env.get(name, line=node.line)
        for decorator_expr in reversed(node.decorators):
            decorator_fn = self.evaluate(decorator_expr, env)
            current = self._call(decorator_fn, [current], node.line)
        env.assign(name, current, line=node.line)
        return current

    def exec_EnumStatement(self, node, env):
        members = {}
        for i, (member_name, value_node) in enumerate(node.members):
            if value_node is not None:
                value = self.evaluate(value_node, env)
            else:
                value = i  # auto-increment from 0
            members[member_name] = value

        enum = ClarityEnum(node.name, members)
        env.set(node.name, enum, mutable=True)
        return enum

    def exec_ImportStatement(self, node, env):
        # File-based import
        if node.path:
            return self._import_file(node, env)

        # Module import
        from .runtime import get_module
        module = get_module(node.module)
        if module is None:
            raise RuntimeError(f"Module '{node.module}' not found", line=node.line)

        if node.names:
            for name in node.names:
                if name not in module:
                    raise RuntimeError(f"'{name}' not found in module '{node.module}'", line=node.line)
                env.set(name, module[name], mutable=True)
        elif node.alias:
            env.set(node.alias, module, mutable=True)
        else:
            env.set(node.module, module, mutable=True)
        return None

    def _import_file(self, node, env):
        from .lexer import tokenize
        from .parser import parse

        path = node.path
        if not path.endswith(".clarity"):
            path += ".clarity"

        # Resolve relative to source directory
        if not os.path.isabs(path):
            path = os.path.join(self.source_dir, path)

        path = os.path.normpath(path)

        if path in self._imported:
            module_env = self._imported[path]
        else:
            if not os.path.exists(path):
                raise RuntimeError(f"Cannot find module: {path}", line=node.line)

            with open(path, "r") as f:
                source = f.read()

            tokens = tokenize(source, path)
            tree = parse(tokens, source)

            module_env = Environment(self.global_env)
            old_dir = self.source_dir
            self.source_dir = os.path.dirname(path)
            self.exec_block_body(tree.body, module_env)
            self.source_dir = old_dir
            self._imported[path] = module_env

        module_dict = module_env.vars

        if node.names:
            for name in node.names:
                if name not in module_dict:
                    raise RuntimeError(f"'{name}' not found in '{node.path}'", line=node.line)
                env.set(name, module_dict[name], mutable=True)
        else:
            alias = node.alias
            if not alias:
                # Derive name from path
                alias = os.path.splitext(os.path.basename(node.path))[0]
            env.set(alias, module_dict, mutable=True)

        return None

    def exec_ExpressionStatement(self, node, env):
        return self.evaluate(node.expression, env)

    def exec_Block(self, node, env):
        block_env = Environment(env)
        result = None
        for stmt in node.statements:
            result = self.execute(stmt, block_env)
        return result

    # ── Expression evaluators ────────────────────────────

    def eval_NumberLiteral(self, node, env):
        return node.value

    def eval_StringLiteral(self, node, env):
        if node.raw:
            return node.value
        return self._interpolate_string(node.value, env, node.line)

    def eval_BoolLiteral(self, node, env):
        return node.value

    def eval_NullLiteral(self, node, env):
        return None

    def eval_Identifier(self, node, env):
        return env.get(node.name, line=node.line)

    def eval_ThisExpression(self, node, env):
        return env.get("this", line=node.line)

    def eval_ListLiteral(self, node, env):
        result = []
        for el in node.elements:
            if isinstance(el, ast.SpreadExpression):
                spread_val = self.evaluate(el.value, env)
                if isinstance(spread_val, list):
                    result.extend(spread_val)
                else:
                    raise TypeError("Can only spread a list into a list", line=el.line)
            else:
                result.append(self.evaluate(el, env))
        return result

    def eval_MapLiteral(self, node, env):
        result = {}
        for key_node, val_node in node.pairs:
            if key_node is None and isinstance(val_node, ast.SpreadExpression):
                spread_val = self.evaluate(val_node.value, env)
                if isinstance(spread_val, dict):
                    result.update(spread_val)
                else:
                    raise TypeError("Can only spread a map into a map", line=val_node.line)
            else:
                key = self.evaluate(key_node, env)
                value = self.evaluate(val_node, env)
                result[key] = value
        return result

    def eval_BinaryOp(self, node, env):
        if node.operator == "and":
            left = self.evaluate(node.left, env)
            return left if not self._is_truthy(left) else self.evaluate(node.right, env)
        if node.operator == "or":
            left = self.evaluate(node.left, env)
            return left if self._is_truthy(left) else self.evaluate(node.right, env)

        left = self.evaluate(node.left, env)
        right = self.evaluate(node.right, env)
        return self._binary_op(left, node.operator, right, node.line)

    def _binary_op(self, left, op, right, line):
        try:
            if op == "+":
                if isinstance(left, str) or isinstance(right, str):
                    return self._to_display(left) + self._to_display(right)
                if isinstance(left, list) and isinstance(right, list):
                    return left + right
                return left + right
            elif op == "-":
                return left - right
            elif op == "*":
                if isinstance(left, str) and isinstance(right, int):
                    return left * right
                return left * right
            elif op == "/":
                if right == 0:
                    raise RuntimeError("Division by zero", line=line)
                if isinstance(left, int) and isinstance(right, int):
                    return left // right if left % right == 0 else left / right
                return left / right
            elif op == "%":
                return left % right
            elif op == "**":
                return left ** right
            elif op == "==":
                return left == right
            elif op == "!=":
                return left != right
            elif op == "<":
                return left < right
            elif op == ">":
                return left > right
            elif op == "<=":
                return left <= right
            elif op == ">=":
                return left >= right
            elif op == "is":
                return left is right
            # Bitwise operators
            elif op == "&":
                return int(left) & int(right)
            elif op == "|":
                return int(left) | int(right)
            elif op == "^":
                return int(left) ^ int(right)
            elif op == "<<":
                return int(left) << int(right)
            elif op == ">>":
                return int(left) >> int(right)
            else:
                raise RuntimeError(f"Unknown operator: {op}", line=line)
        except (TypeError_builtin) as e:
            raise TypeError(
                f"Cannot use '{op}' with {type_name(left)} and {type_name(right)}",
                line=line
            )

    def eval_UnaryOp(self, node, env):
        operand = self.evaluate(node.operand, env)
        if node.operator == "-":
            if not isinstance(operand, (int, float)):
                raise TypeError(f"Cannot negate {type_name(operand)}", line=node.line)
            return -operand
        if node.operator == "not":
            return not self._is_truthy(operand)
        if node.operator == "~":
            return ~int(operand)
        raise RuntimeError(f"Unknown unary operator: {node.operator}", line=node.line)

    def eval_CallExpression(self, node, env):
        callee = self.evaluate(node.callee, env)
        # Expand spread args
        args = []
        for arg_node in node.arguments:
            if isinstance(arg_node, ast.SpreadExpression):
                spread_val = self.evaluate(arg_node.value, env)
                if isinstance(spread_val, list):
                    args.extend(spread_val)
                else:
                    args.append(spread_val)
            else:
                args.append(self.evaluate(arg_node, env))
        return self._call(callee, args, node.line)

    def _call(self, callee, args, line):
        if isinstance(callee, ClarityClass):
            return self._instantiate(callee, args, line)

        if isinstance(callee, ClarityEnum):
            # Calling an enum member: Color(0) → look up by value
            if len(args) == 1:
                for name, val in callee.members.items():
                    if val == args[0]:
                        return name
                return None
            raise RuntimeError(f"Enum lookup takes 1 argument", line=line)

        if isinstance(callee, ClarityFunction):
            fn_env = Environment(callee.closure)
            regular_params = [p for p in callee.params if not p.startswith("...")]
            rest_param = next((p for p in callee.params if p.startswith("...")), None)

            if rest_param is None and len(args) != len(regular_params):
                raise RuntimeError(
                    f"{callee.name} expects {len(regular_params)} arguments, got {len(args)}",
                    line=line
                )

            for i, param in enumerate(regular_params):
                fn_env.set(param, args[i] if i < len(args) else None, mutable=True)

            if rest_param:
                fn_env.set(rest_param[3:], list(args[len(regular_params):]), mutable=True)

            # Stack trace support
            self._call_stack.append({"name": callee.name, "line": line})
            try:
                # Check for generator function (contains yield)
                if self._has_yield(callee.body):
                    return self._run_generator(callee, fn_env)

                # Check for async function
                if callee.is_async:
                    return self._run_async(callee, fn_env)

                self.exec_Block(callee.body, fn_env)
                return None
            except ReturnSignal as ret:
                return ret.value
            finally:
                self._call_stack.pop()

        if callable(callee):
            try:
                return callee(*args)
            except Exception as e:
                if isinstance(e, (ReturnSignal, BreakSignal, ContinueSignal, ThrowSignal, YieldSignal)):
                    raise
                raise RuntimeError(str(e), line=line)

        raise TypeError(f"'{type_name(callee)}' is not callable", line=line)

    def _has_yield(self, block):
        """Check if a block contains any yield expressions."""
        for stmt in block.statements:
            if self._node_has_yield(stmt):
                return True
        return False

    def _node_has_yield(self, node):
        """Recursively check if a node contains yield."""
        if isinstance(node, ast.YieldExpression):
            return True
        if isinstance(node, ast.ExpressionStatement):
            return self._node_has_yield(node.expression)
        if isinstance(node, ast.Block):
            return any(self._node_has_yield(s) for s in node.statements)
        if isinstance(node, ast.IfStatement):
            if self._node_has_yield(node.body):
                return True
            for _, body in node.elif_clauses:
                if self._node_has_yield(body):
                    return True
            if node.else_body and self._node_has_yield(node.else_body):
                return True
        if isinstance(node, ast.ForStatement):
            return self._node_has_yield(node.body)
        if isinstance(node, ast.WhileStatement):
            return self._node_has_yield(node.body)
        if isinstance(node, ast.ReturnStatement) and node.value:
            return self._node_has_yield(node.value)
        return False

    def _run_generator(self, fn, fn_env):
        """Run a generator function, collecting all yielded values into a list."""
        results = []
        interp = self

        class _Collector:
            """Walks the body, executing statements and collecting yields."""
            pass

        # Use a modified execution that catches yields
        old_exec_block = self.exec_Block

        def gen_exec_block(node, env):
            block_env = Environment(env)
            for stmt in node.statements:
                self.execute(stmt, block_env)

        try:
            # Temporarily override yield handling via a nested approach
            # We use Python generators internally
            collected = []

            def _collect_gen():
                try:
                    self.exec_Block(fn.body, fn_env)
                except ReturnSignal:
                    pass

            # Override eval_YieldExpression to collect
            original_eval = getattr(self, '_gen_collection', None)
            self._gen_collection = collected
            try:
                _collect_gen()
            finally:
                self._gen_collection = original_eval

            return collected
        except Exception:
            raise

    def _run_async(self, fn, fn_env):
        """Submit an async function to the thread pool, return a ClarityFuture."""
        def _task():
            try:
                self.exec_Block(fn.body, fn_env)
                return None
            except ReturnSignal as ret:
                return ret.value
        future = self._executor.submit(_task)
        return ClarityFuture(future)

    def _instantiate(self, klass, args, line):
        instance = ClarityInstance(klass)
        init = instance._find_method("init")
        if init:
            fn_env = Environment(init.closure)
            fn_env.set("this", instance, mutable=True)
            regular_params = [p for p in init.params if not p.startswith("...")]
            rest_param = next((p for p in init.params if p.startswith("...")), None)

            for i, param in enumerate(regular_params):
                fn_env.set(param, args[i] if i < len(args) else None, mutable=True)
            if rest_param:
                fn_env.set(rest_param[3:], list(args[len(regular_params):]), mutable=True)

            try:
                self.exec_Block(init.body, fn_env)
            except ReturnSignal:
                pass
        return instance

    def eval_MemberExpression(self, node, env):
        obj = self.evaluate(node.object, env)
        prop = node.property
        return self._access_member(obj, prop, node.line)

    def eval_OptionalMemberExpression(self, node, env):
        obj = self.evaluate(node.object, env)
        if obj is None:
            return None
        prop = node.property
        try:
            return self._access_member(obj, prop, node.line)
        except (RuntimeError, TypeError):
            return None

    def _access_member(self, obj, prop, line):
        if isinstance(obj, ClarityEnum):
            if prop in obj.members:
                return obj.members[prop]
            if prop == "values":
                return lambda: list(obj.members.values())
            if prop == "names":
                return lambda: list(obj.members.keys())
            if prop == "entries":
                return lambda: [[k, v] for k, v in obj.members.items()]
            if prop == "has":
                return lambda name: name in obj.members
            raise RuntimeError(f"Enum {obj.name} has no member '{prop}'", line=line)

        if isinstance(obj, ClarityInstance):
            # Check properties dict directly to handle null values correctly
            if prop in obj.properties:
                val = obj.properties[prop]
                if val is not None and callable(val) and hasattr(val, '_interpreter'):
                    val._interpreter = self
                return val
            # Check methods
            method = obj._find_method(prop)
            if method:
                bound = obj._bind_method(method)
                bound._interpreter = self
                return bound
            raise RuntimeError(f"{obj.klass.name} has no property '{prop}'", line=line)

        if isinstance(obj, dict):
            if prop in obj:
                return obj[prop]
            return None  # maps return null for missing keys

        if isinstance(obj, list):
            list_methods = {
                "length": lambda: len(obj),
                "push": lambda v: obj.append(v),
                "pop": lambda: obj.pop(),
                "first": lambda: obj[0] if obj else None,
                "last": lambda: obj[-1] if obj else None,
                "reverse": lambda: list(reversed(obj)),
                "sort": lambda: sorted(obj),
                "join": lambda sep="": sep.join(str(x) for x in obj),
                "contains": lambda v: v in obj,
                "empty": lambda: len(obj) == 0,
                "count": lambda: len(obj),
                "slice": lambda start=0, end=None: obj[start:end],
                "index": lambda v: obj.index(v) if v in obj else -1,
                "clear": lambda: (obj.clear(), obj)[1],
                "copy": lambda: list(obj),
            }
            if prop in list_methods:
                return list_methods[prop]
            raise RuntimeError(f"List has no property '{prop}'", line=line)

        if isinstance(obj, str):
            str_methods = {
                "length": lambda: len(obj),
                "upper": lambda: obj.upper(),
                "lower": lambda: obj.lower(),
                "trim": lambda: obj.strip(),
                "split": lambda sep=" ": obj.split(sep),
                "replace": lambda old, new: obj.replace(old, new),
                "contains": lambda s: s in obj,
                "starts": lambda s: obj.startswith(s),
                "ends": lambda s: obj.endswith(s),
                "chars": lambda: list(obj),
                "count": lambda: len(obj),
                "reverse": lambda: obj[::-1],
                "empty": lambda: len(obj) == 0,
                "slice": lambda start=0, end=None: obj[start:end],
                "find": lambda s: obj.find(s),
                "repeat": lambda n: obj * n,
                "pad_left": lambda n, ch=" ": obj.rjust(n, ch),
                "pad_right": lambda n, ch=" ": obj.ljust(n, ch),
            }
            if prop in str_methods:
                return str_methods[prop]
            raise RuntimeError(f"String has no property '{prop}'", line=line)

        if isinstance(obj, (int, float)):
            num_methods = {
                "abs": lambda: abs(obj),
                "str": lambda: str(obj),
                "float": lambda: float(obj),
                "int": lambda: int(obj),
            }
            if prop in num_methods:
                return num_methods[prop]
            raise RuntimeError(f"Number has no property '{prop}'", line=line)

        if isinstance(obj, set):
            set_methods = {
                "add": lambda v: (obj.add(v), obj)[1],
                "remove": lambda v: (obj.discard(v), obj)[1],
                "has": lambda v: v in obj,
                "length": lambda: len(obj),
                "size": lambda: len(obj),
                "list": lambda: list(obj),
                "union": lambda other: obj | other,
                "intersect": lambda other: obj & other,
                "diff": lambda other: obj - other,
            }
            if prop in set_methods:
                return set_methods[prop]
            raise RuntimeError(f"Set has no property '{prop}'", line=line)

        raise TypeError(f"Cannot access property on {type_name(obj)}", line=line)

    def eval_IndexExpression(self, node, env):
        obj = self.evaluate(node.object, env)
        index = self.evaluate(node.index, env)

        if isinstance(obj, list):
            if not isinstance(index, int):
                raise TypeError(f"List index must be a number, got {type_name(index)}", line=node.line)
            if index < -len(obj) or index >= len(obj):
                raise RuntimeError(f"Index {index} out of bounds (list has {len(obj)} items)", line=node.line)
            return obj[index]

        if isinstance(obj, dict):
            if index not in obj:
                return None
            return obj[index]

        if isinstance(obj, str):
            if not isinstance(index, int):
                raise TypeError(f"String index must be a number", line=node.line)
            if index < -len(obj) or index >= len(obj):
                raise RuntimeError(f"Index {index} out of bounds", line=node.line)
            return obj[index]

        raise TypeError(f"Cannot index into {type_name(obj)}", line=node.line)

    def eval_SliceExpression(self, node, env):
        obj = self.evaluate(node.object, env)
        start = self.evaluate(node.start, env) if node.start else None
        end = self.evaluate(node.end, env) if node.end else None

        if isinstance(obj, (list, str)):
            return obj[start:end]

        raise TypeError(f"Cannot slice {type_name(obj)}", line=node.line)

    def eval_FnExpression(self, node, env):
        return ClarityFunction(None, node.params, node.body, env)

    def eval_PipeExpression(self, node, env):
        value = self.evaluate(node.value, env)

        if isinstance(node.function, ast.CallExpression):
            callee = self.evaluate(node.function.callee, env)
            args = [value] + [self.evaluate(a, env) for a in node.function.arguments]
            return self._call(callee, args, node.line)

        fn = self.evaluate(node.function, env)
        return self._call(fn, [value], node.line)

    def eval_RangeExpression(self, node, env):
        start = self.evaluate(node.start, env)
        if node.end is None:
            # Open-ended range — shouldn't be evaluated directly
            raise RuntimeError("Open-ended range can only be used in slicing", line=node.line)
        end = self.evaluate(node.end, env)
        if not isinstance(start, int) or not isinstance(end, int):
            raise TypeError("Range bounds must be integers", line=node.line)
        return list(range(start, end))

    def eval_AskExpression(self, node, env):
        prompt = self.evaluate(node.prompt, env)
        return input(self._to_display(prompt))

    def eval_NullCoalesce(self, node, env):
        left = self.evaluate(node.left, env)
        if left is not None:
            return left
        return self.evaluate(node.right, env)

    def eval_SpreadExpression(self, node, env):
        return self.evaluate(node.value, env)

    def eval_IfExpression(self, node, env):
        if self._is_truthy(self.evaluate(node.condition, env)):
            return self.evaluate(node.true_expr, env)
        return self.evaluate(node.false_expr, env)

    def eval_ComprehensionExpression(self, node, env):
        iterable = self.evaluate(node.iterable, env)
        result = []
        for item in iterable:
            comp_env = Environment(env)
            comp_env.set(node.variable, item, mutable=True)
            if node.condition:
                if not self._is_truthy(self.evaluate(node.condition, comp_env)):
                    continue
            result.append(self.evaluate(node.expr, comp_env))
        return result

    def eval_MapComprehensionExpression(self, node, env):
        iterable = self.evaluate(node.iterable, env)
        result = {}
        for item in iterable:
            comp_env = Environment(env)
            if len(node.variables) == 1:
                comp_env.set(node.variables[0], item, mutable=True)
            else:
                # Destructure: for k, v in entries
                if isinstance(item, (list, tuple)):
                    for i, var in enumerate(node.variables):
                        comp_env.set(var, item[i] if i < len(item) else None, mutable=True)
                else:
                    comp_env.set(node.variables[0], item, mutable=True)
            if node.condition:
                if not self._is_truthy(self.evaluate(node.condition, comp_env)):
                    continue
            key = self.evaluate(node.key_expr, comp_env)
            value = self.evaluate(node.value_expr, comp_env)
            result[key] = value
        return result

    def eval_AwaitExpression(self, node, env):
        value = self.evaluate(node.value, env)
        if isinstance(value, ClarityFuture):
            return value.future.result(timeout=30)
        # If not a future, just return the value directly
        return value

    def eval_YieldExpression(self, node, env):
        value = self.evaluate(node.value, env) if node.value else None
        # If we're collecting for a generator, append to collection
        if hasattr(self, '_gen_collection') and self._gen_collection is not None:
            self._gen_collection.append(value)
            return value
        raise YieldSignal(value)

    # ── Helpers ──────────────────────────────────────────

    def _is_truthy(self, value):
        if value is None:
            return False
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            return len(value) > 0
        if isinstance(value, list):
            return len(value) > 0
        if isinstance(value, dict):
            return len(value) > 0
        if isinstance(value, set):
            return len(value) > 0
        return True

    def _to_display(self, value):
        if value is None:
            return "null"
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, float):
            if value == int(value):
                return str(int(value))
            return str(value)
        if isinstance(value, int):
            return str(value)
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            items = ", ".join(self._to_repr(v) for v in value)
            return f"[{items}]"
        if isinstance(value, dict):
            pairs = ", ".join(
                f"{k}: {self._to_repr(v)}" for k, v in value.items()
            )
            return "{" + pairs + "}"
        if isinstance(value, set):
            items = ", ".join(self._to_repr(v) for v in value)
            return "set(" + items + ")"
        if isinstance(value, ClarityFunction):
            return repr(value)
        if isinstance(value, ClarityClass):
            return repr(value)
        if isinstance(value, ClarityInstance):
            # Check for to_string method
            to_str = value._find_method("to_string")
            if to_str:
                bound = value._bind_method(to_str)
                bound._interpreter = self
                try:
                    return self._to_display(bound())
                except Exception:
                    pass
            return repr(value)
        if isinstance(value, ClarityEnum):
            return repr(value)
        if isinstance(value, ClarityInterface):
            return repr(value)
        if isinstance(value, ClarityFuture):
            return repr(value)
        if callable(value):
            name = getattr(value, '__name__', 'builtin')
            return f"<builtin {name}>"
        return str(value)

    def _to_repr(self, value):
        if isinstance(value, str):
            return f'"{value}"'
        return self._to_display(value)

    def _check_type(self, value, type_ann, line):
        """Runtime type check for annotated variables/params."""
        type_map = {
            "int": (int,), "float": (float,), "number": (int, float),
            "string": (str,), "bool": (bool,), "list": (list,),
            "map": (dict,), "set": (set,), "null": (type(None),),
            "any": None,  # any type passes
        }
        if type_ann == "any":
            return
        if type_ann == "function":
            if not (isinstance(value, ClarityFunction) or callable(value)):
                raise TypeError(f"Expected function, got {type_name(value)}", line=line)
            return
        if type_ann in type_map:
            expected = type_map[type_ann]
            if not isinstance(value, expected):
                raise TypeError(f"Expected {type_ann}, got {type_name(value)}", line=line)
            return
        # Check for class instance type
        if isinstance(value, ClarityInstance) and value.klass.name == type_ann:
            return
        if isinstance(value, ClarityInstance):
            # Check inheritance
            klass = value.klass.parent
            while klass:
                if klass.name == type_ann:
                    return
                klass = klass.parent
            raise TypeError(f"Expected {type_ann}, got {value.klass.name}", line=line)
        # If type_ann isn't a known type and value isn't null, warn
        if value is not None:
            actual = type_name(value)
            if actual != type_ann:
                raise TypeError(f"Expected {type_ann}, got {actual}", line=line)

    def _format_stack_trace(self):
        """Format the current call stack for error reporting."""
        if not self._call_stack:
            return ""
        lines = ["\n  Stack trace:"]
        for i, frame in enumerate(reversed(self._call_stack)):
            prefix = "  → " if i == 0 else "    "
            lines.append(f"{prefix}{frame['name']}() at line {frame['line']}")
        return "\n".join(lines)

    def _interpolate_string(self, text, env, line):
        def replace_match(match):
            expr_str = match.group(1)
            from .lexer import tokenize
            from .parser import parse
            try:
                tokens = tokenize(expr_str)
                tree = parse(tokens, expr_str)
                if tree.body:
                    result = self.evaluate(tree.body[0].expression, env)
                    return self._to_display(result)
            except Exception:
                return "{" + expr_str + "}"
            return ""

        return re.sub(r'\{([^}]+)\}', replace_match, text)


# ── Helpers ──────────────────────────────────────────────

TypeError_builtin = __builtins__["TypeError"] if isinstance(__builtins__, dict) else __builtins__.TypeError


def type_name(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "map"
    if isinstance(value, set):
        return "set"
    if isinstance(value, ClarityFunction):
        return "function"
    if isinstance(value, ClarityClass):
        return "class"
    if isinstance(value, ClarityInstance):
        return value.klass.name
    if isinstance(value, ClarityEnum):
        return "enum"
    if isinstance(value, ClarityInterface):
        return "interface"
    if isinstance(value, ClarityFuture):
        return "future"
    if callable(value):
        return "builtin"
    return "unknown"
