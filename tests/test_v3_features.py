"""Tests for Clarity v0.3.0 features — Batches 1, 2, 3."""

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


# ── Batch 1: Lambda Shorthand ────────────────────────────

def test_lambda_single_param():
    interp = run('let double = x => x * 2\nshow double(5)')
    assert interp.output == ["10"], f"Expected ['10'], got {interp.output}"

def test_lambda_in_pipe():
    interp = run('let nums = [1, 2, 3]\nshow map(nums, x => x * 10)')
    assert interp.output == ["[10, 20, 30]"], f"Got {interp.output}"

def test_lambda_multi_param():
    interp = run('let add = (a, b) => a + b\nshow add(3, 7)')
    assert interp.output == ["10"], f"Got {interp.output}"

def test_lambda_no_param():
    interp = run('let greet = () => "hello"\nshow greet()')
    assert interp.output == ["hello"], f"Got {interp.output}"

def test_lambda_with_block():
    interp = run("""
let compute = (x, y) => {
    let sum = x + y
    return sum * 2
}
show compute(3, 4)
""")
    assert interp.output == ["14"], f"Got {interp.output}"

def test_lambda_nested():
    interp = run("""
let make_adder = x => (y => x + y)
let add5 = make_adder(5)
show add5(3)
""")
    assert interp.output == ["8"], f"Got {interp.output}"


# ── Batch 1: Multi-Assignment ────────────────────────────

def test_multi_assign_swap():
    interp = run("""
mut a = 1
mut b = 2
a, b = b, a
show a, b
""")
    assert interp.output == ["2 1"], f"Got {interp.output}"

def test_multi_assign_three():
    interp = run("""
mut x = 10
mut y = 20
mut z = 30
x, y, z = z, x, y
show x, y, z
""")
    assert interp.output == ["30 10 20"], f"Got {interp.output}"


# ── Batch 1: Map Comprehensions ──────────────────────────

def test_map_comprehension_basic():
    result = eval_expr('{str(x): x * x for x in [1, 2, 3]}')
    assert result == {"1": 1, "2": 4, "3": 9}, f"Got {result}"

def test_map_comprehension_with_filter():
    result = eval_expr('{str(x): x for x in [1, 2, 3, 4, 5] if x > 2}')
    assert result == {"3": 3, "4": 4, "5": 5}, f"Got {result}"

def test_map_comprehension_from_entries():
    interp = run("""
let names = ["alice", "bob", "charlie"]
let result = {n: len(n) for n in names}
show result
""")
    assert interp.output == ["{alice: 5, bob: 3, charlie: 7}"], f"Got {interp.output}"


# ── Batch 2: Enums ───────────────────────────────────────

def test_enum_basic():
    interp = run("""
enum Color {
    Red,
    Green,
    Blue
}
show Color.Red
show Color.Green
show Color.Blue
""")
    assert interp.output == ["0", "1", "2"], f"Got {interp.output}"

def test_enum_with_values():
    interp = run("""
enum Status {
    Ok = 200,
    NotFound = 404,
    Error = 500
}
show Status.Ok
show Status.NotFound
show Status.Error
""")
    assert interp.output == ["200", "404", "500"], f"Got {interp.output}"

def test_enum_names_values():
    interp = run("""
enum Direction { North, South, East, West }
show Direction.names()
show Direction.values()
""")
    assert interp.output[0] == '["North", "South", "East", "West"]', f"Got {interp.output}"
    assert interp.output[1] == "[0, 1, 2, 3]", f"Got {interp.output}"

def test_enum_has():
    interp = run("""
enum Color { Red, Green, Blue }
show Color.has("Red")
show Color.has("Yellow")
""")
    assert interp.output == ["true", "false"], f"Got {interp.output}"

def test_enum_match():
    interp = run("""
enum Status { Ok = 200, NotFound = 404, Error = 500 }
let code = Status.NotFound
match code {
    when 200 { show "success" }
    when 404 { show "not found" }
    when 500 { show "error" }
}
""")
    assert interp.output == ["not found"], f"Got {interp.output}"


# ── Batch 2: Decorators ─────────────────────────────────

def test_decorator_basic():
    interp = run("""
fn double_result(func) {
    return fn(...args) {
        let result = func(...args)
        return result * 2
    }
}

@double_result
fn add(a, b) {
    return a + b
}

show add(3, 4)
""")
    assert interp.output == ["14"], f"Got {interp.output}"

def test_decorator_logging():
    interp = run("""
fn logger(func) {
    return fn(...args) {
        show "calling function"
        let result = func(...args)
        show "done"
        return result
    }
}

@logger
fn greet(name) {
    show "hello " + name
    return true
}

greet("world")
""")
    assert interp.output == ["calling function", "hello world", "done"], f"Got {interp.output}"


# ── Batch 2: Stack Traces ───────────────────────────────

def test_stack_trace_exists():
    """Stack trace is maintained during nested calls."""
    interp = run("""
fn outer() {
    return inner()
}
fn inner() {
    return 42
}
show outer()
""")
    assert interp.output == ["42"], f"Got {interp.output}"


# ── Batch 3: Async/Await ────────────────────────────────

def test_async_basic():
    interp = run("""
async fn compute(x) {
    return x * 2
}
let result = await compute(21)
show result
""")
    assert interp.output == ["42"], f"Got {interp.output}"

def test_async_multiple():
    interp = run("""
async fn slow_add(a, b) {
    return a + b
}
let f1 = slow_add(10, 20)
let f2 = slow_add(30, 40)
show await f1
show await f2
""")
    assert interp.output == ["30", "70"], f"Got {interp.output}"


# ── Batch 3: Generators ─────────────────────────────────

def test_generator_basic():
    interp = run("""
fn counter(n) {
    mut i = 0
    while i < n {
        yield i
        i += 1
    }
}
let nums = counter(4)
show nums
""")
    assert interp.output == ["[0, 1, 2, 3]"], f"Got {interp.output}"

def test_generator_with_filter():
    interp = run("""
fn evens(n) {
    mut i = 0
    while i < n {
        if i % 2 == 0 {
            yield i
        }
        i += 1
    }
}
let result = evens(10)
show result
""")
    assert interp.output == ["[0, 2, 4, 6, 8]"], f"Got {interp.output}"

def test_generator_pipe():
    interp = run("""
fn range_gen(start, stop) {
    mut i = start
    while i < stop {
        yield i
        i += 1
    }
}
let result = range_gen(1, 6) |> map(x => x * x)
show result
""")
    assert interp.output == ["[1, 4, 9, 16, 25]"], f"Got {interp.output}"


# ── Combined Features ────────────────────────────────────

def test_lambda_with_map_comprehension():
    interp = run("""
let transform = x => x ** 2
let result = {str(x): transform(x) for x in [1, 2, 3, 4]}
show result
""")
    assert interp.output == ['{1: 1, 2: 4, 3: 9, 4: 16}'], f"Got {interp.output}"

def test_enum_with_class():
    interp = run("""
enum Shape { Circle, Square, Triangle }

class Drawable {
    fn init(shape) {
        this.shape = shape
    }
    fn describe() {
        match this.shape {
            when 0 { return "circle" }
            when 1 { return "square" }
            when 2 { return "triangle" }
        }
    }
}

let d = Drawable(Shape.Circle)
show d.describe()
""")
    assert interp.output == ["circle"], f"Got {interp.output}"

def test_lambda_pipe_chain():
    interp = run("""
let nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
let result = nums
    |> filter(x => x % 2 == 0)
    |> map(x => x * 3)
show result
""")
    assert interp.output == ["[6, 12, 18, 24, 30]"], f"Got {interp.output}"


# ── Fat Arrow Token ──────────────────────────────────────

def test_fat_arrow_lexer():
    from clarity.tokens import TokenType
    tokens = tokenize("x => x + 1")
    types = [t.type for t in tokens if t.type != TokenType.EOF]
    assert TokenType.FAT_ARROW in types, f"FAT_ARROW not in {types}"


# ── Run all tests ────────────────────────────────────────

if __name__ == "__main__":
    tests = [(name, fn) for name, fn in globals().items() if name.startswith("test_")]
    print("v0.3.0 Feature tests:")
    passed = 0
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  [pass] {name.replace('test_', '')}")
            passed += 1
        except Exception as e:
            print(f"  [FAIL] {name.replace('test_', '')}: {e}")
            failed += 1

    if failed:
        print(f"\n{passed} passed, {failed} FAILED")
        sys.exit(1)
    else:
        print(f"All {passed} v0.3.0 feature tests passed!")
