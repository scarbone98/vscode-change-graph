export const styles = `
    body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-font-family);
    }
    #graph-container {
        width: 100vw;
        height: 100vh;
        position: relative;
    }
    canvas {
        display: block;
    }
    .controls {
        position: absolute;
        top: 10px;
        right: 10px;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        padding: 10px;
        border-radius: 4px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .controls input {
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        padding: 6px 12px;
        border-radius: 2px;
        font-family: var(--vscode-font-family);
        font-size: 13px;
    }
    .controls input::placeholder {
        color: var(--vscode-input-placeholderForeground);
    }
    .controls button {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 6px 12px;
        margin: 2px;
        cursor: pointer;
        border-radius: 2px;
    }
    .controls button:hover {
        background: var(--vscode-button-hoverBackground);
    }
    .button-group {
        display: flex;
        gap: 4px;
    }
    .path-filter-controls {
        margin-top: 8px;
        padding: 8px;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
    }
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 4px 0;
        cursor: pointer;
        color: var(--vscode-foreground);
        font-size: 13px;
    }
    .checkbox-label input[type="checkbox"] {
        cursor: pointer;
        width: 16px;
        height: 16px;
    }
    .checkbox-label span {
        user-select: none;
    }
    .legend {
        position: absolute;
        bottom: 10px;
        left: 10px;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        padding: 10px;
        border-radius: 4px;
        z-index: 1000;
    }
    .legend-item {
        display: flex;
        align-items: center;
        margin: 4px 0;
    }
    .legend-color {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        margin-right: 8px;
        border: 2px solid var(--vscode-editor-foreground);
    }
`;
