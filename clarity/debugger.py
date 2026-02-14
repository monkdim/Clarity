"""Clarity debugger — interactive step-through debugging."""

import os
import sys
import readline

from . import ast_nodes as ast
from .lexer import tokenize
from .parser import parse
from .interpreter import Interpreter, Environment, ReturnSignal
from .errors import ClarityError


# ANSI colors
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
RESET = "\033[0m"


class Breakpoint:
    """A breakpoint at a file:line location."""
    __slots__ = ('file', 'line', 'enabled', 'id')
    _next_id = 1

    def __init__(self, file, line):
        self.file = file
        self.line = line
        self.enabled = True
        self.id = Breakpoint._next_id
        Breakpoint._next_id += 1

    def __repr__(self):
        state = "on" if self.enabled else "off"
        return f"#{self.id} {self.file}:{self.line} ({state})"


class DebugFrame:
    """A single frame in the debug call stack."""
    __slots__ = ('name', 'file', 'line', 'env')

    def __init__(self, name, file, line, env):
        self.name = name
        self.file = file
        self.line = line
        self.env = env

    def __repr__(self):
        return f"{self.name} at {self.file}:{self.line}"


class Debugger:
    """Interactive step-through debugger for Clarity programs."""

    def __init__(self, source_path):
        self.source_path = os.path.abspath(source_path)
        self.source_dir = os.path.dirname(self.source_path)

        # Load source for display
        with open(source_path) as f:
            self.source = f.read()
        self.source_lines = self.source.split('\n')

        # Debug state
        self.breakpoints = []
        self.call_stack = []  # list of DebugFrame
        self.current_line = 0
        self.current_file = source_path

        # Step mode
        self.mode = "continue"  # "continue", "step", "next", "finish"
        self.step_depth = 0     # depth at which "next" was issued
        self.paused = False

        # Watch expressions
        self.watches = []

        # Interpreter with hooks
        self.interpreter = None
        self._setup_interpreter()

    def _setup_interpreter(self):
        """Create an interpreter and monkey-patch execute/evaluate for breakpoints."""
        self.interpreter = Interpreter(source_dir=self.source_dir)
        original_execute = self.interpreter.execute

        debugger = self

        def hooked_execute(node, env):
            line = getattr(node, 'line', None)
            if line is not None:
                debugger.current_line = line
                # Update call stack top
                if debugger.call_stack:
                    debugger.call_stack[-1].line = line
                    debugger.call_stack[-1].env = env

                should_break = False

                # Check breakpoints
                for bp in debugger.breakpoints:
                    if bp.enabled and bp.line == line:
                        if bp.file == debugger.current_file or bp.file == os.path.basename(debugger.current_file):
                            should_break = True
                            print(f"\n  {YELLOW}Breakpoint #{bp.id}{RESET} at line {line}")
                            break

                # Check step modes
                if debugger.mode == "step":
                    should_break = True
                elif debugger.mode == "next" and len(debugger.call_stack) <= debugger.step_depth:
                    should_break = True
                elif debugger.mode == "finish" and len(debugger.call_stack) < debugger.step_depth:
                    should_break = True

                if should_break:
                    debugger.paused = True
                    debugger._show_location(line, env)
                    debugger._debug_prompt(env)

            return original_execute(node, env)

        self.interpreter.execute = hooked_execute

    def run(self):
        """Start the debugger session."""
        print(f"\n  {BOLD}Clarity Debugger{RESET}")
        print(f"  {DIM}File: {self.source_path}{RESET}")
        print(f"  {DIM}Type 'help' for commands.{RESET}\n")

        # Parse the source
        try:
            tokens = tokenize(self.source, self.source_path)
            tree = parse(tokens, self.source)
        except ClarityError as e:
            print(f"  {RED}Parse error:{RESET} {e}")
            return

        # Push initial frame
        self.call_stack.append(DebugFrame(
            "<main>", self.source_path, 1, self.interpreter.global_env
        ))

        # Start paused at first statement
        self.mode = "step"

        try:
            self.interpreter.run(tree)
            print(f"\n  {GREEN}Program finished.{RESET}")
        except ClarityError as e:
            print(f"\n  {RED}Runtime error:{RESET} {e}")
            # Drop into debugger on error
            if self.call_stack:
                env = self.call_stack[-1].env
                print(f"  {DIM}Dropped into debugger at error location.{RESET}")
                self._show_location(self.current_line, env)
                self._debug_prompt(env)
        except KeyboardInterrupt:
            print(f"\n  {DIM}-- Interrupted --{RESET}")
        except SystemExit:
            pass

    def _show_location(self, line, env):
        """Show the current source location with context."""
        start = max(0, line - 3)
        end = min(len(self.source_lines), line + 2)

        print()
        for i in range(start, end):
            lineno = i + 1
            marker = f"  {GREEN}>{RESET} " if lineno == line else "    "
            dim = "" if lineno == line else DIM
            reset = RESET if dim else ""
            src = self.source_lines[i] if i < len(self.source_lines) else ""
            print(f"  {dim}{lineno:4d}{reset}{marker}{dim}{src}{reset}")

        # Show watches
        if self.watches:
            print(f"\n  {CYAN}Watches:{RESET}")
            for expr in self.watches:
                try:
                    tokens_w = tokenize(expr)
                    tree_w = parse(tokens_w, expr)
                    if tree_w.body:
                        last = tree_w.body[-1]
                        if isinstance(last, ast.ExpressionStatement):
                            val = self.interpreter.evaluate(last.expression, env)
                        else:
                            val = self.interpreter.execute(last, env)
                        print(f"    {expr} = {self._format_value(val)}")
                except Exception as e:
                    print(f"    {expr} = {RED}<error: {e}>{RESET}")

    def _debug_prompt(self, env):
        """Interactive debug prompt. Blocks until user issues a command."""
        while True:
            try:
                cmd = input(f"  {CYAN}debug>{RESET} ").strip()
            except (EOFError, KeyboardInterrupt):
                print(f"\n  {DIM}-- Quit --{RESET}")
                sys.exit(0)

            if not cmd:
                continue

            parts = cmd.split(None, 1)
            command = parts[0].lower()
            arg = parts[1] if len(parts) > 1 else ""

            if command in ("s", "step"):
                self.mode = "step"
                return

            elif command in ("n", "next"):
                self.mode = "next"
                self.step_depth = len(self.call_stack)
                return

            elif command in ("c", "continue", "cont"):
                self.mode = "continue"
                return

            elif command in ("f", "finish", "out"):
                self.mode = "finish"
                self.step_depth = len(self.call_stack)
                return

            elif command in ("q", "quit", "exit"):
                print(f"  {DIM}-- Quit --{RESET}")
                sys.exit(0)

            elif command in ("b", "break"):
                self._cmd_breakpoint(arg)

            elif command in ("d", "delete"):
                self._cmd_delete_breakpoint(arg)

            elif command in ("bl", "breakpoints"):
                self._cmd_list_breakpoints()

            elif command in ("p", "print"):
                self._cmd_print(arg, env)

            elif command in ("e", "eval"):
                self._cmd_eval(arg, env)

            elif command in ("l", "list"):
                self._cmd_list_source(arg)

            elif command in ("w", "watch"):
                self._cmd_watch(arg)

            elif command in ("uw", "unwatch"):
                self._cmd_unwatch(arg)

            elif command in ("v", "vars", "locals"):
                self._cmd_vars(env)

            elif command in ("bt", "backtrace", "stack"):
                self._cmd_backtrace()

            elif command in ("h", "help"):
                self._cmd_help()

            else:
                # Try to evaluate as expression
                self._cmd_print(cmd, env)

    # ── Commands ────────────────────────────────────────────

    def _cmd_breakpoint(self, arg):
        """Set a breakpoint: b <line> or b <file>:<line>"""
        if not arg:
            print(f"  Usage: break <line> or break <file>:<line>")
            return
        if ':' in arg:
            file, line_str = arg.rsplit(':', 1)
        else:
            file = os.path.basename(self.source_path)
            line_str = arg
        try:
            line = int(line_str)
        except ValueError:
            print(f"  {RED}Invalid line number: {line_str}{RESET}")
            return
        bp = Breakpoint(file, line)
        self.breakpoints.append(bp)
        print(f"  {GREEN}Breakpoint #{bp.id}{RESET} set at {file}:{line}")

    def _cmd_delete_breakpoint(self, arg):
        """Delete a breakpoint: d <id>"""
        if not arg:
            print(f"  Usage: delete <breakpoint-id>")
            return
        try:
            bp_id = int(arg.lstrip('#'))
        except ValueError:
            print(f"  {RED}Invalid breakpoint id: {arg}{RESET}")
            return
        for i, bp in enumerate(self.breakpoints):
            if bp.id == bp_id:
                self.breakpoints.pop(i)
                print(f"  Deleted breakpoint #{bp_id}")
                return
        print(f"  {RED}No breakpoint #{bp_id}{RESET}")

    def _cmd_list_breakpoints(self):
        """List all breakpoints."""
        if not self.breakpoints:
            print(f"  {DIM}No breakpoints set.{RESET}")
            return
        for bp in self.breakpoints:
            print(f"  {bp}")

    def _cmd_print(self, expr, env):
        """Print an expression value."""
        if not expr:
            print(f"  Usage: print <expression>")
            return
        try:
            tokens_p = tokenize(expr)
            tree_p = parse(tokens_p, expr)
            if tree_p.body:
                last = tree_p.body[-1]
                if isinstance(last, ast.ExpressionStatement):
                    val = self.interpreter.evaluate(last.expression, env)
                else:
                    val = self.interpreter.execute(last, env)
                print(f"  = {self._format_value(val)}")
        except Exception as e:
            print(f"  {RED}Error: {e}{RESET}")

    def _cmd_eval(self, expr, env):
        """Evaluate and execute a statement."""
        if not expr:
            print(f"  Usage: eval <code>")
            return
        try:
            # Temporarily disable stepping
            old_mode = self.mode
            self.mode = "continue"
            tokens_e = tokenize(expr)
            tree_e = parse(tokens_e, expr)
            result = None
            for stmt in tree_e.body:
                result = self.interpreter.execute(stmt, env)
            if result is not None:
                print(f"  = {self._format_value(result)}")
            self.mode = old_mode
        except Exception as e:
            print(f"  {RED}Error: {e}{RESET}")

    def _cmd_list_source(self, arg):
        """List source code around a line."""
        if arg:
            try:
                center = int(arg)
            except ValueError:
                center = self.current_line
        else:
            center = self.current_line
        start = max(0, center - 6)
        end = min(len(self.source_lines), center + 5)
        for i in range(start, end):
            lineno = i + 1
            marker = f"  {GREEN}>{RESET} " if lineno == self.current_line else "    "
            # Mark breakpoint lines
            bp_mark = ""
            for bp in self.breakpoints:
                if bp.enabled and bp.line == lineno:
                    bp_mark = f" {RED}*{RESET}"
                    break
            dim = "" if lineno == self.current_line else DIM
            reset = RESET if dim else ""
            src = self.source_lines[i] if i < len(self.source_lines) else ""
            print(f"  {dim}{lineno:4d}{reset}{marker}{dim}{src}{reset}{bp_mark}")

    def _cmd_watch(self, expr):
        """Add a watch expression."""
        if not expr:
            if self.watches:
                print(f"  {CYAN}Watches:{RESET}")
                for i, w in enumerate(self.watches):
                    print(f"    {i + 1}. {w}")
            else:
                print(f"  {DIM}No watches set.{RESET}")
            return
        self.watches.append(expr)
        print(f"  {GREEN}Watch added:{RESET} {expr}")

    def _cmd_unwatch(self, arg):
        """Remove a watch expression."""
        if not arg:
            print(f"  Usage: unwatch <index>")
            return
        try:
            idx = int(arg) - 1
            if 0 <= idx < len(self.watches):
                removed = self.watches.pop(idx)
                print(f"  Removed watch: {removed}")
            else:
                print(f"  {RED}Invalid watch index{RESET}")
        except ValueError:
            # Try removing by expression text
            for i, w in enumerate(self.watches):
                if w == arg:
                    self.watches.pop(i)
                    print(f"  Removed watch: {arg}")
                    return
            print(f"  {RED}Watch not found: {arg}{RESET}")

    def _cmd_vars(self, env):
        """Show all variables in current scope."""
        from .runtime import get_builtins
        builtin_names = set(get_builtins(self.interpreter).keys())

        shown = set()
        scope = env
        depth = 0
        while scope:
            for name, val in scope.vars.items():
                if name not in shown and name not in builtin_names:
                    shown.add(name)
                    mut = " (mut)" if name in scope.mutables else ""
                    label = f"{DIM}[outer]{RESET} " if depth > 0 else ""
                    print(f"  {label}{BOLD}{name}{RESET}{mut} = {self._format_value(val)}")
            scope = scope.parent
            depth += 1
        if not shown:
            print(f"  {DIM}No user variables in scope.{RESET}")

    def _cmd_backtrace(self):
        """Show the call stack."""
        if not self.call_stack:
            print(f"  {DIM}Empty call stack.{RESET}")
            return
        for i, frame in enumerate(reversed(self.call_stack)):
            marker = f"{GREEN}>{RESET} " if i == 0 else "  "
            print(f"  {marker}#{i} {frame}")

    def _cmd_help(self):
        """Show debug commands."""
        print(f"""
  {BOLD}Debugger Commands:{RESET}

  {CYAN}Execution:{RESET}
    s, step         Step into (execute one statement)
    n, next         Step over (skip into function calls)
    f, finish       Step out (run until current function returns)
    c, continue     Continue until next breakpoint
    q, quit         Exit debugger

  {CYAN}Breakpoints:{RESET}
    b <line>        Set breakpoint at line
    b <file>:<line> Set breakpoint at file:line
    d <id>          Delete breakpoint
    bl              List all breakpoints

  {CYAN}Inspection:{RESET}
    p <expr>        Print expression value
    e <code>        Evaluate Clarity code
    v, vars         Show variables in current scope
    bt, backtrace   Show call stack
    l [line]        List source code
    w <expr>        Add watch expression
    uw <index>      Remove watch expression
""")

    # ── Helpers ─────────────────────────────────────────────

    def _format_value(self, val):
        """Format a value for debug display."""
        if val is None:
            return f"{DIM}null{RESET}"
        if isinstance(val, str):
            return f'{GREEN}"{val}"{RESET}'
        if isinstance(val, bool):
            return f"{CYAN}{str(val).lower()}{RESET}"
        if isinstance(val, (int, float)):
            return f"{YELLOW}{val}{RESET}"
        if isinstance(val, list):
            if len(val) > 10:
                items = ", ".join(self._format_value(v) for v in val[:10])
                return f"[{items}, ... ({len(val)} items)]"
            items = ", ".join(self._format_value(v) for v in val)
            return f"[{items}]"
        if isinstance(val, dict):
            if len(val) > 5:
                items = ", ".join(f"{k}: {self._format_value(v)}" for k, v in list(val.items())[:5])
                return f"{{{items}, ... ({len(val)} keys)}}"
            items = ", ".join(f"{k}: {self._format_value(v)}" for k, v in val.items())
            return f"{{{items}}}"
        return str(val)


def debug_file(path):
    """Start the debugger on a Clarity source file."""
    if not os.path.exists(path):
        print(f"  {RED}>> File not found: {path}{RESET}")
        sys.exit(1)

    dbg = Debugger(path)
    dbg.run()
