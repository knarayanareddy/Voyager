import React, { useEffect, useRef, useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { GraphNode, GraphEdge } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, HelpCircle } from 'lucide-react';

export const GraphView: React.FC = () => {
  const { state, actions } = useDatabase();
  const { pages, tagIndex, settings } = state;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pan & Zoom Ref State
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const [zoomLevel, setZoomLevel] = useState(100);

  // Physics Simulation State stored in Refs for 60fps rendering without React overhead
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const selectedNodeIdRef = useRef<string | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeIndexRef = useRef<number | null>(null);

  const animationFrameIdRef = useRef<number | null>(null);

  // Generate nodes and edges from pages and tags
  useEffect(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 1. Add Page Nodes
    Object.values(pages).forEach(page => {
      // Node size proportional to number of blocks or backlinks
      const backlinkCount = state.backlinks[page.id]?.length || 0;
      const weight = 6 + Math.min(10, page.blocks.length + backlinkCount);
      
      nodes.push({
        id: page.id,
        label: page.name,
        type: page.isJournal ? 'journal' : 'page',
        val: weight,
        x: Math.random() * 200 - 100, // randomized starting positions near center
        y: Math.random() * 200 - 100,
        vx: 0,
        vy: 0
      });
    });

    // 2. Add Tag Nodes & Edges
    Object.entries(tagIndex).forEach(([tag, pageIds]) => {
      const tagNodeId = `tag-${tag}`;
      nodes.push({
        id: tagNodeId,
        label: `#${tag}`,
        type: 'tag',
        val: 5 + Math.min(8, pageIds.length),
        x: Math.random() * 200 - 100,
        y: Math.random() * 200 - 100,
        vx: 0,
        vy: 0
      });

      // Connect tag to all pages having it
      pageIds.forEach(pageId => {
        if (pages[pageId]) {
          edges.push({
            source: tagNodeId,
            target: pageId
          });
        }
      });
    });

    // 3. Add Wikilink Edges (Page-to-Page)
    Object.entries(state.backlinks).forEach(([targetId, linkItems]) => {
      linkItems.forEach(item => {
        // Source is the page containing the link (item.pageId)
        // Target is the linked page (targetId)
        // Ensure both source and target exist as nodes
        const sourceExists = nodes.some(n => n.id === item.pageId);
        const targetExists = nodes.some(n => n.id === targetId);
        
        if (sourceExists && targetExists) {
          // Avoid duplicate edges
          const exists = edges.some(
            e => (e.source === item.pageId && e.target === targetId) ||
                 (e.source === targetId && e.target === item.pageId)
          );
          if (!exists) {
            edges.push({
              source: item.pageId,
              target: targetId
            });
          }
        }
      });
    });

    // Update refs (carrying over coordinates for nodes that already existed)
    const oldNodesMap = new Map(nodesRef.current.map(n => [n.id, n]));
    
    nodesRef.current = nodes.map(node => {
      const oldNode = oldNodesMap.get(node.id);
      if (oldNode) {
        return {
          ...node,
          x: oldNode.x,
          y: oldNode.y,
          vx: oldNode.vx,
          vy: oldNode.vy
        };
      }
      return node;
    });

    edgesRef.current = edges;

    // Reset pan to center if first load
    if (transformRef.current.x === 0 && transformRef.current.y === 0 && canvasRef.current) {
      const canvas = canvasRef.current;
      transformRef.current.x = canvas.width / 2;
      transformRef.current.y = canvas.height / 2;
    }

  }, [pages, tagIndex, state.backlinks]);

  // Handle Screen Off Android lifecycle: pause animation
  useEffect(() => {
    const handleScreenOff = () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
    window.addEventListener('voyager-screen-off', handleScreenOff);
    return () => window.removeEventListener('voyager-screen-off', handleScreenOff);
  }, []);

  // Physics & Drawing Simulation Loop
  useEffect(() => {
    if (!settings.screenOn) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Adjust canvas size to fit container dynamically
    const resizeCanvas = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const simulationTick = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      const width = canvas.width;
      const height = canvas.height;

      // --- 1. PHYSICS SIMULATION (In-ref execution for top-tier speed) ---
      // Force constants
      const kRepulsion = 120; // Charge repulsion
      const kAttraction = 0.04; // Spring attraction
      const kGravity = 0.02; // Gravity pull to center
      const damping = 0.82; // Friction

      // Reset accelerations and apply center gravity
      const centerX = 0;
      const centerY = 0;

      nodes.forEach(node => {
        // Pull towards center
        node.vx = (node.vx || 0) + (centerX - (node.x || 0)) * kGravity;
        node.vy = (node.vy || 0) + (centerY - (node.y || 0)) * kGravity;
      });

      // Repulsion force (O(n²) but tiny since nodes < 100)
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = (n2.x || 0) - (n1.x || 0);
          const dy = (n2.y || 0) - (n1.y || 0);
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);

          // Force inversely proportional to distance
          const force = (kRepulsion * n1.val * n2.val) / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          // Accelerate away
          n1.vx = (n1.vx || 0) - fx;
          n1.vy = (n1.vy || 0) - fy;
          n2.vx = (n2.vx || 0) + fx;
          n2.vy = (n2.vy || 0) + fy;
        }
      }

      // Attraction force along edges
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        if (sourceNode && targetNode) {
          const dx = (targetNode.x || 0) - (sourceNode.x || 0);
          const dy = (targetNode.y || 0) - (sourceNode.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          // Spring force
          const force = kAttraction * dist;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          sourceNode.vx = (sourceNode.vx || 0) + fx;
          sourceNode.vy = (sourceNode.vy || 0) + fy;
          targetNode.vx = (targetNode.vx || 0) - fx;
          targetNode.vy = (targetNode.vy || 0) - fy;
        }
      });

      // Update positions
      nodes.forEach((node, idx) => {
        // If this node is being dragged by mouse, pin it
        if (isDraggingRef.current && draggedNodeIndexRef.current === idx) {
          return;
        }

        node.x = (node.x || 0) + (node.vx || 0);
        node.y = (node.y || 0) + (node.vy || 0);

        // Apply friction damping
        node.vx = (node.vx || 0) * damping;
        node.vy = (node.vy || 0) * damping;
      });

      // --- 2. CANVAS RENDERING ---
      ctx.clearRect(0, 0, width, height);

      // Draw grid background for technical look
      ctx.save();
      const { x: tx, y: ty, scale: s } = transformRef.current;
      ctx.translate(tx, ty);
      ctx.scale(s, s);

      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 0.5;
      const gridSize = 50;
      const startGridX = Math.floor((-tx / s) / gridSize) * gridSize;
      const endGridX = startGridX + (width / s) + gridSize;
      const startGridY = Math.floor((-ty / s) / gridSize) * gridSize;
      const endGridY = startGridY + (height / s) + gridSize;

      for (let gx = startGridX; gx <= endGridX; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, startGridY);
        ctx.lineTo(gx, endGridY);
        ctx.stroke();
      }
      for (let gy = startGridY; gy <= endGridY; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startGridX, gy);
        ctx.lineTo(endGridX, gy);
        ctx.stroke();
      }
      ctx.restore();

      // Draw Edges
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(s, s);

      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);

        if (source && target) {
          const isHighlighted = 
            hoveredNodeIdRef.current === source.id || 
            hoveredNodeIdRef.current === target.id ||
            selectedNodeIdRef.current === source.id ||
            selectedNodeIdRef.current === target.id;

          ctx.beginPath();
          ctx.moveTo(source.x || 0, source.y || 0);
          ctx.lineTo(target.x || 0, target.y || 0);
          
          if (isHighlighted) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1.5;
          } else {
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 0.8;
          }
          ctx.stroke();
        }
      });

      // Draw Nodes
      nodes.forEach(node => {
        const isHovered = hoveredNodeIdRef.current === node.id;
        const isSelected = selectedNodeIdRef.current === node.id;
        const radius = node.val;

        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI);

        // Node fill color based on type
        if (node.type === 'journal') {
          ctx.fillStyle = isSelected ? '#60a5fa' : isHovered ? '#3b82f6' : '#1d4ed8'; // Blue
        } else if (node.type === 'tag') {
          ctx.fillStyle = isSelected ? '#34d399' : isHovered ? '#10b981' : '#047857'; // Emerald
        } else {
          ctx.fillStyle = isSelected ? '#fb923c' : isHovered ? '#f97316' : '#c2410c'; // Orange
        }

        ctx.fill();

        // Node outer ring glow
        if (isSelected || isHovered) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        } else {
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#111111';
          ctx.stroke();
        }

        // Render Labels (dynamic fade based on zoom level)
        if (s > 0.4 || isHovered || isSelected) {
          ctx.fillStyle = isSelected ? '#ffffff' : isHovered ? '#3b82f6' : '#9ca3af';
          ctx.font = `bold ${Math.max(7, 9 - s)}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(node.label, node.x || 0, (node.y || 0) + radius + 4);
        }
      });

      ctx.restore();

      // Request next frame
      animationFrameIdRef.current = requestAnimationFrame(simulationTick);
    };

    // Start simulation loop
    animationFrameIdRef.current = requestAnimationFrame(simulationTick);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [settings.screenOn]);

  // --- ZOOM & PAN EVENT HANDLERS ---
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { x, y, scale } = transformRef.current;
    const zoomIntensity = 0.06;
    const delta = e.deltaY < 0 ? 1 : -1;
    
    // Target scale clamped between 0.3x and 4x
    const nextScale = Math.max(0.3, Math.min(4, scale + delta * zoomIntensity));

    // Zoom centered on mouse pointer
    const nextX = mouseX - (mouseX - x) * (nextScale / scale);
    const nextY = mouseY - (mouseY - y) * (nextScale / scale);

    transformRef.current = { x: nextX, y: nextY, scale: nextScale };
    setZoomLevel(Math.round(nextScale * 100));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 1. Check if we clicked a node (transposed into simulation space)
    const { x: tx, y: ty, scale: s } = transformRef.current;
    const simX = (clickX - tx) / s;
    const simY = (clickY - ty) / s;

    let clickedNodeIndex: number | null = null;
    const nodes = nodesRef.current;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const dx = (node.x || 0) - simX;
      const dy = (node.y || 0) - simY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= node.val + 2) {
        clickedNodeIndex = i;
        break;
      }
    }

    if (clickedNodeIndex !== null) {
      // Pin and drag node
      draggedNodeIndexRef.current = clickedNodeIndex;
      selectedNodeIdRef.current = nodes[clickedNodeIndex].id;
    } else {
      // Drag canvas (pan)
      draggedNodeIndexRef.current = null;
    }

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { x: tx, y: ty, scale: s } = transformRef.current;
    const simX = (mouseX - tx) / s;
    const simY = (mouseY - ty) / s;

    // Check hover
    let hoveredNode: GraphNode | null = null;
    const nodes = nodesRef.current;
    for (const node of nodes) {
      const dx = (node.x || 0) - simX;
      const dy = (node.y || 0) - simY;
      if (Math.sqrt(dx * dx + dy * dy) <= node.val + 3) {
        hoveredNode = node;
        break;
      }
    }
    hoveredNodeIdRef.current = hoveredNode ? hoveredNode.id : null;

    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (draggedNodeIndexRef.current !== null) {
      // Dragging a specific node
      const node = nodes[draggedNodeIndexRef.current];
      node.x = (node.x || 0) + dx / s;
      node.y = (node.y || 0) + dy / s;
      node.vx = 0;
      node.vy = 0;
    } else {
      // Panning camera
      transformRef.current.x += dx;
      transformRef.current.y += dy;
    }

    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    
    // If it was a quick click without much drag, perform navigation!
    if (draggedNodeIndexRef.current !== null) {
      const node = nodesRef.current[draggedNodeIndexRef.current];
      
      // Prevent navigation if node is a tag (tags aren't real pages, they act as index filters)
      if (!node.id.startsWith('tag-')) {
        if (e.shiftKey) {
          actions.navigateSidebar(node.id);
        } else {
          actions.setActiveView('editor');
          actions.navigateToPage(node.id);
        }
      }
    }
    draggedNodeIndexRef.current = null;
  };

  const zoom = (direction: 'in' | 'out') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y, scale } = transformRef.current;
    const factor = direction === 'in' ? 1.25 : 0.8;
    const nextScale = Math.max(0.3, Math.min(4, scale * factor));

    // Zoom from canvas center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const nextX = centerX - (centerX - x) * (nextScale / scale);
    const nextY = centerY - (centerY - y) * (nextScale / scale);

    transformRef.current = { x: nextX, y: nextY, scale: nextScale };
    setZoomLevel(Math.round(nextScale * 100));
  };

  const resetGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    transformRef.current = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      scale: 1
    };
    setZoomLevel(100);
    // Disperse nodes
    nodesRef.current.forEach(node => {
      node.x = Math.random() * 200 - 100;
      node.y = Math.random() * 200 - 100;
      node.vx = 0;
      node.vy = 0;
    });
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col bg-neutral-950 relative overflow-hidden">
      
      {/* Simulation canvas */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="flex-1 cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Floating HUD controls */}
      <div className="absolute left-3 bottom-3 flex items-center gap-1.5 bg-neutral-900/90 border border-neutral-800 px-3 py-1.5 rounded-full shadow z-10 text-[10px] text-neutral-400 font-semibold select-none">
        <span>Zoom: {zoomLevel}%</span>
        <div className="w-[1px] h-3 bg-neutral-800 mx-1"></div>
        <button
          onClick={() => zoom('in')}
          className="p-1 hover:text-white transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => zoom('out')}
          className="p-1 hover:text-white transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetGraph}
          className="p-1 hover:text-white transition-colors cursor-pointer"
          title="Reset Layout & Coordinates"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Legend / Helper */}
      <div className="absolute right-3 top-3 bg-neutral-900/95 border border-neutral-800 rounded-lg p-2.5 max-w-[150px] shadow text-[9px] text-neutral-400 leading-relaxed select-none z-10">
        <div className="flex items-center gap-1 font-bold text-white mb-1">
          <HelpCircle className="w-3.5 h-3.5 text-blue-400" /> Interaction
        </div>
        <ul className="space-y-1">
          <li>• <span className="text-orange-400">Orange</span>: Pages</li>
          <li>• <span className="text-blue-400">Blue</span>: Journals</li>
          <li>• <span className="text-emerald-400">Green</span>: Tags</li>
          <li className="text-neutral-500 mt-1">Drag canvas to pan.</li>
          <li className="text-neutral-500">Wheel scroll to zoom.</li>
          <li className="text-neutral-500">Click node to edit page.</li>
          <li className="text-neutral-500">Shift+Click opens in sidebar.</li>
        </ul>
      </div>
    </div>
  );
};
