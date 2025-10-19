# Code Graph

A VS Code extension that visualizes your changed files and their dependencies as an interactive graph.

## Features

- **Git Integration**: Automatically detects changed files in your repository
- **Dependency Analysis**: Parses imports/exports to build a dependency graph
- **Interactive Visualization**:
  - Drag nodes to rearrange the graph
  - Double-click nodes to open files
  - Zoom with mouse wheel
  - Pan by dragging the canvas
  - Physics simulation for automatic layout
- **Clear Visual Indicators**:
  - Red nodes: Changed files
  - Cyan nodes: Dependencies
  - Arrows show import direction

## Usage

1. Open a workspace with a Git repository
2. Make some changes to your files
3. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
4. Run command: `Code Graph: Show Dependency Graph`
5. Interact with the graph:
   - **Drag nodes** to reposition them
   - **Double-click** a node to open that file
   - **Scroll** to zoom in/out
   - **Drag canvas** to pan around
   - **Toggle Physics** to enable/disable automatic layout
   - **Reset View** to return to default zoom/position

## Supported File Types

- TypeScript (`.ts`, `.tsx`)
- JavaScript (`.js`, `.jsx`, `.mjs`, `.cjs`)
- Rust (`.rs`)
- GraphQL (`.graphql`)

## Development

### Building

```bash
npm install
npm run compile
```

### Running

Press `F5` in VS Code to open a new Extension Development Host window.

### Packaging

```bash
npm install -g @vscode/vsce
vsce package
```

## How It Works

1. **Git Detection**: Uses `git status` to find modified/added files
2. **Import Parsing**:
   - TypeScript/JavaScript: Uses Babel parser to extract import statements
   - Rust: Uses regex to extract `mod` and `use` statements
   - GraphQL: Uses regex to extract fragment spreads and import comments
3. **Graph Building**: Creates nodes for files and edges for dependencies
4. **Visualization**: Renders using HTML Canvas with physics-based layout
5. **Interaction**: Handles mouse events for dragging, zooming, and file opening

## License

MIT
# vscode-change-graph
