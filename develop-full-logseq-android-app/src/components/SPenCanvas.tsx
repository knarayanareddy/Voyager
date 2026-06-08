import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getTodayJournalId } from '../mockData';
import { Pen, Highlighter, Eraser, Trash2, Save, X } from 'lucide-react';

type Tool = 'pen' | 'highlighter' | 'eraser';

interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  opacity: number;
}

const COLORS = ['#ffffff', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#000000'];
const WIDTHS = [2, 4, 8];

export default function SPenCanvas({ onClose }: { onClose: () => void }) {
  const { dispatch } = useDatabase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#6366f1');
  const [width, setWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saved, setSaved] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawStroke = (stroke: Stroke) => {
      if (stroke.points.length < 2) return;
      ctx.save();
      ctx.globalAlpha = stroke.opacity;
      ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        const prev = stroke.points[i - 1];
        const curr = stroke.points[i];
        ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
      }
      ctx.stroke();
      ctx.restore();
    };

    strokes.forEach(drawStroke);
    if (currentStroke) drawStroke(currentStroke);
  }, [strokes, currentStroke]);

  useEffect(() => { redraw(); }, [redraw]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (pos: { x: number; y: number }) => {
    setIsDrawing(true);
    const newStroke: Stroke = {
      tool,
      color: tool === 'eraser' ? '#ffffff' : color,
      width: tool === 'highlighter' ? width * 4 : tool === 'eraser' ? width * 6 : width,
      opacity: tool === 'highlighter' ? 0.35 : 1,
      points: [pos],
    };
    setCurrentStroke(newStroke);
  };

  const continueDraw = (pos: { x: number; y: number }) => {
    if (!isDrawing || !currentStroke) return;
    setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, pos] } : null);
  };

  const endDraw = () => {
    if (!isDrawing || !currentStroke) return;
    setStrokes(prev => [...prev, currentStroke]);
    setCurrentStroke(null);
    setIsDrawing(false);
  };

  const undo = () => setStrokes(prev => prev.slice(0, -1));
  const clear = () => setStrokes([]);

  const saveToJournal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d')!;
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.drawImage(canvas, 0, 0);
    const dataUrl = tempCanvas.toDataURL('image/png');
    const todayId = getTodayJournalId();
    dispatch({ type: 'APPEND_BLOCK_TO_PAGE', pageId: todayId, content: `![S-Pen Drawing](${dataUrl})` });
    dispatch({ type: 'APPEND_BLOCK_TO_PAGE', pageId: todayId, content: `✏️ S-Pen annotation saved — [[${new Date().toLocaleDateString()}]] #spen #drawing` });
    setSaved(true);
    setTimeout(() => { onClose(); }, 1200);
  };

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth * devicePixelRatio;
    canvas.height = parent.clientHeight * devicePixelRatio;
    canvas.style.width = parent.clientWidth + 'px';
    canvas.style.height = parent.clientHeight + 'px';
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio);
    setStrokes([]);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f0f1a]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a2e] border-b border-white/10 shrink-0 overflow-x-auto">
        {/* Tool selector */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {([
            { t: 'pen' as Tool, icon: <Pen size={14} />, label: 'Pen' },
            { t: 'highlighter' as Tool, icon: <Highlighter size={14} />, label: 'Highlight' },
            { t: 'eraser' as Tool, icon: <Eraser size={14} />, label: 'Erase' },
          ]).map(item => (
            <button
              key={item.t}
              onClick={() => setTool(item.t)}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${tool === item.t ? 'bg-[var(--color-accent)] text-white' : 'text-white/50 hover:text-white'}`}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>

        {/* Width */}
        <div className="flex gap-1 items-center">
          {WIDTHS.map(w => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              className={`rounded-full bg-white transition-all ${width === w ? 'opacity-100 ring-2 ring-[var(--color-accent)]' : 'opacity-40'}`}
              style={{ width: w * 3 + 4, height: w * 3 + 4 }}
            />
          ))}
        </div>

        {/* Colors */}
        {tool !== 'eraser' && (
          <div className="flex gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-all active:scale-90 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        )}

        <div className="ml-auto flex gap-1 shrink-0">
          <button onClick={undo} disabled={strokes.length === 0} className="px-2 py-1 text-[10px] text-white/50 hover:text-white disabled:opacity-30 rounded bg-white/5">Undo</button>
          <button onClick={clear} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded" title="Clear">
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 text-white/50 hover:text-white rounded hover:bg-white/10" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none' }}
          onMouseDown={e => startDraw(getPos(e))}
          onMouseMove={e => continueDraw(getPos(e))}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={e => { e.preventDefault(); startDraw(getPos(e)); }}
          onTouchMove={e => { e.preventDefault(); continueDraw(getPos(e)); }}
          onTouchEnd={e => { e.preventDefault(); endDraw(); }}
        />
        {strokes.length === 0 && !isDrawing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-white/20 text-sm">Draw here with your S-Pen or finger</p>
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="px-4 py-3 bg-[#1a1a2e] border-t border-white/10 shrink-0">
        {saved ? (
          <div className="flex items-center justify-center gap-2 py-2 text-green-400 text-sm">
            ✅ Drawing saved to today's journal!
          </div>
        ) : (
          <button
            onClick={saveToJournal}
            disabled={strokes.length === 0}
            className="w-full py-3 rounded-xl bg-[var(--color-accent)] text-white font-semibold text-sm disabled:opacity-40 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Save size={16} /> Save to Journal
          </button>
        )}
      </div>
    </div>
  );
}
