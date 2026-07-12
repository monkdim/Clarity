#!/usr/bin/env bash
# Assemble the browser build of KyanOS and bundle it.
# Prereq: `python3 native/transpile.py --bundle` has populated native/dist/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODS="atlas_font branding_kyan branding_modern compositor draw event_bus ffi font font_atlas graphics \
      input keymap kyan_apps kyan_game kyan_desktop mouse theme_kyan theme_meadow touch \
      terminal_emulator pty window window_manager"

mkdir -p web/build
for m in $MODS; do cp "native/dist/$m.js" "web/build/$m.js"; done
# The browser runtime replaces the Node/Bun runtime under the same filename.
cp web/runtime_browser.js web/build/runtime.js

# De-collision: the transpiler emits `export function $max` for a Clarity
# `fn max` while ALSO importing `$max` from runtime. That module-level
# redeclaration is a SyntaxError under a strict ESM bundler. The local
# definition shadows the builtin anyway, so drop the name from the import.
python3 - "$ROOT/web/build" <<'PY'
import re, glob, sys, os
d = sys.argv[1]
for f in sorted(glob.glob(os.path.join(d, '*.js'))):
    if os.path.basename(f) in ('runtime.js', 'entry.js'): continue
    txt = open(f).read()
    locals_ = set(re.findall(r'^export\s+function\s+(\$?\w+)', txt, re.M))
    locals_ |= set(re.findall(r'^function\s+(\$?\w+)', txt, re.M))
    m = re.search(r"import\s*\{([^}]*)\}\s*from\s*['\"]\./runtime\.js['\"]", txt, re.S)
    if not m: continue
    body = m.group(1)
    kept = []
    for part in body.split(','):
        p = part.strip()
        if not p:
            continue
        name = p.split(' as ')[-1].strip() if ' as ' in p else p
        if name in locals_:
            continue  # drop the colliding import; local def shadows it
        kept.append(p)
    new_import = 'import { ' + ', '.join(kept) + " } from './runtime.js'"
    txt2 = txt[:m.start()] + new_import + txt[m.end():]
    if txt2 != txt:
        open(f, 'w').write(txt2)
        print('  de-collided', os.path.basename(f))
PY

bun build web/build/entry.js --target=browser --outfile web/kyanos.bundle.js
echo "bundle: $(wc -c < web/kyanos.bundle.js) bytes -> web/kyanos.bundle.js"
