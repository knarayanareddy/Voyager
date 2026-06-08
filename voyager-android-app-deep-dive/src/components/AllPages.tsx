import { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Search, Hash, Star, Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function AllPages() {
  const { state, dispatch, navigateTo, getAllTags } = useDatabase();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pages' | 'journals' | 'favorites' | 'tags'>('all');

  const allPages = Object.values(state.db);
  const tags = getAllTags();

  const filtered = allPages
    .filter(p => {
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filter === 'pages') return !p.isJournal;
      if (filter === 'journals') return p.isJournal;
      if (filter === 'favorites') return state.favorites.includes(p.id);
      return true;
    })
    .sort((a, b) => {
      if (a.isJournal && !b.isJournal) return -1;
      if (!a.isJournal && b.isJournal) return 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const handleNewPage = () => {
    const name = prompt('New page name:');
    if (name?.trim()) {
      dispatch({ type: 'CREATE_PAGE', name: name.trim(), navigate: true });
    }
  };

  const getDisplayName = (p: { name: string; isJournal: boolean }) => {
    if (p.isJournal) {
      try { return format(new Date(p.name + 'T12:00:00'), 'EEEE, MMM d, yyyy'); }
      catch { return p.name; }
    }
    return p.name;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-slate-200">All Pages</h2>
          <button
            onClick={handleNewPage}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Plus size={12} /> New
          </button>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-2"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Search size={12} className="text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Filter pages..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: `All (${allPages.length})` },
            { id: 'pages', label: `Pages (${allPages.filter(p => !p.isJournal).length})` },
            { id: 'journals', label: `Journals (${allPages.filter(p => p.isJournal).length})` },
            { id: 'favorites', label: `⭐ (${state.favorites.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap ${
                filter === tab.id
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              style={{
                background: filter === tab.id ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                border: filter === tab.id ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tags section */}
      {filter === 'all' && Object.keys(tags).length > 0 && (
        <div className="px-3 mb-2 shrink-0">
          <div className="flex items-center gap-1 flex-wrap">
            <Hash size={11} className="text-slate-600" />
            {Object.keys(tags).slice(0, 10).map(tag => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className="text-[10px] px-2 py-0.5 rounded-full transition-all hover:opacity-80"
                style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Page list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="text-2xl mb-2">📭</div>
            <p className="text-xs text-slate-400">No pages found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map(page => (
              <button
                key={page.id}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-white/4 transition-all text-left group"
                style={{ border: '1px solid rgba(255,255,255,0.04)' }}
                onClick={() => navigateTo(page.id)}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                  style={{ background: page.isJournal ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)' }}
                >
                  {page.properties?.icon || (page.isJournal ? '📅' : '📄')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate group-hover:text-slate-100 transition-colors">
                    {getDisplayName(page)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-slate-600">
                      {page.blocks.length} block{page.blocks.length !== 1 ? 's' : ''}
                    </span>
                    {page.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] text-emerald-600">#{tag}</span>
                    ))}
                  </div>
                </div>
                {state.favorites.includes(page.id) && (
                  <Star size={11} className="text-amber-400 shrink-0" fill="#f59e0b" />
                )}
                <button
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_FAVORITE', pageId: page.id }); }}
                  title={state.favorites.includes(page.id) ? 'Remove favorite' : 'Add favorite'}
                >
                  <Star
                    size={11}
                    className={state.favorites.includes(page.id) ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}
                    fill={state.favorites.includes(page.id) ? '#f59e0b' : 'none'}
                  />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
