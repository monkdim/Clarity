#!/usr/bin/env python3
"""Native transpiler test suite.

Transpiles small Clarity programs to JavaScript, runs them through Bun/Node,
and verifies output matches expected values.

Usage:
    python tests/test_native.py              # Run all native tests
    python tests/test_native.py -v           # Verbose output
    python tests/test_native.py -k closures  # Run tests matching 'closures'
"""

import os
import sys
import subprocess
import tempfile
import textwrap

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from native.transpile import transpile_source

DIST_DIR = os.path.join(PROJECT_ROOT, 'native', 'dist')
RUNTIME_PATH = os.path.join(DIST_DIR, 'runtime.js')

# Detect JS runtime
JS_RUNTIME = 'bun'
try:
    subprocess.run(['bun', '--version'], capture_output=True, check=True)
except (FileNotFoundError, subprocess.CalledProcessError):
    JS_RUNTIME = 'node'

# Runtime import header for test files
RUNTIME_HEADER = (
    '// Native test — auto-generated\n'
    'import { show as $show, ask as $ask, read, write, append, exists, lines,\n'
    '  $int, $float, str, $bool, type, len, push, pop, sort, reverse, range as $range,\n'
    '  map, filter, reduce, each, find, every, some, flat, zip, unique,\n'
    '  keys, values, entries, merge, has, split, $join, replace, trim,\n'
    '  upper, lower, contains, starts, ends, chars, $repeat,\n'
    '  pad_left, pad_right, char_at, char_code, from_char_code, index_of, substring,\n'
    '  is_digit, is_alpha, is_alnum, is_space,\n'
    '  abs, round, floor, ceil, $min, $max, sum, random, pow,\n'
    '  pi, e, sqrt, sin, cos, tan, log,\n'
    '  exec, exec_full, exit, sleep, time, env, args, cwd,\n'
    '  json_parse, json_string, hash, encode64, decode64,\n'
    '  fetch, serve, compose, tap, $set, error as $error,\n'
    '  display, repr, truthy as $truthy, ClarityEnum as $ClarityEnum,\n'
    '  ClarityInstance as $ClarityInstance,\n'
    '  formatClarityError, clarityMain\n'
    '} from "' + RUNTIME_PATH + '";\n\n'
)


class NativeTestRunner:
    """Runs Clarity programs transpiled to JS and checks expected output."""

    def __init__(self, verbose=False, filter_pattern=None):
        self.verbose = verbose
        self.filter_pattern = filter_pattern
        self.passed = 0
        self.failed = 0
        self.errors = 0
        self.failures = []

    def run_js(self, source):
        """Transpile Clarity source to JS, run through Bun/Node."""
        js_code, _imports = transpile_source(source, '<test>')
        full_js = RUNTIME_HEADER + js_code

        with tempfile.NamedTemporaryFile(
            suffix='.mjs', mode='w', delete=False, dir=DIST_DIR
        ) as f:
            f.write(full_js)
            tmp_path = f.name

        try:
            result = subprocess.run(
                [JS_RUNTIME, tmp_path],
                capture_output=True, text=True, timeout=10,
                cwd=DIST_DIR
            )
            output = result.stdout
            if result.returncode != 0:
                stderr = result.stderr.strip()
                if self.verbose and stderr:
                    lines = stderr.split('\n')
                    # Show just the error message, not full stack
                    for line in lines:
                        if 'Error' in line or 'error' in line:
                            return None, line.strip()
                return None, stderr[:300] if stderr else f'exit code {result.returncode}'
            return output, None
        except subprocess.TimeoutExpired:
            return None, 'TIMEOUT'
        finally:
            os.unlink(tmp_path)

    def test(self, name, source, expected):
        """Run a single test case."""
        if self.filter_pattern and self.filter_pattern not in name:
            return

        source = textwrap.dedent(source).strip()
        expected = textwrap.dedent(expected).strip()

        js_output, js_error = self.run_js(source)

        if js_error:
            self.errors += 1
            self.failures.append((name, f'JS error: {js_error}'))
            print(f'  ERROR {name}')
            if self.verbose:
                print(f'    {js_error}')
            return

        actual = js_output.strip()
        if actual == expected:
            self.passed += 1
            if self.verbose:
                print(f'  PASS  {name}')
        else:
            self.failed += 1
            self.failures.append((name, f'Expected: {expected!r}\nGot:      {actual!r}'))
            print(f'  FAIL  {name}')
            if self.verbose:
                print(f'    Expected: {expected!r}')
                print(f'    Got:      {actual!r}')

    def summary(self):
        total = self.passed + self.failed + self.errors
        print()
        if self.failed == 0 and self.errors == 0:
            print(f'  \033[32m{self.passed} passed\033[0m / {total} total')
        else:
            print(f'  {self.passed} passed, \033[31m{self.failed} failed\033[0m, {self.errors} errors / {total} total')
        if self.failures:
            print()
            for name, detail in self.failures[:20]:
                print(f'  FAIL: {name}')
                for line in detail.split('\n')[:3]:
                    print(f'    {line}')
            print()
        return self.failed + self.errors


# ── Test Cases ────────────────────────────────────────────


def test_language_core(t):
    """Variables, arithmetic, functions, control flow."""

    t.test('variables - let', '''
        let x = 42
        show x
    ''', '42')

    t.test('variables - mut', '''
        mut x = 10
        x = 20
        show x
    ''', '20')

    t.test('arithmetic', '''
        show 2 + 3
        show 10 - 4
        show 3 * 7
    ''', '5\n6\n21')

    t.test('arithmetic - power', '''
        show 2 ** 10
    ''', '1024')

    t.test('arithmetic - modulo', '''
        show 17 % 5
    ''', '2')

    t.test('string concat', '''
        let name = "world"
        show "hello " + name
    ''', 'hello world')

    t.test('boolean logic', '''
        show true and false
        show true or false
        show not true
    ''', 'false\ntrue\nfalse')

    t.test('comparison', '''
        show 5 > 3
        show 5 < 3
        show 5 == 5
        show 5 != 3
    ''', 'true\nfalse\ntrue\ntrue')

    t.test('null coalescing', '''
        let x = null
        show x ?? "default"
    ''', 'default')

    t.test('if-else', '''
        let x = 10
        if x > 5 {
            show "big"
        } else {
            show "small"
        }
    ''', 'big')

    t.test('if-elif-else', '''
        let x = 5
        if x > 10 {
            show "big"
        } elif x > 3 {
            show "medium"
        } else {
            show "small"
        }
    ''', 'medium')

    t.test('while loop', '''
        mut i = 0
        while i < 5 {
            i += 1
        }
        show i
    ''', '5')

    t.test('for loop', '''
        mut total = 0
        for x in [1, 2, 3, 4, 5] {
            total += x
        }
        show total
    ''', '15')

    t.test('break', '''
        mut i = 0
        while true {
            if i >= 3 { break }
            i += 1
        }
        show i
    ''', '3')

    t.test('continue', '''
        mut total = 0
        for i in [1, 2, 3, 4, 5] {
            if i == 3 { continue }
            total += i
        }
        show total
    ''', '12')


def test_functions(t):
    """Functions, closures, recursion."""

    t.test('function - basic', '''
        fn add(a, b) {
            return a + b
        }
        show add(3, 4)
    ''', '7')

    t.test('function - recursion (fibonacci)', '''
        fn fib(n) {
            if n <= 1 { return n }
            return fib(n - 1) + fib(n - 2)
        }
        show fib(10)
    ''', '55')

    t.test('function - closure', '''
        fn make_counter() {
            mut count = 0
            return fn() {
                count += 1
                return count
            }
        }
        let counter = make_counter()
        show counter()
        show counter()
        show counter()
    ''', '1\n2\n3')

    t.test('function - higher order', '''
        fn apply(f, x) {
            return f(x)
        }
        fn double(x) { return x * 2 }
        show apply(double, 21)
    ''', '42')

    t.test('function - nested closures', '''
        fn adder(a) {
            return fn(b) {
                return fn(c) {
                    return a + b + c
                }
            }
        }
        show adder(1)(2)(3)
    ''', '6')

    t.test('function - mutual recursion', '''
        fn is_even(n) {
            if n == 0 { return true }
            return is_odd(n - 1)
        }
        fn is_odd(n) {
            if n == 0 { return false }
            return is_even(n - 1)
        }
        show is_even(10)
        show is_odd(7)
    ''', 'true\ntrue')

    t.test('ternary expression', '''
        let x = 10
        let result = if x > 5 { "big" } else { "small" }
        show result
    ''', 'big')


def test_classes(t):
    """Classes and methods."""

    t.test('class - basic', '''
        class Dog {
            fn init(name) {
                this.name = name
            }
            fn speak() {
                return this.name + " says woof"
            }
        }
        let d = Dog("Rex")
        show d.speak()
    ''', 'Rex says woof')

    t.test('class - properties', '''
        class Point {
            fn init(x, y) {
                this.x = x
                this.y = y
            }
            fn dist() {
                return sqrt(this.x ** 2 + this.y ** 2)
            }
        }
        let p = Point(3, 4)
        show p.x
        show p.y
        show p.dist()
    ''', '3\n4\n5')

    t.test('class - multiple instances', '''
        class Counter {
            fn init() {
                this.n = 0
            }
            fn inc() {
                this.n += 1
            }
            fn val() {
                return this.n
            }
        }
        let a = Counter()
        let b = Counter()
        a.inc()
        a.inc()
        b.inc()
        show a.val()
        show b.val()
    ''', '2\n1')


def test_try_catch(t):
    """Error handling."""

    t.test('try-catch - basic', '''
        try {
            throw "oops"
        } catch e {
            show e
        }
    ''', 'oops')

    t.test('try-catch - nested', '''
        try {
            try {
                throw "inner"
            } catch e {
                show "caught: " + e
                throw "outer"
            }
        } catch e {
            show "caught: " + e
        }
    ''', 'caught: inner\ncaught: outer')


def test_collections(t):
    """Lists and maps."""

    t.test('list - basics', '''
        let lst = [10, 20, 30]
        show lst[0]
        show lst[2]
        show len(lst)
    ''', '10\n30\n3')

    t.test('list - push/pop', '''
        mut lst = [1, 2, 3]
        push(lst, 4)
        show len(lst)
        let last = pop(lst)
        show last
    ''', '4\n4')

    t.test('list - map', '''
        let nums = [1, 2, 3, 4]
        let doubled = map(nums, fn(x) { return x * 2 })
        show doubled
    ''', '[2, 4, 6, 8]')

    t.test('list - filter', '''
        let nums = [1, 2, 3, 4, 5, 6]
        let evens = filter(nums, fn(x) { return x % 2 == 0 })
        show evens
    ''', '[2, 4, 6]')

    t.test('list - reduce', '''
        let nums = [1, 2, 3, 4, 5]
        let total = reduce(nums, fn(acc, x) { return acc + x }, 0)
        show total
    ''', '15')

    t.test('list - sort', '''
        let nums = [3, 1, 4, 1, 5, 9]
        show sort(nums)
    ''', '[1, 1, 3, 4, 5, 9]')

    t.test('list - unique', '''
        let nums = [1, 2, 2, 3, 3, 3]
        show unique(nums)
    ''', '[1, 2, 3]')

    t.test('list - flat', '''
        let nested = [[1, 2], [3, 4], [5]]
        show flat(nested)
    ''', '[1, 2, 3, 4, 5]')

    t.test('list - find', '''
        let nums = [1, 2, 3, 4, 5]
        let found = find(nums, fn(x) { return x > 3 })
        show found
    ''', '4')

    t.test('list - every/some', '''
        let nums = [2, 4, 6]
        show every(nums, fn(x) { return x % 2 == 0 })
        show some(nums, fn(x) { return x > 5 })
    ''', 'true\ntrue')

    t.test('list - zip', '''
        let a = [1, 2, 3]
        let b = ["a", "b", "c"]
        show zip(a, b)
    ''', '[[1, a], [2, b], [3, c]]')

    t.test('map - basics', '''
        let m = {name: "Alice", age: 30}
        show m["name"]
        show m["age"]
    ''', 'Alice\n30')

    t.test('map - keys/values', '''
        let m = {x: 1, y: 2, z: 3}
        show sort(keys(m))
    ''', '[x, y, z]')

    t.test('map - merge', '''
        let a = {x: 1, y: 2}
        let b = {y: 3, z: 4}
        let c = merge(a, b)
        show c["y"]
        show c["z"]
    ''', '3\n4')

    t.test('map - has', '''
        let m = {name: "Bob"}
        show has(m, "name")
        show has(m, "age")
    ''', 'true\nfalse')


def test_strings(t):
    """String operations."""

    t.test('string - len', '''
        show len("hello")
    ''', '5')

    t.test('string - upper/lower', '''
        show upper("hello")
        show lower("HELLO")
    ''', 'HELLO\nhello')

    t.test('string - trim', '''
        show trim("  hello  ")
    ''', 'hello')

    t.test('string - split/join', '''
        let parts = split("a,b,c", ",")
        show parts
        show join(parts, "-")
    ''', '[a, b, c]\na-b-c')

    t.test('string - contains/starts/ends', '''
        show contains("hello world", "world")
        show starts("hello", "hel")
        show ends("hello", "llo")
    ''', 'true\ntrue\ntrue')

    t.test('string - replace', '''
        show replace("hello world", "world", "clarity")
    ''', 'hello clarity')

    t.test('string - pad', '''
        show pad_left("42", 5, "0")
        show pad_right("hi", 5, ".")
    ''', '00042\nhi...')

    t.test('string - char_at/char_code', '''
        show char_at("hello", 1)
        show char_code("A")
        show from_char_code(65)
    ''', 'e\n65\nA')

    t.test('string - index_of', '''
        show index_of("hello world", "world")
        show index_of("hello", "xyz")
    ''', '6\n-1')

    t.test('string - substring', '''
        show substring("hello world", 6)
        show substring("hello world", 0, 5)
    ''', 'world\nhello')

    t.test('string - is_digit/is_alpha', '''
        show is_digit("123")
        show is_digit("12a")
        show is_alpha("abc")
        show is_alpha("ab3")
    ''', 'true\nfalse\ntrue\nfalse')


def test_math(t):
    """Math operations."""

    t.test('math - abs', '''
        show abs(-5)
        show abs(5)
    ''', '5\n5')

    t.test('math - round/floor/ceil', '''
        show round(3.7)
        show floor(3.7)
        show ceil(3.2)
    ''', '4\n3\n4')

    t.test('math - min/max', '''
        show min(3, 7)
        show max(3, 7)
    ''', '3\n7')

    t.test('math - sum', '''
        show sum([1, 2, 3, 4, 5])
    ''', '15')

    t.test('math - sqrt', '''
        show sqrt(16)
    ''', '4')

    t.test('math - pow', '''
        show pow(2, 10)
    ''', '1024')


def test_advanced(t):
    """Comprehensions, enums, pipes, destructuring, spread."""

    t.test('list comprehension', '''
        let squares = [x * x for x in [1, 2, 3, 4, 5]]
        show squares
    ''', '[1, 4, 9, 16, 25]')

    t.test('list comprehension with filter', '''
        let evens = [x for x in [1, 2, 3, 4, 5, 6] if x % 2 == 0]
        show evens
    ''', '[2, 4, 6]')

    t.test('pipe operator', '''
        let result = [1, 2, 3, 4, 5] |> sum
        show result
    ''', '15')

    t.test('enum', '''
        enum Color { RED, GREEN, BLUE }
        show Color.RED
        show Color.BLUE
    ''', '0\n2')

    t.test('destructure list', '''
        let [a, b, c] = [1, 2, 3]
        show a
        show b
        show c
    ''', '1\n2\n3')

    t.test('destructure map', '''
        let {name, age} = {name: "Alice", age: 30}
        show name
        show age
    ''', 'Alice\n30')

    t.test('spread in list', '''
        let a = [1, 2, 3]
        let b = [0, ...a, 4]
        show b
    ''', '[0, 1, 2, 3, 4]')

    t.test('range', '''
        mut total = 0
        for i in 1..6 {
            total += i
        }
        show total
    ''', '15')


def test_json(t):
    """JSON operations."""

    t.test('json - stringify and parse', '''
        let data = {x: 1, y: 2}
        let s = json_string(data)
        let parsed = json_parse(s)
        show parsed["x"]
        show parsed["y"]
    ''', '1\n2')


def test_encoding(t):
    """Base64 and hash."""

    t.test('base64 - roundtrip', '''
        let encoded = encode64("Hello, World!")
        let decoded = decode64(encoded)
        show decoded
    ''', 'Hello, World!')

    t.test('hash - sha256 length', '''
        let h = hash("hello", "sha256")
        show len(h)
    ''', '64')


def test_integration(t):
    """More complex programs combining multiple features."""

    t.test('fizzbuzz', '''
        fn fizzbuzz(n) {
            mut result = []
            for i in 1..16 {
                if i % 15 == 0 {
                    push(result, "FizzBuzz")
                } elif i % 3 == 0 {
                    push(result, "Fizz")
                } elif i % 5 == 0 {
                    push(result, "Buzz")
                } else {
                    push(result, str(i))
                }
            }
            return result
        }
        show join(fizzbuzz(15), " ")
    ''', '1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz')

    t.test('factorial', '''
        fn factorial(n) {
            if n <= 1 { return 1 }
            return n * factorial(n - 1)
        }
        show factorial(10)
    ''', '3628800')

    t.test('accumulate with closure', '''
        fn make_acc() {
            mut total = 0
            return fn(n) {
                total += n
                return total
            }
        }
        let acc = make_acc()
        show acc(5)
        show acc(3)
        show acc(2)
    ''', '5\n8\n10')

    t.test('class with list', '''
        class Stack {
            fn init() {
                this.items = []
            }
            fn push(item) {
                push(this.items, item)
            }
            fn pop() {
                return pop(this.items)
            }
            fn size() {
                return len(this.items)
            }
        }
        let s = Stack()
        s.push(10)
        s.push(20)
        s.push(30)
        show s.size()
        show s.pop()
        show s.size()
    ''', '3\n30\n2')

    t.test('map comprehension-like with reduce', '''
        let words = ["hello", "world", "clarity"]
        let lengths = map(words, fn(w) { return len(w) })
        let total = reduce(lengths, fn(a, b) { return a + b }, 0)
        show lengths
        show total
    ''', '[5, 5, 7]\n17')

    t.test('chained operations', '''
        let result = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        let evens = filter(result, fn(x) { return x % 2 == 0 })
        let doubled = map(evens, fn(x) { return x * 2 })
        show doubled
        show sum(doubled)
    ''', '[4, 8, 12, 16, 20]\n60')


# ── Main ──────────────────────────────────────────────────

def main():
    import argparse
    ap = argparse.ArgumentParser(description='Native transpiler test suite')
    ap.add_argument('-v', '--verbose', action='store_true')
    ap.add_argument('-k', '--filter', help='Only run tests matching pattern')
    args = ap.parse_args()

    # Ensure bundle exists
    if not os.path.exists(RUNTIME_PATH):
        print('  Building native bundle first...')
        subprocess.run(
            [sys.executable, 'native/transpile.py', '--bundle'],
            cwd=PROJECT_ROOT, capture_output=True
        )

    t = NativeTestRunner(verbose=args.verbose, filter_pattern=args.filter)

    print()
    print(f'  Clarity Native Test Suite (runtime: {JS_RUNTIME})')
    print()

    print('  -- Language Core --')
    test_language_core(t)

    print('  -- Functions --')
    test_functions(t)

    print('  -- Classes --')
    test_classes(t)

    print('  -- Try/Catch --')
    test_try_catch(t)

    print('  -- Collections --')
    test_collections(t)

    print('  -- Strings --')
    test_strings(t)

    print('  -- Math --')
    test_math(t)

    print('  -- Advanced Features --')
    test_advanced(t)

    print('  -- JSON --')
    test_json(t)

    print('  -- Encoding --')
    test_encoding(t)

    print('  -- Integration --')
    test_integration(t)

    t.summary()
    sys.exit(t.failed + t.errors)


if __name__ == '__main__':
    main()
