"""Tests for Clarity profiler."""

import unittest
import sys
import os
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clarity.profiler import Profiler, FunctionStats, LineStats, _callee_name
from clarity.interpreter import ClarityFunction, Environment


class TestFunctionStats(unittest.TestCase):

    def test_create(self):
        s = FunctionStats("add")
        self.assertEqual(s.name, "add")
        self.assertEqual(s.calls, 0)
        self.assertEqual(s.total_time, 0.0)
        self.assertEqual(s.callers, {})

    def test_avg_time_zero_calls(self):
        s = FunctionStats("f")
        self.assertEqual(s.avg_time, 0.0)

    def test_avg_time(self):
        s = FunctionStats("f")
        s.calls = 4
        s.total_time = 2.0
        self.assertAlmostEqual(s.avg_time, 0.5)


class TestLineStats(unittest.TestCase):

    def test_create(self):
        s = LineStats(10)
        self.assertEqual(s.line, 10)
        self.assertEqual(s.hits, 0)
        self.assertEqual(s.total_time, 0.0)

    def test_avg_time(self):
        s = LineStats(5)
        s.hits = 10
        s.total_time = 1.0
        self.assertAlmostEqual(s.avg_time, 0.1)


class TestCalleeNameHelper(unittest.TestCase):

    def test_clarity_function(self):
        fn = ClarityFunction("add", ["a", "b"], None, Environment())
        self.assertEqual(_callee_name(fn), "add")

    def test_python_builtin(self):
        self.assertEqual(_callee_name(len), "len")

    def test_lambda(self):
        f = lambda x: x
        self.assertEqual(_callee_name(f), "<lambda>")


class TestProfilerInit(unittest.TestCase):

    def setUp(self):
        self.test_file = tempfile.NamedTemporaryFile(
            mode='w', suffix='.clarity', delete=False
        )
        self.test_file.write('let x = 1\nlet y = 2\nshow x + y\n')
        self.test_file.close()

    def tearDown(self):
        os.unlink(self.test_file.name)

    def test_loads_source(self):
        prof = Profiler(self.test_file.name)
        self.assertIn("let x = 1", prof.source)

    def test_has_interpreter(self):
        prof = Profiler(self.test_file.name)
        self.assertIsNotNone(prof.interpreter)

    def test_initial_empty_stats(self):
        prof = Profiler(self.test_file.name)
        self.assertEqual(prof.function_stats, {})
        self.assertEqual(prof.line_stats, {})


class TestProfilerFormatTime(unittest.TestCase):

    def setUp(self):
        self.test_file = tempfile.NamedTemporaryFile(
            mode='w', suffix='.clarity', delete=False
        )
        self.test_file.write('let x = 1\n')
        self.test_file.close()
        self.prof = Profiler(self.test_file.name)

    def tearDown(self):
        os.unlink(self.test_file.name)

    def test_microseconds(self):
        result = self.prof._fmt_time(0.0001)
        self.assertIn("us", result)

    def test_milliseconds(self):
        result = self.prof._fmt_time(0.05)
        self.assertIn("ms", result)

    def test_seconds(self):
        result = self.prof._fmt_time(2.5)
        self.assertIn("s", result)


class TestProfilerExecution(unittest.TestCase):
    """Test that profiling actually records stats."""

    def setUp(self):
        self.test_file = tempfile.NamedTemporaryFile(
            mode='w', suffix='.clarity', delete=False
        )
        self.test_file.write('''
fn add(a, b) {
    return a + b
}
let result = add(1, 2)
show result
''')
        self.test_file.close()

    def tearDown(self):
        os.unlink(self.test_file.name)

    def test_records_function_calls(self):
        prof = Profiler(self.test_file.name)
        from clarity.lexer import tokenize
        from clarity.parser import parse
        tokens = tokenize(prof.source, prof.source_path)
        tree = parse(tokens, prof.source)
        prof.interpreter.run(tree)

        self.assertIn("add", prof.function_stats)
        self.assertEqual(prof.function_stats["add"].calls, 1)

    def test_records_line_stats(self):
        prof = Profiler(self.test_file.name)
        from clarity.lexer import tokenize
        from clarity.parser import parse
        tokens = tokenize(prof.source, prof.source_path)
        tree = parse(tokens, prof.source)
        prof.interpreter.run(tree)

        self.assertGreater(len(prof.line_stats), 0)
        # All recorded lines should have at least 1 hit
        for line, stats in prof.line_stats.items():
            self.assertGreater(stats.hits, 0)

    def test_records_callers(self):
        prof = Profiler(self.test_file.name)
        from clarity.lexer import tokenize
        from clarity.parser import parse
        tokens = tokenize(prof.source, prof.source_path)
        tree = parse(tokens, prof.source)
        prof.interpreter.run(tree)

        add_stats = prof.function_stats.get("add")
        self.assertIsNotNone(add_stats)
        self.assertIn("<main>", add_stats.callers)

    def test_get_stats_dict(self):
        prof = Profiler(self.test_file.name)
        from clarity.lexer import tokenize
        from clarity.parser import parse
        tokens = tokenize(prof.source, prof.source_path)
        tree = parse(tokens, prof.source)
        prof.wall_start = 1.0
        prof.interpreter.run(tree)
        prof.wall_end = 2.0

        stats = prof.get_stats()
        self.assertIn("wall_time", stats)
        self.assertIn("functions", stats)
        self.assertIn("lines", stats)
        self.assertIn("add", stats["functions"])


class TestProfilerLoop(unittest.TestCase):
    """Test profiling with loops for multiple hits."""

    def setUp(self):
        self.test_file = tempfile.NamedTemporaryFile(
            mode='w', suffix='.clarity', delete=False
        )
        self.test_file.write('''
fn square(n) {
    return n * n
}
for i in range(5) {
    square(i)
}
''')
        self.test_file.close()

    def tearDown(self):
        os.unlink(self.test_file.name)

    def test_multiple_calls(self):
        prof = Profiler(self.test_file.name)
        from clarity.lexer import tokenize
        from clarity.parser import parse
        tokens = tokenize(prof.source, prof.source_path)
        tree = parse(tokens, prof.source)
        prof.interpreter.run(tree)

        self.assertIn("square", prof.function_stats)
        self.assertEqual(prof.function_stats["square"].calls, 5)

    def test_line_hits_in_loop(self):
        prof = Profiler(self.test_file.name)
        from clarity.lexer import tokenize
        from clarity.parser import parse
        tokens = tokenize(prof.source, prof.source_path)
        tree = parse(tokens, prof.source)
        prof.interpreter.run(tree)

        # The loop body line should have multiple hits
        max_hits = max(s.hits for s in prof.line_stats.values())
        self.assertGreater(max_hits, 1)


class TestHeatBar(unittest.TestCase):

    def setUp(self):
        self.test_file = tempfile.NamedTemporaryFile(
            mode='w', suffix='.clarity', delete=False
        )
        self.test_file.write('let x = 1\n')
        self.test_file.close()
        self.prof = Profiler(self.test_file.name)

    def tearDown(self):
        os.unlink(self.test_file.name)

    def test_full_bar(self):
        bar = self.prof._heat_bar(1.0, 1.0)
        self.assertIn("█", bar)

    def test_empty_bar(self):
        bar = self.prof._heat_bar(0.0, 1.0)
        self.assertIn("░", bar)

    def test_zero_max(self):
        bar = self.prof._heat_bar(0.0, 0.0)
        self.assertEqual(bar, "")


if __name__ == "__main__":
    unittest.main()
