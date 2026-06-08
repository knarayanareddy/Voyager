import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, Battery as BatteryIcon, BatteryCharging, ChevronLeft, Home, Square, 
  PenTool, Edit3, Type, X, Volume2, Power, 
  Trash2, FileText, Check, Save
} from 'lucide-react';
import { DrawingStroke, S23Settings } from '../types';

interface S23UltraFrameProps {
  children: React.ReactNode;
  settings: S23Settings;
  onUpdateSetting: (key: keyof S23Settings, value: any) => void;
  onHomePress: () => void;
  onBackPress: () => void;
  onRecentsPress: () => void;
  onSaveCanvasImage: (base64Image: string) => void;
  onInsertOCRText: (text: string) => void;
}

export default function S23UltraFrame({
  children,
  settings,
  onUpdateSetting,
  onHomePress,
  onBackPress,
  onRecentsPress,
  onSaveCanvasImage,
  onInsertOCRText
}: S23UltraFrameProps) {
  const [sPenEjected, setSPenEjected] = useState(false);
  const [showAirCommand, setShowAirCommand] = useState(false);
  const [activeTool, setActiveTool] = useState<'none' | 'screen-write' | 'ocr-pad' | 'quick-note'>('none');
  const [isLocked, setIsLocked] = useState(false);
  
  // Volume HUD states
  const [showVolumeHud, setShowVolumeHud] = useState(false);
  const volumeHudTimeout = useRef<number | null>(null);

  // Drawing Canvas states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  const [penColor, setPenColor] = useState('#10b981'); // default emerald
  const [penWidth, setPenWidth] = useState(3);
  const [toolType, setToolType] = useState<'pen' | 'highlighter' | 'eraser'>('pen');

  // OCR/Handwriting states
  const ocrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isOcrDrawing, setIsOcrDrawing] = useState(false);
  const [ocrTextResult, setOcrTextResult] = useState('');
  const ocrTimeout = useRef<number | null>(null);

  // Floating note states
  const [floatingNoteText, setFloatingNoteText] = useState('');

  // Handle S-Pen Eject Action
  const toggleSPen = () => {
    if (sPenEjected) {
      // Retract
      setSPenEjected(false);
      setShowAirCommand(false);
      setActiveTool('none');
      onUpdateSetting('sPenConnected', true);
    } else {
      // Eject
      setSPenEjected(true);
      setShowAirCommand(true);
      onUpdateSetting('sPenConnected', false);
      // Play a small notification vibration/buzz effect
      if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
    }
  };

  // Adjust Volume and show Android HUD
  const adjustVolume = (direction: 'up' | 'down') => {
    const step = 10;
    const nextVolume = direction === 'up' 
      ? Math.min(100, settings.volume + step) 
      : Math.max(0, settings.volume - step);
    
    onUpdateSetting('volume', nextVolume);
    setShowVolumeHud(true);

    if (volumeHudTimeout.current) {
      clearTimeout(volumeHudTimeout.current);
    }
    volumeHudTimeout.current = window.setTimeout(() => {
      setShowVolumeHud(false);
    }, 2000);
  };

  // Lock Button toggles screen off/on
  const toggleLock = () => {
    setIsLocked(prev => !prev);
    if (navigator.vibrate) navigator.vibrate(25);
  };

  // --- 1. SCREEN WRITE CANVAS LOGIC ---
  useEffect(() => {
    if (activeTool !== 'screen-write') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions matching its display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Draw previous strokes
    redrawCanvas();
  }, [activeTool, strokes]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawSingleStroke = (stroke: DrawingStroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.type === 'highlighter') {
        ctx.globalAlpha = 0.45;
      } else if (stroke.type === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = stroke.width * 2; // eraser is thicker
      } else {
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
      
      // Reset canvas composite mode
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
    };

    strokes.forEach(drawSingleStroke);
    if (currentStroke) {
      drawSingleStroke(currentStroke);
    }
  };

  const getCanvasTouchCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCanvasTouchCoords(e);
    setIsDrawing(true);

    const newStroke: DrawingStroke = {
      points: [coords],
      color: toolType === 'eraser' ? '#000000' : penColor,
      width: penWidth,
      type: toolType
    };
    setCurrentStroke(newStroke);
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke) return;
    e.preventDefault();
    const coords = getCanvasTouchCoords(e);

    const updatedStroke = {
      ...currentStroke,
      points: [...currentStroke.points, coords]
    };
    setCurrentStroke(updatedStroke);
    
    // Quick redraw for performance
    redrawCanvas();
  };

  const handleDrawEnd = () => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    setStrokes(prev => [...prev, currentStroke]);
    setCurrentStroke(null);
  };

  const saveDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert drawing to base64 PNG image
    // To make sure it has a background if needed, or transparent
    // Let's make it transparent so it blends nicely into Logseq!
    const dataUrl = canvas.toDataURL('image/png');
    
    onSaveCanvasImage(dataUrl);
    alert("🎨 S-Pen Drawing saved and appended to Today's Journal!");
    
    // Clear canvas and close
    setStrokes([]);
    setActiveTool('none');
  };

  // --- 2. OCR HANDWRITING PAD LOGIC ---
  useEffect(() => {
    if (activeTool !== 'ocr-pad') return;
    const canvas = ocrCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setOcrTextResult('');
  }, [activeTool]);

  const handleOcrStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsOcrDrawing(true);

    const canvas = ocrCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x = 0; let y = 0;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6'; // blue line for OCR
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.moveTo(x, y);

    if (ocrTimeout.current) {
      clearTimeout(ocrTimeout.current);
    }
  };

  const handleOcrMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isOcrDrawing) return;
    e.preventDefault();

    const canvas = ocrCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x = 0; let y = 0;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleOcrEnd = () => {
    setIsOcrDrawing(false);

    // Simulate smart One UI handwriting-to-text OCR!
    // When the user stops writing for 900ms, we translate it to a cool note phrase
    if (ocrTimeout.current) clearTimeout(ocrTimeout.current);

    ocrTimeout.current = window.setTimeout(() => {
      // Pick a smart default phrase based on what the user might be drawing
      const ocrPhrases = [
        'Logseq on S23 Ultra is awesome! 📝',
        'Reviewing aerospace flight computer designs 🚀',
        'S-Pen pressure sensitivity test: 100% OK! ✍️',
        'Privacy-first local outliner notes',
        'Remember to complete the S23 checklist tomorrow',
        'Samsung Galaxy flagships rock! 📱'
      ];
      
      const nextPhrase = ocrPhrases[Math.floor(Math.random() * ocrPhrases.length)];
      setOcrTextResult(nextPhrase);

      // Clear OCR writing pad canvas after transcribing
      const canvas = ocrCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 900);
  };

  const insertOcrText = () => {
    if (!ocrTextResult) return;
    onInsertOCRText(ocrTextResult);
    setOcrTextResult('');
    setActiveTool('none');
  };

  // Determine bezel theme classes
  const getBezelColorClass = () => {
    switch (settings.color) {
      case 'botanic-green': return 'border-emerald-950 bg-emerald-950';
      case 'cream': return 'border-amber-50 bg-amber-50';
      case 'lavender': return 'border-purple-200 bg-purple-200';
      case 'phantom-black':
      default:
        return 'border-neutral-900 bg-neutral-900';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-6 px-4 select-none">
      
      {/* Dynamic S23 Ultra Chassis Wrapper */}
      <div className="relative flex items-center justify-center">
        
        {/* PHYSICAL HARDWARE BUTTONS (Right Edge) */}
        <div className="absolute -right-1.5 top-28 flex flex-col space-y-4 z-10">
          {/* Volume Up */}
          <button 
            onClick={() => adjustVolume('up')}
            className="w-1.5 h-10 bg-neutral-700/80 hover:bg-neutral-600 rounded-r-md active:translate-x-0.5 cursor-pointer"
            title="Volume Up"
          />
          {/* Volume Down */}
          <button 
            onClick={() => adjustVolume('down')}
            className="w-1.5 h-10 bg-neutral-700/80 hover:bg-neutral-600 rounded-r-md active:translate-x-0.5 cursor-pointer"
            title="Volume Down"
          />
          {/* Power Button */}
          <button 
            onClick={toggleLock}
            className="w-1.5 h-12 bg-neutral-700/80 hover:bg-neutral-600 rounded-r-md active:translate-x-0.5 mt-2 cursor-pointer"
            title="Power / Lock Button"
          />
        </div>

        {/* PHYSICAL PHONE BODY CONTAINER */}
        <div className={`rounded-[26px] p-2.5 border-[6px] shadow-2xl transition-all duration-500 flex flex-col ${getBezelColorClass()} w-[335px] h-[670px] relative overflow-hidden`}>
          
          {/* INFINITY-O FRONT CAMERA PUNCH HOLE */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-black rounded-full z-50 ring-1 ring-white/10 flex items-center justify-center">
            <div className="w-1 h-1 bg-blue-900/40 rounded-full" />
          </div>

          {/* SIMULATED VOL HUD OVERLAY */}
          {showVolumeHud && (
            <div className="absolute right-4 top-24 z-50 w-6 bg-black/80 backdrop-blur-md border border-white/10 rounded-full py-3.5 flex flex-col items-center space-y-2 text-white animate-fadeIn">
              <Volume2 size={12} className="text-emerald-500" />
              <div className="w-1 h-16 bg-white/20 rounded-full relative overflow-hidden">
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-emerald-500 transition-all duration-100" 
                  style={{ height: `${settings.volume}%` }}
                />
              </div>
              <span className="text-[7px] font-bold font-mono">{settings.volume}</span>
            </div>
          )}

          {/* SCREEN DISPLAY */}
          <div className="relative w-full h-full rounded-[18px] overflow-hidden bg-slate-950 flex flex-col shadow-inner">
            
            {isLocked ? (
              /* BLACKOUT LOCKED SCREEN */
              <div 
                onClick={toggleLock}
                className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center text-center cursor-pointer"
              >
                <Power size={32} className="text-neutral-700 animate-pulse mb-3" />
                <span className="text-[10px] text-neutral-500 uppercase tracking-widest">Screen Locked</span>
                <span className="text-[9px] text-neutral-600 mt-1">Tap screen or click Power key to unlock</span>
              </div>
            ) : (
              /* ACTIVE DEVICE INTERFACE */
              <div className="w-full h-full flex flex-col justify-between relative overflow-hidden bg-slate-900">
                
                {/* STATUS BAR */}
                <div className="h-6 px-4 bg-slate-900/65 dark:bg-black/35 backdrop-blur-xs text-white flex justify-between items-center z-30 text-[9px] font-bold select-none">
                  {/* Left: Clock + Notifications */}
                  <div className="flex items-center space-x-2">
                    <span>10:45</span>
                    <div className="flex space-x-1 items-center opacity-75">
                      <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500 text-white flex items-center justify-center text-[7px] font-extrabold font-serif scale-90">L</div>
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    </div>
                  </div>

                  {/* Right: Signal, Wi-Fi, Battery */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[8px] font-mono tracking-tighter text-emerald-400">5G</span>
                    <Wifi size={10} />
                    <div className="flex items-center space-x-0.5">
                      {settings.isCharging ? (
                        <BatteryCharging size={11} className="text-emerald-400 animate-pulse" />
                      ) : (
                        <BatteryIcon size={11} className={settings.batteryLevel < 20 ? 'text-rose-500' : 'text-white'} />
                      )}
                      <span className="text-[8px] font-mono">{settings.batteryLevel}%</span>
                    </div>
                  </div>
                </div>

                {/* APP VIEW / MAIN SCREEN CONTENT */}
                <div className="flex-1 relative min-h-0 bg-slate-950">
                  {children}
                </div>

                {/* AIR COMMAND OVERLAY SCREEN */}
                {showAirCommand && (
                  <div 
                    className="absolute inset-0 bg-black/60 z-45 flex items-center justify-end p-4 animate-fadeIn"
                    onClick={() => setShowAirCommand(false)}
                  >
                    <div 
                      className="w-[72%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-2xl flex flex-col space-y-2 text-slate-800 dark:text-white animate-scaleIn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center space-x-1">
                          <span>Air Command</span>
                        </span>
                        <button 
                          onClick={() => setShowAirCommand(false)}
                          className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      {/* Menu Options */}
                      <div className="space-y-1.5">
                        <button
                          onClick={() => { setActiveTool('screen-write'); setShowAirCommand(false); }}
                          className="w-full flex items-center space-x-2.5 p-2 rounded-lg hover:bg-emerald-500/10 text-left transition-all text-xs font-semibold cursor-pointer"
                        >
                          <div className="p-1 bg-emerald-500/15 text-emerald-500 rounded-md">
                            <PenTool size={14} />
                          </div>
                          <div>
                            <span className="block leading-tight">Screen Write</span>
                            <span className="text-[8px] text-slate-400 block mt-0.5">Sketch or highlight over your notes</span>
                          </div>
                        </button>

                        <button
                          onClick={() => { setActiveTool('ocr-pad'); setShowAirCommand(false); }}
                          className="w-full flex items-center space-x-2.5 p-2 rounded-lg hover:bg-blue-500/10 text-left transition-all text-xs font-semibold cursor-pointer"
                        >
                          <div className="p-1 bg-blue-500/15 text-blue-500 rounded-md">
                            <Type size={14} />
                          </div>
                          <div>
                            <span className="block leading-tight">Handwrite to Text</span>
                            <span className="text-[8px] text-slate-400 block mt-0.5">Write with pen and transcribe to block</span>
                          </div>
                        </button>

                        <button
                          onClick={() => { setActiveTool('quick-note'); setShowAirCommand(false); }}
                          className="w-full flex items-center space-x-2.5 p-2 rounded-lg hover:bg-yellow-500/10 text-left transition-all text-xs font-semibold cursor-pointer"
                        >
                          <div className="p-1 bg-yellow-500/15 text-yellow-500 rounded-md">
                            <FileText size={14} />
                          </div>
                          <div>
                            <span className="block leading-tight">Quick Memo</span>
                            <span className="text-[8px] text-slate-400 block mt-0.5">Floating sticky note synced to Logseq</span>
                          </div>
                        </button>
                      </div>

                      <button
                        onClick={toggleSPen}
                        className="w-full py-1.5 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 hover:text-slate-200 rounded-lg font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                      >
                        Insert S-Pen
                      </button>
                    </div>
                  </div>
                )}

                {/* ACTIVE S-PEN FLOATING TOOLS OVERLAYS */}
                
                {/* 1. SCREEN WRITE INTERACTIVE CANVAS */}
                {activeTool === 'screen-write' && (
                  <div className="absolute inset-x-0 top-6 bottom-10 bg-transparent z-40 flex flex-col pointer-events-none">
                    
                    {/* Top Canvas Control Panel */}
                    <div className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-2 flex items-center justify-between pointer-events-auto text-white">
                      <div className="flex items-center space-x-1.5">
                        {/* Tool Types */}
                        <button 
                          onClick={() => setToolType('pen')}
                          className={`p-1 rounded cursor-pointer ${toolType === 'pen' ? 'bg-emerald-500 text-white' : 'hover:bg-slate-800'}`}
                          title="Pen"
                        >
                          <PenTool size={13} />
                        </button>
                        <button 
                          onClick={() => setToolType('highlighter')}
                          className={`p-1 rounded cursor-pointer ${toolType === 'highlighter' ? 'bg-yellow-500 text-slate-900' : 'hover:bg-slate-800'}`}
                          title="Highlighter"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button 
                          onClick={() => setToolType('eraser')}
                          className={`p-1 rounded cursor-pointer ${toolType === 'eraser' ? 'bg-rose-500 text-white' : 'hover:bg-slate-800'}`}
                          title="Eraser"
                        >
                          <Trash2 size={13} />
                        </button>
                        
                        {/* Brush Sizes */}
                        <span className="w-px h-4 bg-slate-800 mx-0.5" />
                        <div className="flex space-x-0.5 items-center">
                          {[2, 5, 10].map(w => (
                            <button
                              key={w}
                              onClick={() => setPenWidth(w)}
                              className={`w-4 h-4 rounded-full border border-white/25 text-[8px] flex items-center justify-center cursor-pointer transition-all ${
                                penWidth === w ? 'bg-white text-black font-bold' : 'hover:bg-slate-800 text-slate-400'
                              }`}
                              title={`${w}px Brush`}
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Colors */}
                      <div className="flex space-x-1 items-center">
                        {['#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#ffffff', '#000000'].map(color => (
                          <button
                            key={color}
                            onClick={() => { setPenColor(color); setToolType('pen'); }}
                            className={`w-3.5 h-3.5 rounded-full border border-white/40 cursor-pointer ${
                              penColor === color && toolType !== 'eraser' ? 'scale-120 ring-1 ring-emerald-400' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className="flex space-x-1">
                        <button
                          onClick={saveDrawing}
                          className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-extrabold rounded-md flex items-center space-x-0.5 cursor-pointer"
                        >
                          <Save size={10} />
                          <span>Save</span>
                        </button>
                        <button
                          onClick={() => { setStrokes([]); setActiveTool('none'); }}
                          className="p-1 bg-slate-800 text-slate-400 hover:text-white rounded-md cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Actual drawing canvas */}
                    <canvas
                      ref={canvasRef}
                      onMouseDown={handleDrawStart}
                      onMouseMove={handleDrawMove}
                      onMouseUp={handleDrawEnd}
                      onMouseLeave={handleDrawEnd}
                      onTouchStart={handleDrawStart}
                      onTouchMove={handleDrawMove}
                      onTouchEnd={handleDrawEnd}
                      className="flex-1 w-full bg-transparent cursor-crosshair pointer-events-auto"
                    />
                  </div>
                )}

                {/* 2. OCR HANDWRITING BOARD */}
                {activeTool === 'ocr-pad' && (
                  <div className="absolute bottom-10 inset-x-0 h-44 bg-slate-900/95 border-t border-slate-800 z-40 flex flex-col p-2.5 font-sans animate-slideUp">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                        <Edit3 size={10} className="text-blue-500" />
                        <span>S-Pen Handwriting OCR Pad</span>
                      </span>
                      <button 
                        onClick={() => setActiveTool('none')}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    {/* Writing Canvas and Result Grid */}
                    <div className="flex-1 flex space-x-2 min-h-0">
                      
                      {/* Writing area */}
                      <div className="flex-1 bg-black/40 rounded-lg relative overflow-hidden border border-slate-850">
                        <canvas
                          ref={ocrCanvasRef}
                          onMouseDown={handleOcrStart}
                          onMouseMove={handleOcrMove}
                          onMouseUp={handleOcrEnd}
                          onMouseLeave={handleOcrEnd}
                          onTouchStart={handleOcrStart}
                          onTouchMove={handleOcrMove}
                          onTouchEnd={handleOcrEnd}
                          className="w-full h-full bg-transparent cursor-crosshair"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[9px] text-slate-600 font-medium font-mono uppercase tracking-widest">
                          Write characters here
                        </div>
                      </div>

                      {/* OCR Result and Insert */}
                      <div className="w-[42%] flex flex-col justify-between space-y-1">
                        <div className="bg-slate-850 rounded-lg p-2 flex-1 flex flex-col justify-center min-h-0 border border-slate-800">
                          <span className="text-[8px] text-slate-500 font-bold block mb-1">OCR Translation:</span>
                          <span className="text-[10px] font-medium text-blue-400 overflow-y-auto leading-tight italic max-h-16">
                            {ocrTextResult || 'Waiting for stroke...'}
                          </span>
                        </div>

                        <button
                          onClick={insertOcrText}
                          disabled={!ocrTextResult}
                          className="w-full py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-800 text-white disabled:text-slate-500 text-[10px] font-bold rounded-lg flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <Check size={11} />
                          <span>Insert to Block</span>
                        </button>
                      </div>

                    </div>
                  </div>
                )}

                {/* 3. QUICK FLOATING MEMO STICKY */}
                {activeTool === 'quick-note' && (
                  <div className="absolute top-12 left-6 right-6 z-40 bg-amber-50 dark:bg-amber-100 border border-amber-200 rounded-xl shadow-2xl p-3.5 flex flex-col space-y-2 animate-scaleIn select-text">
                    <div className="flex justify-between items-center pb-1 border-b border-amber-200/60">
                      <span className="text-[9px] font-extrabold text-amber-800 uppercase tracking-widest flex items-center space-x-1">
                        <span>Quick Floating Memo</span>
                      </span>
                      <button
                        onClick={() => setActiveTool('none')}
                        className="p-0.5 hover:bg-amber-200 text-amber-900 rounded-md cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    
                    <textarea
                      value={floatingNoteText}
                      onChange={(e) => setFloatingNoteText(e.target.value)}
                      placeholder="Jot down a quick thought... This will sync directly into Logseq Journals!"
                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-hidden text-slate-800 text-xs resize-none font-sans leading-relaxed"
                      rows={4}
                    />

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          if (floatingNoteText.trim()) {
                            onInsertOCRText(floatingNoteText);
                            setFloatingNoteText('');
                            setActiveTool('none');
                            alert("📝 Quick Memo synced to Today's Logseq Journal!");
                          }
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-extrabold rounded-md flex items-center space-x-1 shadow-sm cursor-pointer"
                      >
                        <Save size={10} />
                        <span>Sync to Logseq</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ANDROID SYSTEM NAVIGATION BAR */}
                <div className="h-10 bg-slate-900/65 dark:bg-black/35 backdrop-blur-xs flex items-center justify-center relative select-none z-30">
                  {settings.useGestures ? (
                    /* Slim Gesture Bar */
                    <button 
                      onClick={onHomePress}
                      className="w-24 h-1 bg-white/40 hover:bg-white/60 rounded-full cursor-pointer active:scale-95 transition-all"
                      title="Swipe Up for Home"
                    />
                  ) : (
                    /* Three Standard Buttons */
                    <div className="w-full flex justify-around px-6 text-white opacity-80">
                      <button 
                        onClick={onBackPress}
                        className="p-2 hover:bg-white/10 rounded-full active:scale-90 transition-transform cursor-pointer"
                        title="Back"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                        onClick={onHomePress}
                        className="p-2 hover:bg-white/10 rounded-full active:scale-90 transition-transform cursor-pointer"
                        title="Home"
                      >
                        <Home size={14} />
                      </button>
                      <button 
                        onClick={onRecentsPress}
                        className="p-2 hover:bg-white/10 rounded-full active:scale-90 transition-transform cursor-pointer"
                        title="Recents / Multitasking"
                      >
                        <Square size={13} />
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>

          {/* PHYSICAL S-PEN STIP & SLOT (Bottom-Left Corner) */}
          <div className="absolute left-6.5 bottom-0 z-40">
            <button
              onClick={toggleSPen}
              className={`w-4.5 rounded-t-xs border-x border-t flex flex-col items-center justify-end shadow-md transition-all duration-300 cursor-pointer ${
                sPenEjected 
                  ? 'h-0 border-transparent bg-transparent translate-y-3' 
                  : 'h-5 border-neutral-700 bg-neutral-800 hover:bg-neutral-700 active:translate-y-1'
              }`}
              title={sPenEjected ? "Insert S-Pen" : "Eject S-Pen"}
            >
              <div className="w-2 h-1 bg-neutral-900 rounded-t-xs" />
              <div className="w-1 h-1 bg-neutral-400 rounded-t-xs" />
            </button>
          </div>

          {/* S-PEN ACTIVE FLOATING INDICATOR OVERLAY (If ejected and no active tool) */}
          {sPenEjected && activeTool === 'none' && !showAirCommand && (
            <button
              onClick={() => setShowAirCommand(true)}
              className="absolute left-4 bottom-14 z-45 w-10 h-10 rounded-full bg-emerald-500 text-white shadow-2xl border-2 border-white flex items-center justify-center animate-bounce hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Open Air Command"
            >
              <PenTool size={16} />
            </button>
          )}

        </div>

      </div>

      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-slideUp {
          animation: slideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
