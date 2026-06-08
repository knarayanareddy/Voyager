import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Camera, Mic, Square, Play, Pause, Trash2, Image as ImageIcon, RefreshCw, Sparkles, Check, FileAudio, ShieldAlert } from 'lucide-react';
import { generateUuid } from '../mockData';

// --- CUSTOM CAMERA HOOK ---
export const useCamera = (screenOn: boolean) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      setStream(mediaStream);
      setError(null);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Camera access denied or unavailable.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Android Lifecycle: Stop camera if screen goes off
  useEffect(() => {
    if (!screenOn) {
      stopCamera();
    }
  }, [screenOn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return { stream, error, startCamera, stopCamera };
};

// --- MAIN MEDIA STUDIO COMPONENT ---
export const MediaStudio: React.FC = () => {
  const { state, actions } = useDatabase();
  const { settings } = state;
  const [activeTab, setActiveTab] = useState<'camera' | 'audio' | 'gallery'>('camera');

  return (
    <div className="flex-1 flex flex-col bg-neutral-900 text-white overflow-hidden select-none">
      {/* Header Tabs */}
      <div className="h-11 bg-neutral-950 border-b border-neutral-800 flex items-center justify-around px-4">
        <button
          onClick={() => setActiveTab('camera')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'camera' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-neutral-400'
          }`}
        >
          <Camera className="w-3.5 h-3.5" /> Camera
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'audio' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-neutral-400'
          }`}
        >
          <Mic className="w-3.5 h-3.5" /> Voice Recorder
        </button>
        <button
          onClick={() => setActiveTab('gallery')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'gallery' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-neutral-400'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" /> Studio Attachments
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'camera' && <CameraView screenOn={settings.screenOn} actions={actions} />}
        {activeTab === 'audio' && <AudioRecorder screenOn={settings.screenOn} actions={actions} />}
        {activeTab === 'gallery' && <GalleryView state={state} actions={actions} />}
      </div>
    </div>
  );
};

// --- CAMERA SUB-COMPONENT ---
interface CameraViewProps {
  screenOn: boolean;
  actions: any;
}

const CameraView: React.FC<CameraViewProps> = ({ screenOn, actions }) => {
  const { stream, error, startCamera, stopCamera } = useCamera(screenOn);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null); // Base64 preview
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [filter, setFilter] = useState<'normal' | 'grayscale' | 'sepia' | 'cool'>('normal');
  const [flashActive, setFlashActive] = useState(false);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Clean up camera on unmount or tab switch
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    // Play camera sound and trigger visual shutter flash
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          setPhotoBlob(blob);
          setCapturedPhoto(URL.createObjectURL(blob));
        }
      }, 'image/jpeg', 0.92);
    }
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const savePhoto = async () => {
    if (!photoBlob) return;

    // Apply rotation/filter if needed on a final canvas
    const img = new Image();
    img.src = capturedPhoto || '';
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Handle rotation dimensions
      if (rotation === 90 || rotation === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      // Translate and rotate
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      // Apply Filters
      if (filter === 'grayscale') {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const avg = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
          data[i] = avg;     // R
          data[i + 1] = avg; // G
          data[i + 2] = avg; // B
        }
        ctx.putImageData(imgData, 0, 0);
      } else if (filter === 'sepia') {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
          data[i+1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
          data[i+2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        }
        ctx.putImageData(imgData, 0, 0);
      } else if (filter === 'cool') {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.max(0, data[i] - 10); // Reduce Red
          data[i + 2] = Math.min(255, data[i + 2] + 20); // Boost Blue
        }
        ctx.putImageData(imgData, 0, 0);
      }

      canvas.toBlob(async (finalBlob) => {
        if (finalBlob) {
          const name = `Camera Photo ${new Date().toLocaleTimeString()}`;
          await actions.addMedia(finalBlob, 'image', name);
          
          // Reset
          setCapturedPhoto(null);
          setPhotoBlob(null);
          setRotation(0);
          setFilter('normal');
          startCamera();
        }
      }, 'image/jpeg', 0.9);
    };
  };

  const discardPhoto = () => {
    setCapturedPhoto(null);
    setPhotoBlob(null);
    setRotation(0);
    setFilter('normal');
    startCamera();
  };

  return (
    <div className="flex-1 flex flex-col relative bg-black justify-between p-4 overflow-hidden">
      {/* Shutter Flash Animation */}
      {flashActive && <div className="absolute inset-0 bg-white z-[100] animate-out fade-out duration-150" />}

      {/* Video / Captured Photo Preview */}
      <div className="flex-1 flex items-center justify-center relative rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden shadow-inner">
        {error ? (
          <div className="text-center p-4 text-neutral-400">
            <ShieldAlert className="w-10 h-10 mx-auto text-neutral-500 mb-2" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        ) : !capturedPhoto ? (
          /* Live Stream */
          <div className="w-full h-full relative flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <span className="absolute top-3 right-3 bg-red-500 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span> LIVE STREAM
            </span>
          </div>
        ) : (
          /* Edit captured photo */
          <div className="relative w-full h-full flex items-center justify-center p-2">
            <img
              src={capturedPhoto}
              alt="Captured Photo"
              className={`max-w-full max-h-full rounded-lg object-contain shadow-lg transition-transform duration-300`}
              style={{
                transform: `rotate(${rotation}deg)`,
                filter:
                  filter === 'grayscale'
                    ? 'grayscale(1)'
                    : filter === 'sepia'
                    ? 'sepia(0.8)'
                    : filter === 'cool'
                    ? 'hue-rotate(20deg) saturate(1.2)'
                    : 'none'
              }}
            />
          </div>
        )}
      </div>

      {/* Controls Footer */}
      <div className="h-28 flex flex-col justify-end gap-3 mt-3">
        {!capturedPhoto ? (
          /* Live Capture Controls */
          <div className="flex items-center justify-center">
            <button
              onClick={capturePhoto}
              disabled={!!error || !stream}
              className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-transparent active:scale-90 disabled:opacity-40 transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500" />
            </button>
          </div>
        ) : (
          /* Edit / Save Controls */
          <div className="flex flex-col gap-2.5">
            {/* Filter selection bar */}
            <div className="flex justify-center gap-2">
              {(['normal', 'grayscale', 'sepia', 'cool'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[10px] font-semibold uppercase px-2 py-1 rounded border transition-colors cursor-pointer ${
                    filter === f ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between px-6">
              <button
                onClick={discardPhoto}
                className="flex items-center gap-1.5 bg-neutral-900 text-red-400 border border-neutral-800 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Discard
              </button>
              <button
                onClick={handleRotate}
                className="flex items-center gap-1.5 bg-neutral-900 text-neutral-300 border border-neutral-800 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Rotate 90°
              </button>
              <button
                onClick={savePhoto}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-500 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" /> Save Photo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- VOICE RECORDER SUB-COMPONENT (REAL MICROPHONE RECORDING) ---
interface AudioRecorderProps {
  screenOn: boolean;
  actions: any;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ screenOn, actions }) => {
  const [recording, setRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  
  // Waveform rendering
  const [waveform, setWaveform] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Playback state
  const [playbackUrl, setPlaybackUrl] = useState<string>('');
  const [playbackBlob, setPlaybackBlob] = useState<Blob | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Transcription state
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');

  // Stop recording on screen off
  useEffect(() => {
    if (!screenOn && recording) {
      stopRecording();
    }
  }, [screenOn]);

  // Handle timer
  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
        // Add random bar heights to the waveform simulation
        setWaveform(prev => [...prev, Math.random() * 80 + 20]);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  // Clean up playback URL
  useEffect(() => {
    return () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
  }, [playbackUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setAudioChunks([]);
      setWaveform([]);
      setSeconds(0);
      setPlaybackUrl('');
      setPlaybackBlob(null);
      setTranscription('');

      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setAudioChunks(prev => [...prev, e.data]);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const objectUrl = URL.createObjectURL(audioBlob);
        setPlaybackBlob(audioBlob);
        setPlaybackUrl(objectUrl);
      };

      recorder.start(200); // collect data every 200ms
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access denied or unavailable.');
    }
  };

  // Necessary to collect last chunks
  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);

      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !playbackUrl) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const triggerTranscription = () => {
    setTranscribing(true);
    // Simulate Whisper transcription loading
    setTimeout(() => {
      setTranscribing(false);
      setTranscription(
        "Discussing local-first data persistence inside Voyager. We successfully implemented binary Blobs in IndexedDB, preventing state bloat and ensuring privacy for audio notes and stylus sketches."
      );
    }, 2000);
  };

  const saveAudioNote = async () => {
    if (!playbackBlob) return;

    const noteId = `audio-${generateUuid()}`;
    const name = `Audio Note ${new Date().toLocaleDateString()}`;

    // Save audio note metadata and blob to IndexedDB via actions
    await actions.addAudioNote(
      {
        id: noteId,
        title: name,
        duration: seconds,
        transcription: transcription || undefined,
        createdAt: new Date().toISOString()
      },
      playbackBlob
    );

    // Also add to media attachments so it shows up in media tab
    await actions.addMedia(playbackBlob, 'audio', name);

    // Reset
    setPlaybackUrl('');
    setPlaybackBlob(null);
    setWaveform([]);
    setSeconds(0);
    setTranscription('');
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4 bg-neutral-900">
      
      {/* Audio Playback Element */}
      {playbackUrl && (
        <audio
          ref={audioRef}
          src={playbackUrl}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}

      {/* Main Display: Waveform & Details */}
      <div className="flex-1 flex flex-col justify-center items-center gap-6 bg-neutral-950 rounded-2xl p-6 border border-neutral-800 shadow-inner">
        {recording ? (
          <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-500 flex items-center justify-center text-red-500 animate-pulse">
            <Mic className="w-6 h-6" />
          </div>
        ) : playbackUrl ? (
          <div className="w-12 h-12 rounded-full bg-emerald-600/20 border border-emerald-500 flex items-center justify-center text-emerald-500">
            <FileAudio className="w-6 h-6" />
          </div>
        ) : (
          <div className="text-neutral-500 flex flex-col items-center gap-2">
            <Mic className="w-10 h-10 text-neutral-600" />
            <span className="text-xs">Tap record button to begin</span>
          </div>
        )}

        {/* Counter */}
        {(recording || seconds > 0) && (
          <div className="text-2xl font-bold font-mono tracking-wider text-neutral-200">
            {formatTime(seconds)}
          </div>
        )}

        {/* Animated Waveform HUD */}
        {waveform.length > 0 && (
          <div className="w-full h-16 flex items-center justify-center gap-[3px] overflow-x-auto px-4 max-w-[280px]">
            {waveform.slice(-30).map((height, idx) => (
              <div
                key={idx}
                className={`w-[4px] rounded-full transition-all duration-300 ${
                  recording ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        )}

        {/* Real-Time simulated Whisper Transcription */}
        {transcribing && (
          <div className="w-full flex flex-col items-center gap-1 text-xs text-neutral-400">
            <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
            <span className="animate-pulse">Whisper transcribing...</span>
          </div>
        )}

        {transcription && (
          <div className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-300 italic leading-relaxed text-center shadow">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block mb-1">
              Whisper Transcript
            </span>
            "{transcription}"
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="h-28 flex flex-col justify-end gap-3 mt-3">
        {!playbackUrl ? (
          /* Recording Button */
          <div className="flex items-center justify-center">
            {recording ? (
              <button
                onClick={stopRecording}
                className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-neutral-900 cursor-pointer"
              >
                <Square className="w-6 h-6 fill-red-500 text-red-500" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-red-600 hover:bg-red-500 active:scale-95 cursor-pointer shadow-lg"
              >
                <Mic className="w-6 h-6 text-white" />
              </button>
            )}
          </div>
        ) : (
          /* Playback / Edit / Save */
          <div className="flex flex-col gap-2.5">
            {/* Playback action bar */}
            {!transcription && !transcribing && (
              <div className="flex justify-center">
                <button
                  onClick={triggerTranscription}
                  className="flex items-center gap-1.5 bg-neutral-950 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] font-bold hover:bg-neutral-800 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Transcribe with Whisper AI
                </button>
              </div>
            )}

            <div className="flex items-center justify-between px-6">
              <button
                onClick={() => {
                  setPlaybackUrl('');
                  setPlaybackBlob(null);
                  setWaveform([]);
                  setSeconds(0);
                  setTranscription('');
                }}
                className="flex items-center gap-1.5 bg-neutral-900 text-red-400 border border-neutral-800 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Clear
              </button>
              
              <button
                onClick={togglePlayback}
                className="flex items-center gap-1.5 bg-neutral-900 text-blue-400 border border-neutral-800 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 cursor-pointer"
              >
                {playing ? (
                  <>
                    <Pause className="w-4 h-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Play
                  </>
                )}
              </button>

              <button
                onClick={saveAudioNote}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-500 shadow-md active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Save Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- STUDIO ATTACHMENTS GALLERY ---
interface GalleryViewProps {
  state: any;
  actions: any;
}

const GalleryView: React.FC<GalleryViewProps> = ({ state, actions }) => {
  const { mediaAttachments } = state;

  if (mediaAttachments.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-neutral-500">
        <ImageIcon className="w-10 h-10 text-neutral-700 mb-2" />
        <p className="text-xs">No media files captured yet.</p>
        <p className="text-[10px] text-neutral-600 text-center mt-1">
          Use the Camera or Voice Recorder to create local IndexedDB media files.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3 bg-neutral-900 select-text">
      {mediaAttachments.map((item: any) => (
        <div
          key={item.id}
          className="bg-neutral-950 border border-neutral-800 rounded-xl p-2 flex flex-col justify-between shadow relative group"
        >
          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this media attachment?')) {
                actions.deleteMedia(item.id);
              }
            }}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
            title="Delete File"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Media Preview */}
          <div className="aspect-square w-full rounded-lg overflow-hidden bg-neutral-900 flex items-center justify-center border border-neutral-800/50 mb-2">
            {item.type === 'image' || item.type === 'drawing' ? (
              <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-neutral-400 gap-1">
                <FileAudio className="w-8 h-8 text-emerald-500" />
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider">AUDIO</span>
              </div>
            )}
          </div>

          {/* Metadata details */}
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] font-bold text-neutral-200 truncate pr-6" title={item.name}>
              {item.name}
            </p>
            <p className="text-[8px] text-neutral-500 font-mono">
              {new Date(item.createdAt).toLocaleDateString()} • {(item.size / 1024).toFixed(1)} KB
            </p>
            
            {/* Markdown reference Helper */}
            <div className="mt-2 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 flex items-center justify-between text-[9px] text-neutral-400 font-mono">
              <span className="truncate max-w-[100px]" title={`![${item.name}](${item.id})`}>
                ID: {item.id}
              </span>
              <button
                onClick={() => {
                  const ref = item.type === 'audio' ? `[[${item.id}]]` : `![${item.name}](${item.id})`;
                  navigator.clipboard.writeText(ref);
                  alert('Markdown reference copied! Paste it in any block.');
                }}
                className="text-blue-400 hover:text-blue-300 text-[8px] font-bold cursor-pointer"
              >
                Copy Ref
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
