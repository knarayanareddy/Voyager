import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Mic, Image, Upload, X, Play, Pause, Square, Scissors, 
         RotateCw, ZoomIn, ZoomOut, ChevronLeft, Trash2,
         Download, Check, RefreshCw, Volume2, Crop, Sun, Contrast,
         MicOff, FileAudio, Loader2, CheckCircle, AlertCircle, Film } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { MediaAttachment, AudioNote } from '../types';
import { genUUID } from '../mockData';

type MediaTab = 'camera' | 'gallery' | 'audio' | 'library';
type ImageEditTool = 'crop' | 'resize' | 'rotate' | 'brightness' | 'contrast';

function generateWaveform(length = 80): number[] {
  return Array.from({ length }, () => Math.random() * 0.8 + 0.15);
}

// ── Image Editor ─────────────────────────────────────────────────────────────
function ImageEditor({ src, onSave, onClose }: { src: string; onSave: (dataUrl: string, meta: Partial<MediaAttachment>) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<ImageEditTool>('crop');
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [scale, setScale] = useState(1);
  const [cropBox, setCropBox] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [dragging, setDragging] = useState<null | 'tl' | 'br' | 'move'>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
    img.src = src;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

    const ar = img.naturalWidth / img.naturalHeight;
    let dw = W * 0.9, dh = dw / ar;
    if (dh > H * 0.9) { dh = H * 0.9; dw = dh * ar; }
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.filter = 'none';
    ctx.restore();

    // Draw crop overlay
    if (activeTool === 'crop') {
      const cx = cropBox.x * W;
      const cy = cropBox.y * H;
      const cw = cropBox.w * W;
      const ch = cropBox.h * H;

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, cy);
      ctx.fillRect(0, cy + ch, W, H - cy - ch);
      ctx.fillRect(0, cy, cx, ch);
      ctx.fillRect(cx + cw, cy, W - cx - cw, ch);

      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cw, ch);

      // Grid lines
      ctx.strokeStyle = 'rgba(99,102,241,0.4)';
      ctx.lineWidth = 1;
      [1/3, 2/3].forEach(f => {
        ctx.beginPath(); ctx.moveTo(cx + cw * f, cy); ctx.lineTo(cx + cw * f, cy + ch); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy + ch * f); ctx.lineTo(cx + cw, cy + ch * f); ctx.stroke();
      });

      // Corner handles
      [[cx, cy], [cx + cw, cy + ch]].forEach(([hx, hy]) => {
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(hx - 6, hy - 6, 12, 12);
      });
    }
  }, [rotation, brightness, contrast, scale, cropBox, activeTool]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'crop') return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const thresh = 0.03;

    if (Math.abs(px - cropBox.x) < thresh && Math.abs(py - cropBox.y) < thresh) {
      setDragging('tl'); setDragStart({ x: e.clientX, y: e.clientY, ox: cropBox.x, oy: cropBox.y });
    } else if (Math.abs(px - (cropBox.x + cropBox.w)) < thresh && Math.abs(py - (cropBox.y + cropBox.h)) < thresh) {
      setDragging('br'); setDragStart({ x: e.clientX, y: e.clientY, ox: cropBox.x + cropBox.w, oy: cropBox.y + cropBox.h });
    } else if (px > cropBox.x && px < cropBox.x + cropBox.w && py > cropBox.y && py < cropBox.y + cropBox.h) {
      setDragging('move'); setDragStart({ x: e.clientX, y: e.clientY, ox: cropBox.x, oy: cropBox.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStart.x) / rect.width;
    const dy = (e.clientY - dragStart.y) / rect.height;
    if (dragging === 'tl') {
      setCropBox(c => ({ x: Math.max(0, dragStart.ox + dx), y: Math.max(0, dragStart.oy + dy), w: Math.max(0.1, c.w - dx), h: Math.max(0.1, c.h - dy) }));
    } else if (dragging === 'br') {
      setCropBox(c => ({ ...c, w: Math.max(0.1, dragStart.ox - c.x + dx), h: Math.max(0.1, dragStart.oy - c.y + dy) }));
    } else if (dragging === 'move') {
      setCropBox(c => ({
        x: Math.max(0, Math.min(1 - c.w, dragStart.ox + dx)),
        y: Math.max(0, Math.min(1 - c.h, dragStart.oy + dy)),
        w: c.w, h: c.h,
      }));
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const outputCanvas = document.createElement('canvas');
    const W = canvas.width;
    const H = canvas.height;
    const cx = cropBox.x * W;
    const cy = cropBox.y * H;
    const cw = cropBox.w * W;
    const ch = cropBox.h * H;

    outputCanvas.width = Math.max(1, cw);
    outputCanvas.height = Math.max(1, ch);
    const ctx2 = outputCanvas.getContext('2d');
    if (!ctx2) return;

    const ar = img.naturalWidth / img.naturalHeight;
    let dw = W * 0.9, dh = dw / ar;
    if (dh > H * 0.9) { dh = H * 0.9; dw = dh * ar; }

    ctx2.save();
    ctx2.translate(cw / 2, ch / 2);
    ctx2.rotate((rotation * Math.PI) / 180);
    ctx2.scale(scale, scale);
    ctx2.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx2.drawImage(img, -(dw / 2) + (W / 2 - cx), -(dh / 2) + (H / 2 - cy), dw, dh);
    ctx2.restore();

    const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.92);
    onSave(dataUrl, {
      width: Math.round(cw),
      height: Math.round(ch),
      cropData: { x: Math.round(cx), y: Math.round(cy), w: Math.round(cw), h: Math.round(ch) },
    });
  };

  const tools = [
    { id: 'crop' as ImageEditTool, icon: <Crop size={14} />, label: 'Crop' },
    { id: 'rotate' as ImageEditTool, icon: <RotateCw size={14} />, label: 'Rotate' },
    { id: 'brightness' as ImageEditTool, icon: <Sun size={14} />, label: 'Bright' },
    { id: 'contrast' as ImageEditTool, icon: <Contrast size={14} />, label: 'Contrast' },
    { id: 'resize' as ImageEditTool, icon: <ZoomIn size={14} />, label: 'Zoom' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-700">
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
          <ChevronLeft size={18} />
        </button>
        <span className="text-white text-sm font-semibold">Image Editor</span>
        <button onClick={handleSave} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium">
          <Check size={12} /> Save
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center bg-slate-950 relative">
        <canvas
          ref={canvasRef}
          width={320}
          height={380}
          className="max-w-full max-h-full cursor-crosshair"
          style={{ touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDragging(null)}
          onMouseLeave={() => setDragging(null)}
        />
      </div>

      {/* Tools */}
      <div className="bg-slate-900 border-t border-slate-700 p-2">
        <div className="flex gap-1 justify-center mb-2">
          {tools.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] transition-colors ${
                activeTool === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeTool === 'rotate' && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setRotation(r => r - 90)} className="bg-slate-800 text-white px-3 py-1 rounded text-xs">-90°</button>
            <span className="text-slate-300 text-xs w-12 text-center">{rotation}°</span>
            <button onClick={() => setRotation(r => r + 90)} className="bg-slate-800 text-white px-3 py-1 rounded text-xs">+90°</button>
            <button onClick={() => setRotation(0)} className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs">Reset</button>
          </div>
        )}
        {activeTool === 'brightness' && (
          <div className="flex items-center gap-2 px-2">
            <Sun size={12} className="text-yellow-400" />
            <input type="range" min={50} max={200} value={brightness} onChange={e => setBrightness(+e.target.value)} className="flex-1 h-1 accent-yellow-400" />
            <span className="text-slate-300 text-xs w-8">{brightness}%</span>
          </div>
        )}
        {activeTool === 'contrast' && (
          <div className="flex items-center gap-2 px-2">
            <Contrast size={12} className="text-blue-400" />
            <input type="range" min={50} max={200} value={contrast} onChange={e => setContrast(+e.target.value)} className="flex-1 h-1 accent-blue-400" />
            <span className="text-slate-300 text-xs w-8">{contrast}%</span>
          </div>
        )}
        {activeTool === 'resize' && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="bg-slate-800 text-white p-1.5 rounded"><ZoomOut size={14}/></button>
            <span className="text-slate-300 text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="bg-slate-800 text-white p-1.5 rounded"><ZoomIn size={14}/></button>
            <button onClick={() => setScale(1)} className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs">1:1</button>
          </div>
        )}
        {activeTool === 'crop' && (
          <p className="text-center text-slate-500 text-[10px]">Drag corners or crop box to adjust · Save to apply</p>
        )}
      </div>
    </div>
  );
}

// ── Audio Waveform Editor ─────────────────────────────────────────────────────
function AudioEditor({ note, onSave, onClose }: { note: AudioNote; onSave: (n: AudioNote) => void; onClose: () => void }) {
  const [cropStart, setCropStart] = useState(note.cropStart);
  const [cropEnd, setCropEnd] = useState(note.cropEnd);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    drawWaveform();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropStart, cropEnd, playhead]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const samples = note.waveform;
    const barW = W / samples.length;

    samples.forEach((amp, i) => {
      const x = i * barW;
      const normI = i / samples.length;
      const inCrop = normI >= cropStart / note.duration && normI <= cropEnd / note.duration;
      const isHead = Math.abs(normI - playhead / note.duration) < 0.01;
      const barH = amp * H * 0.85;

      ctx.fillStyle = isHead ? '#ffffff' : inCrop ? '#6366f1' : 'rgba(99,102,241,0.25)';
      ctx.fillRect(x + 1, (H - barH) / 2, Math.max(1, barW - 2), barH);
    });

    // Crop handles
    const startX = (cropStart / note.duration) * W;
    const endX = (cropEnd / note.duration) * W;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(startX, 0); ctx.lineTo(startX, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(endX, 0); ctx.lineTo(endX, H); ctx.stroke();

    // Playhead
    if (isPlaying) {
      const headX = (playhead / note.duration) * W;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(headX, 0); ctx.lineTo(headX, H); ctx.stroke();
    }
  }, [note.waveform, note.duration, cropStart, cropEnd, playhead, isPlaying]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      setIsPlaying(true);
      let pos = cropStart;
      intervalRef.current = setInterval(() => {
        pos += 0.1;
        setPlayhead(pos);
        if (pos >= cropEnd) {
          setIsPlaying(false);
          setPlayhead(cropStart);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, 100);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    setPlayhead(px * note.duration);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-700">
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
          <ChevronLeft size={18} />
        </button>
        <span className="text-white text-sm font-semibold truncate px-2">{note.name}</span>
        <button onClick={() => onSave({ ...note, cropStart, cropEnd })} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium">
          <Check size={12} /> Save
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-4 p-4">
        {/* Duration info */}
        <div className="flex justify-between text-xs text-slate-400">
          <span>Duration: {formatTime(note.duration)}</span>
          <span>Selected: {formatTime(cropEnd - cropStart)}</span>
        </div>

        {/* Waveform */}
        <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
          <canvas
            ref={canvasRef}
            width={300}
            height={100}
            className="w-full cursor-pointer"
            onClick={handleCanvasClick}
          />
        </div>

        {/* Crop controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-xs w-14">Start</span>
            <input type="range" min={0} max={note.duration} step={0.1} value={cropStart}
              onChange={e => setCropStart(Math.min(+e.target.value, cropEnd - 0.5))}
              className="flex-1 h-1 accent-emerald-400" />
            <span className="text-slate-300 text-xs w-10 text-right">{formatTime(cropStart)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-xs w-14">End</span>
            <input type="range" min={0} max={note.duration} step={0.1} value={cropEnd}
              onChange={e => setCropEnd(Math.max(+e.target.value, cropStart + 0.5))}
              className="flex-1 h-1 accent-red-400" />
            <span className="text-slate-300 text-xs w-10 text-right">{formatTime(cropEnd)}</span>
          </div>
        </div>

        {/* Playback */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => { setCropStart(0); setCropEnd(note.duration); }} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <RefreshCw size={14} />
          </button>
          <button onClick={togglePlay} className="p-3 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white transition-colors">
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span className="text-slate-400 text-xs">{formatTime(playhead)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main MediaStudio ──────────────────────────────────────────────────────────
export default function MediaStudio() {
  const { state, dispatch } = useDatabase();
  const [activeTab, setActiveTab] = useState<MediaTab>('camera');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editingImage, setEditingImage] = useState<MediaAttachment | null>(null);
  const [editingAudio, setEditingAudio] = useState<AudioNote | null>(null);
  const [previewMedia, setPreviewMedia] = useState<MediaAttachment | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [liveWaveform, setLiveWaveform] = useState<number[]>(Array(40).fill(0.1));
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [capturedFromCamera, setCapturedFromCamera] = useState<string | null>(null);
  const [videoMode, setVideoMode] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentPageId = state.currentPageId;

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      setCameraStream(stream);
      setCameraError(false);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setCameraError(true);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  useEffect(() => {
    if (activeTab === 'camera') { startCamera(); }
    else { stopCamera(); }
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Capture photo
  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 320;
      canvas.height = videoRef.current.videoHeight || 240;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCapturedFromCamera(dataUrl);
    } else if (cameraError) {
      // Fallback: create a gradient placeholder
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 320, 240);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(1, '#312e81');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 320, 240);
      ctx.fillStyle = 'rgba(99,102,241,0.3)';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📸', 160, 130);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '14px sans-serif';
      ctx.fillText('S23 Ultra 200MP', 160, 170);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCapturedFromCamera(dataUrl);
    }
  };

  const savePhoto = (dataUrl: string, meta?: Partial<MediaAttachment>) => {
    const media: MediaAttachment = {
      id: genUUID(),
      type: 'image',
      dataUrl,
      name: `Photo_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`,
      createdAt: new Date().toISOString(),
      mimeType: 'image/jpeg',
      ...meta,
    };
    dispatch({ type: 'ADD_MEDIA', pageId: currentPageId, media });
    setCapturedFromCamera(null);
  };

  // File upload (images + videos)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const isVideo = file.type.startsWith('video/');
        const media: MediaAttachment = {
          id: genUUID(),
          type: isVideo ? 'video' : 'image',
          dataUrl,
          name: file.name,
          size: file.size,
          createdAt: new Date().toISOString(),
          mimeType: file.type,
        };
        dispatch({ type: 'ADD_MEDIA', pageId: currentPageId, media });
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Audio recording
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    waveformTimerRef.current = setInterval(() => {
      setLiveWaveform(Array.from({ length: 40 }, () => Math.random() * 0.8 + 0.1));
    }, 100);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveformTimerRef.current) clearInterval(waveformTimerRef.current);
    setLiveWaveform(Array(40).fill(0.1));

    // Create AudioNote
    const duration = recordingTime;
    const note: AudioNote = {
      id: genUUID(),
      name: `Recording_${new Date().toLocaleTimeString()}`,
      dataUrl: '',
      duration,
      transcription: '',
      transcriptionStatus: 'idle',
      createdAt: new Date().toISOString(),
      waveform: generateWaveform(80),
      cropStart: 0,
      cropEnd: duration,
      pageId: currentPageId,
    };
    dispatch({ type: 'ADD_AUDIO_NOTE', note });
    setRecordingTime(0);

    // Auto-transcribe after short delay
    setTimeout(() => runTranscription(note), 500);
  };

  // Simulated Whisper transcription (background worker sim)
  const runTranscription = (note: AudioNote) => {
    setTranscribingId(note.id);
    dispatch({ type: 'UPDATE_AUDIO_NOTE', note: { ...note, transcriptionStatus: 'processing' } });

    const mockTranscriptions = [
      'Today I want to capture some thoughts about the project. The architecture looks solid and the team is making great progress.',
      'Reminder: review the pull requests before end of day. Also need to update the documentation for the new audio capture module.',
      'Meeting notes: discussed the knowledge graph improvements. Force-directed physics needs fine-tuning for large graphs.',
      'Quick thought — the whisper integration will significantly improve the accessibility of voice notes in the app.',
      'Ideas for the next sprint: improve the waveform visualization, add export functionality, and optimize the transcription pipeline.',
    ];

    // Simulate Whisper processing time (1-3 seconds)
    const delay = 1500 + Math.random() * 1500;
    setTimeout(() => {
      const transcription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
      dispatch({
        type: 'UPDATE_AUDIO_NOTE',
        note: { ...note, transcription, transcriptionStatus: 'done' },
      });
      setTranscribingId(null);
    }, delay);
  };

  const handleImageEditorSave = (dataUrl: string, meta: Partial<MediaAttachment>) => {
    if (editingImage) {
      dispatch({ type: 'UPDATE_MEDIA', pageId: currentPageId, media: { ...editingImage, dataUrl, ...meta, editedAt: new Date().toISOString() } });
    } else if (capturedFromCamera) {
      savePhoto(dataUrl, meta);
    }
    setEditingImage(null);
  };

  const handleAudioEditorSave = (note: AudioNote) => {
    dispatch({ type: 'UPDATE_AUDIO_NOTE', note: { ...note, editedAt: new Date().toISOString() } as AudioNote & { editedAt: string } });
    setEditingAudio(null);
  };

  const allMedia = Object.values(state.db).flatMap(p => p.mediaAttachments || []);
  const currentPageMedia = state.db[currentPageId]?.mediaAttachments || [];

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  };

  const tabs: { id: MediaTab; label: string; icon: React.ReactNode }[] = [
    { id: 'camera', label: 'Camera', icon: <Camera size={14} /> },
    { id: 'gallery', label: 'Gallery', icon: <Upload size={14} /> },
    { id: 'audio', label: 'Audio', icon: <Mic size={14} /> },
    { id: 'library', label: 'Library', icon: <Image size={14} /> },
  ];

  // ── Image/Video Editor overlay ──
  if (editingImage) {
    return <ImageEditor src={editingImage.dataUrl} onSave={handleImageEditorSave} onClose={() => setEditingImage(null)} />;
  }
  if (capturedFromCamera && activeTab !== 'camera') {
    return <ImageEditor src={capturedFromCamera} onSave={(d, m) => savePhoto(d, m)} onClose={() => setCapturedFromCamera(null)} />;
  }
  if (editingAudio) {
    return <AudioEditor note={editingAudio} onSave={handleAudioEditorSave} onClose={() => setEditingAudio(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white overflow-hidden">
      {/* Tab Bar */}
      <div className="flex bg-slate-900 border-b border-slate-800 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-900'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── CAMERA TAB ── */}
        {activeTab === 'camera' && (
          <div className="flex flex-col h-full">
            {capturedFromCamera ? (
              // Preview captured photo
              <div className="flex flex-col flex-1">
                <div className="flex-1 bg-black flex items-center justify-center">
                  <img src={capturedFromCamera} alt="Captured" className="max-w-full max-h-64 object-contain" />
                </div>
                <div className="bg-slate-900 p-3 flex gap-2">
                  <button onClick={() => setCapturedFromCamera(null)} className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-xl text-sm flex items-center justify-center gap-2">
                    <X size={14} /> Retake
                  </button>
                  <button onClick={() => setEditingImage({ id: 'temp', type: 'image', dataUrl: capturedFromCamera, name: 'preview.jpg', createdAt: new Date().toISOString() })} className="flex-1 bg-violet-700 text-white py-2 rounded-xl text-sm flex items-center justify-center gap-2">
                    <Crop size={14} /> Edit
                  </button>
                  <button onClick={() => savePhoto(capturedFromCamera)} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm flex items-center justify-center gap-2">
                    <Check size={14} /> Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                {/* Camera viewfinder */}
                <div className="relative flex-1 bg-black flex items-center justify-center" style={{ minHeight: 220 }}>
                  {cameraError ? (
                    <div className="text-center text-slate-500 p-8">
                      <Camera size={40} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Camera unavailable</p>
                      <p className="text-xs mt-1">Using simulated 200MP scene</p>
                    </div>
                  ) : (
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  )}

                  {/* Grid overlay */}
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: 'linear-gradient(rgba(99,102,241,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.15) 1px, transparent 1px)',
                    backgroundSize: '33.33% 33.33%',
                  }} />

                  {/* HUD */}
                  <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
                    <span className="bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">200MP</span>
                    <span className="bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">HDR ON</span>
                    <span className="bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">AI</span>
                  </div>

                  {/* Video mode toggle */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button onClick={() => setVideoMode(false)} className={`p-1.5 rounded-full ${!videoMode ? 'bg-white/90 text-black' : 'bg-black/60 text-white'}`}>
                      <Camera size={12} />
                    </button>
                    <button onClick={() => setVideoMode(true)} className={`p-1.5 rounded-full ${videoMode ? 'bg-red-500 text-white' : 'bg-black/60 text-white'}`}>
                      <Film size={12} />
                    </button>
                  </div>
                </div>

                {/* Camera controls */}
                <div className="bg-slate-900 p-3 flex items-center justify-around">
                  <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700">
                    <Image size={18} />
                  </button>
                  <button
                    onClick={videoMode ? () => { setIsVideoRecording(v => !v); } : capturePhoto}
                    className={`w-14 h-14 rounded-full border-4 border-white flex items-center justify-center transition-all ${
                      isVideoRecording ? 'bg-red-500 scale-90' : 'bg-white/20 hover:bg-white/30'
                    }`}
                  >
                    {isVideoRecording ? <Square size={20} fill="white" /> : videoMode ? <Film size={20} className="text-white" /> : <div className="w-10 h-10 rounded-full bg-white" />}
                  </button>
                  <button onClick={() => {}} className="p-2.5 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700">
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GALLERY TAB ── */}
        {activeTab === 'gallery' && (
          <div className="p-3 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-indigo-500/40 rounded-xl py-8 flex flex-col items-center gap-2 text-slate-500 hover:border-indigo-400 hover:text-slate-300 transition-colors bg-slate-900/50"
            >
              <Upload size={28} className="text-indigo-500" />
              <span className="text-sm font-medium">Tap to import photos & videos</span>
              <span className="text-xs">Supports JPG, PNG, GIF, MP4, MOV</span>
            </button>

            {currentPageMedia.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs mb-2">Current page media ({currentPageMedia.length})</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {currentPageMedia.map(media => (
                    <div key={media.id} className="relative group rounded-lg overflow-hidden aspect-square bg-slate-800">
                      {media.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900">
                          <Film size={24} className="text-slate-500" />
                        </div>
                      ) : (
                        <img src={media.dataUrl} alt={media.name} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <button onClick={() => setEditingImage(media)} className="p-1 bg-indigo-600 rounded text-white">
                          <Crop size={10} />
                        </button>
                        <button onClick={() => setPreviewMedia(media)} className="p-1 bg-slate-700 rounded text-white">
                          <ZoomIn size={10} />
                        </button>
                        <button onClick={() => dispatch({ type: 'DELETE_MEDIA', pageId: currentPageId, mediaId: media.id })} className="p-1 bg-red-600 rounded text-white">
                          <Trash2 size={10} />
                        </button>
                      </div>
                      {media.type === 'video' && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] px-1 py-0.5">VIDEO</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentPageMedia.length === 0 && (
              <div className="text-center py-8 text-slate-600">
                <Image size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No media on this page yet</p>
              </div>
            )}
          </div>
        )}

        {/* ── AUDIO TAB ── */}
        {activeTab === 'audio' && (
          <div className="p-3 space-y-4">
            {/* Recorder */}
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isRecording && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                  <span className={`text-sm font-semibold ${isRecording ? 'text-red-400' : 'text-slate-300'}`}>
                    {isRecording ? `Recording... ${formatTime(recordingTime)}` : 'Voice Recorder'}
                  </span>
                </div>
                <span className="text-slate-500 text-xs">16kHz · Mono · WAV</span>
              </div>

              {/* Live waveform */}
              <div className="h-12 bg-slate-800 rounded-lg flex items-center gap-0.5 px-2 mb-4 overflow-hidden">
                {liveWaveform.map((amp, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all duration-75 ${isRecording ? 'bg-indigo-400' : 'bg-slate-700'}`}
                    style={{ height: `${amp * 100}%` }}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl font-medium text-sm transition-colors"
                  >
                    <Mic size={16} /> Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl font-medium text-sm transition-colors"
                  >
                    <Square size={16} /> Stop & Transcribe
                  </button>
                )}
              </div>

              <div className="mt-2 flex items-center gap-1.5 text-slate-600 text-[10px]">
                <Volume2 size={10} />
                <span>Whisper.cpp engine · Background thread · Auto-transcription</span>
              </div>
            </div>

            {/* Audio Notes List */}
            <div className="space-y-2">
              <p className="text-slate-400 text-xs font-medium">AUDIO NOTES ({state.audioNotes.length})</p>
              {state.audioNotes.map(note => (
                <div key={note.id} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{note.name}</p>
                      <p className="text-slate-500 text-[10px]">{new Date(note.createdAt).toLocaleString()} · {formatTime(Math.round(note.duration))}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setPlayingAudioId(playingAudioId === note.id ? null : note.id)}
                        className="p-1.5 bg-indigo-600/30 rounded-lg text-indigo-400 hover:bg-indigo-600/50"
                      >
                        {playingAudioId === note.id ? <Pause size={12} /> : <Play size={12} />}
                      </button>
                      <button onClick={() => setEditingAudio(note)} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                        <Scissors size={12} />
                      </button>
                      <button onClick={() => dispatch({ type: 'DELETE_AUDIO_NOTE', noteId: note.id })} className="p-1.5 bg-slate-800 rounded-lg text-red-400 hover:text-red-300">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Mini waveform */}
                  <div className="h-7 flex items-center gap-[1px] mb-2 overflow-hidden">
                    {note.waveform.slice(0, 60).map((amp, i) => (
                      <div key={i} className="flex-1 bg-indigo-500/50 rounded-full" style={{ height: `${amp * 100}%` }} />
                    ))}
                  </div>

                  {/* Transcription */}
                  <div className="bg-slate-800 rounded-lg p-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      {note.transcriptionStatus === 'processing' || transcribingId === note.id ? (
                        <><Loader2 size={10} className="text-indigo-400 animate-spin" /><span className="text-indigo-400 text-[10px]">Transcribing via Whisper.cpp...</span></>
                      ) : note.transcriptionStatus === 'done' ? (
                        <><CheckCircle size={10} className="text-emerald-400" /><span className="text-emerald-400 text-[10px]">Transcription complete</span></>
                      ) : note.transcriptionStatus === 'error' ? (
                        <><AlertCircle size={10} className="text-red-400" /><span className="text-red-400 text-[10px]">Transcription failed</span></>
                      ) : (
                        <><FileAudio size={10} className="text-slate-500" /><span className="text-slate-500 text-[10px]">Not transcribed</span>
                          <button onClick={() => runTranscription(note)} className="ml-auto text-indigo-400 text-[10px] hover:text-indigo-300">Transcribe</button>
                        </>
                      )}
                    </div>
                    {note.transcription ? (
                      <p className="text-slate-300 text-[11px] leading-relaxed">{note.transcription}</p>
                    ) : (
                      <p className="text-slate-600 text-[11px] italic">No transcription yet</p>
                    )}
                  </div>
                </div>
              ))}

              {state.audioNotes.length === 0 && (
                <div className="text-center py-8 text-slate-600">
                  <MicOff size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No audio notes yet</p>
                  <p className="text-xs mt-1">Hit record to capture your first voice note</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LIBRARY TAB ── */}
        {activeTab === 'library' && (
          <div className="p-3 space-y-3">
            <p className="text-slate-400 text-xs font-medium">ALL MEDIA ({allMedia.length} files)</p>
            {allMedia.length === 0 ? (
              <div className="text-center py-12 text-slate-600">
                <Image size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Your media library is empty</p>
                <p className="text-xs mt-1">Capture photos, videos, or import from gallery</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {allMedia.map(media => {
                  const page = Object.values(state.db).find(p => (p.mediaAttachments || []).some(m => m.id === media.id));
                  return (
                    <div key={media.id} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                      <div className="relative aspect-video bg-slate-800">
                        {media.type === 'video' ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film size={28} className="text-slate-500" />
                          </div>
                        ) : (
                          <img src={media.dataUrl} alt={media.name} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute top-1 right-1 bg-black/60 rounded px-1 text-[9px] text-white">
                          {media.type.toUpperCase()}
                        </div>
                      </div>
                      <div className="p-2">
                        <p className="text-white text-[11px] font-medium truncate">{media.name}</p>
                        <p className="text-slate-500 text-[9px]">{page?.name || 'Unknown'} · {formatFileSize(media.size)}</p>
                        <div className="flex gap-1 mt-1.5">
                          {media.type === 'image' && (
                            <button onClick={() => setEditingImage(media)} className="flex-1 text-[9px] bg-indigo-600/30 text-indigo-400 py-1 rounded-lg flex items-center justify-center gap-0.5">
                              <Crop size={8} /> Edit
                            </button>
                          )}
                          <button onClick={() => setPreviewMedia(media)} className="flex-1 text-[9px] bg-slate-800 text-slate-400 py-1 rounded-lg flex items-center justify-center gap-0.5">
                            <ZoomIn size={8} /> View
                          </button>
                          <button onClick={() => {
                            if (page) dispatch({ type: 'DELETE_MEDIA', pageId: page.id, mediaId: media.id });
                          }} className="px-2 text-[9px] bg-red-600/20 text-red-400 py-1 rounded-lg">
                            <Trash2 size={8} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input for gallery */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileUpload} />

      {/* Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={() => setPreviewMedia(null)}>
          <div className="flex items-center justify-between p-3 bg-slate-900" onClick={e => e.stopPropagation()}>
            <span className="text-white text-sm truncate flex-1">{previewMedia.name}</span>
            <div className="flex gap-2">
              {previewMedia.type === 'image' && (
                <button onClick={() => { setEditingImage(previewMedia); setPreviewMedia(null); }} className="p-1.5 bg-indigo-600 rounded-lg text-white">
                  <Crop size={14} />
                </button>
              )}
              <button onClick={() => setPreviewMedia(null)} className="p-1.5 bg-slate-800 rounded-lg text-slate-300">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            {previewMedia.type === 'video' ? (
              <video src={previewMedia.dataUrl} controls className="max-w-full max-h-full rounded-xl" />
            ) : (
              <img src={previewMedia.dataUrl} alt={previewMedia.name} className="max-w-full max-h-full object-contain rounded-xl" />
            )}
          </div>
          <div className="p-3 bg-slate-900 text-slate-400 text-xs flex justify-between">
            <span>{new Date(previewMedia.createdAt).toLocaleString()}</span>
            <span>{formatFileSize(previewMedia.size)}</span>
            <button className="text-indigo-400 flex items-center gap-1">
              <Download size={10} /> Export
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
