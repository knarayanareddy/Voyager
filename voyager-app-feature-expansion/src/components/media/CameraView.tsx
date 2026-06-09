import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Trash2, RefreshCw, Check } from 'lucide-react';
import { useCamera } from './useCamera';

interface CameraViewProps {
  screenOn: boolean;
  actions: any;
}

export const CameraView: React.FC<CameraViewProps> = ({ screenOn, actions }) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
