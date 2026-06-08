import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { PenTool, Edit3, Type, FileText, X, Check, RotateCcw, Palette } from 'lucide-react';

export const SPenOverlay: React.FC = () => {
  const { state, actions } = useDatabase();
  const { settings, currentPageId } = state;
  const [activeTool, setActiveTool] = useState<'none' | 'screen-write' | 'handwrite' | 'quick-memo'>('none');
  const [showAirCommand, setShowAirCommand] = useState(false);

  // Drawing state
  const [brushColor, setBrushColor] = useState('#EF4444'); // Red default
  const [brushSize, setBrushSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawHistory, setDrawHistory] = useState<string[]>([]); // Base64 history for undo

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 376, height: 792 });

  // OCR state
  const [ocrText, setOcrText] = useState('Meeting notes for Project Voyager');
  const [customOcrInput, setCustomOcrInput] = useState('');

  // Quick Memo state
  const [memoContent, setMemoContent] = useState('');

  // Toggle Air Command when S-Pen is activated
  useEffect(() => {
    if (settings.sPenActive) {
      setShowAirCommand(true);
    } else {
      setShowAirCommand(false);
      setActiveTool('none');
    }
  }, [settings.sPenActive]);

  // Adjust canvas size to fit container
  useEffect(() => {
    if (activeTool === 'screen-write' || activeTool === 'handwrite') {
      const updateSize = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setCanvasSize({
            width: rect.width,
            height: rect.height
          });
        }
      };
      // Short timeout to let DOM settle
      const timer = setTimeout(updateSize, 100);
      window.addEventListener('resize', updateSize);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateSize);
      };
    }
  }, [activeTool]);

  // Screen Off lifecycle event listener
  useEffect(() => {
    const handleScreenOff = () => {
      setActiveTool('none');
      setShowAirCommand(false);
    };
    window.addEventListener('voyager-screen-off', handleScreenOff);
    return () => window.removeEventListener('voyager-screen-off', handleScreenOff);
  }, []);

  // Set up canvas drawing listeners
  useEffect(() => {
    if ((activeTool === 'screen-write' || activeTool === 'handwrite') && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
    }
  }, [activeTool, brushColor, brushSize, canvasSize]);

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save history for undo
    setDrawHistory(prev => [...prev, canvas.toDataURL()]);

    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || drawHistory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const previousState = drawHistory[drawHistory.length - 1];
    setDrawHistory(prev => prev.slice(0, -1));

    const img = new Image();
    img.src = previousState;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawHistory([]);
  };

  // Save Screen Write Drawing
  const handleSaveScreenWrite = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      try {
        // 1. Add to database as drawing media attachment
        const name = `S-Pen Drawing ${new Date().toLocaleTimeString()}`;
        const mediaItem = await actions.addMedia(blob, 'drawing', name);

        // 2. Insert markdown block on current page: ![S-Pen Sketch](media-id)
        if (currentPageId) {
          const rootBlock = state.pages[currentPageId]?.blocks[0];
          const targetUuid = rootBlock ? rootBlock.uuid : '';
          
          if (targetUuid) {
            await actions.addBlock(currentPageId, targetUuid, false);
            // Get the last added block to update it, or we can just append a block at root
            const page = state.pages[currentPageId];
            if (page) {
              const lastBlock = page.blocks[page.blocks.length - 1];
              await actions.updateBlock(currentPageId, lastBlock.uuid, `![S-Pen Sketch](${mediaItem.id})`);
            }
          }
        }
      } catch (err) {
        console.error('Failed to save S-Pen drawing:', err);
      } finally {
        // Reset S-Pen and tool
        setActiveTool('none');
        actions.updateSettings({ sPenActive: false });
      }
    }, 'image/png');
  };

  // Save Handwrite OCR Block
  const handleSaveOCR = async () => {
    const textToInsert = customOcrInput.trim() || ocrText;
    if (currentPageId && textToInsert) {
      const page = state.pages[currentPageId];
      if (page && page.blocks.length > 0) {
        const lastBlock = page.blocks[page.blocks.length - 1];
        const newUuid = await actions.addBlock(currentPageId, lastBlock.uuid, false);
        await actions.updateBlock(currentPageId, newUuid, textToInsert);
      }
    }

    setActiveTool('none');
    actions.updateSettings({ sPenActive: false });
    setCustomOcrInput('');
  };

  // Save Quick Memo
  const handleSaveMemo = async () => {
    if (currentPageId && memoContent.trim()) {
      const page = state.pages[currentPageId];
      if (page && page.blocks.length > 0) {
        const lastBlock = page.blocks[page.blocks.length - 1];
        const newUuid = await actions.addBlock(currentPageId, lastBlock.uuid, false);
        await actions.updateBlock(currentPageId, newUuid, `#### Quick Memo 📝\n${memoContent.trim()}`);
      }
    }

    setActiveTool('none');
    actions.updateSettings({ sPenActive: false });
    setMemoContent('');
  };

  if (!settings.sPenActive) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-50 pointer-events-none"
    >
      {/* Air Command floating circle button (S-Pen Stylus Indicator) */}
      <button
        onClick={() => setShowAirCommand(!showAirCommand)}
        className="absolute right-4 bottom-12 w-10 h-10 rounded-full bg-[#1C1C1E] border border-blue-500 text-blue-400 flex items-center justify-center shadow-lg hover:bg-neutral-800 transition-all active:scale-90 pointer-events-auto cursor-pointer"
        style={{ zIndex: 60 }}
      >
        <PenTool className="w-5 h-5 animate-pulse" />
      </button>

      {/* Air Command Menu Overlay */}
      {showAirCommand && activeTool === 'none' && (
        <div className="absolute inset-0 bg-black/65 flex items-center justify-end pr-16 pointer-events-auto animate-in fade-in duration-200">
          <div className="flex flex-col gap-4 items-end animate-in slide-in-from-right duration-300">
            <h4 className="text-blue-400 font-bold tracking-wider text-xs uppercase mb-2">Air Command</h4>
            
            {/* Screen Write */}
            <button
              onClick={() => {
                setActiveTool('screen-write');
                setShowAirCommand(false);
              }}
              className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-200 px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span className="text-xs font-semibold">Screen Write</span>
              <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                <Edit3 className="w-4 h-4" />
              </div>
            </button>

            {/* Handwrite OCR */}
            <button
              onClick={() => {
                setActiveTool('handwrite');
                setShowAirCommand(false);
              }}
              className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-200 px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span className="text-xs font-semibold">Handwrite OCR</span>
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Type className="w-4 h-4" />
              </div>
            </button>

            {/* Quick Memo */}
            <button
              onClick={() => {
                setActiveTool('quick-memo');
                setShowAirCommand(false);
              }}
              className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-200 px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span className="text-xs font-semibold">Quick Memo</span>
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </button>

            {/* Close Air Command */}
            <button
              onClick={() => actions.updateSettings({ sPenActive: false })}
              className="mt-6 w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 flex items-center justify-center border border-neutral-700 shadow-md cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* TOOL 1: Screen Write (Drawing over screen) */}
      {activeTool === 'screen-write' && (
        <div className="absolute inset-0 bg-neutral-950/20 flex flex-col pointer-events-auto animate-in fade-in duration-200">
          
          {/* Top drawing toolbar */}
          <div className="bg-neutral-900/95 border-b border-neutral-800 px-4 py-2 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-red-500" /> Screen Write
              </span>
              
              {/* Color selectors */}
              <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded-full border border-neutral-800">
                {['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#FFFFFF', '#000000'].map(c => (
                  <button
                    key={c}
                    onClick={() => setBrushColor(c)}
                    className={`w-3.5 h-3.5 rounded-full cursor-pointer transition-transform ${
                      brushColor === c ? 'scale-120 ring-1 ring-offset-1 ring-blue-400' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* Brush size */}
              <div className="flex items-center gap-1 text-neutral-400">
                <Palette className="w-3 h-3 text-neutral-500" />
                <input
                  type="range"
                  min="2"
                  max="16"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-12 h-1 accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleUndo}
                disabled={drawHistory.length === 0}
                className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                title="Undo"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleClear}
                className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleSaveScreenWrite}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-md flex items-center gap-1 text-xs font-semibold cursor-pointer"
                title="Save Drawing to Journal"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
              <button
                onClick={() => setActiveTool('none')}
                className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawing Canvas */}
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="flex-1 bg-transparent cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
      )}

      {/* TOOL 2: Handwrite OCR (Handwriting to text) */}
      {activeTool === 'handwrite' && (
        <div className="absolute inset-0 bg-neutral-950 flex flex-col pointer-events-auto animate-in fade-in duration-200">
          <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-blue-400" /> Handwrite OCR
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSaveOCR}
                className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-md flex items-center gap-1 text-xs font-semibold cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Insert Block
              </button>
              <button
                onClick={() => setActiveTool('none')}
                className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawing area for writing */}
          <div className="flex-1 relative bg-neutral-900 border-b border-neutral-800 flex flex-col justify-between">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none opacity-20">
              <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider border-2 border-dashed border-neutral-600 px-4 py-2 rounded-lg">
                Write here with S-Pen
              </span>
            </div>

            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height - 180}
              className="w-full h-full bg-transparent cursor-crosshair touch-none z-10"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />

            {/* Simulated Handwriting controls */}
            <div className="bg-neutral-950 p-4 border-t border-neutral-800 flex flex-col gap-2 z-20">
              <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Simulated Handwriting OCR Output</label>
              
              {/* Preset templates */}
              <div className="flex flex-wrap gap-1 mb-1">
                {[
                  'Drafting Voyager architecture',
                  'Logseq database model looks great!',
                  'S-Pen Screen Write is fully functional',
                  'Need to build spaced repetition next week'
                ].map(tmpl => (
                  <button
                    key={tmpl}
                    onClick={() => setOcrText(tmpl)}
                    className="text-[9px] bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full cursor-pointer"
                  >
                    {tmpl}
                  </button>
                ))}
              </div>

              {/* Text input to custom mock whatever they want to draw */}
              <input
                type="text"
                placeholder={`Current output: "${ocrText}"`}
                value={customOcrInput}
                onChange={(e) => setCustomOcrInput(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-1.5 text-xs text-neutral-200 outline-none focus:border-blue-500"
              />
              <span className="text-[9px] text-neutral-500 italic">
                Tip: Draw on the canvas above and type or select a template to simulate handwriting recognition.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TOOL 3: Quick Memo (Post-it note) */}
      {activeTool === 'quick-memo' && (
        <div className="absolute inset-0 bg-black/45 flex items-center justify-center p-6 pointer-events-auto animate-in fade-in duration-200">
          <div className="w-full max-w-[320px] bg-yellow-100 border border-yellow-200 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-yellow-200 pb-2">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-600" /> S-Pen Quick Memo
              </span>
              <button
                onClick={() => setActiveTool('none')}
                className="p-1 rounded-full hover:bg-yellow-200 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              placeholder="Jot down a quick thought here..."
              value={memoContent}
              onChange={(e) => setMemoContent(e.target.value)}
              className="w-full h-32 bg-transparent text-neutral-800 placeholder-neutral-500 text-xs outline-none resize-none leading-relaxed font-medium"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 border-t border-yellow-200 pt-2">
              <button
                onClick={() => setActiveTool('none')}
                className="text-xs text-neutral-600 px-3 py-1.5 rounded-lg hover:bg-yellow-200 cursor-pointer font-medium"
              >
                Discard
              </button>
              <button
                onClick={handleSaveMemo}
                disabled={!memoContent.trim()}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
