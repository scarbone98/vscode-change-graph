export const renderingCode = `
    // Helper function to draw a folder
    function drawFolder(folder, isSelected) {
        const hasVisibleNodes = folder.nodeIds.some(nodeId => {
            const node = nodes.find(n => n.id === nodeId);
            return node && isNodeVisible(node);
        });

        if (!hasVisibleNodes) return;

        const x = folder.x - folder.width / 2;
        const y = folder.y - folder.height / 2;

        // Draw folder background with highlight if selected
        if (isSelected) {
            ctx.fillStyle = 'rgba(60, 80, 120, 0.7)';
            ctx.strokeStyle = 'rgba(100, 150, 255, 1)';
            ctx.lineWidth = 3;
        } else {
            ctx.fillStyle = 'rgba(40, 40, 40, 0.6)';
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.8)';
            ctx.lineWidth = 2;
        }

        ctx.fillRect(x, y, folder.width, folder.height);
        ctx.strokeRect(x, y, folder.width, folder.height);

        // Draw folder label background
        if (isSelected) {
            ctx.fillStyle = 'rgba(80, 100, 140, 0.95)';
        } else {
            ctx.fillStyle = 'rgba(60, 60, 60, 0.9)';
        }
        ctx.fillRect(x, y, folder.width, 30);

        // Draw folder label
        if (isSelected) {
            ctx.fillStyle = '#ffffff';
        } else {
            ctx.fillStyle = '#e0e0e0';
        }
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        let folderLabel = folder.label;
        const maxFolderChars = Math.floor(folder.width / 8);
        if (folderLabel.length > maxFolderChars) {
            folderLabel = folderLabel.substring(0, maxFolderChars - 3) + '...';
        }

        ctx.fillText(folderLabel, x + 10, y + 15);

        // Draw file count
        if (isSelected) {
            ctx.fillStyle = '#cce';
        } else {
            ctx.fillStyle = '#999';
        }
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(\`\${folder.nodeIds.length} files\`, x + folder.width - 10, y + 15);
    }

    // Helper function to draw a node
    function drawNode(node, isSelected) {
        if (!isNodeVisible(node)) return;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

        // Color logic: white for selected, yellow for matched, red for changed, purple for keystone, cyan for dependencies
        // Priority: selected > matched > changed > keystone > dependencies
        if (isSelected) {
            ctx.fillStyle = '#ffffff'; // White for selected node
        } else if (matchedNodeIds.has(node.id)) {
            ctx.fillStyle = '#ffd93d'; // Yellow for search matches
        } else if (node.isChanged) {
            ctx.fillStyle = '#ff6b6b'; // Red for changed files (highest priority)
        } else if (node.isKeystone) {
            ctx.fillStyle = '#9b59b6'; // Purple for keystone files (foundational)
        } else {
            ctx.fillStyle = '#4ecdc4'; // Cyan for dependencies
        }

        ctx.fill();

        // Keystone nodes get a special golden border (even if changed, to show both attributes)
        if (node.isKeystone && !isSelected && !matchedNodeIds.has(node.id)) {
            ctx.strokeStyle = '#f39c12'; // Gold border for keystone files
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Highlight dependency path nodes with glow
        if (dependencyPathIds.has(node.id)) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)'; // Yellow glow for path nodes
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Selected node gets a bright glow
        if (isSelected) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        if (!node.isKeystone || isSelected) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Draw label below the node
        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Smart truncation that preserves file extension
        let label = node.label;
        const maxChars = 20;
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
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 3;
        ctx.fillText(label, node.x, node.y + node.radius + 5);
        ctx.shadowBlur = 0;
    }

    // Render graph
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(camera.x, camera.y);
        ctx.scale(camera.zoom, camera.zoom);

        // Draw non-selected folder containers first
        folders.forEach(folder => {
            if (folder !== selectedFolder) {
                drawFolder(folder, false);
            }
        });

        // Draw non-path edges first (lower z-index)
        edges.forEach(edge => {
            if (!isEdgeVisible(edge)) return;

            // Check if edge is part of dependency path
            const isPathEdge = dependencyPathIds.has(edge.source.id) && dependencyPathIds.has(edge.target.id);

            // Skip path edges for now, draw them later
            if (isPathEdge) return;

            ctx.strokeStyle = 'rgba(150, 150, 150, 0.4)';
            ctx.lineWidth = 1.5;

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
            ctx.lineTo(-8, -4);
            ctx.lineTo(-8, 4);
            ctx.closePath();
            ctx.fillStyle = 'rgba(150, 150, 150, 0.4)';
            ctx.fill();
            ctx.restore();
        });

        // Draw nodes from non-selected folders (excluding path nodes and selected node)
        nodes.forEach(node => {
            if (node === selectedNode) return; // Draw selected node last
            if (dependencyPathIds.has(node.id)) return; // Draw path nodes on top later
            if (!selectedFolder || node.folder !== selectedFolder.id) {
                drawNode(node);
            }
        });

        // Draw selected folder and its nodes on top (but not path nodes or selected node yet)
        if (selectedFolder) {
            drawFolder(selectedFolder, true);

            // Draw nodes from selected folder on top (excluding path nodes and selected node)
            nodes.forEach(node => {
                if (node === selectedNode) return; // Draw selected node last
                if (dependencyPathIds.has(node.id)) return; // Draw path nodes on top later
                if (node.folder === selectedFolder.id) {
                    drawNode(node);
                }
            });
        }

        // Draw path edges on top (higher z-index)
        edges.forEach(edge => {
            if (!isEdgeVisible(edge)) return;

            // Check if edge is part of dependency path
            const isPathEdge = dependencyPathIds.has(edge.source.id) && dependencyPathIds.has(edge.target.id);

            // Only draw path edges
            if (!isPathEdge) return;

            ctx.strokeStyle = '#ffff00'; // Yellow for path (matches search highlighting)
            ctx.lineWidth = 2.5;

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
            ctx.lineTo(-8, -4);
            ctx.lineTo(-8, 4);
            ctx.closePath();
            ctx.fillStyle = '#ffff00';
            ctx.fill();
            ctx.restore();
        });

        // Draw path nodes on top (higher z-index, but not selected node yet)
        nodes.forEach(node => {
            if (node === selectedNode) return; // Draw selected node last
            if (!dependencyPathIds.has(node.id)) return; // Only draw path nodes
            drawNode(node);
        });

        // Draw selected node on top with highlight (highest z-index)
        if (selectedNode) {
            drawNode(selectedNode, true); // true = isSelected
        }

        ctx.restore();
    }
`;
