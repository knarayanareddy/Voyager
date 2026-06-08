import React, { useEffect, useRef, useState } from 'react';
import { Page } from '../types';
import { Play, Pause, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

interface GraphNode {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isJournal: boolean;
  isCurrent: boolean;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphViewProps {
  pages: Page[];
  currentPageName: string;
  onNavigate: (pageName: string) => void;
  theme: 'dark' | 'light';
}

export default function GraphView({ pages, currentPageName, onNavigate, theme }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [draggedNode, setDraggedNode] = useState<GraphNode | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Parse pages and links
  useEffect(() => {
    // Helper to find links in a block recursively
    const extractLinks = (text: string): string[] => {
      const pageLinkRegex = /\[\[(.*?)\]\]/g;
      const hashtagRegex = /#([a-zA-Z0-9_\-]+)/g;
      const results: string[] = [];
      let match;

      while ((match = pageLinkRegex.exec(text)) !== null) {
        if (match[1]) results.push(match[1].trim());
      }
      while ((match = hashtagRegex.exec(text)) !== null) {
        if (match[1]) results.push(match[1].trim());
      }
      return results;
    };

    const getBlocksText = (blocks: any[]): string => {
      let text = '';
      for (const b of blocks) {
        text += ' ' + b.content;
        if (b.children && b.children.length > 0) {
          text += ' ' + getBlocksText(b.children);
        }
      }
      return text;
    };

    // Construct nodes
    const initialNodes: GraphNode[] = pages.map((page, index) => {
      const angle = (index / pages.length) * Math.PI * 2;
      const radius = page.isJournal ? 8 : 12;
      return {
        id: page.name,
        name: page.name,
        // Spread nodes out initially in a circle
        x: 200 + Math.cos(angle) * 120,
        y: 250 + Math.sin(angle) * 120,
        vx: 0,
        vy: 0,
        radius: page.name === currentPageName ? radius + 3 : radius,
        isJournal: page.isJournal,
        isCurrent: page.name === currentPageName
      };
    });

    // Construct links
    const initialLinks: GraphLink[] = [];

    pages.forEach(page => {
      const pageText = getBlocksText(page.blocks);
      const targets = extractLinks(pageText);

      targets.forEach(target => {
        // Find if target page exists (case insensitive)
        const matchedPage = pages.find(p => p.name.toLowerCase() === target.toLowerCase());
        if (matchedPage) {
          // Check if link already exists
          const linkExists = initialLinks.some(
            l =>
              (l.source === page.name && l.target === matchedPage.name) ||
              (l.source === matchedPage.name && l.target === page.name)
          );
          if (!linkExists) {
            initialLinks.push({
              source: page.name,
              target: matchedPage.name
            });
          }
        }
      });
    });

    setNodes(initialNodes);
    setLinks(initialLinks);
  }, [pages, currentPageName]);

  // Physics and Drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const runPhysicsAndDraw = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (!isPaused) {
        // --- 1. Force-directed Simulation ---
        const kRepel = 200; // Repulsion constant
        const kAttract = 0.04; // Spring constant
        const centerGravity = 0.015; // Centering force
        const damping = 0.85; // Friction

        // Center of canvas
        const cx = width / 2;
        const cy = height / 2;

        // Node repulsion (all pairs repel)
        for (let i = 0; i < nodes.length; i++) {
          const n1 = nodes[i];
          if (n1 === draggedNode) continue;

          for (let j = i + 1; j < nodes.length; j++) {
            const n2 = nodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            if (dist < 250) {
              // Repulsive force inversely proportional to distance
              const force = (kRepel * (n1.radius * n2.radius)) / (dist * dist);
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              n1.vx -= fx;
              n1.vy -= fy;
              n2.vx += fx;
              n2.vy += fy;
            }
          }

          // Gravity towards center
          n1.vx += (cx - n1.x) * centerGravity;
          n1.vy += (cy - n1.y) * centerGravity;
        }

        // Link attraction (connected nodes pull together)
        links.forEach(link => {
          const sNode = nodes.find(n => n.id === link.source);
          const tNode = nodes.find(n => n.id === link.target);

          if (sNode && tNode) {
            const dx = tNode.x - sNode.x;
            const dy = tNode.y - sNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = dist * kAttract;

            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (sNode !== draggedNode) {
              sNode.vx += fx;
              sNode.vy += fy;
            }
            if (tNode !== draggedNode) {
              tNode.vx -= fx;
              tNode.vy -= fy;
            }
          }
        });

        // Update positions
        nodes.forEach(node => {
          if (node === draggedNode) return;

          node.x += node.vx;
          node.y += node.vy;
          node.vx *= damping;
          node.vy *= damping;

          // Boundary constraints
          const padding = 20;
          if (node.x < padding) { node.x = padding; node.vx = 0; }
          if (node.x > width - padding) { node.x = width - padding; node.vx = 0; }
          if (node.y < padding) { node.y = padding; node.vy = 0; }
          if (node.y > height - padding) { node.y = height - padding; node.vy = 0; }
        });
      }

      // --- 2. Drawing ---
      ctx.clearRect(0, 0, width, height);

      // Save context for zooming and panning
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Draw Grid Background
      const gridSpacing = 40;
      ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Draw vertical lines
      for (let x = -width * 2; x < width * 3; x += gridSpacing) {
        ctx.moveTo(x, -height * 2);
        ctx.lineTo(x, height * 3);
      }
      // Draw horizontal lines
      for (let y = -height * 2; y < height * 3; y += gridSpacing) {
        ctx.moveTo(-width * 2, y);
        ctx.lineTo(width * 3, y);
      }
      ctx.stroke();

      // Draw links
      ctx.lineWidth = 1.5;
      links.forEach(link => {
        const sNode = nodes.find(n => n.id === link.source);
        const tNode = nodes.find(n => n.id === link.target);

        if (sNode && tNode) {
          // Highlight link if one of nodes is hovered
          const isHighlighted = hoveredNode && (hoveredNode.id === sNode.id || hoveredNode.id === tNode.id);
          
          if (isHighlighted) {
            ctx.strokeStyle = theme === 'dark' ? '#10b981' : '#059669'; // Emerald-500/600
            ctx.lineWidth = 2.5;
            ctx.shadowColor = theme === 'dark' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(5, 150, 105, 0.3)';
            ctx.shadowBlur = 4;
          } else {
            ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
            ctx.lineWidth = 1.2;
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          ctx.moveTo(sNode.x, sNode.y);
          ctx.lineTo(tNode.x, tNode.y);
          ctx.stroke();
        }
      });
      ctx.shadowBlur = 0; // Reset shadow

      // Draw nodes
      nodes.forEach(node => {
        const isHovered = hoveredNode?.id === node.id;
        const isCurrent = node.isCurrent;

        // Circle Color
        let nodeColor = '';
        if (isCurrent) {
          nodeColor = '#10b981'; // Emerald 500 (Active Logseq green)
        } else if (node.isJournal) {
          nodeColor = theme === 'dark' ? '#a1a1aa' : '#71717a'; // Gray
        } else {
          nodeColor = theme === 'dark' ? '#38bdf8' : '#0284c7'; // Sky Blue
        }

        // Draw shadow/glow for current or hovered
        if (isCurrent || isHovered) {
          ctx.shadowColor = nodeColor;
          ctx.shadowBlur = isHovered ? 12 : 8;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        // Node border/ring
        ctx.strokeStyle = theme === 'dark' ? '#1f2937' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0; // Reset shadow for labels

        // Draw Labels
        if (showLabels || isHovered || isCurrent) {
          ctx.fillStyle = theme === 'dark' 
            ? (isCurrent ? '#34d399' : '#e4e4e7') 
            : (isCurrent ? '#047857' : '#1f2937');
          
          ctx.font = isCurrent || isHovered 
            ? 'bold 11px sans-serif' 
            : '9px sans-serif';
          
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          
          const labelText = node.name;
          // Crop label if too long
          const croppedLabel = labelText.length > 22 ? labelText.substring(0, 20) + '...' : labelText;

          // Draw a small semi-transparent background for label readability
          const textWidth = ctx.measureText(croppedLabel).width;
          ctx.fillStyle = theme === 'dark' ? 'rgba(17, 24, 39, 0.75)' : 'rgba(255, 255, 255, 0.85)';
          ctx.fillRect(node.x - textWidth / 2 - 4, node.y + node.radius + 3, textWidth + 8, 14);

          // Re-draw text
          ctx.fillStyle = theme === 'dark' 
            ? (isCurrent ? '#34d399' : '#e4e4e7') 
            : (isCurrent ? '#047857' : '#1f2937');
          ctx.fillText(croppedLabel, node.x, node.y + node.radius + 5);
        }
      });

      ctx.restore();

      animationId = requestAnimationFrame(runPhysicsAndDraw);
    };

    runPhysicsAndDraw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [nodes, links, hoveredNode, draggedNode, isPaused, showLabels, zoom, pan, theme]);

  // Canvas size adjustment
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight || 400;
    }
  }, []);

  // Convert mouse/touch screen coordinates to zoomed/panned canvas coordinates
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Inverse transform zoom and pan
    return {
      x: (x - pan.x) / zoom,
      y: (y - pan.y) / zoom
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    
    // Check if clicked on a node
    const clickedNode = nodes.find(node => {
      const dx = node.x - coords.x;
      const dy = node.y - coords.y;
      return Math.sqrt(dx * dx + dy * dy) <= node.radius + 10; // Extra padding for easy clicking
    });

    if (clickedNode) {
      setDraggedNode(clickedNode);
    } else {
      setIsDraggingCanvas(true);
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    if (draggedNode) {
      // Move dragged node
      setNodes(prev =>
        prev.map(n => (n.id === draggedNode.id ? { ...n, x: coords.x, y: coords.y, vx: 0, vy: 0 } : n))
      );
    } else if (isDraggingCanvas) {
      // Pan canvas
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    } else {
      // Hover detection
      const hovered = nodes.find(node => {
        const dx = node.x - coords.x;
        const dy = node.y - coords.y;
        return Math.sqrt(dx * dx + dy * dy) <= node.radius + 8;
      });
      setHoveredNode(hovered || null);
    }
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNode) {
      // If we didn't drag it far, treat as a click/navigation
      const coords = getCanvasCoords(e);
      const dx = draggedNode.x - coords.x;
      const dy = draggedNode.y - coords.y;
      const moveDist = Math.sqrt(dx * dx + dy * dy);
      
      // If drag distance is small, navigate
      if (moveDist < 5) {
        onNavigate(draggedNode.name);
      }
      setDraggedNode(null);
    }
    setIsDraggingCanvas(false);
  };

  // Touch handlers for mobile / S-Pen support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const clickedNode = nodes.find(node => {
      const dx = node.x - coords.x;
      const dy = node.y - coords.y;
      return Math.sqrt(dx * dx + dy * dy) <= node.radius + 15; // Larger padding for touch
    });

    if (clickedNode) {
      setDraggedNode(clickedNode);
    } else {
      setIsDraggingCanvas(true);
      if (e.touches.length > 0) {
        dragStart.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    if (draggedNode) {
      setNodes(prev =>
        prev.map(n => (n.id === draggedNode.id ? { ...n, x: coords.x, y: coords.y, vx: 0, vy: 0 } : n))
      );
    } else if (isDraggingCanvas && e.touches.length > 0) {
      setPan({
        x: e.touches[0].clientX - dragStart.current.x,
        y: e.touches[0].clientY - dragStart.current.y
      });
    }
  };

  const handleTouchEnd = () => {
    if (draggedNode) {
      // On mobile tap, navigate
      onNavigate(draggedNode.name);
      setDraggedNode(null);
    }
    setIsDraggingCanvas(false);
  };

  const resetGraph = () => {
    // Re-distribute nodes
    setNodes(prev =>
      prev.map((node, index) => {
        const angle = (index / prev.length) * Math.PI * 2;
        return {
          ...node,
          x: 200 + Math.cos(angle) * 120,
          y: 250 + Math.sin(angle) * 120,
          vx: 0,
          vy: 0
        };
      })
    );
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="relative flex flex-col h-full w-full select-none bg-slate-900/5 dark:bg-slate-950/20 rounded-xl overflow-hidden">
      {/* Title */}
      <div className="absolute top-3 left-4 z-10 pointer-events-none">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white/85 dark:bg-slate-900/80 px-2.5 py-1 rounded-md shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-xs">
          Interactive Knowledge Graph
        </h3>
      </div>

      {/* Physics & Zoom Controls */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex space-x-1.5 pointer-events-auto bg-white/80 dark:bg-slate-900/85 p-1.5 rounded-lg shadow-md border border-slate-100 dark:border-slate-800 backdrop-blur-xs">
          <button
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? "Resume Physics" : "Pause Physics"}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            {isPaused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            onClick={resetGraph}
            title="Reset Positions & Zoom"
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setShowLabels(!showLabels)}
            title="Toggle Labels"
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
              showLabels
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'text-slate-500 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Labels
          </button>
        </div>

        <div className="flex space-x-1.5 pointer-events-auto bg-white/80 dark:bg-slate-900/85 p-1.5 rounded-lg shadow-md border border-slate-100 dark:border-slate-800 backdrop-blur-xs">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
            title="Zoom Out"
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            <ZoomOut size={15} />
          </button>
          <span className="text-[10px] font-semibold flex items-center px-1 text-slate-500 dark:text-slate-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
            title="Zoom In"
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full cursor-grab active:cursor-grabbing bg-slate-50 dark:bg-slate-950/40"
      />
    </div>
  );
}
