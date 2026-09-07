// Clarity Language Extension for VS Code
// Provides syntax highlighting, LSP integration, and code commands.

import * as vscode from 'vscode';
import { exec, execFileSync } from 'child_process';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
let diagnostics: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    diagnostics = vscode.languages.createDiagnosticCollection('clarity');
    context.subscriptions.push(diagnostics);

    const config = vscode.workspace.getConfiguration('clarity');

    // Start LSP client if enabled
    if (config.get<boolean>('lsp.enabled', true)) {
        startLSP(context, config);
    }

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('clarity.run', runCurrentFile),
        vscode.commands.registerCommand('clarity.check', checkCurrentFile),
        vscode.commands.registerCommand('clarity.format', formatCurrentFile),
        vscode.commands.registerCommand('clarity.lint', lintCurrentFile),
        vscode.commands.registerCommand('clarity.test', runTests)
    );

    // Document formatting provider (uses clarity fmt)
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider('clarity', {
            async provideDocumentFormattingEdits(document) {
                const lspPath = config.get<string>('lsp.path', 'clarity');
                try {
                    // `fmt --stdout` writes the formatted source and nothing
                    // else. Arguments go through execFileSync rather than a
                    // shell string, so a path with a space or a quote in it
                    // reaches the formatter intact.
                    const formatted = execFileSync(
                        lspPath,
                        ['fmt', document.uri.fsPath, '--stdout'],
                        { encoding: 'utf8', timeout: 10000 }
                    );
                    // Never replace the buffer with nothing. A formatter that
                    // returns an empty document is always a bug on this side
                    // of the pipe, and the cost of believing it is the user's
                    // file.
                    if (!formatted.trim()) {
                        return [];
                    }
                    const fullRange = new vscode.Range(
                        document.positionAt(0),
                        document.positionAt(document.getText().length)
                    );
                    return [vscode.TextEdit.replace(fullRange, formatted)];
                } catch {
                    return [];
                }
            }
        })
    );

    // Format on save
    if (config.get<boolean>('format.onSave', false)) {
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (doc.languageId === 'clarity') {
                vscode.commands.executeCommand('editor.action.formatDocument');
            }
        });
    }

    // Lint on save (when LSP is not running)
    if (config.get<boolean>('lint.enabled', true) && !client) {
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (doc.languageId === 'clarity') {
                lintDocument(doc, config);
            }
        });
    }

    // Status bar
    const statusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right, 100
    );
    statusBar.text = '$(symbol-misc) Clarity';
    statusBar.tooltip = 'Clarity Language';
    statusBar.command = 'clarity.run';
    statusBar.show();
    context.subscriptions.push(statusBar);
}

function startLSP(context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration) {
    const lspPath = config.get<string>('lsp.path', 'clarity');
    const serverOptions: ServerOptions = {
        command: lspPath,
        args: ['lsp'],
        transport: TransportKind.stdio
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'clarity' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.clarity')
        },
        outputChannelName: 'Clarity Language Server',
        initializationOptions: {
            lint: config.get<boolean>('lint.enabled', true),
            format: config.get<boolean>('format.onSave', false)
        }
    };

    client = new LanguageClient(
        'clarityLSP',
        'Clarity Language Server',
        serverOptions,
        clientOptions
    );

    client.start().catch((err: Error) => {
        // LSP is optional — fall back to terminal-based commands
        vscode.window.setStatusBarMessage(
            `Clarity language server not available: ${err.message}`, 5000
        );
        client = undefined;
    });
}

async function lintDocument(document: vscode.TextDocument, config: vscode.WorkspaceConfiguration) {
    const lspPath = config.get<string>('lsp.path', 'clarity');

    exec(`${lspPath} lint "${document.uri.fsPath}"`, (_err: unknown, stdout: string) => {
        const diags: vscode.Diagnostic[] = [];

        if (stdout) {
            // Parse lint output lines like "  WARN  line 5: unused variable 'x'"
            const lines = stdout.split('\n');
            for (const line of lines) {
                const match = line.match(/line\s+(\d+):\s+(.+)/);
                if (match) {
                    const lineNum = parseInt(match[1], 10) - 1;
                    const msg = match[2];
                    const severity = line.includes('ERROR')
                        ? vscode.DiagnosticSeverity.Error
                        : vscode.DiagnosticSeverity.Warning;
                    const range = new vscode.Range(lineNum, 0, lineNum, 1000);
                    diags.push(new vscode.Diagnostic(range, msg, severity));
                }
            }
        }

        diagnostics.set(document.uri, diags);
    });
}

async function runCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'clarity') {
        vscode.window.showWarningMessage('Open a .clarity file to run.');
        return;
    }

    await editor.document.save();
    const filePath = editor.document.uri.fsPath;

    const terminal = getOrCreateTerminal();
    terminal.show();
    terminal.sendText(`clarity run "${filePath}"`);
}

async function checkCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'clarity') {
        vscode.window.showWarningMessage('Open a .clarity file to check.');
        return;
    }

    await editor.document.save();
    const filePath = editor.document.uri.fsPath;

    const terminal = getOrCreateTerminal();
    terminal.show();
    terminal.sendText(`clarity check "${filePath}"`);
}

async function formatCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'clarity') {
        return;
    }

    await editor.document.save();
    vscode.commands.executeCommand('editor.action.formatDocument');
}

async function lintCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'clarity') {
        vscode.window.showWarningMessage('Open a .clarity file to lint.');
        return;
    }

    await editor.document.save();
    const filePath = editor.document.uri.fsPath;

    const terminal = getOrCreateTerminal();
    terminal.show();
    terminal.sendText(`clarity lint "${filePath}"`);
}

async function runTests() {
    const folders = vscode.workspace.workspaceFolders;
    const cwd = folders?.[0]?.uri.fsPath || '.';

    const terminal = getOrCreateTerminal();
    terminal.show();
    terminal.sendText(`clarity test "${cwd}"`);
}

function getOrCreateTerminal(): vscode.Terminal {
    const existing = vscode.window.terminals.find(t => t.name === 'Clarity');
    if (existing) return existing;
    return vscode.window.createTerminal('Clarity');
}

export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}
