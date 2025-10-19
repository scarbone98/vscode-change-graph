import * as vscode from 'vscode';
import * as path from 'path';
import { GitUtils } from './gitUtils';
import { DependencyAnalyzer } from './dependencyAnalyzer';
import { generateWebviewContent } from './webview';

export class GraphProvider {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async showGraph(commitRef?: string) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;

        // Get changed files
        const gitUtils = new GitUtils(workspaceRoot);
        let changedFiles;

        if (commitRef) {
            // Get files from specific commit
            changedFiles = await gitUtils.getFilesChangedInCommit(commitRef);
        } else {
            // Get current working tree changes
            changedFiles = await gitUtils.getChangedFiles();
        }

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

        // Update webview content and title
        this.panel.webview.html = generateWebviewContent(graph, commitRef);
        this.panel.title = commitRef ? `Code Graph - ${commitRef}` : 'Code Graph';

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'openFile':
                        const doc = await vscode.workspace.openTextDocument(message.path);
                        await vscode.window.showTextDocument(doc);
                        break;
                    case 'openFileDiff':
                        await this.openFileDiff(message.path, message.commitRef);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    async showGraphForCommit() {
        const commitRef = await vscode.window.showInputBox({
            prompt: 'Enter commit reference (hash, branch, tag, HEAD~n, etc.)',
            placeHolder: 'e.g., HEAD, HEAD~1, abc1234, main',
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Please enter a commit reference';
                }
                return undefined;
            }
        });

        if (commitRef) {
            await this.showGraph(commitRef.trim());
        }
    }

    private async openFileDiff(filePath: string, commitRef?: string): Promise<void> {
        const fileUri = vscode.Uri.file(filePath);

        try {
            if (commitRef) {
                // For specific commits, show a diff between commit and current version
                // First, open the file at that commit
                const commitFileUri = await vscode.commands.executeCommand<vscode.Uri>(
                    'git.openFile',
                    fileUri,
                    commitRef
                );

                // If we got a URI back, show a diff between commit and current
                if (commitFileUri) {
                    await vscode.commands.executeCommand(
                        'vscode.diff',
                        commitFileUri,
                        fileUri,
                        `${path.basename(filePath)} (${commitRef.substring(0, 7)}) ↔ Current`
                    );
                }
            } else {
                // Open diff with HEAD (current working tree changes)
                await vscode.commands.executeCommand(
                    'git.openChange',
                    fileUri
                );
            }
        } catch (error) {
            console.error('Error opening diff:', error);
            // Fallback: just open the file normally
            try {
                const doc = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(doc);
            } catch (fallbackError) {
                vscode.window.showErrorMessage('Failed to open file');
            }
        }
    }
}
