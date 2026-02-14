"""Clarity CLI — run, repl, compile, package management, LSP."""

import sys
import os

from . import __version__
from .lexer import tokenize
from .parser import parse
from .interpreter import Interpreter
from .errors import ClarityError


BANNER = f"""
   +===================================+
   |         C L A R I T Y             |
   |      v{__version__:.<26s} |
   |   Simple code. Real power.        |
   +===================================+
"""

HELP = """
Usage: clarity <command> [args]

Commands:
  run <file.clarity>    Run a Clarity program
  shell                 Start Clarity Shell (interactive terminal)
  repl                  Start interactive REPL (basic)
  check <file.clarity>  Check syntax (--types for type checking)
  lint <file|dir>       Lint code for common issues
  debug <file.clarity>  Interactive step-through debugger
  profile <file>        Profile execution (time, calls, hotspots)
  doc <file|dir>        Generate documentation (--md, --json, -o)
  fmt <file|dir>        Format Clarity code (--check, --write)
  test [dir]            Run test files (test_*.clarity)
  compile <file>        Compile to bytecode and show disassembly
  tokens <file>         Show lexer output (debug)
  ast <file>            Show parser output (debug)
  init                  Create a new clarity.toml
  install               Install dependencies from clarity.toml
  lsp                   Start language server (for editors)
  help                  Show this help message
  version               Show version

Examples:
  clarity shell
  clarity run hello.clarity
  clarity check file.clarity --types
  clarity lint stdlib/
  clarity debug app.clarity
  clarity profile app.clarity
  clarity doc stdlib/ --md -o docs.md
  clarity fmt stdlib/ --write
  clarity test tests/
"""


def main():
    # Increase recursion limit for deeply nested Clarity source files
    sys.setrecursionlimit(3000)

    args = sys.argv[1:]

    # Default: self-hosted Clarity CLI (written in Clarity itself).
    # Use --python to fall back to the legacy Python CLI.
    if args and args[0] == "--python":
        args = args[1:]  # Strip --python flag, continue with Python CLI below
    elif args and args[0] == "--self-hosted":
        # Explicit --self-hosted kept for backward compat
        run_self_hosted(args[1:])
        return
    else:
        # Default: delegate everything to the self-hosted CLI
        run_self_hosted(args)
        return

    # ── Legacy Python CLI (invoked with clarity --python ...) ──

    if not args:
        # No args: launch the Clarity Shell
        start_shell()
        return

    if args[0] in ("help", "--help", "-h"):
        print(BANNER)
        print(HELP)
        return

    if args[0] in ("version", "--version", "-v"):
        print(f"Clarity v{__version__}")
        return

    command = args[0]

    if command == "run":
        if len(args) < 2:
            print("Usage: clarity run <file.clarity> [--watch]")
            sys.exit(1)
        if '--watch' in args:
            watch_file(args[1])
        else:
            run_file(args[1])

    elif command == "shell":
        start_shell()

    elif command == "repl":
        repl()

    elif command == "check":
        if len(args) < 2:
            print("Usage: clarity check <file.clarity> [--types]")
            sys.exit(1)
        check_file(args[1], type_check='--types' in args)

    elif command == "lint":
        lint_command(args[1:])

    elif command == "debug":
        if len(args) < 2:
            print("Usage: clarity debug <file.clarity>")
            sys.exit(1)
        from .debugger import debug_file
        debug_file(args[1])

    elif command == "profile":
        if len(args) < 2:
            print("Usage: clarity profile <file.clarity>")
            sys.exit(1)
        from .profiler import profile_file
        profile_file(args[1])

    elif command == "doc":
        if len(args) < 2:
            print("Usage: clarity doc <file|dir> [--md|--json] [-o output]")
            sys.exit(1)
        from .docgen import doc_file, doc_dir
        target = args[1]
        fmt = "terminal"
        if "--md" in args:
            fmt = "markdown"
        elif "--json" in args:
            fmt = "json"
        output_path = None
        if "-o" in args:
            oi = args.index("-o")
            if oi + 1 < len(args):
                output_path = args[oi + 1]
        if os.path.isdir(target):
            doc_dir(target, output_format=fmt, output_path=output_path)
        else:
            doc_file(target, output_format=fmt, output_path=output_path)

    elif command == "compile":
        if len(args) < 2:
            print("Usage: clarity compile <file.clarity>")
            sys.exit(1)
        compile_file(args[1])

    elif command == "tokens":
        if len(args) < 2:
            print("Usage: clarity tokens <file.clarity>")
            sys.exit(1)
        show_tokens(args[1])

    elif command == "ast":
        if len(args) < 2:
            print("Usage: clarity ast <file.clarity>")
            sys.exit(1)
        show_ast(args[1])

    elif command == "init":
        from .package import init_package
        init_package()

    elif command == "install":
        from .package import install_packages, add_package
        if len(args) >= 2:
            # clarity install <name> --path <path>
            name = args[1]
            spec = {"path": args[3]} if len(args) >= 4 and args[2] == "--path" else args[1]
            add_package(name, spec)
        else:
            install_packages()

    elif command == "fmt":
        fmt_command(args[1:])

    elif command == "test":
        test_command(args[1:])

    elif command == "lsp":
        from .lsp import start_server
        start_server()

    else:
        # If arg is a file path, run it directly
        if os.path.isfile(command) and command.endswith(".clarity"):
            run_file(command)
        else:
            print(f"Unknown command: {command}")
            print("Run 'clarity help' for usage.")
            sys.exit(1)


def run_self_hosted(remaining_args):
    """Run the Clarity CLI written in Clarity (self-hosted mode).

    This is the bridge: Python bootstraps the Clarity interpreter,
    which then runs stdlib/cli.clarity, which handles all commands.
    When Clarity compiles to native code, this bootstrap disappears.
    """
    pkg_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(pkg_dir)
    cli_clarity = os.path.join(project_root, "stdlib", "cli.clarity")

    if not os.path.exists(cli_clarity):
        print(f"  >> Self-hosted CLI not found: {cli_clarity}")
        sys.exit(1)

    # Inject the remaining args so the Clarity CLI can read them
    # The Clarity `args()` builtin reads from sys.argv[1:]
    sys.argv = ["clarity"] + remaining_args

    run_file(cli_clarity)


def start_shell():
    """Launch the Clarity Shell — an interactive terminal written in Clarity."""
    # Find stdlib/repl.clarity relative to this package
    pkg_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(pkg_dir)
    repl_path = os.path.join(project_root, "stdlib", "repl.clarity")

    if not os.path.exists(repl_path):
        # Try installed location (stdlib might be alongside the package)
        alt_path = os.path.join(pkg_dir, "stdlib", "repl.clarity")
        if os.path.exists(alt_path):
            repl_path = alt_path
        else:
            print(f"  >> Clarity Shell not found at: {repl_path}")
            print("  >> Make sure stdlib/repl.clarity exists in your Clarity installation.")
            sys.exit(1)

    run_file(repl_path)


def run_file(path):
    if not os.path.exists(path):
        print(f"  >> File not found: {path}")
        sys.exit(1)

    with open(path, "r") as f:
        source = f.read()

    try:
        tokens = tokenize(source, path)
        tree = parse(tokens, source)
        interp = Interpreter(source_dir=os.path.dirname(os.path.abspath(path)))
        interp.run(tree)
    except ClarityError as e:
        print(f"\nClarity Error in {path}:{e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n  -- Interrupted --")
    except SystemExit:
        raise
    except Exception as e:
        print(f"\nInternal error: {e}")
        sys.exit(1)


def run_source(source, interp=None):
    """Run Clarity source code. Used by REPL and tests."""
    interp = interp or Interpreter()
    tokens = tokenize(source)
    tree = parse(tokens, source)
    return interp.run(tree)


def repl():
    print(BANNER)
    print("  Type Clarity code. Use 'quit' or Ctrl+C to exit.")
    print("  Features: history (up/down), tab completion, multi-line.\n")

    interp = Interpreter()
    buffer = []
    brace_depth = 0
    history_file = os.path.expanduser("~/.clarity_history")

    # Set up readline for history + completion
    try:
        import readline

        # Load history
        if os.path.exists(history_file):
            readline.read_history_file(history_file)
        readline.set_history_length(1000)

        # Tab completion
        from .tokens import KEYWORDS
        completions = list(KEYWORDS.keys()) + [
            "show", "ask", "len", "type", "str", "int", "float", "bool",
            "map", "filter", "reduce", "each", "find", "every", "some",
            "sort", "reverse", "push", "pop", "keys", "values", "entries",
            "range", "join", "split", "replace", "trim", "upper", "lower",
            "abs", "round", "floor", "ceil", "min", "max", "sum", "sqrt",
            "print", "read", "write", "fetch", "serve", "compose", "tap",
            "set", "error", "unique", "flat", "zip", "merge", "has",
            "contains", "starts", "ends", "chars", "repeat",
            "json_parse", "json_string", "hash", "encode64", "decode64",
        ]

        def completer(text, state):
            matches = [c for c in completions if c.startswith(text)]
            if state < len(matches):
                return matches[state]
            return None

        readline.set_completer(completer)
        readline.parse_and_bind("tab: complete")
        has_readline = True
    except ImportError:
        has_readline = False

    while True:
        try:
            prompt = "clarity> " if not buffer else "   ...> "
            line = input(prompt)

            if line.strip() in ("quit", "exit"):
                print("  -- Goodbye! --")
                break

            # REPL commands
            if line.strip() == ".help":
                print("  .help     Show this help")
                print("  .clear    Clear screen")
                print("  .reset    Reset interpreter state")
                print("  .env      Show defined variables")
                print("  quit      Exit REPL")
                continue
            if line.strip() == ".clear":
                os.system("clear" if os.name != "nt" else "cls")
                continue
            if line.strip() == ".reset":
                interp = Interpreter()
                print("  -- State reset --")
                continue
            if line.strip() == ".env":
                for name, val in interp.global_env.vars.items():
                    if name not in _BUILTIN_NAMES_CACHE:
                        print(f"  {name} = {interp._to_display(val)}")
                continue

            buffer.append(line)
            brace_depth += line.count("{") - line.count("}")

            if brace_depth > 0:
                continue

            source = "\n".join(buffer)
            buffer = []
            brace_depth = 0

            if not source.strip():
                continue

            try:
                tokens = tokenize(source)
                tree = parse(tokens, source)
                result = interp.run(tree)

                # In REPL, show expression results
                if result is not None and tree.body:
                    from . import ast_nodes as ast
                    last = tree.body[-1]
                    if isinstance(last, ast.ExpressionStatement):
                        print(f"  = {interp._to_display(result)}")

            except ClarityError as e:
                print(f"{e}")
            except Exception as e:
                print(f"  >> Error: {e}")

        except KeyboardInterrupt:
            if buffer:
                buffer = []
                brace_depth = 0
                print("\n  -- Input cleared --")
            else:
                print("\n  -- Goodbye! --")
                break
        except EOFError:
            print("\n  -- Goodbye! --")
            break

    # Save history
    if has_readline:
        try:
            readline.write_history_file(history_file)
        except Exception:
            pass


# Cache builtin names so .env can filter them
_BUILTIN_NAMES_CACHE = set()


def _init_builtin_cache():
    from .runtime import get_builtins
    interp = type('_', (), {'_to_display': lambda s, v: str(v), '_is_truthy': lambda s, v: bool(v), '_call': lambda *a: None, 'output': []})()
    _BUILTIN_NAMES_CACHE.update(get_builtins(interp).keys())


try:
    _init_builtin_cache()
except Exception:
    pass


def compile_file(path):
    """Compile a file to bytecode and show disassembly."""
    if not os.path.exists(path):
        print(f"  >> File not found: {path}")
        sys.exit(1)

    with open(path, "r") as f:
        source = f.read()

    try:
        tokens = tokenize(source, path)
        tree = parse(tokens, source)

        from .bytecode import compile_to_bytecode
        code = compile_to_bytecode(tree)
        print(code.disassemble())
        print(f"\n  {len(code.instructions)} instructions, {len(code.constants)} constants")
    except ClarityError as e:
        print(f"  Compile error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"  Compile error: {e}")
        sys.exit(1)


def check_file(path, type_check=False):
    if not os.path.exists(path):
        print(f"  >> File not found: {path}")
        sys.exit(1)

    with open(path, "r") as f:
        source = f.read()

    try:
        tokens = tokenize(source, path)
        tree = parse(tokens, source)
        stmt_count = len(tree.body)
        print(f"  \033[32mOK\033[0m — {path} ({stmt_count} statements)")

        if type_check:
            from .type_checker import check_types
            diagnostics = check_types(tree)
            if diagnostics:
                for d in diagnostics:
                    color = "\033[31m" if d.severity == "error" else "\033[33m"
                    loc = f":{d.line}" if d.line else ""
                    print(f"  {color}{d.severity.upper()}\033[0m {path}{loc}: {d.message}")
                errors = sum(1 for d in diagnostics if d.severity == "error")
                warnings = sum(1 for d in diagnostics if d.severity != "error")
                print(f"\n  {errors} error(s), {warnings} warning(s)")
                if errors > 0:
                    sys.exit(1)
            else:
                print(f"  \033[32mOK\033[0m — No type errors")
    except ClarityError as e:
        print(f"  \033[31mERROR\033[0m — {path}:{e}")
        sys.exit(1)


def lint_command(args):
    """Lint Clarity source files for common issues."""
    import glob as globmod
    from .linter import lint

    paths = [a for a in args if not a.startswith('--')]

    if not paths:
        print("Usage: clarity lint <file|dir>")
        sys.exit(1)

    # Collect .clarity files
    files = []
    for p in paths:
        if os.path.isfile(p):
            files.append(p)
        elif os.path.isdir(p):
            files.extend(sorted(globmod.glob(os.path.join(p, '**', '*.clarity'), recursive=True)))
        else:
            print(f"  >> Not found: {p}")
            sys.exit(1)

    total_issues = 0
    for filepath in files:
        try:
            with open(filepath) as f:
                source = f.read()
            diagnostics = lint(source, filepath)
            if diagnostics:
                for d in diagnostics:
                    color = "\033[33m" if d.severity == "warning" else "\033[36m" if d.severity == "info" else "\033[31m"
                    code = f" [{d.code}]" if d.code else ""
                    loc = f":{d.line}" if d.line else ""
                    print(f"  {color}{d.severity.upper()}\033[0m{code} {filepath}{loc}: {d.message}")
                total_issues += len(diagnostics)
            else:
                print(f"  \033[32mOK\033[0m  {filepath}")
        except ClarityError as e:
            print(f"  \033[31mERROR\033[0m {filepath}: {e}")
            total_issues += 1

    print(f"\n  {len(files)} file(s) checked, {total_issues} issue(s) found")
    if total_issues > 0:
        sys.exit(1)


def show_tokens(path):
    with open(path, "r") as f:
        source = f.read()

    tokens = tokenize(source, path)
    for tok in tokens:
        print(f"  {tok}")


def show_ast(path):
    with open(path, "r") as f:
        source = f.read()

    tokens = tokenize(source, path)
    tree = parse(tokens, source)

    def print_node(node, indent=0):
        prefix = "  " * indent
        if isinstance(node, list):
            for item in node:
                print_node(item, indent)
            return

        name = node.__class__.__name__
        fields = {}
        for f in node._fields:
            val = getattr(node, f, None)
            if isinstance(val, (str, int, float, bool)) or val is None:
                fields[f] = repr(val)
        field_str = ", ".join(f"{k}={v}" for k, v in fields.items())
        print(f"{prefix}{name}({field_str})")

        for f in node._fields:
            val = getattr(node, f, None)
            if hasattr(val, '_fields'):
                print_node(val, indent + 1)
            elif isinstance(val, list):
                for item in val:
                    if hasattr(item, '_fields'):
                        print_node(item, indent + 1)
                    elif isinstance(item, tuple):
                        for sub in item:
                            if hasattr(sub, '_fields'):
                                print_node(sub, indent + 1)

    print_node(tree)


def watch_file(path):
    """Watch a file for changes and re-run on save."""
    import time

    if not os.path.exists(path):
        print(f"  >> File not found: {path}")
        sys.exit(1)

    print(f"  Watching {path} (Ctrl+C to stop)\n")
    last_mtime = 0

    while True:
        try:
            mtime = os.path.getmtime(path)
            if mtime != last_mtime:
                if last_mtime != 0:
                    print(f"\n  --- File changed, re-running ---\n")
                last_mtime = mtime
                try:
                    run_file(path)
                except SystemExit:
                    pass
            time.sleep(0.5)
        except KeyboardInterrupt:
            print("\n  -- Watch stopped --")
            break


def fmt_command(args):
    """Format Clarity source files."""
    import glob as globmod
    from .formatter import format_source, format_file

    check_only = '--check' in args
    write_mode = '--write' in args
    paths = [a for a in args if not a.startswith('--')]

    if not paths:
        print("Usage: clarity fmt <file|dir> [--check] [--write]")
        print("  --check   Check formatting (exit 1 if unformatted)")
        print("  --write   Write formatted output back to files")
        sys.exit(1)

    # Collect .clarity files
    files = []
    for p in paths:
        if os.path.isfile(p):
            files.append(p)
        elif os.path.isdir(p):
            files.extend(sorted(globmod.glob(os.path.join(p, '**', '*.clarity'), recursive=True)))
        else:
            print(f"  >> Not found: {p}")
            sys.exit(1)

    changed_count = 0
    for filepath in files:
        try:
            formatted, changed = format_file(filepath, write=write_mode)
            if changed:
                changed_count += 1
                if check_only:
                    print(f"  UNFORMATTED  {filepath}")
                elif write_mode:
                    print(f"  FORMATTED    {filepath}")
                else:
                    # Default: print formatted output to stdout
                    print(formatted, end='')
            else:
                if check_only or write_mode:
                    print(f"  OK           {filepath}")
        except ClarityError as e:
            print(f"  ERROR        {filepath}: {e}")

    if check_only:
        if changed_count > 0:
            print(f"\n  {changed_count} file(s) need formatting")
            sys.exit(1)
        else:
            print(f"\n  All {len(files)} file(s) formatted correctly")


def test_command(args):
    """Discover and run Clarity test files."""
    import glob as globmod
    import time

    paths = [a for a in args if not a.startswith('--')]
    verbose = '--verbose' in args or '-v' in args

    # Default: look in current directory and tests/
    if not paths:
        paths = ['.', 'tests', 'stdlib']

    # Collect test files
    test_files = []
    for p in paths:
        if os.path.isfile(p) and p.endswith('.clarity'):
            test_files.append(p)
        elif os.path.isdir(p):
            test_files.extend(sorted(globmod.glob(os.path.join(p, 'test_*.clarity'))))

    if not test_files:
        print("  No test files found (looking for test_*.clarity)")
        sys.exit(1)

    print(f"\n  Running {len(test_files)} test file(s)...\n")
    passed = 0
    failed = 0
    errors = 0
    t0 = time.time()

    for filepath in test_files:
        try:
            with open(filepath) as f:
                source = f.read()
            tokens = tokenize(source, filepath)
            tree = parse(tokens, source)
            interp = Interpreter(source_dir=os.path.dirname(os.path.abspath(filepath)))
            interp.run(tree)
            passed += 1
            print(f"  \033[32mPASS\033[0m  {filepath}")
        except ClarityError as e:
            failed += 1
            print(f"  \033[31mFAIL\033[0m  {filepath}")
            if verbose:
                print(f"        {e}")
        except Exception as e:
            errors += 1
            print(f"  \033[31mERROR\033[0m {filepath}")
            if verbose:
                print(f"        {e}")

    elapsed = time.time() - t0
    total = passed + failed + errors
    print(f"\n  {passed} passed, {failed} failed, {errors} errors / {total} total ({elapsed:.2f}s)\n")
    if failed + errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
