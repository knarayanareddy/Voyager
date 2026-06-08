import { useDatabase } from '../context/DatabaseContext';
import { X, Calendar, Star, StarOff, Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function Sidebar({ onNavigate }: { onNavigate: (pageId: string) => void }) {
  const { state, dispatch, getJournalPages, getAllPages } = useDatabase();
  const journalPages = getJournalPages().slice(0, 10);
  const allPages = getAllPages().filter(p => !p.isJournal);
  const favorites = state.favorites.map(id => state.db[id]).filter(Boolean);

  const isFav = (id: string) => state.favorites.includes(id);

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] w-64 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <span className="text-lg">📝</span>
          <span className="font-bold text-sm text-[var(--color-text-primary)]">Logseq</span>
        </div>
        <button
          onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { sidebarOpen: false } })}
          className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Favorites */}
        {favorites.length > 0 && (
          <div className="mb-3">
            <div className="px-4 py-1 text-[10px] uppercase tracking-widest font-semibold text-[var(--color-text-tertiary)]">Favorites</div>
            {favorites.map(page => (
              <button
                key={page.id}
                onClick={() => { onNavigate(page.id); dispatch({ type: 'UPDATE_SETTINGS', settings: { sidebarOpen: false } }); }}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-[var(--color-surface-hover)] transition-colors text-left"
              >
                <span className="text-base">{page.properties?.icon || (page.isJournal ? '📅' : '⭐')}</span>
                <span className="text-sm text-[var(--color-text-primary)] flex-1 truncate">{page.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Journals */}
        <div className="mb-3">
          <div className="px-4 py-1 text-[10px] uppercase tracking-widest font-semibold text-[var(--color-text-tertiary)]">Recent Journals</div>
          {journalPages.map(page => (
            <button
              key={page.id}
              onClick={() => { onNavigate(page.id); dispatch({ type: 'UPDATE_SETTINGS', settings: { sidebarOpen: false } }); }}
              className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-[var(--color-surface-hover)] transition-colors text-left ${state.currentPageId === page.id ? 'bg-[var(--color-accent)]/10 border-r-2 border-[var(--color-accent)]' : ''}`}
            >
              <Calendar size={13} className="text-[var(--color-accent)] shrink-0" />
              <span className="text-sm text-[var(--color-text-primary)] flex-1 truncate">
                {(() => { try { return format(new Date(page.name + 'T12:00:00'), 'EEE, MMM d'); } catch { return page.name; } })()}
              </span>
            </button>
          ))}
        </div>

        {/* Pages */}
        <div>
          <div className="px-4 py-1 text-[10px] uppercase tracking-widest font-semibold text-[var(--color-text-tertiary)] flex items-center justify-between">
            <span>Pages</span>
            <button
              onClick={() => {
                const name = prompt('Page name:');
                if (name) dispatch({ type: 'CREATE_PAGE', name, navigate: true });
              }}
              className="p-0.5 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-tertiary)]"
            >
              <Plus size={12} />
            </button>
          </div>
          {allPages.map(page => (
            <button
              key={page.id}
              onClick={() => { onNavigate(page.id); dispatch({ type: 'UPDATE_SETTINGS', settings: { sidebarOpen: false } }); }}
              className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-[var(--color-surface-hover)] transition-colors text-left group ${state.currentPageId === page.id ? 'bg-[var(--color-accent)]/10 border-r-2 border-[var(--color-accent)]' : ''}`}
            >
              <span className="text-sm">{page.properties?.icon || '📄'}</span>
              <span className="text-sm text-[var(--color-text-primary)] flex-1 truncate">{page.name}</span>
              <button
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-tertiary)]"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_FAVORITE', pageId: page.id }); }}
              >
                {isFav(page.id) ? <StarOff size={11} /> : <Star size={11} />}
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <div className="text-[10px] text-[var(--color-text-tertiary)] text-center">
          {Object.keys(state.db).length} pages · Local Only · Privacy First 🔒
        </div>
      </div>
    </div>
  );
}
