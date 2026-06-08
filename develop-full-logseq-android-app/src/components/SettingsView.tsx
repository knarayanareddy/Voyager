import { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import {
  Sun, Moon, Monitor, Download, Upload, Trash2,
  ToggleLeft, ToggleRight, Shield, Zap
} from 'lucide-react';

const ACCENT_COLORS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Green', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Pink', value: '#ec4899' },
];

const FONT_FAMILIES = [
  { label: 'Inter (Default)', value: 'Inter, system-ui, sans-serif' },
  { label: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'System UI', value: 'system-ui, sans-serif' },
];

export default function SettingsView() {
  const { state, dispatch, getAllPages } = useDatabase();
  const { settings } = state;
  const [customCSSValue, setCustomCSSValue] = useState(settings.customCSS);


  const update = (patch: Partial<typeof settings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: patch });
  };

  const exportData = (format: 'json' | 'markdown') => {
    const pages = getAllPages();
    let content = '';

    if (format === 'json') {
      content = JSON.stringify({ pages: state.db, exportedAt: new Date().toISOString() }, null, 2);
    } else {
      pages.forEach(page => {
        content += `# ${page.name}\n\n`;
        function writeBlocks(blocks: any[], indent = '') {
          blocks.forEach(b => {
            const task = b.taskStatus ? `${b.taskStatus} ` : '';
            content += `${indent}- ${task}${b.content}\n`;
            if (b.children.length) writeBlocks(b.children, indent + '  ');
          });
        }
        writeBlocks(page.blocks);
        content += '\n---\n\n';
      });
    }

    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logseq-export-${Date.now()}.${format === 'json' ? 'json' : 'md'}`;
    a.click();
    URL.revokeObjectURL(url);

  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.pages) {
          // Merge imported pages
          Object.entries(data.pages).forEach(([id, page]: [string, any]) => {
            if (!state.db[id]) {
              dispatch({ type: 'APPEND_BLOCK_TO_PAGE', pageId: 'logseq-guide', content: `Imported: [[${page.name}]]` });
            }
          });
          alert('Import complete! Refresh to see all changes.');
        }
      } catch { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
  };

  const clearData = () => {
    if (confirm('Are you sure? This will delete ALL notes and cannot be undone.')) {
      localStorage.removeItem('logseq-mobile-db');
      localStorage.removeItem('logseq-flashcards');
      window.location.reload();
    }
  };

  const stats = {
    pages: Object.keys(state.db).length,
    journals: Object.values(state.db).filter(p => p.isJournal).length,
    blocks: Object.values(state.db).reduce((acc, p) => {
      function count(blocks: any[]): number { return blocks.reduce((a, b) => a + 1 + count(b.children), 0); }
      return acc + count(p.blocks);
    }, 0),
    storageKB: Math.round(JSON.stringify(state.db).length / 1024),
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-5">
      <h3 className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-text-tertiary)] px-4 mb-2">{title}</h3>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl mx-3 overflow-hidden">
        {children}
      </div>
    </div>
  );

  const SettingRow = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]/50 last:border-0">
      <div>
        <div className="text-sm text-[var(--color-text-primary)]">{label}</div>
        {sub && <div className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{sub}</div>}
      </div>
      <div className="ml-4 shrink-0">{children}</div>
    </div>
  );

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} className={`transition-colors ${value ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)]'}`}>
      {value ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)] overflow-y-auto pb-6">
      <div className="px-4 pt-4 pb-3 shrink-0">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">⚙️ Settings</h2>
      </div>

      {/* Database stats */}
      <Section title="Database">
        <div className="px-4 py-3 grid grid-cols-4 gap-2">
          {[
            { label: 'Pages', value: stats.pages },
            { label: 'Journals', value: stats.journals },
            { label: 'Blocks', value: stats.blocks },
            { label: 'Size', value: `${stats.storageKB}KB` },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-lg font-bold text-[var(--color-accent)]">{s.value}</div>
              <div className="text-[10px] text-[var(--color-text-tertiary)]">{s.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <SettingRow label="Theme">
          <div className="flex gap-1">
            {(['light', 'dark', 'system'] as const).map(t => (
              <button
                key={t}
                onClick={() => update({ theme: t })}
                className={`p-2 rounded-lg transition-colors ${settings.theme === t ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]'}`}
                title={t}
              >
                {t === 'light' ? <Sun size={16} /> : t === 'dark' ? <Moon size={16} /> : <Monitor size={16} />}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Accent Color">
          <div className="flex gap-1.5 flex-wrap justify-end max-w-[160px]">
            {ACCENT_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => update({ accentColor: c.value })}
                className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-90 ${settings.accentColor === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ background: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Font Size" sub={`${settings.fontSize}px`}>
          <input
            type="range" min={11} max={20} step={1}
            value={settings.fontSize}
            onChange={e => update({ fontSize: Number(e.target.value) })}
            className="w-24 accent-[var(--color-accent)]"
          />
        </SettingRow>
        <SettingRow label="Font Family">
          <select
            value={settings.fontFamily}
            onChange={e => update({ fontFamily: e.target.value })}
            className="bg-[var(--color-surface-2)] text-[var(--color-text-primary)] text-xs rounded-lg px-2 py-1.5 border border-[var(--color-border)] outline-none max-w-[140px]"
          >
            {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </SettingRow>
      </Section>

      {/* Editor */}
      <Section title="Editor">
        <SettingRow label="Show link brackets" sub="Display [[ ]] in rendered text">
          <Toggle value={settings.showBrackets} onChange={v => update({ showBrackets: v })} />
        </SettingRow>
        <SettingRow label="Spell check">
          <Toggle value={settings.enableSpellCheck} onChange={v => update({ enableSpellCheck: v })} />
        </SettingRow>
        <SettingRow label="Auto-save" sub="Save changes automatically">
          <Toggle value={settings.autoSave} onChange={v => update({ autoSave: v })} />
        </SettingRow>
      </Section>

      {/* Custom CSS */}
      <Section title="Custom CSS">
        <div className="p-3">
          <textarea
            value={customCSSValue}
            onChange={e => setCustomCSSValue(e.target.value)}
            placeholder="/* Write custom CSS here */&#10;.block-container { ... }"
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-accent-green)] outline-none resize-none h-28"
            spellCheck={false}
          />
          <button
            onClick={() => update({ customCSS: customCSSValue })}
            className="mt-2 w-full py-2 bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-lg text-sm font-medium"
          >
            Apply CSS
          </button>
        </div>
      </Section>

      {/* Data */}
      <Section title="Data & Privacy">
        <SettingRow label="Export as Markdown">
          <button onClick={() => exportData('markdown')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-accent)]/15 text-[var(--color-accent)] rounded-lg text-xs font-medium">
            <Download size={12} /> Export .md
          </button>
        </SettingRow>
        <SettingRow label="Export as JSON">
          <button onClick={() => exportData('json')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-accent)]/15 text-[var(--color-accent)] rounded-lg text-xs font-medium">
            <Download size={12} /> Export .json
          </button>
        </SettingRow>
        <SettingRow label="Import JSON">
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] rounded-lg text-xs font-medium cursor-pointer">
            <Upload size={12} /> Import
            <input type="file" accept=".json" className="hidden" onChange={importData} />
          </label>
        </SettingRow>
        <SettingRow label="Clear all data" sub="Permanently delete everything">
          <button onClick={clearData} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 text-red-400 rounded-lg text-xs font-medium">
            <Trash2 size={12} /> Clear
          </button>
        </SettingRow>
      </Section>

      {/* About */}
      <Section title="About">
        <SettingRow label="Logseq Mobile" sub="Full-featured local knowledge base">
          <span className="text-xs text-[var(--color-text-tertiary)]">v1.0.0</span>
        </SettingRow>
        <SettingRow label="Privacy" sub="All data stored locally on device">
          <Shield size={14} className="text-green-400" />
        </SettingRow>
        <SettingRow label="Open Source" sub="Inspired by Logseq">
          <Zap size={14} className="text-[var(--color-accent)]" />
        </SettingRow>
      </Section>
    </div>
  );
}
