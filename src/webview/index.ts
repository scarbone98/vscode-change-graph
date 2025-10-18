import { styles } from './styles';
import { generateScripts } from './scripts';

export function generateWebviewContent(graph: any): string {
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
                <div class="legend-color" style="background: #4ecdc4;"></div>
                <span>Dependencies</span>
            </div>
        </div>
    </div>

    ${generateScripts(graph)}
</body>
</html>`;
}
