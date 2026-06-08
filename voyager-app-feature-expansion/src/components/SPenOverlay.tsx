import { useState, useRef, useEffect } from 'react';
import { X, Pen, Highlighter, Eraser, Edit3, StickyNote, Check, Trash2 } from 'lucide-react';
import { DrawingStroke } from '../types';
import { useDatabase } from '../context/DatabaseContext';
import { dbService } from '../utils/db';


interface Props { onClose: () => void; }

type SPenTool = 'screenWrite' | 'handwrite' | 'memo';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ffffff'];
const WIDTHS = [2, 4, 8];

export default function SPenOverlay({ onClose }: Props) {
  const { state, dispatch } = useDatabase();
  const [activeTool, setActiveTool] = useState<SPenTool | null>(null);
  const [drawTool, setDrawTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[0]);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  const [handwriteText, setHandwriteText] = useState('');
  const [memoText, setMemoText] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);

  const TOOLS = [
    { id: 'screenWrite' as SPenTool, icon: <Pen size={16} />, label: 'Screen Write', desc: 'Draw on notes' },
    { id: 'handwrite' as SPenTool, icon: <Edit3 size={16} />, label: 'Handwrite', desc: 'OCR to text' },
    { id: 'memo' as SPenTool, icon: <StickyNote size={16} />, label: 'Quick Memo', desc: 'Sticky note' },
  ];

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(s => drawStroke(ctx, s));
    if (currentStroke) drawStroke(ctx, currentStroke);
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, s: DrawingStroke) => {
    if (s.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    s.points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = s.tool === 'highlighter' ? s.color + '80' : s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (s.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  useEffect(() => { redraw(); }, [strokes, currentStroke]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getPos(e);
    setIsDrawing(true);
    setCurrentStroke({ tool: drawTool, color, width, points: [pos] });
  };

  const continueDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !currentStroke) return;
    const pos = getPos(e);
    setCurrentStroke(s => s ? { ...s, points: [...s.points, pos] } : s);
  };

  const endDraw = () => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    setStrokes(ss => [...ss, currentStroke]);
    setCurrentStroke(null);
  };

  const saveToJournal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pageId = state.currentPageId;
    const page = state.db[pageId];
    if (!page) return;
    const lastBlock = page.blocks[page.blocks.length - 1];

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const mediaId = `media-${Date.now()}`;
      try {
        const metadata = await dbService.saveMedia(mediaId, blob, 'drawing', 'SPen_Drawing.png');
        dispatch({ type: 'ADD_MEDIA', pageId, media: metadata });
        if (lastBlock) {
          dispatch({
            type: 'UPDATE_BLOCK',
            pageId,
            blockId: lastBlock.id,
            content: lastBlock.content + `\n![S-Pen Drawing](${mediaId})`,
          });
        }
      } catch (err) {
        console.error('Failed to save S-Pen sketch as Blob', err);
      }
      onClose();
    }, 'image/png');
  };

  const simulateOCR = () => {
    const samples = [
      'Meeting notes: review Q4 roadmap',
      'Remember to call the team tomorrow',
      'Build the Voyager audio transcription module',
      'Ideas: graph view needs zoom controls',
    ];
    setHandwriteText(samples[Math.floor(Math.random() * samples.length)]);
  };

  const insertToBlock = () => {
    const pageId = state.currentPageId;
    const page = state.db[pageId];
    if (!page || !handwriteText) return;
    const lastBlock = page.blocks[page.blocks.length - 1];
    if (lastBlock) {
      dispatch({ type: 'ADD_BLOCK', pageId, afterBlockId: lastBlock.id, content: handwriteText });
    }
    onClose();
  };

  // Air Command Menu
  if (!activeTool) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="relative">
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)' }} />
          
          <div className="relative bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-700 shadow-2xl overflow-hidden" style={{ width: 280 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-8 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                <span className="text-white font-semibold text-sm">Air Command</span>
              </div>
              <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800">
                <X size={14} />
              </button>
            </div>

            <div className="p-3 space-y-2">
              {TOOLS.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left transition-colors group border border-slate-700/50 hover:border-indigo-500/40"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white group-hover:scale-105 transition-transform shrink-0">
                    {tool.icon}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{tool.label}</p>
                    <p className="text-slate-500 text-[10px]">{tool.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="px-4 pb-3 text-center text-slate-700 text-[9px]">
              ✏️ S-Pen 4096 pressure levels · 2.8ms latency
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Screen Write
  if (activeTool === 'screenWrite') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col">
        <canvas
          ref={canvasRef}
          width={390}
          height={680}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none' }}
          onMouseDown={startDraw}
          onMouseMove={continueDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={continueDraw}
          onTouchEnd={endDraw}
        />

        {/* Toolbar */}
        <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {/* Draw tools */}
            {([['pen', <Pen size={14} />], ['highlighter', <Highlighter size={14} />], ['eraser', <Eraser size={14} />]] as const).map(([t, Icon]) => (
              <button
                key={t}
                onClick={() => setDrawTool(t)}
                className={`p-2 rounded-xl transition-colors ${drawTool === t ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                {Icon}
              </button>
            ))}
            <div className="h-6 w-px bg-slate-700 mx-1" />
            {/* Colors */}
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />
            ))}
            <div className="h-6 w-px bg-slate-700 mx-1" />
            {/* Widths */}
            {WIDTHS.map(w => (
              <button key={w} onClick={() => setWidth(w)} className={`flex items-center justify-center w-7 h-7 rounded-lg ${width === w ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                <div className="rounded-full bg-white" style={{ width: w + 2, height: w + 2 }} />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStrokes([])} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-slate-400 rounded-xl text-xs hover:text-white">
              <Trash2 size={11} /> Clear
            </button>
            <button onClick={onClose} className="flex-1 py-1.5 bg-slate-800 text-slate-400 rounded-xl text-xs hover:text-white">
              Discard
            </button>
            <button onClick={saveToJournal} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-xl text-xs flex items-center justify-center gap-1 hover:bg-indigo-500">
              <Check size={11} /> Save to Journal
            </button>
          </div>
        </div>

        {/* Back btn */}
        <button onClick={() => setActiveTool(null)} className="absolute top-4 left-4 p-2 bg-slate-900/80 backdrop-blur rounded-xl text-white">
          <X size={16} />
        </button>
      </div>
    );
  }

  // Handwrite to text
  if (activeTool === 'handwrite') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
        <div className="absolute inset-x-0 bottom-0 bg-slate-900 rounded-t-3xl border-t border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-semibold text-sm">Handwrite to Text</span>
            <button onClick={() => setActiveTool(null)} className="text-slate-500 hover:text-white"><X size={16} /></button>
          </div>
          <canvas
            ref={handCanvasRef}
            width={340}
            height={120}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 cursor-crosshair mb-3"
            onClick={simulateOCR}
          />
          <p className="text-slate-600 text-xs text-center mb-3">Tap the pad to simulate OCR handwriting recognition</p>
          {handwriteText && (
            <div className="bg-slate-800 rounded-xl p-3 mb-3">
              <p className="text-slate-300 text-sm">{handwriteText}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={simulateOCR} className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-xl text-xs hover:bg-slate-700">🔄 Re-recognize</button>
            {handwriteText && (
              <button onClick={insertToBlock} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-xs flex items-center justify-center gap-1">
                <Check size={11} /> Insert to Block
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Quick Memo
  if (activeTool === 'memo') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-72 bg-yellow-400/95 rounded-3xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-yellow-900 font-bold text-sm">Quick Memo</span>
            <button onClick={() => setActiveTool(null)} className="text-yellow-700 hover:text-yellow-900"><X size={16} /></button>
          </div>
          <textarea
            value={memoText}
            onChange={e => setMemoText(e.target.value)}
            placeholder="Jot a quick thought..."
            className="w-full bg-yellow-300/50 text-yellow-900 placeholder-yellow-700 rounded-xl p-3 text-sm resize-none outline-none border border-yellow-500/30"
            rows={5}
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <button onClick={onClose} className="flex-1 bg-yellow-300 text-yellow-800 py-2 rounded-xl text-xs font-medium">Discard</button>
            <button
              onClick={() => {
                if (memoText.trim()) {
                  const pageId = state.currentPageId;
                  const page = state.db[pageId];
                  if (page) {
                    const last = page.blocks[page.blocks.length - 1];
                    if (last) dispatch({ type: 'ADD_BLOCK', pageId, afterBlockId: last.id, content: `📝 ${memoText.trim()}` });
                  }
                }
                onClose();
              }}
              className="flex-1 bg-yellow-800 text-yellow-100 py-2 rounded-xl text-xs font-medium"
            >
              Sync to Logseq
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
