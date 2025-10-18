import * as vscode from 'vscode';
import { GraphProvider } from './graphProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Graph extension is now active');

    const graphProvider = new GraphProvider(context);

    const disposable = vscode.commands.registerCommand('code-graph.showGraph', async () => {
        await graphProvider.showGraph();
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
