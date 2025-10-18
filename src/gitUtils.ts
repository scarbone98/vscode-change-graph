import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export interface ChangedFile {
    path: string;
    status: string; // M (modified), A (added), D (deleted), etc.
}

export class GitUtils {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    async getChangedFiles(): Promise<ChangedFile[]> {
        try {
            // Get staged and unstaged changes
            const { stdout } = await execAsync('git status --porcelain', {
                cwd: this.workspaceRoot
            });

            const files: ChangedFile[] = [];
            const lines = stdout.trim().split('\n').filter(line => line.length > 0);

            for (const line of lines) {
                const status = line.substring(0, 2).trim();
                const filePath = line.substring(3);

                // Only include modified, added, or renamed files (not deleted)
                if (status && !status.includes('D')) {
                    files.push({
                        path: path.join(this.workspaceRoot, filePath),
                        status: status
                    });
                }
            }

            return files;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to get changed files: ${error}`);
            return [];
        }
    }

    async getAllTrackedFiles(): Promise<string[]> {
        try {
            const { stdout } = await execAsync('git ls-files', {
                cwd: this.workspaceRoot
            });

            return stdout.trim().split('\n')
                .filter(line => line.length > 0)
                .map(filePath => path.join(this.workspaceRoot, filePath));
        } catch (error) {
            console.error('Failed to get tracked files:', error);
            return [];
        }
    }
}
