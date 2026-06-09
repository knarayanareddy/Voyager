import { useState, useCallback, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Menu, Search, Plus, Maximize2, Minimize2, Camera,
         BookOpen, LayoutGrid, Star, CheckSquare, FileText, Settings, Mic, X } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { ActiveView } from '../types';
import S23UltraFrame from './S23UltraFrame';
import LogseqEditor from './LogseqEditor';
import GraphView from './GraphView';
import Flashcards from './Flashcards';
import AllPages from './AllPages';
import TodosView from './TodosView';
import SettingsView from './SettingsView';
import LeftSidebar from './LeftSidebar';
import SPenOverlay from './SPenOverlay';
import MediaStudio from './MediaStudio';

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { state, navigateTo } = useDatabase();
  const [query, setQuery] = useState('');

  const allBlocks = useMemo(() => {
    const list = [];
    const traverse = (blocks: any[], page: any) => {
      for (const b of blocks) {
        list.push({ pageId: page.id, pageName: page.name, blockId: b.id, content: b.content, isJournal: page.isJournal });
        if (b.children.length) traverse(b.children, page);
      }
    };
    Object.values(state.db).forEach(page => traverse(page.blocks, page));
    return list;
  }, [state.db]);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const lower = query.toLowerCase();
    const matches = [];
    for (let i = 0; i < allBlocks.length; i++) {
      if (allBlocks[i].content.toLowerCase().includes(lower)) {
        matches.push(allBlocks[i]);
        if (matches.length >= 15) break;
      }
    }
    return matches;
  }, [query, allBlocks]);

  return (
    <div className="absolute inset-0 z-40 bg-slate-950 flex flex-col">
      <div className="flex items-center gap-2 p-3 border-b border-slate-800">
        <Search size={16} className="text-slate-500 shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search pages and blocks..."
          className="flex-1 bg-transparent text-slate-200 text-sm placeholder-slate-600 outline-none"
        />
        <button onClick={onClose} className="text-slate-500 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-slate-800">Esc</button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {results.length > 0 ? (
          results.map((r, i) => (
            <button
              key={i}
              onClick={() => { navigateTo(r.pageId); onClose(); }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-800 mb-1"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-slate-500 text-[10px]">{r.isJournal ? '📅' : '📄'}</span>
                <span className="text-indigo-400 text-xs font-medium">{r.pageName}</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed truncate pl-4">{r.content}</p>
            </button>
          ))
        ) : query.length > 1 ? (
          <div className="text-center py-8 text-slate-600 text-sm">No results for "{query}"</div>
        ) : (
          <div className="text-center py-8 text-slate-700 text-xs">Start typing to search...</div>
        )}
      </div>
    </div>
  );
}

const NAV_ITEMS: { id: ActiveView; icon: React.ReactNode; label: string }[] = [
  { id: 'editor', icon: <BookOpen size={16} />, label: 'Journal' },
  { id: 'graph', icon: <LayoutGrid size={16} />, label: 'Graph' },
  { id: 'flashcards', icon: <Star size={16} />, label: 'Cards' },
  { id: 'todos', icon: <CheckSquare size={16} />, label: 'Tasks' },
  { id: 'allPages', icon: <FileText size={16} />, label: 'Pages' },
  { id: 'media', icon: <Camera size={16} />, label: 'Media' },
];

export default function LogseqApp() {
  const { state, dispatch, navigateTo } = useDatabase();
  const activeView = state.activeView;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSPen, setShowSPen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [desktopMode, setDesktopMode] = useState(false);
  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const newPageInputRef = useRef<HTMLInputElement>(null);

  const currentPage = state.db[state.currentPageId];

  const getPageTitle = () => {
    if (!currentPage) return 'Untitled';
    if (currentPage.isJournal) {
      try { return format(new Date(currentPage.name + 'T12:00:00'), 'MMM d'); }
      catch { return currentPage.name; }
    }
    return currentPage.name;
  };

  const handleNewPage = useCallback(() => {
    setShowNewPageModal(true);
  }, []);

  const handleCreatePage = useCallback(() => {
    if (!newPageName.trim()) return;
    dispatch({ type: 'CREATE_PAGE', name: newPageName.trim(), navigate: true });
    dispatch({ type: 'SET_ACTIVE_VIEW', view: 'editor' });
    setShowNewPageModal(false);
    setNewPageName('');
  }, [dispatch, newPageName]);

  const handleCancelNewPage = useCallback(() => {
    setShowNewPageModal(false);
    setNewPageName('');
  }, []);

  // Auto-focus the new page input when modal opens
  useEffect(() => {
    if (showNewPageModal) {
      // Small delay to let the animation start, then focus
      const timer = setTimeout(() => newPageInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [showNewPageModal]);

  const handleSetView = (v: ActiveView) => {
    dispatch({ type: 'SET_ACTIVE_VIEW', view: v });
    if (v === 'editor' && !state.db[state.currentPageId]) {
      navigateTo(state.currentPageId);
    }
  };

  const AppContent = (
    <div className="flex flex-col h-full w-full overflow-hidden relative" id="voyager-app">
      {/* Top Header Bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-900/95 backdrop-blur border-b border-slate-800 shrink-0 z-30">
        <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
          <Menu size={16} />
        </button>

        {/* Page title / view title */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {activeView === 'editor' && currentPage && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm">{currentPage.properties?.icon || (currentPage.isJournal ? '📅' : '📄')}</span>
              <span className="text-white text-sm font-semibold truncate">{getPageTitle()}</span>
            </div>
          )}
          {activeView === 'graph' && <span className="text-white text-sm font-semibold">🌐 Graph</span>}
          {activeView === 'flashcards' && <span className="text-white text-sm font-semibold">🃏 Cards</span>}
          {activeView === 'todos' && <span className="text-white text-sm font-semibold">✅ Tasks</span>}
          {activeView === 'allPages' && <span className="text-white text-sm font-semibold">📋 Pages</span>}
          {activeView === 'settings' && <span className="text-white text-sm font-semibold">⚙️ Settings</span>}
          {activeView === 'media' && <span className="text-white text-sm font-semibold">🎬 Media Studio</span>}
        </div>

        {/* Header actions */}
        <button onClick={() => setShowSearch(true)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
          <Search size={15} />
        </button>
        {activeView === 'media' ? (
          <button onClick={() => setShowSearch(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            <Mic size={15} />
          </button>
        ) : (
          <button onClick={handleNewPage} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition-colors">
            <Plus size={15} />
          </button>
        )}
        <button onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', view: 'settings' })} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
          <Settings size={13} />
        </button>
      </div>

      {/* Search overlay */}
      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="absolute inset-0 z-30 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 z-40 shadow-2xl">
            <LeftSidebar
              activeView={activeView}
              onSetView={handleSetView}
              onClose={() => setSidebarOpen(false)}
              onNewPage={handleNewPage}
            />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">
        {activeView === 'editor' && <LogseqEditor onLinkClick={(targetName, e) => {
          const targetId = targetName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          if (e.shiftKey) {
            dispatch({ type: 'OPEN_SIDEBAR', pageId: targetId });
          } else {
            navigateTo(targetId);
          }
        }} />}
        {activeView === 'graph' && <GraphView />}
        {activeView === 'flashcards' && <Flashcards />}
        {activeView === 'todos' && <TodosView />}
        {activeView === 'allPages' && <AllPages />}
        {activeView === 'settings' && <SettingsView />}
        {activeView === 'media' && <MediaStudio />}
      </div>

      {/* Right sidebar (split pane) */}
      {state.settings.rightSidebarOpen && state.sidebarPageId && (
        <div
          className="absolute inset-y-0 right-0 z-30 animate-slide-in-right flex flex-col"
          style={{ width: '45%', background: 'rgba(8,8,20,0.98)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/6 shrink-0">
            <span className="text-[11px] font-semibold text-slate-400 truncate">
              {state.db[state.sidebarPageId]?.name || 'Sidebar'}
            </span>
            <button
              onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <LogseqEditor pageId={state.sidebarPageId} onLinkClick={(targetName) => {
              const targetId = targetName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              dispatch({ type: 'OPEN_SIDEBAR', pageId: targetId });
            }} />
          </div>
        </div>
      )}

      {/* S-Pen overlay */}
      {showSPen && <SPenOverlay onClose={() => setShowSPen(false)} />}

      {/* New Page Modal (glassmorphic) */}
      {showNewPageModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ animation: 'modalFadeIn 0.2s ease-out' }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={handleCancelNewPage}
          />
          {/* Modal card */}
          <div
            className="relative z-10 w-[85%] max-w-sm bg-slate-800/90 border border-slate-600/50 rounded-2xl shadow-2xl p-5"
            style={{ animation: 'modalScaleIn 0.25s ease-out' }}
          >
            {/* Title */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Plus size={16} className="text-white" />
              </div>
              <h2 className="text-white text-sm font-bold tracking-wide">Create New Page</h2>
            </div>

            {/* Input */}
            <input
              ref={newPageInputRef}
              type="text"
              value={newPageName}
              onChange={e => setNewPageName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreatePage();
                if (e.key === 'Escape') handleCancelNewPage();
              }}
              placeholder="Page name..."
              className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-600/40 rounded-xl text-slate-200 text-sm placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={handleCancelNewPage}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-700/60 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePage}
                disabled={!newPageName.trim()}
                className="px-5 py-2 text-xs font-semibold text-white rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal animations */}
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* Bottom Navigation */}
      <div className="flex bg-slate-900/95 backdrop-blur border-t border-slate-800 shrink-0 z-20">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => handleSetView(item.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[9px] font-medium transition-colors ${
              activeView === item.id
                ? 'text-indigo-400'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${activeView === item.id ? 'bg-indigo-600/20' : ''}`}>
              {item.icon}
            </div>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (desktopMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
        <div className="flex items-center gap-3 px-6 py-3 bg-slate-900 border-b border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="text-white font-bold">Voyager — Logseq Mobile</span>
          <span className="text-slate-500 text-xs">Desktop View</span>
          <button onClick={() => setDesktopMode(false)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs hover:bg-slate-700">
            <Minimize2 size={12} /> Back to Phone
          </button>
        </div>
        <div className="flex-1 max-w-4xl mx-auto w-full">
          {AppContent}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-[#0d0d1f] to-slate-950 p-4 overflow-hidden">
      {/* Desktop toggle */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setDesktopMode(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs transition-colors"
        >
          <Maximize2 size={11} /> Web View (Full)
        </button>
      </div>

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-600/5 rounded-full blur-3xl" />
      </div>

      {/* Phone Frame */}
      <div className="relative z-10" style={{ transform: 'scale(var(--phone-scale, 1))' }}>
        <S23UltraFrame onSPenClick={() => setShowSPen(true)} onCameraClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', view: 'media' })}>
          {AppContent}
        </S23UltraFrame>
      </div>

      {/* Hint bar */}
      <div className="relative z-10 mt-4 flex items-center gap-4 text-slate-700 text-[10px]">
        <span>✏️ S-Pen slot (bottom-right)</span>
        <span>·</span>
        <span>🔋 Power button (right side)</span>
        <span>·</span>
        <span>🔊 Volume (left side)</span>
        <span>·</span>
        <span>🎨 Bezel picker (bottom-left dot)</span>
      </div>
    </div>
  );
}
