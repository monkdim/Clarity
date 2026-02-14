"""Tests for Clarity documentation generator."""

import unittest
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clarity.docgen import (
    DocExtractor, FunctionDoc, ClassDoc, EnumDoc, InterfaceDoc, ConstantDoc,
    extract_doc_comment, generate_docs, format_markdown, format_terminal,
)
from clarity.lexer import tokenize
from clarity.parser import parse


def _parse(source):
    tokens = tokenize(source)
    return parse(tokens, source)


class TestExtractDocComment(unittest.TestCase):

    def test_single_line_dash(self):
        lines = ["-- This is a doc comment", "fn foo() {}"]
        result = extract_doc_comment(lines, 2)
        self.assertEqual(result, "This is a doc comment")

    def test_single_line_slash(self):
        lines = ["// This is a doc comment", "fn foo() {}"]
        result = extract_doc_comment(lines, 2)
        self.assertEqual(result, "This is a doc comment")

    def test_multi_line(self):
        lines = ["-- Line one", "-- Line two", "fn foo() {}"]
        result = extract_doc_comment(lines, 3)
        self.assertEqual(result, "Line one\nLine two")

    def test_no_comment(self):
        lines = ["let x = 1", "fn foo() {}"]
        result = extract_doc_comment(lines, 2)
        self.assertEqual(result, "")

    def test_gap_breaks_comment(self):
        lines = ["-- Orphan comment", "", "fn foo() {}"]
        result = extract_doc_comment(lines, 3)
        self.assertEqual(result, "")

    def test_first_line(self):
        lines = ["fn foo() {}"]
        result = extract_doc_comment(lines, 1)
        self.assertEqual(result, "")


class TestFunctionDocExtraction(unittest.TestCase):

    def test_simple_function(self):
        source = "fn add(a, b) { return a + b }"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertEqual(len(entries), 1)
        self.assertIsInstance(entries[0], FunctionDoc)
        self.assertEqual(entries[0].name, "add")
        self.assertEqual(entries[0].params, ["a", "b"])

    def test_function_with_doc(self):
        source = "-- Adds two numbers\nfn add(a, b) { return a + b }"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertEqual(entries[0].doc, "Adds two numbers")

    def test_typed_function(self):
        source = "fn greet(name: string) -> string { return name }"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        fn = entries[0]
        self.assertEqual(fn.param_types.get("name"), "string")
        self.assertEqual(fn.return_type, "string")
        self.assertIn("string", fn.signature)

    def test_async_function(self):
        source = "async fn fetch(url) { return url }"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertTrue(entries[0].is_async)
        self.assertIn("async", entries[0].signature)

    def test_multi_line_doc(self):
        source = "-- First line\n-- Second line\nfn foo() { return 1 }"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertIn("First line", entries[0].doc)
        self.assertIn("Second line", entries[0].doc)


class TestClassDocExtraction(unittest.TestCase):

    def test_simple_class(self):
        source = "class Dog { fn bark() { show \"woof\" } }"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertEqual(len(entries), 1)
        self.assertIsInstance(entries[0], ClassDoc)
        self.assertEqual(entries[0].name, "Dog")

    def test_class_with_doc(self):
        source = "-- A loyal companion\nclass Dog { fn bark() { show \"woof\" } }"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertEqual(entries[0].doc, "A loyal companion")

    def test_class_methods(self):
        source = """class Dog {
    -- Make noise
    fn bark() { show "woof" }
    fn sit() { show "sitting" }
}"""
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        cls = entries[0]
        self.assertEqual(len(cls.methods), 2)
        self.assertEqual(cls.methods[0].name, "bark")
        self.assertEqual(cls.methods[0].doc, "Make noise")

    def test_class_with_parent(self):
        source = "class Puppy < Dog { fn play() { show \"playing\" } }"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertEqual(entries[0].parent, "Dog")
        self.assertIn("extends", entries[0].signature)


class TestEnumDocExtraction(unittest.TestCase):

    def test_simple_enum(self):
        source = "enum Color { Red, Green, Blue }"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertEqual(len(entries), 1)
        self.assertIsInstance(entries[0], EnumDoc)
        self.assertEqual(entries[0].name, "Color")
        self.assertGreater(len(entries[0].members), 0)

    def test_enum_with_doc(self):
        source = "-- Primary colors\nenum Color { Red, Green, Blue }"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertEqual(entries[0].doc, "Primary colors")


class TestConstantDocExtraction(unittest.TestCase):

    def test_documented_constant(self):
        source = "-- Maximum retries\nlet MAX_RETRIES = 3"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertEqual(len(entries), 1)
        self.assertIsInstance(entries[0], ConstantDoc)
        self.assertEqual(entries[0].name, "MAX_RETRIES")

    def test_undocumented_constant_skipped(self):
        source = "let x = 42"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertEqual(len(entries), 0)

    def test_typed_constant(self):
        source = "-- Pi value\nlet PI: number = 3.14"
        tree = _parse(source)
        entries = DocExtractor(source, tree).extract()
        self.assertEqual(entries[0].type_annotation, "number")


class TestMarkdownOutput(unittest.TestCase):

    def test_markdown_has_title(self):
        source = "-- Add numbers\nfn add(a, b) { return a + b }"
        result = generate_docs(source, output_format="markdown")
        self.assertIn("# ", result)

    def test_markdown_has_function(self):
        source = "fn hello() { show \"hi\" }"
        result = generate_docs(source, output_format="markdown")
        self.assertIn("fn hello()", result)

    def test_markdown_has_sections(self):
        source = "fn a() { return 1 }\nenum Color { Red }"
        result = generate_docs(source, output_format="markdown")
        self.assertIn("## Functions", result)
        self.assertIn("## Enums", result)

    def test_markdown_class_methods(self):
        source = "class Dog { fn bark() { show \"woof\" } }"
        result = generate_docs(source, output_format="markdown")
        self.assertIn("Methods", result)
        self.assertIn("bark", result)


class TestJsonOutput(unittest.TestCase):

    def test_valid_json(self):
        source = "fn hello() { show \"hi\" }"
        result = generate_docs(source, output_format="json")
        data = json.loads(result)
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["name"], "hello")
        self.assertEqual(data[0]["kind"], "function")

    def test_json_class(self):
        source = "class Foo { fn bar() { return 1 } }"
        result = generate_docs(source, output_format="json")
        data = json.loads(result)
        self.assertEqual(data[0]["kind"], "class")
        self.assertIn("methods", data[0])


class TestTerminalOutput(unittest.TestCase):

    def test_terminal_output(self):
        source = "fn hello() { show \"hi\" }"
        result = generate_docs(source, output_format="terminal")
        self.assertIn("hello", result)

    def test_terminal_class(self):
        source = "class Dog { fn bark() { show \"woof\" } }"
        result = generate_docs(source, output_format="terminal")
        self.assertIn("Dog", result)
        self.assertIn("bark", result)


class TestEntriesOutput(unittest.TestCase):

    def test_returns_list(self):
        source = "fn a() { return 1 }\nfn b() { return 2 }"
        result = generate_docs(source, output_format="entries")
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 2)

    def test_mixed_types(self):
        source = "fn a() { return 1 }\nenum Color { Red }\nclass Dog { fn bark() { show \"woof\" } }"
        result = generate_docs(source, output_format="entries")
        kinds = {e.kind for e in result}
        self.assertIn("function", kinds)
        self.assertIn("enum", kinds)
        self.assertIn("class", kinds)


class TestFunctionDocSignature(unittest.TestCase):

    def test_basic_sig(self):
        doc = FunctionDoc("add", 1, params=["a", "b"])
        self.assertEqual(doc.signature, "fn add(a, b)")

    def test_typed_sig(self):
        doc = FunctionDoc("greet", 1, params=["name"], param_types={"name": "string"}, return_type="string")
        self.assertEqual(doc.signature, "fn greet(name: string) -> string")

    def test_async_sig(self):
        doc = FunctionDoc("fetch", 1, params=["url"], is_async=True)
        self.assertEqual(doc.signature, "async fn fetch(url)")


class TestParseError(unittest.TestCase):

    def test_bad_source(self):
        result = generate_docs("fn {{{", output_format="terminal")
        self.assertIn("error", result.lower())


if __name__ == "__main__":
    unittest.main()
