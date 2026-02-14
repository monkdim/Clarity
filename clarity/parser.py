"""Clarity parser — turns tokens into an AST."""

from .tokens import Token, TokenType
from .errors import ParseError
from . import ast_nodes as ast


class Parser:
    def __init__(self, tokens, source=""):
        self.tokens = tokens
        self.pos = 0
        self.source = source
        self.lines = source.split("\n") if source else []

    def error(self, message, token=None):
        tok = token or self.current()
        source_line = self.lines[tok.line - 1] if tok.line <= len(self.lines) else ""
        raise ParseError(message, tok.line, tok.column, source_line)

    def current(self):
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return self.tokens[-1]

    def peek(self, offset=0):
        idx = self.pos + offset
        if idx < len(self.tokens):
            return self.tokens[idx]
        return self.tokens[-1]

    def advance(self):
        tok = self.current()
        if tok.type != TokenType.EOF:
            self.pos += 1
        return tok

    def expect(self, type: TokenType, message=None):
        tok = self.current()
        if tok.type != type:
            msg = message or f"Expected {type.name}, got {tok.type.name} ({tok.value!r})"
            self.error(msg)
        return self.advance()

    def match(self, *types):
        if self.current().type in types:
            return self.advance()
        return None

    def _expect_property_name(self):
        """Accept identifier or keyword as a property name after '.' or '?.'."""
        tok = self.current()
        if tok.type == TokenType.IDENTIFIER:
            self.advance()
            return tok.value
        # Allow keywords as property names (e.g., obj.match, obj.is, obj.type)
        from .tokens import KEYWORDS
        if tok.value in KEYWORDS:
            self.advance()
            return tok.value
        self.error("Expected property name after '.'")

    def skip_newlines(self):
        while self.current().type == TokenType.NEWLINE:
            self.advance()

    def at_end(self):
        return self.current().type == TokenType.EOF

    # ── Entry Point ──────────────────────────────────────

    def parse(self):
        self.skip_newlines()
        body = []
        while not self.at_end():
            stmt = self.parse_statement()
            if stmt is not None:
                body.append(stmt)
            self.skip_newlines()
        return ast.Program(body)

    # ── Statements ───────────────────────────────────────

    def parse_statement(self):
        tok = self.current()

        if tok.type == TokenType.LET or tok.type == TokenType.MUT:
            return self.parse_let()
        elif tok.type == TokenType.FN:
            if self.peek(1).type == TokenType.IDENTIFIER:
                return self.parse_fn_declaration()
            else:
                return self.parse_expression_statement()
        elif tok.type == TokenType.IF:
            return self.parse_if()
        elif tok.type == TokenType.FOR:
            return self.parse_for()
        elif tok.type == TokenType.WHILE:
            return self.parse_while()
        elif tok.type == TokenType.RETURN:
            return self.parse_return()
        elif tok.type == TokenType.BREAK:
            self.advance()
            self.match(TokenType.NEWLINE)
            return ast.BreakStatement(line=tok.line, column=tok.column)
        elif tok.type == TokenType.CONTINUE:
            self.advance()
            self.match(TokenType.NEWLINE)
            return ast.ContinueStatement(line=tok.line, column=tok.column)
        elif tok.type == TokenType.SHOW:
            return self.parse_show()
        elif tok.type == TokenType.TRY:
            return self.parse_try_catch()
        elif tok.type == TokenType.IMPORT:
            return self.parse_import()
        elif tok.type == TokenType.FROM:
            return self.parse_from_import()
        elif tok.type == TokenType.CLASS:
            return self.parse_class()
        elif tok.type == TokenType.THROW:
            return self.parse_throw()
        elif tok.type == TokenType.MATCH:
            return self.parse_match()
        elif tok.type == TokenType.ENUM:
            return self.parse_enum()
        elif tok.type == TokenType.ASYNC:
            return self.parse_async_fn()
        elif tok.type == TokenType.AT:
            return self.parse_decorated()
        elif tok.type == TokenType.INTERFACE:
            return self.parse_interface()
        elif tok.type == TokenType.NEWLINE:
            self.advance()
            return None
        else:
            return self.parse_expression_statement()

    def parse_let(self):
        tok = self.advance()  # consume 'let' or 'mut'
        mutable = tok.type == TokenType.MUT

        # Destructuring: let [a, b, c] = expr
        if self.current().type == TokenType.LBRACKET:
            return self.parse_destructure_list(tok, mutable)
        # Destructuring: let {x, y} = expr
        if self.current().type == TokenType.LBRACE:
            return self.parse_destructure_map(tok, mutable)

        name_tok = self.expect(TokenType.IDENTIFIER, "Expected variable name after 'let'")
        # Optional type annotation: let x: int = ...
        type_ann = None
        if self.match(TokenType.COLON):
            type_ann = self.expect(TokenType.IDENTIFIER, "Expected type name").value
        self.expect(TokenType.ASSIGN, "Expected '=' after variable name")
        value = self.parse_expression()
        self.match(TokenType.NEWLINE)
        return ast.LetStatement(name_tok.value, value, mutable, type_annotation=type_ann, line=tok.line, column=tok.column)

    def parse_destructure_list(self, tok, mutable):
        self.advance()  # consume '['
        targets = []
        while self.current().type != TokenType.RBRACKET:
            if targets:
                self.expect(TokenType.COMMA)
            # Support ...rest
            if self.current().type == TokenType.SPREAD:
                self.advance()
                name = self.expect(TokenType.IDENTIFIER).value
                targets.append("..." + name)
            else:
                targets.append(self.expect(TokenType.IDENTIFIER).value)
        self.expect(TokenType.RBRACKET)
        self.expect(TokenType.ASSIGN, "Expected '=' after destructure pattern")
        value = self.parse_expression()
        self.match(TokenType.NEWLINE)
        return ast.DestructureLetStatement(targets, value, mutable, "list", line=tok.line, column=tok.column)

    def parse_destructure_map(self, tok, mutable):
        self.advance()  # consume '{'
        targets = []
        while self.current().type != TokenType.RBRACE:
            if targets:
                self.expect(TokenType.COMMA)
            targets.append(self.expect(TokenType.IDENTIFIER).value)
        self.expect(TokenType.RBRACE)
        self.expect(TokenType.ASSIGN, "Expected '=' after destructure pattern")
        value = self.parse_expression()
        self.match(TokenType.NEWLINE)
        return ast.DestructureLetStatement(targets, value, mutable, "map", line=tok.line, column=tok.column)

    def parse_fn_declaration(self):
        tok = self.advance()  # consume 'fn'
        name_tok = self.expect(TokenType.IDENTIFIER, "Expected function name")
        params, param_types = self.parse_typed_params()
        # Optional return type: fn foo() -> int { ... }
        return_type = None
        if self.match(TokenType.ARROW):
            return_type = self.expect(TokenType.IDENTIFIER, "Expected return type").value
        body = self.parse_block()
        self.match(TokenType.NEWLINE)
        return ast.FnStatement(name_tok.value, params, body, param_types=param_types, return_type=return_type, line=tok.line, column=tok.column)

    def parse_typed_params(self):
        """Parse params with optional type annotations. Returns (params, param_types)."""
        self.expect(TokenType.LPAREN, "Expected '(' after function name")
        params = []
        param_types = {}
        while self.current().type != TokenType.RPAREN:
            if params:
                self.expect(TokenType.COMMA, "Expected ',' between parameters")
            # Rest params: ...args
            if self.current().type == TokenType.SPREAD:
                self.advance()
                param = self.expect(TokenType.IDENTIFIER, "Expected parameter name after '...'")
                params.append("..." + param.value)
            else:
                param = self.expect(TokenType.IDENTIFIER, "Expected parameter name")
                params.append(param.value)
                # Optional type annotation: param: type
                if self.match(TokenType.COLON):
                    type_name = self.expect(TokenType.IDENTIFIER, "Expected type name").value
                    param_types[param.value] = type_name
        self.expect(TokenType.RPAREN)
        return params, param_types

    def parse_params(self):
        """Parse params without type annotations (for backwards compat)."""
        params, _ = self.parse_typed_params()
        return params

    def parse_block(self):
        self.skip_newlines()
        tok = self.expect(TokenType.LBRACE, "Expected '{'")
        self.skip_newlines()
        statements = []
        while self.current().type != TokenType.RBRACE:
            if self.at_end():
                self.error("Expected '}' — unclosed block", tok)
            stmt = self.parse_statement()
            if stmt is not None:
                statements.append(stmt)
            self.skip_newlines()
        self.expect(TokenType.RBRACE)
        return ast.Block(statements, line=tok.line, column=tok.column)

    def parse_if(self):
        tok = self.advance()  # consume 'if'
        condition = self.parse_expression()
        body = self.parse_block()

        elif_clauses = []
        else_body = None

        self.skip_newlines()
        while self.match(TokenType.ELIF):
            elif_cond = self.parse_expression()
            elif_body = self.parse_block()
            elif_clauses.append((elif_cond, elif_body))
            self.skip_newlines()

        if self.match(TokenType.ELSE):
            self.skip_newlines()
            if self.current().type == TokenType.IF:
                else_body = ast.Block([self.parse_if()], line=self.current().line)
            else:
                else_body = self.parse_block()

        self.match(TokenType.NEWLINE)
        return ast.IfStatement(condition, body, elif_clauses, else_body, line=tok.line, column=tok.column)

    def parse_for(self):
        tok = self.advance()  # consume 'for'
        var_tok = self.expect(TokenType.IDENTIFIER, "Expected variable name after 'for'")
        self.expect(TokenType.IN, "Expected 'in' after variable name")
        iterable = self.parse_expression()
        body = self.parse_block()
        self.match(TokenType.NEWLINE)
        return ast.ForStatement(var_tok.value, iterable, body, line=tok.line, column=tok.column)

    def parse_while(self):
        tok = self.advance()  # consume 'while'
        condition = self.parse_expression()
        body = self.parse_block()
        self.match(TokenType.NEWLINE)
        return ast.WhileStatement(condition, body, line=tok.line, column=tok.column)

    def parse_return(self):
        tok = self.advance()  # consume 'return'
        value = None
        if self.current().type not in (TokenType.NEWLINE, TokenType.RBRACE, TokenType.EOF):
            value = self.parse_expression()
        self.match(TokenType.NEWLINE)
        return ast.ReturnStatement(value, line=tok.line, column=tok.column)

    def parse_show(self):
        tok = self.advance()  # consume 'show'
        values = [self.parse_expression()]
        while self.match(TokenType.COMMA):
            values.append(self.parse_expression())
        self.match(TokenType.NEWLINE)
        return ast.ShowStatement(values, line=tok.line, column=tok.column)

    def parse_try_catch(self):
        tok = self.advance()  # consume 'try'
        try_body = self.parse_block()
        self.skip_newlines()
        self.expect(TokenType.CATCH, "Expected 'catch' after try block")
        catch_var = None
        if self.current().type == TokenType.IDENTIFIER:
            catch_var = self.advance().value
        catch_body = self.parse_block()

        # Optional finally
        finally_body = None
        self.skip_newlines()
        if self.match(TokenType.FINALLY):
            finally_body = self.parse_block()

        self.match(TokenType.NEWLINE)
        return ast.TryCatch(try_body, catch_var, catch_body, finally_body, line=tok.line, column=tok.column)

    def parse_throw(self):
        tok = self.advance()  # consume 'throw'
        value = self.parse_expression()
        self.match(TokenType.NEWLINE)
        return ast.ThrowStatement(value, line=tok.line, column=tok.column)

    def parse_class(self):
        tok = self.advance()  # consume 'class'
        name = self.expect(TokenType.IDENTIFIER, "Expected class name").value

        # Optional inheritance: class Child < Parent
        parent = None
        if self.match(TokenType.LT):
            parent = self.expect(TokenType.IDENTIFIER, "Expected parent class name").value

        # Optional interface implementation: class Foo impl Bar, Baz
        interfaces = []
        if self.match(TokenType.IMPL):
            interfaces.append(self.expect(TokenType.IDENTIFIER, "Expected interface name").value)
            while self.match(TokenType.COMMA):
                interfaces.append(self.expect(TokenType.IDENTIFIER).value)

        self.skip_newlines()
        self.expect(TokenType.LBRACE, "Expected '{' after class name")
        self.skip_newlines()

        methods = []
        while self.current().type != TokenType.RBRACE:
            if self.at_end():
                self.error("Expected '}' — unclosed class")
            if self.current().type == TokenType.FN:
                fn_tok = self.advance()
                fn_name = self.expect(TokenType.IDENTIFIER).value
                params = self.parse_params()
                body = self.parse_block()
                methods.append(ast.FnStatement(fn_name, params, body, line=fn_tok.line, column=fn_tok.column))
            else:
                self.error("Expected method declaration (fn) in class body")
            self.skip_newlines()

        self.expect(TokenType.RBRACE)
        self.match(TokenType.NEWLINE)
        return ast.ClassStatement(name, methods, parent, interfaces=interfaces, line=tok.line, column=tok.column)

    def parse_match(self):
        tok = self.advance()  # consume 'match'
        subject = self.parse_expression()
        self.skip_newlines()
        self.expect(TokenType.LBRACE, "Expected '{' after match expression")
        self.skip_newlines()

        arms = []
        default = None

        while self.current().type != TokenType.RBRACE:
            if self.at_end():
                self.error("Expected '}' — unclosed match")

            if self.match(TokenType.ELSE):
                default = self.parse_block()
                self.skip_newlines()
                continue

            # when pattern { body }
            self.expect(TokenType.WHEN, "Expected 'when' in match arm")
            pattern = self.parse_expression()
            body = self.parse_block()
            arms.append((pattern, body))
            self.skip_newlines()

        self.expect(TokenType.RBRACE)
        self.match(TokenType.NEWLINE)
        return ast.MatchStatement(subject, arms, default, line=tok.line, column=tok.column)

    def parse_interface(self):
        tok = self.advance()  # consume 'interface'
        name = self.expect(TokenType.IDENTIFIER, "Expected interface name").value
        self.skip_newlines()
        self.expect(TokenType.LBRACE, "Expected '{' after interface name")
        self.skip_newlines()

        method_sigs = []
        while self.current().type != TokenType.RBRACE:
            if self.at_end():
                self.error("Expected '}' — unclosed interface")
            self.expect(TokenType.FN, "Expected method signature (fn) in interface")
            method_name = self.expect(TokenType.IDENTIFIER).value
            params, param_types = self.parse_typed_params()
            return_type = None
            if self.match(TokenType.ARROW):
                return_type = self.expect(TokenType.IDENTIFIER, "Expected return type").value
            method_sigs.append((method_name, params, param_types, return_type))
            self.skip_newlines()

        self.expect(TokenType.RBRACE)
        self.match(TokenType.NEWLINE)
        return ast.InterfaceStatement(name, method_sigs, line=tok.line, column=tok.column)

    def parse_enum(self):
        tok = self.advance()  # consume 'enum'
        name = self.expect(TokenType.IDENTIFIER, "Expected enum name").value
        self.skip_newlines()
        self.expect(TokenType.LBRACE, "Expected '{' after enum name")
        self.skip_newlines()

        members = []
        while self.current().type != TokenType.RBRACE:
            if members:
                self.expect(TokenType.COMMA, "Expected ',' between enum members")
                self.skip_newlines()
                if self.current().type == TokenType.RBRACE:
                    break  # trailing comma
            member_name = self.expect(TokenType.IDENTIFIER, "Expected enum member name").value
            value = None
            if self.match(TokenType.ASSIGN):
                value = self.parse_expression()
            members.append((member_name, value))
            self.skip_newlines()

        self.expect(TokenType.RBRACE)
        self.match(TokenType.NEWLINE)
        return ast.EnumStatement(name, members, line=tok.line, column=tok.column)

    def parse_async_fn(self):
        tok = self.advance()  # consume 'async'
        self.expect(TokenType.FN, "Expected 'fn' after 'async'")
        name_tok = self.expect(TokenType.IDENTIFIER, "Expected function name")
        params, param_types = self.parse_typed_params()
        return_type = None
        if self.match(TokenType.ARROW):
            return_type = self.expect(TokenType.IDENTIFIER, "Expected return type").value
        body = self.parse_block()
        self.match(TokenType.NEWLINE)
        return ast.FnStatement(name_tok.value, params, body, is_async=True, param_types=param_types, return_type=return_type, line=tok.line, column=tok.column)

    def parse_decorated(self):
        """Parse @decorator fn ... — supports stacked decorators."""
        decorators = []
        while self.current().type == TokenType.AT:
            self.advance()  # consume '@'
            decorator_expr = self.parse_postfix()  # allows @mod.cache etc.
            decorators.append(decorator_expr)
            self.skip_newlines()

        # Now parse the function/class being decorated
        if self.current().type == TokenType.FN:
            node = self.parse_fn_declaration()
        elif self.current().type == TokenType.ASYNC:
            node = self.parse_async_fn()
        elif self.current().type == TokenType.CLASS:
            node = self.parse_class()
        else:
            self.error("Expected 'fn', 'async', or 'class' after decorator")

        # Build a DecoratedStatement that stores the original + decorators
        return ast.DecoratedStatement(node, decorators, line=node.line, column=node.column)

    def parse_import(self):
        tok = self.advance()  # consume 'import'

        # import "path/to/file"
        if self.current().type == TokenType.STRING:
            path = self.advance().value
            alias = None
            if self.match(TokenType.AS):
                alias = self.expect(TokenType.IDENTIFIER).value
            self.match(TokenType.NEWLINE)
            return ast.ImportStatement(path=path, alias=alias, line=tok.line, column=tok.column)

        module = self.expect(TokenType.IDENTIFIER, "Expected module name").value
        alias = None
        names = None

        if self.match(TokenType.AS):
            alias = self.expect(TokenType.IDENTIFIER).value
        elif self.match(TokenType.DOT):
            name = self.expect(TokenType.IDENTIFIER).value
            names = [name]

        self.match(TokenType.NEWLINE)
        return ast.ImportStatement(module=module, alias=alias, names=names, line=tok.line, column=tok.column)

    def parse_from_import(self):
        tok = self.advance()  # consume 'from'

        # from "path" import name1, name2
        if self.current().type == TokenType.STRING:
            path = self.advance().value
            self.expect(TokenType.IMPORT, "Expected 'import' after path")
            names = [self.expect(TokenType.IDENTIFIER).value]
            while self.match(TokenType.COMMA):
                names.append(self.expect(TokenType.IDENTIFIER).value)
            self.match(TokenType.NEWLINE)
            return ast.ImportStatement(path=path, names=names, line=tok.line, column=tok.column)

        # from module import name1, name2
        module = self.expect(TokenType.IDENTIFIER).value
        self.expect(TokenType.IMPORT, "Expected 'import' after module name")
        names = [self.expect(TokenType.IDENTIFIER).value]
        while self.match(TokenType.COMMA):
            names.append(self.expect(TokenType.IDENTIFIER).value)
        self.match(TokenType.NEWLINE)
        return ast.ImportStatement(module=module, names=names, line=tok.line, column=tok.column)

    def parse_expression_statement(self):
        expr = self.parse_expression()

        assign_ops = {
            TokenType.ASSIGN: "=",
            TokenType.PLUS_ASSIGN: "+=",
            TokenType.MINUS_ASSIGN: "-=",
            TokenType.STAR_ASSIGN: "*=",
            TokenType.SLASH_ASSIGN: "/=",
        }

        # Multi-assignment: a, b = x, y
        if self.current().type == TokenType.COMMA:
            targets = [expr]
            while self.match(TokenType.COMMA):
                targets.append(self.parse_expression())
            if self.current().type == TokenType.ASSIGN:
                self.advance()  # consume '='
                values = [self.parse_expression()]
                while self.match(TokenType.COMMA):
                    values.append(self.parse_expression())
                self.match(TokenType.NEWLINE)
                return ast.MultiAssignStatement(targets, values, line=expr.line, column=expr.column)
            else:
                # Not an assignment — treat the last parsed as expression statement
                # This shouldn't typically happen, but handle gracefully
                self.match(TokenType.NEWLINE)
                return ast.ExpressionStatement(targets[-1], line=targets[-1].line, column=targets[-1].column)

        if self.current().type in assign_ops:
            op_tok = self.advance()
            value = self.parse_expression()
            self.match(TokenType.NEWLINE)
            return ast.AssignStatement(
                expr, assign_ops[op_tok.type], value,
                line=expr.line, column=expr.column
            )

        self.match(TokenType.NEWLINE)
        return ast.ExpressionStatement(expr, line=expr.line, column=expr.column)

    # ── Expressions (precedence climbing) ────────────────

    def parse_expression(self):
        return self.parse_pipe()

    def parse_pipe(self):
        expr = self.parse_null_coalesce()
        while True:
            # Allow pipe on next line: expr \n |> ...
            saved = self.pos
            self.skip_newlines()
            if self.match(TokenType.PIPE):
                right = self.parse_null_coalesce()
                expr = ast.PipeExpression(expr, right, line=expr.line, column=expr.column)
            else:
                self.pos = saved
                break
        return expr

    def parse_null_coalesce(self):
        expr = self.parse_or()
        while self.match(TokenType.QUESTION_QUESTION):
            right = self.parse_or()
            expr = ast.NullCoalesce(expr, right, line=expr.line, column=expr.column)
        return expr

    def parse_or(self):
        expr = self.parse_and()
        while self.match(TokenType.OR):
            right = self.parse_and()
            expr = ast.BinaryOp(expr, "or", right, line=expr.line, column=expr.column)
        return expr

    def parse_and(self):
        expr = self.parse_bit_or()
        while self.match(TokenType.AND):
            right = self.parse_bit_or()
            expr = ast.BinaryOp(expr, "and", right, line=expr.line, column=expr.column)
        return expr

    def parse_bit_or(self):
        expr = self.parse_bit_xor()
        while self.match(TokenType.BIT_OR):
            right = self.parse_bit_xor()
            expr = ast.BinaryOp(expr, "|", right, line=expr.line, column=expr.column)
        return expr

    def parse_bit_xor(self):
        expr = self.parse_bit_and()
        while self.match(TokenType.CARET):
            right = self.parse_bit_and()
            expr = ast.BinaryOp(expr, "^", right, line=expr.line, column=expr.column)
        return expr

    def parse_bit_and(self):
        expr = self.parse_equality()
        while self.match(TokenType.AMPERSAND):
            right = self.parse_equality()
            expr = ast.BinaryOp(expr, "&", right, line=expr.line, column=expr.column)
        return expr

    def parse_equality(self):
        expr = self.parse_comparison()
        while True:
            if self.match(TokenType.EQ):
                right = self.parse_comparison()
                expr = ast.BinaryOp(expr, "==", right, line=expr.line, column=expr.column)
            elif self.match(TokenType.NEQ):
                right = self.parse_comparison()
                expr = ast.BinaryOp(expr, "!=", right, line=expr.line, column=expr.column)
            elif self.match(TokenType.IS):
                right = self.parse_comparison()
                expr = ast.BinaryOp(expr, "is", right, line=expr.line, column=expr.column)
            else:
                break
        return expr

    def parse_comparison(self):
        expr = self.parse_shift()
        while True:
            if self.match(TokenType.LT):
                right = self.parse_shift()
                expr = ast.BinaryOp(expr, "<", right, line=expr.line, column=expr.column)
            elif self.match(TokenType.GT):
                right = self.parse_shift()
                expr = ast.BinaryOp(expr, ">", right, line=expr.line, column=expr.column)
            elif self.match(TokenType.LTE):
                right = self.parse_shift()
                expr = ast.BinaryOp(expr, "<=", right, line=expr.line, column=expr.column)
            elif self.match(TokenType.GTE):
                right = self.parse_shift()
                expr = ast.BinaryOp(expr, ">=", right, line=expr.line, column=expr.column)
            else:
                break
        return expr

    def parse_shift(self):
        expr = self.parse_range()
        while True:
            if self.match(TokenType.LSHIFT):
                right = self.parse_range()
                expr = ast.BinaryOp(expr, "<<", right, line=expr.line, column=expr.column)
            elif self.match(TokenType.RSHIFT):
                right = self.parse_range()
                expr = ast.BinaryOp(expr, ">>", right, line=expr.line, column=expr.column)
            else:
                break
        return expr

    def parse_range(self):
        expr = self.parse_addition()
        if self.match(TokenType.DOTDOT):
            # Open-ended range (e.g., 3.. inside [3..])
            if self.current().type in (TokenType.RBRACKET, TokenType.EOF, TokenType.NEWLINE, TokenType.RPAREN):
                expr = ast.RangeExpression(expr, None, line=expr.line, column=expr.column)
            else:
                end = self.parse_addition()
                expr = ast.RangeExpression(expr, end, line=expr.line, column=expr.column)
        return expr

    def parse_addition(self):
        expr = self.parse_multiplication()
        while True:
            if self.match(TokenType.PLUS):
                right = self.parse_multiplication()
                expr = ast.BinaryOp(expr, "+", right, line=expr.line, column=expr.column)
            elif self.match(TokenType.MINUS):
                right = self.parse_multiplication()
                expr = ast.BinaryOp(expr, "-", right, line=expr.line, column=expr.column)
            else:
                break
        return expr

    def parse_multiplication(self):
        expr = self.parse_power()
        while True:
            if self.match(TokenType.STAR):
                right = self.parse_power()
                expr = ast.BinaryOp(expr, "*", right, line=expr.line, column=expr.column)
            elif self.match(TokenType.SLASH):
                right = self.parse_power()
                expr = ast.BinaryOp(expr, "/", right, line=expr.line, column=expr.column)
            elif self.match(TokenType.PERCENT):
                right = self.parse_power()
                expr = ast.BinaryOp(expr, "%", right, line=expr.line, column=expr.column)
            else:
                break
        return expr

    def parse_power(self):
        expr = self.parse_unary()
        if self.match(TokenType.POWER):
            right = self.parse_unary()
            expr = ast.BinaryOp(expr, "**", right, line=expr.line, column=expr.column)
        return expr

    def parse_unary(self):
        if self.match(TokenType.MINUS):
            operand = self.parse_unary()
            return ast.UnaryOp("-", operand, line=operand.line, column=operand.column)
        if self.match(TokenType.NOT):
            operand = self.parse_unary()
            return ast.UnaryOp("not", operand, line=operand.line, column=operand.column)
        if self.match(TokenType.TILDE):
            operand = self.parse_unary()
            return ast.UnaryOp("~", operand, line=operand.line, column=operand.column)
        return self.parse_postfix()

    def parse_postfix(self):
        expr = self.parse_primary()
        while True:
            if self.current().type == TokenType.LPAREN:
                expr = self.parse_call(expr)
            elif self.match(TokenType.DOT):
                prop = self._expect_property_name()
                expr = ast.MemberExpression(expr, prop, line=expr.line, column=expr.column)
            elif self.match(TokenType.QUESTION_DOT):
                prop = self._expect_property_name()
                expr = ast.OptionalMemberExpression(expr, prop, line=expr.line, column=expr.column)
            elif self.current().type == TokenType.LBRACKET:
                self.advance()
                # Check for slice: [..end]
                if self.current().type == TokenType.DOTDOT:
                    self.advance()
                    end = self.parse_expression()
                    self.expect(TokenType.RBRACKET, "Expected ']'")
                    expr = ast.SliceExpression(expr, None, end, line=expr.line, column=expr.column)
                else:
                    index = self.parse_expression()
                    # parse_expression may have parsed a RangeExpression (e.g. 1..3)
                    # Convert it to a SliceExpression in bracket context
                    if isinstance(index, ast.RangeExpression):
                        self.expect(TokenType.RBRACKET, "Expected ']'")
                        expr = ast.SliceExpression(expr, index.start, index.end, line=expr.line, column=expr.column)
                    else:
                        self.expect(TokenType.RBRACKET, "Expected ']'")
                        expr = ast.IndexExpression(expr, index, line=expr.line, column=expr.column)
            else:
                break
        return expr

    def parse_call(self, callee):
        self.expect(TokenType.LPAREN)
        args = []
        while self.current().type != TokenType.RPAREN:
            if args:
                self.expect(TokenType.COMMA, "Expected ',' between arguments")
            self.skip_newlines()
            # Spread in args: ...expr
            if self.current().type == TokenType.SPREAD:
                spread_tok = self.advance()
                arg = self.parse_expression()
                args.append(ast.SpreadExpression(arg, line=spread_tok.line, column=spread_tok.column))
            else:
                args.append(self.parse_expression())
            self.skip_newlines()
        self.expect(TokenType.RPAREN)
        return ast.CallExpression(callee, args, line=callee.line, column=callee.column)

    def parse_primary(self):
        tok = self.current()

        if tok.type == TokenType.NUMBER:
            self.advance()
            return ast.NumberLiteral(tok.value, line=tok.line, column=tok.column)

        if tok.type == TokenType.STRING:
            self.advance()
            return ast.StringLiteral(tok.value, line=tok.line, column=tok.column)

        if tok.type == TokenType.RAW_STRING:
            self.advance()
            return ast.StringLiteral(tok.value, line=tok.line, column=tok.column, raw=True)

        if tok.type == TokenType.TRUE:
            self.advance()
            return ast.BoolLiteral(True, line=tok.line, column=tok.column)
        if tok.type == TokenType.FALSE:
            self.advance()
            return ast.BoolLiteral(False, line=tok.line, column=tok.column)

        if tok.type == TokenType.NULL:
            self.advance()
            return ast.NullLiteral(line=tok.line, column=tok.column)

        if tok.type == TokenType.THIS:
            self.advance()
            return ast.ThisExpression(line=tok.line, column=tok.column)

        if tok.type == TokenType.IDENTIFIER:
            # Check for lambda: x => expr
            if self.peek(1).type == TokenType.FAT_ARROW:
                self.advance()  # consume identifier
                self.advance()  # consume =>
                body_expr = self.parse_pipe()
                body = ast.Block([
                    ast.ReturnStatement(body_expr, line=body_expr.line, column=body_expr.column)
                ], line=tok.line, column=tok.column)
                return ast.FnExpression([tok.value], body, line=tok.line, column=tok.column)
            self.advance()
            return ast.Identifier(tok.value, line=tok.line, column=tok.column)

        if tok.type == TokenType.ASK:
            return self.parse_ask()

        if tok.type == TokenType.FN:
            return self.parse_fn_expression()

        # Inline if expression: if cond { a } else { b }
        if tok.type == TokenType.IF:
            return self.parse_if_expression()

        if tok.type == TokenType.LPAREN:
            # Check for arrow lambda: (x, y) => expr or () => expr
            if self._is_arrow_lambda():
                return self._parse_arrow_lambda()
            self.advance()
            expr = self.parse_expression()
            self.expect(TokenType.RPAREN, "Expected ')'")
            return expr

        if tok.type == TokenType.LBRACKET:
            return self.parse_list()

        if tok.type == TokenType.LBRACE:
            return self.parse_map()

        # await expression
        if tok.type == TokenType.AWAIT:
            self.advance()
            value = self.parse_expression()
            return ast.AwaitExpression(value, line=tok.line, column=tok.column)

        # yield expression
        if tok.type == TokenType.YIELD:
            self.advance()
            value = None
            if self.current().type not in (TokenType.NEWLINE, TokenType.RBRACE, TokenType.EOF, TokenType.RPAREN, TokenType.RBRACKET, TokenType.COMMA):
                value = self.parse_expression()
            return ast.YieldExpression(value, line=tok.line, column=tok.column)

        # Spread in expression context
        if tok.type == TokenType.SPREAD:
            self.advance()
            expr = self.parse_unary()
            return ast.SpreadExpression(expr, line=tok.line, column=tok.column)

        self.error(f"Unexpected token: {tok.type.name} ({tok.value!r})")

    def parse_if_expression(self):
        tok = self.advance()  # consume 'if'
        condition = self.parse_expression()
        self.skip_newlines()
        self.expect(TokenType.LBRACE, "Expected '{'")
        self.skip_newlines()
        true_expr = self.parse_expression()
        self.skip_newlines()
        self.expect(TokenType.RBRACE, "Expected '}'")
        self.skip_newlines()
        self.expect(TokenType.ELSE, "Expected 'else' in if expression")
        self.skip_newlines()
        self.expect(TokenType.LBRACE, "Expected '{'")
        self.skip_newlines()
        false_expr = self.parse_expression()
        self.skip_newlines()
        self.expect(TokenType.RBRACE, "Expected '}'")
        return ast.IfExpression(condition, true_expr, false_expr, line=tok.line, column=tok.column)

    def parse_fn_expression(self):
        tok = self.advance()  # consume 'fn'
        params = self.parse_params()
        body = self.parse_block()
        return ast.FnExpression(params, body, line=tok.line, column=tok.column)

    def parse_ask(self):
        tok = self.advance()  # consume 'ask'
        self.expect(TokenType.LPAREN)
        prompt = self.parse_expression()
        self.expect(TokenType.RPAREN)
        return ast.AskExpression(prompt, line=tok.line, column=tok.column)

    def parse_list(self):
        tok = self.advance()  # consume '['
        elements = []
        self.skip_newlines()

        if self.current().type == TokenType.RBRACKET:
            self.expect(TokenType.RBRACKET)
            return ast.ListLiteral(elements, line=tok.line, column=tok.column)

        # Parse first element (could be spread)
        if self.current().type == TokenType.SPREAD:
            spread_tok = self.advance()
            first = ast.SpreadExpression(self.parse_expression(), line=spread_tok.line, column=spread_tok.column)
        else:
            first = self.parse_expression()

        # Check for comprehension: [expr for x in iterable]
        self.skip_newlines()
        if self.current().type == TokenType.FOR and not isinstance(first, ast.SpreadExpression):
            self.advance()  # consume 'for'
            var_name = self.expect(TokenType.IDENTIFIER).value
            self.expect(TokenType.IN)
            iterable = self.parse_expression()
            condition = None
            self.skip_newlines()
            if self.current().type == TokenType.IF:
                self.advance()
                condition = self.parse_expression()
            self.skip_newlines()
            self.expect(TokenType.RBRACKET)
            return ast.ComprehensionExpression(first, var_name, iterable, condition, line=tok.line, column=tok.column)

        elements.append(first)
        self.skip_newlines()
        while self.match(TokenType.COMMA):
            self.skip_newlines()
            if self.current().type == TokenType.RBRACKET:
                break  # trailing comma
            if self.current().type == TokenType.SPREAD:
                spread_tok = self.advance()
                elements.append(ast.SpreadExpression(self.parse_expression(), line=spread_tok.line, column=spread_tok.column))
            else:
                elements.append(self.parse_expression())
            self.skip_newlines()

        self.expect(TokenType.RBRACKET)
        return ast.ListLiteral(elements, line=tok.line, column=tok.column)

    def parse_map(self):
        tok = self.advance()  # consume '{'
        pairs = []
        self.skip_newlines()
        while self.current().type != TokenType.RBRACE:
            if pairs:
                self.expect(TokenType.COMMA, "Expected ',' between map entries")
            self.skip_newlines()

            # Spread in map: ...expr
            if self.current().type == TokenType.SPREAD:
                spread_tok = self.advance()
                spread_val = self.parse_expression()
                pairs.append((None, ast.SpreadExpression(spread_val, line=spread_tok.line, column=spread_tok.column)))
                self.skip_newlines()
                continue

            # Parse key — allow expressions (e.g., str(x), computed keys)
            # But optimize the common case: identifier or string literal
            is_first = len(pairs) == 0
            key = self._parse_map_key(is_first=is_first)

            self.expect(TokenType.COLON, "Expected ':' after map key")
            value = self.parse_expression()

            # Check for map comprehension: {key: value for x in iterable}
            self.skip_newlines()
            if self.current().type == TokenType.FOR and is_first:
                self.advance()  # consume 'for'
                variables = [self.expect(TokenType.IDENTIFIER).value]
                while self.match(TokenType.COMMA):
                    variables.append(self.expect(TokenType.IDENTIFIER).value)
                self.expect(TokenType.IN)
                iterable = self.parse_expression()
                condition = None
                self.skip_newlines()
                if self.current().type == TokenType.IF:
                    self.advance()
                    condition = self.parse_expression()
                self.skip_newlines()
                self.expect(TokenType.RBRACE)
                return ast.MapComprehensionExpression(
                    key, value, variables, iterable, condition,
                    line=tok.line, column=tok.column
                )

            # If first entry was parsed as Identifier, convert to StringLiteral for normal map
            if is_first and isinstance(key, ast.Identifier):
                key = ast.StringLiteral(key.name, line=key.line, column=key.column)

            pairs.append((key, value))
            self.skip_newlines()

        self.expect(TokenType.RBRACE)
        return ast.MapLiteral(pairs, line=tok.line, column=tok.column)

    def _parse_map_key(self, is_first=False):
        """Parse a map key — identifier (as string), string literal, or expression.

        For the first entry, we may need to detect comprehension, so we check
        if the identifier-colon pattern is a comprehension variable reference.
        """
        key_tok = self.current()

        # Simple identifier key: {name: value} → key is the string "name"
        if key_tok.type == TokenType.IDENTIFIER:
            # Peek ahead: if next is ':', it's potentially a plain identifier key
            # If next is '(' or other, it's an expression key like str(x)
            if self.peek(1).type == TokenType.COLON:
                if is_first:
                    # Could be comprehension — check for 'for' after value
                    # Return both a string literal AND an identifier, let caller decide
                    self.advance()
                    # Return a special marker — we'll use Identifier here so that
                    # if it's a comprehension, we treat it as a variable reference
                    return ast.Identifier(key_tok.value, line=key_tok.line, column=key_tok.column)
                else:
                    self.advance()
                    return ast.StringLiteral(key_tok.value, line=key_tok.line, column=key_tok.column)
            else:
                # Expression key — parse full expression
                return self.parse_expression()

        if key_tok.type == TokenType.STRING:
            self.advance()
            return ast.StringLiteral(key_tok.value, line=key_tok.line, column=key_tok.column)

        if key_tok.type == TokenType.NUMBER:
            self.advance()
            return ast.NumberLiteral(key_tok.value, line=key_tok.line, column=key_tok.column)

        # Allow keywords as map keys: {show: "...", match: "...", class: "..."}
        keyword_names = {
            TokenType.SHOW: "show", TokenType.MATCH: "match", TokenType.CLASS: "class",
            TokenType.IF: "if", TokenType.ELSE: "else", TokenType.FOR: "for",
            TokenType.WHILE: "while", TokenType.RETURN: "return", TokenType.LET: "let",
            TokenType.MUT: "mut", TokenType.FN: "fn", TokenType.TRY: "try",
            TokenType.CATCH: "catch", TokenType.IMPORT: "import", TokenType.FROM: "from",
            TokenType.ENUM: "enum", TokenType.BREAK: "break", TokenType.CONTINUE: "continue",
            TokenType.THROW: "throw", TokenType.ASYNC: "async", TokenType.AWAIT: "await",
            TokenType.YIELD: "yield", TokenType.INTERFACE: "interface", TokenType.ASK: "ask",
            TokenType.WHEN: "when", TokenType.THIS: "this", TokenType.IMPL: "impl",
            TokenType.IN: "in", TokenType.AS: "as", TokenType.FINALLY: "finally",
        }
        if key_tok.type in keyword_names and self.peek(1).type == TokenType.COLON:
            self.advance()
            return ast.StringLiteral(keyword_names[key_tok.type], line=key_tok.line, column=key_tok.column)

        # Any other expression as key
        return self.parse_expression()


    def _is_arrow_lambda(self):
        """Look ahead to see if (...)  => pattern."""
        saved = self.pos
        try:
            if self.current().type != TokenType.LPAREN:
                return False
            depth = 0
            i = self.pos
            while i < len(self.tokens):
                t = self.tokens[i]
                if t.type == TokenType.LPAREN:
                    depth += 1
                elif t.type == TokenType.RPAREN:
                    depth -= 1
                    if depth == 0:
                        # Check if next token is =>
                        if i + 1 < len(self.tokens) and self.tokens[i + 1].type == TokenType.FAT_ARROW:
                            return True
                        return False
                elif t.type == TokenType.EOF:
                    return False
                i += 1
            return False
        finally:
            self.pos = saved

    def _parse_arrow_lambda(self):
        """Parse (x, y) => expr  or  () => expr."""
        tok = self.current()
        self.advance()  # consume '('
        params = []
        while self.current().type != TokenType.RPAREN:
            if params:
                self.expect(TokenType.COMMA)
            if self.current().type == TokenType.SPREAD:
                self.advance()
                param = self.expect(TokenType.IDENTIFIER).value
                params.append("..." + param)
            else:
                params.append(self.expect(TokenType.IDENTIFIER).value)
        self.expect(TokenType.RPAREN)
        self.expect(TokenType.FAT_ARROW, "Expected '=>' after parameters")

        # Body can be a single expression or a block
        if self.current().type == TokenType.LBRACE:
            body = self.parse_block()
        else:
            body_expr = self.parse_pipe()
            body = ast.Block([
                ast.ReturnStatement(body_expr, line=body_expr.line, column=body_expr.column)
            ], line=tok.line, column=tok.column)
        return ast.FnExpression(params, body, line=tok.line, column=tok.column)


def parse(tokens, source=""):
    """Convenience function to parse tokens into AST."""
    return Parser(tokens, source).parse()
