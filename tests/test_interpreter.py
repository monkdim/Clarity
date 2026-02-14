"""Tests for the Clarity interpreter."""

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


def test_variables():
    interp = run('let x = 42\nshow x')
    assert interp.output == ["42"]
    print("  [pass] variables")


def test_mut():
    interp = run('mut x = 1\nx = 2\nshow x')
    assert interp.output == ["2"]
    print("  [pass] mutable variables")


def test_math():
    interp = run('show 2 + 3 * 4')
    assert interp.output == ["14"]
    print("  [pass] math precedence")


def test_string_concat():
    interp = run('show "hello" + " " + "world"')
    assert interp.output == ["hello world"]
    print("  [pass] string concatenation")


def test_string_interpolation():
    interp = run('let name = "Clarity"\nshow "Hello {name}!"')
    assert interp.output == ["Hello Clarity!"]
    print("  [pass] string interpolation")


def test_function():
    interp = run('fn add(a, b) { return a + b }\nshow add(3, 4)')
    assert interp.output == ["7"]
    print("  [pass] functions")


def test_anonymous_fn():
    interp = run('let double = fn(x) { return x * 2 }\nshow double(5)')
    assert interp.output == ["10"]
    print("  [pass] anonymous functions")


def test_if_else():
    interp = run('let x = 10\nif x > 5 { show "big" } else { show "small" }')
    assert interp.output == ["big"]
    print("  [pass] if/else")


def test_elif():
    interp = run('let x = 5\nif x > 10 { show "a" } elif x > 3 { show "b" } else { show "c" }')
    assert interp.output == ["b"]
    print("  [pass] elif")


def test_for_loop():
    interp = run('for i in range(3) { show i }')
    assert interp.output == ["0", "1", "2"]
    print("  [pass] for loop")


def test_for_range():
    interp = run('for i in 1..4 { show i }')
    assert interp.output == ["1", "2", "3"]
    print("  [pass] for..range loop")


def test_while_loop():
    interp = run('mut x = 3\nwhile x > 0 { show x\n x -= 1 }')
    assert interp.output == ["3", "2", "1"]
    print("  [pass] while loop")


def test_break():
    interp = run('for i in range(10) { if i == 3 { break }\n show i }')
    assert interp.output == ["0", "1", "2"]
    print("  [pass] break")


def test_continue():
    interp = run('for i in range(5) { if i == 2 { continue }\n show i }')
    assert interp.output == ["0", "1", "3", "4"]
    print("  [pass] continue")


def test_list():
    interp = run('let x = [1, 2, 3]\nshow x\nshow x[1]\nshow len(x)')
    assert interp.output == ["[1, 2, 3]", "2", "3"]
    print("  [pass] lists")


def test_map():
    interp = run('let m = {name: "Alice"}\nshow m.name')
    assert interp.output == ["Alice"]
    print("  [pass] maps")


def test_map_assign():
    interp = run('mut m = {x: 1}\nm.y = 2\nshow m.y')
    assert interp.output == ["2"]
    print("  [pass] map assignment")


def test_pipe():
    interp = run('''
let nums = [1, 2, 3, 4, 5]
let result = nums |> filter(fn(x) { return x > 2 }) |> map(fn(x) { return x * 10 })
show result
''')
    assert interp.output == ["[30, 40, 50]"]
    print("  [pass] pipe operator")


def test_closures():
    interp = run('''
fn make_adder(n) {
    return fn(x) { return x + n }
}
let add5 = make_adder(5)
show add5(10)
''')
    assert interp.output == ["15"]
    print("  [pass] closures")


def test_recursion():
    interp = run('''
fn fact(n) {
    if n <= 1 { return 1 }
    return n * fact(n - 1)
}
show fact(5)
''')
    assert interp.output == ["120"]
    print("  [pass] recursion")


def test_try_catch():
    interp = run('''
try {
    let x = 10 / 0
} catch err {
    show "caught"
}
''')
    assert interp.output == ["caught"]
    print("  [pass] try/catch")


def test_higher_order():
    interp = run('''
let nums = [1, 2, 3, 4, 5]
let evens = filter(nums, fn(x) { return x % 2 == 0 })
show evens
''')
    assert interp.output == ["[2, 4]"]
    print("  [pass] higher-order functions")


def test_string_methods():
    interp = run('''
let s = "Hello World"
show s.upper()
show s.lower()
show s.length()
show s.contains("World")
''')
    assert interp.output == ["HELLO WORLD", "hello world", "11", "true"]
    print("  [pass] string methods")


def test_list_methods():
    interp = run('''
let x = [3, 1, 2]
show x.sort()
show x.reverse()
show x.length()
show x.contains(2)
''')
    assert interp.output == ["[1, 2, 3]", "[2, 1, 3]", "3", "true"]
    print("  [pass] list methods")


def test_builtins():
    interp = run('''
show type(42)
show type("hello")
show type([1,2])
show type(true)
show type(null)
''')
    assert interp.output == ["int", "string", "list", "bool", "null"]
    print("  [pass] type() builtin")


def test_show_multiple():
    interp = run('show "a", "b", "c"')
    assert interp.output == ["a b c"]
    print("  [pass] show multiple values")


def test_compound_assign():
    interp = run('mut x = 10\nx += 5\nshow x')
    assert interp.output == ["15"]
    print("  [pass] compound assignment")


def test_boolean_logic():
    interp = run('show true and false\nshow true or false\nshow not true')
    assert interp.output == ["false", "true", "false"]
    print("  [pass] boolean logic")


def test_comparison():
    interp = run('show 5 > 3\nshow 3 >= 3\nshow 2 < 1\nshow 2 <= 2')
    assert interp.output == ["true", "true", "false", "true"]
    print("  [pass] comparison operators")


def test_unary_minus():
    interp = run('show -5\nshow -(3 + 2)')
    assert interp.output == ["-5", "-5"]
    print("  [pass] unary minus")


def test_nested_maps():
    interp = run('''
let data = {
    user: {name: "Alice", scores: [95, 87, 92]}
}
show data.user.name
show data.user.scores[1]
''')
    assert interp.output == ["Alice", "87"]
    print("  [pass] nested maps and indexing")


if __name__ == "__main__":
    print("Interpreter tests:")
    test_variables()
    test_mut()
    test_math()
    test_string_concat()
    test_string_interpolation()
    test_function()
    test_anonymous_fn()
    test_if_else()
    test_elif()
    test_for_loop()
    test_for_range()
    test_while_loop()
    test_break()
    test_continue()
    test_list()
    test_map()
    test_map_assign()
    test_pipe()
    test_closures()
    test_recursion()
    test_try_catch()
    test_higher_order()
    test_string_methods()
    test_list_methods()
    test_builtins()
    test_show_multiple()
    test_compound_assign()
    test_boolean_logic()
    test_comparison()
    test_unary_minus()
    test_nested_maps()
    print("All interpreter tests passed!")
