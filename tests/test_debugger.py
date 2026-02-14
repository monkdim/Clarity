"""Tests for Clarity debugger — non-interactive unit tests."""

import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clarity.debugger import Debugger, Breakpoint, DebugFrame


class TestBreakpoint(unittest.TestCase):
    """Breakpoint management."""

    def test_create_breakpoint(self):
        bp = Breakpoint("test.clarity", 10)
        self.assertEqual(bp.file, "test.clarity")
        self.assertEqual(bp.line, 10)
        self.assertTrue(bp.enabled)
        self.assertIsInstance(bp.id, int)

    def test_breakpoint_ids_increment(self):
        bp1 = Breakpoint("a.clarity", 1)
        bp2 = Breakpoint("b.clarity", 2)
        self.assertEqual(bp2.id, bp1.id + 1)

    def test_breakpoint_repr(self):
        bp = Breakpoint("test.clarity", 42)
        s = repr(bp)
        self.assertIn("test.clarity", s)
        self.assertIn("42", s)
        self.assertIn("on", s)

    def test_breakpoint_disable(self):
        bp = Breakpoint("test.clarity", 5)
        bp.enabled = False
        self.assertIn("off", repr(bp))


class TestDebugFrame(unittest.TestCase):
    """Call stack frames."""

    def test_create_frame(self):
        frame = DebugFrame("main", "test.clarity", 1, None)
        self.assertEqual(frame.name, "main")
        self.assertEqual(frame.file, "test.clarity")
        self.assertEqual(frame.line, 1)

    def test_frame_repr(self):
        frame = DebugFrame("foo", "test.clarity", 42, None)
        s = repr(frame)
        self.assertIn("foo", s)
        self.assertIn("42", s)


class TestDebuggerInit(unittest.TestCase):
    """Debugger initialization."""

    def setUp(self):
        # Create a temp clarity file for testing
        self.test_file = "/tmp/test_debug.clarity"
        with open(self.test_file, "w") as f:
            f.write('let x = 42\nlet y = "hello"\nshow x\nshow y\n')

    def tearDown(self):
        if os.path.exists(self.test_file):
            os.remove(self.test_file)

    def test_debugger_loads_source(self):
        dbg = Debugger(self.test_file)
        self.assertIn("let x = 42", dbg.source)
        self.assertGreaterEqual(len(dbg.source_lines), 4)

    def test_debugger_has_interpreter(self):
        dbg = Debugger(self.test_file)
        self.assertIsNotNone(dbg.interpreter)

    def test_debugger_initial_state(self):
        dbg = Debugger(self.test_file)
        self.assertEqual(dbg.breakpoints, [])
        self.assertEqual(dbg.watches, [])
        self.assertEqual(dbg.mode, "continue")

    def test_add_breakpoint(self):
        dbg = Debugger(self.test_file)
        bp = Breakpoint("test_debug.clarity", 3)
        dbg.breakpoints.append(bp)
        self.assertEqual(len(dbg.breakpoints), 1)
        self.assertEqual(dbg.breakpoints[0].line, 3)

    def test_add_watch(self):
        dbg = Debugger(self.test_file)
        dbg.watches.append("x + 1")
        self.assertEqual(len(dbg.watches), 1)
        self.assertEqual(dbg.watches[0], "x + 1")

    def test_format_value_string(self):
        dbg = Debugger(self.test_file)
        result = dbg._format_value("hello")
        self.assertIn("hello", result)

    def test_format_value_int(self):
        dbg = Debugger(self.test_file)
        result = dbg._format_value(42)
        self.assertIn("42", result)

    def test_format_value_none(self):
        dbg = Debugger(self.test_file)
        result = dbg._format_value(None)
        self.assertIn("null", result)

    def test_format_value_bool(self):
        dbg = Debugger(self.test_file)
        result = dbg._format_value(True)
        self.assertIn("true", result)

    def test_format_value_list(self):
        dbg = Debugger(self.test_file)
        result = dbg._format_value([1, 2, 3])
        self.assertIn("1", result)
        self.assertIn("2", result)
        self.assertIn("3", result)

    def test_format_value_dict(self):
        dbg = Debugger(self.test_file)
        result = dbg._format_value({"a": 1})
        self.assertIn("a", result)

    def test_format_value_long_list(self):
        dbg = Debugger(self.test_file)
        result = dbg._format_value(list(range(20)))
        self.assertIn("20 items", result)

    def test_format_value_large_dict(self):
        dbg = Debugger(self.test_file)
        result = dbg._format_value({str(i): i for i in range(10)})
        self.assertIn("10 keys", result)


class TestDebuggerBreakpointManagement(unittest.TestCase):
    """Breakpoint add/delete/list."""

    def setUp(self):
        self.test_file = "/tmp/test_debug_bp.clarity"
        with open(self.test_file, "w") as f:
            f.write('let x = 1\nlet y = 2\nshow x + y\n')

    def tearDown(self):
        if os.path.exists(self.test_file):
            os.remove(self.test_file)

    def test_cmd_breakpoint_line(self):
        dbg = Debugger(self.test_file)
        dbg._cmd_breakpoint("2")
        self.assertEqual(len(dbg.breakpoints), 1)
        self.assertEqual(dbg.breakpoints[0].line, 2)

    def test_cmd_breakpoint_file_line(self):
        dbg = Debugger(self.test_file)
        dbg._cmd_breakpoint("test.clarity:5")
        self.assertEqual(len(dbg.breakpoints), 1)
        self.assertEqual(dbg.breakpoints[0].file, "test.clarity")
        self.assertEqual(dbg.breakpoints[0].line, 5)

    def test_cmd_delete_breakpoint(self):
        dbg = Debugger(self.test_file)
        dbg._cmd_breakpoint("3")
        bp_id = dbg.breakpoints[0].id
        dbg._cmd_delete_breakpoint(str(bp_id))
        self.assertEqual(len(dbg.breakpoints), 0)

    def test_cmd_watch_add(self):
        dbg = Debugger(self.test_file)
        dbg._cmd_watch("x + y")
        self.assertEqual(len(dbg.watches), 1)

    def test_cmd_unwatch(self):
        dbg = Debugger(self.test_file)
        dbg._cmd_watch("x")
        dbg._cmd_unwatch("1")
        self.assertEqual(len(dbg.watches), 0)


if __name__ == "__main__":
    unittest.main()
