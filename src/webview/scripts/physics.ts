export const physicsCode = `
    // Update folder positions and boundaries to follow their nodes
    function updateFolderBounds() {
        folders.forEach(folder => {
            const folderNodes = nodes.filter(n => n.folder === folder.id);
            if (folderNodes.length === 0) return;

            // Calculate centroid of all nodes in this folder
            let sumX = 0, sumY = 0;
            folderNodes.forEach(node => {
                sumX += node.x;
                sumY += node.y;
            });
            folder.x = sumX / folderNodes.length;
            folder.y = sumY / folderNodes.length;

            // Calculate bounding box
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            folderNodes.forEach(node => {
                minX = Math.min(minX, node.x - node.radius);
                maxX = Math.max(maxX, node.x + node.radius);
                minY = Math.min(minY, node.y - node.radius);
                maxY = Math.max(maxY, node.y + node.radius);
            });

            // Set folder size with padding
            folder.width = Math.max(200, (maxX - minX) + folder.padding * 2);
            folder.height = Math.max(150, (maxY - minY) + folder.padding * 2 + 30);
        });
    }

    // Physics simulation
    function applyForces() {
        if (!physicsEnabled) return;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Calculate group centroids for inter-group forces
        const groupCentroids = new Map();
        folders.forEach(folder => {
            const folderNodes = nodes.filter(n => n.folder === folder.id);
            if (folderNodes.length > 0) {
                let sumX = 0, sumY = 0;
                folderNodes.forEach(node => {
                    sumX += node.x;
                    sumY += node.y;
                });
                groupCentroids.set(folder.id, {
                    x: sumX / folderNodes.length,
                    y: sumY / folderNodes.length
                });
            }
        });

        // Apply forces to nodes
        nodes.forEach(node => {
            // Gentle center attraction
            const dx = centerX - node.x;
            const dy = centerY - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                node.vx += (dx / dist) * 0.05;
                node.vy += (dy / dist) * 0.05;
            }

            // Intra-group attraction: nodes in same folder attract each other
            nodes.forEach(other => {
                if (node === other) return;

                if (node.folder === other.folder) {
                    // Same folder: attract
                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Moderate attraction to keep group cohesive
                    if (dist > 80 && dist < 300) {
                        const force = 0.02;
                        node.vx += (dx / dist) * force;
                        node.vy += (dy / dist) * force;
                    }

                    // Repulsion when too close
                    if (dist < 80 && dist > 0) {
                        const force = 400 / (dist * dist);
                        node.vx -= (dx / dist) * force;
                        node.vy -= (dy / dist) * force;
                    }
                } else {
                    // Different folder: repel
                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 250 && dist > 0) {
                        const force = 800 / (dist * dist);
                        node.vx -= (dx / dist) * force;
                        node.vy -= (dy / dist) * force;
                    }
                }
            });

            // Inter-group repulsion: push away from other group centroids
            const myCentroid = groupCentroids.get(node.folder);
            if (myCentroid) {
                groupCentroids.forEach((centroid, folderId) => {
                    if (folderId === node.folder) return;

                    const dx = centroid.x - node.x;
                    const dy = centroid.y - node.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 400 && dist > 0) {
                        const force = 2000 / (dist * dist);
                        node.vx -= (dx / dist) * force;
                        node.vy -= (dy / dist) * force;
                    }
                });
            }
        });

        // Spring forces for edges
        edges.forEach(edge => {
            const dx = edge.target.x - edge.source.x;
            const dy = edge.target.y - edge.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const idealDist = 200;
            const force = (dist - idealDist) * 0.008;

            if (dist > 0) {
                edge.source.vx += (dx / dist) * force;
                edge.source.vy += (dy / dist) * force;
                edge.target.vx -= (dx / dist) * force;
                edge.target.vy -= (dy / dist) * force;
            }
        });

        // Apply velocity and damping to nodes
        nodes.forEach(node => {
            if (node !== draggedNode && !draggedFolder) {
                node.x += node.vx;
                node.y += node.vy;
                node.vx *= 0.88;
                node.vy *= 0.88;
            }
        });

        // Update folder bounds to follow their nodes
        if (!draggedFolder) {
            updateFolderBounds();
        }
    }
`;
