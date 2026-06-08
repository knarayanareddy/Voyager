import { useEffect, useRef, useState, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { GraphNode, GraphEdge } from '../types';
import { Pause, Play, Tag, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function GraphView() {
  const { state, navigateTo } = useDatabase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [paused, setPaused] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const animRef = useRef<number | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const pausedRef = useRef(false);
  const tickRef = useRef<() => void>(() => {});

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Build graph from DB
  useEffect(() => {
    const pages = Object.values(state.db);
    const centerX = 160, centerY = 200;
    const initialNodes: GraphNode[] = pages.map((page, i) => {
      const angle = (i / pages.length) * Math.PI * 2;
      const radius = 100 + Math.random() * 60;
      return {
        id: page.id,
        label: page.name,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: 0, vy: 0,
        isJournal: page.isJournal,
        isCurrent: page.id === state.currentPageId,
        connections: 0,
      };
    });

    const initialEdges: GraphEdge[] = [];
    const connCount: Record<string, number> = {};
    pages.forEach(page => {
      const allContent = JSON.stringify(page.blocks);
      const wikiLinks = allContent.match(/\[\[([^\]]+)\]\]/g) || [];
      wikiLinks.forEach(link => {
        const target = link.slice(2, -2).toLowerCase().replace(/\s+/g, '-');
        if (state.db[target] && target !== page.id) {
          initialEdges.push({ source: page.id, target });
          connCount[page.id] = (connCount[page.id] || 0) + 1;
          connCount[target] = (connCount[target] || 0) + 1;
        }
      });
    });

    const nodesWithConns = initialNodes.map(n => ({ ...n, connections: connCount[n.id] || 0 }));
    setNodes(nodesWithConns);
    nodesRef.current = nodesWithConns;
    setEdges(initialEdges);
  }, [state.db, state.currentPageId]);

  // Physics loop
  const tick = useCallback(() => {
    if (pausedRef.current) {
      animRef.current = requestAnimationFrame(() => tickRef.current());
      return;
    }

    setNodes(prev => {
      const updated = prev.map(n => ({ ...n }));
      const W = 320, H = 400;
      const cx = W / 2, cy = H / 2;

      updated.forEach(n => {
        // Gravity toward center
        n.vx += (cx - n.x) * 0.001;
        n.vy += (cy - n.y) * 0.001;
      });

      // Repulsion
      for (let i = 0; i < updated.length; i++) {
        for (let j = i + 1; j < updated.length; j++) {
          const dx = updated[j].x - updated[i].x;
          const dy = updated[j].y - updated[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = Math.min(300 / (dist * dist), 2);
          updated[i].vx -= (dx / dist) * force;
          updated[i].vy -= (dy / dist) * force;
          updated[j].vx += (dx / dist) * force;
          updated[j].vy += (dy / dist) * force;
        }
      }

      // Spring attraction for edges
      edges.forEach(edge => {
        const src = updated.find(n => n.id === edge.source);
        const tgt = updated.find(n => n.id === edge.target);
        if (!src || !tgt) return;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 80;
        const force = (dist - targetDist) * 0.02;
        src.vx += (dx / dist) * force;
        src.vy += (dy / dist) * force;
        tgt.vx -= (dx / dist) * force;
        tgt.vy -= (dy / dist) * force;
      });

      // Damping + integrate
      updated.forEach(n => {
        if (n.id === draggingNode) return;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x = Math.max(20, Math.min(W - 20, n.x + n.vx));
        n.y = Math.max(20, Math.min(H - 20, n.y + n.vy));
      });

      nodesRef.current = updated;
      return updated;
    });

    animRef.current = requestAnimationFrame(() => tickRef.current());
  }, [edges, draggingNode]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(() => tickRef.current());
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    const offsetX = W / 2;
    const offsetY = H / 2;
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);
    ctx.translate(-offsetX, -offsetY);

    // Edges
    edges.forEach(edge => {
      const src = nodes.find(n => n.id === edge.source);
      const tgt = nodes.find(n => n.id === edge.target);
      if (!src || !tgt) return;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = 'rgba(99,102,241,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Nodes
    nodes.forEach(n => {
      const r = Math.max(5, 5 + n.connections * 1.5);
      const grd = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, r * 0.1, n.x, n.y, r);

      if (n.isCurrent) {
        grd.addColorStop(0, '#a5b4fc');
        grd.addColorStop(1, '#6366f1');
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#6366f1';
      } else if (n.isJournal) {
        grd.addColorStop(0, '#6ee7b7');
        grd.addColorStop(1, '#059669');
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#059669';
      } else {
        grd.addColorStop(0, '#93c5fd');
        grd.addColorStop(1, '#3b82f6');
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#3b82f6';
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (showLabels) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = `${Math.max(7, 7 + n.connections * 0.3)}px Inter, system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(n.label.length > 14 ? n.label.slice(0, 12) + '…' : n.label, n.x, n.y + r + 9);
      }
    });

    ctx.restore();
  }, [nodes, edges, showLabels, zoom]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (320 / rect.width);
    const my = (e.clientY - rect.top) * (400 / rect.height);
    const W = 320, H = 400;
    const cx = W / 2, cy = H / 2;
    const ax = (mx - cx) / zoom + cx;
    const ay = (my - cy) / zoom + cy;

    for (const n of nodes) {
      const r = Math.max(5, 5 + n.connections * 1.5);
      const dx = ax - n.x, dy = ay - n.y;
      if (dx * dx + dy * dy < (r + 8) * (r + 8)) {
        navigateTo(n.id);
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingNode) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (320 / rect.width);
    const my = (e.clientY - rect.top) * (400 / rect.height);
    setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x: mx, y: my, vx: 0, vy: 0 } : n));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (320 / rect.width);
    const my = (e.clientY - rect.top) * (400 / rect.height);
    for (const n of nodes) {
      const r = Math.max(5, 5 + n.connections * 1.5);
      if ((mx - n.x) ** 2 + (my - n.y) ** 2 < (r + 8) ** 2) {
        setDraggingNode(n.id);
        return;
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex gap-1.5 p-2 bg-slate-900 border-b border-slate-800 shrink-0 flex-wrap">
        <button onClick={() => setPaused(p => !p)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${paused ? 'bg-emerald-600/30 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
          {paused ? <Play size={10} /> : <Pause size={10} />} {paused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={() => setShowLabels(l => !l)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${showLabels ? 'bg-indigo-600/30 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
          <Tag size={10} /> Labels
        </button>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white">
          <ZoomIn size={12} />
        </button>
        <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white">
          <ZoomOut size={12} />
        </button>
        <button onClick={() => setZoom(1)} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white">
          <RotateCcw size={12} />
        </button>
        <span className="ml-auto text-slate-600 text-[10px] self-center">{nodes.length} nodes · {edges.length} edges</span>
      </div>

      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <canvas
          ref={canvasRef}
          width={320}
          height={400}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ maxWidth: '100%' }}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDraggingNode(null)}
          onMouseLeave={() => setDraggingNode(null)}
        />
      </div>

      <div className="p-2 bg-slate-900 border-t border-slate-800">
        <div className="flex gap-3 justify-center text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Current</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Journal</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Page</span>
        </div>
      </div>
    </div>
  );
}
