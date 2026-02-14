"""Clarity lexer — turns source code into tokens."""

from .tokens import Token, TokenType, KEYWORDS
from .errors import LexerError


class Lexer:
    def __init__(self, source: str, filename: str = "<input>"):
        self.source = source
        self.filename = filename
        self.pos = 0
        self.line = 1
        self.column = 1
        self.tokens = []
        self.lines = source.split("\n")
        self.paren_depth = 0

    def error(self, message):
        source_line = self.lines[self.line - 1] if self.line <= len(self.lines) else ""
        raise LexerError(message, self.line, self.column, source_line)

    def peek(self):
        if self.pos >= len(self.source):
            return "\0"
        return self.source[self.pos]

    def peek_next(self):
        if self.pos + 1 >= len(self.source):
            return "\0"
        return self.source[self.pos + 1]

    def peek_at(self, offset):
        idx = self.pos + offset
        if idx >= len(self.source):
            return "\0"
        return self.source[idx]

    def advance(self):
        ch = self.source[self.pos]
        self.pos += 1
        if ch == "\n":
            self.line += 1
            self.column = 1
        else:
            self.column += 1
        return ch

    def match(self, expected):
        if self.pos >= len(self.source) or self.source[self.pos] != expected:
            return False
        self.advance()
        return True

    def make_token(self, type: TokenType, value, line=None, col=None):
        return Token(type, value, line or self.line, col or self.column)

    def skip_whitespace(self):
        while self.pos < len(self.source) and self.peek() in " \t\r":
            self.advance()

    def skip_comment(self):
        if self.peek() == "/" and self.peek_next() == "/":
            while self.pos < len(self.source) and self.peek() != "\n":
                self.advance()
            return True
        if self.peek() == "/" and self.peek_next() == "*":
            self.advance()
            self.advance()
            depth = 1
            while self.pos < len(self.source) and depth > 0:
                if self.peek() == "/" and self.peek_next() == "*":
                    depth += 1
                    self.advance()
                elif self.peek() == "*" and self.peek_next() == "/":
                    depth -= 1
                    self.advance()
                self.advance()
            return True
        if self.peek() == "-" and self.peek_next() == "-":
            while self.pos < len(self.source) and self.peek() != "\n":
                self.advance()
            return True
        return False

    def read_string(self):
        quote = self.advance()
        start_line = self.line
        start_col = self.column - 1
        result = []

        while self.pos < len(self.source) and self.peek() != quote:
            ch = self.peek()
            if ch == "\\":
                self.advance()
                esc = self.advance()
                escape_map = {
                    "n": "\n", "t": "\t", "r": "\r",
                    "\\": "\\", "'": "'", '"': '"',
                    "0": "\0", "{": "{", "}": "}",
                }
                if esc in escape_map:
                    result.append(escape_map[esc])
                else:
                    result.append("\\" + esc)
            elif ch == "\n":
                self.error("Unterminated string — use triple quotes for multi-line")
            else:
                result.append(self.advance())

        if self.pos >= len(self.source):
            self.error("Unterminated string")

        self.advance()
        return Token(TokenType.STRING, "".join(result), start_line, start_col)

    def read_triple_string(self):
        quote = self.source[self.pos]
        start_line = self.line
        start_col = self.column
        self.advance(); self.advance(); self.advance()
        result = []

        while self.pos < len(self.source):
            if (self.peek() == quote and
                self.pos + 2 < len(self.source) and
                self.source[self.pos + 1] == quote and
                self.source[self.pos + 2] == quote):
                self.advance(); self.advance(); self.advance()
                return Token(TokenType.STRING, "".join(result), start_line, start_col)
            result.append(self.advance())

        self.error("Unterminated triple-quoted string")

    def read_number(self):
        start_col = self.column
        num = []
        has_dot = False

        if self.peek() == "0" and self.peek_next() in "xX":
            num.append(self.advance())
            num.append(self.advance())
            while self.pos < len(self.source) and (self.peek().isalnum() or self.peek() == "_"):
                if self.peek() != "_":
                    num.append(self.advance())
                else:
                    self.advance()
            return Token(TokenType.NUMBER, int("".join(num), 16), self.line, start_col)

        while self.pos < len(self.source):
            ch = self.peek()
            if ch.isdigit():
                num.append(self.advance())
            elif ch == "_" and len(num) > 0:
                self.advance()
            elif ch == "." and not has_dot and self.peek_next().isdigit():
                has_dot = True
                num.append(self.advance())
            else:
                break

        value = float("".join(num)) if has_dot else int("".join(num))
        return Token(TokenType.NUMBER, value, self.line, start_col)

    def read_identifier(self):
        start_col = self.column
        chars = []
        while self.pos < len(self.source) and (self.peek().isalnum() or self.peek() == "_"):
            chars.append(self.advance())
        word = "".join(chars)

        # Raw string: r"..." — no escape processing
        if word == "r" and self.pos < len(self.source) and self.peek() in '"\'':
            return self.read_raw_string(start_col)

        token_type = KEYWORDS.get(word, TokenType.IDENTIFIER)
        return Token(token_type, word, self.line, start_col)

    def read_raw_string(self, start_col):
        """Read a raw string (r"...") — no escape processing."""
        quote = self.advance()
        result = []
        while self.pos < len(self.source) and self.peek() != quote:
            if self.peek() == "\n":
                self.error("Unterminated raw string")
            result.append(self.advance())
        if self.pos >= len(self.source):
            self.error("Unterminated raw string")
        self.advance()  # consume closing quote
        return Token(TokenType.RAW_STRING, "".join(result), self.line, start_col)

    def tokenize(self):
        tokens = []
        last_was_newline = True

        while self.pos < len(self.source):
            self.skip_whitespace()

            if self.pos >= len(self.source):
                break

            if self.skip_comment():
                continue

            ch = self.peek()

            if ch == "\n":
                self.advance()
                if not last_was_newline and self.paren_depth == 0:
                    tokens.append(self.make_token(TokenType.NEWLINE, "\\n"))
                    last_was_newline = True
                continue

            last_was_newline = False

            if ch in '"\'':
                if (self.pos + 2 < len(self.source) and
                    self.source[self.pos:self.pos+3] in ('"""', "'''")):
                    tokens.append(self.read_triple_string())
                else:
                    tokens.append(self.read_string())
                continue

            if ch.isdigit():
                tokens.append(self.read_number())
                continue

            if ch.isalpha() or ch == "_":
                tokens.append(self.read_identifier())
                continue

            col = self.column
            line = self.line

            if ch == "+":
                self.advance()
                if self.match("="):
                    tokens.append(Token(TokenType.PLUS_ASSIGN, "+=", line, col))
                else:
                    tokens.append(Token(TokenType.PLUS, "+", line, col))
            elif ch == "-":
                self.advance()
                if self.match(">"):
                    tokens.append(Token(TokenType.ARROW, "->", line, col))
                elif self.match("="):
                    tokens.append(Token(TokenType.MINUS_ASSIGN, "-=", line, col))
                elif self.match("-"):
                    while self.pos < len(self.source) and self.peek() != "\n":
                        self.advance()
                else:
                    tokens.append(Token(TokenType.MINUS, "-", line, col))
            elif ch == "*":
                self.advance()
                if self.match("*"):
                    tokens.append(Token(TokenType.POWER, "**", line, col))
                elif self.match("="):
                    tokens.append(Token(TokenType.STAR_ASSIGN, "*=", line, col))
                else:
                    tokens.append(Token(TokenType.STAR, "*", line, col))
            elif ch == "/":
                self.advance()
                if self.match("="):
                    tokens.append(Token(TokenType.SLASH_ASSIGN, "/=", line, col))
                else:
                    tokens.append(Token(TokenType.SLASH, "/", line, col))
            elif ch == "%":
                self.advance()
                tokens.append(Token(TokenType.PERCENT, "%", line, col))
            elif ch == "=":
                self.advance()
                if self.match("="):
                    tokens.append(Token(TokenType.EQ, "==", line, col))
                elif self.match(">"):
                    tokens.append(Token(TokenType.FAT_ARROW, "=>", line, col))
                else:
                    tokens.append(Token(TokenType.ASSIGN, "=", line, col))
            elif ch == "!":
                self.advance()
                if self.match("="):
                    tokens.append(Token(TokenType.NEQ, "!=", line, col))
                else:
                    tokens.append(Token(TokenType.NOT, "not", line, col))
            elif ch == "<":
                self.advance()
                if self.match("="):
                    tokens.append(Token(TokenType.LTE, "<=", line, col))
                elif self.match("<"):
                    tokens.append(Token(TokenType.LSHIFT, "<<", line, col))
                else:
                    tokens.append(Token(TokenType.LT, "<", line, col))
            elif ch == ">":
                self.advance()
                if self.match("="):
                    tokens.append(Token(TokenType.GTE, ">=", line, col))
                elif self.match(">"):
                    tokens.append(Token(TokenType.RSHIFT, ">>", line, col))
                else:
                    tokens.append(Token(TokenType.GT, ">", line, col))
            elif ch == "|":
                self.advance()
                if self.match(">"):
                    tokens.append(Token(TokenType.PIPE, "|>", line, col))
                else:
                    tokens.append(Token(TokenType.BIT_OR, "|", line, col))
            elif ch == "&":
                self.advance()
                tokens.append(Token(TokenType.AMPERSAND, "&", line, col))
            elif ch == "^":
                self.advance()
                tokens.append(Token(TokenType.CARET, "^", line, col))
            elif ch == "~":
                self.advance()
                tokens.append(Token(TokenType.TILDE, "~", line, col))
            elif ch == "?":
                self.advance()
                if self.match("."):
                    tokens.append(Token(TokenType.QUESTION_DOT, "?.", line, col))
                elif self.match("?"):
                    tokens.append(Token(TokenType.QUESTION_QUESTION, "??", line, col))
                else:
                    tokens.append(Token(TokenType.QUESTION, "?", line, col))
            elif ch == ".":
                self.advance()
                if self.peek() == "." and self.peek_next() == ".":
                    self.advance()
                    self.advance()
                    tokens.append(Token(TokenType.SPREAD, "...", line, col))
                elif self.match("."):
                    tokens.append(Token(TokenType.DOTDOT, "..", line, col))
                else:
                    tokens.append(Token(TokenType.DOT, ".", line, col))
            elif ch == "(":
                self.advance()
                self.paren_depth += 1
                tokens.append(Token(TokenType.LPAREN, "(", line, col))
            elif ch == ")":
                self.advance()
                self.paren_depth -= 1
                tokens.append(Token(TokenType.RPAREN, ")", line, col))
            elif ch == "{":
                self.advance()
                self.paren_depth += 1
                tokens.append(Token(TokenType.LBRACE, "{", line, col))
            elif ch == "}":
                self.advance()
                self.paren_depth -= 1
                tokens.append(Token(TokenType.RBRACE, "}", line, col))
            elif ch == "[":
                self.advance()
                self.paren_depth += 1
                tokens.append(Token(TokenType.LBRACKET, "[", line, col))
            elif ch == "]":
                self.advance()
                self.paren_depth -= 1
                tokens.append(Token(TokenType.RBRACKET, "]", line, col))
            elif ch == ",":
                self.advance()
                tokens.append(Token(TokenType.COMMA, ",", line, col))
            elif ch == ":":
                self.advance()
                tokens.append(Token(TokenType.COLON, ":", line, col))
            elif ch == "@":
                self.advance()
                tokens.append(Token(TokenType.AT, "@", line, col))
            elif ch == ";":
                self.advance()
                tokens.append(Token(TokenType.NEWLINE, ";", line, col))
            else:
                self.error(f"Unexpected character: '{ch}'")

        tokens.append(Token(TokenType.EOF, None, self.line, self.column))
        return tokens


def tokenize(source: str, filename: str = "<input>"):
    """Convenience function to tokenize source code."""
    return Lexer(source, filename).tokenize()
