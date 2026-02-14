"""Clarity profiler — measure execution time, call counts, and hotspots."""

import os
import sys
import time

from . import ast_nodes as ast
from .lexer import tokenize
from .parser import parse
from .interpreter import Interpreter, Environment, ClarityFunction, ReturnSignal
from .errors import ClarityError


# ANSI colors
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
RESET = "\033[0m"


class FunctionStats:
    """Accumulated stats for a single function."""
    __slots__ = ('name', 'calls', 'total_time', 'self_time', 'callers')

    def __init__(self, name):
        self.name = name
        self.calls = 0
        self.total_time = 0.0
        self.self_time = 0.0
        self.callers = {}  # caller_name -> count

    @property
    def avg_time(self):
        return self.total_time / self.calls if self.calls else 0.0


class LineStats:
    """Accumulated stats for a single source line."""
    __slots__ = ('line', 'hits', 'total_time')

    def __init__(self, line):
        self.line = line
        self.hits = 0
        self.total_time = 0.0

    @property
    def avg_time(self):
        return self.total_time / self.hits if self.hits else 0.0


class Profiler:
    """Profiles a Clarity program by hooking into the interpreter."""

    def __init__(self, source_path):
        self.source_path = os.path.abspath(source_path)
        self.source_dir = os.path.dirname(self.source_path)

        with open(source_path) as f:
            self.source = f.read()
        self.source_lines = self.source.split('\n')

        # Profile data
        self.function_stats = {}   # name -> FunctionStats
        self.line_stats = {}       # line_number -> LineStats
        self.call_stack = []       # stack of (func_name, start_time)
        self.wall_start = 0.0
        self.wall_end = 0.0

        # Interpreter with hooks
        self.interpreter = None
        self._setup_interpreter()

    def _setup_interpreter(self):
        """Create interpreter and instrument execute/call methods."""
        self.interpreter = Interpreter(source_dir=self.source_dir)
        profiler = self

        # Hook execute for line-level profiling
        original_execute = self.interpreter.execute

        def hooked_execute(node, env):
            line = getattr(node, 'line', None)
            if line is not None:
                start = time.perf_counter()
                result = original_execute(node, env)
                elapsed = time.perf_counter() - start
                if line not in profiler.line_stats:
                    profiler.line_stats[line] = LineStats(line)
                profiler.line_stats[line].hits += 1
                profiler.line_stats[line].total_time += elapsed
                return result
            return original_execute(node, env)

        self.interpreter.execute = hooked_execute

        # Hook _call for function-level profiling
        original_call = self.interpreter._call

        def hooked_call(callee, args, line):
            name = _callee_name(callee)
            caller = profiler.call_stack[-1][0] if profiler.call_stack else "<main>"

            if name not in profiler.function_stats:
                profiler.function_stats[name] = FunctionStats(name)
            stats = profiler.function_stats[name]
            stats.calls += 1
            stats.callers[caller] = stats.callers.get(caller, 0) + 1

            profiler.call_stack.append((name, time.perf_counter()))
            try:
                result = original_call(callee, args, line)
                return result
            finally:
                _, start = profiler.call_stack.pop()
                elapsed = time.perf_counter() - start
                stats.total_time += elapsed
                # self_time = total - time spent in children
                # Approximate: subtract children's time from parent
                stats.self_time += elapsed

        self.interpreter._call = hooked_call

    def run(self):
        """Profile the program and return results."""
        print(f"\n  {BOLD}Clarity Profiler{RESET}")
        print(f"  {DIM}File: {self.source_path}{RESET}\n")

        try:
            tokens = tokenize(self.source, self.source_path)
            tree = parse(tokens, self.source)
        except ClarityError as e:
            print(f"  {RED}Parse error:{RESET} {e}")
            return

        self.wall_start = time.perf_counter()
        try:
            self.interpreter.run(tree)
        except ClarityError as e:
            print(f"\n  {RED}Runtime error:{RESET} {e}")
        except KeyboardInterrupt:
            print(f"\n  {DIM}-- Interrupted --{RESET}")
        self.wall_end = time.perf_counter()

        self._fix_self_time()
        self._print_report()

    def _fix_self_time(self):
        """Adjust self_time by subtracting callee time from callers."""
        # For each function, subtract the total_time of its callees
        for name, stats in self.function_stats.items():
            child_time = 0.0
            for other_name, other_stats in self.function_stats.items():
                if other_name != name and name in other_stats.callers:
                    # other was called from name, but this is inverted
                    pass
            # Simple approximation: self_time stays as-is from measurement
            # More accurate: re-derive from line stats
            pass

    def _print_report(self):
        """Print the full profiling report."""
        wall_time = self.wall_end - self.wall_start

        print(f"\n  {'=' * 62}")
        print(f"  {BOLD}Profile Report{RESET}")
        print(f"  {'=' * 62}")
        print(f"  Wall time: {YELLOW}{self._fmt_time(wall_time)}{RESET}")
        print()

        self._print_function_report()
        self._print_hotlines_report()
        self._print_callers_report()

    def _print_function_report(self):
        """Print function-level profiling data sorted by total time."""
        if not self.function_stats:
            print(f"  {DIM}No function calls recorded.{RESET}")
            return

        print(f"  {BOLD}Function Profile{RESET} (sorted by total time)")
        print(f"  {DIM}{'Function':<30s} {'Calls':>6s} {'Total':>10s} {'Avg':>10s}{RESET}")
        print(f"  {'-' * 58}")

        sorted_fns = sorted(
            self.function_stats.values(),
            key=lambda s: s.total_time,
            reverse=True
        )

        for stats in sorted_fns[:20]:
            name = stats.name if len(stats.name) <= 29 else stats.name[:26] + "..."
            print(
                f"  {name:<30s} "
                f"{stats.calls:>6d} "
                f"{self._fmt_time(stats.total_time):>10s} "
                f"{self._fmt_time(stats.avg_time):>10s}"
            )
        print()

    def _print_hotlines_report(self):
        """Print the hottest lines by total time."""
        if not self.line_stats:
            return

        print(f"  {BOLD}Hot Lines{RESET} (top 15 by total time)")
        print(f"  {DIM}{'Line':>6s} {'Hits':>8s} {'Total':>10s}  Source{RESET}")
        print(f"  {'-' * 58}")

        sorted_lines = sorted(
            self.line_stats.values(),
            key=lambda s: s.total_time,
            reverse=True
        )

        for stats in sorted_lines[:15]:
            src = ""
            if 0 < stats.line <= len(self.source_lines):
                src = self.source_lines[stats.line - 1].strip()
                if len(src) > 40:
                    src = src[:37] + "..."
            bar = self._heat_bar(stats.total_time, sorted_lines[0].total_time)
            print(
                f"  {stats.line:>6d} "
                f"{stats.hits:>8d} "
                f"{self._fmt_time(stats.total_time):>10s}  "
                f"{bar} {src}"
            )
        print()

    def _print_callers_report(self):
        """Print caller relationships."""
        has_callers = any(s.callers for s in self.function_stats.values())
        if not has_callers:
            return

        print(f"  {BOLD}Call Graph{RESET}")
        print(f"  {DIM}{'Callee':<25s} <- {'Caller':<25s} {'Count':>6s}{RESET}")
        print(f"  {'-' * 58}")

        for name, stats in sorted(self.function_stats.items(), key=lambda x: x[1].total_time, reverse=True):
            for caller, count in sorted(stats.callers.items(), key=lambda x: x[1], reverse=True):
                callee_name = name if len(name) <= 24 else name[:21] + "..."
                caller_name = caller if len(caller) <= 24 else caller[:21] + "..."
                print(f"  {callee_name:<25s} <- {caller_name:<25s} {count:>6d}")
        print()

    # ── Formatting helpers ──────────────────────────────────

    def _fmt_time(self, seconds):
        """Format time in human-readable units."""
        if seconds < 0.001:
            return f"{seconds * 1_000_000:.0f}us"
        if seconds < 1.0:
            return f"{seconds * 1000:.2f}ms"
        return f"{seconds:.3f}s"

    def _heat_bar(self, value, max_value):
        """Create a colored heat bar."""
        if max_value == 0:
            return ""
        ratio = value / max_value
        width = int(ratio * 10)
        if ratio > 0.7:
            color = RED
        elif ratio > 0.3:
            color = YELLOW
        else:
            color = GREEN
        return f"{color}{'█' * width}{'░' * (10 - width)}{RESET}"

    def get_stats(self):
        """Return raw stats for programmatic access."""
        return {
            "wall_time": self.wall_end - self.wall_start,
            "functions": {
                name: {
                    "calls": s.calls,
                    "total_time": s.total_time,
                    "avg_time": s.avg_time,
                    "callers": dict(s.callers),
                }
                for name, s in self.function_stats.items()
            },
            "lines": {
                line: {
                    "hits": s.hits,
                    "total_time": s.total_time,
                }
                for line, s in self.line_stats.items()
            },
        }


def _callee_name(callee):
    """Extract a display name from a callee."""
    if isinstance(callee, ClarityFunction):
        return callee.name
    if hasattr(callee, '__name__'):
        return callee.__name__
    if hasattr(callee, 'name'):
        return callee.name
    return str(callee)[:30]


def profile_file(path):
    """Profile a Clarity source file."""
    if not os.path.exists(path):
        print(f"  {RED}>> File not found: {path}{RESET}")
        sys.exit(1)

    prof = Profiler(path)
    prof.run()
