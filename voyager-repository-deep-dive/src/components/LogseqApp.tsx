import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { S23UltraFrame, BEZEL_COLORS } from './S23UltraFrame';
import { LogseqEditor } from './LogseqEditor';
import { GraphView } from './GraphView';
import { Flashcards } from './Flashcards';
import { MediaStudio } from './MediaStudio';
import { SPenOverlay } from './SPenOverlay';
import { Block, Page } from '../types';
import {
  Menu,
  BookOpen,
  GitMerge,
  Award,
  CheckSquare,
  FileText,
  Settings as SettingsIcon,
  Plus,
  Star,
  X,
  FileCode,
  PenTool,
  Info,
  Database,
  Search,
  Square
} from 'lucide-react';

export const LogseqApp: React.FC = () => {
  const { state, actions } = useDatabase();
  const { activeView, currentPageId, sidebarPageId, pages, favorites, settings } = state;

  // UI state
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Re-calculate statistics for the desktop dashboard
  const stats = React.useMemo(() => {
    const pageList = Object.values(pages);
    let totalBlocks = 0;
    let cardCount = 0;
    let todoCount = 0;

    const countBlocks = (block: any) => {
      totalBlocks++;
      if (block.content.includes('#card')) cardCount++;
      if (block.taskStatus) todoCount++;
      block.children.forEach(countBlocks);
    };

    pageList.forEach(p => {
      p.blocks.forEach(countBlocks);
    });

    return {
      pages: pageList.filter(p => !p.isJournal).length,
      journals: pageList.filter(p => p.isJournal).length,
      blocks: totalBlocks,
      cards: cardCount,
      todos: todoCount,
      media: state.mediaAttachments.length,
      recordings: state.audioNotes.length
    };
  }, [pages, state.mediaAttachments, state.audioNotes]);

  // Handle page creation from modal sheet
  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPageName.trim();
    if (!name) return;

    const newPageId = await actions.createPage(name, false);
    setNewPageName('');
    setIsCreateModalOpen(false);
    actions.setActiveView('editor');
    actions.navigateToPage(newPageId);
  };

  // Filtered pages for search
  const filteredPages = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    return Object.values(pages).filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, pages]);

  // Main View Switcher Renderer
  const renderActiveView = () => {
    switch (activeView) {
      case 'editor':
        return (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Pane (Main Editor) */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-[200px]">
              {currentPageId ? (
                <LogseqEditor pageId={currentPageId} />
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 text-neutral-500">
                  <p className="text-xs font-semibold">Select or create a page to begin editing.</p>
                </div>
              )}
            </div>

            {/* Right Pane (Split-Pane Sidebar Editor) */}
            {settings.rightSidebarOpen && sidebarPageId && (
              <div className="w-[180px] border-l border-neutral-800 bg-neutral-900 flex flex-col overflow-hidden relative animate-in slide-in-from-right duration-300 flex-shrink-0">
                {/* Sidebar Header */}
                <div className="h-9 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-3 text-[10px] text-neutral-400 font-bold select-none">
                  <span className="truncate">Right Sidebar</span>
                  <button
                    onClick={() => actions.closeSidebar()}
                    className="p-1 rounded hover:bg-neutral-850 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {/* Secondary Editor */}
                <div className="flex-1 overflow-y-auto">
                  <LogseqEditor pageId={sidebarPageId} />
                </div>
              </div>
            )}
          </div>
        );
      case 'graph':
        return <GraphView />;
      case 'flashcards':
        return <Flashcards />;
      case 'todos':
        return <GlobalTodosView state={state} actions={actions} />;
      case 'pages':
        return <PagesListView state={state} actions={actions} openCreateModal={() => setIsCreateModalOpen(true)} />;
      case 'media':
        return <MediaStudio />;
      case 'settings':
        return <AppSettingsView state={state} actions={actions} />;
      default:
        return <div className="p-4 text-white">View not implemented</div>;
    }
  };

  return (
    <div className="flex w-full min-h-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      
      {/* 1. DESKTOP LEFT PANEL: DATABASE STATISTICS */}
      <div className="hidden lg:flex flex-col w-[280px] bg-neutral-900 border-r border-neutral-800 p-5 gap-6 select-text overflow-y-auto max-h-screen">
        <div className="flex items-center gap-2.5 pb-4 border-b border-neutral-800">
          <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-inner">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Voyager DB</h2>
            <span className="text-[10px] font-mono text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> LOCAL-FIRST ONLINE
            </span>
          </div>
        </div>

        {/* Real-time Stats */}
        <div className="flex flex-col gap-3">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 font-mono">Database Stats</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-neutral-950 p-3 border border-neutral-850 rounded-xl flex flex-col">
              <span className="text-lg font-bold text-white font-mono">{stats.pages}</span>
              <span className="text-[9px] text-neutral-400">Custom Pages</span>
            </div>
            <div className="bg-neutral-950 p-3 border border-neutral-850 rounded-xl flex flex-col">
              <span className="text-lg font-bold text-white font-mono">{stats.journals}</span>
              <span className="text-[9px] text-neutral-400">Journal Days</span>
            </div>
            <div className="bg-neutral-950 p-3 border border-neutral-850 rounded-xl flex flex-col">
              <span className="text-lg font-bold text-white font-mono">{stats.blocks}</span>
              <span className="text-[9px] text-neutral-400">Total Blocks</span>
            </div>
            <div className="bg-neutral-950 p-3 border border-neutral-850 rounded-xl flex flex-col">
              <span className="text-lg font-bold text-white font-mono">{stats.cards}</span>
              <span className="text-[9px] text-neutral-400">SM-2 Cards</span>
            </div>
            <div className="bg-neutral-950 p-3 border border-neutral-850 rounded-xl flex flex-col">
              <span className="text-lg font-bold text-white font-mono">{stats.media}</span>
              <span className="text-[9px] text-neutral-400">Photos / Sketches</span>
            </div>
            <div className="bg-neutral-950 p-3 border border-neutral-850 rounded-xl flex flex-col">
              <span className="text-lg font-bold text-white font-mono">{stats.recordings}</span>
              <span className="text-[9px] text-neutral-400">Voice Recordings</span>
            </div>
          </div>
        </div>

        {/* Technical Architecture Notes */}
        <div className="bg-neutral-950 border border-neutral-850 rounded-2xl p-4 flex flex-col gap-2.5 text-[11px] leading-relaxed text-neutral-400">
          <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-400" /> Architecture Details
          </h4>
          <p>
            Voyager operates as a secure, local-first outliner. Unlike traditional hybrid apps, it stores pages and high-definition media blobs entirely within the browser's persistent <strong>IndexedDB</strong> store.
          </p>
          <p>
            A background reactive thread builds and maintains bidirectional link maps and tag indices, providing instantaneous O(1) backlinks.
          </p>
        </div>
      </div>

      {/* 2. CENTER: RESPONSIVE PHONE SIMULATOR */}
      <div className="flex-1 flex items-center justify-center relative bg-slate-950">
        <S23UltraFrame>
          {/* Simulated Android App Container */}
          <div className="w-full h-full relative flex flex-col bg-neutral-900 text-white overflow-hidden">
            
            {/* APP HEADER */}
            <div className="h-12 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-3 select-none">
              <div className="flex items-center gap-2">
                {/* Menu Hamburger */}
                <button
                  onClick={() => setIsLeftDrawerOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Navigation Menu"
                >
                  <Menu className="w-5 h-5" />
                </button>

                {/* View Title */}
                <span className="text-xs font-bold tracking-wider text-white capitalize">
                  {activeView === 'editor' ? 'Editor' : activeView === 'todos' ? 'Tasks' : activeView}
                </span>
              </div>

              {/* Toolbar Buttons */}
              <div className="flex items-center gap-1">
                {/* Search Dialog button */}
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Search Pages"
                >
                  <Search className="w-4 h-4" />
                </button>
                
                {/* S-Pen stylus indicator button */}
                <button
                  onClick={() => actions.updateSettings({ sPenActive: !settings.sPenActive })}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                    settings.sPenActive
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 scale-105'
                      : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                  title="S-Pen Air Command"
                >
                  <PenTool className="w-4 h-4" />
                </button>

                {/* Plus Page button */}
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-neutral-850 border border-neutral-800 text-neutral-200 cursor-pointer"
                  title="New Page"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* MAIN INNER SCREEN VIEWPORT */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
              {renderActiveView()}
            </div>

            {/* SPEN OVERLAY CANVAS LAYER */}
            <SPenOverlay />

            {/* LEFT OVERLAY NAVIGATION DRAWER */}
            {isLeftDrawerOpen && (
              <div className="absolute inset-0 bg-black/60 z-[70] flex pointer-events-auto animate-in fade-in duration-200">
                {/* Drawer Body */}
                <div className="w-[260px] bg-neutral-900 border-r border-neutral-800 flex flex-col h-full animate-in slide-in-from-left duration-300">
                  
                  {/* Drawer Header */}
                  <div className="h-14 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-4">
                    <span className="text-xs font-bold text-white tracking-widest flex items-center gap-2">
                      <FileCode className="w-4.5 h-4.5 text-blue-500" /> VOYAGER MOBILE
                    </span>
                    <button
                      onClick={() => setIsLeftDrawerOpen(false)}
                      className="p-1.5 rounded-md hover:bg-neutral-850 text-neutral-400 cursor-pointer"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  {/* Drawer Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
                    
                    {/* View links */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] uppercase tracking-widest font-bold text-neutral-500 font-mono pl-2 mb-1.5">App Views</span>
                      {[
                        { id: 'editor', label: 'Outline Editor', icon: BookOpen, color: 'text-blue-400' },
                        { id: 'graph', label: 'Knowledge Graph', icon: GitMerge, color: 'text-purple-400' },
                        { id: 'flashcards', label: 'Flashcards (SM-2)', icon: Award, color: 'text-amber-400' },
                        { id: 'todos', label: 'Global Tasks', icon: CheckSquare, color: 'text-emerald-400' },
                        { id: 'pages', label: 'Pages Directory', icon: FileText, color: 'text-sky-400' },
                        { id: 'media', label: 'Media Studio', icon: PenTool, iconComponent: true, color: 'text-pink-400' },
                        { id: 'settings', label: 'Device Settings', icon: SettingsIcon, color: 'text-neutral-400' }
                      ].map(viewItem => {
                        const Icon = viewItem.icon;
                        const isSel = activeView === viewItem.id;
                        return (
                          <button
                            key={viewItem.id}
                            onClick={() => {
                              actions.setActiveView(viewItem.id as any);
                              setIsLeftDrawerOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isSel
                                ? 'bg-neutral-800 text-white border border-neutral-700/60 shadow'
                                : 'text-neutral-400 hover:text-white hover:bg-neutral-850/50 border border-transparent'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${viewItem.color}`} />
                            {viewItem.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Favorites list */}
                    <div className="flex flex-col gap-1 border-t border-neutral-800/60 pt-4">
                      <span className="text-[8px] uppercase tracking-widest font-bold text-neutral-500 font-mono pl-2 mb-1.5 flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Favorite Pages
                      </span>
                      {favorites.length === 0 ? (
                        <span className="text-[10px] text-neutral-600 italic pl-3">No starred pages.</span>
                      ) : (
                        favorites.map(id => {
                          const p = pages[id];
                          if (!p) return null;
                          return (
                            <button
                              key={id}
                              onClick={() => {
                                actions.setActiveView('editor');
                                actions.navigateToPage(id);
                                setIsLeftDrawerOpen(false);
                              }}
                              className="w-full text-left truncate text-xs text-neutral-300 hover:text-white hover:bg-neutral-850/40 px-3 py-2 rounded-lg font-medium cursor-pointer"
                            >
                              📁 {p.name}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Drawer tap outside backdrop */}
                <div className="flex-1" onClick={() => setIsLeftDrawerOpen(false)}></div>
              </div>
            )}

            {/* SEARCH DIALOG / MODAL SHEET */}
            {showSearchModal && (
              <div className="absolute inset-0 bg-black/65 z-[80] flex items-start justify-center p-4 pointer-events-auto animate-in fade-in duration-150">
                <div className="w-full max-w-[320px] bg-neutral-900 border border-neutral-800 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1">
                      <Search className="w-4 h-4 text-blue-400" /> Search Pages
                    </span>
                    <button
                      onClick={() => {
                        setShowSearchModal(false);
                        setSearchQuery('');
                      }}
                      className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder="Type to search page titles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                    autoFocus
                  />

                  {/* Results List */}
                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                    {searchQuery.trim() && filteredPages.length === 0 ? (
                      <div className="text-center py-4 text-[10px] text-neutral-500">No matching pages found.</div>
                    ) : searchQuery.trim() ? (
                      filteredPages.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            actions.setActiveView('editor');
                            actions.navigateToPage(p.id);
                            setShowSearchModal(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer truncate"
                        >
                          📁 {p.name}
                        </button>
                      ))
                    ) : (
                      <div className="text-[10px] text-neutral-600 text-center py-4">Search all pages, journals, and tags.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SLEEK BOTTOM MODAL SHEET: CREATE PAGE */}
            {isCreateModalOpen && (
              <div className="absolute inset-0 bg-black/65 z-[80] flex items-end pointer-events-auto animate-in fade-in duration-200">
                {/* Backdrop Click */}
                <div className="absolute inset-0" onClick={() => setIsCreateModalOpen(false)}></div>
                
                {/* Modal Sheet Body */}
                <div className="w-full bg-neutral-900 border-t border-neutral-800 rounded-t-[28px] p-5 flex flex-col gap-4 relative z-10 animate-in slide-in-from-bottom duration-300">
                  {/* Pull bar */}
                  <div className="w-10 h-1 bg-neutral-700 rounded-full self-center mb-1"></div>

                  <div className="flex justify-between items-center pb-1">
                    <span className="text-sm font-bold text-white">Create New Page</span>
                    <button
                      onClick={() => setIsCreateModalOpen(false)}
                      className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreatePage} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">Page Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Weekly Review or Project Alpha"
                        value={newPageName}
                        onChange={(e) => setNewPageName(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4.5 py-3 text-xs text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        autoFocus
                        required
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(false)}
                        className="text-xs text-neutral-400 px-4 py-2.5 rounded-xl hover:bg-neutral-850 cursor-pointer font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newPageName.trim()}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                      >
                        Create Page
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        </S23UltraFrame>
      </div>

      {/* 3. DESKTOP RIGHT PANEL: SHORTCUTS & SPEN GUIDE */}
      <div className="hidden lg:flex flex-col w-[280px] bg-neutral-900 border-l border-neutral-800 p-5 gap-6 select-text overflow-y-auto max-h-screen">
        
        {/* Stylus Quick Guide */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-850">
            <PenTool className="w-4.5 h-4.5 text-blue-400 animate-pulse" />
            <h3 className="text-xs font-bold text-white">S-Pen Stylus Guide</h3>
          </div>
          <div className="flex flex-col gap-2 bg-neutral-950 border border-neutral-850 rounded-2xl p-3.5 text-[11px] leading-relaxed text-neutral-400">
            <p>
              Click the stylus slot on the bottom-right of the bezel (or click the pen icon in the top header) to deploy the <strong>Air Command</strong> menu.
            </p>
            <ul className="space-y-1.5 mt-1">
              <li>• <strong className="text-neutral-200">Screen Write:</strong> Canvas drawings are saved to your journal as secure Blob attachments.</li>
              <li>• <strong className="text-neutral-200">Handwrite OCR:</strong> Write or type to simulate AI OCR translation into page blocks.</li>
              <li>• <strong className="text-neutral-200">Quick Memo:</strong> Speed post-it memos sync directly into page lines.</li>
            </ul>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-850">
            <FileCode className="w-4.5 h-4.5 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">Keyboard Shortcuts</h3>
          </div>
          <div className="flex flex-col gap-2.5 bg-neutral-950 border border-neutral-850 rounded-2xl p-3.5 text-[11px] font-mono text-neutral-400">
            <div className="flex justify-between border-b border-neutral-850 pb-1.5">
              <span className="text-neutral-200">Double Click Block</span>
              <span>Edit Mode</span>
            </div>
            <div className="flex justify-between border-b border-neutral-850 pb-1.5">
              <span className="text-neutral-200">Enter</span>
              <span>Commit &amp; New Block</span>
            </div>
            <div className="flex justify-between border-b border-neutral-850 pb-1.5">
              <span className="text-neutral-200">Tab</span>
              <span>Indent Line</span>
            </div>
            <div className="flex justify-between border-b border-neutral-850 pb-1.5">
              <span className="text-neutral-200">Shift + Tab</span>
              <span>Outdent Line</span>
            </div>
            <div className="flex justify-between border-b border-neutral-850 pb-1.5">
              <span className="text-neutral-200">Shift + Click Link</span>
              <span>Open in Sidebar</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-200">/</span>
              <span>Slash Commands</span>
            </div>
          </div>
        </div>

        {/* Dev Note */}
        <div className="text-[10px] text-neutral-600 text-center select-none font-semibold mt-4">
          VOYAGER 1.0.0 • MADE BY SENIOR ARCHITECT
        </div>
      </div>

    </div>
  );
};

// --- GLOBAL TODOS/TASKS VIEW ---
interface ViewProps {
  state: any;
  actions: any;
}

const GlobalTodosView: React.FC<ViewProps> = ({ state, actions }) => {
  // Extract all blocks that have a task status
  const todos = React.useMemo(() => {
    const list: Array<{ pageId: string; pageName: string; block: Block }> = [];
    
    const traverse = (block: Block, page: Page) => {
      if (block.taskStatus) {
        list.push({ pageId: page.id, pageName: page.name, block });
      }
      block.children.forEach((c: Block) => traverse(c, page));
    };

    Object.values(state.pages).forEach((page: any) => {
      page.blocks.forEach((b: any) => traverse(b, page));
    });

    return list;
  }, [state.pages]);

  const handleCycleStatus = async (item: any) => {
    const next: Record<string, Block['taskStatus']> = {
      'TODO': 'DOING',
      'DOING': 'DONE',
      'DONE': null,
    };
    const nextStatus = next[item.block.taskStatus || ''] || 'TODO';
    await actions.updateBlock(item.pageId, item.block.uuid, item.block.content, { taskStatus: nextStatus });
  };

  if (todos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-neutral-500 bg-neutral-900 select-none">
        <CheckSquare className="w-10 h-10 text-neutral-700 mb-2" />
        <p className="text-xs">No active tasks found.</p>
        <p className="text-[10px] text-neutral-600 text-center mt-1">
          Type `/todo` or click a checkbox in the editor to create persistent tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-neutral-900 select-text">
      <div className="flex flex-col gap-3">
        {todos.map((item, idx) => (
          <div
            key={idx}
            className="bg-neutral-950 border border-neutral-850 hover:border-neutral-800 rounded-xl p-3 shadow-md flex items-start gap-2.5 transition-colors"
          >
            {/* Cycle Status Checkbox */}
            <button
              onClick={() => handleCycleStatus(item)}
              className="mt-0.5 flex-shrink-0 cursor-pointer text-neutral-400 hover:text-white"
            >
              {item.block.taskStatus === 'DONE' ? (
                <CheckSquare className="w-4 h-4 text-emerald-500" />
              ) : item.block.taskStatus === 'DOING' ? (
                <div className="w-4 h-4 rounded border border-blue-500 flex items-center justify-center text-[8px] text-blue-400 font-bold bg-blue-500/10">
                  ⚡
                </div>
              ) : (
                <Square className="w-4 h-4 text-neutral-500" />
              )}
            </button>

            {/* Task Details */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <button
                  onClick={() => {
                    actions.setActiveView('editor');
                    actions.navigateToPage(item.pageId);
                  }}
                  className="text-[9px] font-bold text-blue-400 hover:underline truncate max-w-[120px]"
                >
                  📁 {item.pageName}
                </button>
                <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                  item.block.taskStatus === 'DONE'
                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20'
                    : item.block.taskStatus === 'DOING'
                    ? 'bg-blue-950/40 text-blue-400 border border-blue-900/20'
                    : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                }`}>
                  {item.block.taskStatus}
                </span>
              </div>
              <p className={`text-xs font-medium leading-relaxed ${
                item.block.taskStatus === 'DONE' ? 'text-neutral-500 line-through' : 'text-neutral-200'
              }`}>
                {item.block.content.replace(/#card/g, '').trim() || 'Empty task'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- PAGES DIRECTORY LIST VIEW ---
interface PagesListProps {
  state: any;
  actions: any;
  openCreateModal: () => void;
}

const PagesListView: React.FC<PagesListProps> = ({ state, actions, openCreateModal }) => {
  const customPages = Object.values(state.pages).filter((p: any) => !p.isJournal);
  const journalPages = Object.values(state.pages).filter((p: any) => p.isJournal);

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-neutral-900 flex flex-col gap-5 select-text">
      
      {/* Custom pages section */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center pb-1 border-b border-neutral-800">
          <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 font-mono">Custom Pages ({customPages.length})</span>
          <button
            onClick={openCreateModal}
            className="text-blue-400 hover:text-blue-300 text-[10px] font-bold cursor-pointer"
          >
            + Create
          </button>
        </div>
        
        {customPages.length === 0 ? (
          <p className="text-[10px] text-neutral-600 italic py-2 pl-1">No custom pages created yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {customPages.map((p: any) => (
              <div
                key={p.id}
                onClick={() => {
                  actions.setActiveView('editor');
                  actions.navigateToPage(p.id);
                }}
                className="bg-neutral-950 border border-neutral-850 hover:border-neutral-800 rounded-xl p-3 shadow-md flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex flex-col gap-0.5 truncate pr-4">
                  <span className="text-xs font-bold text-neutral-200 truncate">{p.name}</span>
                  <span className="text-[8px] text-neutral-500 font-mono">Created {new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
                
                {/* Favorite Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.toggleFavorite(p.id);
                  }}
                  className="p-1 text-neutral-500 hover:text-amber-500 cursor-pointer"
                >
                  <Star className={`w-4 h-4 ${state.favorites.includes(p.id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Journal pages section */}
      <div className="flex flex-col gap-2">
        <div className="pb-1 border-b border-neutral-800">
          <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 font-mono">Journals ({journalPages.length})</span>
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          {journalPages.map((p: any) => (
            <div
              key={p.id}
              onClick={() => {
                actions.setActiveView('editor');
                actions.navigateToPage(p.id);
              }}
              className="bg-neutral-950 border border-neutral-850 hover:border-neutral-800 rounded-xl p-3 shadow-md flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex flex-col gap-0.5 truncate">
                <span className="text-xs font-bold text-neutral-200 truncate">{p.name}</span>
                <span className="text-[8px] text-neutral-500 font-mono">{p.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- DEVICE SETTINGS VIEW ---
const AppSettingsView: React.FC<ViewProps> = ({ state, actions }) => {
  const { settings } = state;

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-neutral-900 select-text flex flex-col gap-5">
      
      {/* Bezel Choice */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 font-mono border-b border-neutral-800 pb-1.5">S23 Bezel Color Choice</span>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {BEZEL_COLORS.map((color: any) => (
            <button
              key={color.value}
              onClick={() => actions.updateSettings({ bezelColor: color.value })}
              className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all active:scale-95 text-left ${
                settings.bezelColor === color.value
                  ? 'bg-neutral-950 border-blue-500 text-white shadow-lg'
                  : 'bg-neutral-950 border-neutral-850 text-neutral-400'
              }`}
            >
              <div className="w-4 h-4 rounded-full border border-neutral-800 flex-shrink-0" style={{ backgroundColor: color.value }}></div>
              <span className="text-xs font-semibold">{color.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Nav mode Choice */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 font-mono border-b border-neutral-800 pb-1.5">Android Navigation Bar Mode</span>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {[
            { id: 'buttons', label: 'Classic 3-Buttons', desc: 'Back / Home / Recents' },
            { id: 'gestures', label: 'Gesture Swipe Bar', desc: 'Swipe gestures' }
          ].map(mode => (
            <button
              key={mode.id}
              onClick={() => actions.updateSettings({ navMode: mode.id as any })}
              className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer transition-all active:scale-95 text-left ${
                settings.navMode === mode.id
                  ? 'bg-neutral-950 border-emerald-500 text-white shadow-lg'
                  : 'bg-neutral-950 border-neutral-850 text-neutral-400'
              }`}
            >
              <span className="text-xs font-bold">{mode.label}</span>
              <span className="text-[9px] text-neutral-500">{mode.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Hardware Simulation Settings */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 font-mono border-b border-neutral-800 pb-1.5">Simulated Hardware States</span>
        <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-3 flex flex-col gap-3.5 text-xs text-neutral-300 select-none">
          {/* Charging toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">Connect USB-C Charger</span>
              <span className="text-[9px] text-neutral-500">Starts slow charging animation</span>
            </div>
            <button
              onClick={() => actions.updateSettings({ charging: !settings.charging })}
              className={`w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${
                settings.charging ? 'bg-emerald-500' : 'bg-neutral-800'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.8 transition-all ${
                settings.charging ? 'right-1' : 'left-1'
              }`} />
            </button>
          </div>

          {/* Battery level slider */}
          <div className="flex flex-col gap-1.5 border-t border-neutral-850 pt-3">
            <div className="flex justify-between font-bold">
              <span>Simulated Battery Level</span>
              <span className="font-mono text-neutral-400">{settings.batteryLevel}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.batteryLevel}
              onChange={(e) => actions.updateSettings({ batteryLevel: Number(e.target.value) })}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          {/* Volume slider */}
          <div className="flex flex-col gap-1.5 border-t border-neutral-850 pt-3">
            <div className="flex justify-between font-bold">
              <span>Simulated System Volume</span>
              <span className="font-mono text-neutral-400">{settings.volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.volume}
              onChange={(e) => actions.updateSettings({ volume: Number(e.target.value) })}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
