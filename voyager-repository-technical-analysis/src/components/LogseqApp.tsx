import { useState, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { ActiveView } from '../types';
import { format } from 'date-fns';
import S23UltraFrame from './S23UltraFrame';
import LogseqEditor from './LogseqEditor';
import GraphView from './GraphView';
import Flashcards from './Flashcards';
import TodosView from './TodosView';
import AllPagesView from './AllPagesView';
import SettingsView from './SettingsView';
import MediaStudio from './MediaStudio';
import LeftSidebar from './LeftSidebar';
import SearchOverlay from './SearchOverlay';
import SPenOverlay from './SPenOverlay';
import {
  Calendar, BarChart2, CreditCard, CheckSquare, FileText, Camera,
  Menu, Search, X, Monitor,
} from 'lucide-react';

// ─── Bottom nav config ────────────────────────────────────────────────────────

const NAV_ITEMS: {
  id: ActiveView;
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
}[] = [
  { id: 'editor', icon: ({ size, className }) => <Calendar size={size} className={className} />, label: 'Journal' },
  { id: 'graph', icon: ({ size, className }) => <BarChart2 size={size} className={className} />, label: 'Graph' },
  { id: 'flashcards', icon: ({ size, className }) => <CreditCard size={size} className={className} />, label: 'Cards' },
  { id: 'todos', icon: ({ size, className }) => <CheckSquare size={size} className={className} />, label: 'Tasks' },
  { id: 'allPages', icon: ({ size, className }) => <FileText size={size} className={className} />, label: 'Pages' },
  { id: 'media', icon: ({ size, className }) => <Camera size={size} className={className} />, label: 'Media' },
];

// ─── New page modal ───────────────────────────────────────────────────────────

function NewPageModal({ onConfirm, onCancel }: { onConfirm: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-3xl p-6 animate-slide-in-up shadow-2xl">
        <h3 className="text-white font-semibold text-base mb-4">✨ New Page</h3>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && name.trim()) onConfirm(name.trim());
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Page name…"
          className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-colors placeholder-slate-600"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onCancel} className="flex-1 py-3 rounded-2xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-indigo-500 transition-colors"
          >
            Create Page
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main app content ─────────────────────────────────────────────────────────

function AppContent() {
  const { state, dispatch, navigateTo } = useDatabase();
  const [activeView, setActiveView] = useState<ActiveView>('editor');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSPen, setShowSPen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);

  const currentPage = state.db[state.currentPageId];

  const getPageTitle = () => {
    if (!currentPage) return 'Untitled';
    if (currentPage.isJournal) {
      try { return format(new Date(currentPage.name + 'T12:00:00'), 'MMM d'); }
      catch { return currentPage.name; }
    }
    return currentPage.name;
  };

  const handleNewPage = useCallback((name: string) => {
    dispatch({ type: 'CREATE_PAGE', name, navigate: true });
    setActiveView('editor');
    setShowNewPage(false);
  }, [dispatch]);

  const handleSetView = useCallback((v: ActiveView) => {
    setActiveView(v);
    dispatch({ type: 'SET_ACTIVE_VIEW', view: v });
    if (v === 'editor' && !state.db[state.currentPageId]) {
      navigateTo(state.currentPageId);
    }
  }, [dispatch, navigateTo, state.db, state.currentPageId]);

  const handleLinkClick = useCallback((target: string, e: React.MouseEvent) => {
    const targetId = target.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (e.shiftKey) {
      dispatch({ type: 'OPEN_SIDEBAR', pageId: targetId });
    } else {
      navigateTo(targetId);
      setActiveView('editor');
    }
  }, [dispatch, navigateTo]);

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Top Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/80 flex-shrink-0 bg-slate-950/95 backdrop-blur-sm z-10">
        {/* Menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
        >
          <Menu size={18} />
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {activeView === 'editor' && currentPage && (
            <>
              <span className="text-base">{currentPage.properties?.icon || (currentPage.isJournal ? '📅' : '📄')}</span>
              <span className="text-white text-sm font-semibold truncate">{getPageTitle()}</span>
            </>
          )}
          {activeView === 'graph' && <><span>🌐</span><span className="text-white text-sm font-semibold">Graph</span></>}
          {activeView === 'flashcards' && <><span>🃏</span><span className="text-white text-sm font-semibold">Flashcards</span></>}
          {activeView === 'todos' && <><span>✅</span><span className="text-white text-sm font-semibold">Tasks</span></>}
          {activeView === 'allPages' && <><span>📋</span><span className="text-white text-sm font-semibold">All Pages</span></>}
          {activeView === 'settings' && <><span>⚙️</span><span className="text-white text-sm font-semibold">Settings</span></>}
          {activeView === 'media' && <><span>🎬</span><span className="text-white text-sm font-semibold">Media Studio</span></>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowSearch(true)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Search size={16} />
          </button>
          {activeView === 'editor' && (
            <button
              onClick={() => setShowNewPage(true)}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-base">+</span>
            </button>
          )}
          {state.settings.rightSidebarOpen && (
            <button
              onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search overlay */}
      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}

      {/* Left sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 z-40 w-72 animate-slide-in-left">
            <LeftSidebar
              onClose={() => setSidebarOpen(false)}
              onSetView={handleSetView}
              onNewPage={() => setShowNewPage(true)}
            />
          </div>
        </>
      )}

      {/* Main content (split or full) */}
      <div className="flex-1 overflow-hidden flex">
        {/* Primary pane */}
        <div className={`flex-1 overflow-hidden ${state.settings.rightSidebarOpen ? 'border-r border-slate-800' : ''}`}>
          {activeView === 'editor' && <LogseqEditor onLinkClick={handleLinkClick} />}
          {activeView === 'graph' && <GraphView />}
          {activeView === 'flashcards' && <Flashcards />}
          {activeView === 'todos' && <TodosView />}
          {activeView === 'allPages' && <AllPagesView />}
          {activeView === 'settings' && <SettingsView />}
          {activeView === 'media' && <MediaStudio />}
        </div>

        {/* Right sidebar (split pane) */}
        {state.settings.rightSidebarOpen && state.sidebarPageId && (
          <div className="w-48 flex flex-col overflow-hidden animate-slide-in-right">
            <div className="flex items-center gap-1 px-2 py-2 border-b border-slate-800 bg-slate-900/80 flex-shrink-0">
              <span className="text-xs text-slate-400 truncate flex-1">
                {state.db[state.sidebarPageId]?.name || 'Sidebar'}
              </span>
              <button
                onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
                className="w-5 h-5 rounded-md flex items-center justify-center text-slate-600 hover:text-slate-300 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <LogseqEditor
                pageId={state.sidebarPageId}
                onLinkClick={(target, e) => {
                  const targetId = target.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                  dispatch({ type: 'OPEN_SIDEBAR', pageId: targetId });
                  void e;
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* S-Pen overlay */}
      {showSPen && <SPenOverlay onClose={() => setShowSPen(false)} />}

      {/* Bottom navigation */}
      <div className="flex-shrink-0 flex items-center border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-sm pb-safe">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => handleSetView(item.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
              activeView === item.id ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            <item.icon size={18} />
            <span className="text-[9px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {/* New page modal */}
      {showNewPage && (
        <NewPageModal onConfirm={handleNewPage} onCancel={() => setShowNewPage(false)} />
      )}
    </div>
  );
}

// ─── Desktop view ─────────────────────────────────────────────────────────────

function DesktopView({ onToggle }: { onToggle: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900">
        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">V</div>
        <span className="text-white font-bold">Voyager — Desktop</span>
        <button onClick={onToggle} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors">
          <Monitor size={12} />
          Phone View
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <AppContent />
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function LogseqApp() {
  const [desktopMode, setDesktopMode] = useState(false);
  const [showSPen, setShowSPen] = useState(false);

  if (desktopMode) {
    return <DesktopView onToggle={() => setDesktopMode(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center overflow-auto py-8 px-4">
      {/* Desktop mode toggle */}
      <button
        onClick={() => setDesktopMode(true)}
        className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded-lg text-xs backdrop-blur border border-slate-700 transition-colors shadow"
      >
        <Monitor size={12} />
        Desktop View
      </button>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
      </div>

      {/* Phone frame */}
      <S23UltraFrame onSPenClick={() => setShowSPen(s => !s)}>
        <AppContent />
        {showSPen && <SPenOverlay onClose={() => setShowSPen(false)} />}
      </S23UltraFrame>

      {/* Hint bar */}
      <div className="mt-6 flex items-center gap-4 text-slate-600 text-[11px] flex-wrap justify-center">
        <span>✏️ S-Pen (bottom-right of screen)</span>
        <span>·</span>
        <span>🔋 Power (right side)</span>
        <span>·</span>
        <span>🔊 Volume (left side)</span>
        <span>·</span>
        <span>🎨 Bezel (bottom dot)</span>
      </div>
    </div>
  );
}
