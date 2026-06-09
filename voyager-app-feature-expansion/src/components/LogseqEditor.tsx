import { useState, useRef, useEffect, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Block } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { ChevronRight, ChevronDown, Plus, Trash2, Star, MoreHorizontal } from 'lucide-react';

/** A render item is either a regular block or a fused multi-line code fence */
type RenderItem =
  | { type: 'block'; block: Block }
  | { type: 'codeFence'; id: string; language?: string; code: string };

/**
 * Pre-processes an array of sibling blocks to detect and group multi-line code fences.
 * When a block's content starts with ``` (opening fence), subsequent blocks are accumulated
 * as raw code lines until a closing ``` is found or the blocks are exhausted (unclosed fence).
 */
function processBlocksForCodeFences(blocks: Block[]): RenderItem[] {
  const items: RenderItem[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const trimmed = block.content.trimStart();

    if (trimmed.startsWith('```')) {
      // Check if this is a self-closing fence (``` ... ``` on the same line)
      const afterOpener = trimmed.slice(3);
      if (afterOpener.includes('```') && afterOpener.indexOf('```') > 0) {
        // Self-closing single-line fence — render as a normal block (MarkdownRenderer handles it)
        items.push({ type: 'block', block });
        i++;
        continue;
      }

      // Opening a multi-line code fence
      const langMatch = afterOpener.match(/^(\w+)/);
      const language = langMatch ? langMatch[1] : undefined;
      const firstLineContent = langMatch ? afterOpener.slice(langMatch[0].length) : afterOpener;
      const codeLines: string[] = [];

      // If there's content after the language identifier on the opening line, include it
      if (firstLineContent.trim()) {
        codeLines.push(firstLineContent.trimStart());
      }

      const fenceStartId = block.id;
      i++;

      // Accumulate blocks until we find a closing ```
      while (i < blocks.length) {
        const nextBlock = blocks[i];
        const nextTrimmed = nextBlock.content.trimStart();

        if (nextTrimmed.startsWith('```')) {
          // Closing fence found — any content after ``` on this line is ignored
          i++;
          break;
        }

        codeLines.push(nextBlock.content);
        i++;
      }

      // Render the accumulated code block (handles unclosed fences too)
      items.push({
        type: 'codeFence',
        id: `codefence-${fenceStartId}`,
        language,
        code: codeLines.join('\n'),
      });
    } else {
      items.push({ type: 'block', block });
      i++;
    }
  }

  return items;
}

const TASK_COLORS: Record<string, string> = {
  TODO: 'text-slate-400 bg-slate-700/50',
  DOING: 'text-amber-300 bg-amber-900/30 animate-pulse',
  DONE: 'text-emerald-400 bg-emerald-900/30 line-through',
  LATER: 'text-slate-500 bg-slate-800/50',
  NOW: 'text-rose-300 bg-rose-900/30 animate-pulse',
  CANCELLED: 'text-slate-600 bg-slate-800/30 line-through',
};

const TASK_DOTS: Record<string, string> = {
  TODO: 'bg-slate-500 border-2 border-slate-400',
  DOING: 'bg-amber-400 border-2 border-amber-300 animate-pulse',
  DONE: 'bg-emerald-500 border-2 border-emerald-400',
  LATER: 'bg-slate-600 border-2 border-slate-500',
  NOW: 'bg-rose-500 border-2 border-rose-400 animate-pulse',
  CANCELLED: 'bg-slate-700 border-2 border-slate-600',
};

function BlockItem({
  block, depth, pageId, onLinkClick
}: { block: Block; depth: number; pageId: string; onLinkClick: (name: string, e: React.MouseEvent) => void }) {
  const { dispatch } = useDatabase();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(block.content);
  const [showSlash, setShowSlash] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setEditValue(block.content); }, [block.content]);

  const commitEdit = useCallback(() => {
    if (editValue !== block.content) {
      dispatch({ type: 'UPDATE_BLOCK', pageId, blockId: block.id, content: editValue });
    }
    setEditing(false);
  }, [editValue, block.content, block.id, pageId, dispatch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
      dispatch({ type: 'ADD_BLOCK', pageId, afterBlockId: block.id });
    }
    if (e.key === 'Escape') { setEditValue(block.content); setEditing(false); }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'INDENT_BLOCK', pageId, blockId: block.id }); }
    if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); dispatch({ type: 'OUTDENT_BLOCK', pageId, blockId: block.id }); }
    if (e.key === '/') setShowSlash(true);
    else setShowSlash(false);
  };

  const handleStatusCycle = () => {
    const cycle: Block['taskStatus'][] = [null, 'TODO', 'DOING', 'DONE', 'LATER', 'NOW', 'CANCELLED'];
    const curr = cycle.indexOf(block.taskStatus);
    const next = cycle[(curr + 1) % cycle.length];
    dispatch({ type: 'UPDATE_BLOCK_STATUS', pageId, blockId: block.id, status: next });
  };

  const SLASH_CMDS = [
    { label: '# Heading 1', val: '# ' }, { label: '## Heading 2', val: '## ' },
    { label: '### Heading 3', val: '### ' }, { label: '- TODO', val: '' },
    { label: '> Blockquote', val: '> ' }, { label: '`Code`', val: '`' },
    { label: '#card', val: block.content + ' #card' },
    { label: '📅 Date', val: new Date().toLocaleDateString() },
  ];

  const taskClass = block.taskStatus ? TASK_COLORS[block.taskStatus] || '' : '';
  const dotClass = block.taskStatus ? TASK_DOTS[block.taskStatus] || 'bg-indigo-500' : '';
  const isHeader = /^#{1,3} /.test(block.content);

  return (
    <div className="group relative" style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      {depth > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-700/40 ml-1.5" />
      )}
      <div className={`flex items-start gap-1.5 py-0.5 rounded-lg transition-colors hover:bg-slate-800/40 px-1 -mx-1 ${taskClass}`}>
        {/* Collapse toggle */}
        {block.children.length > 0 ? (
          <button
            onClick={() => dispatch({ type: 'TOGGLE_COLLAPSE', pageId, blockId: block.id })}
            className="shrink-0 mt-1 text-slate-600 hover:text-slate-400 w-4 h-4 flex items-center justify-center"
          >
            {block.collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
          </button>
        ) : (
          <div className="shrink-0 mt-1 w-4 h-4 flex items-center justify-center">
            {/* Bullet */}
            <button
              onClick={handleStatusCycle}
              className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${
                block.taskStatus ? dotClass : 'bg-slate-600 hover:bg-indigo-500 border border-slate-500'
              }`}
              title={block.taskStatus || 'Click to add task'}
            />
          </div>
        )}

        {/* Task badge */}
        {block.taskStatus && (
          <button
            onClick={handleStatusCycle}
            className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
              block.taskStatus === 'DOING' ? 'bg-amber-500/30 text-amber-300' :
              block.taskStatus === 'DONE' ? 'bg-emerald-500/30 text-emerald-400' :
              block.taskStatus === 'NOW' ? 'bg-rose-500/30 text-rose-300' :
              block.taskStatus === 'CANCELLED' ? 'bg-slate-700 text-slate-500' :
              'bg-slate-700 text-slate-400'
            }`}
          >
            {block.taskStatus}
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="relative">
              <textarea
                ref={inputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={commitEdit}
                autoFocus
                rows={1}
                className={`w-full bg-slate-800/80 text-slate-100 rounded px-2 py-0.5 text-sm resize-none outline-none border border-indigo-500/50 focus:border-indigo-400 font-mono leading-relaxed ${isHeader ? 'font-semibold' : ''}`}
                style={{ minHeight: 24 }}
              />
              {showSlash && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-48">
                  {SLASH_CMDS.map(cmd => (
                    <button
                      key={cmd.label}
                      onMouseDown={() => {
                        setEditValue(cmd.val);
                        setShowSlash(false);
                        inputRef.current?.focus();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      {cmd.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              onDoubleClick={() => setEditing(true)}
              onClick={e => { if (e.detail === 1) { /* single click for links */ } }}
              className="text-sm leading-relaxed cursor-text select-none"
            >
              <MarkdownRenderer content={block.content} onLinkClick={onLinkClick} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
          <button onClick={() => dispatch({ type: 'ADD_BLOCK', pageId, afterBlockId: block.id })} className="p-1 text-slate-600 hover:text-indigo-400 rounded">
            <Plus size={10} />
          </button>
          <button onClick={() => dispatch({ type: 'DELETE_BLOCK', pageId, blockId: block.id })} className="p-1 text-slate-600 hover:text-red-400 rounded">
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {/* Children */}
      {!block.collapsed && block.children.length > 0 && (
        <div className="pl-4 border-l border-slate-800/60 ml-3">
          {processBlocksForCodeFences(block.children).map(item =>
            item.type === 'block' ? (
              <BlockItem key={item.block.id} block={item.block} depth={depth + 1} pageId={pageId} onLinkClick={onLinkClick} />
            ) : (
              <div key={item.id} className="py-0.5 px-1 -mx-1" style={{ paddingLeft: (depth + 1) > 0 ? 16 : 0 }}>
                <MarkdownRenderer content="" codeBlock={{ language: item.language, code: item.code }} />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function LogseqEditor({ pageId, onLinkClick }: { pageId?: string; onLinkClick?: (pageId: string, e: React.MouseEvent) => void }) {
  const { state, dispatch, navigateTo, backlinks } = useDatabase();
  const [showFavStar, setShowFavStar] = useState(false);
  const activePageId = pageId || state.currentPageId;
  const page = state.db[activePageId];

  const handleLinkClick = useCallback((targetName: string, e: React.MouseEvent) => {
    if (onLinkClick) {
      onLinkClick(targetName, e);
    } else {
      const targetId = targetName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (e.shiftKey) {
        dispatch({ type: 'OPEN_SIDEBAR', pageId: targetId });
      } else {
        navigateTo(targetId);
      }
    }
  }, [onLinkClick, navigateTo, dispatch]);

  if (!page) return (
    <div className="flex items-center justify-center h-full text-slate-600">
      <p className="text-sm">Page not found</p>
    </div>
  );

  const isFav = state.favorites.includes(page.id);

  // Compute backlinks
  const backlinkPageIds = page ? backlinks.get(page.name) : undefined;
  const backlinkPages = backlinkPageIds
    ? Array.from(backlinkPageIds).map(id => state.db[id]).filter(Boolean)
    : [];

  const addBlock = () => {
    if (!page) return;
    const lastBlock = page.blocks[page.blocks.length - 1];
    if (lastBlock) {
      dispatch({ type: 'ADD_BLOCK', pageId: page.id, afterBlockId: lastBlock.id });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-950">
      {/* Page header */}
      <div className="px-4 pt-4 pb-2 border-b border-slate-800 shrink-0">
        <div className="flex items-start gap-2">
          <span className="text-2xl">{page.properties?.icon || (page.isJournal ? '📅' : '📄')}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-base leading-tight break-words">{page.name}</h1>
            {page.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {page.tags.map(tag => (
                  <span key={tag} className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">#{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => { dispatch({ type: 'TOGGLE_FAVORITE', pageId: page.id }); setShowFavStar(true); setTimeout(() => setShowFavStar(false), 1000); }}
              className={`p-1.5 rounded-lg transition-colors ${isFav ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'}`}
            >
              <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
            </button>
            <button onClick={addBlock} className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-400 hover:bg-slate-800">
              <Plus size={14} />
            </button>
            <button className="p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-slate-800">
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Blocks */}
      <div className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {processBlocksForCodeFences(page.blocks).map(item =>
          item.type === 'block' ? (
            <BlockItem key={item.block.id} block={item.block} depth={0} pageId={page.id} onLinkClick={handleLinkClick} />
          ) : (
            <div key={item.id} className="py-0.5 px-1 -mx-1">
              <MarkdownRenderer content="" codeBlock={{ language: item.language, code: item.code }} />
            </div>
          )
        )}

        <button
          onClick={addBlock}
          className="w-full text-left px-5 py-2 text-slate-700 hover:text-slate-500 text-sm transition-colors flex items-center gap-2 mt-2"
        >
          <Plus size={12} /> Add block
        </button>
      </div>

      {/* Media attachments preview */}
      {(page.mediaAttachments || []).length > 0 && (
        <div className="px-3 pb-3 border-t border-slate-800 shrink-0">
          <p className="text-slate-600 text-[10px] uppercase tracking-wider mt-3 mb-2">Media ({page.mediaAttachments!.length})</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {page.mediaAttachments!.slice(0, 8).map(m => (
              <div key={m.id} className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                {m.type === 'image' || m.type === 'drawing' ? (
                  <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">VID</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backlinks */}
      {backlinkPages.length > 0 && (
        <div className="px-3 pb-4 border-t border-slate-800/50 shrink-0">
          <p className="text-slate-600 text-[10px] uppercase tracking-wider mt-3 mb-2">
            🔗 Linked References ({backlinkPages.length})
          </p>
          <div className="space-y-2">
            {backlinkPages.slice(0, 5).map(p => (
              <button
                key={p.id}
                onClick={(e) => handleLinkClick(p.name, e)}
                className="w-full text-left bg-slate-900 hover:bg-slate-800 rounded-xl p-3 border border-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{p.properties?.icon || (p.isJournal ? '📅' : '📄')}</span>
                  <span className="text-indigo-400 text-xs font-medium">{p.name}</span>
                </div>
                {p.blocks.slice(0, 2).map(b => (
                  <p key={b.id} className="text-slate-500 text-[10px] leading-relaxed truncate pl-4">{b.content}</p>
                ))}
              </button>
            ))}
          </div>
        </div>
      )}

      {showFavStar && (
        <div className="fixed inset-x-0 top-20 flex justify-center pointer-events-none z-50">
          <div className="bg-slate-900 text-yellow-400 px-4 py-2 rounded-full text-sm shadow-xl border border-slate-700 animate-bounce">
            {isFav ? '⭐ Added to favorites' : '✓ Removed from favorites'}
          </div>
        </div>
      )}
    </div>
  );
}
