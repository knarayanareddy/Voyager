import React from 'react';
import { Image as ImageIcon, Trash2, FileAudio } from 'lucide-react';

interface GalleryViewProps {
  state: any;
  actions: any;
}

export const GalleryView: React.FC<GalleryViewProps> = ({ state, actions }) => {
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
