import { useDatabase } from '../context/DatabaseContext';
import { format } from 'date-fns';
import { Home, Search, Star, Calendar, FileText, Plus, Settings, BookOpen, Camera } from 'lucide-react';
import { ActiveView } from '../types';

interface Props {
  activeView: ActiveView;
  onSetView: (v: ActiveView) => void;
  onClose: () => void;
  onNewPage: () => void;
}

export default function LeftSidebar({ activeView, onSetView, onClose, onNewPage }: Props) {
  const { state, navigateTo } = useDatabase();
  const journals = Object.values(state.db).filter(p => p.isJournal).sort((a, b) => b.name.localeCompare(a.name)).slice(0, 7);
  const pages = Object.values(state.db).filter(p => !p.isJournal).sort((a, b) => a.name.localeCompare(b.name));

  const navItems: { id: ActiveView; icon: React.ReactNode; label: string }[] = [
    { id: 'editor', icon: <Home size={14} />, label: 'Journal' },
    { id: 'graph', icon: <BookOpen size={14} />, label: 'Graph' },
    { id: 'flashcards', icon: <Star size={14} />, label: 'Cards' },
    { id: 'todos', icon: <Search size={14} />, label: 'Tasks' },
    { id: 'allPages', icon: <FileText size={14} />, label: 'All Pages' },
    { id: 'media', icon: <Camera size={14} />, label: 'Media Studio' },
    { id: 'settings', icon: <Settings size={14} />, label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-y-auto" style={{ width: 240 }}>
      {/* App header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">V</span>
          </div>
          <div>
            <div className="text-white text-sm font-bold">Voyager</div>
            <div className="text-slate-500 text-[10px]">Logseq Mobile</div>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <div className="px-2 pt-2 space-y-0.5">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => { onSetView(item.id); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-colors ${
              activeView === item.id
                ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Favorites */}
      {state.favorites.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-1.5">Favorites</p>
          <div className="space-y-0.5">
            {state.favorites.slice(0, 5).map(pageId => {
              const p = state.db[pageId];
              if (!p) return null;
              return (
                <button
                  key={pageId}
                  onClick={() => { navigateTo(pageId); onClose(); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    state.currentPageId === pageId ? 'text-indigo-300 bg-indigo-600/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{p.properties?.icon || '⭐'}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Journals */}
      <div className="px-4 pt-4">
        <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-1.5">Journals</p>
        <div className="space-y-0.5">
          {journals.map(p => (
            <button
              key={p.id}
              onClick={() => { navigateTo(p.id); onSetView('editor'); onClose(); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                state.currentPageId === p.id ? 'text-indigo-300 bg-indigo-600/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar size={10} className="text-slate-600 shrink-0" />
              <span className="truncate">{(() => { try { return format(new Date(p.name + 'T12:00:00'), 'MMM d, yyyy'); } catch { return p.name; } })()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pages */}
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-slate-600 text-[10px] uppercase tracking-wider">Pages</p>
          <button onClick={onNewPage} className="text-slate-600 hover:text-indigo-400 transition-colors">
            <Plus size={12} />
          </button>
        </div>
        <div className="space-y-0.5">
          {pages.map(p => (
            <button
              key={p.id}
              onClick={() => { navigateTo(p.id); onSetView('editor'); onClose(); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                state.currentPageId === p.id ? 'text-indigo-300 bg-indigo-600/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{p.properties?.icon || '📄'}</span>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
