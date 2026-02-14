"""Clarity error types with clear, helpful messages."""


class ClarityError(Exception):
    """Base error for all Clarity errors."""

    def __init__(self, message, line=None, column=None, source_line=None):
        self.message = message
        self.line = line
        self.column = column
        self.source_line = source_line
        super().__init__(self.format())

    def format(self):
        parts = [f"\n  >> {self.message}"]
        if self.line is not None:
            parts.append(f"     at line {self.line}")
            if self.column is not None:
                parts[1] += f", column {self.column}"
        if self.source_line:
            parts.append(f"     | {self.source_line.rstrip()}")
            if self.column is not None:
                parts.append(f"     | {' ' * (self.column - 1)}^")
        return "\n".join(parts)


class LexerError(ClarityError):
    """Error during tokenization."""
    pass


class ParseError(ClarityError):
    """Error during parsing."""
    pass


class RuntimeError(ClarityError):
    """Error during execution."""
    pass


class TypeError(ClarityError):
    """Type mismatch error."""
    pass


class NameError(ClarityError):
    """Undefined variable/function error."""
    pass


class ImportError(ClarityError):
    """Module import error."""
    pass
