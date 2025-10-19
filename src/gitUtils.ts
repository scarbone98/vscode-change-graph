import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface ChangedFile {
    path: string;
    status: string; // M (modified), A (added), D (deleted), etc.
}

export interface CommitInfo {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
}

export class GitUtils {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Recursively find all files in a directory
     */
    private getAllFilesInDirectory(dirPath: string): string[] {
        const files: string[] = [];

        try {
            if (!fs.existsSync(dirPath)) {
                return files;
            }

            const stat = fs.statSync(dirPath);
            if (!stat.isDirectory()) {
                return [dirPath];
            }

            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    files.push(...this.getAllFilesInDirectory(fullPath));
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
        }

        return files;
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
                // git status --porcelain format: XY filename
                // X = staged status, Y = unstaged status
                const stagedStatus = line.charAt(0);
                const unstagedStatus = line.charAt(1);
                const filePath = line.substring(3);

                // Check if file is modified, added, or renamed (either staged or unstaged)
                // Skip deleted files (D)
                const hasChanges = (stagedStatus !== ' ' && stagedStatus !== 'D') ||
                                   (unstagedStatus !== ' ' && unstagedStatus !== 'D');

                if (hasChanges) {
                    const status = stagedStatus !== ' ' ? stagedStatus : unstagedStatus;
                    const fullPath = path.join(this.workspaceRoot, filePath);

                    // Check if this is a directory (git reports untracked directories as a single entry)
                    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
                        // Expand directory to individual files
                        const dirFiles = this.getAllFilesInDirectory(fullPath);
                        for (const dirFile of dirFiles) {
                            files.push({
                                path: dirFile,
                                status: status
                            });
                        }
                    } else {
                        files.push({
                            path: fullPath,
                            status: status
                        });
                    }
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

    async getFilesChangedInCommit(commitRef: string): Promise<ChangedFile[]> {
        try {
            // Get the files changed in the specified commit
            const { stdout } = await execAsync(`git diff-tree --no-commit-id --name-status -r ${commitRef}`, {
                cwd: this.workspaceRoot
            });

            const files: ChangedFile[] = [];
            const lines = stdout.trim().split('\n').filter(line => line.length > 0);

            for (const line of lines) {
                const parts = line.split('\t');
                if (parts.length >= 2) {
                    const status = parts[0].trim();
                    const filePath = parts[1].trim();

                    // Only include modified, added, or renamed files (not deleted)
                    if (status && !status.includes('D')) {
                        files.push({
                            path: path.join(this.workspaceRoot, filePath),
                            status: status
                        });
                    }
                }
            }

            return files;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to get files for commit ${commitRef}: ${error}`);
            return [];
        }
    }

    async getRecentCommits(limit: number = 50): Promise<CommitInfo[]> {
        try {
            // Format: hash|short-hash|message|author|date
            const format = '%H|%h|%s|%an|%ar';
            const { stdout } = await execAsync(`git log --pretty=format:"${format}" -n ${limit}`, {
                cwd: this.workspaceRoot
            });

            const commits: CommitInfo[] = [];
            const lines = stdout.trim().split('\n').filter(line => line.length > 0);

            for (const line of lines) {
                const parts = line.split('|');
                if (parts.length >= 5) {
                    commits.push({
                        hash: parts[0],
                        shortHash: parts[1],
                        message: parts[2],
                        author: parts[3],
                        date: parts[4]
                    });
                }
            }

            return commits;
        } catch (error) {
            console.error('Failed to get recent commits:', error);
            return [];
        }
    }

    async resolveCommitHash(ref: string): Promise<string | null> {
        try {
            const { stdout } = await execAsync(`git rev-parse ${ref}`, {
                cwd: this.workspaceRoot
            });
            return stdout.trim();
        } catch (error) {
            console.error(`Failed to resolve commit ref ${ref}:`, error);
            return null;
        }
    }
}
