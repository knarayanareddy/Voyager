import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Block, Page } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Link,
} from 'lucide-react';
import { getBacklinksFor } from '../lib/backlinksIndex';
import { format } from 'date-fns';

// ─── Slash command menu items ─────────────────────────────────────────────────

const SLASH_COMMANDS = [
  { label: '# Heading 1', value: '# ', icon: 'H1' },
  { label: '## Heading 2', value: '## ', icon: 'H2' },
  { label: '### Heading 3', value: '### ', icon: 'H3' },
  { label: '> Blockquote', value: '> ', icon: '❝' },
  { label: '``` Code block', value: '```', icon: '</>' },
  { label: 'TODO task', value: 'TODO ', icon: '☐' },
  { label: 'DOING task', value: 'DOING ', icon: '⟳' },
  { label: 'DONE task', value: 'DONE ', icon: '✓' },
  { label: '#card flashcard', value: '#card ', icon: '🃏' },
  { label: '[[Link]] to page', value: '[[', icon: '🔗' },
];

const TASK_CYCLE: Block['taskStatus'][] = [
  'TODO', 'DOING', 'DONE', 'LATER', 'NOW', 'CANCELLED', null,
];

const TASK_STYLES: Record<NonNullable<Block['taskStatus']>, { label: string; cls: string }> = {
  TODO: { label: 'TODO', cls: 'bg-slate-700 text-slate-300' },
  DOING: { label: 'DOING', cls: 'bg-amber-900/60 text-amber-300 animate-pulse' },
  DONE: { label: 'DONE', cls: 'bg-emerald-900/60 text-emerald-400' },
  LATER: { label: 'LATER', cls: 'bg-slate-800 text-slate-500' },
  NOW: { label: 'NOW', cls: 'bg-rose-900/60 text-rose-400 animate-pulse' },
  CANCELLED: { label: 'CANCELLED', cls: 'bg-slate-900 text-slate-600 line-through' },
};

// ─── Single Block component ───────────────────────────────────────────────────

interface BlockItemProps {
  block: Block;
  pageId: string;
  depth: number;
  onLinkClick: (target: string, e: React.MouseEvent) => void;
  showBrackets: boolean;
  onFocusNext?: (currentId: string) => void;
}

function BlockItem({ block, pageId, depth, onLinkClick, showBrackets, onFocusNext }: BlockItemProps) {
  const { dispatch } = useDatabase();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(block.content);
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIdx, setSlashIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(block.content);
  }, [block.content]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed !== block.content) {
      dispatch({ type: 'UPDATE_BLOCK', pageId, blockId: block.id, content: trimmed });
    }
    setEditing(false);
    setShowSlash(false);
  }, [editValue, block.content, block.id, dispatch, pageId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlash) {
      const filtered = SLASH_COMMANDS.filter(c =>
        c.label.toLowerCase().includes(slashFilter.toLowerCase()),
      );
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIdx(i => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIdx(i => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = filtered[slashIdx];
        if (chosen) {
          const newVal = editValue.replace(/\/[^/]*$/, chosen.value);
          setEditValue(newVal);
        }
        setShowSlash(false);
        return;
      }
      if (e.key === 'Escape') {
        setShowSlash(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
      dispatch({ type: 'ADD_BLOCK', pageId, afterBlockId: block.id });
      onFocusNext?.(block.id);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        dispatch({ type: 'OUTDENT_BLOCK', pageId, blockId: block.id });
      } else {
        dispatch({ type: 'INDENT_BLOCK', pageId, blockId: block.id });
      }
    } else if (e.key === 'Backspace' && editValue === '') {
      e.preventDefault();
      dispatch({ type: 'DELETE_BLOCK', pageId, blockId: block.id });
    } else if (e.key === 'Escape') {
      setEditing(false);
      setShowSlash(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setEditValue(val);
    // Detect slash command
    const slashMatch = val.match(/\/([^/]*)$/);
    if (slashMatch) {
      setShowSlash(true);
      setSlashFilter(slashMatch[1]);
      setSlashIdx(0);
    } else {
      setShowSlash(false);
    }
  };

  const cycleTask = () => {
    const curr = TASK_CYCLE.indexOf(block.taskStatus);
    const next = TASK_CYCLE[(curr + 1) % TASK_CYCLE.length];
    dispatch({ type: 'UPDATE_BLOCK_STATUS', pageId, blockId: block.id, status: next });
  };

  const indentStyle = { paddingLeft: `${depth * 18}px` };

  const taskDoneStyle =
    block.taskStatus === 'DONE' || block.taskStatus === 'CANCELLED'
      ? 'opacity-60'
      : '';

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.label.toLowerCase().includes(slashFilter.toLowerCase()),
  );

  return (
    <div className="group relative">
      <div className="flex items-start gap-1 py-0.5" style={indentStyle}>
        {/* Collapse toggle */}
        <button
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
          onClick={e => {
            e.stopPropagation();
            if (block.children.length > 0) {
              dispatch({ type: 'TOGGLE_COLLAPSE', pageId, blockId: block.id });
            }
          }}
          className={`mt-1.5 flex-shrink-0 w-4 h-4 flex items-center justify-center rounded transition-colors ${
            block.children.length > 0
              ? 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 cursor-pointer'
              : 'text-slate-700 cursor-default'
          }`}
        >
          {block.children.length > 0 ? (
            block.collapsed ? (
              <ChevronRight size={10} />
            ) : (
              <ChevronDown size={10} />
            )
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600 block-bullet" />
          )}
        </button>

        {/* Task badge */}
        {block.taskStatus && (
          <button
            onClick={cycleTask}
            className={`mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
              TASK_STYLES[block.taskStatus].cls
            }`}
          >
            {TASK_STYLES[block.taskStatus].label}
          </button>
        )}

        {/* Content area */}
        <div className={`flex-1 min-w-0 relative ${taskDoneStyle}`}>
          {editing ? (
            <>
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={commitEdit}
                autoFocus
                rows={1}
                spellCheck={false}
                className="w-full bg-slate-800/60 border border-indigo-500/50 rounded px-2 py-1 text-slate-100 resize-none outline-none text-sm font-mono leading-relaxed min-h-[28px]"
                style={{ fontSize: 13 }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = el.scrollHeight + 'px';
                }}
              />
              {/* Slash command popup */}
              {showSlash && filteredCommands.length > 0 && (
                <div className="absolute left-0 top-full z-50 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-52">
                  {filteredCommands.map((cmd, idx) => (
                    <button
                      key={cmd.value}
                      onMouseDown={e => {
                        e.preventDefault();
                        const newVal = editValue.replace(/\/[^/]*$/, cmd.value);
                        setEditValue(newVal);
                        setShowSlash(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                        idx === slashIdx
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="w-5 text-center font-mono text-[10px]">{cmd.icon}</span>
                      <span>{cmd.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div
              onDoubleClick={() => setEditing(true)}
              className="px-1 py-0.5 min-h-[24px] cursor-text rounded hover:bg-slate-800/30 leading-relaxed"
            >
              <MarkdownRenderer
                content={block.content || ''}
                onLinkClick={onLinkClick}
                showBrackets={showBrackets}
                className="text-sm text-slate-200"
              />
              {block.content === '' && (
                <span className="text-slate-700 text-xs italic">Empty block...</span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons (on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">
          <button
            onClick={() => dispatch({ type: 'ADD_BLOCK', pageId, afterBlockId: block.id })}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700 text-slate-600 hover:text-indigo-400 transition-colors"
            title="Add block below"
          >
            <Plus size={10} />
          </button>
          <button
            onClick={cycleTask}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700 text-slate-600 hover:text-amber-400 transition-colors"
            title="Cycle task status"
          >
            <span className="text-[9px]">☐</span>
          </button>
          <button
            onClick={() => dispatch({ type: 'DELETE_BLOCK', pageId, blockId: block.id })}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700 text-slate-600 hover:text-rose-400 transition-colors"
            title="Delete block"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {/* Children */}
      {!block.collapsed && block.children.length > 0 && (
        <div className="border-l border-slate-800/80 ml-5">
          {block.children.map(child => (
            <BlockItem
              key={child.id}
              block={child}
              pageId={pageId}
              depth={depth + 1}
              onLinkClick={onLinkClick}
              showBrackets={showBrackets}
              onFocusNext={onFocusNext}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Page Modal ───────────────────────────────────────────────────────────

interface NewPageModalProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function NewPageModal({ onConfirm, onCancel }: NewPageModalProps) {
  const [name, setName] = useState('');
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full bg-slate-900 border border-slate-700 rounded-t-3xl p-6 animate-slide-in-up">
        <h3 className="text-white font-semibold text-base mb-4">New Page</h3>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && name.trim()) onConfirm(name.trim());
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Page name…"
          className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LogseqEditor (main) ──────────────────────────────────────────────────────

interface Props {
  pageId?: string;
  onLinkClick?: (target: string, e: React.MouseEvent) => void;
}

export default function LogseqEditor({ pageId: propPageId, onLinkClick }: Props) {
  const { state, dispatch, navigateTo, backlinks } = useDatabase();
  const [showNewPage, setShowNewPage] = useState(false);

  const effectivePageId = propPageId ?? state.currentPageId;
  const page: Page | undefined = state.db[effectivePageId];

  const handleLinkClick = useCallback(
    (target: string, e: React.MouseEvent) => {
      if (onLinkClick) {
        onLinkClick(target, e);
        return;
      }
      const targetId = target.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (e.shiftKey) {
        dispatch({ type: 'OPEN_SIDEBAR', pageId: targetId });
      } else {
        navigateTo(targetId);
      }
    },
    [onLinkClick, dispatch, navigateTo],
  );

  const handleNewPage = (name: string) => {
    dispatch({ type: 'CREATE_PAGE', name, navigate: !propPageId });
    setShowNewPage(false);
  };

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
        <span className="text-4xl">📄</span>
        <p className="text-sm">Page not found</p>
        <button
          onClick={() => setShowNewPage(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium"
        >
          Create Page
        </button>
        {showNewPage && (
          <NewPageModal onConfirm={handleNewPage} onCancel={() => setShowNewPage(false)} />
        )}
      </div>
    );
  }

  // Backlinks for this page (using index — O(1))
  const backlinkPageIds = getBacklinksFor(backlinks, effectivePageId);
  const backlinkPages = backlinkPageIds
    .filter(id => id !== effectivePageId)
    .map(id => state.db[id])
    .filter(Boolean);

  const pageIcon = page.properties?.icon || (page.isJournal ? '📅' : '📄');
  const journalTitle = page.isJournal
    ? (() => {
        try {
          return format(new Date(page.name + 'T12:00:00'), 'EEEE, MMMM do yyyy');
        } catch {
          return page.name;
        }
      })()
    : null;

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* Page header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{pageIcon}</span>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">
                {journalTitle || page.name}
              </h1>
              {journalTitle && (
                <p className="text-slate-500 text-xs">{page.name}</p>
              )}
            </div>
          </div>
          {page.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {page.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-slate-800 text-cyan-400 text-[10px] rounded-full font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Blocks */}
        <div className="space-y-0.5">
          {page.blocks.map(block => (
            <BlockItem
              key={block.id}
              block={block}
              pageId={effectivePageId}
              depth={0}
              onLinkClick={handleLinkClick}
              showBrackets={state.settings.showBrackets}
            />
          ))}
        </div>

        {/* Add block button */}
        <button
          onClick={() => {
            const lastBlock = page.blocks[page.blocks.length - 1];
            if (lastBlock) {
              dispatch({ type: 'ADD_BLOCK', pageId: effectivePageId, afterBlockId: lastBlock.id });
            }
          }}
          className="mt-3 flex items-center gap-2 text-slate-600 hover:text-indigo-400 text-xs py-2 px-2 rounded-lg hover:bg-slate-800/40 transition-colors w-full"
        >
          <Plus size={12} />
          <span>Add block</span>
        </button>

        {/* Media attachments */}
        {page.mediaAttachments && page.mediaAttachments.length > 0 && (
          <div className="mt-6">
            <p className="text-slate-500 text-xs font-medium mb-2 flex items-center gap-1">
              <span>📎</span> Attachments ({page.mediaAttachments.length})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {page.mediaAttachments.map(media => (
                <div key={media.id} className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-square">
                  {media.type === 'image' && media.dataUrl ? (
                    <img src={media.dataUrl} alt={media.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      {media.type === 'audio' ? '🎵' : media.type === 'video' ? '🎬' : '📎'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Backlinks section */}
        {backlinkPages.length > 0 && (
          <div className="mt-8 border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Link size={12} className="text-slate-500" />
              <span className="text-slate-400 text-xs font-medium">
                Linked References ({backlinkPages.length})
              </span>
            </div>
            <div className="space-y-2">
              {backlinkPages.map(refPage => {
                // Find blocks that actually link here
                const targetName = page.name;
                const matchingBlocks = findBlocksWithLink(refPage.blocks, targetName);

                return (
                  <div
                    key={refPage.id}
                    className="bg-slate-900 rounded-xl p-3 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <button
                      onClick={() => navigateTo(refPage.id)}
                      className="flex items-center gap-2 mb-2"
                    >
                      <span className="text-sm">{refPage.properties?.icon || (refPage.isJournal ? '📅' : '📄')}</span>
                      <span className="text-indigo-400 text-xs font-medium hover:text-indigo-300">
                        {refPage.name}
                      </span>
                    </button>
                    {matchingBlocks.slice(0, 2).map(b => (
                      <div key={b.id} className="ml-4 border-l-2 border-slate-700 pl-2">
                        <MarkdownRenderer
                          content={b.content}
                          onLinkClick={handleLinkClick}
                          className="text-xs text-slate-400"
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>

      {/* Floating add page button (only on main editor) */}
      {!propPageId && (
        <div className="absolute bottom-4 right-4">
          <button
            onClick={() => setShowNewPage(true)}
            className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
            title="Create new page"
          >
            <Plus size={18} />
          </button>
        </div>
      )}

      {showNewPage && (
        <NewPageModal onConfirm={handleNewPage} onCancel={() => setShowNewPage(false)} />
      )}
    </div>
  );
}

// ─── Helper: find blocks linking to a page name ──────────────────────────────

function findBlocksWithLink(blocks: Block[], targetName: string): Block[] {
  const result: Block[] = [];
  const pattern = new RegExp(`\\[\\[${targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`, 'i');

  function walk(bs: Block[]) {
    for (const b of bs) {
      if (pattern.test(b.content) || b.refs.some(r =>
        r.toLowerCase() === targetName.toLowerCase())) {
        result.push(b);
      }
      if (b.children.length) walk(b.children);
    }
  }

  walk(blocks);
  return result;
}

// ─── Named export for sidebar usage ──────────────────────────────────────────

export { NewPageModal };
