import { useState, useRef, useCallback, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { DrawingStroke } from '../types';
import { Pen, Highlighter, Eraser, Save, X, Trash2, Type, FileText, ChevronRight } from 'lucide-react';

interface SPenOverlayProps {
  onClose: () => void;
}

type SPenTool = 'screenWrite' | 'handwrite' | 'quickMemo';

export default function SPenOverlay({ onClose }: SPenOverlayProps) {
  const { state, dispatch } = useDatabase();
  const [activeTool, setActiveTool] = useState<SPenTool | null>(null);
  const [showAirCommand, setShowAirCommand] = useState(true);

  // ─── Screen Write state ───────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawTool, setDrawTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [drawColor, setDrawColor] = useState('#6366f1');
  const [drawWidth, setDrawWidth] = useState(3);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  const isDrawing = useRef(false);
  const [_savedDrawing, setSavedDrawing] = useState<string | null>(null);

  // ─── Handwrite state ──────────────────────────────────────────────────────
  const hwCanvasRef = useRef<HTMLCanvasElement>(null);
  const [ocrResult, setOcrResult] = useState('');
  const [hwStrokes, setHwStrokes] = useState<DrawingStroke[]>([]);
  const hwIsDrawing = useRef(false);

  // ─── Quick Memo state ─────────────────────────────────────────────────────
  const [memoContent, setMemoContent] = useState('');
  const [memoPos, setMemoPos] = useState({ x: 20, y: 100 });
  const memoRef = useRef<HTMLDivElement>(null);
  const memoStart = useRef({ x: 0, y: 0, mx: 0, my: 0 });
  const isDraggingMemo = useRef(false);

  const todayId = `journal-${new Date().toISOString().slice(0, 10)}`;

  // Draw canvas
  const redrawCanvas = useCallback((canvas: HTMLCanvasElement | null, strokeList: DrawingStroke[], current: DrawingStroke | null = null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const allStrokes = current ? [...strokeList, current] : strokeList;
    allStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = stroke.width * 4;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.4 : 1;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    });
  }, []);

  useEffect(() => {
    redrawCanvas(canvasRef.current, strokes, currentStroke);
  }, [strokes, currentStroke, redrawCanvas]);

  useEffect(() => {
    redrawCanvas(hwCanvasRef.current, hwStrokes);
  }, [hwStrokes, redrawCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleDrawStart = (e: React.MouseEvent | React.TouchEvent, isHW = false) => {
    e.preventDefault();
    const canvas = isHW ? hwCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const pos = getPos(e, canvas);
    const newStroke: DrawingStroke = { tool: isHW ? 'pen' : drawTool, color: drawColor, width: drawWidth, points: [pos] };
    if (isHW) { hwIsDrawing.current = true; setHwStrokes(s => [...s, { ...newStroke, points: [] }]); }
    else { isDrawing.current = true; setCurrentStroke(newStroke); }
  };

  const handleDrawMove = (e: React.MouseEvent | React.TouchEvent, isHW = false) => {
    e.preventDefault();
    const canvas = isHW ? hwCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const drawing = isHW ? hwIsDrawing.current : isDrawing.current;
    if (!drawing) return;
    const pos = getPos(e, canvas);
    if (isHW) {
      setHwStrokes(s => {
        const last = { ...s[s.length - 1] };
        last.points = [...last.points, pos];
        return [...s.slice(0, -1), last];
      });
    } else {
      setCurrentStroke(cs => cs ? { ...cs, points: [...cs.points, pos] } : null);
    }
  };

  const handleDrawEnd = (isHW = false) => {
    if (isHW) {
      hwIsDrawing.current = false;
      simulateOCR();
    } else {
      isDrawing.current = false;
      if (currentStroke && currentStroke.points.length > 1) {
        setStrokes(s => [...s, currentStroke]);
      }
      setCurrentStroke(null);
    }
  };

  const simulateOCR = () => {
    const words = ['Knowledge', 'Note', 'Idea', 'Connect', 'Think', 'Learn', 'Create', 'Build', 'Design', 'Ship'];
    const result = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => words[Math.floor(Math.random() * words.length)]).join(' ');
    setTimeout(() => setOcrResult(prev => prev ? prev + ' ' + result : result), 600);
  };

  const saveDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSavedDrawing(dataUrl);
    dispatch({
      type: 'APPEND_BLOCK_TO_PAGE',
      pageId: state.db[todayId] ? todayId : Object.keys(state.db)[0],
      content: `![S-Pen sketch](${dataUrl.slice(0, 40)}...)`,
    });
    dispatch({
      type: 'APPEND_BLOCK_TO_PAGE',
      pageId: state.db[todayId] ? todayId : Object.keys(state.db)[0],
      content: '✏️ *S-Pen annotation attached*',
    });
    alert('✅ Drawing saved to today\'s journal!');
  };

  const insertOCR = () => {
    if (!ocrResult) return;
    dispatch({
      type: 'APPEND_BLOCK_TO_PAGE',
      pageId: state.db[todayId] ? todayId : Object.keys(state.db)[0],
      content: ocrResult,
    });
    setOcrResult('');
    setHwStrokes([]);
    alert('✅ Text inserted into journal!');
  };

  const syncMemo = () => {
    if (!memoContent.trim()) return;
    dispatch({
      type: 'APPEND_BLOCK_TO_PAGE',
      pageId: state.db[todayId] ? todayId : Object.keys(state.db)[0],
      content: `📝 ${memoContent}`,
    });
    setMemoContent('');
    alert('✅ Memo synced to journal!');
  };

  const COLORS = ['#6366f1','#f43f5e','#10b981','#f59e0b','#ffffff','#000000'];

  return (
    <div className="absolute inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
      {/* Air Command */}
      {showAirCommand && activeTool === null && (
        <div
          className="absolute animate-scale-in"
          style={{ bottom: 80, right: 16 }}
        >
          <div
            className="rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'rgba(15,15,30,0.97)',
              border: '1px solid rgba(99,102,241,0.3)',
              backdropFilter: 'blur(24px)',
              minWidth: 200,
            }}
          >
            <div className="px-4 py-3 border-b border-white/6">
              <div className="flex items-center gap-2">
                <span className="text-sm">✏️</span>
                <span className="text-xs font-bold text-slate-200">Air Command</span>
                <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={13} />
                </button>
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">S-Pen Tools</p>
            </div>
            {[
              { tool: 'screenWrite' as SPenTool, icon: <Pen size={15} />, label: 'Screen Write', desc: 'Draw on notes' },
              { tool: 'handwrite' as SPenTool, icon: <Type size={15} />, label: 'Handwrite → Text', desc: 'OCR conversion' },
              { tool: 'quickMemo' as SPenTool, icon: <FileText size={15} />, label: 'Quick Memo', desc: 'Floating note' },
            ].map(item => (
              <button
                key={item.tool}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/4 last:border-0"
                onClick={() => { setActiveTool(item.tool); setShowAirCommand(false); }}
              >
                <span style={{ color: '#818cf8' }}>{item.icon}</span>
                <div className="text-left">
                  <div className="text-xs font-semibold text-slate-200">{item.label}</div>
                  <div className="text-[10px] text-slate-500">{item.desc}</div>
                </div>
                <ChevronRight size={12} className="ml-auto text-slate-600" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Screen Write */}
      {activeTool === 'screenWrite' && (
        <div className="absolute inset-0 flex flex-col">
          {/* Toolbar */}
          <div
            className="flex items-center gap-2 px-3 py-2 shrink-0"
            style={{ background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-xs font-bold text-slate-300">Screen Write</span>
            <div className="flex items-center gap-1 ml-2">
              {[
                { tool: 'pen' as const, icon: <Pen size={13} />, label: 'Pen' },
                { tool: 'highlighter' as const, icon: <Highlighter size={13} />, label: 'Highlight' },
                { tool: 'eraser' as const, icon: <Eraser size={13} />, label: 'Erase' },
              ].map(t => (
                <button
                  key={t.tool}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all ${drawTool === t.tool ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-500 hover:bg-white/8'}`}
                  onClick={() => setDrawTool(t.tool)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 ml-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`w-4 h-4 rounded-full border-2 transition-transform ${drawColor === c ? 'scale-125' : 'scale-100'}`}
                  style={{ background: c, borderColor: drawColor === c ? 'white' : 'transparent' }}
                  onClick={() => setDrawColor(c)}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 ml-1">
              {[2, 4, 8].map(w => (
                <button
                  key={w}
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${drawWidth === w ? 'bg-white/20' : 'hover:bg-white/8'}`}
                  onClick={() => setDrawWidth(w)}
                >
                  <div className="rounded-full bg-white" style={{ width: w + 2, height: w + 2 }} />
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setStrokes([])}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={saveDrawing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                <Save size={12} /> Save
              </button>
              <button onClick={() => { setActiveTool(null); onClose(); }} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            className="flex-1 cursor-crosshair"
            style={{ touchAction: 'none', background: 'rgba(99,102,241,0.03)' }}
            width={400}
            height={700}
            onMouseDown={(e) => handleDrawStart(e)}
            onMouseMove={(e) => handleDrawMove(e)}
            onMouseUp={() => handleDrawEnd()}
            onMouseLeave={() => handleDrawEnd()}
            onTouchStart={(e) => handleDrawStart(e)}
            onTouchMove={(e) => handleDrawMove(e)}
            onTouchEnd={() => handleDrawEnd()}
          />
        </div>
      )}

      {/* Handwrite to Text */}
      {activeTool === 'handwrite' && (
        <div className="absolute inset-x-0 bottom-0" style={{ height: '55%' }}>
          <div
            className="h-full flex flex-col rounded-t-2xl overflow-hidden"
            style={{ background: 'rgba(10,10,20,0.97)', border: '1px solid rgba(99,102,241,0.2)', backdropFilter: 'blur(24px)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 shrink-0">
              <span className="text-xs font-bold text-slate-200">✍️ Handwrite to Text</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={insertOCR}
                  disabled={!ocrResult}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-all"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  Insert to Journal
                </button>
                <button onClick={() => { setActiveTool(null); onClose(); }} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* OCR result */}
            {ocrResult && (
              <div className="px-4 py-2.5 border-b border-white/6 shrink-0">
                <div className="text-[10px] text-slate-500 mb-1">Recognized text:</div>
                <div
                  className="text-xs text-slate-200 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  {ocrResult}
                </div>
              </div>
            )}

            {/* Handwriting canvas */}
            <canvas
              ref={hwCanvasRef}
              className="flex-1 cursor-crosshair"
              style={{ touchAction: 'none', background: 'rgba(255,255,255,0.02)' }}
              width={400}
              height={300}
              onMouseDown={(e) => handleDrawStart(e, true)}
              onMouseMove={(e) => handleDrawMove(e, true)}
              onMouseUp={() => handleDrawEnd(true)}
              onMouseLeave={() => handleDrawEnd(true)}
              onTouchStart={(e) => handleDrawStart(e, true)}
              onTouchMove={(e) => handleDrawMove(e, true)}
              onTouchEnd={() => handleDrawEnd(true)}
            />

            <div className="flex items-center justify-between px-4 py-2 shrink-0">
              <span className="text-[10px] text-slate-600">Write with S-Pen · OCR auto-detects text</span>
              <button
                onClick={() => { setHwStrokes([]); setOcrResult(''); }}
                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Memo */}
      {activeTool === 'quickMemo' && (
        <>
          {/* Close button */}
          <button
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={() => { setActiveTool(null); onClose(); }}
          >
            <X size={14} />
          </button>

          {/* Floating memo */}
          <div
            ref={memoRef}
            className="absolute rounded-2xl shadow-2xl overflow-hidden"
            style={{
              left: memoPos.x,
              top: memoPos.y,
              width: 220,
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              cursor: 'move',
            }}
            onMouseDown={(e) => {
              isDraggingMemo.current = true;
              memoStart.current = { x: e.clientX, y: e.clientY, mx: memoPos.x, my: memoPos.y };
            }}
          >
            <div className="px-3 py-2 flex items-center justify-between border-b border-black/10">
              <span className="text-[10px] font-bold text-yellow-900">📝 Quick Memo</span>
            </div>
            <textarea
              className="w-full p-3 bg-transparent text-yellow-900 text-xs resize-none outline-none placeholder-yellow-700"
              placeholder="Jot your thought..."
              rows={5}
              value={memoContent}
              onChange={e => setMemoContent(e.target.value)}
              onMouseDown={e => e.stopPropagation()}
            />
            <div className="px-3 py-2 flex justify-end border-t border-black/10">
              <button
                onClick={syncMemo}
                className="text-[11px] font-bold text-yellow-900 hover:underline transition-all"
              >
                Sync to Journal →
              </button>
            </div>
          </div>
        </>
      )}

      {/* Memo dragging */}
      {activeTool === 'quickMemo' && (
        <div
          className="absolute inset-0 z-50 pointer-events-none"
          onMouseMove={(e) => {
            if (!isDraggingMemo.current) return;
            setMemoPos({
              x: memoStart.current.mx + e.clientX - memoStart.current.x,
              y: memoStart.current.my + e.clientY - memoStart.current.y,
            });
          }}
          onMouseUp={() => { isDraggingMemo.current = false; }}
          style={{ pointerEvents: isDraggingMemo.current ? 'auto' : 'none' }}
        />
      )}
    </div>
  );
}
