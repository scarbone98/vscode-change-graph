import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { RustDependencyAnalyzer } from './rustDependencyAnalyzer';

export interface FileNode {
    id: string;
    label: string;
    path: string;
    isChanged: boolean;
}

export interface Edge {
    source: string;
    target: string;
    type: 'import' | 'export';
}

export interface DependencyGraph {
    nodes: FileNode[];
    edges: Edge[];
}

export class DependencyAnalyzer {
    private workspaceRoot: string;
    private fileExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.rs', '.graphql'];
    private rustAnalyzer: RustDependencyAnalyzer;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.rustAnalyzer = new RustDependencyAnalyzer(workspaceRoot);
    }

    async analyzeDependencies(changedFiles: string[]): Promise<DependencyGraph> {
        const nodes = new Map<string, FileNode>();
        const edges: Edge[] = [];
        const processedFiles = new Set<string>();

        console.log('Analyzing dependencies for changed files:', changedFiles);

        // Process changed files and their dependencies
        for (const filePath of changedFiles) {
            await this.processFile(filePath, true, nodes, edges, processedFiles);
        }

        console.log(`Created ${nodes.size} nodes and ${edges.length} edges`);

        return {
            nodes: Array.from(nodes.values()),
            edges: edges
        };
    }

    private async processFile(
        filePath: string,
        isChanged: boolean,
        nodes: Map<string, FileNode>,
        edges: Edge[],
        processedFiles: Set<string>
    ): Promise<void> {
        if (processedFiles.has(filePath)) {
            return;
        }

        processedFiles.add(filePath);

        // Check if file exists and has a supported extension
        if (!fs.existsSync(filePath)) {
            console.log(`File does not exist: ${filePath}`);
            return;
        }

        const ext = path.extname(filePath);
        if (!this.fileExtensions.includes(ext)) {
            console.log(`Unsupported extension ${ext} for file: ${filePath}`);
            return;
        }

        // Add node for this file
        const fileId = this.getFileId(filePath);
        console.log(`Processing ${ext} file: ${filePath} (isChanged: ${isChanged})`);
        if (!nodes.has(fileId)) {
            nodes.set(fileId, {
                id: fileId,
                label: path.basename(filePath),
                path: filePath,
                isChanged: isChanged
            });
        }

        // Parse imports
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const imports = this.extractImports(content, filePath);
            console.log(`  Found ${imports.length} imports in ${path.basename(filePath)}`);

            for (const importPath of imports) {
                let resolvedPath: string | null;

                // For Rust files, extractImports already returns resolved paths
                if (ext === '.rs') {
                    resolvedPath = importPath;
                    console.log(`  Rust import resolved to: ${resolvedPath}`);
                } else {
                    // For JS/TS/GraphQL, we need to resolve the import
                    resolvedPath = this.resolveImport(importPath, filePath, ext);
                }

                if (resolvedPath && fs.existsSync(resolvedPath)) {
                    const importId = this.getFileId(resolvedPath);

                    // Add edge
                    edges.push({
                        source: fileId,
                        target: importId,
                        type: 'import'
                    });

                    // Process imported file (but mark as not changed)
                    await this.processFile(resolvedPath, false, nodes, edges, processedFiles);
                } else {
                    console.log(`  Failed to resolve import: ${importPath}`);
                }
            }
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
        }
    }

    private extractImports(content: string, filePath: string): string[] {
        const ext = path.extname(filePath);

        if (ext === '.rs') {
            return this.extractRustImports(content, filePath);
        } else if (ext === '.graphql') {
            return this.extractGraphQLImports(content, filePath);
        } else {
            return this.extractJSImports(content, filePath);
        }
    }

    private extractJSImports(content: string, filePath: string): string[] {
        const imports: string[] = [];

        try {
            const ast = parse(content, {
                sourceType: 'module',
                plugins: [
                    'typescript',
                    'jsx',
                    'decorators-legacy',
                    'classProperties',
                    'dynamicImport'
                ]
            });

            traverse(ast, {
                ImportDeclaration(path) {
                    const source = path.node.source.value;
                    if (source && !source.startsWith('.') && !source.startsWith('/')) {
                        // Skip node_modules imports for cleaner graph
                        return;
                    }
                    imports.push(source);
                },
                // Also handle dynamic imports
                CallExpression(path) {
                    if (
                        path.node.callee.type === 'Import' &&
                        path.node.arguments.length > 0 &&
                        path.node.arguments[0].type === 'StringLiteral'
                    ) {
                        const source = path.node.arguments[0].value;
                        if (source && !source.startsWith('.') && !source.startsWith('/')) {
                            return;
                        }
                        imports.push(source);
                    }
                }
            });
        } catch (error) {
            console.error(`Error parsing file ${filePath}:`, error);
        }

        return imports;
    }

    private extractRustImports(content: string, filePath: string): string[] {
        // Use the dedicated Rust analyzer
        return this.rustAnalyzer.resolveAllImports(content, filePath);
    }

    private extractGraphQLImports(content: string, filePath: string): string[] {
        const imports: string[] = [];

        // Match fragment spreads: ...FragmentName
        const fragmentPattern = /\.\.\.\s*(\w+)/g;
        let match;
        while ((match = fragmentPattern.exec(content)) !== null) {
            // Fragment spreads might be in other files
            const fragmentName = match[1];
            imports.push(fragmentName);
        }

        // Match import comments (common convention in GraphQL)
        // #import "./path/to/file.graphql"
        const importPattern = /#\s*import\s+["']([^"']+)["']/g;
        while ((match = importPattern.exec(content)) !== null) {
            imports.push(match[1]);
        }

        return imports;
    }

    private resolveImport(importPath: string, fromFile: string, fromFileExt: string): string | null {
        const dir = path.dirname(fromFile);

        // Handle GraphQL imports
        if (fromFileExt === '.graphql') {
            return this.resolveGraphQLImport(importPath, dir);
        }

        // Handle JS/TS imports
        // Try with original path
        let resolved = path.resolve(dir, importPath);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
            return resolved;
        }

        // Try with different extensions
        for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']) {
            const withExt = resolved + ext;
            if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
                return withExt;
            }
        }

        // Try with /index
        for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']) {
            const withIndex = path.join(resolved, 'index' + ext);
            if (fs.existsSync(withIndex) && fs.statSync(withIndex).isFile()) {
                return withIndex;
            }
        }

        return null;
    }

    private resolveGraphQLImport(importPath: string, fromDir: string): string | null {
        // Try with original path
        let resolved = path.resolve(fromDir, importPath);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
            return resolved;
        }

        // Try with .graphql extension
        const withExt = resolved + '.graphql';
        if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
            return withExt;
        }

        return null;
    }

    private getFileId(filePath: string): string {
        return path.relative(this.workspaceRoot, filePath);
    }
}
