import { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Camera, Mic, Image as ImageIcon } from 'lucide-react';
import { CameraView } from './media/CameraView';
import { AudioRecorder } from './media/AudioRecorder';
import { GalleryView } from './media/GalleryView';

export { useCamera } from './media/useCamera';

export default function MediaStudio() {
  const { state, actions } = useDatabase();

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
        {activeTab === 'camera' && <CameraView screenOn={true} actions={actions} />}
        {activeTab === 'audio' && <AudioRecorder screenOn={true} actions={actions} />}
        {activeTab === 'gallery' && <GalleryView state={state} actions={actions} />}
      </div>
    </div>
  );
}
