import { styles } from './styles';
import { generateScripts } from './scripts';

export function generateWebviewContent(graph: any, commitRef?: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Graph</title>
    <style>
        ${styles}
    </style>
</head>
<body>
    <div id="graph-container">
        <canvas id="canvas"></canvas>
        <div class="controls">
            <input type="text" id="searchInput" placeholder="Filter nodes..." oninput="filterNodes()" />
            <div class="button-group">
                <button onclick="resetZoom()">Reset View</button>
                <button onclick="togglePhysics()">Toggle Physics</button>
            </div>
            <button onclick="clearFilter()">Clear Filter</button>
            <div id="pathFilterControls" class="path-filter-controls" style="display: none;">
                <label class="checkbox-label">
                    <input type="checkbox" id="showDependentsCheckbox" checked onchange="toggleDependents()" />
                    <span>Show Dependents</span>
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="showDependenciesCheckbox" checked onchange="toggleDependencies()" />
                    <span>Show Dependencies</span>
                </label>
            </div>
        </div>
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: #ffd93d;"></div>
                <span>Search Match</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #ff6b6b;"></div>
                <span>Changed Files</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #9b59b6; border: 2px solid #f39c12;"></div>
                <span>Keystone Files</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #4ecdc4;"></div>
                <span>Dependencies</span>
            </div>
        </div>
    </div>

    ${generateScripts(graph, commitRef)}
</body>
</html>`;
}
