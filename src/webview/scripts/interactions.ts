export const interactionsCode = `
    // Mouse interactions
    let mouseDownX = 0;
    let mouseDownY = 0;
    let mouseDownTime = 0;

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

        // Track mouse down position for click detection
        mouseDownX = mouseX;
        mouseDownY = mouseY;
        mouseDownTime = Date.now();

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

        // Check if clicking on a folder header
        for (const folder of folders) {
            const x = folder.x - folder.width / 2;
            const y = folder.y - folder.height / 2;

            if (mouseX >= x && mouseX <= x + folder.width &&
                mouseY >= y && mouseY <= y + 30) {
                draggedFolder = folder;
                dragOffset.x = mouseX - folder.x;
                dragOffset.y = mouseY - folder.y;
                return;
            }
        }

        isDragging = true;
        dragOffset.x = e.clientX;
        dragOffset.y = e.clientY;
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

        if (draggedNode) {
            draggedNode.x = mouseX - dragOffset.x;
            draggedNode.y = mouseY - dragOffset.y;
            draggedNode.vx = 0;
            draggedNode.vy = 0;
            // Update folder bounds immediately when dragging node
            updateFolderBounds();
        } else if (draggedFolder) {
            const newX = mouseX - dragOffset.x;
            const newY = mouseY - dragOffset.y;
            const dx = newX - draggedFolder.x;
            const dy = newY - draggedFolder.y;

            // Move all nodes in the folder
            nodes.forEach(node => {
                if (node.folder === draggedFolder.id) {
                    node.x += dx;
                    node.y += dy;
                    node.vx = 0;
                    node.vy = 0;
                }
            });

            // Update folder position to follow nodes
            draggedFolder.x = newX;
            draggedFolder.y = newY;
        } else if (isDragging) {
            camera.x += e.clientX - dragOffset.x;
            camera.y += e.clientY - dragOffset.y;
            dragOffset.x = e.clientX;
            dragOffset.y = e.clientY;
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

        // Check if this was a click (not a drag)
        const dist = Math.sqrt(
            (mouseX - mouseDownX) ** 2 + (mouseY - mouseDownY) ** 2
        );
        const timeDiff = Date.now() - mouseDownTime;

        // If mouse didn't move much and was quick, treat as a click
        if (dist < 5 && timeDiff < 300) {
            // Check if clicking on a node
            let clickedNode = null;
            for (const node of nodes) {
                const nodeDist = Math.sqrt(
                    (mouseX - node.x) ** 2 + (mouseY - node.y) ** 2
                );
                if (nodeDist < node.radius) {
                    clickedNode = node;
                    break;
                }
            }

            if (clickedNode) {
                // Select the folder containing this node
                selectedFolder = folderMap.get(clickedNode.folder);
                // Select the node and highlight its dependency paths
                selectedNode = clickedNode;
                // Reset filters to show both when selecting a new node
                showDependents = true;
                showDependencies = true;
                document.getElementById('showDependentsCheckbox').checked = true;
                document.getElementById('showDependenciesCheckbox').checked = true;
                dependencyPathIds = findPathNodes([clickedNode.id], showDependents, showDependencies);
                // Show the filter controls
                document.getElementById('pathFilterControls').style.display = 'block';
            } else {
                // Clicking on empty space deselects
                selectedFolder = null;
                selectedNode = null;
                dependencyPathIds = new Set();
                // Hide the filter controls
                document.getElementById('pathFilterControls').style.display = 'none';
            }
        }

        isDragging = false;
        draggedNode = null;
        draggedFolder = null;
    });

    // Double click to open file or diff
    canvas.addEventListener('dblclick', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

        for (const node of nodes) {
            const dist = Math.sqrt(
                (mouseX - node.x) ** 2 + (mouseY - node.y) ** 2
            );
            if (dist < node.radius) {
                // Open diff for changed files, otherwise open file
                const command = node.isChanged ? 'openFileDiff' : 'openFile';
                const message = {
                    command: command,
                    path: node.path
                };
                // If viewing a commit, include the commit ref for diff
                if (currentCommitRef) {
                    message.commitRef = currentCommitRef;
                }
                vscode.postMessage(message);
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

    // Handle window resize
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
`;
