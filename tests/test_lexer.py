"""Tests for the Clarity lexer."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clarity.lexer import tokenize
from clarity.tokens import TokenType


def test_basic_tokens():
    tokens = tokenize('let x = 42')
    types = [t.type for t in tokens if t.type != TokenType.EOF]
    assert types == [TokenType.LET, TokenType.IDENTIFIER, TokenType.ASSIGN, TokenType.NUMBER]
    assert tokens[3].value == 42
    print("  [pass] basic tokens")


def test_string():
    tokens = tokenize('"hello world"')
    assert tokens[0].type == TokenType.STRING
    assert tokens[0].value == "hello world"
    print("  [pass] string tokens")


def test_operators():
    tokens = tokenize('a + b - c * d / e')
    ops = [t.type for t in tokens if t.type in (TokenType.PLUS, TokenType.MINUS, TokenType.STAR, TokenType.SLASH)]
    assert len(ops) == 4
    print("  [pass] operator tokens")


def test_comparison():
    tokens = tokenize('x == y != z <= w >= v < u > t')
    ops = [t.type for t in tokens if t.type in (
        TokenType.EQ, TokenType.NEQ, TokenType.LTE, TokenType.GTE, TokenType.LT, TokenType.GT
    )]
    assert len(ops) == 6
    print("  [pass] comparison tokens")


def test_pipe():
    tokens = tokenize('a |> b')
    assert any(t.type == TokenType.PIPE for t in tokens)
    print("  [pass] pipe operator")


def test_comments():
    tokens = tokenize('let x = 1 // this is a comment\nlet y = 2')
    ids = [t for t in tokens if t.type == TokenType.IDENTIFIER]
    assert len(ids) == 2
    assert ids[0].value == "x"
    assert ids[1].value == "y"
    print("  [pass] comments")


def test_dash_comments():
    tokens = tokenize('let x = 1 -- this is a comment\nlet y = 2')
    ids = [t for t in tokens if t.type == TokenType.IDENTIFIER]
    assert len(ids) == 2
    print("  [pass] dash comments")


def test_keywords():
    tokens = tokenize('if else for while fn let mut return true false null')
    kw_types = [t.type for t in tokens if t.type not in (TokenType.NEWLINE, TokenType.EOF)]
    expected = [
        TokenType.IF, TokenType.ELSE, TokenType.FOR, TokenType.WHILE,
        TokenType.FN, TokenType.LET, TokenType.MUT, TokenType.RETURN,
        TokenType.TRUE, TokenType.FALSE, TokenType.NULL
    ]
    assert kw_types == expected
    print("  [pass] keywords")


def test_numbers():
    tokens = tokenize('42 3.14 1_000_000 0xFF')
    nums = [t for t in tokens if t.type == TokenType.NUMBER]
    assert nums[0].value == 42
    assert nums[1].value == 3.14
    assert nums[2].value == 1000000
    assert nums[3].value == 255
    print("  [pass] numbers")


def test_string_escapes():
    tokens = tokenize(r'"hello\nworld\t!"')
    assert tokens[0].value == "hello\nworld\t!"
    print("  [pass] string escapes")


def test_braces():
    tokens = tokenize('{ } [ ] ( )')
    types = [t.type for t in tokens if t.type != TokenType.EOF]
    expected = [TokenType.LBRACE, TokenType.RBRACE, TokenType.LBRACKET, TokenType.RBRACKET, TokenType.LPAREN, TokenType.RPAREN]
    assert types == expected
    print("  [pass] braces/brackets/parens")


def test_dotdot():
    tokens = tokenize('1..10')
    types = [t.type for t in tokens if t.type != TokenType.EOF]
    assert types == [TokenType.NUMBER, TokenType.DOTDOT, TokenType.NUMBER]
    print("  [pass] range operator (..)")


def test_power():
    tokens = tokenize('2 ** 8')
    assert any(t.type == TokenType.POWER for t in tokens)
    print("  [pass] power operator (**)")


if __name__ == "__main__":
    print("Lexer tests:")
    test_basic_tokens()
    test_string()
    test_operators()
    test_comparison()
    test_pipe()
    test_comments()
    test_dash_comments()
    test_keywords()
    test_numbers()
    test_string_escapes()
    test_braces()
    test_dotdot()
    test_power()
    print("All lexer tests passed!")
