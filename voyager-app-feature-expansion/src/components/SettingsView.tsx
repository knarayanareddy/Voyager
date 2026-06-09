import { useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Sun, Moon, Monitor, Zap, Battery, Wifi, Volume2, Type, Palette, Globe, Database } from 'lucide-react';

export default function SettingsView() {
  const { state, dispatch } = useDatabase();
  const { settings } = state;

  const update = (partial: Partial<typeof settings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: partial });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const vault = {
      version: 1,
      exportedAt: new Date().toISOString(),
      db: state.db,
      favorites: state.favorites,
      settings: state.settings,
    };
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voyager-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const vault = JSON.parse(text);
      if (!vault.version || !vault.db) throw new Error('Invalid vault file');
      // Build a complete, clean DatabaseState from the vault — no stale runtime fields
      dispatch({
        type: 'HYDRATE',
        state: {
          db: vault.db,
          favorites: vault.favorites || [],
          settings: { ...state.settings, ...(vault.settings || {}) },
          mediaAttachments: [],
          audioNotes: [],
          currentPageId: Object.keys(vault.db)[0] || '',
          sidebarPageId: null,
          activeView: 'editor' as const,
          backlinksRaw: {},
          dirtyPageIds: [],
          reviews: {},
        } as any,
      });
      alert('Vault restored! Reloading...');
      window.location.reload();
    } catch (e) {
      alert('Import failed: ' + (e as Error).message);
    }
  };

  const BEZEL_COLORS = [
    { label: 'Phantom Black', value: '#0a0a0a' },
    { label: 'Botanic Green', value: '#2d3b2e' },
    { label: 'Cream', value: '#d4c5a9' },
    { label: 'Lavender', value: '#9b8ec4' },
    { label: 'Titanium', value: '#2c2c2e' },
  ];

  const ACCENT_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* Appearance */}
        <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Palette size={14} className="text-indigo-400" />
            <span className="text-white text-sm font-semibold">Appearance</span>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-slate-400 text-xs mb-2">Theme</p>
              <div className="flex gap-2">
                {(['dark', 'light', 'system'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => update({ theme: t })}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs border transition-colors ${
                      settings.theme === t ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'border-slate-700 text-slate-500 hover:text-white'
                    }`}
                  >
                    {t === 'dark' ? <Moon size={14} /> : t === 'light' ? <Sun size={14} /> : <Monitor size={14} />}
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-slate-400 text-xs mb-2">Accent Color</p>
              <div className="flex gap-2">
                {ACCENT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => update({ accentColor: c })}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${settings.accentColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-slate-400 text-xs mb-2">Bezel Color</p>
              <div className="flex gap-1.5 flex-wrap">
                {BEZEL_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => update({ bezelColor: c.value })}
                    className={`px-2.5 py-1 rounded-lg text-[10px] border transition-colors ${
                      settings.bezelColor === c.value ? 'border-indigo-500 text-indigo-300 bg-indigo-600/10' : 'border-slate-700 text-slate-500 hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Typography */}
        <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Type size={14} className="text-violet-400" />
            <span className="text-white text-sm font-semibold">Typography</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Font Size</span>
              <div className="flex items-center gap-2">
                <button onClick={() => update({ fontSize: Math.max(10, settings.fontSize - 1) })} className="w-6 h-6 rounded bg-slate-800 text-slate-300 flex items-center justify-center text-xs">−</button>
                <span className="text-white text-xs w-6 text-center">{settings.fontSize}</span>
                <button onClick={() => update({ fontSize: Math.min(20, settings.fontSize + 1) })} className="w-6 h-6 rounded bg-slate-800 text-slate-300 flex items-center justify-center text-xs">+</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Show [[Brackets]]</span>
              <button onClick={() => update({ showBrackets: !settings.showBrackets })} className={`w-10 h-5 rounded-full transition-colors ${settings.showBrackets ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform m-0.5 ${settings.showBrackets ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Open Journal on Launch</span>
              <button onClick={() => update({ alwaysOpenJournal: !settings.alwaysOpenJournal })} className={`w-10 h-5 rounded-full transition-colors ${settings.alwaysOpenJournal ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform m-0.5 ${settings.alwaysOpenJournal ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* System */}
        <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-white text-sm font-semibold">System</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Battery size={12} className="text-emerald-400" />
                <span className="text-slate-400 text-xs">Battery ({settings.batteryLevel}%)</span>
              </div>
              <button onClick={() => update({ charging: !settings.charging })} className={`w-10 h-5 rounded-full transition-colors ${settings.charging ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform m-0.5 ${settings.charging ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi size={12} className="text-blue-400" />
                <span className="text-slate-400 text-xs">5G Connected</span>
              </div>
              <span className="text-emerald-400 text-xs">Active</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 size={12} className="text-orange-400" />
                <span className="text-slate-400 text-xs">Navigation Mode</span>
              </div>
              <button
                onClick={() => update({ navMode: settings.navMode === 'buttons' ? 'gesture' : 'buttons' })}
                className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-lg"
              >
                {settings.navMode}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Auto Save</span>
              <button onClick={() => update({ autoSave: !settings.autoSave })} className={`w-10 h-5 rounded-full transition-colors ${settings.autoSave ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform m-0.5 ${settings.autoSave ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Custom CSS */}
        <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800">
          <p className="text-white text-sm font-semibold mb-2">Custom CSS</p>
          <textarea
            value={settings.customCSS}
            onChange={e => update({ customCSS: e.target.value })}
            placeholder="/* Write custom CSS here */"
            className="w-full bg-slate-800 text-emerald-300 font-mono text-xs p-2 rounded-xl border border-slate-700 resize-none outline-none focus:border-indigo-500"
            rows={5}
          />
          {settings.customCSS && (
            <style>{settings.customCSS}</style>
          )}
        </div>

        {/* Browser Preferences */}
        <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-cyan-400" />
            <span className="text-white text-sm font-semibold">Browser Preferences</span>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-slate-400 text-xs mb-1">Default Search Engine</p>
              <input
                type="text"
                value={(settings as any).browserSearchEngine ?? 'https://duckduckgo.com/?q='}
                onChange={e => update({ browserSearchEngine: e.target.value } as any)}
                placeholder="https://duckduckgo.com/?q="
                className="w-full bg-slate-800 text-slate-200 text-xs px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Save History</span>
              <button
                onClick={() => update({ browserSaveHistory: !((settings as any).browserSaveHistory ?? true) } as any)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  ((settings as any).browserSaveHistory ?? true) ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform m-0.5 ${
                  ((settings as any).browserSaveHistory ?? true) ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs">Strict Sandbox</span>
                <p className="text-slate-600 text-[10px] mt-0.5">Blocks scripts &amp; forms in embedded pages.</p>
              </div>
              <button
                onClick={() => update({ browserStrictSandbox: !((settings as any).browserStrictSandbox ?? true) } as any)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  ((settings as any).browserStrictSandbox ?? true) ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform m-0.5 ${
                  ((settings as any).browserStrictSandbox ?? true) ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Vault Backup */}
        <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Database size={14} className="text-emerald-400" />
            <span className="text-white text-sm font-semibold">Vault Backup</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex-1 py-2 rounded-xl text-xs border border-indigo-500 text-indigo-300 hover:bg-indigo-600/10 transition-colors"
            >
              Export Vault
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 rounded-xl text-xs border border-slate-500 text-slate-300 hover:bg-slate-700/40 transition-colors"
            >
              Import Vault
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                // Reset so the same file can be re-selected
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* About */}
        <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800 text-center">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-2">
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <p className="text-white font-bold text-sm">Voyager</p>
          <p className="text-slate-500 text-xs">Logseq Mobile for Android</p>
          <p className="text-slate-600 text-[10px] mt-1">v1.0.0 · React 19 · Tailwind CSS v4</p>
          <p className="text-slate-700 text-[9px] mt-2">© 2025 Voyager · Play Store Ready</p>
        </div>
      </div>
    </div>
  );
}
