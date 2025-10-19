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
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;
        const gitUtils = new GitUtils(workspaceRoot);

        // Get recent commits
        const commits = await gitUtils.getRecentCommits(50);

        if (commits.length === 0) {
            vscode.window.showErrorMessage('No commits found in repository');
            return;
        }

        // Create QuickPick items with nice formatting
        interface CommitQuickPickItem extends vscode.QuickPickItem {
            commitHash: string;
        }

        const quickPickItems: CommitQuickPickItem[] = commits.map(commit => ({
            label: `$(git-commit) ${commit.shortHash}`,
            description: commit.message,
            detail: `${commit.author} - ${commit.date}`,
            commitHash: commit.hash
        }));

        // Add option to enter custom reference
        const customRefItem: CommitQuickPickItem = {
            label: '$(edit) Enter custom reference...',
            description: 'Type a branch, tag, or commit hash manually',
            detail: 'e.g., HEAD~1, main, abc1234',
            commitHash: '__custom__'
        };

        quickPickItems.unshift(customRefItem);

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select a commit to visualize',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selected) {
            return;
        }

        // Handle custom reference input
        if (selected.commitHash === '__custom__') {
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
        } else {
            await this.showGraph(selected.commitHash);
        }
    }

    private toGitUri(uri: vscode.Uri, ref: string): vscode.Uri {
        return uri.with({
            scheme: 'git',
            path: uri.path,
            query: JSON.stringify({
                path: uri.fsPath,
                ref: ref
            })
        });
    }

    private async openFileDiff(filePath: string, commitRef?: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const fileUri = vscode.Uri.file(filePath);
        const workspaceRoot = workspaceFolder.uri.fsPath;

        try {
            if (commitRef) {
                // For specific commits, show a diff between the commit and its parent
                // This matches VS Code's git tab behavior

                const gitUtils = new GitUtils(workspaceRoot);

                // Resolve the parent commit hash
                const parentCommitHash = await gitUtils.resolveCommitHash(`${commitRef}~1`);
                const commitHash = await gitUtils.resolveCommitHash(commitRef);

                if (!parentCommitHash || !commitHash) {
                    vscode.window.showErrorMessage('Failed to resolve commit references');
                    return;
                }

                const shortHash = commitHash.substring(0, 7);
                const shortParentHash = parentCommitHash.substring(0, 7);

                // Create git URIs using proper JSON-encoded query
                const parentUri = this.toGitUri(fileUri, parentCommitHash);
                const commitUri = this.toGitUri(fileUri, commitHash);

                // Show diff between parent and selected commit
                await vscode.commands.executeCommand(
                    'vscode.diff',
                    parentUri,
                    commitUri,
                    `${path.basename(filePath)} (${shortParentHash} ↔ ${shortHash})`
                );
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
