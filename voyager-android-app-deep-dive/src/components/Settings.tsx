import { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import {
  Palette, Type, Shield, Cpu, Download, Trash2,
  Moon, Sun, Monitor, ChevronRight, Code2, ToggleLeft, ToggleRight,
  Smartphone, Zap
} from 'lucide-react';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const ACCENT_COLORS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Orange', value: '#f97316' },
];

const BEZEL_COLORS = [
  { label: 'Phantom Black', value: '#0a0a0a' },
  { label: 'Botanic Green', value: '#2d3b2e' },
  { label: 'Cream', value: '#d4c5a9' },
  { label: 'Lavender', value: '#9b8ec4' },
  { label: 'Titanium', value: '#2c2c2e' },
  { label: 'Graphite', value: '#38383a' },
];

export default function Settings() {
  const { state, dispatch } = useDatabase();
  const { settings } = state;
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [cssValue, setCssValue] = useState(settings.customCSS);

  const sections: SettingsSection[] = [
    { id: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
    { id: 'editor', label: 'Editor', icon: <Type size={15} /> },
    { id: 'device', label: 'Device', icon: <Smartphone size={15} /> },
    { id: 'css', label: 'Custom CSS', icon: <Code2 size={15} /> },
    { id: 'data', label: 'Data & Privacy', icon: <Shield size={15} /> },
    { id: 'about', label: 'About Voyager', icon: <Cpu size={15} /> },
  ];

  const updateSetting = (key: string, value: unknown) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: { [key]: value } as any });
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} className="shrink-0">
      {value
        ? <ToggleRight size={22} style={{ color: '#6366f1' }} />
        : <ToggleLeft size={22} className="text-slate-600" />
      }
    </button>
  );

  const SettingRow = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <div className="text-xs font-medium text-slate-300">{label}</div>
        {desc && <div className="text-[10px] text-slate-600 mt-0.5">{desc}</div>}
      </div>
      {children}
    </div>
  );

  // Section content
  const renderSection = () => {
    switch (activeSection) {
      case 'appearance':
        return (
          <div className="px-4 py-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Theme</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { value: 'dark', icon: <Moon size={16} />, label: 'Dark' },
                { value: 'light', icon: <Sun size={16} />, label: 'Light' },
                { value: 'system', icon: <Monitor size={16} />, label: 'System' },
              ].map(t => (
                <button
                  key={t.value}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                    settings.theme === t.value
                      ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                      : 'border-white/8 bg-white/3 text-slate-500 hover:bg-white/6'
                  }`}
                  onClick={() => updateSetting('theme', t.value)}
                >
                  {t.icon}
                  <span className="text-[10px] font-medium">{t.label}</span>
                </button>
              ))}
            </div>

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Accent Color</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {ACCENT_COLORS.map(c => (
                <button
                  key={c.value}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    background: c.value,
                    borderColor: settings.accentColor === c.value ? 'white' : 'transparent',
                    transform: settings.accentColor === c.value ? 'scale(1.2)' : 'scale(1)',
                  }}
                  onClick={() => updateSetting('accentColor', c.value)}
                  title={c.label}
                />
              ))}
            </div>

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Font Size</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateSetting('fontSize', Math.max(11, settings.fontSize - 1))}
                className="w-8 h-8 rounded-lg bg-white/8 text-slate-300 flex items-center justify-center font-bold hover:bg-white/12 transition-colors"
              >
                A-
              </button>
              <div className="flex-1 text-center">
                <div className="text-sm font-bold text-slate-200">{settings.fontSize}px</div>
                <div className="text-[10px] text-slate-600">Font size</div>
              </div>
              <button
                onClick={() => updateSetting('fontSize', Math.min(20, settings.fontSize + 1))}
                className="w-8 h-8 rounded-lg bg-white/8 text-slate-300 flex items-center justify-center font-bold hover:bg-white/12 transition-colors"
              >
                A+
              </button>
            </div>
          </div>
        );

      case 'editor':
        return (
          <div className="px-4 py-3">
            <SettingRow label="Show Brackets" desc="Display [[ ]] around page links">
              <Toggle value={settings.showBrackets} onChange={v => updateSetting('showBrackets', v)} />
            </SettingRow>
            <SettingRow label="Spell Check" desc="Enable browser spell checking">
              <Toggle value={settings.enableSpellCheck} onChange={v => updateSetting('enableSpellCheck', v)} />
            </SettingRow>
            <SettingRow label="Auto Save" desc="Save changes automatically">
              <Toggle value={settings.autoSave} onChange={v => updateSetting('autoSave', v)} />
            </SettingRow>
          </div>
        );

      case 'device':
        return (
          <div className="px-4 py-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Bezel Color</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {BEZEL_COLORS.map(c => (
                <button
                  key={c.value}
                  className="flex flex-col items-center gap-1"
                  onClick={() => updateSetting('bezelColor', c.value)}
                >
                  <div
                    className="w-10 h-10 rounded-xl border-2 transition-all"
                    style={{
                      background: c.value,
                      borderColor: settings.bezelColor === c.value ? '#818cf8' : 'rgba(255,255,255,0.1)',
                      transform: settings.bezelColor === c.value ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                  <span className="text-[8px] text-slate-600 text-center leading-tight max-w-[40px]">{c.label}</span>
                </button>
              ))}
            </div>

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Navigation Mode</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { value: 'buttons', label: 'Button Nav', desc: '3-button classic' },
                { value: 'gesture', label: 'Gesture Nav', desc: 'Swipe modern' },
              ].map(m => (
                <button
                  key={m.value}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    settings.navMode === m.value
                      ? 'border-indigo-500/50 bg-indigo-500/15'
                      : 'border-white/8 bg-white/3 hover:bg-white/6'
                  }`}
                  onClick={() => updateSetting('navMode', m.value)}
                >
                  <div className="text-xs font-semibold text-slate-200">{m.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>

            <SettingRow label="Charging" desc="Simulate USB-C charging">
              <Toggle value={settings.charging} onChange={v => updateSetting('charging', v)} />
            </SettingRow>

            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">Battery Level</span>
                <span className="text-xs font-bold text-slate-300">{settings.batteryLevel}%</span>
              </div>
              <input
                type="range" min={0} max={100}
                value={settings.batteryLevel}
                onChange={e => updateSetting('batteryLevel', Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>
        );

      case 'css':
        return (
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 flex items-center justify-between border-b border-white/6">
              <div>
                <div className="text-xs font-semibold text-slate-200">Custom CSS</div>
                <div className="text-[10px] text-slate-600">Injected live into the outliner</div>
              </div>
              <button
                onClick={() => {
                  dispatch({ type: 'UPDATE_SETTINGS', settings: { customCSS: cssValue } });
                  alert('✅ CSS applied!');
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                Apply
              </button>
            </div>
            <textarea
              value={cssValue}
              onChange={e => setCssValue(e.target.value)}
              className="flex-1 px-4 py-3 bg-transparent text-[11px] font-mono text-green-400 resize-none outline-none"
              style={{ fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.7 }}
              placeholder={`.logseq-editor {\n  font-size: 15px;\n  line-height: 1.8;\n}\n\n.md-link {\n  color: #f43f5e;\n}`}
              spellCheck={false}
            />
          </div>
        );

      case 'data':
        return (
          <div className="px-4 py-4">
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
              <div className="px-3 py-3 border-b border-white/5">
                <div className="text-xs font-semibold text-slate-300">Export Data</div>
                <div className="text-[10px] text-slate-600 mt-0.5">Download your knowledge base</div>
              </div>
              <button
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/4"
                onClick={() => {
                  const data = JSON.stringify(state.db, null, 2);
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'voyager-export.json';
                  a.click(); URL.revokeObjectURL(url);
                }}
              >
                <Download size={14} className="text-slate-400" />
                <div>
                  <div className="text-xs text-slate-300">Export as JSON</div>
                  <div className="text-[10px] text-slate-600">{Object.keys(state.db).length} pages</div>
                </div>
                <ChevronRight size={12} className="ml-auto text-slate-600" />
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors text-left"
                onClick={() => {
                  const pages = Object.values(state.db);
                  const md = pages.map(p => `# ${p.name}\n\n${p.blocks.map(b => `- ${b.content}`).join('\n')}`).join('\n\n---\n\n');
                  const blob = new Blob([md], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'voyager-export.md';
                  a.click(); URL.revokeObjectURL(url);
                }}
              >
                <Download size={14} className="text-slate-400" />
                <div>
                  <div className="text-xs text-slate-300">Export as Markdown</div>
                  <div className="text-[10px] text-slate-600">All pages in .md format</div>
                </div>
                <ChevronRight size={12} className="ml-auto text-slate-600" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
              <div className="px-3 py-3 border-b border-red-500/10">
                <div className="text-xs font-semibold text-red-400">Danger Zone</div>
              </div>
              <button
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-red-500/10 transition-colors text-left"
                onClick={() => {
                  if (confirm('Reset all data? This cannot be undone.')) {
                    dispatch({ type: 'RESET_DATABASE' });
                  }
                }}
              >
                <Trash2 size={14} className="text-red-400" />
                <div>
                  <div className="text-xs text-red-400">Reset Database</div>
                  <div className="text-[10px] text-slate-600">Restore to initial state</div>
                </div>
              </button>
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="px-4 py-4">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🚀</div>
              <div className="text-sm font-bold text-slate-200">Voyager</div>
              <div className="text-[11px] text-slate-500">Logseq for Android · v1.0.0</div>
            </div>

            <div className="space-y-2">
              {[
                { label: 'Build', value: 'Production · Vite 5' },
                { label: 'Framework', value: 'React 19 + TypeScript' },
                { label: 'Styling', value: 'Tailwind CSS v4' },
                { label: 'Pages', value: `${Object.keys(state.db).length} pages stored` },
                { label: 'Storage', value: 'Local-first · No cloud' },
                { label: 'Blocks', value: (() => {
                  function collectBlocks(blocks: any[]): any[] { return blocks.reduce((a, b) => [...a, b, ...collectBlocks(b.children)], []); }
                  return Object.values(state.db).reduce((a, p) => a + collectBlocks(p.blocks).length, 0) + ' blocks';
                })() },
              ].map(item => (
                <div key={item.label} className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-[11px] text-slate-500">{item.label}</span>
                  <span className="text-[11px] text-slate-300 font-medium">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 p-3 rounded-xl text-center" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Zap size={12} className="text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-300">Privacy-First</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                All data stored locally. No account required. No telemetry. No cloud sync.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (activeSection) {
    const section = sections.find(s => s.id === activeSection);
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-white/6 shrink-0">
          <button
            onClick={() => setActiveSection(null)}
            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Settings
          </button>
          <div className="flex items-center gap-2 ml-2">
            <span style={{ color: '#818cf8' }}>{section?.icon}</span>
            <span className="text-xs font-bold text-slate-200">{section?.label}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {renderSection()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-3 shrink-0">
        <h2 className="text-sm font-bold text-slate-200">⚙️ Settings</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">Customize Voyager</p>
      </div>

      <div className="px-3 space-y-1">
        {sections.map(section => (
          <button
            key={section.id}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all text-left group"
            style={{ border: '1px solid rgba(255,255,255,0.05)' }}
            onClick={() => setActiveSection(section.id)}
          >
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
            >
              {section.icon}
            </span>
            <span className="text-xs font-medium text-slate-300 group-hover:text-slate-100 transition-colors">
              {section.label}
            </span>
            <ChevronRight size={12} className="ml-auto text-slate-600 group-hover:text-slate-400 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
