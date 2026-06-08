import { useState, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import S23UltraFrame from './S23UltraFrame';
import LogseqEditor from './LogseqEditor';
import GraphView from './GraphView';
import Flashcards from './Flashcards';
import SearchView from './SearchView';
import Settings from './Settings';
import TodoView from './TodoView';
import AllPages from './AllPages';
import SPenOverlay from './SPenOverlay';
import { ActiveView } from '../types';
import {
  BookOpen, Network, CreditCard, Search, Settings2,
  CheckSquare, Layout, FileText, Star, Calendar,
  Plus, X, Menu, AlignLeft, Edit3,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Sidebar ──────────────────────────────────────────────────────────────────
interface SidebarProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  onClose: () => void;
  onNewPage: () => void;
}

function LeftSidebar({ activeView, onNavigate, onClose, onNewPage }: SidebarProps) {
  const { state, navigateTo, getJournalPages, getAllPages } = useDatabase();
  const journals = getJournalPages().slice(0, 5);
  const allPages = getAllPages().filter(p => !p.isJournal).slice(0, 8);

  const navItems = [
    { id: 'editor', icon: <AlignLeft size={14} />, label: 'Editor' },
    { id: 'graph', icon: <Network size={14} />, label: 'Graph' },
    { id: 'flashcards', icon: <CreditCard size={14} />, label: 'Cards' },
    { id: 'todos', icon: <CheckSquare size={14} />, label: 'Tasks' },
    { id: 'allPages', icon: <Layout size={14} />, label: 'Pages' },
    { id: 'settings', icon: <Settings2 size={14} />, label: 'Settings' },
  ];

  return (
    <div
      className="w-64 h-full flex flex-col"
      style={{
        background: 'rgba(8,8,20,0.98)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            🚀
          </div>
          <span className="text-xs font-bold text-slate-200">Voyager</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Navigation */}
        <div className="px-2 mb-3">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all mb-0.5 ${
                activeView === item.id
                  ? 'text-indigo-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/4'
              }`}
              style={activeView === item.id ? { background: 'rgba(99,102,241,0.15)' } : {}}
              onClick={() => { onNavigate(item.id as ActiveView); onClose(); }}
            >
              <span style={{ color: activeView === item.id ? '#818cf8' : undefined }}>{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="h-px bg-white/6 mx-3 mb-3" />

        {/* Favorites */}
        {state.favorites.length > 0 && (
          <div className="px-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
              <Star size={11} className="text-amber-400" fill="#f59e0b" />
              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Favorites</span>
            </div>
            {state.favorites.slice(0, 5).map(pageId => {
              const page = state.db[pageId];
              if (!page) return null;
              return (
                <button
                  key={pageId}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/4 transition-colors text-left group"
                  onClick={() => { navigateTo(pageId); onNavigate('editor'); onClose(); }}
                >
                  <span className="text-xs shrink-0">{page.properties?.icon || (page.isJournal ? '📅' : '📄')}</span>
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors truncate">
                    {page.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Recent journals */}
        <div className="px-3 mb-3">
          <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
            <Calendar size={11} className="text-emerald-500" />
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Journals</span>
          </div>
          {journals.map(page => (
            <button
              key={page.id}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/4 transition-colors text-left group"
              onClick={() => { navigateTo(page.id); onNavigate('editor'); onClose(); }}
            >
              <span className="text-xs shrink-0">📅</span>
              <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors truncate">
                {(() => { try { return format(new Date(page.name + 'T12:00:00'), 'MMM d, yyyy'); } catch { return page.name; } })()}
              </span>
              {state.currentPageId === page.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Pages */}
        <div className="px-3 mb-3">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <div className="flex items-center gap-1.5">
              <FileText size={11} className="text-slate-500" />
              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Pages</span>
            </div>
            <button
              onClick={onNewPage}
              className="text-slate-600 hover:text-indigo-400 transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
          {allPages.map(page => (
            <button
              key={page.id}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/4 transition-colors text-left group"
              onClick={() => { navigateTo(page.id); onNavigate('editor'); onClose(); }}
            >
              <span className="text-xs shrink-0">{page.properties?.icon || '📄'}</span>
              <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors truncate">
                {page.name}
              </span>
              {state.currentPageId === page.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-slate-600">
            {Object.keys(state.db).length} pages · Local-first
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main LogseqApp ───────────────────────────────────────────────────────────
export default function LogseqApp() {
  const { state, dispatch } = useDatabase();
  const [activeView, setActiveView] = useState<ActiveView>('editor');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSPen, setShowSPen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDesktopMode, setShowDesktopMode] = useState(false);
  const { settings } = state;

  const handleNewPage = useCallback(() => {
    const name = prompt('New page name:');
    if (name?.trim()) {
      dispatch({ type: 'CREATE_PAGE', name: name.trim(), navigate: true });
      setActiveView('editor');
    }
  }, [dispatch]);

  const currentPage = state.db[state.currentPageId];

  const getPageDisplayName = () => {
    if (!currentPage) return 'Untitled';
    if (currentPage.isJournal) {
      try { return format(new Date(currentPage.name + 'T12:00:00'), 'MMM d'); }
      catch { return currentPage.name; }
    }
    return currentPage.name;
  };

  const NAV_ITEMS = [
    { id: 'editor' as ActiveView, icon: <BookOpen size={16} />, label: 'Journal' },
    { id: 'graph' as ActiveView, icon: <Network size={16} />, label: 'Graph' },
    { id: 'flashcards' as ActiveView, icon: <CreditCard size={16} />, label: 'Cards' },
    { id: 'todos' as ActiveView, icon: <CheckSquare size={16} />, label: 'Tasks' },
    { id: 'allPages' as ActiveView, icon: <Layout size={16} />, label: 'Pages' },
  ];

  // ─── App content (shared between phone and desktop) ───────────────────────
  const AppContent = (
    <div className="w-full h-full flex flex-col relative">
      {/* Top header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{
          background: 'rgba(8,8,20,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors text-slate-400"
          >
            <Menu size={14} />
          </button>

          {activeView === 'editor' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">
                {currentPage?.properties?.icon || (currentPage?.isJournal ? '📅' : '📄')}
              </span>
              <span className="text-xs font-semibold text-slate-300 max-w-[120px] truncate">
                {getPageDisplayName()}
              </span>
            </div>
          )}
          {activeView !== 'editor' && (
            <span className="text-xs font-semibold text-slate-300">
              {activeView === 'graph' ? '🌐 Graph' :
               activeView === 'flashcards' ? '🃏 Cards' :
               activeView === 'todos' ? '✅ Tasks' :
               activeView === 'allPages' ? '📋 Pages' :
               activeView === 'settings' ? '⚙️ Settings' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors text-slate-400"
          >
            <Search size={13} />
          </button>
          {activeView === 'editor' && (
            <button
              onClick={handleNewPage}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors text-slate-400"
            >
              <Edit3 size={13} />
            </button>
          )}
          <button
            onClick={() => dispatch({ type: 'ENSURE_TODAY_JOURNAL' } as any)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors text-slate-400"
            title="Today's journal"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Search overlay */}
      {showSearch && (
        <div className="absolute inset-0 z-30" style={{ background: 'rgba(8,8,20,0.98)', backdropFilter: 'blur(24px)' }}>
          <SearchView onClose={() => setShowSearch(false)} />
        </div>
      )}

      {/* Left Sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="absolute inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-50 animate-slide-in-left" style={{ width: 240 }}>
            <LeftSidebar
              activeView={activeView}
              onNavigate={setActiveView}
              onClose={() => setSidebarOpen(false)}
              onNewPage={handleNewPage}
            />
          </div>
        </>
      )}

      {/* Right sidebar (split pane) */}
      {settings.rightSidebarOpen && state.sidebarPageId && (
        <div
          className="absolute inset-y-0 right-0 z-30 animate-slide-in-right"
          style={{ width: '45%', background: 'rgba(8,8,20,0.98)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/6">
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
            <LogseqEditor />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'editor' && <LogseqEditor />}
        {activeView === 'graph' && <GraphView />}
        {activeView === 'flashcards' && <Flashcards />}
        {activeView === 'search' && <SearchView onClose={() => setActiveView('editor')} />}
        {activeView === 'settings' && <Settings />}
        {activeView === 'todos' && <TodoView />}
        {activeView === 'allPages' && <AllPages />}
      </div>

      {/* S-Pen overlay */}
      {showSPen && <SPenOverlay onClose={() => setShowSPen(false)} />}

      {/* Bottom nav */}
      <div
        className="flex items-center shrink-0"
        style={{
          background: 'rgba(8,8,20,0.95)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-all ${
              activeView === item.id ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            <div
              className={`transition-transform ${activeView === item.id ? 'scale-110' : 'scale-100'}`}
            >
              {item.icon}
            </div>
            <span className="text-[9px] font-semibold tracking-wide">{item.label}</span>
            {activeView === item.id && (
              <div className="w-1 h-1 rounded-full bg-indigo-400" />
            )}
          </button>
        ))}
        <button
          onClick={() => setActiveView('settings')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-all ${
            activeView === 'settings' ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'
          }`}
        >
          <Settings2 size={16} className={`transition-transform ${activeView === 'settings' ? 'scale-110' : 'scale-100'}`} />
          <span className="text-[9px] font-semibold tracking-wide">Settings</span>
          {activeView === 'settings' && <div className="w-1 h-1 rounded-full bg-indigo-400" />}
        </button>
      </div>
    </div>
  );

  if (showDesktopMode) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#080812' }}>
        <div
          className="flex items-center justify-between px-6 py-3 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(8,8,20,0.9)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              🚀
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200">Voyager</div>
              <div className="text-[10px] text-slate-500">Logseq Mobile — Desktop View</div>
            </div>
          </div>
          <button
            onClick={() => setShowDesktopMode(false)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            📱 Phone View
          </button>
        </div>
        <div className="flex-1 max-w-3xl mx-auto w-full py-6 px-4">
          {AppContent}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative"
      style={{
        background: 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 50%), #080812',
        minHeight: '100vh',
      }}
    >
      {/* Desktop toggle */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setShowDesktopMode(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium text-slate-500 hover:text-slate-300 transition-all"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
          }}
        >
          🖥️ Web View
        </button>
      </div>

      {/* Phone frame */}
      <div style={{ transform: 'scale(0.92)', transformOrigin: 'center center' }}>
        <S23UltraFrame
          onSPenClick={() => setShowSPen(true)}
          onCameraClick={() => {}}
        >
          {AppContent}
        </S23UltraFrame>
      </div>

      {/* Floating S-Pen tip */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <p className="text-[10px] text-slate-700">
          ✏️ Click S-Pen slot · 📱 Physical buttons work · ⌨️ Full keyboard shortcuts
        </p>
      </div>
    </div>
  );
}
