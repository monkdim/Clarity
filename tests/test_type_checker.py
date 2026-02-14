"""Tests for Clarity static type checker."""

import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clarity.lexer import tokenize
from clarity.parser import parse
from clarity.type_checker import check_types, TypeChecker


def get_diagnostics(source):
    """Helper: type-check source and return diagnostics list."""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    return check_types(tree)


class TestTypeCheckerBasics(unittest.TestCase):
    """Basic type annotation checks."""

    def test_correct_int_annotation(self):
        diags = get_diagnostics('let x: int = 42')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_correct_string_annotation(self):
        diags = get_diagnostics('let s: string = "hello"')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_correct_bool_annotation(self):
        diags = get_diagnostics('let b: bool = true')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_correct_list_annotation(self):
        diags = get_diagnostics('let xs: list = [1, 2, 3]')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_correct_map_annotation(self):
        diags = get_diagnostics('let m: map = {"a": 1}')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_mismatch_int_gets_string(self):
        diags = get_diagnostics('let x: int = "hello"')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 1)
        self.assertIn("int", errors[0].message)
        self.assertIn("string", errors[0].message)

    def test_mismatch_string_gets_int(self):
        diags = get_diagnostics('let x: string = 42')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 1)

    def test_mismatch_bool_gets_string(self):
        diags = get_diagnostics('let b: bool = "true"')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 1)

    def test_any_accepts_everything(self):
        diags = get_diagnostics('let x: any = 42\nlet y: any = "hello"\nlet z: any = [1]')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_number_accepts_int_and_float(self):
        diags = get_diagnostics('let x: number = 42\nlet y: number = 3.14')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_float_accepts_int(self):
        diags = get_diagnostics('let x: float = 42')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_no_annotation_with_null(self):
        diags = get_diagnostics('let x = null')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)


class TestTypeCheckerFunctions(unittest.TestCase):
    """Function return type checks."""

    def test_correct_return_type(self):
        diags = get_diagnostics('fn add(a, b) -> int { return 42 }')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_wrong_return_type(self):
        diags = get_diagnostics('fn greet() -> int { return "hello" }')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 1)
        self.assertIn("return", errors[0].message.lower())

    def test_no_annotation_no_error(self):
        diags = get_diagnostics('fn foo() { return "anything" }')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_function_with_typed_params(self):
        diags = get_diagnostics('fn add(a: int, b: int) -> int { return 42 }')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)


class TestTypeCheckerClasses(unittest.TestCase):
    """Class and method type checks."""

    def test_class_constructor_type(self):
        source = '''
class Dog {
    fn init(name) { this.name = name }
}
let d: Dog = Dog("Rex")
'''
        diags = get_diagnostics(source)
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_class_method_no_errors(self):
        source = '''
class Math {
    fn double(x) {
        return x * 2
    }
}
let m = Math()
show m.double(5)
'''
        diags = get_diagnostics(source)
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)


class TestTypeCheckerExpressions(unittest.TestCase):
    """Expression type inference."""

    def test_arithmetic_int(self):
        diags = get_diagnostics('let x: int = 2 + 3')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_arithmetic_float(self):
        diags = get_diagnostics('let x: float = 10 / 3')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_comparison_is_bool(self):
        diags = get_diagnostics('let x: bool = 5 > 3')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_string_concat(self):
        diags = get_diagnostics('let x: string = "a" + "b"')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_builtin_return_type(self):
        diags = get_diagnostics('let n: int = len([1, 2, 3])')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_range_is_list(self):
        diags = get_diagnostics('let xs: list = 1..10')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_ask_is_string(self):
        diags = get_diagnostics('let name: string = ask("name? ")')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_comprehension_is_list(self):
        diags = get_diagnostics('let xs: list = [x * 2 for x in [1, 2, 3]]')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_if_expression_matched_types(self):
        diags = get_diagnostics('let x: int = if true { 1 } else { 2 }')
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)


class TestTypeCheckerNoFalsePositives(unittest.TestCase):
    """Ensure valid programs don't trigger errors."""

    def test_no_annotations_no_errors(self):
        source = '''
let x = 42
let s = "hello"
fn foo(a, b) { return a + b }
show foo(x, 10)
'''
        diags = get_diagnostics(source)
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)

    def test_complex_program_no_errors(self):
        source = '''
class Animal {
    fn init(name) { this.name = name }
    fn speak() { return this.name + " makes a sound" }
}

fn greet(animal) {
    show animal.speak()
}

let a = Animal("Dog")
greet(a)

for i in [1, 2, 3] {
    show i
}

let doubled = [x * 2 for x in 1..5]
'''
        diags = get_diagnostics(source)
        errors = [d for d in diags if d.severity == "error"]
        self.assertEqual(len(errors), 0)


if __name__ == "__main__":
    unittest.main()
