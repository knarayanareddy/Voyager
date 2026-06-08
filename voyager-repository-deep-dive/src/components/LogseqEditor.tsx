import React, { useState, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Block } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Star, Trash2, ChevronDown, ChevronRight, CornerDownRight, CheckSquare, Square, Plus, Trash, ArrowRight, ArrowLeft } from 'lucide-react';

interface LogseqEditorProps {
  pageId: string;
}

export const LogseqEditor: React.FC<LogseqEditorProps> = ({ pageId }) => {
  const { state, actions } = useDatabase();
  const page = state.pages[pageId];

  // Editor states
  const [editingBlockUuid, setEditingBlockUuid] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});

  // Slash commands popup state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  if (!page) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-neutral-500">
        <p className="text-xs font-semibold">Page not found or deleted.</p>
      </div>
    );
  }

  // Handle keyboard events in editor
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>, blockUuid: string) => {
    // 1. Tab -> Indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const success = await actions.indentBlock(pageId, blockUuid);
      // Keep editing the same block after indent
      if (success) {
        setTimeout(() => setEditingBlockUuid(blockUuid), 50);
      }
    }

    // 2. Shift + Tab -> Outdent
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const success = await actions.outdentBlock(pageId, blockUuid);
      if (success) {
        setTimeout(() => setEditingBlockUuid(blockUuid), 50);
      }
    }

    // 3. Enter -> Save current block & insert a new block below
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Save current block
      await actions.updateBlock(pageId, blockUuid, editValue);
      setEditingBlockUuid(null);
      setShowSlashMenu(false);

      // Add a new sibling block below this one
      const newUuid = await actions.addBlock(pageId, blockUuid, false);
      
      // Immediately open new block in edit mode
      setEditingBlockUuid(newUuid);
      setEditValue('');
    }

    // 4. Escape -> Discard edits / close editor
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditingBlockUuid(null);
      setShowSlashMenu(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setEditValue(value);

    // Trigger Slash Menu on '/'
    const cursorIndex = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorIndex);
    
    if (textBeforeCursor.endsWith('/')) {
      const coords = getCursorCoordinates(e.target);
      setSlashMenuPosition(coords);
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  const getCursorCoordinates = (textarea: HTMLTextAreaElement) => {
    // Simple coordinate estimation relative to the textarea bounds
    const rect = textarea.getBoundingClientRect();
    return {
      top: rect.top + 24 - window.scrollY,
      left: rect.left + 10 - window.scrollX
    };
  };

  const insertSlashCommand = async (command: string, blockUuid: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const cursorIndex = textarea.selectionStart;
    const before = editValue.slice(0, cursorIndex - 1); // Remove the '/'
    const after = editValue.slice(cursorIndex);
    
    let commandText = '';
    let updates: Partial<Block> = {};

    switch (command) {
      case 'todo':
        commandText = before + after;
        updates.taskStatus = 'TODO';
        break;
      case 'later':
        commandText = before + after;
        updates.taskStatus = 'LATER';
        break;
      case 'card':
        commandText = before + ' #card' + after;
        break;
      case 'h1':
        commandText = before + '# ' + after;
        break;
      case 'h2':
        commandText = before + '## ' + after;
        break;
      case 'code':
        commandText = before + '```javascript\n\n```' + after;
        break;
      case 'camera':
        // Insert a trigger for camera
        commandText = before + '![Camera Capture](media-id)' + after;
        actions.setActiveView('media');
        break;
      case 'drawing':
        commandText = before + '![S-Pen Sketch](media-id)' + after;
        actions.updateSettings({ sPenActive: true });
        break;
      default:
        commandText = editValue;
    }

    setEditValue(commandText);
    setShowSlashMenu(false);
    
    // Save block updates immediately
    await actions.updateBlock(pageId, blockUuid, commandText, updates);
    textarea.focus();
  };

  const handleStartEdit = (block: Block) => {
    setEditingBlockUuid(block.uuid);
    setEditValue(block.content);
  };

  const handleSaveBlock = async (blockUuid: string) => {
    await actions.updateBlock(pageId, blockUuid, editValue);
    setEditingBlockUuid(null);
    setShowSlashMenu(false);
  };

  const handleCycleTask = async (block: Block) => {
    const nextStatus: Record<string, Block['taskStatus']> = {
      'TODO': 'DOING',
      'DOING': 'DONE',
      'DONE': null,
    };
    const newStatus = nextStatus[block.taskStatus || ''] || 'TODO';
    await actions.updateBlock(pageId, block.uuid, block.content, { taskStatus: newStatus });
  };

  // Toggle Collapse
  const toggleCollapse = (blockUuid: string) => {
    setCollapsedBlocks(prev => ({
      ...prev,
      [blockUuid]: !prev[blockUuid]
    }));
  };

  // --- RECURSIVE BLOCK RENDERER ---
  const renderBlockItem = (block: Block, depth: number = 0) => {
    const isEditing = editingBlockUuid === block.uuid;
    const hasChildren = block.children && block.children.length > 0;
    const isCollapsed = collapsedBlocks[block.uuid] || false;

    return (
      <div key={block.uuid} className="flex flex-col select-text">
        {/* Block Content Row */}
        <div className="group flex items-start gap-1.5 py-1 px-1 rounded hover:bg-neutral-800/30 transition-colors relative">
          
          {/* Bullet/Collapse Icon */}
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
            {hasChildren ? (
              <button
                onClick={() => toggleCollapse(block.uuid)}
                className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 group-hover:bg-neutral-400 transition-colors" />
            )}
          </div>

          {/* Task Checkbox */}
          {block.taskStatus && (
            <button
              onClick={() => handleCycleTask(block)}
              className="mt-1 flex-shrink-0 cursor-pointer text-neutral-400 hover:text-white transition-colors"
            >
              {block.taskStatus === 'DONE' ? (
                <CheckSquare className="w-4 h-4 text-emerald-500" />
              ) : block.taskStatus === 'DOING' ? (
                <div className="w-4 h-4 rounded border border-blue-500 flex items-center justify-center text-[8px] text-blue-400 font-bold font-mono bg-blue-500/10">
                  ⚡
                </div>
              ) : (
                <Square className="w-4 h-4 text-neutral-500" />
              )}
            </button>
          )}

          {/* Block Content Area */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex flex-col gap-1.5 relative">
                <textarea
                  ref={textareaRef}
                  value={editValue}
                  onChange={handleTextareaChange}
                  onKeyDown={(e) => handleKeyDown(e, block.uuid)}
                  onBlur={() => handleSaveBlock(block.uuid)}
                  className="w-full bg-neutral-950 text-white border border-blue-500 rounded p-2 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-400 leading-relaxed font-sans min-h-[44px] resize-y"
                  autoFocus
                />
                
                {/* Floating Slash Commands Menu */}
                {showSlashMenu && (
                  <div
                    className="fixed z-50 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden py-1 max-h-48 overflow-y-auto pointer-events-auto animate-in zoom-in-95 duration-100"
                    style={{
                      top: `${slashMenuPosition.top}px`,
                      left: `${slashMenuPosition.left}px`
                    }}
                    onMouseDown={(e) => e.preventDefault()} // Prevent textarea blur
                  >
                    {[
                      { cmd: 'todo', label: 'Task: TODO', desc: 'Create a TODO item' },
                      { cmd: 'later', label: 'Task: LATER', desc: 'Schedule a LATER item' },
                      { cmd: 'card', label: 'Flashcard #card', desc: 'Make this a flashcard' },
                      { cmd: 'h1', label: 'Heading 1', desc: 'Make this a large header' },
                      { cmd: 'h2', label: 'Heading 2', desc: 'Make this a medium header' },
                      { cmd: 'code', label: 'Code Block', desc: 'Insert a code editor' },
                      { cmd: 'camera', label: 'Insert Photo', desc: 'Take a camera shot' },
                      { cmd: 'drawing', label: 'S-Pen Sketch', desc: 'Draw with S-Pen' }
                    ].map(item => (
                      <button
                        key={item.cmd}
                        onClick={() => insertSlashCommand(item.cmd, block.uuid)}
                        className="w-full text-left px-3.5 py-1.5 hover:bg-neutral-800 transition-colors flex flex-col cursor-pointer"
                      >
                        <span className="text-xs font-bold text-neutral-200">{item.label}</span>
                        <span className="text-[9px] text-neutral-500">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Inline Editing Controls (For mobile layout convenience) */}
                <div className="flex items-center gap-1.5 self-end text-[10px]">
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      actions.indentBlock(pageId, block.uuid);
                    }}
                    className="bg-neutral-800 text-neutral-300 px-2 py-0.8 rounded hover:bg-neutral-700 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <ArrowRight className="w-3 h-3" /> Indent
                  </button>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      actions.outdentBlock(pageId, block.uuid);
                    }}
                    className="bg-neutral-800 text-neutral-300 px-2 py-0.8 rounded hover:bg-neutral-700 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" /> Outdent
                  </button>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (confirm('Delete this block and all its nested children?')) {
                        actions.deleteBlock(pageId, block.uuid);
                      }
                    }}
                    className="bg-red-950 hover:bg-red-900 text-red-400 px-2 py-0.8 rounded border border-red-900/30 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Trash className="w-3 h-3" /> Delete
                  </button>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSaveBlock(block.uuid);
                    }}
                    className="bg-emerald-600 text-white px-3 py-0.8 rounded hover:bg-emerald-500 font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDoubleClick={() => handleStartEdit(block)}
                className={`text-xs font-medium leading-relaxed rounded p-1 hover:bg-neutral-800/20 cursor-text min-h-[22px] ${
                  block.taskStatus === 'DONE' ? 'text-neutral-500 line-through decoration-neutral-600' : 'text-neutral-200'
                }`}
              >
                <MarkdownRenderer
                  content={block.content}
                  onLinkClick={(targetName, isShift) => {
                    // Find or create page
                    const targetPage = Object.values(state.pages).find(
                      p => p.name.toLowerCase() === targetName.toLowerCase()
                    );
                    
                    if (targetPage) {
                      if (isShift) {
                        actions.navigateSidebar(targetPage.id);
                      } else {
                        actions.navigateToPage(targetPage.id);
                      }
                    } else {
                      // Create page
                      actions.createPage(targetName, false).then(newPageId => {
                        if (isShift) {
                          actions.navigateSidebar(newPageId);
                        } else {
                          actions.navigateToPage(newPageId);
                        }
                      });
                    }
                  }}
                  onTagClick={(tag) => {
                    // Tag click search: we could filter or navigate
                    // For now we'll create/nav to a page of that tag
                    const pageName = `#${tag}`;
                    const targetPage = Object.values(state.pages).find(
                      p => p.name.toLowerCase() === pageName.toLowerCase()
                    );

                    if (targetPage) {
                      actions.navigateToPage(targetPage.id);
                    } else {
                      actions.createPage(pageName, false).then(newPageId => {
                        actions.navigateToPage(newPageId);
                      });
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Render Children Recursively */}
        {hasChildren && !isCollapsed && (
          <div className="ml-4 pl-2.5 border-l border-neutral-800/80 flex flex-col">
            {block.children.map(child => renderBlockItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Check if page is currently in favorites
  const isFavorite = state.favorites.includes(pageId);

  // Re-compute backlinks dynamically for this page
  const backlinks = state.backlinks[pageId] || [];

  return (
    <div className="flex-1 flex flex-col bg-neutral-900 text-white overflow-y-auto p-4 select-text">
      
      {/* Page Title & Actions Bar */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4 select-none">
        <div className="flex items-center gap-2 max-w-[70%]">
          <h1 className="text-base font-bold text-white tracking-wide truncate" title={page.name}>
            {page.name}
          </h1>
          
          {/* Favorite Toggle */}
          <button
            onClick={() => actions.toggleFavorite(pageId)}
            className={`p-1 rounded-md hover:bg-neutral-850 transition-all cursor-pointer ${
              isFavorite ? 'text-amber-500 fill-amber-500 scale-110' : 'text-neutral-500 hover:text-neutral-300'
            }`}
            title="Toggle Favorite"
          >
            <Star className="w-4 h-4" />
          </button>
        </div>

        {/* Delete Page (Only if not the today's journal page, which is critical) */}
        {!page.isJournal && (
          <button
            onClick={() => {
              if (confirm(`Delete the page "${page.name}" and all its content?`)) {
                // Navigate to a safe fallback first
                const fallbackId = Object.keys(state.pages).find(id => id !== pageId) || '';
                if (fallbackId) {
                  actions.navigateToPage(fallbackId);
                }
                actions.deletePage(pageId);
              }
            }}
            className="p-1.5 rounded-md hover:bg-red-950/40 text-neutral-500 hover:text-red-400 transition-colors border border-transparent hover:border-red-900/30 cursor-pointer"
            title="Delete Page"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Blocks List */}
      <div className="flex-1 flex flex-col gap-1.5">
        {page.blocks.map(block => renderBlockItem(block))}
        
        {/* Add Block at Bottom */}
        <button
          onClick={async () => {
            const lastBlock = page.blocks[page.blocks.length - 1];
            const newUuid = await actions.addBlock(pageId, lastBlock.uuid, false);
            setEditingBlockUuid(newUuid);
            setEditValue('');
          }}
          className="mt-4 border border-dashed border-neutral-800 hover:border-neutral-700 text-neutral-500 hover:text-neutral-400 py-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add new block
        </button>
      </div>

      {/* BACKLINKS SECTION */}
      <div className="mt-8 border-t border-neutral-800 pt-5 mb-4 select-none">
        <h3 className="text-xs font-bold text-neutral-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
          <CornerDownRight className="w-3.5 h-3.5 text-blue-500" /> Backlinks ({backlinks.length})
        </h3>

        {backlinks.length === 0 ? (
          <p className="text-[10px] text-neutral-600 italic">No other pages link here yet.</p>
        ) : (
          <div className="space-y-2 select-text">
            {backlinks.map((item, idx) => (
              <div
                key={idx}
                onClick={() => actions.navigateToPage(item.pageId)}
                className="bg-neutral-950/85 hover:bg-neutral-950 border border-neutral-850 hover:border-neutral-800 rounded-xl p-3 shadow cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold text-blue-400 hover:underline">
                    {item.pageName}
                  </span>
                  <span className="text-[8px] text-neutral-600 font-mono">
                    Block: {item.blockUuid.slice(0, 8)}...
                  </span>
                </div>
                <div className="text-[11px] text-neutral-300 italic pl-2 border-l border-neutral-800">
                  <MarkdownRenderer content={item.content} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
