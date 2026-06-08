import { useState, useRef, useEffect, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { SearchResult } from '../types';
import { Search, X } from 'lucide-react';

function searchDB(
  db: ReturnType<typeof useDatabase>['state']['db'],
  query: string,
): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const page of Object.values(db)) {
    // Page name match
    if (page.name.toLowerCase().includes(q)) {
      results.push({
        pageId: page.id,
        pageName: page.name,
        blockId: page.id,
        content: page.name,
        isJournal: page.isJournal,
        score: 3,
      });
    }

    // Block content match
    function walkBlocks(blocks: typeof page.blocks, depth = 0) {
      for (const block of blocks) {
        if (block.content.toLowerCase().includes(q)) {
          results.push({
            pageId: page.id,
            pageName: page.name,
            blockId: block.id,
            content: block.content,
            isJournal: page.isJournal,
            score: depth === 0 ? 2 : 1,
          });
        }
        if (block.children.length) walkBlocks(block.children, depth + 1);
      }
    }
    walkBlocks(page.blocks);
  }

  // Sort: higher score first, then alphabetical
  return results.sort((a, b) => b.score - a.score || a.pageName.localeCompare(b.pageName)).slice(0, 40);
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-indigo-500/40 text-indigo-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface Props {
  onClose: () => void;
}

export default function SearchOverlay({ onClose }: Props) {
  const { state, navigateTo } = useDatabase();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      setResults(searchDB(state.db, q));
    },
    [state.db],
  );

  const handleSelect = (result: SearchResult) => {
    navigateTo(result.pageId);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-800 flex-shrink-0">
        <Search size={16} className="text-slate-500 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search pages and blocks…"
          className="flex-1 bg-transparent text-slate-100 text-sm outline-none placeholder-slate-600"
        />
        {query && (
          <button onClick={() => handleSearch('')} className="text-slate-600 hover:text-slate-400">
            <X size={14} />
          </button>
        )}
        <button onClick={onClose} className="text-slate-500 hover:text-white text-xs px-2">
          Cancel
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {query === '' && (
          <div className="px-4 py-6 text-center">
            <p className="text-slate-600 text-sm">Start typing to search…</p>
            <p className="text-slate-700 text-xs mt-2">Searches page names, block content, tags, and references</p>
          </div>
        )}

        {query && results.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-slate-600 text-sm">No results for "{query}"</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="py-2">
            {results.map((r, i) => (
              <button
                key={`${r.pageId}-${r.blockId}-${i}`}
                onClick={() => handleSelect(r)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-900 transition-colors text-left"
              >
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {r.isJournal ? '📅' : '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-indigo-400 text-xs font-medium mb-0.5 truncate">
                    {r.pageName}
                  </p>
                  {r.content !== r.pageName && (
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                      {highlight(r.content, query)}
                    </p>
                  )}
                </div>
                {r.score === 3 && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-indigo-900/50 text-indigo-400 rounded-full flex-shrink-0">
                    Page
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
