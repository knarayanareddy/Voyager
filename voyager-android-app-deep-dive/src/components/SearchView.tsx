import { useState, useCallback, useRef, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { SearchResult } from '../types';
import { Search, X, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface SearchViewProps {
  onClose?: () => void;
}

export default function SearchView({ onClose }: SearchViewProps) {
  const { search, navigateTo } = useDatabase();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setIsSearching(true);
    setTimeout(() => {
      setResults(search(q));
      setIsSearching(false);
    }, 80);
  }, [search]);

  const handleSelect = (result: SearchResult) => {
    navigateTo(result.pageId);
    onClose?.();
  };

  const getPageName = (result: SearchResult) => {
    if (result.isJournal) {
      try { return format(new Date(result.pageName + 'T12:00:00'), 'MMM d, yyyy'); }
      catch { return result.pageName; }
    }
    return result.pageName;
  };

  const highlight = (text: string, query: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-indigo-500/30 text-indigo-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.pageId]) acc[r.pageId] = [];
    acc[r.pageId].push(r);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <Search size={14} className="text-slate-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search pages, blocks, tags..."
          className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none"
          style={{ caretColor: '#6366f1' }}
        />
        {query && (
          <button onClick={() => handleSearch('')} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={13} />
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors text-xs ml-1">
            Cancel
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Search size={28} className="text-slate-700 mb-3" />
            <p className="text-xs text-slate-500">Search across all pages, blocks, and tags</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {['Project Voyager', 'Knowledge Graph', 'flashcards', 'productivity'].map(term => (
                <button
                  key={term}
                  onClick={() => handleSearch(term)}
                  className="px-2.5 py-1 rounded-full text-[10px] text-slate-400 hover:text-indigo-300 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {query && isSearching && (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        )}

        {query && !isSearching && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center px-6">
            <div className="text-2xl mb-2">🔍</div>
            <p className="text-xs text-slate-400 font-medium">No results for "{query}"</p>
            <p className="text-[10px] text-slate-600 mt-1">Try different keywords</p>
          </div>
        )}

        {query && !isSearching && Object.entries(grouped).map(([pageId, pageResults]) => {
          const pageResult = pageResults[0];
          const pageName = getPageName(pageResult);
          return (
            <div key={pageId} className="border-b border-white/5 last:border-0">
              {/* Page header */}
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/4 transition-colors text-left"
                onClick={() => handleSelect(pageResult)}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(99,102,241,0.15)' }}
                >
                  {pageResult.isJournal
                    ? <Calendar size={12} style={{ color: '#10b981' }} />
                    : <FileText size={12} style={{ color: '#818cf8' }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {highlight(pageName, query)}
                  </div>
                  <div className="text-[10px] text-slate-600">
                    {pageResults.length} match{pageResults.length > 1 ? 'es' : ''}
                  </div>
                </div>
              </button>

              {/* Block matches */}
              {pageResults.filter(r => r.blockId).slice(0, 3).map(r => (
                <button
                  key={r.blockId}
                  className="w-full flex items-start gap-2.5 px-3 py-2 pl-10 hover:bg-white/3 transition-colors text-left border-t border-white/3"
                  onClick={() => handleSelect(r)}
                >
                  <div className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                  <span className="text-[11px] text-slate-400 leading-relaxed truncate">
                    {highlight(r.content.slice(0, 120), query)}
                  </span>
                </button>
              ))}
            </div>
          );
        })}

        {query && !isSearching && results.length > 0 && (
          <div className="px-3 py-3 text-[10px] text-slate-600 text-center">
            {results.length} result{results.length > 1 ? 's' : ''} found
          </div>
        )}
      </div>
    </div>
  );
}
