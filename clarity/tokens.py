"""Clarity token types and Token class."""

from enum import Enum, auto


class TokenType(Enum):
    # Literals
    NUMBER = auto()
    STRING = auto()
    RAW_STRING = auto()
    IDENTIFIER = auto()

    # Keywords
    LET = auto()
    MUT = auto()
    FN = auto()
    IF = auto()
    ELSE = auto()
    ELIF = auto()
    FOR = auto()
    IN = auto()
    WHILE = auto()
    RETURN = auto()
    TRUE = auto()
    FALSE = auto()
    NULL = auto()
    TRY = auto()
    CATCH = auto()
    FINALLY = auto()
    BREAK = auto()
    CONTINUE = auto()
    IMPORT = auto()
    FROM = auto()
    AS = auto()
    AND = auto()
    OR = auto()
    NOT = auto()
    IS = auto()
    SHOW = auto()
    ASK = auto()
    CLASS = auto()
    THIS = auto()
    THROW = auto()
    MATCH = auto()
    WHEN = auto()
    ENUM = auto()
    ASYNC = auto()
    AWAIT = auto()
    YIELD = auto()
    INTERFACE = auto()
    IMPL = auto()

    # Operators
    PLUS = auto()
    MINUS = auto()
    STAR = auto()
    SLASH = auto()
    PERCENT = auto()
    POWER = auto()           # **
    EQ = auto()              # ==
    NEQ = auto()             # !=
    LT = auto()
    GT = auto()
    LTE = auto()             # <=
    GTE = auto()             # >=
    ASSIGN = auto()          # =
    PLUS_ASSIGN = auto()     # +=
    MINUS_ASSIGN = auto()    # -=
    STAR_ASSIGN = auto()     # *=
    SLASH_ASSIGN = auto()    # /=
    PIPE = auto()            # |>
    FAT_ARROW = auto()       # =>
    ARROW = auto()           # ->
    DOTDOT = auto()          # ..
    SPREAD = auto()          # ...
    QUESTION = auto()        # ?
    QUESTION_DOT = auto()    # ?.
    QUESTION_QUESTION = auto()  # ??

    # Bitwise operators
    AMPERSAND = auto()       # &
    BIT_OR = auto()          # | (single pipe)
    CARET = auto()           # ^
    TILDE = auto()           # ~
    LSHIFT = auto()          # <<
    RSHIFT = auto()          # >>

    # Delimiters
    LPAREN = auto()
    RPAREN = auto()
    LBRACE = auto()
    RBRACE = auto()
    LBRACKET = auto()
    RBRACKET = auto()
    COMMA = auto()
    COLON = auto()
    DOT = auto()
    AT = auto()

    # Special
    NEWLINE = auto()
    EOF = auto()


KEYWORDS = {
    "let": TokenType.LET,
    "mut": TokenType.MUT,
    "fn": TokenType.FN,
    "if": TokenType.IF,
    "else": TokenType.ELSE,
    "elif": TokenType.ELIF,
    "for": TokenType.FOR,
    "in": TokenType.IN,
    "while": TokenType.WHILE,
    "return": TokenType.RETURN,
    "true": TokenType.TRUE,
    "false": TokenType.FALSE,
    "null": TokenType.NULL,
    "try": TokenType.TRY,
    "catch": TokenType.CATCH,
    "finally": TokenType.FINALLY,
    "break": TokenType.BREAK,
    "continue": TokenType.CONTINUE,
    "import": TokenType.IMPORT,
    "from": TokenType.FROM,
    "as": TokenType.AS,
    "and": TokenType.AND,
    "or": TokenType.OR,
    "not": TokenType.NOT,
    "is": TokenType.IS,
    "show": TokenType.SHOW,
    "ask": TokenType.ASK,
    "class": TokenType.CLASS,
    "this": TokenType.THIS,
    "throw": TokenType.THROW,
    "match": TokenType.MATCH,
    "when": TokenType.WHEN,
    "enum": TokenType.ENUM,
    "async": TokenType.ASYNC,
    "await": TokenType.AWAIT,
    "yield": TokenType.YIELD,
    "interface": TokenType.INTERFACE,
    "impl": TokenType.IMPL,
}


class Token:
    __slots__ = ("type", "value", "line", "column")

    def __init__(self, type: TokenType, value, line: int, column: int):
        self.type = type
        self.value = value
        self.line = line
        self.column = column

    def __repr__(self):
        return f"Token({self.type.name}, {self.value!r}, L{self.line}:{self.column})"
