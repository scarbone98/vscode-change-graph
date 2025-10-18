import * as fs from 'fs';
import * as path from 'path';

export interface RustImport {
    moduleName: string;
    importType: 'mod' | 'crate' | 'super' | 'self';
    fullPath?: string;
}

export class RustDependencyAnalyzer {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Extract imports from a Rust source file
     */
    extractImports(content: string, filePath: string): RustImport[] {
        const imports: RustImport[] = [];

        // 1. Extract mod declarations: mod module_name;
        // These tell Rust to look for module_name.rs or module_name/mod.rs
        const modPattern = /^\s*(?:pub\s+)?mod\s+(\w+)\s*;/gm;
        let match;
        while ((match = modPattern.exec(content)) !== null) {
            imports.push({
                moduleName: match[1],
                importType: 'mod'
            });
        }

        // 2. Extract use crate:: statements
        // use crate::module::submodule;
        const cratePattern = /^\s*(?:pub\s+)?use\s+crate::([\w:]+)/gm;
        while ((match = cratePattern.exec(content)) !== null) {
            const modulePath = match[1];
            const firstModule = modulePath.split('::')[0];
            imports.push({
                moduleName: firstModule,
                importType: 'crate',
                fullPath: modulePath
            });
        }

        // 3. Extract use super:: statements
        // use super::module;
        const superPattern = /^\s*(?:pub\s+)?use\s+super::([\w:]+)/gm;
        while ((match = superPattern.exec(content)) !== null) {
            const modulePath = match[1];
            const firstModule = modulePath.split('::')[0];
            imports.push({
                moduleName: firstModule,
                importType: 'super',
                fullPath: modulePath
            });
        }

        // 4. Extract use self:: statements
        // use self::module;
        const selfPattern = /^\s*(?:pub\s+)?use\s+self::([\w:]+)/gm;
        while ((match = selfPattern.exec(content)) !== null) {
            const modulePath = match[1];
            const firstModule = modulePath.split('::')[0];
            imports.push({
                moduleName: firstModule,
                importType: 'self',
                fullPath: modulePath
            });
        }

        return imports;
    }

    /**
     * Resolve a Rust module import to its file path
     */
    resolveImport(rustImport: RustImport, fromFile: string): string | null {
        const fromDir = path.dirname(fromFile);
        const fileName = path.basename(fromFile, '.rs');

        switch (rustImport.importType) {
            case 'mod':
                return this.resolveModDeclaration(rustImport.moduleName, fromDir);

            case 'crate':
                return this.resolveCrateImport(rustImport.moduleName, fromFile);

            case 'super':
                return this.resolveSuperImport(rustImport.moduleName, fromDir);

            case 'self':
                return this.resolveSelfImport(rustImport.moduleName, fromDir, fileName);

            default:
                return null;
        }
    }

    /**
     * Resolve a mod declaration (mod module_name;)
     * Looks for:
     * 1. module_name.rs in same directory
     * 2. module_name/mod.rs in same directory
     */
    private resolveModDeclaration(moduleName: string, fromDir: string): string | null {
        // Try module_name.rs in the same directory
        const siblingPath = path.join(fromDir, `${moduleName}.rs`);
        if (fs.existsSync(siblingPath) && fs.statSync(siblingPath).isFile()) {
            return siblingPath;
        }

        // Try module_name/mod.rs
        const modPath = path.join(fromDir, moduleName, 'mod.rs');
        if (fs.existsSync(modPath) && fs.statSync(modPath).isFile()) {
            return modPath;
        }

        return null;
    }

    /**
     * Resolve a crate:: import (absolute from crate root)
     * Looks in src/ directory
     */
    private resolveCrateImport(moduleName: string, fromFile: string): string | null {
        // Find the crate root (usually src/)
        const crateRoot = this.findCrateRoot(fromFile);
        if (!crateRoot) {
            return null;
        }

        // Try module_name.rs in crate root
        const moduleFile = path.join(crateRoot, `${moduleName}.rs`);
        if (fs.existsSync(moduleFile) && fs.statSync(moduleFile).isFile()) {
            return moduleFile;
        }

        // Try module_name/mod.rs in crate root
        const modFile = path.join(crateRoot, moduleName, 'mod.rs');
        if (fs.existsSync(modFile) && fs.statSync(modFile).isFile()) {
            return modFile;
        }

        return null;
    }

    /**
     * Resolve a super:: import (parent module)
     */
    private resolveSuperImport(moduleName: string, fromDir: string): string | null {
        const parentDir = path.dirname(fromDir);

        // Try module_name.rs in parent directory
        const siblingPath = path.join(parentDir, `${moduleName}.rs`);
        if (fs.existsSync(siblingPath) && fs.statSync(siblingPath).isFile()) {
            return siblingPath;
        }

        // Try module_name/mod.rs in parent directory
        const modPath = path.join(parentDir, moduleName, 'mod.rs');
        if (fs.existsSync(modPath) && fs.statSync(modPath).isFile()) {
            return modPath;
        }

        return null;
    }

    /**
     * Resolve a self:: import (current module)
     */
    private resolveSelfImport(moduleName: string, fromDir: string, currentFileName: string): string | null {
        // If current file is mod.rs, look for siblings in the same directory
        if (currentFileName === 'mod') {
            return this.resolveModDeclaration(moduleName, fromDir);
        }

        // Otherwise, look for submodules
        // For file foo.rs, look for foo/module_name.rs or foo/module_name/mod.rs
        const submoduleDir = path.join(fromDir, currentFileName);

        const submodulePath = path.join(submoduleDir, `${moduleName}.rs`);
        if (fs.existsSync(submodulePath) && fs.statSync(submodulePath).isFile()) {
            return submodulePath;
        }

        const submoduleModPath = path.join(submoduleDir, moduleName, 'mod.rs');
        if (fs.existsSync(submoduleModPath) && fs.statSync(submoduleModPath).isFile()) {
            return submoduleModPath;
        }

        return null;
    }

    /**
     * Find the crate root directory (typically src/)
     */
    private findCrateRoot(fromFile: string): string | null {
        let current = path.dirname(fromFile);

        // Walk up the directory tree looking for Cargo.toml
        while (current !== path.dirname(current)) {
            const cargoToml = path.join(current, 'Cargo.toml');
            if (fs.existsSync(cargoToml)) {
                // Found Cargo.toml, crate root is typically src/
                const srcDir = path.join(current, 'src');
                if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
                    return srcDir;
                }
                // If no src/, the current directory might be the root
                return current;
            }
            current = path.dirname(current);
        }

        // Fallback: assume src/ in workspace root
        const srcDir = path.join(this.workspaceRoot, 'src');
        if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
            return srcDir;
        }

        return null;
    }

    /**
     * Get all resolved file paths from imports
     */
    resolveAllImports(content: string, filePath: string): string[] {
        const imports = this.extractImports(content, filePath);
        console.log(`    Rust analyzer found ${imports.length} imports in ${filePath}`);
        const resolvedPaths: string[] = [];

        for (const rustImport of imports) {
            console.log(`    Resolving Rust import: ${rustImport.importType}::${rustImport.moduleName}`);
            const resolved = this.resolveImport(rustImport, filePath);
            if (resolved) {
                console.log(`      -> Resolved to: ${resolved}`);
                resolvedPaths.push(resolved);
            } else {
                console.log(`      -> Could not resolve`);
            }
        }

        return resolvedPaths;
    }
}
