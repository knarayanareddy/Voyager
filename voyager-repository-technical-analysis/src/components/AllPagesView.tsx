import { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Page } from '../types';
import { Search, Star, Calendar, FileText, SortAsc } from 'lucide-react';

type SortMode = 'alpha' | 'updated' | 'created';

export default function AllPagesView() {
  const { state, navigateTo, dispatch } = useDatabase();
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('alpha');
  const [showJournals, setShowJournals] = useState(false);

  const allPages = Object.values(state.db);

  const filtered = allPages
    .filter(p => {
      if (!showJournals && p.isJournal) return false;
      if (query) return p.name.toLowerCase().includes(query.toLowerCase()) || p.tags.some(t => t.includes(query.toLowerCase()));
      return true;
    })
    .sort((a, b) => {
      if (sortMode === 'alpha') return a.name.localeCompare(b.name);
      if (sortMode === 'updated') return b.updatedAt.localeCompare(a.updatedAt);
      return b.createdAt.localeCompare(a.createdAt);
    });

  const journals = allPages.filter(p => p.isJournal);
  const pages = allPages.filter(p => !p.isJournal);

  function blockCount(page: Page): number {
    let n = 0;
    function walk(blocks: Page['blocks']) {
      n += blocks.length;
      blocks.forEach(b => { if (b.children.length) walk(b.children); });
    }
    walk(page.blocks);
    return n;
  }

  return (
    <div className="flex flex-col h-full px-3 py-3 gap-3">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Pages', count: pages.length, icon: '📄' },
          { label: 'Journals', count: journals.length, icon: '📅' },
          { label: 'Total', count: allPages.length, icon: '📚' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 text-center">
            <p className="text-lg">{s.icon}</p>
            <p className="text-white font-bold text-lg leading-tight">{s.count}</p>
            <p className="text-slate-500 text-[10px]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + controls */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
          <Search size={13} className="text-slate-500 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter pages…"
            className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
          />
        </div>
        <button
          onClick={() => setShowJournals(j => !j)}
          className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${showJournals ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          <Calendar size={13} />
        </button>
        <button
          onClick={() => setSortMode(s => s === 'alpha' ? 'updated' : s === 'updated' ? 'created' : 'alpha')}
          className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title={`Sort: ${sortMode}`}
        >
          <SortAsc size={13} />
        </button>
      </div>

      {/* Page list */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {filtered.map(page => {
          const bc = blockCount(page);
          const isFav = state.favorites.includes(page.id);
          return (
            <button
              key={page.id}
              onClick={() => navigateTo(page.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl border text-left transition-all hover:scale-[1.01] ${
                state.currentPageId === page.id
                  ? 'bg-indigo-900/30 border-indigo-500/40'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span className="text-xl flex-shrink-0">
                {page.properties?.icon || (page.isJournal ? '📅' : '📄')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-slate-100 text-sm font-medium truncate">{page.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-slate-600 text-[10px]">{bc} blocks</span>
                  {page.tags.slice(0, 2).map(t => (
                    <span key={t} className="text-cyan-500 text-[10px]">#{t}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={e => {
                  e.stopPropagation();
                  dispatch({ type: 'TOGGLE_FAVORITE', pageId: page.id });
                }}
                className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isFav ? 'text-amber-400' : 'text-slate-700 hover:text-amber-400'}`}
              >
                <Star size={13} fill={isFav ? 'currentColor' : 'none'} />
              </button>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-600">
            <FileText size={32} />
            <p className="text-sm">No pages found</p>
          </div>
        )}
      </div>
    </div>
  );
}
