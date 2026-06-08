import { useState, useRef, useEffect, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { MediaAttachment, AudioNote } from '../types';
import { genId } from '../mockData';
import {
  Camera, Mic, Image, RotateCcw, Crop, ZoomIn, ZoomOut,
  Sun, Contrast, Play, Pause, Scissors, Upload, Trash2, Save, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type StudioTab = 'camera' | 'audio' | 'gallery';
type CameraMode = 'photo' | 'video';
type ImageTool = 'crop' | 'rotate' | 'brightness' | 'contrast' | 'resize';

// ─── SIMULATED scene URLs (Space Zoom etc.) ───────────────────────────────────

const SIMULATED_SCENES = [
  { label: 'Astro Mode 🌙', gradient: 'from-slate-950 via-indigo-950 to-slate-900', emoji: '🌌' },
  { label: 'Space Zoom 🔭', gradient: 'from-slate-900 via-blue-950 to-slate-900', emoji: '🔭' },
  { label: 'Night Mode 🌃', gradient: 'from-slate-900 via-violet-950 to-slate-900', emoji: '🌃' },
];

// ─── Waveform generator ───────────────────────────────────────────────────────

function generateWaveform(len = 80): number[] {
  return Array.from({ length: len }, (_, i) => {
    const base = 0.3 + Math.random() * 0.5;
    const env = Math.sin((i / len) * Math.PI) * 0.4;
    return Math.min(1, base + env);
  });
}

// ─── Waveform canvas ──────────────────────────────────────────────────────────

function WaveformCanvas({
  waveform,
  cropStart,
  cropEnd,
  duration,
  playing,
  playhead,
}: {
  waveform: number[];
  cropStart: number;
  cropEnd: number;
  duration: number;
  playing: boolean;
  playhead: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const barW = W / waveform.length;
    for (let i = 0; i < waveform.length; i++) {
      const x = i * barW;
      const amp = waveform[i];
      const barH = amp * (H - 4);
      const relPos = i / waveform.length;
      const startRel = duration > 0 ? cropStart / duration : 0;
      const endRel = duration > 0 ? cropEnd / duration : 1;
      const inCrop = relPos >= startRel && relPos <= endRel;

      ctx.fillStyle = inCrop
        ? `rgba(99, 102, 241, ${0.5 + amp * 0.5})`
        : 'rgba(71, 85, 105, 0.4)';
      ctx.fillRect(x, (H - barH) / 2, Math.max(1, barW - 1), barH);
    }

    // Playhead
    if (duration > 0) {
      const phX = (playhead / duration) * W;
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(phX - 1, 0, 2, H);
    }
  }, [waveform, cropStart, cropEnd, duration, playing, playhead]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={60}
      className="w-full rounded-xl"
    />
  );
}

// ─── Camera view ──────────────────────────────────────────────────────────────

function CameraView({ onCapture }: { onCapture: (m: MediaAttachment) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState<CameraMode>('photo');
  const [error, setError] = useState<string | null>(null);
  const [simScene, setSimScene] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
        setError(null);
      }
    } catch {
      setError('Camera unavailable — showing simulated scene');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capturePhoto = () => {
    if (streaming && videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      onCapture({
        id: genId(),
        type: 'image',
        dataUrl,
        name: `Photo ${new Date().toLocaleTimeString()}`,
        createdAt: new Date().toISOString(),
        width: canvas.width,
        height: canvas.height,
        mimeType: 'image/jpeg',
      });
    } else {
      // Simulated capture
      onCapture({
        id: genId(),
        type: 'image',
        dataUrl: '',
        name: `${SIMULATED_SCENES[simScene].label} ${new Date().toLocaleTimeString()}`,
        createdAt: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Viewfinder */}
      <div className="relative flex-1 bg-black overflow-hidden rounded-2xl mx-2 mt-2">
        {streaming ? (
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${SIMULATED_SCENES[simScene].gradient} flex flex-col items-center justify-center gap-3`}>
            <span className="text-6xl">{SIMULATED_SCENES[simScene].emoji}</span>
            <p className="text-slate-400 text-xs">{SIMULATED_SCENES[simScene].label}</p>
            {error && <p className="text-slate-600 text-[10px] px-4 text-center">{error}</p>}
          </div>
        )}

        {/* Rule of thirds grid */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none">
            {[1, 2].map(i => (
              <div key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-white/10" style={{ left: `${(i / 3) * 100}%` }} />
            ))}
            {[1, 2].map(i => (
              <div key={`h${i}`} className="absolute left-0 right-0 h-px bg-white/10" style={{ top: `${(i / 3) * 100}%` }} />
            ))}
          </div>
        )}

        {/* Indicators */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className="bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">200MP</span>
          <span className="bg-amber-500/80 text-black text-[9px] px-1.5 py-0.5 rounded font-bold">HDR</span>
        </div>
        {false && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-rose-600/80 px-2 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-white text-[9px] font-bold">REC</span>
          </div>
        )}

        {/* Scene switcher (when no camera) */}
        {!streaming && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {SIMULATED_SCENES.map((_, i) => (
              <button key={i} onClick={() => setSimScene(i)} className={`w-1.5 h-1.5 rounded-full transition-colors ${simScene === i ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="px-4 py-3 flex flex-col gap-3">
        {/* Mode tabs */}
        <div className="flex gap-2 justify-center">
          {(['photo', 'video'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${mode === m ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}>
              {m === 'photo' ? '📸 Photo' : '🎬 Video'}
            </button>
          ))}
        </div>

        {/* Capture + extras */}
        <div className="flex items-center justify-center gap-5">
          <button onClick={() => setShowGrid(g => !g)} className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs transition-colors ${showGrid ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            ⊞
          </button>
          <button
            onClick={capturePhoto}
            className="w-16 h-16 rounded-full bg-white border-4 border-slate-700 flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all shadow-lg"
          >
            <Camera size={24} className="text-slate-900" />
          </button>
          <button onClick={startCamera} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Audio recorder ───────────────────────────────────────────────────────────

function AudioRecorder() {
  const { state, dispatch } = useDatabase();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveWave, setLiveWave] = useState<number[]>(Array(40).fill(0.1));
  const [editNote, setEditNote] = useState<AudioNote | null>(null);
  const [playhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = () => {
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 0.1), 100);
    waveTimerRef.current = setInterval(() => {
      setLiveWave(Array.from({ length: 40 }, () => Math.random() * 0.8 + 0.1));
    }, 80);
  };

  const stopRecording = () => {
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveTimerRef.current) clearInterval(waveTimerRef.current);
    const duration = Math.round(elapsed * 10) / 10;
    const note: AudioNote = {
      id: genId(),
      name: `Voice Memo ${new Date().toLocaleTimeString()}`,
      dataUrl: '',
      duration,
      transcription: '',
      transcriptionStatus: 'idle',
      createdAt: new Date().toISOString(),
      waveform: generateWaveform(),
      cropStart: 0,
      cropEnd: duration,
    };
    dispatch({ type: 'ADD_AUDIO_NOTE', note });
    setEditNote(note);
    setLiveWave(Array(40).fill(0.1));
  };

  const handleTranscribe = (note: AudioNote) => {
    const updated: AudioNote = { ...note, transcriptionStatus: 'processing' };
    dispatch({ type: 'UPDATE_AUDIO_NOTE', note: updated });
    setEditNote(updated);
    setTranscribing(true);

    const samples = [
      'Meeting notes: Discussed the new feature roadmap and prioritized the graph view improvements.',
      'Reminder: Follow up on the IndexedDB persistence implementation for local-first data storage.',
      'Idea: Integrate real Whisper.cpp WASM for on-device speech recognition in the next release.',
      'Note to self: The S-Pen handwriting recognition needs better OCR training data.',
    ];
    setTimeout(() => {
      const transcription = samples[Math.floor(Math.random() * samples.length)];
      const done: AudioNote = { ...updated, transcription, transcriptionStatus: 'done' };
      dispatch({ type: 'UPDATE_AUDIO_NOTE', note: done });
      setEditNote(done);
      setTranscribing(false);
    }, 2000);
  };

  const handleInsertToPage = (note: AudioNote) => {
    const page = state.db[state.currentPageId];
    if (!page || !note.transcription) return;
    const lastBlock = page.blocks[page.blocks.length - 1];
    if (lastBlock) {
      dispatch({ type: 'ADD_BLOCK', pageId: state.currentPageId, afterBlockId: lastBlock.id, content: note.transcription });
    }
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;

  return (
    <div className="flex flex-col gap-4 px-3 py-3 h-full overflow-y-auto">
      {/* Record button */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl ${
              recording
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/40 scale-110'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
            }`}
          >
            {recording ? <div className="w-8 h-8 bg-white rounded-sm" /> : <Mic size={28} className="text-white" />}
          </button>
          {recording && (
            <div className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping opacity-60" />
          )}
        </div>

        {recording ? (
          <div className="text-center">
            <p className="text-rose-400 font-mono text-lg font-bold">{fmtTime(elapsed)}</p>
            <p className="text-slate-500 text-xs">Recording… tap to stop</p>
          </div>
        ) : (
          <p className="text-slate-500 text-xs">Tap to start recording</p>
        )}

        {/* Live waveform */}
        {recording && (
          <div className="w-full flex items-center justify-center gap-0.5 h-10">
            {liveWave.map((amp, i) => (
              <div
                key={i}
                className="bg-rose-500 rounded-full transition-all duration-75"
                style={{ width: 3, height: `${amp * 36}px` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit panel for last recorded note */}
      {editNote && !recording && (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-semibold truncate flex-1">{editNote.name}</p>
            <button onClick={() => setEditNote(null)} className="text-slate-600 hover:text-slate-400 ml-2">
              <X size={14} />
            </button>
          </div>

          {/* Waveform */}
          <WaveformCanvas
            waveform={editNote.waveform}
            cropStart={editNote.cropStart}
            cropEnd={editNote.cropEnd}
            duration={editNote.duration}
            playing={playing}
            playhead={playhead}
          />

          {/* Crop sliders */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Scissors size={10} />
              <span>Trim Start</span>
              <span className="ml-auto font-mono">{editNote.cropStart.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={editNote.duration}
              step={0.1}
              value={editNote.cropStart}
              onChange={e => {
                const updated = { ...editNote, cropStart: +e.target.value };
                setEditNote(updated);
                dispatch({ type: 'UPDATE_AUDIO_NOTE', note: updated });
              }}
              className="w-full h-1 accent-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Scissors size={10} />
              <span>Trim End</span>
              <span className="ml-auto font-mono">{editNote.cropEnd.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={editNote.duration}
              step={0.1}
              value={editNote.cropEnd}
              onChange={e => {
                const updated = { ...editNote, cropEnd: +e.target.value };
                setEditNote(updated);
                dispatch({ type: 'UPDATE_AUDIO_NOTE', note: updated });
              }}
              className="w-full h-1 accent-indigo-500"
            />
          </div>

          {/* Play controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setPlaying(p => !p)}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              {playing ? <Pause size={12} /> : <Play size={12} />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => handleTranscribe(editNote)}
              disabled={transcribing || editNote.transcriptionStatus === 'done'}
              className="flex-1 py-2 bg-violet-900/60 hover:bg-violet-800/60 text-violet-300 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              {transcribing ? '✨ Transcribing…' : editNote.transcriptionStatus === 'done' ? '✓ Transcribed' : '🗣️ Transcribe'}
            </button>
          </div>

          {/* Transcription result */}
          {editNote.transcription && (
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
              <p className="text-slate-500 text-[10px] mb-1">Transcription</p>
              <p className="text-slate-300 text-xs leading-relaxed">{editNote.transcription}</p>
              <button
                onClick={() => handleInsertToPage(editNote)}
                className="mt-2 text-indigo-400 text-[10px] hover:text-indigo-300 flex items-center gap-1"
              >
                <Save size={10} /> Insert into current page
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audio notes list */}
      {state.audioNotes.length > 0 && (
        <div>
          <p className="text-slate-500 text-xs font-medium mb-2">Saved Recordings ({state.audioNotes.length})</p>
          <div className="space-y-2">
            {state.audioNotes.map(note => (
              <div key={note.id} className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
                  <Mic size={16} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-xs font-medium truncate">{note.name}</p>
                  <p className="text-slate-500 text-[10px]">
                    {note.duration.toFixed(1)}s
                    {note.transcriptionStatus === 'done' && ' · ✓ Transcribed'}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => setEditNote(note)}
                    className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                  >
                    <Play size={11} />
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'DELETE_AUDIO_NOTE', noteId: note.id })}
                    className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Image editor ─────────────────────────────────────────────────────────────

function ImageEditor({
  media,
  onSave,
  onCancel,
}: {
  media: MediaAttachment;
  onSave: (m: MediaAttachment) => void;
  onCancel: () => void;
}) {
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [activeTool, setActiveTool] = useState<ImageTool | null>(null);

  const tools: { id: ImageTool; icon: typeof Sun; label: string }[] = [
    { id: 'rotate', icon: RotateCcw, label: 'Rotate' },
    { id: 'brightness', icon: Sun, label: 'Brightness' },
    { id: 'contrast', icon: Contrast, label: 'Contrast' },
    { id: 'resize', icon: ZoomIn, label: 'Scale' },
    { id: 'crop', icon: Crop, label: 'Crop' },
  ];

  const handleSave = () => {
    onSave({
      ...media,
      editedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Image preview */}
      <div className="flex-1 flex items-center justify-center bg-slate-950 mx-2 mt-2 rounded-2xl overflow-hidden">
        {media.dataUrl ? (
          <img
            src={media.dataUrl}
            alt={media.name}
            style={{
              transform: `rotate(${rotation}deg) scale(${scale})`,
              filter: `brightness(${brightness}%) contrast(${contrast}%)`,
              maxWidth: '100%',
              maxHeight: '100%',
              transition: 'transform 0.2s, filter 0.2s',
            }}
            className="object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <Image size={40} />
            <p className="text-xs">No preview available</p>
          </div>
        )}
      </div>

      {/* Tools */}
      <div className="px-3 py-3 space-y-3">
        <div className="flex gap-2 justify-center">
          {tools.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTool(activeTool === t.id ? null : t.id)}
              className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] transition-colors ${activeTool === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {activeTool === 'rotate' && (
          <div className="flex items-center gap-3 justify-center">
            <span className="text-slate-400 text-xs">{rotation}°</span>
            <button onClick={() => setRotation(r => (r - 90 + 360) % 360)} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs">↺ 90°</button>
            <button onClick={() => setRotation(r => (r + 90) % 360)} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs">↻ 90°</button>
          </div>
        )}
        {activeTool === 'brightness' && (
          <div className="flex items-center gap-2">
            <Sun size={12} className="text-yellow-400 flex-shrink-0" />
            <input type="range" min={0} max={200} value={brightness} onChange={e => setBrightness(+e.target.value)} className="flex-1 h-1 accent-yellow-400" />
            <span className="text-slate-400 text-xs w-8">{brightness}%</span>
          </div>
        )}
        {activeTool === 'contrast' && (
          <div className="flex items-center gap-2">
            <Contrast size={12} className="text-blue-400 flex-shrink-0" />
            <input type="range" min={0} max={200} value={contrast} onChange={e => setContrast(+e.target.value)} className="flex-1 h-1 accent-blue-400" />
            <span className="text-slate-400 text-xs w-8">{contrast}%</span>
          </div>
        )}
        {activeTool === 'resize' && (
          <div className="flex items-center gap-2">
            <ZoomOut size={12} className="text-slate-400 flex-shrink-0" />
            <input type="range" min={0.1} max={3} step={0.05} value={scale} onChange={e => setScale(+e.target.value)} className="flex-1 h-1 accent-indigo-500" />
            <ZoomIn size={12} className="text-slate-400 flex-shrink-0" />
            <span className="text-slate-400 text-xs w-12">{Math.round(scale * 100)}%</span>
          </div>
        )}
        {activeTool === 'crop' && (
          <p className="text-slate-500 text-xs text-center">Tap Save to apply current view</p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1">
            <Save size={12} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Gallery tab ──────────────────────────────────────────────────────────────

function GalleryView({ onEdit }: { onEdit: (m: MediaAttachment) => void }) {
  const { state, dispatch } = useDatabase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allMedia = Object.values(state.db).flatMap(p => p.mediaAttachments ?? []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        const media: MediaAttachment = {
          id: genId(),
          type: file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image',
          dataUrl,
          name: file.name,
          size: file.size,
          createdAt: new Date().toISOString(),
          mimeType: file.type,
        };
        dispatch({ type: 'ADD_MEDIA', pageId: state.currentPageId, media });
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="flex flex-col h-full px-3 py-3 gap-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs font-medium">All Media ({allMedia.length})</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          <Upload size={12} /> Import
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={handleFileUpload} />
      </div>

      {allMedia.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
          <Image size={36} />
          <p className="text-sm">No media yet</p>
          <p className="text-xs">Use Camera or import files</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 overflow-y-auto">
          {allMedia.map(m => (
            <div
              key={m.id}
              onClick={() => onEdit(m)}
              className="aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900 cursor-pointer hover:border-indigo-500 transition-colors relative"
            >
              {m.type === 'image' && m.dataUrl ? (
                <img src={m.dataUrl} alt={m.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <span className="text-2xl">{m.type === 'audio' ? '🎵' : m.type === 'video' ? '🎬' : '🖼️'}</span>
                  <span className="text-slate-600 text-[9px] text-center px-1 truncate w-full text-center">{m.name}</span>
                </div>
              )}
              {m.editedAt && (
                <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-indigo-500 border border-slate-900" title="Edited" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MediaStudio (main) ───────────────────────────────────────────────────────

export default function MediaStudio() {
  const { dispatch, state } = useDatabase();
  const [tab, setTab] = useState<StudioTab>('camera');
  const [editingMedia, setEditingMedia] = useState<MediaAttachment | null>(null);

  const handleCapture = (media: MediaAttachment) => {
    dispatch({ type: 'ADD_MEDIA', pageId: state.currentPageId, media });
  };

  const handleSaveEdit = (media: MediaAttachment) => {
    dispatch({ type: 'UPDATE_MEDIA', pageId: state.currentPageId, media });
    setEditingMedia(null);
  };

  if (editingMedia) {
    return (
      <div className="h-full">
        <ImageEditor
          media={editingMedia}
          onSave={handleSaveEdit}
          onCancel={() => setEditingMedia(null)}
        />
      </div>
    );
  }

  const TABS: { id: StudioTab; icon: typeof Camera; label: string }[] = [
    { id: 'camera', icon: Camera, label: 'Camera' },
    { id: 'audio', icon: Mic, label: 'Audio' },
    { id: 'gallery', icon: Image, label: 'Gallery' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-1 px-3 pt-3 pb-1 flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              tab === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'camera' && <CameraView onCapture={handleCapture} />}
        {tab === 'audio' && <AudioRecorder />}
        {tab === 'gallery' && <GalleryView onEdit={setEditingMedia} />}
      </div>
    </div>
  );
}
