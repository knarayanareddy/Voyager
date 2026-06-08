import { useState, useEffect, useRef } from 'react';
import { 
  Camera, Settings, MessageSquare, Phone as PhoneIcon, Search, 
  Sun, Shield, Aperture, RefreshCw, Check, Globe, Sliders, Battery, Upload, Video, Trash2
} from 'lucide-react';

interface PhoneHomeProps {
  onLaunchApp: (appId: string) => void;
  batteryLevel: number;
  isCharging: boolean;
  onUpdateSystemSetting: (key: string, value: any) => void;
  themeColor: string;
  onAddPhotoToLogseq: (photoUrl: string, caption: string) => void;
}

// Predefined beautiful mock photos the camera can "snap"
const CAMERA_PRESETS = [
  {
    id: 'workspace',
    name: 'Workspace Setup (200MP)',
    url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
    caption: '![Workspace Setup](https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80)\n*Captured with S23 Ultra 200MP Camera - Desk Setup ideas.*'
  },
  {
    id: 'moon',
    name: '100x Space Zoom Moon',
    url: 'https://images.unsplash.com/photo-1522030299830-16b8d3d049fe?auto=format&fit=crop&w=600&q=80',
    caption: '![100x Space Zoom Moon](https://images.unsplash.com/photo-1522030299830-16b8d3d049fe?auto=format&fit=crop&w=600&q=80)\n*S23 Ultra 100x Space Zoom Moon photography. Absolute clarity! 🌕*'
  },
  {
    id: 'night',
    name: 'Astro Nightography',
    url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=600&q=80',
    caption: '![Astro Nightography](https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=600&q=80)\n*Astro Nightography mode on S23 Ultra. Capturing the Milky Way in 20 seconds. 🌌*'
  }
];

export default function PhoneHome({
  onLaunchApp,
  batteryLevel,
  isCharging,
  onUpdateSystemSetting,
  themeColor,
  onAddPhotoToLogseq
}: PhoneHomeProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [activeSubApp, setActiveSubApp] = useState<'home' | 'camera' | 'settings' | 'chrome'>('home');
  
  // Camera specific states
  const [cameraMode, setCameraMode] = useState<'preset' | 'webcam' | 'upload'>('preset');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [justAttached, setJustAttached] = useState(false);

  // Webcam states
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Upload states
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  // Web Audio Shutter Sound
  const playShutterSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // White noise-ish sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.log("AudioContext not supported or blocked: ", e);
    }
  };

  // Manage Webcam stream on camera open
  useEffect(() => {
    if (activeSubApp === 'camera' && cameraMode === 'webcam') {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 } })
        .then(stream => {
          setWebcamStream(stream);
          setWebcamError(null);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Webcam access error:", err);
          setWebcamError("Could not access camera. Please use Presets or Upload!");
          setCameraMode('preset');
        });
    } else {
      // Stop webcam stream when not active
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        setWebcamStream(null);
      }
    }

    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeSubApp, cameraMode]);

  const triggerCameraShutter = () => {
    setIsFlashing(true);
    playShutterSound();
    setTimeout(() => setIsFlashing(false), 200);

    if (cameraMode === 'webcam' && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 480;
        // Draw the current video frame on the canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedPhoto(dataUrl);
      }
    } else if (cameraMode === 'upload' && uploadedPhotoUrl) {
      setCapturedPhoto(uploadedPhotoUrl);
    } else {
      // Preset mode
      const preset = CAMERA_PRESETS[selectedPresetIndex];
      setCapturedPhoto(preset.url);
    }
    setJustAttached(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedPhotoUrl(event.target.result as string);
          setCameraMode('upload');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const attachPhoto = () => {
    if (!capturedPhoto) return;
    
    let url = capturedPhoto;
    let caption = `![Captured Photo](${url})\n*Photo captured with Samsung Galaxy S23 Ultra Camera. 📸*`;
    
    if (cameraMode === 'preset') {
      const preset = CAMERA_PRESETS[selectedPresetIndex];
      url = preset.url;
      caption = preset.caption;
    }

    onAddPhotoToLogseq(url, caption);
    setJustAttached(true);
    setTimeout(() => {
      setCapturedPhoto(null);
      setJustAttached(false);
      setActiveSubApp('home');
      onLaunchApp('logseq');
    }, 1500);
  };

  // Render Android Lock/Home Screens
  if (activeSubApp === 'camera') {
    return (
      <div className="relative h-full w-full bg-black flex flex-col justify-between text-white font-sans overflow-hidden">
        {/* Flash Overlay */}
        {isFlashing && <div className="absolute inset-0 bg-white z-50 animate-flash" />}
        
        {/* Invisible capturing canvas */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Top bar with Camera Mode Selectors */}
        <div className="flex flex-col bg-black/75 z-10 border-b border-neutral-900">
          <div className="flex justify-between items-center px-4 py-2 bg-black/30">
            <span className="text-[10px] font-extrabold tracking-wider text-emerald-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse mr-1" />
              <span>S23 ULTRA PRO 200MP</span>
            </span>
            <div className="flex space-x-3 text-[9px] font-bold text-neutral-450">
              <span className="text-yellow-400">HDR+</span>
              <span>RAW-24bit</span>
            </div>
          </div>

          {/* Camera Input Source Tabs */}
          <div className="grid grid-cols-3 text-center border-t border-neutral-900/40">
            <button
              onClick={() => setCameraMode('preset')}
              className={`py-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer ${
                cameraMode === 'preset' ? 'text-yellow-400 bg-neutral-900/50' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Preset Scenes
            </button>
            <button
              onClick={() => setCameraMode('webcam')}
              className={`py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer ${
                cameraMode === 'webcam' ? 'text-yellow-400 bg-neutral-900/50' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Video size={11} />
              <span>Live Webcam</span>
            </button>
            <button
              onClick={() => setCameraMode('upload')}
              className={`py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer ${
                cameraMode === 'upload' ? 'text-yellow-400 bg-neutral-900/50' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Upload size={11} />
              <span>Gallery Import</span>
            </button>
          </div>
        </div>

        {/* Camera Viewfinder */}
        <div className="relative flex-1 bg-neutral-950 flex items-center justify-center overflow-hidden">
          
          {/* 1. PRESET SCENE VIEW */}
          {cameraMode === 'preset' && (
            <img 
              src={CAMERA_PRESETS[selectedPresetIndex].url} 
              alt="Preset Viewfinder" 
              className="w-full h-full object-cover transition-all duration-500"
            />
          )}

          {/* 2. WEBCAM VIEW */}
          {cameraMode === 'webcam' && (
            <div className="w-full h-full relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]" // mirror front cam
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-[8px] font-bold rounded-full animate-pulse flex items-center space-x-1 z-10">
                <span className="w-1 h-1 bg-white rounded-full" />
                <span>REC LIVE</span>
              </div>
            </div>
          )}

          {/* 3. GALLERY UPLOAD VIEW */}
          {cameraMode === 'upload' && (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
              {uploadedPhotoUrl ? (
                <img 
                  src={uploadedPhotoUrl} 
                  alt="Uploaded Viewfinder" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="border-2 border-dashed border-neutral-700 hover:border-emerald-500/50 rounded-2xl p-5 w-full h-48 flex flex-col items-center justify-center space-y-3 bg-neutral-900/60 transition-colors">
                  <Upload size={26} className="text-slate-500 animate-bounce" />
                  <div>
                    <h5 className="text-[11px] font-bold">Import from Gallery</h5>
                    <p className="text-[9px] text-neutral-500 mt-0.5">Select any image from your computer to simulate snapping a photo</p>
                  </div>
                  <label className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors shadow-md">
                    <span>Choose File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
          
          {/* Grid lines (Aesthetic DSLR Grid) */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-15">
            <div className="border border-white/30"></div>
            <div className="border border-white/30"></div>
            <div className="border border-white/30"></div>
            <div className="border border-white/30"></div>
            <div className="border border-white/30"></div>
            <div className="border border-white/30"></div>
            <div className="border border-white/30"></div>
            <div className="border border-white/30"></div>
            <div className="border border-white/30"></div>
          </div>

          {/* Focus Ring */}
          <div className="absolute w-14 h-14 border-2 border-yellow-400 rounded-full animate-ping opacity-40 pointer-events-none" />

          {/* Webcam Access Error message */}
          {cameraMode === 'webcam' && webcamError && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-500/90 text-white text-[9px] font-semibold px-3 py-2 rounded-lg backdrop-blur-md shadow-lg flex items-center space-x-1.5 text-center">
              <span>{webcamError}</span>
            </div>
          )}

          {/* Capture Preview Thumb Overlay (Snapping animation) */}
          {capturedPhoto && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-4 z-20 animate-scaleIn">
              <h4 className="text-xs font-bold text-yellow-400 mb-2 flex items-center space-x-1">
                <span>📸 Photo Snapped!</span>
              </h4>
              <img 
                src={capturedPhoto} 
                alt="Captured Snapshot" 
                className="w-44 h-44 object-cover rounded-xl border-2 border-white/20 shadow-2xl mb-4"
              />
              <div className="flex flex-col space-y-2 w-full max-w-[190px]">
                <button
                  onClick={attachPhoto}
                  disabled={justAttached}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-700 text-white text-[10px] font-bold rounded-lg flex items-center justify-center space-x-1 shadow-md cursor-pointer"
                >
                  {justAttached ? (
                    <>
                      <Check size={12} />
                      <span>Attached to Logseq!</span>
                    </>
                  ) : (
                    <span>Attach to Today's Journal</span>
                  )}
                </button>
                <button
                  onClick={() => { setCapturedPhoto(null); setUploadedPhotoUrl(null); }}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-semibold rounded-lg cursor-pointer"
                >
                  Retake Photo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="bg-black py-5 px-4 flex flex-col space-y-3 items-center">
          
          {/* Preset Scene Selector (only visible in preset mode) */}
          {cameraMode === 'preset' ? (
            <div className="flex space-x-5 overflow-x-auto text-[10px] font-bold text-neutral-450 tracking-wider pb-1 max-w-full">
              {CAMERA_PRESETS.map((preset, idx) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPresetIndex(idx)}
                  className={`uppercase whitespace-nowrap cursor-pointer transition-all ${
                    selectedPresetIndex === idx ? 'text-yellow-400 border-b-2 border-yellow-400 pb-0.5 scale-105' : 'opacity-70'
                  }`}
                >
                  {preset.name.split(' ')[0]}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-neutral-500 font-medium">
              {cameraMode === 'webcam' ? "Live Webcam Feed ready to snap" : "Click 'Choose File' to import picture"}
            </div>
          )}

          {/* Shutter row */}
          <div className="flex justify-between items-center w-full px-6">
            <button 
              onClick={() => {
                if (webcamStream) {
                  webcamStream.getTracks().forEach(track => track.stop());
                  setWebcamStream(null);
                }
                setActiveSubApp('home');
              }}
              className="text-[10px] px-3 py-1.5 rounded-full bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer transition-colors"
            >
              Exit
            </button>

            {/* Main Shutter Button */}
            <button 
              onClick={triggerCameraShutter}
              disabled={cameraMode === 'upload' && !uploadedPhotoUrl}
              className="w-15 h-15 rounded-full bg-white p-1 flex items-center justify-center cursor-pointer active:scale-90 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              title="Capture Shutter"
            >
              <div className="w-full h-full rounded-full border-2 border-black bg-white hover:bg-neutral-100 flex items-center justify-center">
                <Aperture size={22} className="text-black" />
              </div>
            </button>

            {/* Reset / Mode specific toggle */}
            {cameraMode === 'preset' ? (
              <button 
                onClick={() => setSelectedPresetIndex((selectedPresetIndex + 1) % CAMERA_PRESETS.length)}
                className="w-9 h-9 rounded-full bg-neutral-900 flex items-center justify-center cursor-pointer hover:bg-neutral-800 transition-all text-neutral-300"
                title="Switch Preset Scene"
              >
                <RefreshCw size={14} />
              </button>
            ) : cameraMode === 'upload' && uploadedPhotoUrl ? (
              <button
                onClick={() => setUploadedPhotoUrl(null)}
                className="w-9 h-9 rounded-full bg-neutral-900 flex items-center justify-center cursor-pointer hover:bg-neutral-800 transition-all text-rose-500"
                title="Clear Upload"
              >
                <Trash2 size={14} />
              </button>
            ) : (
              <div className="w-9 h-9" /> // spacer
            )}
          </div>
        </div>
        
        <style>{`
          @keyframes flash {
            0% { opacity: 0; }
            50% { opacity: 1; }
            100% { opacity: 0; }
          }
          .animate-flash {
            animation: flash 0.2s ease-out forwards;
          }
        `}</style>
      </div>
    );
  }

  if (activeSubApp === 'settings') {
    return (
      <div className="h-full w-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans flex flex-col overflow-hidden">
        {/* Settings Header */}
        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="text-emerald-500 animate-spin-slow" size={18} />
            <span className="font-extrabold text-sm tracking-wide">Settings</span>
          </div>
          <button
            onClick={() => setActiveSubApp('home')}
            className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* Settings List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Device customization */}
          <div className="bg-white dark:bg-slate-950 rounded-xl p-4 shadow-xs border border-slate-200/55 dark:border-slate-800/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center space-x-1.5">
              <Sliders size={13} />
              <span>Galaxy S23 Ultra Physical Frame</span>
            </h3>

            <div className="space-y-4">
              {/* Color picker */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                  Frame Bezel Finish:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'phantom-black', name: 'Phantom Black', class: 'bg-neutral-850 border-neutral-700' },
                    { id: 'botanic-green', name: 'Botanic Green', class: 'bg-emerald-950 border-emerald-800' },
                    { id: 'cream', name: 'Cream / Gold', class: 'bg-amber-50 border-amber-200' },
                    { id: 'lavender', name: 'Lavender', class: 'bg-purple-100 border-purple-300' }
                  ].map(c => (
                    <button
                      key={c.id}
                      onClick={() => onUpdateSystemSetting('color', c.id)}
                      className={`h-9 rounded-lg border flex flex-col items-center justify-center cursor-pointer transition-all ${c.class} ${
                        themeColor === c.id ? 'ring-2 ring-emerald-500 scale-105 shadow-sm' : 'opacity-85 hover:opacity-100'
                      }`}
                      title={c.name}
                    >
                      <span className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                        c.id === 'cream' ? 'text-slate-900' : 'text-white'
                      }`}>
                        {c.name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle Gestures vs Buttons */}
              <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-900">
                <div>
                  <span className="text-xs font-bold block">Gesture Navigation</span>
                  <span className="text-[10px] text-slate-400">Hide classic Android bottom buttons</span>
                </div>
                <input
                  type="checkbox"
                  onChange={(e) => onUpdateSystemSetting('useGestures', e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 dark:focus:ring-emerald-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                />
              </div>

              {/* Device Frame View Toggle */}
              <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-900">
                <div>
                  <span className="text-xs font-bold block">Interactive Device Frame</span>
                  <span className="text-[10px] text-slate-400">Show phone frame instead of fullscreen</span>
                </div>
                <button
                  onClick={() => onUpdateSystemSetting('showFrame', true)}
                  className="px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                >
                  Enabled
                </button>
              </div>
            </div>
          </div>

          {/* Battery and Power Simulation */}
          <div className="bg-white dark:bg-slate-950 rounded-xl p-4 shadow-xs border border-slate-200/55 dark:border-slate-800/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center space-x-1.5">
              <Battery size={13} />
              <span>Battery & Power HUD</span>
            </h3>

            <div className="space-y-4">
              {/* Battery slide */}
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  <span>Simulate Battery Percentage:</span>
                  <span className="text-emerald-500 font-bold">{batteryLevel}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={batteryLevel}
                  onChange={(e) => onUpdateSystemSetting('batteryLevel', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Toggle charging */}
              <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-900">
                <div>
                  <span className="text-xs font-bold block">Mock USB-C Charger connected</span>
                  <span className="text-[10px] text-slate-400">Show charging animation in status bar</span>
                </div>
                <input
                  type="checkbox"
                  checked={isCharging}
                  onChange={(e) => onUpdateSystemSetting('isCharging', e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 dark:focus:ring-emerald-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Security & OS Info */}
          <div className="bg-white dark:bg-slate-950 rounded-xl p-4 shadow-xs border border-slate-200/55 dark:border-slate-800/60 text-center">
            <div className="w-9 h-9 bg-emerald-500/15 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Shield size={16} />
            </div>
            <h4 className="text-xs font-bold">Knox Security Protected</h4>
            <p className="text-[9px] text-slate-400 mt-1">
              Samsung One UI 6.0 | Android 14<br />
              Vite-Vite custom container simulation v1.2
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeSubApp === 'chrome') {
    return (
      <div className="h-full w-full bg-slate-100 text-slate-800 font-sans flex flex-col overflow-hidden">
        {/* Browser Top Bar */}
        <div className="bg-slate-200 p-2.5 flex flex-col space-y-1.5 shadow-xs border-b border-slate-300">
          <div className="flex justify-between items-center">
            <div className="flex space-x-1 items-center bg-white border border-slate-300 px-3 py-1 rounded-full w-full mr-2">
              <Globe size={11} className="text-slate-400 flex-shrink-0" />
              <input 
                type="text" 
                value="https://github.com/logseq/logseq" 
                readOnly
                className="text-[10px] font-medium w-full focus:outline-hidden text-slate-600 overflow-hidden text-ellipsis select-none"
              />
            </div>
            <button
              onClick={() => setActiveSubApp('home')}
              className="text-xs font-bold text-slate-600 bg-slate-300 hover:bg-slate-350 px-2 py-1 rounded-md cursor-pointer"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Browser Page Body */}
        <div className="flex-1 overflow-y-auto bg-white p-4 text-xs space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-200">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-extrabold text-sm">
              L
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">logseq / logseq</h3>
              <p className="text-[10px] text-slate-500">A privacy-first, open-source platform for knowledge management.</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800">README.md</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Logseq is a local-first, privacy-first outliner knowledge graph. Logseq supports both Markdown and Org-mode files. It allows you to organize your notes as bullets, write bi-directional links, compile flashcards, and visualize your thoughts as an interactive graph.
            </p>
            <div className="bg-emerald-500/10 border-l-2 border-emerald-500 p-2.5 rounded-r-md text-[10px] text-emerald-800 font-medium">
              💡 <strong>S23 Ultra Special Note:</strong> We have built an incredible simulator for you! You can run the entire Logseq core editor, manage checklists, view links, review flashcards, use the S-Pen, and take photos right inside this Galaxy phone frame!
            </div>

            <div className="pt-4 flex justify-center">
              <button
                onClick={() => {
                  setActiveSubApp('home');
                  onLaunchApp('logseq');
                }}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-extrabold shadow-sm hover:bg-emerald-600 transition-colors cursor-pointer"
              >
                Launch Logseq Mobile App
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- DEFAULT Android Home Screen ---
  return (
    <div className="relative h-full w-full flex flex-col justify-between p-6 pb-4 font-sans select-none text-white overflow-hidden">
      
      {/* 1. Time & Weather Widget (Samsung style glassmorphism) */}
      <div className="space-y-4">
        <div className="flex justify-between items-start mt-2">
          {/* Weather Widget */}
          <div className="bg-white/10 dark:bg-black/25 backdrop-blur-md border border-white/10 rounded-2xl p-3 w-[52%] shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-white/80 block leading-tight">New York</span>
                <span className="text-[22px] font-extrabold leading-none block mt-1 tracking-tighter">52°F</span>
              </div>
              <Sun size={20} className="text-yellow-300 animate-spin-slow" />
            </div>
            <span className="text-[9px] font-semibold text-white/70 block mt-2.5">Sunny • AQI 32 Good</span>
          </div>

          {/* Time & Date Widget */}
          <div className="text-right flex flex-col items-end pt-1 pr-1">
            <span className="text-3xl font-light tracking-tighter leading-none block font-mono">
              {currentTime.split(' ')[0]}
            </span>
            <span className="text-[9px] font-bold tracking-wider uppercase text-white/80 mt-1 block">
              {currentTime.split(' ')[1] || 'AM'}
            </span>
            <span className="text-[10px] font-semibold text-white/80 mt-1.5 block">
              {currentDate}
            </span>
          </div>
        </div>

        {/* 2. Google / Galaxy Search Bar */}
        <div className="w-full bg-white/15 dark:bg-black/30 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center space-x-2 shadow-xs">
          <Search size={14} className="text-white/60" />
          <input
            type="text"
            placeholder="Search Galaxy S23 Ultra..."
            readOnly
            className="bg-transparent text-[10px] text-white placeholder-white/60 focus:outline-hidden w-full select-none"
          />
          <div className="flex space-x-2 items-center border-l border-white/20 pl-2">
            <Camera size={12} className="text-white/60 cursor-pointer hover:text-white" onClick={() => setActiveSubApp('camera')} />
          </div>
        </div>
      </div>

      {/* 3. App Icons Grid */}
      <div className="grid grid-cols-4 gap-y-6 gap-x-4 my-auto py-4">
        
        {/* LOGSEQ APP */}
        <button
          onClick={() => onLaunchApp('logseq')}
          className="flex flex-col items-center group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md group-active:scale-90 transition-all border border-emerald-300/20">
            <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center font-extrabold text-emerald-600 text-xs shadow-xs">
              L
            </div>
          </div>
          <span className="text-[9px] font-bold mt-1.5 tracking-wide text-white text-shadow shadow-black/80">Logseq</span>
        </button>

        {/* CAMERA */}
        <button
          onClick={() => setActiveSubApp('camera')}
          className="flex flex-col items-center group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-neutral-850 flex items-center justify-center shadow-md group-active:scale-90 transition-all border border-neutral-700/50">
            <Camera size={22} className="text-white" />
          </div>
          <span className="text-[9px] font-bold mt-1.5 tracking-wide text-white text-shadow shadow-black/80">Camera</span>
        </button>

        {/* SETTINGS */}
        <button
          onClick={() => setActiveSubApp('settings')}
          className="flex flex-col items-center group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center shadow-md group-active:scale-90 transition-all border border-slate-300/20">
            <Settings size={22} className="text-white animate-spin-slow" />
          </div>
          <span className="text-[9px] font-bold mt-1.5 tracking-wide text-white text-shadow shadow-black/80">Settings</span>
        </button>

        {/* BROWSER (CHROME) */}
        <button
          onClick={() => setActiveSubApp('chrome')}
          className="flex flex-col items-center group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-md group-active:scale-90 transition-all border border-slate-200">
            <Globe size={22} className="text-sky-500" />
          </div>
          <span className="text-[9px] font-bold mt-1.5 tracking-wide text-white text-shadow shadow-black/80">Chrome</span>
        </button>

      </div>

      {/* 4. Bottom Dock */}
      <div className="w-full bg-white/10 dark:bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-3.5 flex justify-around shadow-lg">
        
        {/* Phone dialer */}
        <button 
          onClick={() => alert("Simulated S23 Ultra: Dialing *#06#... Galaxy status OK! Everything works well! ✅")}
          className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-xs"
        >
          <PhoneIcon size={18} className="text-white" />
        </button>

        {/* Messages */}
        <button 
          onClick={() => alert("Simulated Messages: 3 unread text messages. Your S-Pen is ready for handwriting input!")}
          className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-xs"
        >
          <MessageSquare size={18} className="text-white" />
        </button>

        {/* Chrome */}
        <button 
          onClick={() => setActiveSubApp('chrome')}
          className="w-10 h-10 rounded-xl bg-white flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-xs"
        >
          <Globe size={18} className="text-sky-500" />
        </button>

        {/* Logseq */}
        <button 
          onClick={() => onLaunchApp('logseq')}
          className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-xs border border-emerald-400/20"
        >
          <div className="w-5 h-5 bg-white rounded-xs flex items-center justify-center font-extrabold text-emerald-600 text-[10px]">
            L
          </div>
        </button>

      </div>

    </div>
  );
}
