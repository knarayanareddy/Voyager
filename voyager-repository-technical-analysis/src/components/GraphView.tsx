import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { GraphNode, GraphEdge } from '../types';
import { Pause, Play, Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react';

export default function GraphView() {
  const { state, navigateTo } = useDatabase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const draggingRef = useRef<string | null>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const canvasSizeRef = useRef({ w: 320, h: 400 });

  const [paused, setPaused] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

  // ── Build graph from DB ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const W = container.clientWidth || 320;
    const H = container.clientHeight || 400;
    canvasSizeRef.current = { w: W, h: H };
    canvas.width = W;
    canvas.height = H;

    const pages = Object.values(state.db);
    const cx = W / 2, cy = H / 2;

    const initialNodes: GraphNode[] = pages.map((page, i) => {
      const angle = (i / pages.length) * Math.PI * 2;
      const radius = Math.min(W, H) * 0.28 + Math.random() * 40;
      return {
        id: page.id,
        label: page.name,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        isJournal: page.isJournal,
        isCurrent: page.id === state.currentPageId,
        connections: 0,
      };
    });

    const initialEdges: GraphEdge[] = [];
    const connCount: Record<string, number> = {};
    const seen = new Set<string>();

    pages.forEach(page => {
      // Use refs from blocks instead of JSON.stringify
      function collectRefs(blocks: typeof page.blocks): Set<string> {
        const refs = new Set<string>();
        for (const b of blocks) {
          for (const r of b.refs) {
            refs.add(r.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
          }
          if (b.children.length) {
            collectRefs(b.children).forEach(r => refs.add(r));
          }
        }
        return refs;
      }
      const refs = collectRefs(page.blocks);

      refs.forEach(ref => {
        if (state.db[ref] && ref !== page.id) {
          const edgeKey = [page.id, ref].sort().join('--');
          if (!seen.has(edgeKey)) {
            seen.add(edgeKey);
            initialEdges.push({ source: page.id, target: ref });
          }
          connCount[page.id] = (connCount[page.id] || 0) + 1;
          connCount[ref] = (connCount[ref] || 0) + 1;
        }
      });
    });

    const nodesWithConns = initialNodes.map(n => ({
      ...n,
      connections: connCount[n.id] || 0,
    }));

    nodesRef.current = nodesWithConns;
    edgesRef.current = initialEdges;
    setStats({ nodes: nodesWithConns.length, edges: initialEdges.length });
  }, [state.db, state.currentPageId]);

  // ── Physics tick (refs only — no React state) ───────────────────────────
  const tick = useCallback(() => {
    if (!pausedRef.current) {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const { w: W, h: H } = canvasSizeRef.current;
      const cx = W / 2, cy = H / 2;

      // Gravity
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.001;
        n.vy += (cy - n.y) * 0.001;
      }

      // Repulsion — O(n²) but kept in refs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = Math.min(400 / (dist * dist), 3);
          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }

      // Spring attraction
      for (const edge of edges) {
        const src = nodes.find(n => n.id === edge.source);
        const tgt = nodes.find(n => n.id === edge.target);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 90;
        const force = (dist - targetDist) * 0.018;
        src.vx += (dx / dist) * force;
        src.vy += (dy / dist) * force;
        tgt.vx -= (dx / dist) * force;
        tgt.vy -= (dy / dist) * force;
      }

      // Integrate + damp
      for (const n of nodes) {
        if (n.id === draggingRef.current) continue;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x = Math.max(20, Math.min(W - 20, n.x + n.vx));
        n.y = Math.max(20, Math.min(H - 20, n.y + n.vy));
      }
    }

    draw();
    animRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Draw ───────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w: W, h: H } = canvasSizeRef.current;
    const z = zoomRef.current;
    const pan = panRef.current;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(z, z);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    // Draw edges
    for (const edge of edges) {
      const src = nodes.find(n => n.id === edge.source);
      const tgt = nodes.find(n => n.id === edge.target);
      if (!src || !tgt) continue;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = 'rgba(99,102,241,0.2)';
      ctx.lineWidth = 1 / z;
      ctx.stroke();
    }

    // Draw nodes
    for (const n of nodes) {
      const r = Math.max(6, 5 + n.connections * 1.8);
      const grd = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, r * 0.1, n.x, n.y, r);

      if (n.isCurrent) {
        grd.addColorStop(0, '#a5b4fc');
        grd.addColorStop(1, '#6366f1');
        ctx.shadowBlur = 20 / z;
        ctx.shadowColor = '#6366f1';
      } else if (n.isJournal) {
        grd.addColorStop(0, '#6ee7b7');
        grd.addColorStop(1, '#059669');
        ctx.shadowBlur = 6 / z;
        ctx.shadowColor = '#059669';
      } else {
        grd.addColorStop(0, '#93c5fd');
        grd.addColorStop(1, '#3b82f6');
        ctx.shadowBlur = 8 / z;
        ctx.shadowColor = '#3b82f6';
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (showLabels) {
        const fontSize = Math.max(8, 7 + n.connections * 0.4);
        ctx.font = `${fontSize}px Inter, system-ui`;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.textAlign = 'center';
        const label = n.label.length > 16 ? n.label.slice(0, 14) + '…' : n.label;
        ctx.fillText(label, n.x, n.y + r + 11);
      }
    }

    ctx.restore();
  }, [showLabels]);

  // ── Start/stop animation loop ─────────────────────────────────────────────
  useEffect(() => {
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [tick]);

  // ── Pause sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // ── Zoom sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // ── Pointer helpers ───────────────────────────────────────────────────────
  function screenToWorld(sx: number, sy: number) {
    const pan = panRef.current;
    const z = zoomRef.current;
    return { x: (sx - pan.x) / z, y: (sy - pan.y) / z };
  }

  function findNodeAt(wx: number, wy: number): GraphNode | undefined {
    return nodesRef.current.find(n => {
      const r = Math.max(6, 5 + n.connections * 1.8) + 8;
      return (wx - n.x) ** 2 + (wy - n.y) ** 2 < r * r;
    });
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    const node = findNodeAt(wx, wy);

    if (node) {
      draggingRef.current = node.id;
    } else {
      isPanningRef.current = true;
    }
    lastPointerRef.current = { x: sx, y: sy };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (draggingRef.current) {
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const node = nodesRef.current.find(n => n.id === draggingRef.current);
      if (node) {
        node.x = wx;
        node.y = wy;
        node.vx = 0;
        node.vy = 0;
      }
    } else if (isPanningRef.current) {
      const dx = sx - lastPointerRef.current.x;
      const dy = sy - lastPointerRef.current.y;
      panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
    }
    lastPointerRef.current = { x: sx, y: sy };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingRef.current) {
      draggingRef.current = null;
      return;
    }
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }
    // Click to navigate
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    const node = findNodeAt(wx, wy);
    if (node) navigateTo(node.id);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(z => Math.max(0.3, Math.min(4, z * factor)));
  };

  return (
    <div ref={containerRef} className="relative h-full bg-slate-950 overflow-hidden">
      {/* Controls */}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <button
          onClick={() => setPaused(p => !p)}
          className="w-8 h-8 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          title={paused ? 'Resume' : 'Pause'}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button
          onClick={() => setShowLabels(s => !s)}
          className="w-8 h-8 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          title={showLabels ? 'Hide labels' : 'Show labels'}
        >
          {showLabels ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={() => setZoom(z => Math.min(4, z * 1.2))}
          className="w-8 h-8 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.3, z / 1.2))}
          className="w-8 h-8 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <ZoomOut size={14} />
        </button>
      </div>

      {/* Stats */}
      <div className="absolute top-3 right-3 z-10 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400 backdrop-blur">
        {stats.nodes} nodes · {stats.edges} edges
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          draggingRef.current = null;
          isPanningRef.current = false;
        }}
        onWheel={handleWheel}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-3 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
          Current
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          Journal
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
          Page
        </span>
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 right-3 text-[10px] text-slate-600">
        Drag · Scroll to zoom · Tap node
      </div>
    </div>
  );
}
