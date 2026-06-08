import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getTodayJournalId } from '../mockData';
import {
  MousePointer, Square, Circle as CircleIcon, Type as TypeIcon,
  ArrowRight, Trash2, Save, Undo, Redo, ZoomIn, ZoomOut,
  RotateCcw, Download, X
} from 'lucide-react';

type ToolType = 'select' | 'pan' | 'pen' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'eraser';
type ShapeType = 'rect' | 'ellipse' | 'arrow' | 'line' | 'text' | 'freehand';

interface Shape {
  id: string;
  type: ShapeType;
  x: number; y: number;
  width: number; height: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  text?: string;
  points?: { x: number; y: number }[];
  opacity: number;
  roughness: number;
}

const COLORS = ['#e2e8f0', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', 'transparent'];
const STROKE_WIDTHS = [1, 2, 4, 8];

let shapeIdCounter = 1;
const genShapeId = () => `shape-${shapeIdCounter++}`;

export default function Whiteboard({ onClose }: { onClose?: () => void }) {
  const { dispatch } = useDatabase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolType>('pen');
  const [strokeColor, setStrokeColor] = useState('#6366f1');
  const [fillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [undoStack, setUndoStack] = useState<Shape[][]>([]);
  const [redoStack, setRedoStack] = useState<Shape[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editingText, setEditingText] = useState<string | null>(null);
  const [textValue, setTextValue] = useState('');
  const [saved, setSaved] = useState(false);

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: Shape, selected = false) => {
    ctx.save();
    ctx.globalAlpha = shape.opacity;
    ctx.strokeStyle = shape.strokeColor;
    ctx.fillStyle = shape.fillColor === 'transparent' ? 'transparent' : shape.fillColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(shape.roughness > 0 ? [4, 2] : []);

    if (selected) {
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 8;
    }

    switch (shape.type) {
      case 'rect':
        if (shape.fillColor !== 'transparent') { ctx.fillRect(shape.x, shape.y, shape.width, shape.height); }
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        break;
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(shape.x + shape.width / 2, shape.y + shape.height / 2, Math.abs(shape.width / 2), Math.abs(shape.height / 2), 0, 0, Math.PI * 2);
        if (shape.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
        break;
      case 'arrow':
      case 'line': {
        const x2 = shape.x + shape.width;
        const y2 = shape.y + shape.height;
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (shape.type === 'arrow') {
          const angle = Math.atan2(y2 - shape.y, x2 - shape.x);
          const aSize = 12;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - aSize * Math.cos(angle - Math.PI / 6), y2 - aSize * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(x2 - aSize * Math.cos(angle + Math.PI / 6), y2 - aSize * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = shape.strokeColor;
          ctx.fill();
        }
        break;
      }
      case 'freehand':
        if (shape.points && shape.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(shape.points[0].x, shape.points[0].y);
          for (let i = 1; i < shape.points.length; i++) {
            const p = shape.points[i];
            const pp = shape.points[i - 1];
            ctx.quadraticCurveTo(pp.x, pp.y, (pp.x + p.x) / 2, (pp.y + p.y) / 2);
          }
          ctx.stroke();
        }
        break;
      case 'text':
        ctx.fillStyle = shape.strokeColor;
        ctx.font = `${shape.strokeWidth * 6 + 10}px Inter, system-ui, sans-serif`;
        ctx.fillText(shape.text || 'Text', shape.x, shape.y + 20);
        if (selected) {
          ctx.strokeStyle = '#6366f1';
          ctx.setLineDash([4, 2]);
          ctx.lineWidth = 1;
          const metrics = ctx.measureText(shape.text || 'Text');
          ctx.strokeRect(shape.x - 4, shape.y, metrics.width + 8, 30);
        }
        break;
    }

    ctx.restore();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const gridSize = 20 * zoom;
    const offsetX = (pan.x % gridSize + gridSize) % gridSize;
    const offsetY = (pan.y % gridSize + gridSize) % gridSize;
    for (let x = offsetX; x < canvas.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = offsetY; y < canvas.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    shapes.forEach(shape => drawShape(ctx, shape, shape.id === selectedId));
    if (currentShape) drawShape(ctx, currentShape, false);

    ctx.restore();
  }, [shapes, currentShape, selectedId, drawShape, zoom, pan]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const obs = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      canvas.width = r.width;
      canvas.height = r.height;
      redraw();
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [redraw]);

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const pushUndo = () => {
    setUndoStack(prev => [...prev.slice(-20), [...shapes]]);
    setRedoStack([]);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    setRedoStack(prev => [...prev, shapes]);
    setShapes(undoStack[undoStack.length - 1]);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    setUndoStack(prev => [...prev, shapes]);
    setShapes(redoStack[redoStack.length - 1]);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const pos = toCanvas(e.clientX, e.clientY);
    setStartPos(pos);

    if (tool === 'select') {
      const hit = [...shapes].reverse().find(s => {
        if (s.type === 'freehand') return false;
        return pos.x >= s.x - 10 && pos.x <= s.x + s.width + 10 && pos.y >= s.y - 10 && pos.y <= s.y + s.height + 10;
      });
      setSelectedId(hit?.id || null);
      return;
    }

    if (tool === 'text') {
      pushUndo();
      const id = genShapeId();
      const newShape: Shape = {
        id, type: 'text', x: pos.x, y: pos.y, width: 100, height: 30,
        strokeColor, fillColor, strokeWidth, text: 'Text', opacity: 1, roughness: 0,
      };
      setShapes(prev => [...prev, newShape]);
      setEditingText(id);
      setTextValue('Text');
      return;
    }

    setIsDrawing(true);
    const id = genShapeId();
    const newShape: Shape = {
      id,
      type: tool === 'pen' ? 'freehand' : tool === 'eraser' ? 'freehand' : tool as ShapeType,
      x: pos.x, y: pos.y, width: 0, height: 0,
      strokeColor: tool === 'eraser' ? '#0f0f1a' : strokeColor,
      fillColor: tool === 'eraser' ? '#0f0f1a' : fillColor,
      strokeWidth: tool === 'eraser' ? strokeWidth * 4 : strokeWidth,
      points: [pos],
      opacity: 1,
      roughness: 0,
    };
    setCurrentShape(newShape);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !currentShape) return;
    const pos = toCanvas(e.clientX, e.clientY);

    if (currentShape.type === 'freehand') {
      setCurrentShape(prev => prev ? { ...prev, points: [...(prev.points || []), pos] } : null);
    } else {
      setCurrentShape(prev => prev ? { ...prev, width: pos.x - startPos.x, height: pos.y - startPos.y } : null);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentShape) return;
    pushUndo();
    setShapes(prev => [...prev, currentShape]);
    setCurrentShape(null);
    setIsDrawing(false);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    pushUndo();
    setShapes(prev => prev.filter(s => s.id !== selectedId));
    setSelectedId(null);
  };

  const clearAll = () => {
    pushUndo();
    setShapes([]);
    setSelectedId(null);
  };

  const saveToJournal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const todayId = getTodayJournalId();
    dispatch({ type: 'APPEND_BLOCK_TO_PAGE', pageId: todayId, content: `![Whiteboard](${dataUrl})` });
    dispatch({ type: 'APPEND_BLOCK_TO_PAGE', pageId: todayId, content: `🖼️ Whiteboard saved — ${shapes.length} shapes #whiteboard` });
    setSaved(true);
    setTimeout(() => { setSaved(false); if (onClose) onClose(); }, 1500);
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `whiteboard-${Date.now()}.png`;
    a.click();
  };

  const tools: { id: ToolType; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer size={14} />, label: 'Select' },
    { id: 'pen', icon: <span className="text-xs font-bold">✏</span>, label: 'Pen' },
    { id: 'rect', icon: <Square size={14} />, label: 'Rect' },
    { id: 'ellipse', icon: <CircleIcon size={14} />, label: 'Ellipse' },
    { id: 'arrow', icon: <ArrowRight size={14} />, label: 'Arrow' },
    { id: 'text', icon: <TypeIcon size={14} />, label: 'Text' },
    { id: 'eraser', icon: <span className="text-xs">🧹</span>, label: 'Erase' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0f0f1a]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a2e] border-b border-white/10 shrink-0 overflow-x-auto">
        {/* Tools */}
        <div className="flex gap-0.5 bg-white/5 rounded-lg p-1 shrink-0">
          {tools.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`p-1.5 rounded text-xs flex items-center gap-0.5 transition-colors ${tool === t.id ? 'bg-[var(--color-accent)] text-white' : 'text-white/50 hover:text-white'}`}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Stroke width */}
        <div className="flex gap-1 items-center shrink-0">
          {STROKE_WIDTHS.map(w => (
            <button
              key={w}
              onClick={() => setStrokeWidth(w)}
              className={`rounded-full bg-white transition-all ${strokeWidth === w ? 'opacity-100 ring-2 ring-[var(--color-accent)]' : 'opacity-40'}`}
              style={{ width: w * 3 + 3, height: w * 3 + 3 }}
            />
          ))}
        </div>

        {/* Colors */}
        <div className="flex gap-1 shrink-0">
          {COLORS.slice(0, 6).map(c => (
            <button
              key={c}
              onClick={() => setStrokeColor(c)}
              className={`w-5 h-5 rounded-full border-2 transition-all ${strokeColor === c ? 'border-white scale-110' : 'border-white/20'}`}
              style={{ background: c === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, white 25%, white 75%, #ccc 75%)' : c }}
            />
          ))}
        </div>

        {/* Undo/Redo */}
        <div className="flex gap-1 ml-auto shrink-0">
          <button onClick={undo} disabled={undoStack.length === 0} className="p-1.5 rounded text-white/50 hover:text-white disabled:opacity-30 hover:bg-white/10" title="Undo">
            <Undo size={13} />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} className="p-1.5 rounded text-white/50 hover:text-white disabled:opacity-30 hover:bg-white/10" title="Redo">
            <Redo size={13} />
          </button>
          <button onClick={clearAll} className="p-1.5 rounded text-red-400 hover:bg-red-500/20" title="Clear all">
            <Trash2 size={13} />
          </button>
          {selectedId && (
            <button onClick={deleteSelected} className="p-1.5 rounded text-red-400 hover:bg-red-500/20" title="Delete selected">
              <X size={13} />
            </button>
          )}
          <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10">
            <ZoomIn size={13} />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.2, z * 0.8))} className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10">
            <ZoomOut size={13} />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10">
            <RotateCcw size={13} />
          </button>
          <button onClick={downloadCanvas} className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10">
            <Download size={13} />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded text-white/40 hover:text-white hover:bg-white/10">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden touch-none relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ cursor: tool === 'select' ? 'default' : tool === 'pan' ? 'grab' : tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={e => { e.preventDefault(); const d = e.deltaY > 0 ? 0.9 : 1.1; setZoom(z => Math.max(0.2, Math.min(3, z * d))); }}
        />

        {/* Text edit overlay */}
        {editingText && (
          <div className="absolute inset-0 flex items-start justify-start pointer-events-none">
            <input
              autoFocus
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setShapes(prev => prev.map(s => s.id === editingText ? { ...s, text: textValue } : s));
                  setEditingText(null);
                }
              }}
              onBlur={() => { setShapes(prev => prev.map(s => s.id === editingText ? { ...s, text: textValue } : s)); setEditingText(null); }}
              className="pointer-events-auto bg-transparent border border-[var(--color-accent)] text-white outline-none px-1"
              style={{ fontSize: '16px', minWidth: 60 }}
            />
          </div>
        )}

        {shapes.length === 0 && !isDrawing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-white/20">
              <div className="text-5xl mb-3">🖌️</div>
              <p className="text-sm">Start drawing or select a tool above</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="px-4 py-2 bg-[#1a1a2e] border-t border-white/10 flex items-center justify-between shrink-0">
        <span className="text-white/30 text-xs">{shapes.length} shapes · Zoom {Math.round(zoom * 100)}%</span>
        {saved ? (
          <span className="text-green-400 text-sm">✅ Saved to journal!</span>
        ) : (
          <button
            onClick={saveToJournal}
            disabled={shapes.length === 0}
            className="px-4 py-1.5 bg-[var(--color-accent)] rounded-lg text-white text-sm font-medium disabled:opacity-40 active:scale-95 transition-transform flex items-center gap-2"
          >
            <Save size={14} /> Save to Journal
          </button>
        )}
      </div>
    </div>
  );
}
