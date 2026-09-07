// Activation and formatting test for the Clarity VS Code extension.
//
// It loads the *compiled* extension (out/extension.js) with a stub `vscode`
// module, activates it, and drives the document formatting provider against
// a real `clarity` binary. Two things it pins down, both of which were
// broken:
//
//   1. The extension must load at all. `vscode-languageclient` is imported
//      at the top of extension.ts; when it sat in devDependencies, vsce left
//      it out of the .vsix and activation threw "Cannot find module".
//   2. Formatting an already-formatted file must return that file, not an
//      empty document. The provider used to run `clarity fmt <file>
//      --stdout` against a CLI that had no --stdout flag; the flag was
//      ignored, the default mode prints nothing when a file is already
//      formatted, and the provider replaced the whole buffer with "".
//
// Run: CLARITY_BIN=/path/to/clarity node test/extension.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const CLARITY = process.env.CLARITY_BIN || 'clarity';

let passed = 0;
function check(name, fn) {
    fn();
    passed += 1;
    console.log('  ok  ' + name);
}

// ── the stub editor ──────────────────────────────────────
let formattingProvider = null;
const registeredCommands = [];
let configValues = {};

class Position {
    constructor(line, character) { this.line = line; this.character = character; }
}
class Range {
    constructor(a, b, c, d) {
        if (a instanceof Position) { this.start = a; this.end = b; }
        else { this.start = new Position(a, b); this.end = new Position(c, d); }
    }
}

const vscodeStub = {
    Position,
    Range,
    TextEdit: {
        replace(range, newText) { return { range, newText }; }
    },
    Diagnostic: class { constructor(range, message, severity) { Object.assign(this, { range, message, severity }); } },
    DiagnosticSeverity: { Error: 0, Warning: 1 },
    StatusBarAlignment: { Left: 1, Right: 2 },
    languages: {
        createDiagnosticCollection: () => ({ set() {}, dispose() {} }),
        registerDocumentFormattingEditProvider: (_selector, provider) => {
            formattingProvider = provider;
            return { dispose() {} };
        }
    },
    commands: {
        registerCommand: (name) => { registeredCommands.push(name); return { dispose() {} }; },
        executeCommand: () => Promise.resolve()
    },
    workspace: {
        getConfiguration: () => ({
            get: (key, fallback) => (key in configValues ? configValues[key] : fallback)
        }),
        onDidSaveTextDocument: () => ({ dispose() {} }),
        createFileSystemWatcher: () => ({ dispose() {} }),
        workspaceFolders: []
    },
    window: {
        activeTextEditor: undefined,
        terminals: [],
        createTerminal: () => ({ show() {}, sendText() {} }),
        createStatusBarItem: () => ({ show() {}, dispose() {}, text: '', tooltip: '', command: '' }),
        setStatusBarMessage: () => ({ dispose() {} }),
        showWarningMessage: () => {}
    }
};

// vscode-languageclient reads a good deal more of the editor API at load
// time (it subclasses CompletionItem, CodeLens and friends), and the point
// of this test is the extension, not a faithful editor. Anything the stub
// does not define resolves to an empty class that can be extended, called
// or read from, so the library loads and the extension's own code runs
// against the real objects above.
function stubClass(name) {
    const cls = class Stub {};
    Object.defineProperty(cls, 'name', { value: name });
    return new Proxy(cls, {
        get(target, prop) {
            if (prop in target) { return target[prop]; }
            if (typeof prop === 'symbol') { return undefined; }
            return stubClass(name + '.' + String(prop));
        }
    });
}

const vscode = new Proxy(vscodeStub, {
    get(target, prop) {
        if (prop in target) { return target[prop]; }
        if (typeof prop === 'symbol') { return undefined; }
        return stubClass(String(prop));
    },
    has() { return true; }
});

const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'vscode') { return vscode; }
    return realLoad.call(this, request, parent, isMain);
};

// ── documents ────────────────────────────────────────────
function fakeDocument(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    return {
        uri: { fsPath: filePath },
        languageId: 'clarity',
        getText: () => text,
        positionAt: (offset) => new Position(0, offset),
        save: async () => true
    };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clarity-vsx-'));
const formattedFile = path.join(tmp, 'formatted.clarity');
const unformattedFile = path.join(tmp, 'unformatted.clarity');
const brokenFile = path.join(tmp, 'broken.clarity');
const FORMATTED = 'fn add(a, b) {\n    return a + b\n}\n\nshow add(1, 2)\n';
fs.writeFileSync(formattedFile, FORMATTED);
fs.writeFileSync(unformattedFile, 'fn add( a,b ){\nreturn a+b\n}\n\nshow add(1,2)\n');
fs.writeFileSync(brokenFile, 'fn add( {\n');

// ── the tests ────────────────────────────────────────────
console.log('Clarity VS Code extension:');

const extension = require(path.join(__dirname, '..', 'out', 'extension.js'));

check('the compiled extension loads, language client and all', () => {
    assert.strictEqual(typeof extension.activate, 'function');
    assert.strictEqual(typeof extension.deactivate, 'function');
});

configValues = { 'lsp.enabled': false, 'lint.enabled': false, 'format.onSave': false, 'lsp.path': CLARITY };
const context = { subscriptions: [] };

check('activate() runs and registers the commands it contributes', () => {
    extension.activate(context);
    for (const name of ['clarity.run', 'clarity.check', 'clarity.format', 'clarity.lint', 'clarity.test']) {
        assert.ok(registeredCommands.includes(name), 'missing command ' + name);
    }
    assert.ok(context.subscriptions.length > 0);
});

check('it registers a document formatting provider', () => {
    assert.ok(formattingProvider, 'no formatting provider registered');
});

async function format(file) {
    return formattingProvider.provideDocumentFormattingEdits(fakeDocument(file));
}

(async () => {
    const already = await format(formattedFile);
    check('formatting an already-formatted file returns that file, not nothing', () => {
        assert.strictEqual(already.length, 1, 'expected one edit');
        assert.strictEqual(already[0].newText, FORMATTED);
    });

    const messy = await format(unformattedFile);
    check('formatting an unformatted file returns the formatted source', () => {
        assert.strictEqual(messy.length, 1);
        assert.strictEqual(messy[0].newText, FORMATTED);
    });

    const broken = await format(brokenFile);
    check('a file that does not parse produces no edit at all', () => {
        assert.deepStrictEqual(broken, []);
    });

    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('\n' + passed + ' passed');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
