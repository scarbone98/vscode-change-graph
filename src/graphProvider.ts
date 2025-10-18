import * as vscode from 'vscode';
import { GitUtils } from './gitUtils';
import { DependencyAnalyzer } from './dependencyAnalyzer';

export class GraphProvider {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async showGraph() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;

        // Get changed files
        const gitUtils = new GitUtils(workspaceRoot);
        const changedFiles = await gitUtils.getChangedFiles();

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

        // Update webview content
        this.panel.webview.html = this.getWebviewContent(graph);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'openFile':
                        const doc = await vscode.workspace.openTextDocument(message.path);
                        await vscode.window.showTextDocument(doc);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private getWebviewContent(graph: any): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Graph</title>
    <style>
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

    <script>
        const vscode = acquireVsCodeApi();
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Graph data
        const graphData = ${JSON.stringify(graph)};

        // Physics simulation
        let nodes = [];
        let edges = [];
        let camera = { x: 0, y: 0, zoom: 1 };
        let isDragging = false;
        let draggedNode = null;
        let dragOffset = { x: 0, y: 0 };
        let physicsEnabled = true;
        let filteredNodeIds = null; // null = show all, Set = show only filtered
        let matchedNodeIds = new Set(); // nodes that matched the search query

        // Initialize nodes with physics properties
        graphData.nodes.forEach((node, index) => {
            nodes.push({
                ...node,
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: 0,
                vy: 0,
                radius: 40
            });
        });

        // Initialize edges
        graphData.edges.forEach(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (sourceNode && targetNode) {
                edges.push({
                    source: sourceNode,
                    target: targetNode
                });
            }
        });

        // Find all nodes in the directed path - separate upstream and downstream
        function findPathNodes(targetNodeIds) {
            const visible = new Set(targetNodeIds);

            // Upstream traversal: Find all dependencies (what matched nodes import)
            const upstreamQueue = [...targetNodeIds];
            const upstreamVisited = new Set(targetNodeIds);

            while (upstreamQueue.length > 0) {
                const currentId = upstreamQueue.shift();

                edges.forEach(edge => {
                    // Go upstream: if current node imports something, add it
                    if (edge.source.id === currentId && !upstreamVisited.has(edge.target.id)) {
                        upstreamVisited.add(edge.target.id);
                        visible.add(edge.target.id);
                        upstreamQueue.push(edge.target.id);
                    }
                });
            }

            // Downstream traversal: Find all dependents (what imports matched nodes)
            const downstreamQueue = [...targetNodeIds];
            const downstreamVisited = new Set(targetNodeIds);

            while (downstreamQueue.length > 0) {
                const currentId = downstreamQueue.shift();

                edges.forEach(edge => {
                    // Go downstream: if something imports current node, add it
                    if (edge.target.id === currentId && !downstreamVisited.has(edge.source.id)) {
                        downstreamVisited.add(edge.source.id);
                        visible.add(edge.source.id);
                        downstreamQueue.push(edge.source.id);
                    }
                });
            }

            return visible;
        }

        // Filter nodes based on search query
        function filterNodes() {
            const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();

            if (!searchQuery) {
                filteredNodeIds = null;
                matchedNodeIds = new Set();
                return;
            }

            // Find nodes matching the search
            const matchingNodeIds = [];
            nodes.forEach(node => {
                if (node.label.toLowerCase().includes(searchQuery) ||
                    node.path.toLowerCase().includes(searchQuery)) {
                    matchingNodeIds.push(node.id);
                }
            });

            if (matchingNodeIds.length === 0) {
                filteredNodeIds = new Set();
                matchedNodeIds = new Set();
                return;
            }

            // Store matched nodes for highlighting
            matchedNodeIds = new Set(matchingNodeIds);

            // Find all nodes in paths to/from matching nodes
            filteredNodeIds = findPathNodes(matchingNodeIds);
        }

        // Clear filter
        function clearFilter() {
            document.getElementById('searchInput').value = '';
            filteredNodeIds = null;
            matchedNodeIds = new Set();
        }

        // Check if node should be visible
        function isNodeVisible(node) {
            return filteredNodeIds === null || filteredNodeIds.has(node.id);
        }

        // Check if edge should be visible
        function isEdgeVisible(edge) {
            return filteredNodeIds === null ||
                   (filteredNodeIds.has(edge.source.id) && filteredNodeIds.has(edge.target.id));
        }

        // Physics simulation
        function applyForces() {
            if (!physicsEnabled) return;

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // Apply forces
            nodes.forEach(node => {
                // Center attraction
                const dx = centerX - node.x;
                const dy = centerY - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    node.vx += (dx / dist) * 0.1;
                    node.vy += (dy / dist) * 0.1;
                }

                // Repulsion between nodes
                nodes.forEach(other => {
                    if (node === other) return;
                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 400 && dist > 0) {
                        const force = 2000 / (dist * dist);
                        node.vx -= (dx / dist) * force;
                        node.vy -= (dy / dist) * force;
                    }
                });
            });

            // Spring forces for edges
            edges.forEach(edge => {
                const dx = edge.target.x - edge.source.x;
                const dy = edge.target.y - edge.source.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const idealDist = 250;
                const force = (dist - idealDist) * 0.01;

                if (dist > 0) {
                    edge.source.vx += (dx / dist) * force;
                    edge.source.vy += (dy / dist) * force;
                    edge.target.vx -= (dx / dist) * force;
                    edge.target.vy -= (dy / dist) * force;
                }
            });

            // Apply velocity and damping
            nodes.forEach(node => {
                if (node !== draggedNode) {
                    node.x += node.vx;
                    node.y += node.vy;
                    node.vx *= 0.9;
                    node.vy *= 0.9;
                }
            });
        }

        // Render graph
        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate(camera.x, camera.y);
            ctx.scale(camera.zoom, camera.zoom);

            // Draw edges
            ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
            ctx.lineWidth = 2;
            edges.forEach(edge => {
                if (!isEdgeVisible(edge)) return;

                ctx.beginPath();
                ctx.moveTo(edge.source.x, edge.source.y);
                ctx.lineTo(edge.target.x, edge.target.y);
                ctx.stroke();

                // Draw arrow
                const dx = edge.target.x - edge.source.x;
                const dy = edge.target.y - edge.source.y;
                const angle = Math.atan2(dy, dx);
                const dist = Math.sqrt(dx * dx + dy * dy);
                const arrowX = edge.source.x + (dx / dist) * (dist - edge.target.radius);
                const arrowY = edge.source.y + (dy / dist) * (dist - edge.target.radius);

                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-10, -5);
                ctx.lineTo(-10, 5);
                ctx.closePath();
                ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
                ctx.fill();
                ctx.restore();
            });

            // Draw nodes
            nodes.forEach(node => {
                if (!isNodeVisible(node)) return;

                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

                // Color logic: yellow for matched, red for changed, cyan for dependencies
                if (matchedNodeIds.has(node.id)) {
                    ctx.fillStyle = '#ffd93d'; // Yellow for search matches
                } else if (node.isChanged) {
                    ctx.fillStyle = '#ff6b6b'; // Red for changed files
                } else {
                    ctx.fillStyle = '#4ecdc4'; // Cyan for dependencies
                }

                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Draw label below the node
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 13px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                // Smart truncation that preserves file extension
                let label = node.label;
                const maxChars = 25;
                if (label.length > maxChars) {
                    const ext = label.lastIndexOf('.');
                    if (ext > 0) {
                        const extension = label.substring(ext);
                        const nameLength = maxChars - extension.length - 3;
                        label = label.substring(0, nameLength) + '...' + extension;
                    } else {
                        label = label.substring(0, maxChars - 3) + '...';
                    }
                }

                // Draw text with shadow for better readability
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 4;
                ctx.fillText(label, node.x, node.y + node.radius + 8);
                ctx.shadowBlur = 0;
            });

            ctx.restore();
        }

        // Animation loop
        function animate() {
            applyForces();
            render();
            requestAnimationFrame(animate);
        }

        // Mouse interactions
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
            const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

            // Check if clicking on a node
            for (const node of nodes) {
                const dist = Math.sqrt(
                    (mouseX - node.x) ** 2 + (mouseY - node.y) ** 2
                );
                if (dist < node.radius) {
                    draggedNode = node;
                    dragOffset.x = mouseX - node.x;
                    dragOffset.y = mouseY - node.y;
                    return;
                }
            }

            isDragging = true;
            dragOffset.x = e.clientX;
            dragOffset.y = e.clientY;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (draggedNode) {
                const rect = canvas.getBoundingClientRect();
                const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
                const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;
                draggedNode.x = mouseX - dragOffset.x;
                draggedNode.y = mouseY - dragOffset.y;
                draggedNode.vx = 0;
                draggedNode.vy = 0;
            } else if (isDragging) {
                camera.x += e.clientX - dragOffset.x;
                camera.y += e.clientY - dragOffset.y;
                dragOffset.x = e.clientX;
                dragOffset.y = e.clientY;
            }
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
            draggedNode = null;
        });

        // Double click to open file
        canvas.addEventListener('dblclick', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
            const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

            for (const node of nodes) {
                const dist = Math.sqrt(
                    (mouseX - node.x) ** 2 + (mouseY - node.y) ** 2
                );
                if (dist < node.radius) {
                    vscode.postMessage({
                        command: 'openFile',
                        path: node.path
                    });
                    return;
                }
            }
        });

        // Zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            camera.zoom *= zoomFactor;
            camera.zoom = Math.max(0.1, Math.min(3, camera.zoom));
        });

        // Controls
        function resetZoom() {
            camera.x = 0;
            camera.y = 0;
            camera.zoom = 1;
        }

        function togglePhysics() {
            physicsEnabled = !physicsEnabled;
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });

        // Start animation
        animate();
    </script>
</body>
</html>`;
    }
}
