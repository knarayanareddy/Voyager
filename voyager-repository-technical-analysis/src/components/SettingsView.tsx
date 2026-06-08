import { useDatabase } from '../context/DatabaseContext';
import { clearState } from '../lib/persistence';
import { Sun, Moon, Monitor, Zap, Battery, Wifi, Volume2, Type, Palette, Trash2 } from 'lucide-react';

const BEZEL_COLORS = [
  { label: 'Phantom Black', value: '#0a0a0a' },
  { label: 'Botanic Green', value: '#2d3b2e' },
  { label: 'Cream', value: '#d4c5a9' },
  { label: 'Lavender', value: '#9b8ec4' },
  { label: 'Titanium', value: '#2c2c2e' },
];

const ACCENT_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function SettingsView() {
  const { state, dispatch } = useDatabase();
  const { settings } = state;

  const update = (partial: Partial<typeof settings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: partial });
  };

  const handleClearData = async () => {
    if (confirm('Clear all persisted data? This will reset the app on next reload.')) {
      await clearState();
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-y-auto">
      <div className="p-3 space-y-4">

        {/* Appearance */}
        <section className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={14} className="text-indigo-400" />
            <span className="text-white text-sm font-semibold">Appearance</span>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-slate-400 text-xs mb-2">Theme</p>
              <div className="flex gap-2">
                {(['dark', 'light', 'system'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => update({ theme: t })}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs border transition-colors ${
                      settings.theme === t
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'border-slate-700 text-slate-500 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    {t === 'dark' ? <Moon size={14} /> : t === 'light' ? <Sun size={14} /> : <Monitor size={14} />}
                    <span className="capitalize">{t}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-slate-400 text-xs mb-2">Accent Color</p>
              <div className="flex gap-2 flex-wrap">
                {ACCENT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => update({ accentColor: c })}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${settings.accentColor === c ? 'border-white scale-110' : 'border-transparent'}`}
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
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] border transition-colors ${
                      settings.bezelColor === c.value
                        ? 'border-indigo-500 text-indigo-300 bg-indigo-600/10'
                        : 'border-slate-700 text-slate-500 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full border border-slate-700" style={{ background: c.value }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <Type size={14} className="text-violet-400" />
            <span className="text-white text-sm font-semibold">Typography</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Font Size</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => update({ fontSize: Math.max(10, settings.fontSize - 1) })}
                  className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-base hover:bg-slate-700 transition-colors"
                >
                  −
                </button>
                <span className="text-white text-sm font-mono w-6 text-center">{settings.fontSize}</span>
                <button
                  onClick={() => update({ fontSize: Math.min(20, settings.fontSize + 1) })}
                  className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-base hover:bg-slate-700 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Show [[Brackets]]</span>
              <button
                onClick={() => update({ showBrackets: !settings.showBrackets })}
                className={`w-11 h-6 rounded-full transition-colors relative ${settings.showBrackets ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.showBrackets ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Spell Check</span>
              <button
                onClick={() => update({ enableSpellCheck: !settings.enableSpellCheck })}
                className={`w-11 h-6 rounded-full transition-colors relative ${settings.enableSpellCheck ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.enableSpellCheck ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </section>

        {/* System */}
        <section className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-white text-sm font-semibold">System Simulation</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Battery size={13} className="text-emerald-400" />
                <span className="text-slate-400 text-xs">Battery ({settings.batteryLevel}%)</span>
              </div>
              <button
                onClick={() => update({ charging: !settings.charging })}
                className={`w-11 h-6 rounded-full transition-colors relative ${settings.charging ? 'bg-emerald-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.charging ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi size={13} className="text-blue-400" />
                <span className="text-slate-400 text-xs">5G Connected</span>
              </div>
              <span className="text-emerald-400 text-xs font-medium">Active</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 size={13} className="text-orange-400" />
                <span className="text-slate-400 text-xs">Nav Mode</span>
              </div>
              <button
                onClick={() => update({ navMode: settings.navMode === 'buttons' ? 'gesture' : 'buttons' })}
                className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors font-medium"
              >
                {settings.navMode === 'buttons' ? '◄ ● ■ Buttons' : '— Gesture'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Auto Save</span>
              <button
                onClick={() => update({ autoSave: !settings.autoSave })}
                className={`w-11 h-6 rounded-full transition-colors relative ${settings.autoSave ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.autoSave ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Custom CSS */}
        <section className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-white text-sm font-semibold mb-3">Custom CSS</p>
          <textarea
            value={settings.customCSS}
            onChange={e => update({ customCSS: e.target.value })}
            placeholder=".voyager-block { ... }"
            rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs font-mono outline-none focus:border-indigo-500 transition-colors resize-none placeholder-slate-700"
          />
        </section>

        {/* Data management */}
        <section className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-white text-sm font-semibold mb-3">Data Management</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 text-xs">Pages stored</span>
              <span className="text-white text-xs font-mono">{Object.keys(state.db).length}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 text-xs">Audio notes</span>
              <span className="text-white text-xs font-mono">{state.audioNotes.length}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 text-xs">Storage</span>
              <span className="text-emerald-400 text-xs">IndexedDB</span>
            </div>
          </div>
          <button
            onClick={handleClearData}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-900/30 border border-rose-800/50 text-rose-400 text-xs font-medium hover:bg-rose-900/50 transition-colors"
          >
            <Trash2 size={13} />
            Clear Persisted Data
          </button>
        </section>

        {/* About */}
        <section className="bg-slate-900 rounded-2xl p-4 border border-slate-800 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-3 shadow-lg shadow-indigo-600/30">
            V
          </div>
          <p className="text-white font-bold">Voyager</p>
          <p className="text-slate-400 text-xs mt-0.5">Logseq Mobile • Samsung S23 Ultra Simulator</p>
          <p className="text-slate-600 text-[10px] mt-2">v1.0.0 • Local-first • No cloud dependency</p>
        </section>
      </div>
    </div>
  );
}
