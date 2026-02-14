// Clarity Language Extension for VS Code
// Provides syntax highlighting, LSP integration, and code commands.

import * as vscode from 'vscode';
import * as path from 'path';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext) {
    // Start LSP client if enabled
    const config = vscode.workspace.getConfiguration('clarity');
    if (config.get<boolean>('lsp.enabled', true)) {
        startLSP(context, config);
    }

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('clarity.run', runCurrentFile),
        vscode.commands.registerCommand('clarity.check', checkCurrentFile),
        vscode.commands.registerCommand('clarity.format', formatCurrentFile),
        vscode.commands.registerCommand('clarity.lint', lintCurrentFile)
    );

    // Format on save
    if (config.get<boolean>('format.onSave', false)) {
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (doc.languageId === 'clarity') {
                vscode.commands.executeCommand('clarity.format');
            }
        });
    }

    // Status bar item showing Clarity version
    const statusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right, 100
    );
    statusBar.text = '$(symbol-misc) Clarity';
    statusBar.tooltip = 'Clarity Language';
    statusBar.command = 'clarity.run';
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Detect Clarity version
    const terminal = new vscode.ShellExecution('clarity --version 2>/dev/null');
    // We just show the icon; version detection is best-effort
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
        outputChannelName: 'Clarity Language Server'
    };

    client = new LanguageClient(
        'clarityLSP',
        'Clarity Language Server',
        serverOptions,
        clientOptions
    );

    client.start().catch((err) => {
        // LSP is optional — don't error if clarity binary not found
        console.log('Clarity LSP not available:', err.message);
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
    const filePath = editor.document.uri.fsPath;

    const terminal = getOrCreateTerminal();
    terminal.sendText(`clarity fmt "${filePath}"`);
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
