import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { GraphNode, GraphEdge } from '../types';
import { Pause, Play, Tag, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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

    pages.forEach((page, i) => {
      const angle = (i / pages.length) * Math.PI * 2;
      const radius = 100 + Math.random() * 80;
      nodeMap.set(page.id, {
        id: page.id, label: page.name,
        x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
        vx: 0, vy: 0,
        isJournal: page.isJournal,
        isCurrent: page.id === state.currentPageId,
        connections: 0,
      });
    });

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

  useEffect(() => { buildGraph(); }, [buildGraph]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width / window.devicePixelRatio;
    const H = canvas.height / window.devicePixelRatio;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.translate(W / 2 + pan.x, H / 2 + pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    edgesRef.current.forEach(edge => {
      const src = nodesRef.current.find(n => n.id === edge.source);
      const tgt = nodesRef.current.find(n => n.id === edge.target);
      if (!src || !tgt) return;
      const isHighlighted = hoveredNode === src.id || hoveredNode === tgt.id;
      const isCurrent = src.isCurrent || tgt.isCurrent;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = isCurrent
        ? 'rgba(99,102,241,0.6)'
        : isHighlighted
          ? 'rgba(129,140,248,0.45)'
          : 'rgba(100,116,139,0.2)';
      ctx.lineWidth = isCurrent ? 1.5 : isHighlighted ? 1.2 : 0.7;
      ctx.stroke();
    });

    // Draw nodes
    nodesRef.current.forEach(node => {
      const isHov = hoveredNode === node.id;
      const r = Math.max(4, Math.min(13, 4 + node.connections * 1.5));

      // Glow
      if (node.isCurrent || isHov) {
        const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 3);
        grd.addColorStop(0, node.isCurrent ? 'rgba(99,102,241,0.5)' : 'rgba(129,140,248,0.25)');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = node.isCurrent
        ? '#6366f1'
        : isHov
          ? '#818cf8'
          : node.isJournal
            ? '#10b981'
            : '#475569';
      ctx.fill();
      ctx.strokeStyle = node.isCurrent ? '#a5b4fc' : isHov ? '#c7d2fe' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = node.isCurrent ? 2 : 1;
      ctx.stroke();

      // Label
      if (showLabels || isHov || node.isCurrent) {
        const label = node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label;
        ctx.fillStyle = node.isCurrent ? '#e0e7ff' : isHov ? '#c7d2fe' : '#64748b';
        ctx.font = `${node.isCurrent ? 'bold ' : ''}${Math.min(10, 7 + node.connections * 0.4)}px Inter, system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(label, node.x, node.y + r + 12);
      }
    });

    ctx.restore();
  }, [pan, zoom, showLabels, hoveredNode]);

  const simulate = useCallback(() => {
    if (paused) return;
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const repulsion = 2800;
    const attraction = 0.025;
    const gravity = 0.004;
    const damping = 0.86;
    const maxVel = 7;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const d2 = dx * dx + dy * dy || 1;
        const d = Math.sqrt(d2);
        const force = repulsion / d2;
        const nx = (dx / d) * force;
        const ny = (dy / d) * force;
        nodes[i].vx -= nx; nodes[i].vy -= ny;
        nodes[j].vx += nx; nodes[j].vy += ny;
      }
    }

    edges.forEach(edge => {
      const src = nodes.find(n => n.id === edge.source);
      const tgt = nodes.find(n => n.id === edge.target);
      if (!src || !tgt) return;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealLen = 80 + (src.connections + tgt.connections) * 4;
      const force = (d - idealLen) * attraction;
      src.vx += (dx / d) * force; src.vy += (dy / d) * force;
      tgt.vx -= (dx / d) * force; tgt.vy -= (dy / d) * force;
    });

    nodes.forEach(n => {
      n.vx -= n.x * gravity; n.vy -= n.y * gravity;
      n.vx *= damping; n.vy *= damping;
      n.vx = Math.max(-maxVel, Math.min(maxVel, n.vx));
      n.vy = Math.max(-maxVel, Math.min(maxVel, n.vy));
      if (n.id !== dragging) { n.x += n.vx; n.y += n.vy; }
    });
  }, [paused, dragging]);

  useEffect(() => {
    const loop = () => { simulate(); draw(); animRef.current = requestAnimationFrame(loop); };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [simulate, draw]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
      }
    });
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  const getNodeAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width; const H = rect.height;
    const cx = (clientX - rect.left - W / 2 - pan.x) / zoom;
    const cy = (clientY - rect.top - H / 2 - pan.y) / zoom;
    return nodesRef.current.find(n => {
      const r = Math.max(4, Math.min(13, 4 + n.connections * 1.5)) + 6;
      return Math.hypot(n.x - cx, n.y - cy) < r;
    }) || null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const canvas = canvasRef.current; if (!canvas) return;
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
    if (node) { setDragging(node.id); }
    else { setIsPanning(true); panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }; }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragging) {
      const node = getNodeAt(e.clientX, e.clientY);
      if (node && node.id === dragging) navigateTo(node.id);
    }
    setDragging(null); setIsPanning(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const node = getNodeAt(t.clientX, t.clientY);
    if (node) setDragging(node.id);
    else { setIsPanning(true); panStart.current = { x: t.clientX, y: t.clientY, panX: pan.x, panY: pan.y }; }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    if (dragging) {
      const canvas = canvasRef.current; if (!canvas) return;
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
      const t = e.changedTouches[0];
      const node = getNodeAt(t.clientX, t.clientY);
      if (node && node.id === dragging) navigateTo(node.id);
    }
    setDragging(null); setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.2, Math.min(4, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  };

  const stats = {
    nodes: nodesRef.current.length,
    edges: edgesRef.current.length,
    journals: nodesRef.current.filter(n => n.isJournal).length,
    pages: nodesRef.current.filter(n => !n.isJournal).length,
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(8,8,16,0.95)' }}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-bold text-slate-200">🌐 Knowledge Graph</h2>
            <p className="text-[10px] text-slate-500">{stats.nodes} nodes · {stats.edges} connections</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaused(p => !p)}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/8"
              style={{ color: paused ? '#f59e0b' : '#64748b' }}
              title={paused ? 'Resume physics' : 'Pause physics'}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <button
              onClick={() => setShowLabels(l => !l)}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/8"
              style={{ color: showLabels ? '#6366f1' : '#64748b' }}
              title="Toggle labels"
            >
              <Tag size={13} />
            </button>
            <button
              onClick={() => setZoom(z => Math.min(4, z * 1.25))}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/8 text-slate-500"
              title="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(0.2, z * 0.8))}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/8 text-slate-500"
              title="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); buildGraph(); }}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/8 text-slate-500"
              title="Reset"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />Current
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />Pages
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Journals
          </span>
          <span className="ml-auto">Drag · Tap to open</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setDragging(null); setIsPanning(false); setHoveredNode(null); }}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {hoveredNode && (
          <div
            className="absolute bottom-4 left-3 right-3 text-center animate-fade-in pointer-events-none"
          >
            <span
              className="inline-block px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(99,102,241,0.2)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#a5b4fc',
                backdropFilter: 'blur(12px)',
              }}
            >
              {nodesRef.current.find(n => n.id === hoveredNode)?.label} — tap to open
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-3 py-2 flex items-center justify-between shrink-0 border-t border-white/6">
        <span className="text-[10px] text-slate-600">{stats.pages} pages · {stats.journals} journals</span>
        <span className="text-[10px] text-slate-600">Zoom: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}
