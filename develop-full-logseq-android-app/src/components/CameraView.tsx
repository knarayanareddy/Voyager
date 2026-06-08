import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getTodayJournalId } from '../mockData';
import {
  Camera, X, Check, RefreshCw, Image as ImageIcon, Zap, ZapOff,
  Grid, SwitchCamera, Download, FolderOpen, BookOpen
} from 'lucide-react';

type CameraMode = 'photo' | 'upload' | 'presets';

interface PresetScene {
  label: string;
  emoji: string;
  description: string;
  gradient: string;
  textColor: string;
}

const PRESET_SCENES: PresetScene[] = [
  { label: 'Workspace', emoji: '💻', description: '200MP Workspace Setup', gradient: 'from-slate-900 via-slate-800 to-slate-900', textColor: 'text-slate-200' },
  { label: 'Nature', emoji: '🌿', description: 'Ultra-wide Nature Shot', gradient: 'from-green-900 via-emerald-800 to-teal-900', textColor: 'text-green-200' },
  { label: 'Night Sky', emoji: '🌌', description: '100× Space Zoom', gradient: 'from-indigo-950 via-purple-900 to-black', textColor: 'text-indigo-200' },
  { label: 'City', emoji: '🏙️', description: 'Nightography Mode', gradient: 'from-orange-950 via-slate-800 to-purple-900', textColor: 'text-orange-200' },
  { label: 'Portrait', emoji: '🧑', description: 'Portrait Mode Bokeh', gradient: 'from-pink-900 via-rose-800 to-pink-950', textColor: 'text-pink-200' },
  { label: 'Food', emoji: '🍜', description: 'Food Mode HD', gradient: 'from-amber-900 via-orange-800 to-red-900', textColor: 'text-amber-200' },
];

export default function CameraView({ onClose }: { onClose: () => void }) {
  const { dispatch } = useDatabase();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<CameraMode>('photo');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFocusing, setIsFocusing] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetScene | null>(null);
  const [attached, setAttached] = useState(false);
  const [caption, setCaption] = useState('');
  const [shutterAnimation, setShutterAnimation] = useState(false);

  // Start webcam
  const startCamera = useCallback(async (facing: 'user' | 'environment' = facingMode) => {
    try {
      if (stream) { stream.getTracks().forEach(t => t.stop()); }
      setCameraError(null);
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError(err.message || 'Camera access denied');
    }
  }, [facingMode, stream]);

  useEffect(() => {
    if (mode === 'photo') startCamera();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [mode]);

  const playShutterSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch { /* no audio context */ }
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    setShutterAnimation(true);
    setTimeout(() => setShutterAnimation(false), 200);
    playShutterSound();

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    if (flashEnabled) {
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 150);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCapturedImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFocusTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setFocusPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsFocusing(true);
    setTimeout(() => { setIsFocusing(false); }, 800);
  };

  const attachToJournal = () => {
    const todayId = getTodayJournalId();
    const imageContent = capturedImage ? `![${caption || 'Photo'}](${capturedImage})` : '';
    const metaContent = `📷 ${caption || 'Photo captured'} — [[${new Date().toLocaleDateString()}]] #photo`;

    if (capturedImage) {
      dispatch({ type: 'APPEND_BLOCK_TO_PAGE', pageId: todayId, content: imageContent });
    }
    if (metaContent) {
      dispatch({ type: 'APPEND_BLOCK_TO_PAGE', pageId: todayId, content: metaContent });
    }

    if (selectedPreset) {
      dispatch({
        type: 'APPEND_BLOCK_TO_PAGE',
        pageId: todayId,
        content: `📷 ${selectedPreset.emoji} ${selectedPreset.label}: ${selectedPreset.description} — ${caption || 'captured today'} #photo`,
      });
    }

    setAttached(true);
    setTimeout(() => {
      dispatch({ type: 'NAVIGATE', pageId: todayId } as any);
      onClose();
    }, 1200);
  };

  const switchCamera = () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

  const downloadImage = () => {
    if (!capturedImage) return;
    const a = document.createElement('a');
    a.href = capturedImage;
    a.download = `logseq-photo-${Date.now()}.jpg`;
    a.click();
  };

  const retake = () => {
    setCapturedImage(null);
    setSelectedPreset(null);
    setAttached(false);
    setCaption('');
    if (mode === 'photo') startCamera();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm">
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white">
          <X size={18} />
        </button>
        <div className="flex items-center gap-1 bg-white/10 rounded-full p-1">
          {(['photo', 'upload', 'presets'] as CameraMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setCapturedImage(null); setSelectedPreset(null); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${mode === m ? 'bg-white text-black' : 'text-white/70'}`}
            >
              {m === 'photo' ? '📷 Live' : m === 'upload' ? '🖼 Gallery' : '🎨 Scenes'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {mode === 'photo' && !capturedImage && (
            <>
              <button onClick={() => setFlashEnabled(!flashEnabled)} className={`p-2 rounded-full ${flashEnabled ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}>
                {flashEnabled ? <Zap size={16} /> : <ZapOff size={16} />}
              </button>
              <button onClick={() => setGridEnabled(!gridEnabled)} className={`p-2 rounded-full ${gridEnabled ? 'bg-white/30' : 'bg-white/10'} text-white`}>
                <Grid size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main viewfinder area */}
      <div className="flex-1 relative overflow-hidden">

        {/* Flash overlay */}
        {flashActive && <div className="absolute inset-0 bg-white z-20 pointer-events-none" />}
        {/* Shutter animation */}
        {shutterAnimation && <div className="absolute inset-0 bg-black/60 z-20 pointer-events-none transition-opacity" />}

        {/* LIVE CAMERA MODE */}
        {mode === 'photo' && !capturedImage && (
          <div className="relative w-full h-full" onClick={handleFocusTap}>
            {cameraError ? (
              <div className="flex flex-col items-center justify-center h-full text-white gap-3">
                <Camera size={48} className="opacity-40" />
                <p className="text-sm opacity-70 text-center px-8">{cameraError}</p>
                <button onClick={() => startCamera()} className="px-4 py-2 bg-white/20 rounded-lg text-sm">
                  Try Again
                </button>
              </div>
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}
            {/* Grid overlay */}
            {gridEnabled && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/30" />
                <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/30" />
                <div className="absolute top-1/3 left-0 right-0 border-t border-white/30" />
                <div className="absolute top-2/3 left-0 right-0 border-t border-white/30" />
              </div>
            )}
            {/* Focus point */}
            {focusPoint && (
              <div
                className={`absolute pointer-events-none border-2 ${isFocusing ? 'border-yellow-400 w-16 h-16' : 'border-white/50 w-12 h-12'} transition-all duration-200`}
                style={{ left: focusPoint.x - (isFocusing ? 32 : 24), top: focusPoint.y - (isFocusing ? 32 : 24) }}
              />
            )}
            {/* Camera UI overlays */}
            <div className="absolute top-3 left-0 right-0 flex justify-center">
              <div className="bg-black/50 rounded-full px-3 py-1 text-white/70 text-xs">200MP</div>
            </div>
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6">
              <button onClick={switchCamera} className="p-3 bg-white/20 rounded-full text-white backdrop-blur-sm">
                <SwitchCamera size={22} />
              </button>
              {/* Shutter button */}
              <button
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white border-4 border-white/50 shadow-lg active:scale-90 transition-transform"
              />
              <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white/20 rounded-full text-white backdrop-blur-sm">
                <FolderOpen size={22} />
              </button>
            </div>
          </div>
        )}

        {/* GALLERY UPLOAD MODE */}
        {mode === 'upload' && !capturedImage && (
          <div
            className="flex flex-col items-center justify-center h-full text-white gap-4 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-24 h-24 rounded-3xl bg-white/10 flex items-center justify-center border-2 border-dashed border-white/30">
              <ImageIcon size={36} className="opacity-60" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">Select from Gallery</p>
              <p className="text-white/50 text-sm">Tap to browse photos</p>
            </div>
            <div className="text-xs text-white/30">Supports JPG, PNG, GIF, WebP</div>
          </div>
        )}

        {/* PRESET SCENES MODE */}
        {mode === 'presets' && !capturedImage && (
          <div className="h-full overflow-y-auto p-4">
            <p className="text-white/50 text-sm mb-3 text-center">Select a scene to capture</p>
            <div className="grid grid-cols-2 gap-3">
              {PRESET_SCENES.map(scene => (
                <button
                  key={scene.label}
                  onClick={() => {
                    setSelectedPreset(scene);
                    const canvas = canvasRef.current;
                    if (canvas) {
                      canvas.width = 800;
                      canvas.height = 600;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        const grd = ctx.createLinearGradient(0, 0, 0, 600);
                        grd.addColorStop(0, '#1e1b4b');
                        grd.addColorStop(1, '#0f172a');
                        ctx.fillStyle = grd;
                        ctx.fillRect(0, 0, 800, 600);
                        ctx.font = '120px serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(scene.emoji, 400, 320);
                        ctx.fillStyle = 'rgba(255,255,255,0.8)';
                        ctx.font = 'bold 32px system-ui';
                        ctx.fillText(scene.label, 400, 430);
                        ctx.fillStyle = 'rgba(255,255,255,0.4)';
                        ctx.font = '20px system-ui';
                        ctx.fillText(scene.description, 400, 475);
                      }
                      setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
                    }
                    playShutterSound();
                    setShutterAnimation(true);
                    setTimeout(() => setShutterAnimation(false), 200);
                  }}
                  className={`relative rounded-2xl overflow-hidden h-36 bg-gradient-to-br ${scene.gradient} flex flex-col items-center justify-center gap-1 border border-white/10 active:scale-95 transition-transform`}
                >
                  <span className="text-4xl">{scene.emoji}</span>
                  <span className={`text-sm font-semibold ${scene.textColor}`}>{scene.label}</span>
                  <span className="text-white/40 text-[10px]">{scene.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CAPTURED IMAGE PREVIEW */}
        {capturedImage && (
          <div className="flex flex-col h-full">
            <div className="flex-1 relative">
              <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
              {selectedPreset && (
                <div className="absolute bottom-2 left-2 bg-black/60 rounded-lg px-2 py-1 text-white text-xs">
                  {selectedPreset.emoji} {selectedPreset.description}
                </div>
              )}
            </div>
            {/* Caption input */}
            <div className="px-4 py-3 bg-black/80">
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Add a caption..."
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none placeholder:text-white/40"
              />
            </div>
          </div>
        )}

        {/* Hidden elements */}
        <canvas ref={canvasRef} className="hidden" />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} capture={undefined} />
      </div>

      {/* Bottom controls */}
      <div className="px-4 py-4 bg-black/90 backdrop-blur-sm">
        {capturedImage ? (
          attached ? (
            <div className="flex items-center justify-center gap-2 py-3 bg-green-500/20 rounded-xl border border-green-500/30">
              <Check size={18} className="text-green-400" />
              <span className="text-green-400 font-medium text-sm">Attached to today's journal!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={retake} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium text-sm flex items-center justify-center gap-2">
                <RefreshCw size={15} /> Retake
              </button>
              <button onClick={downloadImage} className="p-3 rounded-xl bg-white/10 text-white">
                <Download size={18} />
              </button>
              <button onClick={attachToJournal} className="flex-1 py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium text-sm flex items-center justify-center gap-2">
                <BookOpen size={15} /> Attach to Journal
              </button>
            </div>
          )
        ) : (
          <div className="text-center text-white/30 text-xs">
            {mode === 'photo' ? 'Tap viewfinder to focus · Tap shutter to capture' :
             mode === 'upload' ? 'Tap above to select a photo from your gallery' :
             'Select a scene above to capture'}
          </div>
        )}
      </div>
    </div>
  );
}
