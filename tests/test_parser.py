"""Tests for the Clarity parser."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clarity.lexer import tokenize
from clarity.parser import parse
from clarity import ast_nodes as ast


def parse_source(source):
    tokens = tokenize(source)
    return parse(tokens, source)


def test_let():
    tree = parse_source('let x = 42')
    assert len(tree.body) == 1
    stmt = tree.body[0]
    assert isinstance(stmt, ast.LetStatement)
    assert stmt.name == "x"
    assert isinstance(stmt.value, ast.NumberLiteral)
    assert stmt.value.value == 42
    print("  [pass] let statement")


def test_mut():
    tree = parse_source('mut x = 0')
    stmt = tree.body[0]
    assert isinstance(stmt, ast.LetStatement)
    assert stmt.mutable == True
    print("  [pass] mut statement")


def test_fn():
    tree = parse_source('fn add(a, b) {\n  return a + b\n}')
    stmt = tree.body[0]
    assert isinstance(stmt, ast.FnStatement)
    assert stmt.name == "add"
    assert stmt.params == ["a", "b"]
    print("  [pass] function declaration")


def test_if():
    tree = parse_source('if x > 5 {\n  show "big"\n} else {\n  show "small"\n}')
    stmt = tree.body[0]
    assert isinstance(stmt, ast.IfStatement)
    assert stmt.else_body is not None
    print("  [pass] if/else")


def test_elif():
    tree = parse_source('if x > 10 {\n  show "a"\n} elif x > 5 {\n  show "b"\n} else {\n  show "c"\n}')
    stmt = tree.body[0]
    assert isinstance(stmt, ast.IfStatement)
    assert len(stmt.elif_clauses) == 1
    assert stmt.else_body is not None
    print("  [pass] if/elif/else")


def test_for():
    tree = parse_source('for i in range(10) {\n  show i\n}')
    stmt = tree.body[0]
    assert isinstance(stmt, ast.ForStatement)
    assert stmt.variable == "i"
    print("  [pass] for loop")


def test_while():
    tree = parse_source('while x > 0 {\n  x -= 1\n}')
    stmt = tree.body[0]
    assert isinstance(stmt, ast.WhileStatement)
    print("  [pass] while loop")


def test_list():
    tree = parse_source('let x = [1, 2, 3]')
    stmt = tree.body[0]
    assert isinstance(stmt.value, ast.ListLiteral)
    assert len(stmt.value.elements) == 3
    print("  [pass] list literal")


def test_map():
    tree = parse_source('let x = {name: "Alice", age: 30}')
    stmt = tree.body[0]
    assert isinstance(stmt.value, ast.MapLiteral)
    assert len(stmt.value.pairs) == 2
    print("  [pass] map literal")


def test_binary_ops():
    tree = parse_source('let x = 1 + 2 * 3')
    stmt = tree.body[0]
    expr = stmt.value
    # Should be 1 + (2 * 3) due to precedence
    assert isinstance(expr, ast.BinaryOp)
    assert expr.operator == "+"
    assert isinstance(expr.right, ast.BinaryOp)
    assert expr.right.operator == "*"
    print("  [pass] operator precedence")


def test_call():
    tree = parse_source('add(1, 2)')
    stmt = tree.body[0]
    assert isinstance(stmt, ast.ExpressionStatement)
    expr = stmt.expression
    assert isinstance(expr, ast.CallExpression)
    assert len(expr.arguments) == 2
    print("  [pass] function call")


def test_member():
    tree = parse_source('person.name')
    stmt = tree.body[0]
    expr = stmt.expression
    assert isinstance(expr, ast.MemberExpression)
    assert expr.property == "name"
    print("  [pass] member access")


def test_index():
    tree = parse_source('items[0]')
    stmt = tree.body[0]
    expr = stmt.expression
    assert isinstance(expr, ast.IndexExpression)
    print("  [pass] index access")


def test_pipe():
    tree = parse_source('x |> double')
    stmt = tree.body[0]
    expr = stmt.expression
    assert isinstance(expr, ast.PipeExpression)
    print("  [pass] pipe expression")


def test_fn_expression():
    tree = parse_source('let f = fn(x) { return x * 2 }')
    stmt = tree.body[0]
    assert isinstance(stmt.value, ast.FnExpression)
    assert stmt.value.params == ["x"]
    print("  [pass] anonymous function")


def test_range():
    tree = parse_source('1..10')
    stmt = tree.body[0]
    expr = stmt.expression
    assert isinstance(expr, ast.RangeExpression)
    print("  [pass] range expression")


def test_try_catch():
    tree = parse_source('try {\n  show "ok"\n} catch err {\n  show err\n}')
    stmt = tree.body[0]
    assert isinstance(stmt, ast.TryCatch)
    assert stmt.catch_var == "err"
    print("  [pass] try/catch")


def test_show():
    tree = parse_source('show "hello", 42')
    stmt = tree.body[0]
    assert isinstance(stmt, ast.ShowStatement)
    assert len(stmt.values) == 2
    print("  [pass] show statement")


if __name__ == "__main__":
    print("Parser tests:")
    test_let()
    test_mut()
    test_fn()
    test_if()
    test_elif()
    test_for()
    test_while()
    test_list()
    test_map()
    test_binary_ops()
    test_call()
    test_member()
    test_index()
    test_pipe()
    test_fn_expression()
    test_range()
    test_try_catch()
    test_show()
    print("All parser tests passed!")
