#!/usr/bin/env python3
"""Generate REPO_INDEX.md: a map of this repository for audits and edits.

Everything in the index is derived from the tree, so it cannot drift from it
the way a hand-written listing does. Run it from the repository root:

    python3 tools/repo_index.py            # writes REPO_INDEX.md
    python3 tools/repo_index.py --check    # exit 1 if REPO_INDEX.md is stale

What it records, and why each column exists:

  stdlib modules   which bundler ships each one (there are two lists and they
                   differ), whether the CLI reaches it, who imports it, and
                   whether any test does. A module no test imports and no
                   code imports is the first place to look for dead code.
  kernel files     architecture, size, the file's own one-line purpose, and
                   which of the four build roots reaches it.
  tests            what each test file exercises.
  workflows        what each CI job gates, read out of the YAML.
  docs             size, last change, and how many em dashes each carries,
                   because the house style avoids them.

Only the standard library is used, so it runs anywhere Python 3 does.
"""

import glob
import os
import re
import subprocess
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "REPO_INDEX.md")


def sh(cmd):
    return subprocess.check_output(cmd, cwd=ROOT, text=True).strip()


def tracked(pattern=None):
    args = ["git", "ls-files"]
    if pattern:
        args.append(pattern)
    return [f for f in sh(args).split("\n") if f]


def read(path):
    with open(os.path.join(ROOT, path), encoding="utf-8", errors="replace") as f:
        return f.read()


def lines(path):
    return read(path).count("\n")


def first_comment(text, marker):
    """The first comment line, stripped of its marker, or an empty string."""
    for line in text.split("\n"):
        s = line.strip()
        if s.startswith(marker):
            body = s[len(marker):].strip()
            if body:
                # House style avoids em dashes; source comments do not always.
                return body.replace("\u2014", "-")
        elif s:
            return ""
    return ""


def last_commit(path):
    out = sh(["git", "log", "-1", "--format=%ad", "--date=short", "--", path])
    return out or "-"


IMPORT = re.compile(r'from\s+"([^"]+)"\s+import')


def stdlib_index():
    mods = {}
    for p in sorted(glob.glob(os.path.join(ROOT, "stdlib", "*.clarity"))):
        name = os.path.basename(p)
        mods[name] = read(os.path.join("stdlib", name))
    graph = {m: set(os.path.basename(x) for x in IMPORT.findall(s)) for m, s in mods.items()}

    importers = {}
    for m, deps in graph.items():
        for d in deps:
            importers.setdefault(d, set()).add(m)

    def reach(root):
        seen, stack = set(), [root]
        while stack:
            x = stack.pop()
            if x in seen or x not in graph:
                continue
            seen.add(x)
            stack.extend(graph[x])
        return seen

    live = reach("cli.clarity")

    py = read("native/transpile.py")
    m = re.search(r"stdlib_files = \[(.*?)\]", py, re.S)
    py_list = set(re.findall(r"'([^']+\.clarity)'", m.group(1))) if m else set()
    cl = read("stdlib/transpile.clarity")
    m2 = re.search(r"STDLIB_FILES\s*=\s*\[(.*?)\]", cl, re.S)
    self_list = set(re.findall(r'"([^"]+)"', m2.group(1))) if m2 else set()

    rows = []
    for name, text in mods.items():
        if name.startswith("test_"):
            continue
        who = importers.get(name, set())
        code = sorted(w for w in who if not w.startswith("test_"))
        tests = sorted(w for w in who if w.startswith("test_"))
        if name == "cli.clarity":
            status = "entry point"
        elif name in live:
            status = "reached from the CLI"
        elif code:
            status = "library"
        elif tests:
            status = "only tests import it"
        else:
            status = "nothing imports it"
        rows.append({
            "name": name,
            "lines": text.count("\n"),
            "purpose": first_comment(text, "--"),
            "py": name in py_list,
            "self": name in self_list,
            "live": name in live,
            "code": code,
            "tests": len(tests),
            "status": status,
        })
    test_rows = []
    for name, text in mods.items():
        if not name.startswith("test_"):
            continue
        test_rows.append({
            "name": name,
            "lines": text.count("\n"),
            "imports": sorted(graph[name]),
        })
    return rows, test_rows, {
        "modules": len(rows),
        "tests": len(test_rows),
        "py_list": len(py_list),
        "self_list": len(self_list),
        "live": len([r for r in rows if r["live"]]),
        "only_tests": len([r for r in rows if r["status"] == "only tests import it"]),
        "nothing": len([r for r in rows if r["status"] == "nothing imports it"]),
        "untested": len([r for r in rows if r["tests"] == 0]),
    }


ZIMPORT = re.compile(r'@import\("([^"]+\.zig)"\)')


def kernel_index():
    files = [f for f in tracked("kernel/*.zig")] + [f for f in tracked("kernel/*.S")]
    graph = {}
    for f in files:
        if not f.endswith(".zig"):
            continue
        deps = set()
        for m in ZIMPORT.finditer(read(f)):
            deps.add(os.path.normpath(os.path.join(os.path.dirname(f), m.group(1))))
        graph[f] = deps
    roots = ["kernel/main.zig", "kernel/main_aarch64.zig", "kernel/checkonly.zig"]
    reached_by = {f: [] for f in graph}
    for r in roots:
        seen, stack = set(), [r]
        while stack:
            x = stack.pop()
            if x in seen or x not in graph:
                continue
            seen.add(x)
            stack.extend(graph[x])
        for f in seen:
            reached_by[f].append(os.path.basename(r).replace(".zig", ""))
    rows = []
    for f in sorted(files):
        text = read(f)
        if "/aarch64/" in f or f.endswith("_aarch64.zig") or f.endswith("sh_aarch64.zig") or f.endswith("init_aarch64.zig"):
            arch = "aarch64"
        elif "/x86_64/" in f or f in ("kernel/boot/start.S", "kernel/boot/multiboot2.zig", "kernel/main.zig"):
            arch = "x86_64"
        else:
            arch = "shared"
        rows.append({
            "path": f,
            "arch": arch,
            "lines": text.count("\n"),
            "purpose": first_comment(text, "//!") or first_comment(text, "//") or first_comment(text, "/*"),
            "roots": ", ".join(reached_by.get(f, [])) or ("assembly" if f.endswith(".S") else "-"),
        })
    return rows


def workflow_index():
    rows = []
    for f in sorted(tracked(".github/workflows/*.yml")):
        text = read(f)
        name = re.search(r"^name:\s*(.+)$", text, re.M)
        jobs = re.findall(r"^\s{4}name:\s*(.+)$", text, re.M)
        trig = []
        for t in ("push", "pull_request", "workflow_dispatch", "schedule"):
            if re.search(r"^\s{2}%s:" % t, text, re.M):
                trig.append(t)
        if re.search(r"^\s{4}tags:", text, re.M):
            trig.append("tags")
        rows.append({
            "file": f,
            "name": name.group(1).strip() if name else "-",
            "triggers": ", ".join(trig) or "-",
            "jobs": "; ".join(j.strip() for j in jobs) or "-",
        })
    return rows


def docs_index():
    rows = []
    for f in sorted(tracked("*.md")):
        if "/node_modules/" in f:
            continue
        text = read(f)
        rows.append({
            "file": f,
            "lines": text.count("\n"),
            "changed": last_commit(f),
            "emdash": text.count("—"),
        })
    return rows


def dir_index():
    rows = []
    counts = {}
    for f in tracked():
        top = f.split("/")[0] if "/" in f else "(root files)"
        counts.setdefault(top, [0, 0])
        counts[top][0] += 1
        if any(f.endswith(x) for x in (".clarity", ".zig", ".S", ".c", ".h", ".py", ".js", ".ts", ".sh", ".md", ".html", ".yml")):
            try:
                counts[top][1] += lines(f)
            except (OSError, UnicodeDecodeError):
                pass
    for top, (n, ln) in sorted(counts.items(), key=lambda kv: -kv[1][1]):
        rows.append({"dir": top, "files": n, "lines": ln})
    return rows


def md_table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c).replace("|", "\\|") for c in r) + " |")
    return "\n".join(out)


def yn(b):
    return "yes" if b else "no"


def build():
    head = sh(["git", "rev-parse", "--short", "HEAD"])
    mods, tests, s = stdlib_index()
    kern = kernel_index()
    wf = workflow_index()
    docs = docs_index()
    dirs = dir_index()

    parts = []
    parts.append("# Repository index\n")
    parts.append("Generated by `tools/repo_index.py` at commit `%s` on %s. Regenerate rather than edit; "
                 "`python3 tools/repo_index.py --check` fails when it is stale.\n" % (head, date.today().isoformat()))

    parts.append("## Directories\n")
    parts.append("Tracked files only. Line counts cover source, script, markup and markdown files.\n")
    parts.append(md_table(["directory", "files", "lines"], [[r["dir"], r["files"], r["lines"]] for r in dirs]))

    parts.append("\n## Standard library (`stdlib/`)\n")
    parts.append(
        "%d modules and %d test files. The Python bundler (`native/transpile.py`) lists %d modules; "
        "the self-hosted bundler (`stdlib/transpile.clarity`, `STDLIB_FILES`) lists %d. %d modules are "
        "reached from `cli.clarity`, %d are imported only by tests, %d are imported by nothing, and %d have "
        "no test that imports them.\n"
        % (s["modules"], s["tests"], s["py_list"], s["self_list"], s["live"], s["only_tests"], s["nothing"], s["untested"]))
    parts.append(
        "Status: `entry point`, `reached from the CLI` (in the shipped binary's import closure), `library` "
        "(imported by other non-test code but not from the CLI), `only tests import it`, `nothing imports it`.\n")
    parts.append(md_table(
        ["module", "lines", "purpose", "py bundle", "self bundle", "status", "imported by (code)", "tests"],
        [[r["name"], r["lines"], r["purpose"][:90], yn(r["py"]), yn(r["self"]), r["status"],
          ", ".join(r["code"])[:80] or "-", r["tests"]] for r in mods]))

    parts.append("\n## Tests (`stdlib/test_*.clarity`)\n")
    parts.append(md_table(["test", "lines", "imports"],
                          [[r["name"], r["lines"], ", ".join(r["imports"])[:120] or "-"] for r in tests]))

    parts.append("\n## Kernel (`kernel/`)\n")
    parts.append(
        "`roots` says which build root reaches the file through `@import`: `main` is the x86_64 kernel, "
        "`main_aarch64` the aarch64 kernel, `checkonly` the compile-only step for files no kernel imports.\n")
    parts.append(md_table(["file", "arch", "lines", "purpose", "roots"],
                          [[r["path"], r["arch"], r["lines"], r["purpose"][:100], r["roots"]] for r in kern]))

    parts.append("\n## CI workflows (`.github/workflows/`)\n")
    parts.append(md_table(["file", "name", "triggers", "jobs"],
                          [[r["file"], r["name"], r["triggers"], r["jobs"]] for r in wf]))

    parts.append("\n## Documents\n")
    parts.append("`em dashes` is counted because the house style avoids them.\n")
    parts.append(md_table(["file", "lines", "last change", "em dashes"],
                          [[r["file"], r["lines"], r["changed"], r["emdash"]] for r in docs]))

    parts.append("\n## Other trees\n")
    other = []
    for top in ("runtime", "web", "playground", "website", "docs", "editors", "examples", "registry", "native", "tools", "releases", "Formula"):
        fs = [f for f in tracked() if f.startswith(top + "/")]
        if fs:
            other.append([top + "/", len(fs), ", ".join(os.path.relpath(f, top) for f in fs[:8]) + (" ..." if len(fs) > 8 else "")])
    parts.append(md_table(["tree", "files", "contents"], other))
    return "\n".join(parts) + "\n"


def main():
    text = build()
    if "--check" in sys.argv:
        try:
            current = read("REPO_INDEX.md")
        except OSError:
            current = ""
        # The date line changes daily; compare everything after it.
        strip = lambda t: "\n".join(t.split("\n")[3:])
        if strip(current) != strip(text):
            print("REPO_INDEX.md is stale; run tools/repo_index.py")
            return 1
        print("REPO_INDEX.md is current")
        return 0
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote %s (%d lines)" % (OUT, text.count("\n")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
