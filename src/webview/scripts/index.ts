import { stateInitialization } from './state';
import { physicsCode } from './physics';
import { renderingCode } from './rendering';
import { interactionsCode } from './interactions';

export function generateScripts(graph: any, commitRef?: string): string {
    return `
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
        let folders = [];
        let camera = { x: 0, y: 0, zoom: 1 };
        let isDragging = false;
        let draggedNode = null;
        let draggedFolder = null;
        let dragOffset = { x: 0, y: 0 };
        let physicsEnabled = true;
        let filteredNodeIds = null; // null = show all, Set = show only filtered
        let matchedNodeIds = new Set(); // nodes that matched the search query
        let selectedFolder = null; // Currently selected/highlighted folder
        let selectedNode = null; // Currently selected node for path highlighting
        let dependencyPathIds = new Set(); // Nodes in the dependency path of selected node
        let currentCommitRef = ${commitRef ? `'${commitRef}'` : 'null'}; // Current commit being visualized

        // State initialization
        ${stateInitialization}

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
        ${physicsCode}

        // Rendering
        ${renderingCode}

        // Animation loop
        function animate() {
            applyForces();
            render();
            requestAnimationFrame(animate);
        }

        // Mouse interactions
        ${interactionsCode}

        // Controls
        function resetZoom() {
            camera.x = 0;
            camera.y = 0;
            camera.zoom = 1;
        }

        function togglePhysics() {
            physicsEnabled = !physicsEnabled;
        }

        // Start animation
        animate();
    </script>
    `;
}
