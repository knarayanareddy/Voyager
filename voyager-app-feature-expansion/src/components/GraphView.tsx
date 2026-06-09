import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { GraphNode, GraphEdge, Page, Block } from '../types';
import { Pause, Play, Tag, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { extractRefs } from '../lib/parsing';
import { dbService } from '../utils/db';

export function extractEdgesFromPage(
  page: Pick<Page, 'blocks'>,
  pageIdByName: Map<string, string>
): string[] {
  const refs = new Set<string>();

  function walkBlocks(blocks: Pick<Block, 'content' | 'children'>[]) {
    for (const block of blocks) {
      for (const ref of extractRefs(block.content)) {
        let targetId = pageIdByName.get(ref);
        if (!targetId) {
          // Fallback: test maps or old index maps might use lowercased names with spaces (e.g. 'project alpha')
          for (const [key, val] of pageIdByName.entries()) {
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            if (normalizedKey === ref) {
              targetId = val;
              break;
            }
          }
        }
        if (targetId) refs.add(targetId);
      }
      if (block.children?.length) walkBlocks(block.children);
    }
  }

  walkBlocks(page.blocks);
  return [...refs];
}

export default function GraphView() {
  const { state, navigateTo } = useDatabase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 320, h: 400 });
  const animRef = useRef<number | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const pausedRef = useRef(false);
  const tickRef = useRef<() => void>(() => {});
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Track container dimensions via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let rafId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      if (rafId) return; // throttle with rAF
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDims({ w: Math.round(width), h: Math.round(height) });
        }
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Build graph from DB and restore layout
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const layoutId = useMemo(() => Object.keys(state.db).sort().join(','), [state.db]);
  const lastSavedPositionsRef = useRef<string>('');

  useEffect(() => {
    let active = true;
    setLayoutLoaded(false);
    
    dbService.getGraphLayout(layoutId).then(savedPositions => {
      if (!active) return;

      const pages = Object.values(state.db);
      const centerX = dims.w / 2, centerY = dims.h / 2;

      const initialNodes: GraphNode[] = pages.map((page, i) => {
        const saved = savedPositions ? savedPositions[page.id] : null;
        if (saved) {
          return {
            id: page.id,
            label: page.name,
            x: saved.x,
            y: saved.y,
            vx: 0, vy: 0,
            isJournal: page.isJournal,
            isCurrent: page.id === state.currentPageId,
            connections: 0,
          };
        } else {
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
        }
      });

      const pageIdByName = new Map(
        pages.map(p => [p.name.toLowerCase(), p.id])
      );
      const initialEdges: GraphEdge[] = [];
      const connCount: Record<string, number> = {};
      pages.forEach(page => {
        const edges = extractEdgesFromPage(page, pageIdByName);
        edges.forEach(target => {
          if (target !== page.id) {
            initialEdges.push({ source: page.id, target });
            connCount[page.id] = (connCount[page.id] || 0) + 1;
            connCount[target] = (connCount[target] || 0) + 1;
          }
        });
      });

      const nodesWithConns = initialNodes.map(n => ({ ...n, connections: connCount[n.id] || 0 }));
      nodesRef.current = nodesWithConns;
      edgesRef.current = initialEdges;
      setLayoutLoaded(true);
    });

    return () => {
      active = false;
    };
  }, [layoutId, state.db, state.currentPageId, dims.w, dims.h]);

  // Draw
  const drawCanvas = useCallback(() => {
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

    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    const nodeById = new Map(nodes.map(n => [n.id, n]));

    // Edges
    edges.forEach(edge => {
      const src = nodeById.get(edge.source);
      const tgt = nodeById.get(edge.target);
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
  }, [showLabels, zoom]);

  // Physics loop
  const tick = useCallback(() => {
    if (pausedRef.current || !layoutLoaded) {
      drawCanvas();
      animRef.current = requestAnimationFrame(() => tickRef.current());
      return;
    }

    const updated = nodesRef.current;
    const edges = edgesRef.current;
    const W = dims.w, H = dims.h;
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

    const nodeById = new Map(updated.map(n => [n.id, n]));

    // Spring attraction for edges
    edges.forEach(edge => {
      const src = nodeById.get(edge.source);
      const tgt = nodeById.get(edge.target);
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
    let maxSpeed = 0;
    updated.forEach(n => {
      if (n.id === draggingNode) return;
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x = Math.max(20, Math.min(W - 20, n.x + n.vx));
      n.y = Math.max(20, Math.min(H - 20, n.y + n.vy));

      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > maxSpeed) {
        maxSpeed = speed;
      }
    });

    // Save layout on stabilization
    if (maxSpeed < 0.1 && layoutLoaded) {
      const positions: Record<string, { x: number; y: number }> = {};
      updated.forEach(n => {
        positions[n.id] = { x: Math.round(n.x), y: Math.round(n.y) };
      });
      const positionsStr = JSON.stringify(positions);
      if (positionsStr !== lastSavedPositionsRef.current) {
        lastSavedPositionsRef.current = positionsStr;
        dbService.saveGraphLayout(layoutId, positions);
      }
    }

    drawCanvas();
    animRef.current = requestAnimationFrame(() => tickRef.current());
  }, [draggingNode, dims.w, dims.h, drawCanvas, layoutLoaded, layoutId]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(() => tickRef.current());
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Helper: extract canvas-space coordinates from a touch event
  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>, usedChangedTouches = false) => {
    const touch = usedChangedTouches ? e.changedTouches[0] : e.touches[0];
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (dims.w / rect.width),
      y: (touch.clientY - rect.top) * (dims.h / rect.height),
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (dims.w / rect.width);
    const my = (e.clientY - rect.top) * (dims.h / rect.height);
    const W = dims.w, H = dims.h;
    const cx = W / 2, cy = H / 2;
    const ax = (mx - cx) / zoom + cx;
    const ay = (my - cy) / zoom + cy;

    for (const n of nodesRef.current) {
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
    const mx = (e.clientX - rect.left) * (dims.w / rect.width);
    const my = (e.clientY - rect.top) * (dims.h / rect.height);
    const n = nodesRef.current.find(n => n.id === draggingNode);
    if (n) {
      n.x = mx;
      n.y = my;
      n.vx = 0;
      n.vy = 0;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (dims.w / rect.width);
    const my = (e.clientY - rect.top) * (dims.h / rect.height);
    for (const n of nodesRef.current) {
      const r = Math.max(5, 5 + n.connections * 1.5);
      if ((mx - n.x) ** 2 + (my - n.y) ** 2 < (r + 8) ** 2) {
        setDraggingNode(n.id);
        return;
      }
    }
  };

  // Touch handlers — mirror mouse handlers with tap detection
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getTouchPos(e);
    touchStartRef.current = { x, y, time: Date.now() };
    for (const n of nodesRef.current) {
      const r = Math.max(5, 5 + n.connections * 1.5);
      if ((x - n.x) ** 2 + (y - n.y) ** 2 < (r + 8) ** 2) {
        setDraggingNode(n.id);
        return;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!draggingNode) return;
    const { x, y } = getTouchPos(e);
    const n = nodesRef.current.find(n => n.id === draggingNode);
    if (n) {
      n.x = x;
      n.y = y;
      n.vx = 0;
      n.vy = 0;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setDraggingNode(null);

    // Detect tap: brief duration and minimal movement
    if (touchStartRef.current) {
      const { x: sx, y: sy, time } = touchStartRef.current;
      const elapsed = Date.now() - time;
      const { x: ex, y: ey } = getTouchPos(e, true);
      const moved = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);

      if (elapsed < 300 && moved < 10) {
        // Treat as a tap/click — select node
        const W = dims.w, H = dims.h;
        const cx = W / 2, cy = H / 2;
        const ax = (ex - cx) / zoom + cx;
        const ay = (ey - cy) / zoom + cy;
        for (const n of nodesRef.current) {
          const r = Math.max(5, 5 + n.connections * 1.5);
          const dx = ax - n.x, dy = ay - n.y;
          if (dx * dx + dy * dy < (r + 8) * (r + 8)) {
            navigateTo(n.id);
            break;
          }
        }
      }
      touchStartRef.current = null;
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
        <span className="ml-auto text-slate-600 text-[10px] self-center">{Object.keys(state.db).length} nodes</span>
      </div>

      <div ref={containerRef} className="flex-1 flex items-center justify-center bg-slate-950">
        <canvas
          ref={canvasRef}
          width={dims.w}
          height={dims.h}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ maxWidth: '100%', touchAction: 'none' }}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDraggingNode(null)}
          onMouseLeave={() => setDraggingNode(null)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
