export const stateInitialization = `
    // Initialize folder groups with positions
    graphData.folders.forEach((folder, index) => {
        const angle = (index / graphData.folders.length) * Math.PI * 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.3;
        folders.push({
            ...folder,
            x: canvas.width / 2 + Math.cos(angle) * radius,
            y: canvas.height / 2 + Math.sin(angle) * radius,
            vx: 0,
            vy: 0,
            width: 200,
            height: 150,
            padding: 20
        });
    });

    // Create a folder lookup map
    const folderMap = new Map();
    folders.forEach(folder => {
        folderMap.set(folder.id, folder);
    });

    // Initialize nodes with physics properties
    graphData.nodes.forEach((node, index) => {
        const parentFolder = folderMap.get(node.folder);
        const localX = (Math.random() - 0.5) * 200; // Increased from 100 for more spacing
        const localY = (Math.random() - 0.5) * 160; // Increased from 80 for more spacing

        nodes.push({
            ...node,
            x: parentFolder ? parentFolder.x + localX : Math.random() * canvas.width,
            y: parentFolder ? parentFolder.y + localY : Math.random() * canvas.height,
            vx: 0,
            vy: 0,
            radius: 30
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
`;
