import { useState, useEffect, useRef, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useBrowser } from '../context/BrowserContext';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Search,
  Star,
  Scissors,
  Settings,
  Plus,
  X,
  ExternalLink,
  Compass,
  History,
  Globe
} from 'lucide-react';
import { genUUID } from '../utils/id';

export default function BrowserView() {
  const { state: dbState } = useDatabase();
  const {
    currentUrl,
    tabs,
    activeTabId,
    activeTab,
    history,
    bookmarks,
    navigate,
    openInNewTab,
    closeTab,
    setActiveTabId,
    toggleBookmark,
    addClipToVoyagerNotes,
    clearHistory,
    deleteBookmark
  } = useBrowser();

  const [inputVal, setInputVal] = useState(currentUrl);
  const [showBookmarksDropdown, setShowBookmarksDropdown] = useState(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [showClipperPanel, setShowClipperPanel] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  // Per-tab history navigation state
  const [tabNavHistory, setTabNavHistory] = useState<
    Record<string, { stack: string[]; index: number }>
  >({});

  // Iframe load detection & fallback state
  const [iframeLoaded, setIframeLoaded] = useState(true);
  const [showFallbackBanner, setShowFallbackBanner] = useState(false);
  const loadTimeoutRef = useRef<number | null>(null);

  // Clipper inputs
  const [clipTitle, setClipTitle] = useState('');
  const [clipExcerpt, setClipExcerpt] = useState('');
  const [clipTargetPageId, setClipTargetPageId] = useState('journal');
  const [clipTargetMode, setClipTargetMode] = useState<'appendToJournal' | 'newPage'>('appendToJournal');
  const [clipCustomPageName, setClipCustomPageName] = useState('');
  const [clipSuccess, setClipSuccess] = useState(false);

  // Synchronize input bar when tab URL changes
  useEffect(() => {
    setInputVal(currentUrl);
    setIframeLoaded(false);
    setShowFallbackBanner(false);

    // Cancel existing loading timeout
    if (loadTimeoutRef.current) {
      window.clearTimeout(loadTimeoutRef.current);
    }

    // Set a 3-second fallback timeout for embedding-refused sites
    if (currentUrl && currentUrl !== 'about:blank') {
      loadTimeoutRef.current = window.setTimeout(() => {
        setShowFallbackBanner(true);
      }, 3000);
    }

    // Initialize or record history inside tab stack
    if (activeTabId) {
      setTabNavHistory(prev => {
        const hist = prev[activeTabId] || { stack: [], index: -1 };
        // If stack is empty or last is not equal to current, push
        if (hist.index === -1 || hist.stack[hist.index] !== currentUrl) {
          const newStack = hist.stack.slice(0, hist.index + 1);
          newStack.push(currentUrl);
          return {
            ...prev,
            [activeTabId]: { stack: newStack, index: newStack.length - 1 }
          };
        }
        return prev;
      });
    }
  }, [currentUrl, activeTabId]);

  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
    };
  }, []);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    setShowFallbackBanner(false);
    if (loadTimeoutRef.current) {
      window.clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  const handleGoBack = () => {
    const hist = tabNavHistory[activeTabId];
    if (hist && hist.index > 0) {
      const prevIndex = hist.index - 1;
      const prevUrl = hist.stack[prevIndex];
      setTabNavHistory(prev => ({
        ...prev,
        [activeTabId]: { ...hist, index: prevIndex }
      }));
      navigate(prevUrl);
    }
  };

  const handleGoForward = () => {
    const hist = tabNavHistory[activeTabId];
    if (hist && hist.index < hist.stack.length - 1) {
      const nextIndex = hist.index + 1;
      const nextUrl = hist.stack[nextIndex];
      setTabNavHistory(prev => ({
        ...prev,
        [activeTabId]: { ...hist, index: nextIndex }
      }));
      navigate(nextUrl);
    }
  };

  const currentTabHist = tabNavHistory[activeTabId] || { stack: [], index: -1 };
  const canGoBack = currentTabHist.index > 0;
  const canGoForward = currentTabHist.index < currentTabHist.stack.length - 1;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      navigate(inputVal.trim());
    }
  };

  const isCurrentBookmarked = useMemo(() => {
    return bookmarks.some(b => b.url === currentUrl);
  }, [bookmarks, currentUrl]);

  const toggleBookmarkCurrent = () => {
    toggleBookmark(currentUrl, activeTab ? activeTab.title : currentUrl);
  };

  const triggerClipper = () => {
    let guessedTitle = activeTab?.title || currentUrl;
    try {
      if (currentUrl.startsWith('http')) {
        guessedTitle = new URL(currentUrl).hostname;
      }
    } catch {
      // ignore
    }
    setClipTitle(guessedTitle);
    setClipExcerpt('');
    setClipTargetPageId('journal');
    setClipTargetMode('appendToJournal');
    setClipCustomPageName('');
    setClipSuccess(false);
    setShowClipperPanel(true);
  };

  const handleSaveClip = async () => {
    let finalPageId = clipTargetPageId;
    let finalMode = clipTargetMode;

    if (clipTargetPageId === 'new') {
      finalMode = 'newPage';
      finalPageId = clipCustomPageName.trim() || 'New Web Clip';
    }

    const clipObj = {
      id: genUUID(),
      url: currentUrl,
      title: clipTitle.trim() || currentUrl,
      excerpt: clipExcerpt.trim(),
      createdAt: new Date().toISOString(),
    };

    await addClipToVoyagerNotes(clipObj, { pageId: finalPageId, mode: finalMode });
    setClipSuccess(true);
    setTimeout(() => {
      setClipSuccess(false);
      setShowClipperPanel(false);
    }, 1200);
  };

  const openExternally = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };

  // Pages list in DB for dropdown target selection
  const pagesList = useMemo(() => {
    return Object.values(dbState.db)
      .filter(p => !p.isJournal)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dbState.db]);

  const sandboxAttrs = useMemo(() => {
    const strict = 'allow-forms allow-scripts allow-popups allow-top-navigation-by-user-activation';
    if (dbState.settings.browserSandboxMode === 'compat') {
      return `${strict} allow-same-origin`;
    }
    return strict;
  }, [dbState.settings.browserSandboxMode]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5 px-3 pt-2 bg-slate-900 border-b border-slate-800 overflow-x-auto shrink-0 select-none">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl text-xs cursor-pointer border-t border-x transition-colors max-w-40 truncate ${
                isActive
                  ? 'bg-slate-950 border-slate-800 text-indigo-400 font-semibold'
                  : 'bg-slate-900/40 border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <Globe size={11} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
              <span className="truncate flex-1">{tab.title || tab.url}</span>
              {tabs.length > 1 && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="text-slate-500 hover:text-slate-300 rounded p-0.5 hover:bg-slate-800 transition-colors"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={() => openInNewTab('https://duckduckgo.com')}
          className="text-slate-400 hover:text-white rounded-lg p-1.5 hover:bg-slate-800 transition-colors self-center shrink-0 mb-1"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1.5 p-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleGoBack}
            disabled={!canGoBack}
            className={`p-1.5 rounded-lg transition-colors ${
              canGoBack ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <ArrowLeft size={15} />
          </button>
          <button
            onClick={handleGoForward}
            disabled={!canGoForward}
            className={`p-1.5 rounded-lg transition-colors ${
              canGoForward ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <ArrowRight size={15} />
          </button>
          <button
            onClick={() => navigate(currentUrl)}
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RotateCw size={14} />
          </button>
        </div>

        {/* Address bar input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 bg-slate-950 rounded-xl px-2.5 py-1.5 border border-slate-800 focus-within:border-indigo-500 transition-colors">
            <Search size={13} className="text-slate-500 shrink-0" />
            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Search or enter URL..."
              className="w-full bg-transparent text-xs text-slate-100 outline-none border-none"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => setInputVal('')}
                className="text-slate-500 hover:text-slate-300 rounded p-0.5"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </form>

        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleBookmarkCurrent}
            className={`p-1.5 rounded-lg transition-colors ${
              isCurrentBookmarked ? 'text-yellow-400 hover:bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Star size={14} fill={isCurrentBookmarked ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={triggerClipper}
            className="p-1.5 rounded-lg text-indigo-400 hover:bg-slate-800 hover:text-indigo-300 transition-colors"
            title="Clip webpage to notes"
          >
            <Scissors size={14} />
          </button>
          <button
            onClick={openExternally}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Open in external browser"
          >
            <ExternalLink size={14} />
          </button>
          <div className="relative">
            <button
              onClick={() => {
                setShowSettingsDropdown(!showSettingsDropdown);
                setShowBookmarksDropdown(false);
                setShowHistoryDropdown(false);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Settings size={14} />
            </button>

            {/* Quick settings dropdown */}
            {showSettingsDropdown && (
              <div className="absolute right-0 mt-1.5 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 text-xs">
                <button
                  onClick={() => {
                    setShowBookmarksDropdown(true);
                    setShowSettingsDropdown(false);
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Star size={12} className="text-yellow-400" /> Bookmarks List
                </button>
                <button
                  onClick={() => {
                    setShowHistoryDropdown(true);
                    setShowSettingsDropdown(false);
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <History size={12} className="text-indigo-400" /> Browsing History
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Browser View frame */}
      <div className="flex-1 relative bg-slate-950 overflow-hidden">
        {/* strict iframe */}
        <iframe
          src={currentUrl}
          sandbox={sandboxAttrs}
          referrerPolicy="no-referrer"
          onLoad={handleIframeLoad}
          className="w-full h-full border-none"
        />

        {/* Fallback Banner for frame refuse detection */}
        {showFallbackBanner && !iframeLoaded && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center backdrop-blur-sm animate-fade-in">
            <Compass size={40} className="text-slate-500 mb-3 animate-spin" />
            <h2 className="text-sm font-semibold text-white mb-1">Embedding restricted</h2>
            <p className="text-xs text-slate-400 max-w-64 mb-4 leading-relaxed">
              This site restricts embedding in external frames due to security policies (X-Frame-Options/CSP).
            </p>
            <div className="flex gap-2">
              <button
                onClick={openExternally}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5"
              >
                <ExternalLink size={12} /> Open Externally
              </button>
              <button
                onClick={() => navigate('https://duckduckgo.com')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Go Back Home
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clipper Sidebar / Overlay */}
      {showClipperPanel && (
        <div className="absolute inset-y-0 right-0 w-80 bg-slate-900/98 backdrop-blur border-l border-slate-800 shadow-2xl z-40 animate-slide-in-right flex flex-col p-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <Scissors size={14} className="text-indigo-400" />
              <span className="text-sm font-bold text-white">Save Clip to Notes</span>
            </div>
            <button
              onClick={() => setShowClipperPanel(false)}
              className="text-slate-500 hover:text-slate-300 rounded p-1 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Clip Title</label>
              <input
                type="text"
                value={clipTitle}
                onChange={e => setClipTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Source URL</label>
              <div className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-500 truncate select-all">
                {currentUrl}
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Excerpt / Annotations</label>
              <textarea
                value={clipExcerpt}
                onChange={e => setClipExcerpt(e.target.value)}
                placeholder="Paste highlighted text or write notes here..."
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-indigo-500 resize-none font-sans"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Save Target</label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => {
                    setClipTargetMode('appendToJournal');
                    setClipTargetPageId('journal');
                  }}
                  className={`flex-1 py-1.5 border rounded-lg text-center font-semibold transition-colors ${
                    clipTargetMode === 'appendToJournal'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Daily Journal
                </button>
                <button
                  onClick={() => {
                    setClipTargetMode('newPage');
                    if (pagesList.length > 0) {
                      setClipTargetPageId(pagesList[0].id);
                    } else {
                      setClipTargetPageId('new');
                    }
                  }}
                  className={`flex-1 py-1.5 border rounded-lg text-center font-semibold transition-colors ${
                    clipTargetMode === 'newPage'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Page Link
                </button>
              </div>

              {clipTargetMode === 'newPage' && (
                <div className="space-y-2">
                  <select
                    value={clipTargetPageId}
                    onChange={e => setClipTargetPageId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-indigo-500"
                  >
                    {pagesList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value="new">+ Create new page</option>
                  </select>

                  {clipTargetPageId === 'new' && (
                    <input
                      type="text"
                      placeholder="Page name..."
                      value={clipCustomPageName}
                      onChange={e => setClipCustomPageName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-indigo-500"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3 mt-3 shrink-0">
            <button
              onClick={handleSaveClip}
              disabled={clipSuccess}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
                clipSuccess
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg hover:shadow-indigo-500/25 active:scale-98'
              }`}
            >
              {clipSuccess ? '✓ Saved to Notes!' : 'Clip Webpage'}
            </button>
          </div>
        </div>
      )}

      {/* Bookmarks Overlay Panel */}
      {showBookmarksDropdown && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col p-4 shadow-2xl animate-modal-zoom">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Star size={14} className="text-yellow-400" />
                <span className="text-sm font-bold text-white">Bookmarks</span>
              </div>
              <button
                onClick={() => setShowBookmarksDropdown(false)}
                className="text-slate-500 hover:text-slate-300 rounded p-1"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {bookmarks.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No bookmarks saved yet.</p>
              ) : (
                bookmarks.map(bm => (
                  <div
                    key={bm.id}
                    className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-850 hover:border-slate-800 transition-colors group"
                  >
                    <button
                      onClick={() => {
                        navigate(bm.url);
                        setShowBookmarksDropdown(false);
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <h4 className="font-semibold text-slate-200 truncate group-hover:text-indigo-400 transition-colors">
                        {bm.title || bm.url}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate">{bm.url}</p>
                    </button>
                    <button
                      onClick={() => deleteBookmark(bm.id)}
                      className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Overlay Panel */}
      {showHistoryDropdown && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col p-4 shadow-2xl animate-modal-zoom">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <History size={14} className="text-indigo-400" />
                <span className="text-sm font-bold text-white">Browsing History</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearHistory}
                  className="text-red-400 hover:text-red-300 text-[10px] font-semibold"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowHistoryDropdown(false)}
                  className="text-slate-500 hover:text-slate-300 rounded p-1"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {history.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No browsing history found.</p>
              ) : (
                history.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => {
                      navigate(entry.url);
                      setShowHistoryDropdown(false);
                    }}
                    className="w-full text-left p-2.5 bg-slate-950 rounded-xl border border-slate-850 hover:border-slate-800 transition-colors group"
                  >
                    <h4 className="font-semibold text-slate-200 truncate group-hover:text-indigo-400 transition-colors">
                      {entry.title || entry.url}
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate">{entry.url}</p>
                    <span className="text-[9px] text-slate-600 block mt-0.5">
                      {new Date(entry.visitedAt).toLocaleTimeString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
