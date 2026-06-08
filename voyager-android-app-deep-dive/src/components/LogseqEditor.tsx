import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Block } from '../types';
import { parseInlineMarkdown } from './MarkdownRenderer';
import { format } from 'date-fns';
import {
  ChevronRight, ChevronDown, Plus,
  ArrowUp, ArrowDown, Indent, Outdent, Trash2, ExternalLink
} from 'lucide-react';

// ─── Slash Commands ───────────────────────────────────────────────────────────
const SLASH_COMMANDS = [
  { label: 'TODO', category: 'Task', action: 'TODO ', emoji: '☐', desc: 'Action item' },
  { label: 'DOING', category: 'Task', action: 'DOING ', emoji: '🔄', desc: 'In progress' },
  { label: 'DONE', category: 'Task', action: 'DONE ', emoji: '✅', desc: 'Completed' },
  { label: 'LATER', category: 'Task', action: 'LATER ', emoji: '⏳', desc: 'Deferred' },
  { label: 'NOW', category: 'Task', action: 'NOW ', emoji: '🔥', desc: 'Urgent' },
  { label: 'H1', category: 'Format', action: '# ', emoji: 'H1', desc: 'Heading 1' },
  { label: 'H2', category: 'Format', action: '## ', emoji: 'H2', desc: 'Heading 2' },
  { label: 'H3', category: 'Format', action: '### ', emoji: 'H3', desc: 'Heading 3' },
  { label: 'quote', category: 'Format', action: '> ', emoji: '❝', desc: 'Blockquote' },
  { label: 'code', category: 'Format', action: '```\n', emoji: '</>', desc: 'Code block' },
  { label: 'date', category: 'Insert', action: format(new Date(), 'yyyy-MM-dd'), emoji: '📅', desc: 'Current date' },
  { label: 'card', category: 'Insert', action: '#card ', emoji: '🃏', desc: 'Flashcard' },
  { label: 'bold', category: 'Format', action: '**bold**', emoji: 'B', desc: 'Bold text' },
  { label: 'italic', category: 'Format', action: '*italic*', emoji: 'I', desc: 'Italic text' },
  { label: 'highlight', category: 'Format', action: '==highlight==', emoji: '✨', desc: 'Highlight text' },
];

// ─── Task Badge ───────────────────────────────────────────────────────────────
function TaskBadge({ status }: { status: Block['taskStatus'] }) {
  if (!status) return null;
  const styles: Record<string, { bg: string; text: string; label: string; pulse?: boolean }> = {
    TODO:      { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', label: 'TODO' },
    DOING:     { bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b', label: 'DOING', pulse: true },
    DONE:      { bg: 'rgba(16,185,129,0.15)',  text: '#10b981', label: 'DONE' },
    LATER:     { bg: 'rgba(100,116,139,0.12)', text: '#64748b', label: 'LATER' },
    NOW:       { bg: 'rgba(244,63,94,0.15)',   text: '#f43f5e', label: 'NOW',  pulse: true },
    CANCELLED: { bg: 'rgba(71,85,105,0.12)',   text: '#475569', label: 'CANCELLED' },
  };
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider mr-1.5 shrink-0 ${s.pulse ? 'animate-pulse' : ''}`}
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.text}33` }}
    >
      {s.label}
    </span>
  );
}

// ─── Single Block ─────────────────────────────────────────────────────────────
interface BlockItemProps {
  block: Block;
  pageId: string;
  depth: number;
  editingBlockId: string | null;
  focusedBlockId: string | null;
  setEditingBlockId: (id: string | null) => void;
  setFocusedBlockId: (id: string | null) => void;
}

function BlockItem({
  block, pageId, depth,
  editingBlockId, focusedBlockId,
  setEditingBlockId, setFocusedBlockId,
}: BlockItemProps) {
  const { dispatch, navigateTo } = useDatabase();
  const [localContent, setLocalContent] = useState(block.content);
  const [showSlash, setShowSlash] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEditing = editingBlockId === block.id;
  const isFocused = focusedBlockId === block.id;

  useEffect(() => {
    if (!isEditing) setLocalContent(block.content);
  }, [block.content, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [localContent, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    if (localContent !== block.content) {
      dispatch({ type: 'UPDATE_BLOCK', pageId, blockId: block.id, content: localContent });
    }
  }, [localContent, block.content, block.id, pageId, dispatch]);

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
    c.category.toLowerCase().includes(slashQuery.toLowerCase()) ||
    c.desc.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showSlash) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex(i => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' && filteredCommands[slashIndex]) {
        e.preventDefault();
        const cmd = filteredCommands[slashIndex];
        const slashPos = localContent.lastIndexOf('/');
        const newContent = localContent.slice(0, slashPos) + cmd.action;
        setLocalContent(newContent);
        setShowSlash(false);
        setSlashQuery('');
        dispatch({ type: 'UPDATE_BLOCK', pageId, blockId: block.id, content: newContent });
        const taskStatuses = ['TODO', 'DOING', 'DONE', 'LATER', 'NOW', 'CANCELLED'];
        if (taskStatuses.includes(cmd.label)) {
          dispatch({ type: 'TOGGLE_TASK', pageId, blockId: block.id });
        }
        return;
      }
      if (e.key === 'Escape') { setShowSlash(false); return; }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
      dispatch({ type: 'ADD_BLOCK', pageId, afterBlockId: block.id });
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
      dispatch({ type: 'INDENT_BLOCK', pageId, blockId: block.id });
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      commitEdit();
      dispatch({ type: 'OUTDENT_BLOCK', pageId, blockId: block.id });
    }
    if (e.key === 'Backspace' && localContent === '') {
      e.preventDefault();
      dispatch({ type: 'DELETE_BLOCK', pageId, blockId: block.id });
      setEditingBlockId(null);
    }
    if (e.key === 'Escape') {
      commitEdit();
      setEditingBlockId(null);
    }
    if (e.key === 'ArrowUp' && e.altKey) {
      e.preventDefault();
      commitEdit();
      dispatch({ type: 'MOVE_BLOCK_UP', pageId, blockId: block.id });
    }
    if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault();
      commitEdit();
      dispatch({ type: 'MOVE_BLOCK_DOWN', pageId, blockId: block.id });
    }
  }, [showSlash, filteredCommands, slashIndex, localContent, block.id, pageId, dispatch, commitEdit, setEditingBlockId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);
    const slashPos = val.lastIndexOf('/');
    if (slashPos >= 0 && (slashPos === 0 || val[slashPos - 1] === ' ' || val[slashPos - 1] === '\n')) {
      const afterSlash = val.slice(slashPos + 1);
      if (!afterSlash.includes(' ') && !afterSlash.includes('\n')) {
        setShowSlash(true);
        setSlashQuery(afterSlash);
        setSlashIndex(0);
        return;
      }
    }
    setShowSlash(false);
  };

  const isDone = block.taskStatus === 'DONE' || block.taskStatus === 'CANCELLED';
  const hasChildren = block.children.length > 0;
  const indentPx = depth * 18;

  return (
    <div style={{ paddingLeft: depth > 0 ? indentPx : 0 }}>
      <div
        className={`group relative flex items-start gap-1.5 py-0.5 px-1 rounded-md transition-colors ${
          isFocused ? 'bg-white/4' : 'hover:bg-white/3'
        }`}
        onClick={() => setFocusedBlockId(block.id)}
      >
        {/* Depth guide line */}
        {depth > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 w-px opacity-20"
            style={{ left: -9, background: 'rgba(99,102,241,0.5)' }}
          />
        )}

        {/* Collapse toggle */}
        <button
          className={`shrink-0 mt-1 w-4 h-4 flex items-center justify-center rounded transition-all opacity-0 group-hover:opacity-100 ${hasChildren ? 'hover:bg-white/10' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) dispatch({ type: 'TOGGLE_COLLAPSE', pageId, blockId: block.id });
          }}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {hasChildren ? (
            block.collapsed
              ? <ChevronRight size={11} className="text-slate-400" />
              : <ChevronDown size={11} className="text-slate-400" />
          ) : null}
        </button>

        {/* Bullet + Task */}
        <button
          className="shrink-0 mt-1.5 flex items-center gap-1 cursor-pointer group/bullet"
          onClick={(e) => {
            e.stopPropagation();
            if (block.taskStatus !== null) {
              dispatch({ type: 'TOGGLE_TASK', pageId, blockId: block.id });
            }
          }}
        >
          {block.taskStatus ? (
            <div
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                block.taskStatus === 'DONE' ? 'bg-emerald-500 border-emerald-500' :
                block.taskStatus === 'DOING' ? 'border-amber-400 bg-amber-400/20' :
                block.taskStatus === 'NOW' ? 'border-rose-400 bg-rose-400/20' :
                block.taskStatus === 'LATER' ? 'border-slate-500 bg-slate-500/10' :
                block.taskStatus === 'CANCELLED' ? 'border-slate-600 bg-slate-600/10' :
                'border-slate-500 bg-transparent'
              }`}
            >
              {block.taskStatus === 'DONE' && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {block.taskStatus === 'CANCELLED' && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M2 2L6 6M6 2L2 6" stroke="#475569" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </div>
          ) : (
            <div
              className="w-1.5 h-1.5 rounded-full transition-all group-hover/bullet:scale-150"
              style={{ background: 'rgba(99,102,241,0.6)' }}
            />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 relative">
          {isEditing ? (
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={localContent}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={() => { commitEdit(); setEditingBlockId(null); setShowSlash(false); }}
                className="w-full bg-transparent text-slate-200 resize-none min-h-[20px] outline-none leading-relaxed"
                style={{
                  fontSize: '13px',
                  caretColor: '#6366f1',
                  lineHeight: 1.65,
                  overflowY: 'hidden',
                }}
                spellCheck={false}
              />

              {/* Slash command menu */}
              {showSlash && filteredCommands.length > 0 && (
                <div
                  className="absolute top-full left-0 z-50 rounded-xl overflow-hidden shadow-2xl animate-scale-in"
                  style={{
                    background: 'rgba(15,15,25,0.97)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    backdropFilter: 'blur(24px)',
                    minWidth: 220,
                    maxHeight: 260,
                    overflowY: 'auto',
                  }}
                >
                  <div className="px-3 py-2 border-b border-white/6">
                    <span className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">Commands</span>
                  </div>
                  {filteredCommands.map((cmd, i) => (
                    <button
                      key={cmd.label}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        i === slashIndex ? 'bg-indigo-500/20' : 'hover:bg-white/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const slashPos = localContent.lastIndexOf('/');
                        const newContent = localContent.slice(0, slashPos) + cmd.action;
                        setLocalContent(newContent);
                        setShowSlash(false);
                        dispatch({ type: 'UPDATE_BLOCK', pageId, blockId: block.id, content: newContent });
                      }}
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
                      >
                        {cmd.emoji}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{cmd.label}</div>
                        <div className="text-[10px] text-slate-500">{cmd.desc}</div>
                      </div>
                      <span className="ml-auto text-[10px] text-slate-600 shrink-0">{cmd.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              className={`leading-relaxed text-[13px] cursor-text min-h-[20px] break-words ${isDone ? 'opacity-50' : ''}`}
              style={{ lineHeight: 1.65, color: '#cbd5e1' }}
              onClick={() => setEditingBlockId(block.id)}
              onDoubleClick={() => setEditingBlockId(block.id)}
            >
              {block.taskStatus && <TaskBadge status={block.taskStatus} />}
              {parseInlineMarkdown(block.content, navigateTo)}
              {block.content === '' && (
                <span className="text-slate-600 text-[13px]">Click to edit...</span>
              )}
            </div>
          )}
        </div>

        {/* Block action toolbar (hover) */}
        {isFocused && !isEditing && (
          <div
            className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
              title="Add block below"
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADD_BLOCK', pageId, afterBlockId: block.id }); }}
            >
              <Plus size={10} />
            </button>
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
              title="Move up (Alt+↑)"
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_BLOCK_UP', pageId, blockId: block.id }); }}
            >
              <ArrowUp size={10} />
            </button>
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
              title="Move down (Alt+↓)"
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_BLOCK_DOWN', pageId, blockId: block.id }); }}
            >
              <ArrowDown size={10} />
            </button>
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
              title="Indent (Tab)"
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'INDENT_BLOCK', pageId, blockId: block.id }); }}
            >
              <Indent size={10} />
            </button>
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
              title="Delete block"
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_BLOCK', pageId, blockId: block.id }); }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && !block.collapsed && (
        <div className="relative">
          {block.children.map(child => (
            <BlockItem
              key={child.id}
              block={child}
              pageId={pageId}
              depth={depth + 1}
              editingBlockId={editingBlockId}
              focusedBlockId={focusedBlockId}
              setEditingBlockId={setEditingBlockId}
              setFocusedBlockId={setFocusedBlockId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────
export default function LogseqEditor() {
  const { state, dispatch, navigateTo, getBacklinks } = useDatabase();
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const page = state.db[state.currentPageId];

  const backlinks = page ? getBacklinks(page.name) : [];

  const handleAddBlock = () => {
    if (!page) return;
    const lastBlock = page.blocks[page.blocks.length - 1];
    if (lastBlock) {
      dispatch({ type: 'ADD_BLOCK', pageId: page.id, afterBlockId: lastBlock.id });
    }
  };

  if (!page) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Page not found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Page content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {/* Page header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            {page.isJournal ? (
              <span className="text-base">📅</span>
            ) : (
              <span className="text-base">{page.properties?.icon || '📄'}</span>
            )}
            {page.isJournal ? (
              <div>
                <div className="text-xs text-slate-500 font-medium">
                  {format(new Date(page.name + 'T12:00:00'), 'EEEE')}
                </div>
                <div className="text-sm font-semibold text-slate-200">
                  {format(new Date(page.name + 'T12:00:00'), 'MMMM do, yyyy')}
                </div>
              </div>
            ) : (
              <div className="text-sm font-bold text-slate-100">{page.name}</div>
            )}
          </div>

          {/* Properties */}
          {Object.entries(page.properties).filter(([k]) => k !== 'icon').length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(page.properties)
                .filter(([k]) => k !== 'icon')
                .map(([k, v]) => (
                  <span
                    key={k}
                    className="text-[10px] px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    {k}: {v}
                  </span>
                ))
              }
            </div>
          )}

          {/* Tags */}
          {page.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {page.tags.map(tag => (
                <span key={tag} className="md-tag text-[10px]">#{tag}</span>
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
              pageId={page.id}
              depth={0}
              editingBlockId={editingBlockId}
              focusedBlockId={focusedBlockId}
              setEditingBlockId={setEditingBlockId}
              setFocusedBlockId={setFocusedBlockId}
            />
          ))}
        </div>

        {/* Add block button */}
        <button
          className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/4 transition-all text-xs group"
          onClick={handleAddBlock}
        >
          <Plus size={12} className="group-hover:text-indigo-400 transition-colors" />
          <span>Add block</span>
        </button>

        {/* Backlinks */}
        {backlinks.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/8">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink size={12} className="text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {backlinks.length} Linked Reference{backlinks.length > 1 ? 's' : ''}
              </span>
            </div>
            {backlinks.map(({ page: refPage, blocks: refBlocks }) => (
              <div key={refPage.id} className="mb-3">
                <button
                  className="flex items-center gap-1.5 mb-1.5 hover:text-indigo-400 transition-colors group"
                  onClick={() => navigateTo(refPage.id)}
                >
                  <span className="text-xs">
                    {refPage.properties?.icon || (refPage.isJournal ? '📅' : '📄')}
                  </span>
                  <span className="text-xs font-semibold text-slate-400 group-hover:text-indigo-400 transition-colors">
                    {refPage.isJournal
                      ? (() => { try { return format(new Date(refPage.name + 'T12:00:00'), 'MMM d, yyyy'); } catch { return refPage.name; } })()
                      : refPage.name
                    }
                  </span>
                </button>
                {refBlocks.slice(0, 2).map(b => (
                  <div
                    key={b.id}
                    className="text-[11px] text-slate-500 pl-3 py-1 border-l border-white/8 mb-1 cursor-pointer hover:text-slate-400 hover:border-indigo-500/30 transition-all truncate"
                    onClick={() => navigateTo(refPage.id)}
                  >
                    {b.content}
                  </div>
                ))}
                {refBlocks.length > 2 && (
                  <div className="text-[10px] text-slate-600 pl-3">+{refBlocks.length - 2} more</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="h-16" />
      </div>

      {/* Mobile action bar */}
      <div
        className="shrink-0 flex items-center justify-around px-2 py-1.5 border-t"
        style={{
          borderColor: 'rgba(255,255,255,0.06)',
          background: 'rgba(10,10,20,0.8)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {[
          { icon: <Indent size={14} />, label: 'Indent', action: () => focusedBlockId && dispatch({ type: 'INDENT_BLOCK', pageId: page.id, blockId: focusedBlockId }) },
          { icon: <Outdent size={14} />, label: 'Outdent', action: () => focusedBlockId && dispatch({ type: 'OUTDENT_BLOCK', pageId: page.id, blockId: focusedBlockId }) },
          { icon: <ArrowUp size={14} />, label: 'Up', action: () => focusedBlockId && dispatch({ type: 'MOVE_BLOCK_UP', pageId: page.id, blockId: focusedBlockId }) },
          { icon: <ArrowDown size={14} />, label: 'Down', action: () => focusedBlockId && dispatch({ type: 'MOVE_BLOCK_DOWN', pageId: page.id, blockId: focusedBlockId }) },
          { icon: <Plus size={14} />, label: 'Add', action: handleAddBlock },
        ].map(item => (
          <button
            key={item.label}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-all active:scale-95"
            onClick={item.action}
          >
            {item.icon}
            <span className="text-[9px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
