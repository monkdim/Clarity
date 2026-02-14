"""Clarity bytecode compiler and virtual machine.

Compiles AST to stack-based bytecode, then executes on a simple VM.
Usage:
  from clarity.bytecode import compile_to_bytecode, VM
  code = compile_to_bytecode(ast_tree)
  vm = VM()
  vm.run(code)
"""

from enum import IntEnum, auto
from . import ast_nodes as ast


# ── Opcodes ──────────────────────────────────────────────

class Op(IntEnum):
    CONST = 0        # Push constant from pool
    POP = 1          # Discard top of stack
    ADD = 2
    SUB = 3
    MUL = 4
    DIV = 5
    MOD = 6
    POW = 7
    NEG = 8
    NOT = 9
    EQ = 10
    NEQ = 11
    LT = 12
    GT = 13
    LTE = 14
    GTE = 15
    LOAD = 16        # Load variable by name (from constant pool)
    STORE = 17       # Store into existing variable
    STORE_NEW = 18   # Declare new variable (0=immutable, 1=mutable)
    JUMP = 19        # Unconditional jump
    JUMP_FALSE = 20  # Jump if top is falsy (pops)
    CALL = 21        # Call function with N args
    RETURN = 22      # Return from function
    MAKE_LIST = 23   # Create list from N items on stack
    MAKE_MAP = 24    # Create map from N key-value pairs on stack
    GET_IDX = 25     # Index access
    SET_IDX = 26     # Index assignment
    GET_PROP = 27    # Property access
    SET_PROP = 28    # Property assignment
    PRINT = 29       # Show statement — print N values
    MAKE_FN = 30     # Create function from code object
    DUP = 31         # Duplicate top
    ITER_INIT = 32   # Create iterator from iterable
    ITER_NEXT = 33   # Get next from iterator (pushes value + bool)
    AND = 34
    OR = 35
    BIT_AND = 36
    BIT_OR = 37
    BIT_XOR = 38
    BIT_NOT = 39
    LSHIFT = 40
    RSHIFT = 41
    RANGE = 42       # Create range from two ints
    NULL = 43        # Push null
    TRUE = 44        # Push true
    FALSE = 45       # Push false
    CONCAT = 46      # String concatenation
    PIPE = 47        # Pipe: call function with value as first arg
    HALT = 255


# ── Bytecode container ──────────────────────────────────

class CodeObject:
    """Holds bytecode instructions and constant pool."""
    def __init__(self, name="<main>"):
        self.name = name
        self.instructions = []   # list of (Op, operand)
        self.constants = []      # constant pool
        self.lines = []          # line numbers for each instruction

    def emit(self, op, operand=0, line=0):
        self.instructions.append((op, operand))
        self.lines.append(line)
        return len(self.instructions) - 1

    def add_const(self, value):
        if value in self.constants:
            return self.constants.index(value)
        self.constants.append(value)
        return len(self.constants) - 1

    def patch_jump(self, idx):
        """Patch a jump instruction to point to current position."""
        op, _ = self.instructions[idx]
        self.instructions[idx] = (op, len(self.instructions))

    def disassemble(self):
        """Pretty-print the bytecode."""
        lines = [f"=== {self.name} ==="]
        lines.append(f"Constants: {self.constants}")
        for i, (op, operand) in enumerate(self.instructions):
            name = Op(op).name if isinstance(op, int) else op.name
            extra = ""
            if op in (Op.CONST, Op.LOAD, Op.STORE, Op.STORE_NEW, Op.GET_PROP, Op.SET_PROP):
                if operand < len(self.constants):
                    extra = f"  ; {self.constants[operand]!r}"
            lines.append(f"  {i:4d}  {name:<14s} {operand:<6d}{extra}")
        return "\n".join(lines)


# ── Compiler ─────────────────────────────────────────────

class Compiler:
    """Compiles an AST to bytecode."""

    def __init__(self):
        self.code = CodeObject()

    def compile(self, program):
        for stmt in program.body:
            self.compile_node(stmt)
        self.code.emit(Op.HALT)
        return self.code

    def compile_node(self, node):
        method = f"compile_{node.__class__.__name__}"
        compiler = getattr(self, method, None)
        if compiler is None:
            raise Exception(f"Cannot compile: {node.__class__.__name__}")
        return compiler(node)

    def compile_ExpressionStatement(self, node):
        self.compile_node(node.expression)
        self.code.emit(Op.POP, line=node.line or 0)

    def compile_LetStatement(self, node):
        self.compile_node(node.value)
        name_idx = self.code.add_const(node.name)
        mutable = 1 if node.mutable else 0
        self.code.emit(Op.STORE_NEW, name_idx, line=node.line or 0)

    def compile_AssignStatement(self, node):
        self.compile_node(node.value)
        if isinstance(node.target, ast.Identifier):
            if node.operator != "=":
                # Compound assignment: load current, apply op, store
                name_idx = self.code.add_const(node.target.name)
                self.code.emit(Op.LOAD, name_idx, line=node.line or 0)
                # Swap so value is on top, current below
                # Actually we need: current OP value
                # Stack has: value, then we load current: value current
                # We need current value, so:
                ops = {"+=": Op.ADD, "-=": Op.SUB, "*=": Op.MUL, "/=": Op.DIV}
                self.code.emit(ops[node.operator], line=node.line or 0)
            name_idx = self.code.add_const(node.target.name)
            self.code.emit(Op.STORE, name_idx, line=node.line or 0)
        elif isinstance(node.target, ast.IndexExpression):
            self.compile_node(node.target.object)
            self.compile_node(node.target.index)
            self.code.emit(Op.SET_IDX, line=node.line or 0)
        elif isinstance(node.target, ast.MemberExpression):
            self.compile_node(node.target.object)
            prop_idx = self.code.add_const(node.target.property)
            self.code.emit(Op.SET_PROP, prop_idx, line=node.line or 0)

    def compile_FnStatement(self, node):
        fn_compiler = Compiler()
        fn_compiler.code = CodeObject(name=node.name)
        for stmt in node.body.statements:
            fn_compiler.compile_node(stmt)
        fn_compiler.code.emit(Op.CONST, fn_compiler.code.add_const(None))
        fn_compiler.code.emit(Op.RETURN)
        fn_code_idx = self.code.add_const(fn_compiler.code)
        params_idx = self.code.add_const(node.params)
        self.code.emit(Op.MAKE_FN, fn_code_idx, line=node.line or 0)
        name_idx = self.code.add_const(node.name)
        self.code.emit(Op.STORE_NEW, name_idx, line=node.line or 0)

    def compile_ReturnStatement(self, node):
        if node.value:
            self.compile_node(node.value)
        else:
            self.code.emit(Op.NULL)
        self.code.emit(Op.RETURN, line=node.line or 0)

    def compile_ShowStatement(self, node):
        for val in node.values:
            self.compile_node(val)
        self.code.emit(Op.PRINT, len(node.values), line=node.line or 0)

    def compile_IfStatement(self, node):
        self.compile_node(node.condition)
        jump_false = self.code.emit(Op.JUMP_FALSE, 0, line=node.line or 0)
        self.compile_block(node.body)
        jump_end = self.code.emit(Op.JUMP, 0)
        self.code.patch_jump(jump_false)
        if node.else_body:
            self.compile_block(node.else_body)
        self.code.patch_jump(jump_end)

    def compile_WhileStatement(self, node):
        loop_start = len(self.code.instructions)
        self.compile_node(node.condition)
        jump_false = self.code.emit(Op.JUMP_FALSE, 0, line=node.line or 0)
        self.compile_block(node.body)
        self.code.emit(Op.JUMP, loop_start)
        self.code.patch_jump(jump_false)

    def compile_ForStatement(self, node):
        self.compile_node(node.iterable)
        self.code.emit(Op.ITER_INIT, line=node.line or 0)
        loop_start = len(self.code.instructions)
        self.code.emit(Op.DUP)  # dup iterator
        self.code.emit(Op.ITER_NEXT)  # push (value, has_next)
        jump_end = self.code.emit(Op.JUMP_FALSE, 0)
        name_idx = self.code.add_const(node.variable)
        self.code.emit(Op.STORE_NEW, name_idx)
        self.compile_block(node.body)
        self.code.emit(Op.JUMP, loop_start)
        self.code.patch_jump(jump_end)
        self.code.emit(Op.POP)  # pop iterator

    def compile_block(self, block):
        for stmt in block.statements:
            self.compile_node(stmt)

    def compile_Block(self, node):
        self.compile_block(node)

    # ── Expressions ──────────────────────────────────────

    def compile_NumberLiteral(self, node):
        idx = self.code.add_const(node.value)
        self.code.emit(Op.CONST, idx, line=node.line or 0)

    def compile_StringLiteral(self, node):
        idx = self.code.add_const(node.value)
        self.code.emit(Op.CONST, idx, line=node.line or 0)

    def compile_BoolLiteral(self, node):
        self.code.emit(Op.TRUE if node.value else Op.FALSE, line=node.line or 0)

    def compile_NullLiteral(self, node):
        self.code.emit(Op.NULL, line=node.line or 0)

    def compile_Identifier(self, node):
        idx = self.code.add_const(node.name)
        self.code.emit(Op.LOAD, idx, line=node.line or 0)

    def compile_BinaryOp(self, node):
        op_map = {
            "+": Op.ADD, "-": Op.SUB, "*": Op.MUL, "/": Op.DIV,
            "%": Op.MOD, "**": Op.POW,
            "==": Op.EQ, "!=": Op.NEQ,
            "<": Op.LT, ">": Op.GT, "<=": Op.LTE, ">=": Op.GTE,
            "and": Op.AND, "or": Op.OR,
            "&": Op.BIT_AND, "|": Op.BIT_OR, "^": Op.BIT_XOR,
            "<<": Op.LSHIFT, ">>": Op.RSHIFT,
        }
        self.compile_node(node.left)
        self.compile_node(node.right)
        if node.operator in op_map:
            self.code.emit(op_map[node.operator], line=node.line or 0)
        else:
            raise Exception(f"Unknown binary operator: {node.operator}")

    def compile_UnaryOp(self, node):
        self.compile_node(node.operand)
        if node.operator == "-":
            self.code.emit(Op.NEG, line=node.line or 0)
        elif node.operator == "not":
            self.code.emit(Op.NOT, line=node.line or 0)
        elif node.operator == "~":
            self.code.emit(Op.BIT_NOT, line=node.line or 0)

    def compile_CallExpression(self, node):
        self.compile_node(node.callee)
        for arg in node.arguments:
            self.compile_node(arg)
        self.code.emit(Op.CALL, len(node.arguments), line=node.line or 0)

    def compile_ListLiteral(self, node):
        for el in node.elements:
            self.compile_node(el)
        self.code.emit(Op.MAKE_LIST, len(node.elements), line=node.line or 0)

    def compile_MapLiteral(self, node):
        for key, value in node.pairs:
            self.compile_node(key)
            self.compile_node(value)
        self.code.emit(Op.MAKE_MAP, len(node.pairs), line=node.line or 0)

    def compile_IndexExpression(self, node):
        self.compile_node(node.object)
        self.compile_node(node.index)
        self.code.emit(Op.GET_IDX, line=node.line or 0)

    def compile_MemberExpression(self, node):
        self.compile_node(node.object)
        prop_idx = self.code.add_const(node.property)
        self.code.emit(Op.GET_PROP, prop_idx, line=node.line or 0)

    def compile_RangeExpression(self, node):
        self.compile_node(node.start)
        if node.end:
            self.compile_node(node.end)
        else:
            self.code.emit(Op.NULL)
        self.code.emit(Op.RANGE, line=node.line or 0)

    def compile_PipeExpression(self, node):
        self.compile_node(node.value)
        if isinstance(node.function, ast.CallExpression):
            self.compile_node(node.function.callee)
            for arg in node.function.arguments:
                self.compile_node(arg)
            self.code.emit(Op.PIPE, len(node.function.arguments) + 1, line=node.line or 0)
        else:
            self.compile_node(node.function)
            self.code.emit(Op.CALL, 1, line=node.line or 0)

    def compile_FnExpression(self, node):
        fn_compiler = Compiler()
        fn_compiler.code = CodeObject(name="<lambda>")
        for stmt in node.body.statements:
            fn_compiler.compile_node(stmt)
        fn_compiler.code.emit(Op.CONST, fn_compiler.code.add_const(None))
        fn_compiler.code.emit(Op.RETURN)
        fn_code_idx = self.code.add_const(fn_compiler.code)
        self.code.emit(Op.MAKE_FN, fn_code_idx, line=node.line or 0)

    def compile_IfExpression(self, node):
        self.compile_node(node.condition)
        jump_false = self.code.emit(Op.JUMP_FALSE, 0)
        self.compile_node(node.true_expr)
        jump_end = self.code.emit(Op.JUMP, 0)
        self.code.patch_jump(jump_false)
        self.compile_node(node.false_expr)
        self.code.patch_jump(jump_end)


# ── Virtual Machine ──────────────────────────────────────

class VMFrame:
    """A call frame in the VM."""
    def __init__(self, code, base_pointer=0):
        self.code = code
        self.ip = 0
        self.locals = {}
        self.base_pointer = base_pointer


class VMFunction:
    """A compiled function."""
    def __init__(self, code, params, name="<fn>"):
        self.code = code
        self.params = params
        self.name = name

    def __repr__(self):
        return f"<compiled fn {self.name}>"


class VM:
    """Stack-based virtual machine for Clarity bytecode."""

    def __init__(self):
        self.stack = []
        self.frames = []
        self.globals = {}
        self.output = []
        self._setup_builtins()

    def _setup_builtins(self):
        """Register built-in functions."""
        import math
        self.globals["len"] = lambda x: len(x)
        self.globals["push"] = lambda lst, item: (lst.append(item), lst)[1]
        self.globals["pop"] = lambda lst: lst.pop()
        self.globals["str"] = lambda x: self._display(x)
        self.globals["int"] = lambda x: int(float(x)) if isinstance(x, str) else int(x)
        self.globals["float"] = lambda x: float(x)
        self.globals["type"] = lambda x: self._type_name(x)
        self.globals["range"] = lambda *a: list(range(*a))
        self.globals["map"] = lambda lst, fn: [self._call_fn(fn, [x]) for x in lst]
        self.globals["filter"] = lambda lst, fn: [x for x in lst if self._is_truthy(self._call_fn(fn, [x]))]
        self.globals["sort"] = lambda lst: sorted(lst)
        self.globals["reverse"] = lambda lst: list(reversed(lst))
        self.globals["keys"] = lambda m: list(m.keys())
        self.globals["values"] = lambda m: list(m.values())
        self.globals["sum"] = lambda lst: sum(lst)
        self.globals["abs"] = abs
        self.globals["min"] = min
        self.globals["max"] = max
        self.globals["join"] = lambda lst, sep="": sep.join(self._display(x) for x in lst)
        self.globals["split"] = lambda s, sep=" ": s.split(sep)
        self.globals["pi"] = math.pi
        self.globals["sqrt"] = math.sqrt

    def _call_fn(self, fn, args):
        """Call a function (compiled or Python builtin)."""
        if callable(fn) and not isinstance(fn, VMFunction):
            return fn(*args)
        if isinstance(fn, VMFunction):
            return self._call_vm_fn(fn, args)
        raise Exception(f"Not callable: {fn}")

    def _call_vm_fn(self, fn, args):
        """Execute a VMFunction."""
        frame = VMFrame(fn.code, len(self.stack))
        # Bind params
        params = fn.params if isinstance(fn.params, list) else []
        for i, param in enumerate(params):
            frame.locals[param] = args[i] if i < len(args) else None
        self.frames.append(frame)
        try:
            result = self._execute_frame()
            return result
        finally:
            self.frames.pop()

    def run(self, code):
        """Run a compiled CodeObject."""
        frame = VMFrame(code)
        # Copy globals
        frame.locals = dict(self.globals)
        self.frames.append(frame)
        try:
            return self._execute_frame()
        finally:
            self.frames.pop()

    def _execute_frame(self):
        frame = self.frames[-1]
        code = frame.code

        while frame.ip < len(code.instructions):
            op, operand = code.instructions[frame.ip]
            frame.ip += 1

            if op == Op.HALT:
                return self.stack[-1] if self.stack else None

            elif op == Op.CONST:
                self.stack.append(code.constants[operand])

            elif op == Op.NULL:
                self.stack.append(None)
            elif op == Op.TRUE:
                self.stack.append(True)
            elif op == Op.FALSE:
                self.stack.append(False)

            elif op == Op.POP:
                if self.stack:
                    self.stack.pop()

            elif op == Op.DUP:
                self.stack.append(self.stack[-1])

            elif op == Op.LOAD:
                name = code.constants[operand]
                # Check local scope first, then parent frames
                if name in frame.locals:
                    self.stack.append(frame.locals[name])
                elif name in self.globals:
                    self.stack.append(self.globals[name])
                else:
                    raise Exception(f"Undefined variable: {name}")

            elif op == Op.STORE:
                name = code.constants[operand]
                value = self.stack[-1]  # peek, don't pop
                frame.locals[name] = value

            elif op == Op.STORE_NEW:
                name = code.constants[operand]
                value = self.stack.pop()
                frame.locals[name] = value

            # Arithmetic
            elif op == Op.ADD:
                b, a = self.stack.pop(), self.stack.pop()
                if isinstance(a, str) or isinstance(b, str):
                    self.stack.append(self._display(a) + self._display(b))
                elif isinstance(a, list) and isinstance(b, list):
                    self.stack.append(a + b)
                else:
                    self.stack.append(a + b)
            elif op == Op.SUB:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a - b)
            elif op == Op.MUL:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a * b)
            elif op == Op.DIV:
                b, a = self.stack.pop(), self.stack.pop()
                if b == 0:
                    raise Exception("Division by zero")
                if isinstance(a, int) and isinstance(b, int):
                    self.stack.append(a // b if a % b == 0 else a / b)
                else:
                    self.stack.append(a / b)
            elif op == Op.MOD:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a % b)
            elif op == Op.POW:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a ** b)
            elif op == Op.NEG:
                self.stack.append(-self.stack.pop())
            elif op == Op.NOT:
                self.stack.append(not self._is_truthy(self.stack.pop()))

            # Comparison
            elif op == Op.EQ:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a == b)
            elif op == Op.NEQ:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a != b)
            elif op == Op.LT:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a < b)
            elif op == Op.GT:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a > b)
            elif op == Op.LTE:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a <= b)
            elif op == Op.GTE:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a >= b)

            # Logical
            elif op == Op.AND:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(b if self._is_truthy(a) else a)
            elif op == Op.OR:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a if self._is_truthy(a) else b)

            # Bitwise
            elif op == Op.BIT_AND:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(int(a) & int(b))
            elif op == Op.BIT_OR:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(int(a) | int(b))
            elif op == Op.BIT_XOR:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(int(a) ^ int(b))
            elif op == Op.BIT_NOT:
                self.stack.append(~int(self.stack.pop()))
            elif op == Op.LSHIFT:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(int(a) << int(b))
            elif op == Op.RSHIFT:
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(int(a) >> int(b))

            # Control flow
            elif op == Op.JUMP:
                frame.ip = operand
            elif op == Op.JUMP_FALSE:
                if not self._is_truthy(self.stack.pop()):
                    frame.ip = operand

            # Functions
            elif op == Op.MAKE_FN:
                fn_code = code.constants[operand]
                # Get params from the code's constants
                params = fn_code.constants[-1] if fn_code.constants and isinstance(fn_code.constants[-1], list) else []
                fn = VMFunction(fn_code, params, fn_code.name)
                self.stack.append(fn)

            elif op == Op.CALL:
                nargs = operand
                args = [self.stack.pop() for _ in range(nargs)]
                args.reverse()
                callee = self.stack.pop()
                result = self._call_fn(callee, args)
                self.stack.append(result)

            elif op == Op.RETURN:
                return self.stack.pop() if self.stack else None

            # Collections
            elif op == Op.MAKE_LIST:
                items = [self.stack.pop() for _ in range(operand)]
                items.reverse()
                self.stack.append(items)

            elif op == Op.MAKE_MAP:
                pairs = []
                for _ in range(operand):
                    v = self.stack.pop()
                    k = self.stack.pop()
                    pairs.append((k, v))
                pairs.reverse()
                self.stack.append(dict(pairs))

            elif op == Op.GET_IDX:
                idx = self.stack.pop()
                obj = self.stack.pop()
                if isinstance(obj, list):
                    self.stack.append(obj[idx])
                elif isinstance(obj, dict):
                    self.stack.append(obj.get(idx))
                elif isinstance(obj, str):
                    self.stack.append(obj[idx])
                else:
                    raise Exception(f"Cannot index into {type(obj).__name__}")

            elif op == Op.GET_PROP:
                prop = code.constants[operand]
                obj = self.stack.pop()
                if isinstance(obj, dict):
                    self.stack.append(obj.get(prop))
                elif isinstance(obj, list):
                    list_methods = {"length": len(obj), "first": obj[0] if obj else None, "last": obj[-1] if obj else None}
                    if prop in list_methods:
                        self.stack.append(list_methods[prop])
                    else:
                        raise Exception(f"List has no property '{prop}'")
                elif isinstance(obj, str):
                    str_methods = {"length": len(obj), "upper": obj.upper(), "lower": obj.lower()}
                    if prop in str_methods:
                        self.stack.append(str_methods[prop])
                    else:
                        raise Exception(f"String has no property '{prop}'")
                else:
                    raise Exception(f"Cannot access property '{prop}' on {type(obj).__name__}")

            elif op == Op.RANGE:
                end = self.stack.pop()
                start = self.stack.pop()
                if end is None:
                    self.stack.append(list(range(start, start)))
                else:
                    self.stack.append(list(range(start, end)))

            elif op == Op.PRINT:
                values = [self.stack.pop() for _ in range(operand)]
                values.reverse()
                output = " ".join(self._display(v) for v in values)
                print(output)
                self.output.append(output)

            elif op == Op.ITER_INIT:
                iterable = self.stack.pop()
                self.stack.append(iter(iterable))

            elif op == Op.ITER_NEXT:
                iterator = self.stack[-1]  # peek
                try:
                    value = next(iterator)
                    self.stack.append(value)
                    self.stack.append(True)
                except StopIteration:
                    self.stack.append(False)

            elif op == Op.PIPE:
                nargs = operand
                args_and_fn = [self.stack.pop() for _ in range(nargs)]
                args_and_fn.reverse()
                callee = self.stack.pop()
                piped_value = args_and_fn[0] if args_and_fn else None
                result = self._call_fn(callee, [piped_value] + args_and_fn[1:])
                self.stack.append(result)

            else:
                raise Exception(f"Unknown opcode: {op}")

        return self.stack[-1] if self.stack else None

    def _is_truthy(self, value):
        if value is None:
            return False
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, (str, list, dict)):
            return len(value) > 0
        return True

    def _display(self, value):
        if value is None:
            return "null"
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, float):
            return str(int(value)) if value == int(value) else str(value)
        if isinstance(value, int):
            return str(value)
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            return "[" + ", ".join(self._repr(v) for v in value) + "]"
        if isinstance(value, dict):
            pairs = ", ".join(f"{k}: {self._repr(v)}" for k, v in value.items())
            return "{" + pairs + "}"
        return str(value)

    def _repr(self, value):
        if isinstance(value, str):
            return f'"{value}"'
        return self._display(value)

    def _type_name(self, value):
        if value is None: return "null"
        if isinstance(value, bool): return "bool"
        if isinstance(value, int): return "int"
        if isinstance(value, float): return "float"
        if isinstance(value, str): return "string"
        if isinstance(value, list): return "list"
        if isinstance(value, dict): return "map"
        return "unknown"


# ── Public API ───────────────────────────────────────────

def compile_to_bytecode(program):
    """Compile an AST Program to bytecode."""
    compiler = Compiler()
    return compiler.compile(program)
