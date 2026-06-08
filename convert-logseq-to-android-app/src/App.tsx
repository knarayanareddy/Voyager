import { useState, useEffect } from 'react';
import { 
  BookOpen, GitMerge, Settings as SettingsIcon, Calendar, FileText, 
  Search, Plus, ChevronRight, Moon, Sun, Monitor, Smartphone, 
  List, Code, ArrowLeft, PanelRight, X
} from 'lucide-react';
import { Page, Block, S23Settings, LogseqSettings } from './types';
import { getInitialPages, generateId } from './mockData';
import S23UltraFrame from './components/S23UltraFrame';
import PhoneHome from './components/PhoneHome';
import LogseqEditor from './components/LogseqEditor';
import GraphView from './components/GraphView';
import Flashcards from './components/Flashcards';
import Sidebar from './components/Sidebar';

export default function App() {
  // --- DATABASE STATE ---
  const [pages, setPages] = useState<Page[]>(() => getInitialPages());
  const [currentPageName, setCurrentPageName] = useState('March 3rd, 2026'); // default to today's journal
  const [history, setHistory] = useState<string[]>([]); // navigation history for android BACK button

  // --- LOGSEQ APP VIEW ---
  // 'journals' | 'graph' | 'flashcards' | 'pages-list' | 'settings'
  const [logseqView, setLogseqView] = useState<'journals' | 'graph' | 'flashcards' | 'pages-list' | 'settings'>('journals');

  // --- S23 ULTRA APP STATE ---
  // 'home' | 'logseq'
  const [activeApp, setActiveApp] = useState<'home' | 'logseq'>('logseq');

  // --- SIDEBAR DRAWER STATE ---
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPageName, setSidebarPageName] = useState<string | null>(null);

  // --- SEARCH MODAL STATE ---
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- SYSTEM MOCK SETTINGS (S23 ULTRA) ---
  const [s23Settings, setS23Settings] = useState<S23Settings>({
    color: 'phantom-black',
    showFrame: true,
    batteryLevel: 98,
    isCharging: true,
    useGestures: false,
    volume: 70,
    sPenConnected: true,
    brightness: 85
  });

  // --- LOGSEQ SETTINGS ---
  const [logseqSettings, setLogseqSettings] = useState<LogseqSettings>({
    theme: 'dark',
    fontSize: 13,
    customCss: `/* Try editing this custom CSS! */
.outline-editor {
  font-family: system-ui, sans-serif;
}
/* Highlight bullet points */
.group-hover\\:scale-125 {
  transition: transform 0.2s ease;
}`,
    showBulletLines: true
  });

  // Sync battery charging simulator
  useEffect(() => {
    if (!s23Settings.isCharging) return;
    const interval = setInterval(() => {
      setS23Settings(prev => {
        if (prev.batteryLevel >= 100) return { ...prev, batteryLevel: 100 };
        return { ...prev, batteryLevel: prev.batteryLevel + 1 };
      });
    }, 45000);
    return () => clearInterval(interval);
  }, [s23Settings.isCharging]);

  // Inject Custom CSS dynamically
  useEffect(() => {
    const styleId = 'logseq-custom-css';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = logseqSettings.customCss;
  }, [logseqSettings.customCss]);

  // --- SYSTEM CONTROL HANDLERS ---

  const handleUpdateSystemSetting = (key: string, value: any) => {
    setS23Settings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleHomePress = () => {
    setActiveApp('home');
    setSidebarOpen(false);
  };

  const handleBackPress = () => {
    // If sidebar is open, close it
    if (sidebarOpen) {
      setSidebarOpen(false);
      return;
    }

    // If search modal is open, close it
    if (searchOpen) {
      setSearchOpen(false);
      return;
    }

    // If we are on the Home Screen, do nothing
    if (activeApp === 'home') {
      return;
    }

    // If we are in Logseq but not in journals view, go to journals
    if (logseqView !== 'journals') {
      setLogseqView('journals');
      return;
    }

    // If we have page history, go back to the previous page
    if (history.length > 0) {
      const newHistory = [...history];
      const prevPage = newHistory.pop()!;
      setHistory(newHistory);
      setCurrentPageName(prevPage);
    } else {
      // Go back to android Home Screen
      setActiveApp('home');
    }
  };

  const handleRecentsPress = () => {
    // Simulate Android multitasking: toggle between Home and Logseq
    setActiveApp(prev => prev === 'home' ? 'logseq' : 'home');
  };

  // --- LOGSEQ NAVIGATION HANDLERS ---

  const handleNavigate = (pageName: string, openInSidebar = false) => {
    // Create page if it doesn't exist
    const pageExists = pages.some(p => p.name.toLowerCase() === pageName.toLowerCase());
    let normalizedName = pageName;

    if (!pageExists) {
      const newPage: Page = {
        name: pageName,
        isJournal: false,
        blocks: [{ id: generateId(), content: '', children: [] }],
        updatedAt: Date.now()
      };
      setPages(prev => [...prev, newPage]);
      normalizedName = pageName;
    } else {
      // Get exact casing of existing page
      const existing = pages.find(p => p.name.toLowerCase() === pageName.toLowerCase());
      if (existing) normalizedName = existing.name;
    }

    if (openInSidebar) {
      setSidebarPageName(normalizedName);
      setSidebarOpen(true);
    } else {
      if (normalizedName !== currentPageName) {
        setHistory(prev => [...prev, currentPageName]);
      }
      setCurrentPageName(normalizedName);
      setLogseqView('journals'); // Return to editor/journals view
      setSearchOpen(false);
    }
  };

  // Update blocks for a page
  const handleUpdatePageBlocks = (pageName: string, newBlocks: Block[]) => {
    setPages(prev =>
      prev.map(p =>
        p.name === pageName
          ? { ...p, blocks: newBlocks, updatedAt: Date.now() }
          : p
      )
    );
  };

  // --- S-PEN & CAMERA CONTENT INJECTION ---

  const handleSaveCanvasImage = (base64Image: string) => {
    // Append the drawing as an image block into today's journal
    const todayJournalName = 'March 3rd, 2026';
    const targetPage = pages.find(p => p.name === todayJournalName) || pages[0];
    if (!targetPage) return;

    const newBlock: Block = {
      id: generateId(),
      content: `![S-Pen Sketch](${base64Image})\n*S-Pen Canvas Drawing - Captured on Samsung S23 Ultra.*`,
      children: []
    };

    const updatedBlocks = [...targetPage.blocks, newBlock];
    handleUpdatePageBlocks(targetPage.name, updatedBlocks);
    
    // Auto-navigate to today's journal and editor view to see it
    setCurrentPageName(todayJournalName);
    setLogseqView('journals');
  };

  const handleInsertOCRText = (text: string) => {
    // Insert text either at the bottom of the current page or as a new block
    const targetPage = pages.find(p => p.name === currentPageName) || pages[0];
    if (!targetPage) return;

    const newBlock: Block = {
      id: generateId(),
      content: text,
      children: []
    };

    const updatedBlocks = [...targetPage.blocks, newBlock];
    handleUpdatePageBlocks(targetPage.name, updatedBlocks);
    setLogseqView('journals');
  };

  const handleAddPhotoToLogseq = (_photoUrl: string, caption: string) => {
    // Append camera photo to today's journal
    const todayJournalName = 'March 3rd, 2026';
    const targetPage = pages.find(p => p.name === todayJournalName) || pages[0];
    if (!targetPage) return;

    const newBlock: Block = {
      id: generateId(),
      content: caption,
      children: []
    };

    const updatedBlocks = [...targetPage.blocks, newBlock];
    handleUpdatePageBlocks(targetPage.name, updatedBlocks);
  };

  // Find active page
  const activePage = pages.find(p => p.name === currentPageName) || pages[0];

  // Filter pages for quick switcher search
  const filteredPagesList = searchQuery.trim() === ''
    ? pages.filter(p => !p.isJournal)
    : pages.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Theme styling helpers
  const isDark = logseqSettings.theme === 'dark';
  
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300 ${
      isDark ? 'bg-slate-955 text-slate-100' : 'bg-slate-100 text-slate-800'
    }`}>
      
      {/* GLOBAL HEADER CONTROLS (Desktop wrapper) */}
      <div className="w-full max-w-5xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 px-6 py-4 rounded-2xl shadow-xs border border-slate-200/50 dark:border-slate-800/60 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-extrabold text-xl shadow-md shadow-emerald-500/10">
            L
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center space-x-2">
              <span>Logseq Mobile</span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full">S23 Ultra Edition</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">
              Simulating Samsung Galaxy flagship integrations with local-first knowledge graph
            </p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center space-x-3">
          {/* Toggle Device Frame */}
          <button
            onClick={() => handleUpdateSystemSetting('showFrame', !s23Settings.showFrame)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              s23Settings.showFrame
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {s23Settings.showFrame ? <Smartphone size={14} /> : <Monitor size={14} />}
            <span>{s23Settings.showFrame ? "Phone View" : "Web View (Full)"}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setLogseqSettings(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Toggle App Theme"
          >
            {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-600" />}
          </button>
        </div>
      </div>

      {/* CORE WRAPPER SECTION (PHONES FRAME OR FULLSCREEN) */}
      <div className={`w-full flex items-center justify-center transition-all duration-300 ${
        s23Settings.showFrame ? 'max-w-md' : 'max-w-4xl'
      }`}>
        
        {s23Settings.showFrame ? (
          /* SAMSUNG S23 ULTRA HARDWARE SIMULATOR FRAME */
          <S23UltraFrame
            settings={s23Settings}
            onUpdateSetting={handleUpdateSystemSetting}
            onHomePress={handleHomePress}
            onBackPress={handleBackPress}
            onRecentsPress={handleRecentsPress}
            onSaveCanvasImage={handleSaveCanvasImage}
            onInsertOCRText={handleInsertOCRText}
          >
            {activeApp === 'home' ? (
              <PhoneHome
                onLaunchApp={(appId) => {
                  if (appId === 'logseq') setActiveApp('logseq');
                }}
                batteryLevel={s23Settings.batteryLevel}
                isCharging={s23Settings.isCharging}
                onUpdateSystemSetting={handleUpdateSystemSetting}
                themeColor={s23Settings.color}
                onAddPhotoToLogseq={handleAddPhotoToLogseq}
              />
            ) : (
              /* LOGSEQ APP VIEW */
              renderLogseqApp()
            )}
          </S23UltraFrame>
        ) : (
          /* FULLSCREEN WEB APP MODE (No phone frame, comfortable desktop editing) */
          <div className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden min-h-[640px] flex flex-col transition-colors duration-200`}>
            
            {/* Desktop header bar simulating app chrome */}
            <div className="bg-slate-50 dark:bg-slate-950/50 px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-4 font-mono">
                  local://graph-database
                </span>
              </div>
              <span className="text-xs font-bold bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full flex items-center space-x-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Local-first Database Active</span>
              </span>
            </div>

            <div className="flex-1 flex min-h-0 relative">
              {/* Main Logseq App inside full container */}
              {renderLogseqApp()}
            </div>
          </div>
        )}

      </div>

      {/* QUICK FOOTER FOOTNOTE */}
      <div className="mt-6 text-center text-[10px] text-slate-400 max-w-md leading-relaxed">
        <p className="font-semibold">
          💡 Try ejecting the S-Pen (bottom-left) to draw diagrams on top of Logseq, or snap 100x Moon shots with the Camera from the phone's Home Screen!
        </p>
      </div>

    </div>
  );

  // --- LOGSEQ APP INNER COMPONENT RENDERER ---
  function renderLogseqApp() {
    return (
      <div className={`w-full h-full flex flex-col relative overflow-hidden bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-200`}>
        
        {/* LOGSEQ APP HEADER */}
        <header className="h-12 px-3.5 border-b border-slate-200/80 dark:border-slate-800/85 flex items-center justify-between bg-slate-50 dark:bg-slate-950/20">
          
          {/* Page Info */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (logseqView !== 'journals') {
                  setLogseqView('journals');
                } else if (history.length > 0) {
                  handleBackPress();
                } else {
                  setActiveApp('home');
                }
              }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft size={15} />
            </button>
            <div className="flex items-center space-x-1.5">
              {activePage.isJournal ? (
                <Calendar size={13} className="text-emerald-500" />
              ) : (
                <FileText size={13} className="text-sky-500" />
              )}
              <h2 className="text-xs font-black tracking-tight max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
                {activePage.name}
              </h2>
            </div>
          </div>

          {/* Quick Icons */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 rounded hover:bg-slate-250 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
              title="Search Pages (Ctrl+K)"
            >
              <Search size={14} />
            </button>
            <button
              onClick={() => handleNavigate(activePage.name, true)}
              className="p-1.5 rounded hover:bg-slate-250 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
              title="Open Page in Sidebar"
            >
              <PanelRight size={14} />
            </button>
          </div>

        </header>

        {/* LOGSEQ MAIN VIEWPORT CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 relative">
          
          {/* SEARCH MODAL OVERLAY */}
          {searchOpen && (
            <div 
              className="absolute inset-0 bg-black/60 z-30 flex flex-col p-4 animate-fadeIn"
              onClick={() => setSearchOpen(false)}
            >
              <div 
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xl flex flex-col space-y-3 animate-scaleIn text-slate-800 dark:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-500">
                    Search / Create Page
                  </span>
                  <button onClick={() => setSearchOpen(false)} className="text-slate-400 hover:text-slate-200">
                    <X size={14} />
                  </button>
                </div>

                <div className="bg-slate-100 dark:bg-slate-950 px-3 py-2 rounded-lg flex items-center space-x-2 border border-slate-200/50 dark:border-slate-800">
                  <Search size={13} className="text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type page name..."
                    className="bg-transparent text-xs text-slate-800 dark:text-white focus:outline-hidden w-full"
                    autoFocus
                  />
                </div>

                {/* Search Results */}
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {filteredPagesList.map(p => (
                    <button
                      key={p.name}
                      onClick={() => handleNavigate(p.name)}
                      className="w-full flex justify-between items-center p-2 rounded-lg hover:bg-slate-105 dark:hover:bg-slate-850 text-left text-xs font-semibold cursor-pointer"
                    >
                      <span className="text-slate-700 dark:text-slate-200">{p.name}</span>
                      <ChevronRight size={12} className="text-slate-400" />
                    </button>
                  ))}

                  {searchQuery.trim() !== '' && !pages.some(p => p.name.toLowerCase() === searchQuery.toLowerCase()) && (
                    <button
                      onClick={() => handleNavigate(searchQuery)}
                      className="w-full flex items-center space-x-2 p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15 rounded-lg text-left text-xs font-extrabold cursor-pointer border border-dashed border-emerald-500/30"
                    >
                      <Plus size={13} />
                      <span>Create new page "[[{searchQuery}]]"</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PRIMARY ROUTER VIEW */}
          {logseqView === 'journals' && (
            <div className="animate-fadeIn">
              {/* Page Title banner */}
              <div className="mb-5 pb-3 border-b border-slate-200/60 dark:border-slate-800/65">
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  {activePage.name}
                </h1>
                {activePage.isJournal && (
                  <p className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Chronological Journal Stream</span>
                  </p>
                )}
              </div>

              {/* OUTLINER EDITOR */}
              <LogseqEditor
                page={activePage}
                pages={pages}
                onUpdateBlocks={(newBlocks) => handleUpdatePageBlocks(activePage.name, newBlocks)}
                onNavigate={handleNavigate}
                theme={logseqSettings.theme}
                fontSize={logseqSettings.fontSize}
              />
            </div>
          )}

          {logseqView === 'graph' && (
            <div className="h-[430px] w-full animate-fadeIn">
              <GraphView
                pages={pages}
                currentPageName={currentPageName}
                onNavigate={handleNavigate}
                theme={logseqSettings.theme}
              />
            </div>
          )}

          {logseqView === 'flashcards' && (
            <div className="h-[430px] w-full animate-fadeIn">
              <Flashcards
                pages={pages}
                onNavigate={handleNavigate}
              />
            </div>
          )}

          {logseqView === 'pages-list' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="pb-2 border-b border-slate-250 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-black uppercase tracking-wider">All Pages</h3>
                <button
                  onClick={() => {
                    const name = prompt("Enter new page name:");
                    if (name) handleNavigate(name);
                  }}
                  className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center space-x-1 cursor-pointer"
                >
                  <Plus size={11} />
                  <span>New Page</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {pages.map(p => (
                  <div
                    key={p.name}
                    onClick={() => handleNavigate(p.name)}
                    className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950/45 border border-slate-200/50 dark:border-slate-800 rounded-xl cursor-pointer hover:shadow-xs hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-center space-x-2">
                      {p.isJournal ? (
                        <Calendar size={13} className="text-emerald-500" />
                      ) : (
                        <FileText size={13} className="text-sky-500" />
                      )}
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                    </div>
                    <ChevronRight size={12} className="text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {logseqView === 'settings' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="pb-2 border-b border-slate-250 dark:border-slate-800">
                <h3 className="text-sm font-black uppercase tracking-wider">Logseq Settings</h3>
              </div>

              {/* Theme Settings */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800 p-3 rounded-xl">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Appearance</h4>
                
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-bold">Dark Mode Theme:</span>
                  <button
                    onClick={() => setLogseqSettings(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-200 dark:bg-slate-850 hover:bg-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {logseqSettings.theme === 'dark' ? "Dark (Green)" : "Light (White)"}
                  </button>
                </div>

                <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-2.5">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    <span>Font Size:</span>
                    <span className="font-bold text-emerald-500">{logseqSettings.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="11"
                    max="18"
                    value={logseqSettings.fontSize}
                    onChange={(e) => setLogseqSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>

              {/* Custom CSS Setting */}
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800 p-3 rounded-xl">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                  <Code size={11} />
                  <span>Custom.css stylesheet</span>
                </h4>
                <p className="text-[8.5px] text-slate-400">
                  Styles will inject dynamically. Alter lists, spacing, headers in real time!
                </p>
                <textarea
                  value={logseqSettings.customCss}
                  onChange={(e) => setLogseqSettings(s => ({ ...s, customCss: e.target.value }))}
                  className="w-full h-24 bg-slate-900 text-rose-400 font-mono text-[9px] p-2 rounded-lg border border-slate-800 focus:outline-hidden"
                />
              </div>

              {/* Reset database */}
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to restore initial database? This clears drawings and camera photos.")) {
                    setPages(getInitialPages());
                    setCurrentPageName('March 3rd, 2026');
                    setLogseqView('journals');
                  }
                }}
                className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-500 text-xs font-bold rounded-lg cursor-pointer text-center block transition-all"
              >
                Reset Database to Mock Data
              </button>
            </div>
          )}

        </div>

        {/* LOGSEQ BOTTOM TAB NAVBAR */}
        <nav className="h-12 border-t border-slate-250 dark:border-slate-850 flex justify-around items-center bg-slate-50 dark:bg-slate-950/50 select-none z-10">
          <button
            onClick={() => { setLogseqView('journals'); setCurrentPageName('March 3rd, 2026'); }}
            className={`flex flex-col items-center p-1.5 cursor-pointer ${
              logseqView === 'journals' && currentPageName === 'March 3rd, 2026'
                ? 'text-emerald-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar size={15} />
            <span className="text-[8px] font-bold mt-0.5">Today</span>
          </button>

          <button
            onClick={() => setLogseqView('graph')}
            className={`flex flex-col items-center p-1.5 cursor-pointer ${
              logseqView === 'graph'
                ? 'text-emerald-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitMerge size={15} className="rotate-90" />
            <span className="text-[8px] font-bold mt-0.5">Graph</span>
          </button>

          <button
            onClick={() => setLogseqView('flashcards')}
            className={`flex flex-col items-center p-1.5 cursor-pointer ${
              logseqView === 'flashcards'
                ? 'text-emerald-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen size={15} />
            <span className="text-[8px] font-bold mt-0.5">Cards</span>
          </button>

          <button
            onClick={() => setLogseqView('pages-list')}
            className={`flex flex-col items-center p-1.5 cursor-pointer ${
              logseqView === 'pages-list'
                ? 'text-emerald-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List size={15} />
            <span className="text-[8px] font-bold mt-0.5">Pages</span>
          </button>

          <button
            onClick={() => setLogseqView('settings')}
            className={`flex flex-col items-center p-1.5 cursor-pointer ${
              logseqView === 'settings'
                ? 'text-emerald-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SettingsIcon size={15} />
            <span className="text-[8px] font-bold mt-0.5">Settings</span>
          </button>
        </nav>

        {/* LOGSEQ SIDEBAR SLIDING DRAWER */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          pageName={sidebarPageName}
          pages={pages}
          onUpdatePageBlocks={handleUpdatePageBlocks}
          onNavigate={(page) => handleNavigate(page, false)}
          theme={logseqSettings.theme}
          fontSize={logseqSettings.fontSize}
        />

      </div>
    );
  }
}
