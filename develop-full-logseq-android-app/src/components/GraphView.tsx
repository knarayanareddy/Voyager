import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { GraphNode, GraphEdge } from '../types';
import { Play, Pause, ZoomIn, ZoomOut, RotateCcw, Tag } from 'lucide-react';

export default function GraphView() {
  const { state, navigateTo, getAllPages } = useDatabase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const [paused, setPaused] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const buildGraph = useCallback(() => {
    const pages = getAllPages();
    const nodeMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // Create nodes
    pages.forEach((page, i) => {
      const angle = (i / pages.length) * Math.PI * 2;
      const radius = 120 + Math.random() * 60;
      nodeMap.set(page.id, {
        id: page.id,
        label: page.name,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        isJournal: page.isJournal,
        isCurrent: page.id === state.currentPageId,
        connections: 0,
      });
    });

    // Create edges from refs
    function collectBlocks(blocks: any[]): any[] {
      return blocks.reduce((acc: any[], b: any) => [...acc, b, ...collectBlocks(b.children)], []);
    }

    pages.forEach(page => {
      const blocks = collectBlocks(page.blocks);
      const seen = new Set<string>();
      blocks.forEach(block => {
        (block.refs || []).forEach((ref: string) => {
          const targetPage = pages.find(p =>
            p.name.toLowerCase() === ref.toLowerCase() ||
            p.id.toLowerCase() === ref.toLowerCase()
          );
          if (targetPage && targetPage.id !== page.id && !seen.has(targetPage.id)) {
            seen.add(targetPage.id);
            edges.push({ source: page.id, target: targetPage.id });
            const srcNode = nodeMap.get(page.id);
            const tgtNode = nodeMap.get(targetPage.id);
            if (srcNode) srcNode.connections++;
            if (tgtNode) tgtNode.connections++;
          }
        });
      });
    });

    nodesRef.current = Array.from(nodeMap.values());
    edgesRef.current = edges;
  }, [getAllPages, state.currentPageId]);

  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 + pan.x, H / 2 + pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    edgesRef.current.forEach(edge => {
      const src = nodesRef.current.find(n => n.id === edge.source);
      const tgt = nodesRef.current.find(n => n.id === edge.target);
      if (!src || !tgt) return;

      const isHovered = hoveredNode === src.id || hoveredNode === tgt.id;
      const isCurrent = src.isCurrent || tgt.isCurrent;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = isCurrent
        ? 'rgba(99,102,241,0.7)'
        : isHovered
        ? 'rgba(99,102,241,0.5)'
        : 'rgba(100,100,120,0.25)';
      ctx.lineWidth = isCurrent ? 1.5 : isHovered ? 1.2 : 0.8;
      ctx.stroke();
    });

    // Draw nodes
    nodesRef.current.forEach(node => {
      const isHov = hoveredNode === node.id;
      const radius = Math.max(5, Math.min(14, 5 + node.connections * 1.5));

      // Glow for current/hovered
      if (node.isCurrent || isHov) {
        const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 2.5);
        grd.addColorStop(0, node.isCurrent ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.2)');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      const color = node.isCurrent ? '#6366f1'
        : isHov ? '#818cf8'
        : node.isJournal ? '#10b981'
        : '#64748b';
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.strokeStyle = node.isCurrent ? '#a5b4fc' : isHov ? '#818cf8' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = node.isCurrent ? 2 : 1;
      ctx.stroke();

      // Label
      if (showLabels) {
        const label = node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label;
        ctx.fillStyle = node.isCurrent ? '#e0e7ff' : isHov ? '#c7d2fe' : '#94a3b8';
        ctx.font = `${node.isCurrent ? 'bold ' : ''}${Math.min(11, 8 + node.connections * 0.5)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(label, node.x, node.y + radius + 13);
      }
    });

    ctx.restore();
  }, [pan, zoom, showLabels, hoveredNode]);

  const simulate = useCallback(() => {
    if (paused) return;
    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    const repulsion = 2500;
    const attraction = 0.03;
    const gravity = 0.005;
    const damping = 0.88;
    const maxVel = 8;

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const d2 = dx * dx + dy * dy || 1;
        const d = Math.sqrt(d2);
        const force = repulsion / d2;
        const nx = (dx / d) * force;
        const ny = (dy / d) * force;
        nodes[i].vx -= nx;
        nodes[i].vy -= ny;
        nodes[j].vx += nx;
        nodes[j].vy += ny;
      }
    }

    // Attraction along edges
    edges.forEach(edge => {
      const src = nodes.find(n => n.id === edge.source);
      const tgt = nodes.find(n => n.id === edge.target);
      if (!src || !tgt) return;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealLen = 80 + (src.connections + tgt.connections) * 5;
      const force = (d - idealLen) * attraction;
      src.vx += (dx / d) * force;
      src.vy += (dy / d) * force;
      tgt.vx -= (dx / d) * force;
      tgt.vy -= (dy / d) * force;
    });

    // Gravity toward center
    nodes.forEach(n => {
      n.vx -= n.x * gravity;
      n.vy -= n.y * gravity;
      n.vx *= damping;
      n.vy *= damping;
      n.vx = Math.max(-maxVel, Math.min(maxVel, n.vx));
      n.vy = Math.max(-maxVel, Math.min(maxVel, n.vy));
      if (n.id !== dragging) {
        n.x += n.vx;
        n.y += n.vy;
      }
    });
  }, [paused, dragging]);

  useEffect(() => {
    const loop = () => {
      simulate();
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [simulate, draw]);

  // Canvas resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width * devicePixelRatio;
        canvas.height = entry.contentRect.height * devicePixelRatio;
        canvas.style.width = entry.contentRect.width + 'px';
        canvas.style.height = entry.contentRect.height + 'px';
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio);
      }
    });
    observer.observe(canvas.parentElement!);
    return () => observer.disconnect();
  }, []);

  const getNodeAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cx = (clientX - rect.left - rect.width / 2 - pan.x) / zoom;
    const cy = (clientY - rect.top - rect.height / 2 - pan.y) / zoom;
    return nodesRef.current.find(n => {
      const r = Math.max(5, Math.min(14, 5 + n.connections * 1.5)) + 5;
      return Math.hypot(n.x - cx, n.y - cy) < r;
    }) || null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left - rect.width / 2 - pan.x) / zoom;
      const cy = (e.clientY - rect.top - rect.height / 2 - pan.y) / zoom;
      const node = nodesRef.current.find(n => n.id === dragging);
      if (node) { node.x = cx; node.y = cy; node.vx = 0; node.vy = 0; }
      return;
    }
    if (isPanning) {
      setPan({ x: panStart.current.panX + e.clientX - panStart.current.x, y: panStart.current.panY + e.clientY - panStart.current.y });
      return;
    }
    const node = getNodeAt(e.clientX, e.clientY);
    setHoveredNode(node ? node.id : null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const node = getNodeAt(e.clientX, e.clientY);
    if (node) {
      setDragging(node.id);
    } else {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragging) {
      const node = getNodeAt(e.clientX, e.clientY);
      if (node && node.id === dragging) {
        navigateTo(node.id);
      }
    }
    setDragging(null);
    setIsPanning(false);
  };

  // Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const node = getNodeAt(t.clientX, t.clientY);
    if (node) setDragging(node.id);
    else {
      setIsPanning(true);
      panStart.current = { x: t.clientX, y: t.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    if (dragging) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = (t.clientX - rect.left - rect.width / 2 - pan.x) / zoom;
      const cy = (t.clientY - rect.top - rect.height / 2 - pan.y) / zoom;
      const node = nodesRef.current.find(n => n.id === dragging);
      if (node) { node.x = cx; node.y = cy; node.vx = 0; node.vy = 0; }
    } else if (isPanning) {
      setPan({ x: panStart.current.panX + t.clientX - panStart.current.x, y: panStart.current.panY + t.clientY - panStart.current.y });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragging) {
      // short tap = navigate
      const t = e.changedTouches[0];
      const node = getNodeAt(t.clientX, t.clientY);
      if (node && node.id === dragging) navigateTo(node.id);
    }
    setDragging(null);
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(4, z * delta)));
  };

  const stats = {
    nodes: nodesRef.current.length,
    edges: edgesRef.current.length,
    journals: nodesRef.current.filter(n => n.isJournal).length,
    pages: nodesRef.current.filter(n => !n.isJournal).length,
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)]">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">🌐 Knowledge Graph</h2>
          <p className="text-xs text-[var(--color-text-tertiary)]">{stats.nodes} nodes · {stats.edges} connections</p>
        </div>
        <div className="flex items-center gap-1">
          <button className={`p-1.5 rounded text-xs ${showLabels ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]'}`}
            onClick={() => setShowLabels(!showLabels)} title="Toggle labels">
            <Tag size={13} />
          </button>
          <button className={`p-1.5 rounded text-xs ${paused ? 'bg-green-500/20 text-green-400' : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]'}`}
            onClick={() => setPaused(!paused)} title={paused ? 'Resume' : 'Pause'}>
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button className="p-1.5 rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]"
            onClick={() => setZoom(z => Math.min(4, z * 1.2))} title="Zoom in">
            <ZoomIn size={13} />
          </button>
          <button className="p-1.5 rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]"
            onClick={() => setZoom(z => Math.max(0.2, z * 0.8))} title="Zoom out">
            <ZoomOut size={13} />
          </button>
          <button className="p-1.5 rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]"
            onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); buildGraph(); }} title="Reset">
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-1.5 flex items-center gap-3 text-[10px] text-[var(--color-text-tertiary)] border-b border-[var(--color-border)] shrink-0">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#6366f1] inline-block" />Current</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#64748b] inline-block" />Pages</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#10b981] inline-block" />Journals</span>
        <span className="ml-auto">Tap to navigate · Drag to reposition · Pinch to zoom</span>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDragging(null); setIsPanning(false); setHoveredNode(null); }}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: dragging ? 'grabbing' : isPanning ? 'grabbing' : hoveredNode ? 'pointer' : 'grab' }}
        />
        {hoveredNode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] shadow-lg pointer-events-none">
            {nodesRef.current.find(n => n.id === hoveredNode)?.label} — tap to open
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="px-4 py-1.5 border-t border-[var(--color-border)] flex items-center justify-between text-[10px] text-[var(--color-text-tertiary)] shrink-0">
        <span>{stats.pages} pages · {stats.journals} journals</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}
