"""Tests for Clarity linter."""

import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clarity.lexer import tokenize
from clarity.parser import parse
from clarity.linter import lint


def get_diagnostics(source):
    """Helper: lint source and return diagnostics list."""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    return lint(tree)


class TestLinterUnusedVariables(unittest.TestCase):
    """W001: Unused variables."""

    def test_unused_variable(self):
        diags = get_diagnostics('let x = 42')
        codes = [d.code for d in diags]
        self.assertIn("W001", codes)

    def test_used_variable_no_warning(self):
        diags = get_diagnostics('let x = 42\nshow x')
        unused = [d for d in diags if d.code == "W001"]
        self.assertEqual(len(unused), 0)

    def test_underscore_prefix_suppresses(self):
        diags = get_diagnostics('let _unused = 42')
        unused = [d for d in diags if d.code == "W001"]
        self.assertEqual(len(unused), 0)

    def test_unused_in_function(self):
        diags = get_diagnostics('fn foo() { let x = 1 }\nfoo()')
        unused = [d for d in diags if d.code == "W001"]
        self.assertTrue(any("x" in d.message for d in unused))


class TestLinterMutableNotReassigned(unittest.TestCase):
    """W002: Mutable but never reassigned."""

    def test_mut_never_reassigned(self):
        diags = get_diagnostics('mut x = 42\nshow x')
        codes = [d.code for d in diags]
        self.assertIn("W002", codes)

    def test_mut_reassigned_no_warning(self):
        diags = get_diagnostics('mut x = 0\nx = 42\nshow x')
        w002 = [d for d in diags if d.code == "W002"]
        self.assertEqual(len(w002), 0)


class TestLinterShadowing(unittest.TestCase):
    """W004: Variable shadowing."""

    def test_shadow_in_function(self):
        diags = get_diagnostics('let x = 1\nfn foo() { let x = 2\nshow x }\nshow x\nfoo()')
        codes = [d.code for d in diags]
        self.assertIn("W004", codes)


class TestLinterConstantCondition(unittest.TestCase):
    """W005: Constant conditions."""

    def test_if_true(self):
        diags = get_diagnostics('if true { show "yes" }')
        codes = [d.code for d in diags]
        self.assertIn("W005", codes)

    def test_if_false(self):
        diags = get_diagnostics('if false { show "no" }')
        codes = [d.code for d in diags]
        self.assertIn("W005", codes)

    def test_while_true(self):
        diags = get_diagnostics('while true { break }')
        codes = [d.code for d in diags]
        self.assertIn("W005", codes)


class TestLinterNullComparison(unittest.TestCase):
    """W006: Null comparison suggestion."""

    def test_eq_null(self):
        diags = get_diagnostics('let x = 42\nif x == null { show "empty" }')
        info = [d for d in diags if d.code == "W006"]
        self.assertEqual(len(info), 1)

    def test_neq_null(self):
        diags = get_diagnostics('let x = 42\nif x != null { show "exists" }')
        info = [d for d in diags if d.code == "W006"]
        self.assertEqual(len(info), 1)


class TestLinterUnreachableCode(unittest.TestCase):
    """W007: Unreachable code."""

    def test_code_after_return(self):
        diags = get_diagnostics('fn foo() {\n  return 1\n  show "unreachable"\n}\nfoo()')
        codes = [d.code for d in diags]
        self.assertIn("W007", codes)

    def test_no_unreachable(self):
        diags = get_diagnostics('fn foo() {\n  let x = 1\n  return x\n}\nfoo()')
        w007 = [d for d in diags if d.code == "W007"]
        self.assertEqual(len(w007), 0)


class TestLinterNoFalsePositives(unittest.TestCase):
    """Ensure clean code doesn't trigger warnings."""

    def test_clean_program(self):
        source = '''
fn add(a, b) {
    return a + b
}

let result = add(3, 4)
show result
'''
        diags = get_diagnostics(source)
        # Should have no errors or warnings (only info at most)
        serious = [d for d in diags if d.severity in ("error", "warning")]
        self.assertEqual(len(serious), 0)


if __name__ == "__main__":
    unittest.main()
