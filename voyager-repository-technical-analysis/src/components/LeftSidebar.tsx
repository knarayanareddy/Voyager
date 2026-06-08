import { useDatabase } from '../context/DatabaseContext';
import { ActiveView } from '../types';
import { format } from 'date-fns';
import { Plus, Star, Calendar, FileText, Settings, BarChart2, CreditCard, CheckSquare, Camera } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSetView: (v: ActiveView) => void;
  onNewPage: () => void;
}

const NAV_ITEMS: { id: ActiveView; icon: React.FC<{ size?: number; className?: string }>; label: string }[] = [
  { id: 'editor', icon: ({ size, className }) => <Calendar size={size} className={className} />, label: 'Journal' },
  { id: 'graph', icon: ({ size, className }) => <BarChart2 size={size} className={className} />, label: 'Graph' },
  { id: 'flashcards', icon: ({ size, className }) => <CreditCard size={size} className={className} />, label: 'Flashcards' },
  { id: 'todos', icon: ({ size, className }) => <CheckSquare size={size} className={className} />, label: 'Tasks' },
  { id: 'allPages', icon: ({ size, className }) => <FileText size={size} className={className} />, label: 'All Pages' },
  { id: 'media', icon: ({ size, className }) => <Camera size={size} className={className} />, label: 'Media Studio' },
  { id: 'settings', icon: ({ size, className }) => <Settings size={size} className={className} />, label: 'Settings' },
];

export default function LeftSidebar({ onClose, onSetView, onNewPage }: Props) {
  const { state, navigateTo, dispatch } = useDatabase();

  const journals = Object.values(state.db)
    .filter(p => p.isJournal)
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(0, 5);

  const pages = Object.values(state.db)
    .filter(p => !p.isJournal)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleNav = (view: ActiveView) => {
    onSetView(view);
    onClose();
  };

  const handleNavigate = (pageId: string) => {
    navigateTo(pageId);
    onClose();
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 border-r border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800 flex-shrink-0">
        <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-600/30">
          V
        </div>
        <div>
          <p className="text-white font-bold text-base leading-tight">Voyager</p>
          <p className="text-indigo-400 text-[10px] font-medium">Logseq Mobile</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Navigation */}
        <div className="px-2 mb-3">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left hover:bg-slate-800 text-slate-300 hover:text-white"
            >
              <item.icon size={16} className="text-slate-400" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Favorites */}
        {state.favorites.length > 0 && (
          <div className="px-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Star size={11} className="text-amber-400" />
              <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">Favorites</span>
            </div>
            {state.favorites.slice(0, 5).map(pageId => {
              const p = state.db[pageId];
              if (!p) return null;
              return (
                <button
                  key={pageId}
                  onClick={() => handleNavigate(pageId)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left hover:bg-slate-800 transition-colors"
                >
                  <span className="text-sm">{p.properties?.icon || '⭐'}</span>
                  <span className="text-slate-300 text-xs truncate">{p.name}</span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      dispatch({ type: 'TOGGLE_FAVORITE', pageId });
                    }}
                    className="ml-auto text-amber-400 hover:text-amber-300 opacity-60 hover:opacity-100"
                  >
                    <Star size={10} fill="currentColor" />
                  </button>
                </button>
              );
            })}
          </div>
        )}

        {/* Recent Journals */}
        <div className="px-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={11} className="text-slate-500" />
            <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">Journals</span>
          </div>
          {journals.map(p => {
            let label = p.name;
            try {
              label = format(new Date(p.name + 'T12:00:00'), 'MMM d, yyyy');
            } catch { /* keep raw */ }
            return (
              <button
                key={p.id}
                onClick={() => handleNavigate(p.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left transition-colors ${
                  state.currentPageId === p.id ? 'bg-indigo-900/40 text-indigo-300' : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <span className="text-sm">📅</span>
                <span className="text-xs truncate">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Pages */}
        <div className="px-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText size={11} className="text-slate-500" />
              <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">Pages</span>
            </div>
            <button
              onClick={() => { onNewPage(); onClose(); }}
              className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-slate-500 hover:text-indigo-400 transition-colors"
            >
              <Plus size={11} />
            </button>
          </div>
          {pages.map(p => (
            <button
              key={p.id}
              onClick={() => handleNavigate(p.id)}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left transition-colors group ${
                state.currentPageId === p.id ? 'bg-indigo-900/40 text-indigo-300' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <span className="text-sm">{p.properties?.icon || '📄'}</span>
              <span className="text-xs truncate flex-1">{p.name}</span>
              <button
                onClick={e => {
                  e.stopPropagation();
                  dispatch({ type: 'TOGGLE_FAVORITE', pageId: p.id });
                }}
                className={`opacity-0 group-hover:opacity-100 transition-opacity ${state.favorites.includes(p.id) ? 'text-amber-400 opacity-100' : 'text-slate-600 hover:text-amber-400'}`}
              >
                <Star size={10} fill={state.favorites.includes(p.id) ? 'currentColor' : 'none'} />
              </button>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
