import * as vscode from 'vscode';
import { GraphProvider } from './graphProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Graph extension is now active');

    const graphProvider = new GraphProvider(context);

    const showGraphDisposable = vscode.commands.registerCommand('code-graph.showGraph', async () => {
        await graphProvider.showGraph();
    });

    const showGraphForCommitDisposable = vscode.commands.registerCommand('code-graph.showGraphForCommit', async () => {
        await graphProvider.showGraphForCommit();
    });

    context.subscriptions.push(showGraphDisposable);
    context.subscriptions.push(showGraphForCommitDisposable);
}

export function deactivate() {}
