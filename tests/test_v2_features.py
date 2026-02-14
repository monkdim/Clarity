"""Tests for Clarity v0.2.0 features."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clarity.lexer import tokenize
from clarity.parser import parse
from clarity.interpreter import Interpreter


def run(source):
    """Run Clarity code and return the interpreter."""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    interp = Interpreter()
    interp.run(tree)
    return interp


def eval_expr(source):
    """Run code and return the last expression value."""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    interp = Interpreter()
    return interp.run(tree)


# ── Classes ──────────────────────────────────────────────

def test_class_basic():
    interp = run('''
class Dog {
    fn init(name, breed) {
        this.name = name
        this.breed = breed
    }
    fn speak() {
        return this.name + " says woof!"
    }
}
let d = Dog("Rex", "Husky")
show d.name
show d.speak()
''')
    assert interp.output == ["Rex", "Rex says woof!"]
    print("  [pass] class basic")


def test_class_inheritance():
    interp = run('''
class Animal {
    fn init(name) {
        this.name = name
    }
    fn speak() {
        return this.name + " makes a sound"
    }
}
class Cat < Animal {
    fn speak() {
        return this.name + " says meow!"
    }
}
let c = Cat("Whiskers")
show c.speak()
show c.name
''')
    assert interp.output == ["Whiskers says meow!", "Whiskers"]
    print("  [pass] class inheritance")


def test_class_methods():
    result = eval_expr('''
class Counter {
    fn init() {
        this.count = 0
    }
    fn increment() {
        this.count += 1
    }
    fn get() {
        return this.count
    }
}
let c = Counter()
c.increment()
c.increment()
c.increment()
c.get()
''')
    assert result == 3
    print("  [pass] class methods")


# ── Throw / Finally ─────────────────────────────────────

def test_throw():
    interp = run('''
try {
    throw "something went wrong"
} catch e {
    show e
}
''')
    assert interp.output == ["something went wrong"]
    print("  [pass] throw")


def test_finally():
    interp = run('''
mut result = ""
try {
    result += "try "
    throw "oops"
} catch e {
    result += "catch "
} finally {
    result += "finally"
}
show result
''')
    assert interp.output == ["try catch finally"]
    print("  [pass] finally")


def test_finally_on_success():
    interp = run('''
mut result = ""
try {
    result += "ok "
} catch e {
    result += "catch "
} finally {
    result += "done"
}
show result
''')
    assert interp.output == ["ok done"]
    print("  [pass] finally on success")


# ── Match / Pattern Matching ────────────────────────────

def test_match():
    interp = run('''
let x = "hello"
match x {
    when "hi" {
        show "informal"
    }
    when "hello" {
        show "formal"
    }
    else {
        show "unknown"
    }
}
''')
    assert interp.output == ["formal"]
    print("  [pass] match")


def test_match_default():
    interp = run('''
let code = 404
match code {
    when 200 {
        show "ok"
    }
    when 404 {
        show "not found"
    }
    when 500 {
        show "error"
    }
}
''')
    assert interp.output == ["not found"]
    print("  [pass] match with numbers")


def test_match_else():
    interp = run('''
let val = 99
match val {
    when 1 {
        show "one"
    }
    else {
        show "other"
    }
}
''')
    assert interp.output == ["other"]
    print("  [pass] match else")


# ── Destructuring ────────────────────────────────────────

def test_list_destructure():
    interp = run('''
let [a, b, c] = [10, 20, 30]
show a
show b
show c
''')
    assert interp.output == ["10", "20", "30"]
    print("  [pass] list destructuring")


def test_map_destructure():
    interp = run('''
let {name, age} = {name: "Alice", age: 30, city: "NYC"}
show name
show age
''')
    assert interp.output == ["Alice", "30"]
    print("  [pass] map destructuring")


def test_list_destructure_rest():
    interp = run('''
let [first, ...rest] = [1, 2, 3, 4, 5]
show first
show rest
''')
    assert interp.output == ["1", "[2, 3, 4, 5]"]
    print("  [pass] list destructuring with rest")


# ── Negative Indexing ────────────────────────────────────

def test_negative_indexing():
    interp = run('''
let lst = [10, 20, 30, 40, 50]
show lst[-1]
show lst[-2]
let s = "hello"
show s[-1]
''')
    assert interp.output == ["50", "40", "o"]
    print("  [pass] negative indexing")


# ── Slicing ──────────────────────────────────────────────

def test_list_slicing():
    interp = run('''
let lst = [1, 2, 3, 4, 5]
show lst[1..3]
show lst[..2]
show lst[3..]
''')
    assert interp.output == ["[2, 3]", "[1, 2]", "[4, 5]"]
    print("  [pass] list slicing")


def test_string_slicing():
    interp = run('''
let s = "hello world"
show s[0..5]
show s[6..]
''')
    assert interp.output == ["hello", "world"]
    print("  [pass] string slicing")


# ── Null Coalescing (??) ─────────────────────────────────

def test_null_coalescing():
    interp = run('''
let a = null
let b = a ?? "default"
show b
let c = 42
let d = c ?? "nope"
show d
''')
    assert interp.output == ["default", "42"]
    print("  [pass] null coalescing (??)")


# ── Optional Chaining (?.) ───────────────────────────────

def test_optional_chaining():
    interp = run('''
let m = {name: "Alice"}
show m?.name
let n = null
show n?.name
''')
    assert interp.output == ["Alice", "null"]
    print("  [pass] optional chaining (?.)")


# ── Spread Operator ──────────────────────────────────────

def test_spread_in_lists():
    interp = run('''
let a = [1, 2]
let b = [0, ...a, 3]
show b
''')
    assert interp.output == ["[0, 1, 2, 3]"]
    print("  [pass] spread in lists")


def test_spread_in_maps():
    interp = run('''
let base = {x: 1, y: 2}
let extended = {...base, z: 3}
show extended
''')
    # Map display order may vary, check individual keys
    result = eval_expr('''
let base = {x: 1, y: 2}
let extended = {...base, z: 3}
extended
''')
    assert result == {"x": 1, "y": 2, "z": 3}
    print("  [pass] spread in maps")


def test_spread_in_args():
    interp = run('''
fn add(a, b, c) {
    return a + b + c
}
let nums = [1, 2, 3]
show add(...nums)
''')
    assert interp.output == ["6"]
    print("  [pass] spread in function args")


# ── Rest Params ──────────────────────────────────────────

def test_rest_params():
    interp = run('''
fn sum_all(first, ...rest) {
    mut total = first
    for n in rest {
        total += n
    }
    return total
}
show sum_all(1, 2, 3, 4)
''')
    assert interp.output == ["10"]
    print("  [pass] rest params")


# ── Bitwise Operators ────────────────────────────────────

def test_bitwise_and():
    result = eval_expr('12 & 10')
    assert result == 8
    print("  [pass] bitwise AND")


def test_bitwise_or():
    result = eval_expr('12 | 3')
    assert result == 15
    print("  [pass] bitwise OR")


def test_bitwise_xor():
    result = eval_expr('12 ^ 10')
    assert result == 6
    print("  [pass] bitwise XOR")


def test_bitwise_not():
    result = eval_expr('~0')
    assert result == -1
    print("  [pass] bitwise NOT")


def test_left_shift():
    result = eval_expr('1 << 4')
    assert result == 16
    print("  [pass] left shift")


def test_right_shift():
    result = eval_expr('16 >> 2')
    assert result == 4
    print("  [pass] right shift")


# ── List Comprehensions ──────────────────────────────────

def test_list_comprehension():
    interp = run('''
let squares = [x * x for x in 0..5]
show squares
''')
    assert interp.output == ["[0, 1, 4, 9, 16]"]
    print("  [pass] list comprehension")


def test_list_comprehension_with_filter():
    interp = run('''
let evens = [x for x in 0..10 if x % 2 == 0]
show evens
''')
    assert interp.output == ["[0, 2, 4, 6, 8]"]
    print("  [pass] list comprehension with filter")


# ── If Expression (Ternary) ──────────────────────────────

def test_if_expression():
    interp = run('''
let x = 10
let label = if x > 5 { "big" } else { "small" }
show label
''')
    assert interp.output == ["big"]
    print("  [pass] if expression (ternary)")


# ── Set Builtin ──────────────────────────────────────────

def test_set_basic():
    interp = run('''
let s = set([1, 2, 3, 2, 1])
show s.length()
''')
    assert interp.output == ["3"]
    print("  [pass] set builtin")


def test_set_methods():
    interp = run('''
let s = set([1, 2, 3])
s.add(4)
show s.has(4)
show s.has(5)
s.remove(1)
show s.has(1)
''')
    assert interp.output == ["true", "false", "false"]
    print("  [pass] set methods")


# ── Regex Module ─────────────────────────────────────────

def test_regex_module():
    interp = run('''
import regex
show regex.match("^hello", "hello world")
show regex.search("\\\\d+", "abc123def")
show regex.find("\\\\d+", "a1b2c3")
show regex.replace("\\\\d", "#", "a1b2c3")
''')
    assert interp.output == ["true", "true", '["1", "2", "3"]', "a#b#c#"]
    print("  [pass] regex module")


# ── Import Module ────────────────────────────────────────

def test_import_math():
    result = eval_expr('''
import math
math.pi
''')
    import math
    assert result == math.pi
    print("  [pass] import math module")


def test_from_import():
    result = eval_expr('''
from math import sqrt
sqrt(16)
''')
    # Our math.sqrt returns float
    assert result == 4.0
    print("  [pass] from...import")


# ── Compound Features ────────────────────────────────────

def test_class_with_methods_and_match():
    interp = run('''
class Shape {
    fn init(kind) {
        this.kind = kind
    }
}
let s = Shape("circle")
match s.kind {
    when "square" {
        show "its a square"
    }
    when "circle" {
        show "its a circle"
    }
    else {
        show "unknown shape"
    }
}
''')
    assert interp.output == ["its a circle"]
    print("  [pass] class + match combined")


def test_comprehension_with_destructure():
    interp = run('''
let nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
let [first, second, ...rest] = nums
show first
show second
show len(rest)
let big_evens = [x for x in rest if x % 2 == 0]
show big_evens
''')
    assert interp.output == ["1", "2", "8", "[4, 6, 8, 10]"]
    print("  [pass] destructure + comprehension combined")


def test_pipe_with_new_features():
    interp = run('''
let data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
let result = data |> filter(fn(x) { return x % 2 == 0 }) |> map(fn(x) { return x * 10 })
show result
''')
    assert interp.output == ["[20, 40, 60, 80, 100]"]
    print("  [pass] pipe with filter/map")


# ── Run all ──────────────────────────────────────────────

if __name__ == "__main__":
    print("v0.2.0 Feature tests:")

    # Classes
    test_class_basic()
    test_class_inheritance()
    test_class_methods()

    # Throw / Finally
    test_throw()
    test_finally()
    test_finally_on_success()

    # Match
    test_match()
    test_match_default()
    test_match_else()

    # Destructuring
    test_list_destructure()
    test_map_destructure()
    test_list_destructure_rest()

    # Negative indexing
    test_negative_indexing()

    # Slicing
    test_list_slicing()
    test_string_slicing()

    # Null coalescing
    test_null_coalescing()

    # Optional chaining
    test_optional_chaining()

    # Spread
    test_spread_in_lists()
    test_spread_in_maps()
    test_spread_in_args()

    # Rest params
    test_rest_params()

    # Bitwise
    test_bitwise_and()
    test_bitwise_or()
    test_bitwise_xor()
    test_bitwise_not()
    test_left_shift()
    test_right_shift()

    # List comprehensions
    test_list_comprehension()
    test_list_comprehension_with_filter()

    # If expression
    test_if_expression()

    # Set
    test_set_basic()
    test_set_methods()

    # Regex
    test_regex_module()

    # Import
    test_import_math()
    test_from_import()

    # Combined features
    test_class_with_methods_and_match()
    test_comprehension_with_destructure()
    test_pipe_with_new_features()

    print("All v0.2.0 feature tests passed!")
