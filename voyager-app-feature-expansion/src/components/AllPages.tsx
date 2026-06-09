import { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Search, Star, BookOpen, Calendar, Plus, FileText, Edit2 } from 'lucide-react';
import { Page } from '../types';

export default function AllPages() {
  const { state, dispatch, navigateTo, actions } = useDatabase();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'journals' | 'pages'>('all');

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const pages = Object.values(state.db)
    .filter(p => {
      if (filter === 'journals' && !p.isJournal) return false;
      if (filter === 'pages' && p.isJournal) return false;
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleNew = () => {
    const name = prompt('New page name:');
    if (name?.trim()) {
      dispatch({ type: 'CREATE_PAGE', name: name.trim(), navigate: true });
    }
  };

  const validateName = (name: string, pageId: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return 'Name cannot be empty';
    
    const normalizedNew = trimmed
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const duplicate = Object.values(state.db).find(
      p => p.id !== pageId && p.id === normalizedNew
    );
    if (duplicate) return 'A page with this name already exists';
    return null;
  };

  const startEditing = (page: Page) => {
    setEditingPageId(page.id);
    setEditName(page.name);
    setValidationError(null);
  };

  const handleRenameCancel = () => {
    setEditingPageId(null);
    setEditName('');
    setValidationError(null);
  };

  const handleRenameCommit = async (pageId: string) => {
    const error = validateName(editName, pageId);
    if (error) {
      handleRenameCancel();
      return;
    }
    const trimmed = editName.trim();
    if (trimmed && trimmed !== state.db[pageId]?.name) {
      await actions.renamePage(pageId, trimmed);
    }
    setEditingPageId(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Search */}
      <div className="p-3 space-y-2 shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-3 py-2 border border-slate-800">
          <Search size={14} className="text-slate-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 bg-transparent text-slate-200 text-sm placeholder-slate-600 outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'journals', 'pages'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
          <button onClick={handleNew} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {pages.map(page => {
          const isFav = state.favorites.includes(page.id);
          const firstBlock = page.blocks[0];
          const preview = firstBlock?.content?.replace(/^#{1,3} /, '').replace(/\*\*/g, '').slice(0, 60) || '';
          const isEditing = editingPageId === page.id;

          return (
            <div
              key={page.id}
              onClick={() => {
                if (!isEditing) navigateTo(page.id);
              }}
              className={`group w-full text-left px-3 py-2.5 rounded-xl transition-colors border cursor-pointer ${
                page.id === state.currentPageId
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{page.properties?.icon || (page.isJournal ? '📅' : '📄')}</span>
                
                {isEditing ? (
                  <div className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => {
                        setEditName(e.target.value);
                        setValidationError(validateName(e.target.value, page.id));
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          void handleRenameCommit(page.id);
                        } else if (e.key === 'Escape') {
                          handleRenameCancel();
                        }
                      }}
                      onBlur={() => void handleRenameCommit(page.id)}
                      className={`w-full bg-slate-800 text-slate-100 text-sm px-2 py-0.5 rounded outline-none border ${
                        validationError ? 'border-red-500 bg-red-950/20' : 'border-slate-700 focus:border-indigo-500'
                      }`}
                      ref={el => {
                        if (el) el.select();
                      }}
                    />
                    {validationError && (
                      <p className="text-red-500 text-[10px] mt-0.5">{validationError}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        onDoubleClick={e => {
                          e.stopPropagation();
                          startEditing(page);
                        }}
                        className="text-sm font-medium truncate select-none"
                      >
                        {page.name}
                      </span>
                      {isFav && <Star size={10} className="text-yellow-400 shrink-0" fill="currentColor" />}
                      {page.isJournal ? (
                        <Calendar size={9} className="text-slate-600 shrink-0" />
                      ) : (
                        <FileText size={9} className="text-slate-600 shrink-0" />
                      )}
                      
                      {/* Hover Rename Button */}
                      {!page.isJournal && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            startEditing(page);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit2 size={10} />
                        </button>
                      )}
                    </div>
                    {preview && <p className="text-slate-600 text-[10px] truncate mt-0.5">{preview}</p>}
                  </div>
                )}

                <div className="flex flex-col items-end shrink-0">
                  <span className="text-slate-700 text-[9px]">{page.blocks.length} blocks</span>
                  {(page.mediaAttachments?.length || 0) > 0 && (
                    <span className="text-slate-700 text-[9px]">{page.mediaAttachments!.length} media</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {pages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600">
            <BookOpen size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No pages found</p>
          </div>
        )}
      </div>
    </div>
  );
}
