"""Clarity package manager — manage dependencies via clarity.toml.

Usage:
  clarity init          Create a new clarity.toml
  clarity install       Install dependencies from clarity.toml
  clarity install <pkg> Add and install a dependency
"""

import os
import shutil
import json


# ── TOML-like parser (minimal, no external deps) ────────

def parse_toml(text):
    """Parse a minimal TOML file (sections + key=value pairs)."""
    result = {}
    current_section = None

    for line_num, line in enumerate(text.split("\n"), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        # Section header
        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1].strip()
            result[section] = {}
            current_section = section
            continue

        # Key = value
        if "=" in line:
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()

            # Parse value
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith('{'):
                # Inline table: {path = "./libs/utils"}
                value = _parse_inline_table(value)
            elif value == "true":
                value = True
            elif value == "false":
                value = False
            elif "." in value:
                try:
                    value = float(value)
                except ValueError:
                    pass
            else:
                try:
                    value = int(value)
                except ValueError:
                    pass

            if current_section:
                result[current_section][key] = value
            else:
                result[key] = value

    return result


def _parse_inline_table(text):
    """Parse an inline TOML table: {key = "value", ...}"""
    text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        text = text[1:-1]
    result = {}
    for part in text.split(","):
        part = part.strip()
        if "=" in part:
            k, _, v = part.partition("=")
            k = k.strip()
            v = v.strip().strip('"')
            result[k] = v
    return result


def generate_toml(config):
    """Generate a TOML string from a dict."""
    lines = []
    # Top-level keys first
    for key, value in config.items():
        if not isinstance(value, dict):
            lines.append(f'{key} = {_toml_value(value)}')

    for section, values in config.items():
        if isinstance(values, dict):
            lines.append(f"\n[{section}]")
            for key, value in values.items():
                if isinstance(value, dict):
                    # Inline table
                    inner = ", ".join(f'{k} = "{v}"' for k, v in value.items())
                    lines.append(f"{key} = {{{inner}}}")
                else:
                    lines.append(f'{key} = {_toml_value(value)}')

    return "\n".join(lines) + "\n"


def _toml_value(v):
    if isinstance(v, str):
        return f'"{v}"'
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(v)


# ── Package operations ──────────────────────────────────

MODULES_DIR = "clarity_modules"
CONFIG_FILE = "clarity.toml"


def init_package(path="."):
    """Create a new clarity.toml in the given directory."""
    config_path = os.path.join(path, CONFIG_FILE)
    if os.path.exists(config_path):
        print(f"  {CONFIG_FILE} already exists")
        return False

    dirname = os.path.basename(os.path.abspath(path))
    config = {
        "package": {
            "name": dirname,
            "version": "0.1.0",
            "description": "",
            "entry": "main.clarity",
        },
        "dependencies": {},
    }
    with open(config_path, "w") as f:
        f.write(generate_toml(config))
    print(f"  Created {CONFIG_FILE}")
    return True


def install_packages(path="."):
    """Install all dependencies from clarity.toml."""
    config_path = os.path.join(path, CONFIG_FILE)
    if not os.path.exists(config_path):
        print(f"  No {CONFIG_FILE} found. Run 'clarity init' first.")
        return False

    with open(config_path, "r") as f:
        config = parse_toml(f.read())

    deps = config.get("dependencies", {})
    if not deps:
        print("  No dependencies to install.")
        return True

    modules_dir = os.path.join(path, MODULES_DIR)
    os.makedirs(modules_dir, exist_ok=True)

    installed = 0
    for name, spec in deps.items():
        if isinstance(spec, dict):
            dep_path = spec.get("path")
            if dep_path:
                _install_local(name, dep_path, modules_dir, path)
                installed += 1
            else:
                print(f"  [skip] {name} — unsupported spec: {spec}")
        elif isinstance(spec, str):
            # String value — treat as local path
            _install_local(name, spec, modules_dir, path)
            installed += 1
        else:
            print(f"  [skip] {name} — unknown format")

    print(f"  Installed {installed} package(s) to {MODULES_DIR}/")
    _write_lockfile(path, deps)
    return True


def add_package(name, spec, path="."):
    """Add a dependency to clarity.toml and install it."""
    config_path = os.path.join(path, CONFIG_FILE)
    if not os.path.exists(config_path):
        print(f"  No {CONFIG_FILE} found. Run 'clarity init' first.")
        return False

    with open(config_path, "r") as f:
        config = parse_toml(f.read())

    if "dependencies" not in config:
        config["dependencies"] = {}

    config["dependencies"][name] = spec

    with open(config_path, "w") as f:
        f.write(generate_toml(config))

    print(f"  Added '{name}' to {CONFIG_FILE}")
    return install_packages(path)


def _install_local(name, dep_path, modules_dir, base_path):
    """Install a local path dependency by copying .clarity files."""
    source = os.path.join(base_path, dep_path)
    if not os.path.exists(source):
        print(f"  [error] {name}: path not found: {dep_path}")
        return

    dest = os.path.join(modules_dir, name)

    if os.path.isfile(source):
        # Single file
        os.makedirs(dest, exist_ok=True)
        shutil.copy2(source, os.path.join(dest, os.path.basename(source)))
        print(f"  [ok] {name} (file: {dep_path})")
    elif os.path.isdir(source):
        # Directory — copy all .clarity files
        if os.path.exists(dest):
            shutil.rmtree(dest)
        os.makedirs(dest, exist_ok=True)
        count = 0
        for root, dirs, files in os.walk(source):
            for f in files:
                if f.endswith(".clarity"):
                    src_file = os.path.join(root, f)
                    rel = os.path.relpath(src_file, source)
                    dst_file = os.path.join(dest, rel)
                    os.makedirs(os.path.dirname(dst_file), exist_ok=True)
                    shutil.copy2(src_file, dst_file)
                    count += 1
        print(f"  [ok] {name} ({count} files from {dep_path})")
    else:
        print(f"  [error] {name}: not a file or directory: {dep_path}")


def _write_lockfile(path, deps):
    """Write a simple lockfile."""
    lock_path = os.path.join(path, "clarity.lock")
    lock = {"packages": {}}
    for name, spec in deps.items():
        if isinstance(spec, dict):
            lock["packages"][name] = {"path": spec.get("path", ""), "version": "local"}
        else:
            lock["packages"][name] = {"path": str(spec), "version": "local"}

    with open(lock_path, "w") as f:
        f.write(json.dumps(lock, indent=2) + "\n")


def get_package_info(path="."):
    """Read package info from clarity.toml."""
    config_path = os.path.join(path, CONFIG_FILE)
    if not os.path.exists(config_path):
        return None
    with open(config_path, "r") as f:
        return parse_toml(f.read())
