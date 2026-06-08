import React, { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import LogseqEditor from './LogseqEditor';
import GraphView from './GraphView';
import Flashcards from './Flashcards';
import SearchView from './SearchView';
import SettingsView from './SettingsView';
import TodoView from './TodoView';
import Sidebar from './Sidebar';
import CameraView from './CameraView';
import SPenCanvas from './SPenCanvas';
import S23UltraFrame from './S23UltraFrame';
import { ActiveView } from '../types';
import {
  BookOpen, Network, Brain, Search, Settings, CheckSquare,
  Menu, X, Camera, PenLine, Plus, Star,
  FileText, Calendar, MoreHorizontal, Layers
} from 'lucide-react';
import { format } from 'date-fns';

// ─────────────────────────── NAV BAR ───────────────────────────

const NAV_ITEMS: { id: ActiveView; icon: React.ReactNode; label: string }[] = [
  { id: 'editor',     icon: <BookOpen size={18} />,    label: 'Notes' },
  { id: 'todos',      icon: <CheckSquare size={18} />, label: 'Tasks' },
  { id: 'graph',      icon: <Network size={18} />,     label: 'Graph' },
  { id: 'flashcards', icon: <Brain size={18} />,       label: 'Cards' },
  { id: 'search',     icon: <Search size={18} />,      label: 'Search' },
];

// ─────────────────────────── RIGHT SIDEBAR (LOGSEQ SPLIT PANE) ───────────────────────────

function RightSidebar() {
  const { state, dispatch } = useDatabase();
  return (
    <div className="w-72 border-l border-[var(--color-border)] flex flex-col bg-[var(--color-bg)] shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Right Sidebar</span>
        <button onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
          <X size={14} />
        </button>
      </div>
      {state.sidebarPageId && (
        <LogseqEditor pageId={state.sidebarPageId} compact={true} />
      )}
    </div>
  );
}

// ─────────────────────────── PAGE HEADER ───────────────────────────

function PageHeader({ onMenuToggle, onNewPage, onCameraClick }: { onMenuToggle: () => void; onNewPage: () => void; onCameraClick: () => void }) {
  const { state, dispatch } = useDatabase();
  const page = state.db[state.currentPageId];
  const [showQuickActions, setShowQuickActions] = useState(false);

  const isFav = state.favorites.includes(state.currentPageId);

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
      <button onClick={onMenuToggle} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]">
        <Menu size={18} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{page?.properties?.icon || (page?.isJournal ? '📅' : '📄')}</span>
          <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {page?.isJournal
              ? (() => { try { return format(new Date(page.name + 'T12:00:00'), 'MMM d, yyyy'); } catch { return page.name; } })()
              : page?.name || 'Untitled'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onCameraClick} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]" title="Camera">
          <Camera size={16} />
        </button>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_FAVORITE', pageId: state.currentPageId })}
          className={`p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] ${isFav ? 'text-yellow-400' : 'text-[var(--color-text-tertiary)]'}`}
          title={isFav ? 'Unfavorite' : 'Favorite'}
        >
          <Star size={16} fill={isFav ? 'currentColor' : 'none'} />
        </button>
        <div className="relative">
          <button onClick={() => setShowQuickActions(!showQuickActions)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]">
            <MoreHorizontal size={16} />
          </button>
          {showQuickActions && (
            <div className="absolute right-0 top-8 z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl w-48 py-1">
              {[
                { icon: <Plus size={13}/>, label: 'New Page', action: onNewPage },
                { icon: <Calendar size={13}/>, label: "Today's Journal", action: () => { dispatch({ type: 'ENSURE_TODAY_JOURNAL' } as any); } },
                { icon: <FileText size={13}/>, label: 'All Pages', action: () => { dispatch({ type: 'UPDATE_SETTINGS', settings: { sidebarOpen: true } }); } },
                { icon: <PenLine size={13}/>, label: 'Rename Page', action: () => { const n = prompt('New name:', page?.name); if (n && page) dispatch({ type: 'RENAME_PAGE', pageId: page.id, newName: n }); } },
                { icon: <Camera size={13}/>, label: 'Add Photo', action: onCameraClick },
                { icon: <Layers size={13}/>, label: 'Open in Sidebar', action: () => dispatch({ type: 'OPEN_SIDEBAR', pageId: state.currentPageId }) },
              ].map(item => (
                <button key={item.label} onClick={() => { item.action(); setShowQuickActions(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]">
                  <span className="text-[var(--color-text-tertiary)]">{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── MAIN LOGSEQ APP ───────────────────────────

export default function LogseqApp() {
  const { state, dispatch, navigateTo } = useDatabase();
  const { settings } = state;
  const [activeView, setActiveView] = useState<ActiveView>('editor');
  const [showCamera, setShowCamera] = useState(false);
  const [showSPen, setShowSPen] = useState(false);
  const [showDesktopMode, setShowDesktopMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    const isDark = settings.theme === 'dark' ||
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
    }
    root.style.setProperty('--color-accent', settings.accentColor);
    root.style.fontSize = settings.fontSize + 'px';
    root.style.fontFamily = settings.fontFamily;
  }, [settings.theme, settings.accentColor, settings.fontSize, settings.fontFamily]);

  const handleNewPage = () => {
    const name = prompt('New page name:');
    if (name?.trim()) {
      dispatch({ type: 'CREATE_PAGE', name: name.trim(), navigate: true });
      setActiveView('editor');
    }
  };

  const handleNavigate = (pageId: string) => {
    navigateTo(pageId);
    setActiveView('editor');
  };

  const AppContent = (
    <div className="flex flex-col h-full bg-[var(--color-bg)]" style={{ fontFamily: settings.fontFamily, fontSize: settings.fontSize }}>
      {/* Left Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <Sidebar onNavigate={handleNavigate} />
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewPage={handleNewPage}
        onCameraClick={() => setShowCamera(true)}
      />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeView === 'editor' && <LogseqEditor pageId={state.currentPageId} />}
          {activeView === 'graph' && <GraphView />}
          {activeView === 'flashcards' && <Flashcards />}
          {activeView === 'search' && <SearchView onClose={() => setActiveView('editor')} />}
          {activeView === 'settings' && <SettingsView />}
          {activeView === 'todos' && <TodoView />}
        </div>

        {/* Right sidebar (split pane) */}
        {settings.rightSidebarOpen && state.sidebarPageId && <RightSidebar />}
      </div>

      {/* Bottom nav bar */}
      <div
        className="flex items-center border-t border-[var(--color-border)] bg-[var(--color-surface)] shrink-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
              activeView === item.id
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {item.icon}
            <span className="text-[9px] font-medium">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setActiveView('settings')}
          className={`flex-none flex flex-col items-center py-2 px-3 gap-0.5 transition-colors ${activeView === 'settings' ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)]'}`}
        >
          <Settings size={18} />
          <span className="text-[9px] font-medium">Settings</span>
        </button>
      </div>

      {/* Camera overlay */}
      {showCamera && <CameraView onClose={() => setShowCamera(false)} />}

      {/* S-Pen drawing overlay */}
      {showSPen && <SPenCanvas onClose={() => setShowSPen(false)} />}
    </div>
  );

  if (showDesktopMode) {
    return (
      <div className="w-full h-screen flex flex-col bg-[var(--color-bg)]">
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
          <span className="font-bold text-[var(--color-text-primary)]">📝 Logseq Desktop View</span>
          <button onClick={() => setShowDesktopMode(false)} className="text-sm text-[var(--color-accent)]">
            Switch to Mobile
          </button>
        </div>
        <div className="flex-1 overflow-hidden">{AppContent}</div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[var(--color-bg-outer)] flex flex-col items-center justify-center py-8">
      {/* Desktop toggle */}
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={() => setShowDesktopMode(true)}
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors"
        >
          🖥️ Web View (Full)
        </button>
        <button
          onClick={() => setShowSPen(true)}
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors"
        >
          ✏️ S-Pen
        </button>
        <button
          onClick={() => setShowCamera(true)}
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors"
        >
          📸 Camera
        </button>
      </div>

      {/* S23 Ultra frame */}
      <div style={{ height: 880 }}>
        <S23UltraFrame onSPenClick={() => setShowSPen(true)} onCameraClick={() => setShowCamera(true)}>
          {AppContent}
        </S23UltraFrame>
      </div>

      {/* Camera + S-Pen overlays at root level so they cover the phone frame too */}
      {showCamera && (
        <div className="fixed inset-0 z-[100]">
          <CameraView onClose={() => setShowCamera(false)} />
        </div>
      )}
      {showSPen && (
        <div className="fixed inset-0 z-[100]">
          <SPenCanvas onClose={() => setShowSPen(false)} />
        </div>
      )}
    </div>
  );
}
