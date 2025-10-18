import * as vscode from 'vscode';
import { GitUtils } from './gitUtils';
import { DependencyAnalyzer } from './dependencyAnalyzer';
import { generateWebviewContent } from './webview';

export class GraphProvider {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async showGraph() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;

        // Get changed files
        const gitUtils = new GitUtils(workspaceRoot);
        const changedFiles = await gitUtils.getChangedFiles();

        if (changedFiles.length === 0) {
            vscode.window.showInformationMessage('No changed files found');
            return;
        }

        // Analyze dependencies
        const analyzer = new DependencyAnalyzer(workspaceRoot);
        const graph = await analyzer.analyzeDependencies(
            changedFiles.map(f => f.path)
        );

        // Create or show webview
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'codeGraph',
                'Code Graph',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        }

        // Update webview content
        this.panel.webview.html = generateWebviewContent(graph);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'openFile':
                        const doc = await vscode.workspace.openTextDocument(message.path);
                        await vscode.window.showTextDocument(doc);
                        break;
                    case 'openFileDiff':
                        await this.openFileDiff(message.path);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private async openFileDiff(filePath: string): Promise<void> {
        const fileUri = vscode.Uri.file(filePath);
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        if (!workspaceFolder) {
            return;
        }

        try {
            // Get the git extension
            const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
            const git = gitExtension?.getAPI(1);

            if (git && git.repositories.length > 0) {
                const repo = git.repositories[0];

                // Open diff with HEAD
                await vscode.commands.executeCommand(
                    'vscode.diff',
                    vscode.Uri.parse(`git:/${filePath}?ref=HEAD`),
                    fileUri,
                    `${filePath} (Working Tree) ↔ HEAD`
                );
            } else {
                // Fallback: just open the file if git is not available
                const doc = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(doc);
            }
        } catch (error) {
            console.error('Error opening diff:', error);
            // Fallback: open the file
            const doc = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(doc);
        }
    }
}
