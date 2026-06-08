import { useState, useRef, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Search, X, Hash, FileText, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function SearchView({ onClose }: { onClose?: () => void }) {
  const { search, navigateTo, getAllTags, getAllPages } = useDatabase();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReturnType<typeof search>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'pages' | 'tags'>('search');

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    setResults(query.trim() ? search(query) : []);
  }, [query, search]);

  const tags = getAllTags();
  const pages = getAllPages();

  const highlight = (text: string, q: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-[var(--color-accent)]/30 text-[var(--color-accent)] rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const handleNavigate = (pageId: string) => {
    navigateTo(pageId);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)]">
      {/* Search input */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-2 bg-[var(--color-surface)] rounded-xl px-3 py-2 border border-[var(--color-border)]">
          <Search size={16} className="text-[var(--color-text-tertiary)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, blocks, tags..."
            className="flex-1 bg-transparent text-[var(--color-text-primary)] text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
              <X size={14} />
            </button>
          )}
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          {(['search', 'pages', 'tags'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === tab ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]'}`}
            >
              {tab === 'search' ? '🔍 Results' : tab === 'pages' ? '📄 All Pages' : '# Tags'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* SEARCH RESULTS */}
        {activeTab === 'search' && (
          <div>
            {!query && (
              <div className="px-4 pt-4">
                <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-2">Recent Pages</h3>
                {pages.slice(0, 8).map(page => (
                  <button
                    key={page.id}
                    onClick={() => handleNavigate(page.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-left transition-colors mb-0.5"
                  >
                    <span className="text-[var(--color-text-tertiary)]">
                      {page.isJournal ? <Calendar size={14} /> : <FileText size={14} />}
                    </span>
                    <span className="text-sm text-[var(--color-text-primary)] flex-1">{page.name}</span>
                    <ChevronRight size={12} className="text-[var(--color-text-tertiary)]" />
                  </button>
                ))}
              </div>
            )}
            {query && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-tertiary)]">
                <Search size={32} className="mb-3 opacity-30" />
                <p className="text-sm">No results for "{query}"</p>
                <button
                  onClick={() => {
                    navigateTo(query);
                    onClose?.();
                  }}
                  className="mt-3 px-4 py-2 bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-lg text-sm"
                >
                  Create page "{query}"
                </button>
              </div>
            )}
            {results.map((r, i) => (
              <button
                key={`${r.pageId}-${r.blockId}-${i}`}
                onClick={() => handleNavigate(r.pageId)}
                className="w-full text-left px-4 py-3 hover:bg-[var(--color-surface-hover)] border-b border-[var(--color-border)]/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[var(--color-text-tertiary)]">
                    {r.isJournal ? <Calendar size={12} /> : <FileText size={12} />}
                  </span>
                  <span className="text-[10px] text-[var(--color-accent)] font-medium">{r.pageName}</span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                  {highlight(r.content, query)}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* ALL PAGES */}
        {activeTab === 'pages' && (
          <div className="p-3">
            <div className="mb-3">
              <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide px-2 mb-2">
                Journals ({pages.filter(p => p.isJournal).length})
              </h3>
              {pages.filter(p => p.isJournal).map(page => (
                <button
                  key={page.id}
                  onClick={() => handleNavigate(page.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-left mb-0.5"
                >
                  <Calendar size={13} className="text-[var(--color-accent)] shrink-0" />
                  <span className="text-sm text-[var(--color-text-primary)] flex-1">
                    {(() => { try { return format(new Date(page.name + 'T12:00:00'), 'EEE, MMM d yyyy'); } catch { return page.name; } })()}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">{page.blocks.length} blocks</span>
                </button>
              ))}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide px-2 mb-2">
                Pages ({pages.filter(p => !p.isJournal).length})
              </h3>
              {pages.filter(p => !p.isJournal).map(page => (
                <button
                  key={page.id}
                  onClick={() => handleNavigate(page.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-left mb-0.5"
                >
                  <span className="text-base">{page.properties?.icon || '📄'}</span>
                  <span className="text-sm text-[var(--color-text-primary)] flex-1">{page.name}</span>
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">{page.blocks.length} blocks</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAGS */}
        {activeTab === 'tags' && (
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(tags).map(([tag, pageIds]) => (
                <button
                  key={tag}
                  onClick={() => { setQuery(`#${tag}`); setActiveTab('search'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-sm font-medium hover:bg-[var(--color-accent)]/25 transition-colors"
                >
                  <Hash size={11} />
                  {tag}
                  <span className="text-[10px] opacity-60 ml-0.5">{pageIds.length}</span>
                </button>
              ))}
            </div>
            {Object.keys(tags).length === 0 && (
              <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                No tags yet. Use #tag in your notes.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
