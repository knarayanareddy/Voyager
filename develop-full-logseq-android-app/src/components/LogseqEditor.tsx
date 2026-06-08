import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Block } from '../types';
import { useDatabase } from '../context/DatabaseContext';
import { parseInlineMarkdown } from '../utils/markdown';
import { format } from 'date-fns';
import {
  ChevronRight, ChevronDown, Plus, Trash2, ArrowUp, ArrowDown,
  AlignLeft, CheckSquare, Hash, Link, MoreHorizontal,
  ChevronsRight, ChevronsLeft
} from 'lucide-react';

// ─────────────────────────── SLASH COMMANDS ───────────────────────────

const SLASH_COMMANDS = [
  { label: 'TODO', icon: '☐', action: 'TODO ', category: 'Task' },
  { label: 'DOING', icon: '⟳', action: 'DOING ', category: 'Task' },
  { label: 'DONE', icon: '✓', action: 'DONE ', category: 'Task' },
  { label: 'NOW', icon: '⚡', action: 'NOW ', category: 'Task' },
  { label: 'LATER', icon: '⏰', action: 'LATER ', category: 'Task' },
  { label: 'CANCELLED', icon: '✗', action: 'CANCELLED ', category: 'Task' },
  { label: 'Heading 1', icon: 'H1', action: '# ', category: 'Heading' },
  { label: 'Heading 2', icon: 'H2', action: '## ', category: 'Heading' },
  { label: 'Heading 3', icon: 'H3', action: '### ', category: 'Heading' },
  { label: 'Heading 4', icon: 'H4', action: '#### ', category: 'Heading' },
  { label: 'Code Block', icon: '</>', action: '```\n```', category: 'Format' },
  { label: 'Blockquote', icon: '"', action: '> ', category: 'Format' },
  { label: 'Bold', icon: 'B', action: '**bold**', category: 'Format' },
  { label: 'Italic', icon: 'I', action: '*italic*', category: 'Format' },
  { label: 'Highlight', icon: '==', action: '==highlight==', category: 'Format' },
  { label: 'Strikethrough', icon: 'S̶', action: '~~strikethrough~~', category: 'Format' },
  { label: 'Date', icon: '📅', action: `[[${format(new Date(), 'yyyy-MM-dd')}]]`, category: 'Insert' },
  { label: 'Link', icon: '🔗', action: '[[', category: 'Insert' },
  { label: 'Tag', icon: '#', action: '#', category: 'Insert' },
  { label: 'Image', icon: '🖼', action: '![alt](url)', category: 'Insert' },
  { label: 'Card', icon: '🃏', action: '#card', category: 'Insert' },
  { label: 'Table', icon: '⊞', action: '| Col 1 | Col 2 |\n| --- | --- |\n| Cell | Cell |', category: 'Insert' },
  { label: 'Divider', icon: '—', action: '---', category: 'Insert' },
];

// ─────────────────────────── TASK BADGE ───────────────────────────

function TaskBadge({ status, onClick }: { status: Block['taskStatus']; onClick: () => void }) {
  if (!status) return null;
  const configs: Record<string, { color: string; bg: string; label: string; pulse?: boolean }> = {
    TODO:      { color: 'text-blue-400',   bg: 'bg-blue-500/20',   label: 'TODO' },
    DOING:     { color: 'text-amber-400',  bg: 'bg-amber-500/20',  label: 'DOING',     pulse: true },
    DONE:      { color: 'text-green-400',  bg: 'bg-green-500/20',  label: 'DONE' },
    LATER:     { color: 'text-gray-400',   bg: 'bg-gray-500/20',   label: 'LATER' },
    NOW:       { color: 'text-rose-400',   bg: 'bg-rose-500/20',   label: 'NOW',       pulse: true },
    CANCELLED: { color: 'text-gray-500',   bg: 'bg-gray-500/10',   label: 'CANCELLED' },
  };
  const cfg = configs[status];
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5 cursor-pointer select-none shrink-0 ${cfg.color} ${cfg.bg} ${cfg.pulse ? 'animate-pulse' : ''}`}
      onClick={onClick}
    >
      {cfg.label}
    </span>
  );
}

// ─────────────────────────── BLOCK RENDERER ───────────────────────────

interface BlockProps {
  block: Block;
  pageId: string;
  depth: number;
  onNavigate: (name: string) => void;
  focusedBlockId: string | null;
  setFocusedBlockId: (id: string | null) => void;
  editingBlockId: string | null;
  setEditingBlockId: (id: string | null) => void;
}

function BlockView({
  block, pageId, depth, onNavigate,
  focusedBlockId, setFocusedBlockId, editingBlockId, setEditingBlockId
}: BlockProps) {
  const { dispatch } = useDatabase();
  const [localContent, setLocalContent] = useState(block.content);
  const [showSlash, setShowSlash] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = editingBlockId === block.id;
  const isFocused = focusedBlockId === block.id;

  // Sync content from props when not editing
  useEffect(() => {
    if (!isEditing) setLocalContent(block.content);
  }, [block.content, isEditing]);

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [localContent, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    if (localContent !== block.content) {
      dispatch({ type: 'UPDATE_BLOCK', pageId, blockId: block.id, content: localContent });
    }
  }, [localContent, block.content, block.id, pageId, dispatch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlash) {
      const filtered = SLASH_COMMANDS.filter(c =>
        c.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(slashQuery.toLowerCase())
      );
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => (i + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(i => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter' && filtered[slashIndex]) {
        e.preventDefault();
        const cmd = filtered[slashIndex];
        const slashPos = localContent.lastIndexOf('/');
        const newContent = localContent.slice(0, slashPos) + cmd.action;
        setLocalContent(newContent);
        setShowSlash(false);
        setSlashQuery('');
        dispatch({ type: 'UPDATE_BLOCK', pageId, blockId: block.id, content: newContent });

        // Handle task status from slash command
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
  }, [showSlash, slashQuery, slashIndex, localContent, block.id, pageId, dispatch, commitEdit, setEditingBlockId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);

    // Detect slash command
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

    // Detect [[ link
    if (val.endsWith('[[')) {
      // Could open link picker — for now just let it flow
    }
  };

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
    c.category.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const isDone = block.taskStatus === 'DONE' || block.taskStatus === 'CANCELLED';
  const hasChildren = block.children.length > 0;

  return (
    <div className="block-container relative group" style={{ marginLeft: depth > 0 ? '0' : '0' }}>
      <div
        className={`flex items-start gap-1 py-0.5 rounded-md transition-colors ${isFocused ? 'bg-[var(--color-surface-hover)]' : 'hover:bg-[var(--color-surface-hover)]/50'}`}
        onClick={() => setFocusedBlockId(block.id)}
      >
        {/* Collapse toggle */}
        <button
          className={`flex-shrink-0 w-4 h-5 flex items-center justify-center text-[var(--color-text-tertiary)] mt-0.5 transition-opacity ${hasChildren ? 'opacity-100' : 'opacity-0 group-hover:opacity-30'}`}
          onClick={(e) => { e.stopPropagation(); if (hasChildren) dispatch({ type: 'TOGGLE_COLLAPSE', pageId, blockId: block.id }); }}
        >
          {hasChildren ? (block.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />) : null}
        </button>

        {/* Bullet */}
        <button
          className={`flex-shrink-0 w-3 h-3 rounded-full mt-1.5 transition-all cursor-pointer border ${
            block.taskStatus ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/20' :
            isFocused ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/30' :
            'border-[var(--color-text-tertiary)]/50 group-hover:border-[var(--color-accent)]/60'
          }`}
          onClick={(e) => { e.stopPropagation(); if (block.taskStatus) dispatch({ type: 'TOGGLE_TASK', pageId, blockId: block.id }); }}
          onDoubleClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_COLLAPSE', pageId, blockId: block.id }); }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={localContent}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={() => { commitEdit(); setEditingBlockId(null); setShowSlash(false); }}
                spellCheck={false}
                className="w-full bg-transparent text-[var(--color-text-primary)] text-sm leading-relaxed resize-none outline-none focus:outline-none font-mono"
                style={{ fontFamily: 'inherit', minHeight: '1.5rem' }}
                rows={1}
              />
              {showSlash && filteredCommands.length > 0 && (
                <div className="absolute top-full left-0 z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl max-h-48 overflow-y-auto w-56 mt-1">
                  {filteredCommands.map((cmd, i) => (
                    <button
                      key={cmd.label}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${i === slashIndex ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const slashPos = localContent.lastIndexOf('/');
                        const newContent = localContent.slice(0, slashPos) + cmd.action;
                        setLocalContent(newContent);
                        setShowSlash(false);
                        dispatch({ type: 'UPDATE_BLOCK', pageId, blockId: block.id, content: newContent });
                      }}
                    >
                      <span className="w-6 text-center text-xs opacity-70">{cmd.icon}</span>
                      <span>{cmd.label}</span>
                      <span className="ml-auto text-xs opacity-40">{cmd.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              className={`text-sm leading-relaxed cursor-text min-h-[1.4rem] break-words ${isDone ? 'line-through opacity-50' : 'text-[var(--color-text-primary)]'}`}
              onClick={() => setEditingBlockId(block.id)}
            >
              <TaskBadge status={block.taskStatus} onClick={() => dispatch({ type: 'TOGGLE_TASK', pageId, blockId: block.id })} />
              {block.content ? parseInlineMarkdown(block.content, onNavigate) : (
                <span className="text-[var(--color-text-tertiary)] italic text-xs">Empty block — click to edit</span>
              )}
              {hasChildren && block.collapsed && (
                <span className="ml-2 text-[var(--color-text-tertiary)] text-xs">({block.children.length} hidden)</span>
              )}
            </div>
          )}
        </div>

        {/* Block actions */}
        <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0`}>
          <button
            className="p-0.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            title="Block menu"
          >
            <MoreHorizontal size={12} />
          </button>
        </div>

        {/* Block context menu */}
        {showMenu && (
          <div className="absolute right-0 top-6 z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl w-44 py-1">
            {[
              { label: 'Add block below', icon: <Plus size={12}/>, action: () => dispatch({ type: 'ADD_BLOCK', pageId, afterBlockId: block.id }) },
              { label: 'Add child block', icon: <ChevronsRight size={12}/>, action: () => dispatch({ type: 'ADD_CHILD_BLOCK', pageId, parentBlockId: block.id }) },
              { label: 'Move up', icon: <ArrowUp size={12}/>, action: () => dispatch({ type: 'MOVE_BLOCK_UP', pageId, blockId: block.id }) },
              { label: 'Move down', icon: <ArrowDown size={12}/>, action: () => dispatch({ type: 'MOVE_BLOCK_DOWN', pageId, blockId: block.id }) },
              { label: 'Indent', icon: <ChevronsRight size={12}/>, action: () => dispatch({ type: 'INDENT_BLOCK', pageId, blockId: block.id }) },
              { label: 'Outdent', icon: <ChevronsLeft size={12}/>, action: () => dispatch({ type: 'OUTDENT_BLOCK', pageId, blockId: block.id }) },
              { label: 'Toggle task', icon: <CheckSquare size={12}/>, action: () => dispatch({ type: 'TOGGLE_TASK', pageId, blockId: block.id }) },
              { label: 'Open in sidebar', icon: <AlignLeft size={12}/>, action: () => dispatch({ type: 'OPEN_SIDEBAR', pageId }) },
              { label: 'Delete block', icon: <Trash2 size={12}/>, action: () => dispatch({ type: 'DELETE_BLOCK', pageId, blockId: block.id }) },
            ].map(item => (
              <button
                key={item.label}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                onClick={(e) => { e.stopPropagation(); item.action(); setShowMenu(false); }}
              >
                <span className="text-[var(--color-text-tertiary)]">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Children */}
      {!block.collapsed && block.children.length > 0 && (
        <div className="ml-6 border-l border-[var(--color-border)]/30 pl-3">
          {block.children.map(child => (
            <BlockView
              key={child.id}
              block={child}
              pageId={pageId}
              depth={depth + 1}
              onNavigate={onNavigate}
              focusedBlockId={focusedBlockId}
              setFocusedBlockId={setFocusedBlockId}
              editingBlockId={editingBlockId}
              setEditingBlockId={setEditingBlockId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── BACKLINKS ───────────────────────────

function BacklinksSection({ pageName, onNavigate }: { pageName: string; onNavigate: (name: string) => void }) {
  const { getBacklinks } = useDatabase();
  const backlinks = getBacklinks(pageName);
  const [expanded, setExpanded] = useState(true);
  if (backlinks.length === 0) return null;
  return (
    <div className="mt-8 border-t border-[var(--color-border)] pt-4">
      <button
        className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] mb-3 hover:text-[var(--color-text-primary)]"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        🔗 Linked References ({backlinks.length})
      </button>
      {expanded && backlinks.map(({ page, blocks }) => (
        <div key={page.id} className="mb-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-3">
          <button
            className="text-[var(--color-accent)] font-medium text-sm mb-2 hover:underline"
            onClick={() => onNavigate(page.id)}
          >
            {page.isJournal ? `📅 ${page.name}` : page.name}
          </button>
          {blocks.slice(0, 3).map(b => (
            <div key={b.id} className="text-xs text-[var(--color-text-secondary)] pl-2 border-l-2 border-[var(--color-accent)]/30 mb-1">
              {parseInlineMarkdown(b.content, onNavigate)}
            </div>
          ))}
          {blocks.length > 3 && <div className="text-xs text-[var(--color-text-tertiary)] mt-1">+{blocks.length - 3} more</div>}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────── MOBILE TOOLBAR ───────────────────────────

function MobileToolbar({ pageId, editingBlockId }: { pageId: string; editingBlockId: string | null }) {
  const { dispatch } = useDatabase();
  if (!editingBlockId) return null;
  const tools = [
    { icon: <ChevronsRight size={15} />, action: () => dispatch({ type: 'INDENT_BLOCK', pageId, blockId: editingBlockId }), title: 'Indent' },
    { icon: <ChevronsLeft size={15} />, action: () => dispatch({ type: 'OUTDENT_BLOCK', pageId, blockId: editingBlockId }), title: 'Outdent' },
    { icon: <ArrowUp size={15} />, action: () => dispatch({ type: 'MOVE_BLOCK_UP', pageId, blockId: editingBlockId }), title: 'Move up' },
    { icon: <ArrowDown size={15} />, action: () => dispatch({ type: 'MOVE_BLOCK_DOWN', pageId, blockId: editingBlockId }), title: 'Move down' },
    { icon: <CheckSquare size={15} />, action: () => dispatch({ type: 'TOGGLE_TASK', pageId, blockId: editingBlockId }), title: 'Toggle task' },
    { icon: <Plus size={15} />, action: () => dispatch({ type: 'ADD_BLOCK', pageId, afterBlockId: editingBlockId }), title: 'New block' },
    { icon: <Trash2 size={15} />, action: () => dispatch({ type: 'DELETE_BLOCK', pageId, blockId: editingBlockId }), title: 'Delete' },
    { icon: <Hash size={15} />, action: () => {}, title: 'Tag' },
    { icon: <Link size={15} />, action: () => {}, title: 'Link' },
  ];
  return (
    <div className="flex items-center overflow-x-auto gap-0.5 px-2 py-1.5 bg-[var(--color-surface)] border-t border-[var(--color-border)] shrink-0">
      {tools.map((t, i) => (
        <button
          key={i}
          className="flex-shrink-0 p-2 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] active:bg-[var(--color-accent)]/20"
          onClick={t.action}
          title={t.title}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────── MAIN EDITOR ───────────────────────────

export default function LogseqEditor({ pageId, compact = false }: { pageId: string; compact?: boolean }) {
  const { state, dispatch, navigateTo } = useDatabase();
  const page = state.db[pageId];
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [showProperties, setShowProperties] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFocusedBlockId(null);
    setEditingBlockId(null);
  }, [pageId]);

  if (!page) return (
    <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)]">
      Page not found
    </div>
  );

  const handleNavigate = (name: string) => {
    navigateTo(name);
  };

  const isJournal = page.isJournal;
  const displayTitle = isJournal
    ? (() => {
        try { return format(new Date(page.name + 'T12:00:00'), 'EEEE, MMMM do yyyy'); }
        catch { return page.name; }
      })()
    : page.name;

  const pageIcon = page.properties?.icon || (isJournal ? '📅' : '📄');

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Editor scroll area */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {/* Page header */}
        {!compact && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{pageIcon}</span>
              <h1
                className={`font-bold text-[var(--color-text-primary)] leading-tight ${
                  isJournal ? 'text-base' : 'text-xl'
                }`}
              >
                {displayTitle}
              </h1>
            </div>
            {Object.keys(page.properties).length > 0 && !isJournal && (
              <button
                className="text-xs text-[var(--color-text-tertiary)] mb-2 flex items-center gap-1"
                onClick={() => setShowProperties(!showProperties)}
              >
                {showProperties ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                Properties
              </button>
            )}
            {showProperties && (
              <div className="bg-[var(--color-surface)] rounded-lg p-2 mb-3 text-xs">
                {Object.entries(page.properties).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-[var(--color-text-tertiary)] font-mono">{k}::</span>
                    <span className="text-[var(--color-text-secondary)]">{v}</span>
                  </div>
                ))}
              </div>
            )}
            {page.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {page.tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-[10px] font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Blocks */}
        <div className="space-y-0.5">
          {page.blocks.map(block => (
            <BlockView
              key={block.id}
              block={block}
              pageId={pageId}
              depth={0}
              onNavigate={handleNavigate}
              focusedBlockId={focusedBlockId}
              setFocusedBlockId={setFocusedBlockId}
              editingBlockId={editingBlockId}
              setEditingBlockId={setEditingBlockId}
            />
          ))}
        </div>

        {/* Add block button */}
        <button
          className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors py-2"
          onClick={() => {
            const lastBlock = page.blocks[page.blocks.length - 1];
            if (lastBlock) {
              dispatch({ type: 'ADD_BLOCK', pageId, afterBlockId: lastBlock.id });
              setTimeout(() => setEditingBlockId(lastBlock.id), 50);
            }
          }}
        >
          <Plus size={14} />
          Add block
        </button>

        {/* Backlinks */}
        {!compact && <BacklinksSection pageName={page.name} onNavigate={handleNavigate} />}
      </div>

      {/* Mobile formatting toolbar */}
      <MobileToolbar pageId={pageId} editingBlockId={editingBlockId} />
    </div>
  );
}
