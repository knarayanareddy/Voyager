import { useState, useRef, useEffect, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { DrawingStroke } from '../types';
import { genId } from '../mockData';
import { X, Pen, Highlighter, Eraser, Save, RotateCcw, Type, FileText } from 'lucide-react';

// ─── S-Pen Air Command tools ──────────────────────────────────────────────────

const AIR_COMMAND_TOOLS = [
  { id: 'draw', icon: '✏️', label: 'Screen Write' },
  { id: 'handwrite', icon: '🖊️', label: 'Handwrite → Text' },
  { id: 'memo', icon: '📝', label: 'Quick Memo' },
];

const PEN_COLORS = ['#ffffff', '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6'];

const SAMPLE_OCR_TEXTS = [
  'Remember to review the knowledge graph implementation',
  'Meeting notes: Discuss S-Pen integration with the team',
  'Idea: Add voice memo transcription to journal pages',
  'TODO: Write unit tests for the block reducer',
  'Quote: "The best note is the one you actually write"',
  'Research: Look into SM-2 interval optimization',
];

interface Props {
  onClose: () => void;
}

// ─── Screen Write (drawing canvas) ───────────────────────────────────────────

function ScreenWrite({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useDatabase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  const drawing = useRef(false);
  const [canvasSize, setCanvasSize] = useState({ w: 320, h: 500 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth || 320;
    const h = container.clientHeight || 500;
    setCanvasSize({ w, h });
  }, []);

  const redraw = useCallback((stks: DrawingStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stks) {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      ctx.globalAlpha = s.tool === 'highlighter' ? 0.35 : 1;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (const pt of s.points.slice(1)) ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;
    redraw(strokes);
  }, [canvasSize, redraw, strokes]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const pos = getPos(e);
    const newStroke: DrawingStroke = {
      tool: tool === 'eraser' ? 'eraser' : tool,
      color: tool === 'eraser' ? '#0f172a' : color,
      width: tool === 'highlighter' ? lineWidth * 5 : tool === 'eraser' ? lineWidth * 6 : lineWidth,
      points: [pos],
    };
    setCurrentStroke(newStroke);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !currentStroke) return;
    const pos = getPos(e);
    const updated = { ...currentStroke, points: [...currentStroke.points, pos] };
    setCurrentStroke(updated);
    // Draw incrementally
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || updated.points.length < 2) return;
    const pts = updated.points;
    ctx.beginPath();
    ctx.globalAlpha = updated.tool === 'highlighter' ? 0.35 : 1;
    ctx.strokeStyle = updated.color;
    ctx.lineWidth = updated.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const last = pts[pts.length - 2];
    const curr = pts[pts.length - 1];
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const onPointerUp = () => {
    if (!drawing.current || !currentStroke) return;
    drawing.current = false;
    const completed = [...strokes, currentStroke];
    setStrokes(completed);
    setCurrentStroke(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const todayId = `journal-${new Date().toISOString().slice(0, 10)}`;
    const pageId = state.db[todayId] ? todayId : state.currentPageId;
    const page = state.db[pageId];
    if (!page) return;
    const lastBlock = page.blocks[page.blocks.length - 1];
    if (lastBlock) {
      dispatch({
        type: 'UPDATE_BLOCK',
        pageId,
        blockId: lastBlock.id,
        content: lastBlock.content,
      });
    }
    dispatch({
      type: 'ADD_MEDIA',
      pageId,
      media: {
        id: genId(),
        type: 'image',
        dataUrl,
        name: `S-Pen Drawing ${new Date().toLocaleTimeString()}`,
        createdAt: new Date().toISOString(),
      },
    });
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 border-b border-slate-700 flex-shrink-0">
        {/* Tools */}
        {([['pen', Pen], ['highlighter', Highlighter], ['eraser', Eraser]] as const).map(([t, Icon]) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${tool === t ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Icon size={14} />
          </button>
        ))}
        <div className="w-px h-6 bg-slate-700 mx-1" />
        {/* Colors */}
        {PEN_COLORS.map(c => (
          <button
            key={c}
            onClick={() => { setColor(c); setTool('pen'); }}
            className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${color === c && tool !== 'eraser' ? 'border-white scale-110' : 'border-transparent'}`}
            style={{ background: c }}
          />
        ))}
        <div className="w-px h-6 bg-slate-700 mx-1" />
        {/* Line width */}
        {[2, 4, 7].map(w => (
          <button
            key={w}
            onClick={() => setLineWidth(w)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${lineWidth === w ? 'bg-indigo-600' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <div className="rounded-full bg-white" style={{ width: w + 2, height: w + 2 }} />
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => { setStrokes([]); const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); ctx?.clearRect(0, 0, canvas!.width, canvas!.height); }} className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white">
          <RotateCcw size={12} />
        </button>
        <button onClick={handleSave} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors">
          <Save size={12} /> Save
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-950/60">
        <canvas
          ref={canvasRef}
          className="touch-none cursor-crosshair w-full h-full"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {strokes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-700 text-sm">Draw here with your S-Pen…</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Handwrite to Text ────────────────────────────────────────────────────────

function HandwriteToText({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useDatabase();
  const [recognized, setRecognized] = useState('');
  const [processing, setProcessing] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    setDrawn(true);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#a5b4fc';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const onPointerUp = () => { drawing.current = false; };

  const handleOCR = () => {
    if (!drawn) return;
    setProcessing(true);
    setTimeout(() => {
      const text = SAMPLE_OCR_TEXTS[Math.floor(Math.random() * SAMPLE_OCR_TEXTS.length)];
      setRecognized(text);
      setProcessing(false);
    }, 1200);
  };

  const handleInsert = () => {
    if (!recognized) return;
    const page = state.db[state.currentPageId];
    if (!page) return;
    const lastBlock = page.blocks[page.blocks.length - 1];
    if (lastBlock) {
      dispatch({ type: 'ADD_BLOCK', pageId: state.currentPageId, afterBlockId: lastBlock.id, content: recognized });
    }
    onClose();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 280;
    canvas.height = canvas.offsetHeight || 180;
  }, []);

  return (
    <div className="flex flex-col h-full px-4 py-4 gap-4">
      <div className="flex items-center gap-2">
        <Type size={16} className="text-indigo-400" />
        <span className="text-white font-semibold text-sm">Handwrite to Text</span>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden" style={{ height: 200 }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>

      <p className="text-slate-500 text-xs text-center">Write on the pad above, then tap Recognize</p>

      {recognized && (
        <div className="bg-slate-900 rounded-xl p-3 border border-indigo-500/30">
          <p className="text-slate-400 text-[10px] mb-1">Recognized Text:</p>
          <p className="text-indigo-200 text-sm">{recognized}</p>
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <button
          onClick={handleOCR}
          disabled={!drawn || processing}
          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium disabled:opacity-40 transition-colors"
        >
          {processing ? '✨ Recognizing…' : '🔍 Recognize'}
        </button>
        {recognized && (
          <button
            onClick={handleInsert}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Insert into Notes
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Quick Memo ───────────────────────────────────────────────────────────────

function QuickMemo({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useDatabase();
  const [memo, setMemo] = useState('');

  const handleSync = () => {
    if (!memo.trim()) return;
    const page = state.db[state.currentPageId];
    if (!page) return;
    const lastBlock = page.blocks[page.blocks.length - 1];
    if (lastBlock) {
      dispatch({ type: 'ADD_BLOCK', pageId: state.currentPageId, afterBlockId: lastBlock.id, content: memo.trim() });
    }
    onClose();
  };

  return (
    <div className="flex flex-col h-full px-4 py-4 gap-4">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-amber-400" />
        <span className="text-white font-semibold text-sm">Quick Memo</span>
      </div>
      <textarea
        autoFocus
        value={memo}
        onChange={e => setMemo(e.target.value)}
        placeholder="Jot down a quick note…"
        className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl p-4 text-slate-200 text-sm resize-none outline-none focus:border-indigo-500 transition-colors placeholder-slate-600 leading-relaxed"
        style={{ minHeight: 200 }}
      />
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700 transition-colors">
          Discard
        </button>
        <button
          onClick={handleSync}
          disabled={!memo.trim()}
          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          Sync to Notes
        </button>
      </div>
    </div>
  );
}

// ─── Main SPenOverlay ─────────────────────────────────────────────────────────

export default function SPenOverlay({ onClose }: Props) {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  if (activeTool === 'draw') {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-700">
          <span className="text-base">✏️</span>
          <span className="text-white text-sm font-semibold flex-1">Screen Write</span>
          <button onClick={() => setActiveTool(null)} className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
        <ScreenWrite onClose={onClose} />
      </div>
    );
  }

  if (activeTool === 'handwrite') {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-700">
          <span className="text-base">🖊️</span>
          <span className="text-white text-sm font-semibold flex-1">Handwrite to Text</span>
          <button onClick={() => setActiveTool(null)} className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
        <HandwriteToText onClose={onClose} />
      </div>
    );
  }

  if (activeTool === 'memo') {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-700">
          <span className="text-base">📝</span>
          <span className="text-white text-sm font-semibold flex-1">Quick Memo</span>
          <button onClick={() => setActiveTool(null)} className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
        <QuickMemo onClose={onClose} />
      </div>
    );
  }

  // Air Command menu
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900/90 border border-slate-700 rounded-3xl p-6 shadow-2xl w-72 animate-slide-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-white font-bold text-base">S-Pen Air Command</p>
            <p className="text-slate-500 text-xs mt-0.5">Choose a tool</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tools */}
        <div className="space-y-2">
          {AIR_COMMAND_TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className="w-full flex items-center gap-4 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all hover:scale-[1.02] group"
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="text-slate-200 text-sm font-medium group-hover:text-white">{t.label}</span>
              <span className="ml-auto text-slate-600 group-hover:text-slate-400 text-lg">›</span>
            </button>
          ))}
        </div>

        {/* S-Pen indicator */}
        <div className="mt-5 flex items-center gap-2 justify-center">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-slate-500 text-xs">S-Pen Connected • 2.8ms latency</span>
        </div>
      </div>
    </div>
  );
}
