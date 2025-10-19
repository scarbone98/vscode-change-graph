# Code Diff Graph

Visualize your changed files and their dependencies as an interactive graph. See at a glance how your code changes ripple through your codebase.

## Features

### Git Integration
- Automatically detects changed files (staged and unstaged)
- View dependency graphs for specific commits
- Visual indicators for keystones files (foundational files with no dependencies)

### Interactive Visualization
- **Drag nodes** to rearrange the graph
- **Click nodes** to highlight dependency paths
- **Double-click** to open files in the editor
- **Zoom** with mouse wheel
- **Pan** by dragging the canvas
- **Physics simulation** for automatic layout
- **Search** to find and highlight specific files

### Smart Path Filtering
- Click a node to see its dependency paths
- Toggle "Show Dependents" to see what files use this code
- Toggle "Show Dependencies" to see what this file imports
- Reduces visual clutter in complex codebases

### Visual Indicators
- 🔴 **Red nodes**: Changed files
- 🔵 **Cyan nodes**: Dependencies (unchanged)
- 🟣 **Purple/Gold nodes**: Keystone files (no incoming dependencies)
- **Arrows**: Show dependency direction (A → B means B imports A)

## Usage

### View Current Changes
1. Open a workspace with a Git repository
2. Make some changes to your files
3. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
4. Run: **Code Graph: Show Dependency Graph**

### View Historical Commits
1. Open Command Palette
2. Run: **Code Graph: Show Graph for Commit**
3. Select a commit from the dropdown
4. See the dependency graph for that commit's changes

## Supported File Types

The extension analyzes dependencies for:

- **TypeScript**: `.ts`, `.tsx`
- **JavaScript**: `.js`, `.jsx`, `.mjs`, `.cjs`
- **Rust**: `.rs`
- **GraphQL**: `.graphql`

Files of other types will appear in the graph if changed, but their dependencies won't be analyzed.

## How It Works

1. **Git Detection**: Runs `git status` or `git show` to find changed files
2. **Import Parsing**:
   - **TypeScript/JavaScript**: Uses Babel parser to extract `import` and `require` statements
   - **Rust**: Uses regex to extract `mod` and `use` statements
   - **GraphQL**: Uses regex to extract fragment spreads and import comments
3. **Path Resolution**: Resolves relative imports to absolute file paths
4. **Graph Building**: Creates nodes for files and directed edges for dependencies
5. **Keystone Detection**: Identifies foundational files with outgoing but no incoming edges
6. **Visualization**: Renders on HTML Canvas with physics-based force-directed layout
7. **Interaction**: Handles mouse events for dragging, selection, and file opening

## Tips

- **Large graphs?** Use the search feature to find specific files, then use path filtering to focus on relevant dependencies
- **Keystone files** (purple/gold) are good candidates for extra test coverage since changes affect many dependents
- **Physics toggle** can help freeze the layout once you've arranged nodes manually

## License

MIT
