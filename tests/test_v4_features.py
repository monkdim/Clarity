"""Tests for Clarity v0.4.0 features:
   - Interfaces (interface + impl)
   - Type annotations (runtime checks)
   - Raw strings (r"...")
   - Bytecode compiler + VM
   - Package manager (TOML parser + init)
   - LSP server (diagnostics, hover, completion)
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from clarity.lexer import tokenize
from clarity.parser import parse
from clarity.interpreter import Interpreter

passed = 0
failed = 0


def run(source):
    tokens = tokenize(source)
    tree = parse(tokens, source)
    interp = Interpreter()
    return interp.run(tree)


def capture(source):
    tokens = tokenize(source)
    tree = parse(tokens, source)
    interp = Interpreter()
    interp.run(tree)
    return interp.output


def test(name, fn):
    global passed, failed
    try:
        fn()
        print(f"  [pass] {name}")
        passed += 1
    except Exception as e:
        print(f"  [FAIL] {name}: {e}")
        failed += 1


# ── Interfaces ──────────────────────────────────────────

def test_interface_basic():
    out = capture("""
interface Drawable {
    fn draw()
}

class Circle impl Drawable {
    fn init(r) {
        this.r = r
    }
    fn draw() {
        show "drawing circle r=" + str(this.r)
    }
}

let c = Circle(5)
c.draw()
""")
    assert out == ["drawing circle r=5"]

def test_interface_missing_method():
    try:
        run("""
interface Flyable {
    fn fly()
}

class Rock impl Flyable {
    fn init() {}
}
""")
        assert False, "Should have thrown error"
    except Exception as e:
        assert "must implement" in str(e).lower() or "fly" in str(e)

def test_interface_multiple():
    out = capture("""
interface Printable {
    fn to_string()
}
interface Sizeable {
    fn size()
}

class Box impl Printable, Sizeable {
    fn init(w, h) {
        this.w = w
        this.h = h
    }
    fn to_string() {
        return str(this.w) + "x" + str(this.h)
    }
    fn size() {
        return this.w * this.h
    }
}

let b = Box(3, 4)
show b.to_string()
show b.size()
""")
    assert out == ["3x4", "12"]

def test_interface_inherited_method():
    out = capture("""
interface Greetable {
    fn greet()
}

class Base {
    fn greet() {
        show "hello from base"
    }
}

class Child < Base impl Greetable {
    fn init() {}
}

let c = Child()
c.greet()
""")
    assert out == ["hello from base"]


# ── Type annotations ────────────────────────────────────

def test_type_annotation_int():
    out = capture("""
let x: int = 42
show x
""")
    assert out == ["42"]

def test_type_annotation_string():
    out = capture("""
let name: string = "Alice"
show name
""")
    assert out == ["Alice"]

def test_type_annotation_mismatch():
    try:
        run("""
let x: int = "hello"
""")
        assert False, "Should have thrown type error"
    except Exception as e:
        assert "Expected int" in str(e) or "expected int" in str(e).lower()

def test_type_annotation_any():
    out = capture("""
let x: any = 42
let y: any = "hello"
show x
show y
""")
    assert out == ["42", "hello"]

def test_type_annotation_list():
    out = capture("""
let items: list = [1, 2, 3]
show len(items)
""")
    assert out == ["3"]

def test_type_annotation_bool():
    out = capture("""
let flag: bool = true
show flag
""")
    assert out == ["true"]


# ── Raw strings ─────────────────────────────────────────

def test_raw_string_basic():
    out = capture(r'''
let path = r"C:\Users\test\new"
show path
''')
    assert out == [r"C:\Users\test\new"]

def test_raw_string_no_interpolation():
    out = capture(r'''
let s = r"no {escape} here"
show s
''')
    assert out == ["no {escape} here"]

def test_raw_string_single_quotes():
    out = capture("""
let s = r'hello\\nworld'
show s
""")
    assert out == ["hello\\\\nworld"] or out == [r"hello\nworld"]


# ── Bytecode compiler ──────────────────────────────────

def test_bytecode_compile():
    from clarity.bytecode import compile_to_bytecode, CodeObject
    source = "let x = 42"
    tokens = tokenize(source)
    tree = parse(tokens, source)
    code = compile_to_bytecode(tree)
    assert isinstance(code, CodeObject)
    assert len(code.instructions) > 0
    assert 42 in code.constants

def test_bytecode_arithmetic():
    from clarity.bytecode import compile_to_bytecode, VM
    source = """
let x = 10 + 20
show x
"""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    code = compile_to_bytecode(tree)
    vm = VM()
    vm.run(code)
    assert "30" in vm.output

def test_bytecode_function():
    from clarity.bytecode import compile_to_bytecode, VM
    source = """
show 2 + 3
"""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    code = compile_to_bytecode(tree)
    vm = VM()
    vm.run(code)
    assert "5" in vm.output

def test_bytecode_if_else():
    from clarity.bytecode import compile_to_bytecode, VM
    source = """
let x = 10
if x > 5 {
    show "big"
} else {
    show "small"
}
"""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    code = compile_to_bytecode(tree)
    vm = VM()
    vm.run(code)
    assert "big" in vm.output

def test_bytecode_while_loop():
    from clarity.bytecode import compile_to_bytecode, VM
    source = """
mut i = 0
while i < 3 {
    show i
    i = i + 1
}
"""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    code = compile_to_bytecode(tree)
    vm = VM()
    vm.run(code)
    assert "0" in vm.output
    assert "1" in vm.output
    assert "2" in vm.output

def test_bytecode_list():
    from clarity.bytecode import compile_to_bytecode, VM
    source = """
let items = [1, 2, 3]
show items
"""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    code = compile_to_bytecode(tree)
    vm = VM()
    vm.run(code)
    assert "[1, 2, 3]" in vm.output

def test_bytecode_map():
    from clarity.bytecode import compile_to_bytecode, VM
    source = """
let m = {"a": 1, "b": 2}
show m
"""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    code = compile_to_bytecode(tree)
    vm = VM()
    vm.run(code)
    assert "a: 1" in vm.output[0]

def test_bytecode_comparison():
    from clarity.bytecode import compile_to_bytecode, VM
    source = """
show 3 == 3
show 3 != 4
show 5 > 2
"""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    code = compile_to_bytecode(tree)
    vm = VM()
    vm.run(code)
    assert vm.output == ["true", "true", "true"]

def test_bytecode_disassemble():
    from clarity.bytecode import compile_to_bytecode
    source = "show 42"
    tokens = tokenize(source)
    tree = parse(tokens, source)
    code = compile_to_bytecode(tree)
    text = code.disassemble()
    assert "CONST" in text
    assert "PRINT" in text

def test_bytecode_string():
    from clarity.bytecode import compile_to_bytecode, VM
    source = """
let greeting = "hello" + " " + "world"
show greeting
"""
    tokens = tokenize(source)
    tree = parse(tokens, source)
    code = compile_to_bytecode(tree)
    vm = VM()
    vm.run(code)
    assert "hello world" in vm.output


# ── Package manager ─────────────────────────────────────

def test_toml_parse():
    from clarity.package import parse_toml
    toml = """
[package]
name = "myapp"
version = "0.1.0"

[dependencies]
utils = {path = "./libs/utils"}
"""
    config = parse_toml(toml)
    assert config["package"]["name"] == "myapp"
    assert config["package"]["version"] == "0.1.0"
    assert isinstance(config["dependencies"]["utils"], dict)
    assert config["dependencies"]["utils"]["path"] == "./libs/utils"

def test_toml_generate():
    from clarity.package import generate_toml, parse_toml
    config = {
        "package": {"name": "test", "version": "1.0.0"},
        "dependencies": {},
    }
    text = generate_toml(config)
    assert "[package]" in text
    assert 'name = "test"' in text
    # Round-trip
    parsed = parse_toml(text)
    assert parsed["package"]["name"] == "test"

def test_package_init(tmp_path=None):
    import tempfile
    from clarity.package import init_package, CONFIG_FILE
    with tempfile.TemporaryDirectory() as tmpdir:
        result = init_package(tmpdir)
        assert result is True
        config_path = os.path.join(tmpdir, CONFIG_FILE)
        assert os.path.exists(config_path)
        # Running again should skip
        result2 = init_package(tmpdir)
        assert result2 is False

def test_toml_types():
    from clarity.package import parse_toml
    toml = """
active = true
count = 42
ratio = 3.14
name = "hello"
"""
    config = parse_toml(toml)
    assert config["active"] is True
    assert config["count"] == 42
    assert config["ratio"] == 3.14
    assert config["name"] == "hello"


# ── LSP server ──────────────────────────────────────────

def test_lsp_diagnostics_clean():
    from clarity.lsp import check_source
    diagnostics = check_source("let x = 42", "file:///test.clarity")
    assert diagnostics == []

def test_lsp_diagnostics_error():
    from clarity.lsp import check_source
    diagnostics = check_source("let = oops", "file:///test.clarity")
    assert len(diagnostics) > 0
    assert diagnostics[0]["severity"] == 1

def test_lsp_hover():
    from clarity.lsp import get_hover_info
    info = get_hover_info("let x = 42", 0, 0)
    assert info is not None
    assert "let" in info.lower() or "immutable" in info.lower()

def test_lsp_hover_builtin():
    from clarity.lsp import get_hover_info
    info = get_hover_info("show x", 0, 0)
    assert info is not None
    assert "show" in info.lower()

def test_lsp_hover_none():
    from clarity.lsp import get_hover_info
    info = get_hover_info("let x = 42", 0, 6)
    assert info is None

def test_lsp_completions():
    from clarity.lsp import get_completions
    items = get_completions("", 0, 0)
    assert len(items) > 0
    labels = [item["label"] for item in items]
    assert "let" in labels
    assert "fn" in labels
    assert "map" in labels

def test_lsp_message_format():
    from clarity.lsp import make_response, make_notification
    resp = make_response(1, {"test": True})
    assert resp["jsonrpc"] == "2.0"
    assert resp["id"] == 1

    notif = make_notification("test/method", {"data": 42})
    assert notif["jsonrpc"] == "2.0"
    assert notif["method"] == "test/method"


# ── Run all tests ───────────────────────────────────────

print("v0.4.0 Feature tests:")

# Interfaces
test("interface_basic", test_interface_basic)
test("interface_missing_method", test_interface_missing_method)
test("interface_multiple", test_interface_multiple)
test("interface_inherited_method", test_interface_inherited_method)

# Type annotations
test("type_annotation_int", test_type_annotation_int)
test("type_annotation_string", test_type_annotation_string)
test("type_annotation_mismatch", test_type_annotation_mismatch)
test("type_annotation_any", test_type_annotation_any)
test("type_annotation_list", test_type_annotation_list)
test("type_annotation_bool", test_type_annotation_bool)

# Raw strings
test("raw_string_basic", test_raw_string_basic)
test("raw_string_no_interpolation", test_raw_string_no_interpolation)
test("raw_string_single_quotes", test_raw_string_single_quotes)

# Bytecode compiler
test("bytecode_compile", test_bytecode_compile)
test("bytecode_arithmetic", test_bytecode_arithmetic)
test("bytecode_function", test_bytecode_function)
test("bytecode_if_else", test_bytecode_if_else)
test("bytecode_while_loop", test_bytecode_while_loop)
test("bytecode_list", test_bytecode_list)
test("bytecode_map", test_bytecode_map)
test("bytecode_comparison", test_bytecode_comparison)
test("bytecode_disassemble", test_bytecode_disassemble)
test("bytecode_string", test_bytecode_string)

# Package manager
test("toml_parse", test_toml_parse)
test("toml_generate", test_toml_generate)
test("package_init", test_package_init)
test("toml_types", test_toml_types)

# LSP
test("lsp_diagnostics_clean", test_lsp_diagnostics_clean)
test("lsp_diagnostics_error", test_lsp_diagnostics_error)
test("lsp_hover", test_lsp_hover)
test("lsp_hover_builtin", test_lsp_hover_builtin)
test("lsp_hover_none", test_lsp_hover_none)
test("lsp_completions", test_lsp_completions)
test("lsp_message_format", test_lsp_message_format)

print(f"\n{'All' if failed == 0 else failed} {passed + failed} v0.4.0 feature tests {'passed' if failed == 0 else f'({failed} failed)'}!")
if failed > 0:
    sys.exit(1)
