import { useState, useRef, useEffect } from 'react';
import { Page, Block } from '../types';
import { 
  ChevronDown, ChevronRight, Plus, Trash2, ArrowUp, ArrowDown, 
  Indent as IndentIcon, Outdent as OutdentIcon, Slash, CheckSquare, 
  Clock, CheckCircle2, Square, Link2, AlertCircle, FileText
} from 'lucide-react';
import { generateId } from '../mockData';

interface LogseqEditorProps {
  page: Page;
  pages: Page[];
  onUpdateBlocks: (newBlocks: Block[]) => void;
  onNavigate: (pageName: string) => void;
  theme: 'dark' | 'light';
  fontSize: number;
  isSidebarView?: boolean;
}

export default function LogseqEditor({
  page,
  pages,
  onUpdateBlocks,
  onNavigate,
  theme,
  fontSize,
  isSidebarView = false
}: LogseqEditorProps) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [slashMenuBlockId, setSlashMenuBlockId] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  // Focus the input when editing starts
  useEffect(() => {
    if (editingBlockId && editInputRef.current) {
      editInputRef.current.focus();
      // Put cursor at the end
      const length = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(length, length);
    }
  }, [editingBlockId]);

  // Handle clicking outside slash menu to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (slashMenuRef.current && !slashMenuRef.current.contains(event.target as Node)) {
        setSlashMenuBlockId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ensure page always has at least one block
  useEffect(() => {
    if (!page.blocks || page.blocks.length === 0) {
      onUpdateBlocks([{ id: generateId(), content: '', children: [] }]);
    }
  }, [page.name]);

  // --- TREE MANIPULATION HELPERS ---

  // 1. Update content or properties of a block
  const updateBlockContent = (blocks: Block[], id: string, newContent: string, properties: Partial<Block> = {}): Block[] => {
    return blocks.map(block => {
      if (block.id === id) {
        return { ...block, content: newContent, ...properties };
      }
      if (block.children && block.children.length > 0) {
        return { ...block, children: updateBlockContent(block.children, id, newContent, properties) };
      }
      return block;
    });
  };

  // 2. Find a block and its path (parent, index) in the tree
  const findBlockPath = (
    blocks: Block[], 
    targetId: string, 
    parent: Block | null = null
  ): { list: Block[]; index: number; parent: Block | null } | null => {
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].id === targetId) {
        return { list: blocks, index: i, parent };
      }
      if (blocks[i].children && blocks[i].children.length > 0) {
        const result = findBlockPath(blocks[i].children, targetId, blocks[i]);
        if (result) return result;
      }
    }
    return null;
  };

  // 3. Add a block below the target block
  const addBlockBelow = (targetId: string) => {
    const newBlocks = JSON.parse(JSON.stringify(page.blocks)) as Block[];
    const pathInfo = findBlockPath(newBlocks, targetId);
    if (!pathInfo) return;

    const { list, index } = pathInfo;
    const newId = generateId();
    const newBlock: Block = { id: newId, content: '', children: [] };
    
    list.splice(index + 1, 0, newBlock);
    onUpdateBlocks(newBlocks);
    setEditingBlockId(newId);
  };

  // 4. Delete a block
  const deleteBlock = (targetId: string) => {
    const newBlocks = JSON.parse(JSON.stringify(page.blocks)) as Block[];
    const pathInfo = findBlockPath(newBlocks, targetId);
    if (!pathInfo) return;

    const { list, index } = pathInfo;
    
    // If it is the only block in the editor, just clear its content
    if (newBlocks.length === 1 && newBlocks[0].children.length === 0 && newBlocks[0].id === targetId) {
      newBlocks[0].content = '';
      newBlocks[0].todoType = null;
      onUpdateBlocks(newBlocks);
      return;
    }

    list.splice(index, 1);
    onUpdateBlocks(newBlocks);

    // Focus previous block if available
    const prevBlock = index > 0 ? list[index - 1] : pathInfo.parent;
    if (prevBlock) {
      setEditingBlockId(prevBlock.id);
    } else if (newBlocks.length > 0) {
      setEditingBlockId(newBlocks[0].id);
    } else {
      setEditingBlockId(null);
    }
  };

  // 5. Indent a block (make it a child of its previous sibling)
  const indentBlock = (targetId: string) => {
    const newBlocks = JSON.parse(JSON.stringify(page.blocks)) as Block[];
    const pathInfo = findBlockPath(newBlocks, targetId);
    if (!pathInfo) return;

    const { list, index } = pathInfo;
    if (index === 0) return; // No previous sibling to indent into

    const blockToIndent = list[index];
    const prevSibling = list[index - 1];

    // Remove from current list
    list.splice(index, 1);
    // Add to previous sibling's children
    prevSibling.children.push(blockToIndent);
    prevSibling.collapsed = false; // Ensure parent is expanded

    onUpdateBlocks(newBlocks);
    // Maintain focus
    setTimeout(() => setEditingBlockId(targetId), 50);
  };

  // 6. Outdent a block (move it to its grandparent's level, after its parent)
  const outdentBlock = (targetId: string) => {
    const newBlocks = JSON.parse(JSON.stringify(page.blocks)) as Block[];
    const pathInfo = findBlockPath(newBlocks, targetId);
    if (!pathInfo || !pathInfo.parent) return; // Already at top level

    const { list, index, parent } = pathInfo;
    const blockToOutdent = list[index];

    // Remove from current parent's children
    list.splice(index, 1);

    // Find grandparent's list
    const grandparentPath = findBlockPath(newBlocks, parent.id);
    if (grandparentPath) {
      const { list: gpList, index: pIndex } = grandparentPath;
      // Insert right after the parent block
      gpList.splice(pIndex + 1, 0, blockToOutdent);
    } else {
      // Grandparent is root
      const pIndex = newBlocks.findIndex(b => b.id === parent.id);
      newBlocks.splice(pIndex + 1, 0, blockToOutdent);
    }

    onUpdateBlocks(newBlocks);
    // Maintain focus
    setTimeout(() => setEditingBlockId(targetId), 50);
  };

  // 7. Move block up or down
  const moveBlock = (targetId: string, direction: 'up' | 'down') => {
    const newBlocks = JSON.parse(JSON.stringify(page.blocks)) as Block[];
    const pathInfo = findBlockPath(newBlocks, targetId);
    if (!pathInfo) return;

    const { list, index } = pathInfo;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= list.length) return; // Out of bounds

    // Swap
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    onUpdateBlocks(newBlocks);
    setTimeout(() => setEditingBlockId(targetId), 50);
  };

  // 8. Toggle block collapse state
  const toggleCollapse = (targetId: string) => {
    const newBlocks = JSON.parse(JSON.stringify(page.blocks)) as Block[];
    const pathInfo = findBlockPath(newBlocks, targetId);
    if (!pathInfo) return;

    const { list, index } = pathInfo;
    list[index].collapsed = !list[index].collapsed;
    onUpdateBlocks(newBlocks);
  };

  // 9. Cycle TODO state: TODO -> DOING -> DONE -> LATER -> NOW -> null
  const cycleTodo = (targetId: string) => {
    const newBlocks = JSON.parse(JSON.stringify(page.blocks)) as Block[];
    const pathInfo = findBlockPath(newBlocks, targetId);
    if (!pathInfo) return;

    const { list, index } = pathInfo;
    const currentType = list[index].todoType;

    let nextType: Block['todoType'] = null;
    if (!currentType) nextType = 'TODO';
    else if (currentType === 'TODO') nextType = 'DOING';
    else if (currentType === 'DOING') nextType = 'DONE';
    else if (currentType === 'DONE') nextType = 'LATER';
    else if (currentType === 'LATER') nextType = 'NOW';
    else if (currentType === 'NOW') nextType = null;

    list[index].todoType = nextType;
    onUpdateBlocks(newBlocks);
  };

  // --- MARKDOWN AND LINK PARSER ---
  const renderParsedContent = (text: string) => {
    if (!text) return <span className="text-slate-400 italic font-normal">(Empty block. Click to edit)</span>;

    // Parse inline styles
    const boldRegex = /\*\*(.*?)\*\*/g;
    const italicRegex = /\*(.*?)\*/g;
    const codeRegex = /`(.*?)`/g;

    let html = text;

    // Escape HTML tags to prevent XSS
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Format Bold
    html = html.replace(boldRegex, '<strong class="font-extrabold text-slate-900 dark:text-white">$1</strong>');
    
    // Format Italic
    html = html.replace(italicRegex, '<em class="italic text-slate-800 dark:text-slate-200">$1</em>');

    // Format Code
    html = html.replace(codeRegex, '<code class="px-1.5 py-0.5 font-mono text-xs bg-slate-100 dark:bg-slate-800/80 text-rose-500 rounded border border-slate-200/40 dark:border-slate-800">$1</code>');

    // We can't easily embed React click handlers inside dangerouslySetInnerHTML,
    // so we'll do a hybrid replacement or intercept click events.
    // Let's create an elegant parser that returns React elements!
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Regex that matches either [[link]] or #tag
    const combinedRegex = /\[\[(.*?)\]\]|#([a-zA-Z0-9_\-\u4e00-\u9fa5]+)/g;
    let match;

    while ((match = combinedRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      
      // Push text before match
      if (matchIndex > lastIndex) {
        parts.push(
          <span 
            key={`text-${lastIndex}`}
            dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(text.substring(lastIndex, matchIndex)) }} 
          />
        );
      }

      if (match[1]) {
        // It's a [[Page Link]]
        const pageName = match[1].trim();
        parts.push(
          <span
            key={`link-${matchIndex}`}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(pageName);
            }}
            className="text-emerald-500 hover:underline font-semibold cursor-pointer border-b border-dashed border-emerald-400/50 hover:border-emerald-500"
          >
            {pageName}
          </span>
        );
      } else if (match[2]) {
        // It's a #tag
        const tagName = match[2].trim();
        parts.push(
          <span
            key={`tag-${matchIndex}`}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(tagName);
            }}
            className="text-sky-500 dark:text-sky-400 hover:underline font-medium cursor-pointer"
          >
            #{tagName}
          </span>
        );
      }

      lastIndex = combinedRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(
        <span 
          key={`text-${lastIndex}`}
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(text.substring(lastIndex)) }} 
        />
      );
    }

    return <div className="inline leading-relaxed whitespace-pre-wrap">{parts}</div>;
  };

  const formatInlineMarkdown = (text: string): string => {
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic text-slate-800 dark:text-slate-100">$1</em>');
    formatted = formatted.replace(/`(.*?)`/g, '<code class="px-1 py-0.2 font-mono text-[11px] bg-slate-150 dark:bg-slate-800 text-rose-500 dark:text-rose-400 rounded">$1</code>');
    return formatted;
  };

  // --- SLASH COMMANDS ENGINE ---
  const slashCommands = [
    { name: 'todo', desc: 'Insert TODO checklist', action: (c: string) => '/todo ' + c, todoType: 'TODO' as const },
    { name: 'doing', desc: 'Insert DOING status', action: (c: string) => '/doing ' + c, todoType: 'DOING' as const },
    { name: 'done', desc: 'Insert DONE status', action: (c: string) => '/done ' + c, todoType: 'DONE' as const },
    { name: 'later', desc: 'Insert LATER checklist', action: (c: string) => '/later ' + c, todoType: 'LATER' as const },
    { name: 'now', desc: 'Insert NOW checklist', action: (c: string) => '/now ' + c, todoType: 'NOW' as const },
    { name: 'card', desc: 'Add #card for Flashcards', action: (c: string) => c + ' #card' },
    { name: 'today', desc: 'Insert today\'s date', action: (c: string) => c + ` [[${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}]]` },
    { name: 'tomorrow', desc: 'Insert tomorrow\'s date', action: (c: string) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return c + ` [[${tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}]]`;
    }},
    { name: 'h1', desc: 'Make Heading 1', action: (c: string) => '# ' + c },
    { name: 'h2', desc: 'Make Heading 2', action: (c: string) => '## ' + c },
    { name: 'h3', desc: 'Make Heading 3', action: (c: string) => '### ' + c },
    { name: 'code', desc: 'Insert code block', action: (c: string) => c + ' `code` ' },
    { name: 'quote', desc: 'Insert blockquote', action: (c: string) => '> ' + c }
  ];

  const filteredCommands = slashCommands.filter(cmd => 
    cmd.name.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const handleBlockChange = (id: string, val: string) => {
    // Check for slash command
    const slashIndex = val.lastIndexOf('/');
    if (slashIndex !== -1 && (slashIndex === 0 || val[slashIndex - 1] === ' ')) {
      setSlashMenuBlockId(id);
      setSlashQuery(val.substring(slashIndex + 1));
      setSlashIndex(0);
    } else {
      setSlashMenuBlockId(null);
    }

    const newBlocks = updateBlockContent(page.blocks, id, val);
    onUpdateBlocks(newBlocks);
  };

  const applySlashCommand = (cmd: typeof slashCommands[0], blockId: string) => {
    const newBlocks = JSON.parse(JSON.stringify(page.blocks)) as Block[];
    const pathInfo = findBlockPath(newBlocks, blockId);
    if (!pathInfo) return;

    const { list, index } = pathInfo;
    const currentContent = list[index].content;
    
    // Extract everything before the slash
    const slashIdx = currentContent.lastIndexOf('/');
    const cleanContent = slashIdx !== -1 ? currentContent.substring(0, slashIdx) : currentContent;

    let updatedContent = cmd.action(cleanContent);
    
    // Strip "/cmd" prefix if it was a todo command, and set the todoType instead
    if (cmd.todoType) {
      list[index].todoType = cmd.todoType;
      // remove the /todo text
      updatedContent = updatedContent.replace(/^\/(todo|doing|done|later|now)\s*/i, '');
    }

    list[index].content = updatedContent;
    onUpdateBlocks(newBlocks);
    setSlashMenuBlockId(null);

    // Re-focus
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
      }
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, blockId: string) => {
    if (slashMenuBlockId === blockId && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex(prev => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        applySlashCommand(filteredCommands[slashIndex], blockId);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenuBlockId(null);
        return;
      }
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) return; // Allow multiline with Shift+Enter
      e.preventDefault();
      addBlockBelow(blockId);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        outdentBlock(blockId);
      } else {
        indentBlock(blockId);
      }
    } else if (e.key === 'Backspace' && editInputRef.current?.value === '') {
      e.preventDefault();
      const pathInfo = findBlockPath(page.blocks, blockId);
      if (pathInfo && pathInfo.parent) {
        outdentBlock(blockId);
      } else {
        deleteBlock(blockId);
      }
    }
  };

  // --- BACKLINKS ENGINE ---
  const getBacklinks = (): { sourcePage: string; block: Block }[] => {
    const list: { sourcePage: string; block: Block }[] = [];
    const lowerPageName = page.name.toLowerCase();

    pages.forEach(p => {
      // Don't show links from the page to itself
      if (p.name.toLowerCase() === lowerPageName) return;

      const checkBlocks = (blocks: Block[]) => {
        blocks.forEach(b => {
          const contentLower = b.content.toLowerCase();
          const matchesLink = contentLower.includes(`[[${lowerPageName}]]`);
          const matchesTag = contentLower.includes(`#${lowerPageName.replace(/\s+/g, '')}`);
          
          if (matchesLink || matchesTag) {
            list.push({ sourcePage: p.name, block: b });
          }

          if (b.children && b.children.length > 0) {
            checkBlocks(b.children);
          }
        });
      };

      checkBlocks(p.blocks);
    });

    return list;
  };

  const backlinks = getBacklinks();

  // --- RECURSIVE RENDERER ---
  const renderBlocks = (blocks: Block[], depth = 0): React.ReactNode => {
    return (
      <ul className={`space-y-2 ${depth > 0 ? 'ml-4.5 pl-1.5 border-l border-slate-200/60 dark:border-slate-800/65' : ''}`}>
        {blocks.map(block => {
          const isEditing = editingBlockId === block.id;
          const hasChildren = block.children && block.children.length > 0;
          const isCollapsed = block.collapsed;

          return (
            <li key={block.id} className="group relative list-none">
              {/* Bullet row container */}
              <div className="flex items-start py-0.5">
                {/* Expand/Collapse Arrow */}
                <div className="w-4.5 h-4.5 flex items-center justify-center mt-1 text-slate-400 dark:text-slate-500">
                  {hasChildren ? (
                    <button 
                      onClick={() => toggleCollapse(block.id)}
                      className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    </button>
                  ) : (
                    <div className="w-1 h-1 bg-transparent" />
                  )}
                </div>

                {/* Checklist Checkbox or Dot Bullet */}
                <div className="mr-2.5 mt-1 flex-shrink-0">
                  {block.todoType ? (
                    <button 
                      onClick={() => cycleTodo(block.id)}
                      className="cursor-pointer transition-colors text-slate-500 hover:text-emerald-500"
                    >
                      {block.todoType === 'DONE' ? (
                        <span className="flex items-center space-x-1 font-mono text-[9px] bg-emerald-500 text-white font-extrabold px-1 rounded">
                          <CheckCircle2 size={10} className="inline" />
                          <span>DONE</span>
                        </span>
                      ) : block.todoType === 'DOING' ? (
                        <span className="flex items-center space-x-1 font-mono text-[9px] bg-amber-500 text-white font-extrabold px-1 rounded animate-pulse">
                          <Clock size={10} className="inline" />
                          <span>DOING</span>
                        </span>
                      ) : block.todoType === 'TODO' ? (
                        <span className="flex items-center space-x-1 font-mono text-[9px] bg-sky-500 text-white font-extrabold px-1 rounded">
                          <Square size={10} className="inline" />
                          <span>TODO</span>
                        </span>
                      ) : block.todoType === 'NOW' ? (
                        <span className="flex items-center space-x-1 font-mono text-[9px] bg-rose-500 text-white font-extrabold px-1 rounded animate-pulse">
                          <Clock size={10} className="inline" />
                          <span>NOW</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 font-mono text-[9px] bg-slate-400 text-white font-extrabold px-1 rounded">
                          <Square size={10} className="inline" />
                          <span>LATER</span>
                        </span>
                      )}
                    </button>
                  ) : (
                    <div 
                      onClick={() => setEditingBlockId(block.id)}
                      className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mt-1.5 group-hover:scale-125 transition-transform cursor-pointer" 
                    />
                  )}
                </div>

                {/* Block content */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="relative">
                      <textarea
                        ref={editInputRef}
                        value={block.content}
                        onChange={(e) => handleBlockChange(block.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, block.id)}
                        onBlur={() => {
                          // Delay closing to allow clicking slash command options
                          setTimeout(() => {
                            setEditingBlockId(null);
                            setSlashMenuBlockId(null);
                          }, 180);
                        }}
                        style={{ fontSize: `${fontSize}px` }}
                        className="w-full bg-slate-100 dark:bg-slate-800/85 text-slate-900 dark:text-slate-50 focus:outline-hidden rounded-md px-2 py-1 border border-emerald-500/50 resize-none font-sans leading-relaxed"
                        rows={Math.max(1, block.content.split('\n').length)}
                      />

                      {/* Slash Command Autocomplete Menu */}
                      {slashMenuBlockId === block.id && filteredCommands.length > 0 && (
                        <div 
                          ref={slashMenuRef}
                          className="absolute left-2 z-50 mt-1 w-52 max-h-48 overflow-y-auto rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg"
                        >
                          <div className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                            Slash Commands
                          </div>
                          {filteredCommands.map((cmd, idx) => (
                            <button
                              key={cmd.name}
                              onMouseDown={() => applySlashCommand(cmd, block.id)}
                              className={`w-full flex flex-col items-start px-3 py-1.5 text-left transition-colors cursor-pointer ${
                                idx === slashIndex 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="text-xs font-semibold">/{cmd.name}</span>
                              <span className="text-[9px] opacity-75">{cmd.desc}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Floating Mobile Outliner Toolbar */}
                      <div className="flex items-center space-x-1 mt-1 bg-slate-50 dark:bg-slate-950/40 p-1 rounded-md border border-slate-200/50 dark:border-slate-800/60 max-w-max">
                        <button
                          onMouseDown={(e) => { e.preventDefault(); indentBlock(block.id); }}
                          title="Indent (Tab)"
                          className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer"
                        >
                          <IndentIcon size={12} />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); outdentBlock(block.id); }}
                          title="Outdent (Shift+Tab)"
                          className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer"
                        >
                          <OutdentIcon size={12} />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); moveBlock(block.id, 'up'); }}
                          title="Move Up"
                          className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); moveBlock(block.id, 'down'); }}
                          title="Move Down"
                          className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); cycleTodo(block.id); }}
                          title="Toggle Checklist"
                          className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer"
                        >
                          <CheckSquare size={12} />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); setSlashMenuBlockId(block.id); setSlashQuery(''); }}
                          title="Slash Commands"
                          className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer"
                        >
                          <Slash size={10} />
                        </button>
                        <span className="w-px h-3 bg-slate-200 dark:bg-slate-800 mx-1" />
                        <button
                          onMouseDown={(e) => { e.preventDefault(); deleteBlock(block.id); }}
                          title="Delete Block"
                          className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setEditingBlockId(block.id)}
                      style={{ fontSize: `${fontSize}px` }}
                      className="text-slate-800 dark:text-slate-200 py-0.5 font-normal hover:bg-slate-100/40 dark:hover:bg-slate-800/20 px-1 rounded-sm cursor-text min-h-[22px]"
                    >
                      {renderParsedContent(block.content)}
                    </div>
                  )}
                </div>
              </div>

              {/* Children Nodes (Recursive) */}
              {hasNavigableChildren(block) && renderBlocks(block.children, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  // Helper to determine if children should be rendered
  const hasNavigableChildren = (block: Block) => {
    return block.children && block.children.length > 0 && !block.collapsed;
  };

  return (
    <div className={`flex flex-col space-y-6 ${theme === 'dark' ? 'editor-dark' : 'editor-light'}`}>
      {/* Editor Content */}
      <div className="outline-editor pb-6">
        {renderBlocks(page.blocks)}
        
        {/* Quick Add at the bottom */}
        <button
          onClick={() => {
            const lastBlockId = page.blocks[page.blocks.length - 1]?.id;
            if (lastBlockId) {
              addBlockBelow(lastBlockId);
            }
          }}
          className="mt-4 flex items-center space-x-1.5 text-xs text-slate-400 hover:text-emerald-500 font-medium px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-all border border-dashed border-slate-200 dark:border-slate-800/60 w-full justify-center"
        >
          <Plus size={14} />
          <span>Add Block at Bottom</span>
        </button>
      </div>

      {/* Linked References (Backlinks) Section */}
      {!isSidebarView && (
        <div className="pt-6 border-t border-slate-200/60 dark:border-slate-800/70 mt-8">
          <div className="flex items-center space-x-1.5 mb-4">
            <Link2 size={14} className="text-slate-400 dark:text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Linked References ({backlinks.length})
            </h3>
          </div>

          {backlinks.length > 0 ? (
            <div className="space-y-3">
              {backlinks.map((ref, i) => (
                <div 
                  key={i}
                  className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3 shadow-xs hover:shadow-md hover:border-emerald-500/20 transition-all cursor-pointer"
                  onClick={() => onNavigate(ref.sourcePage)}
                >
                  {/* Reference Source Header */}
                  <div className="flex items-center space-x-1.5 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/50">
                    <FileText size={12} className="text-emerald-500" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:underline">
                      {ref.sourcePage}
                    </span>
                  </div>

                  {/* Reference Block content */}
                  <div className="pl-3 border-l-2 border-emerald-500/20 text-xs text-slate-600 dark:text-slate-300 italic">
                    {ref.block.content.replace(/\[\[.*?\]\]/g, (m) => m.substring(2, m.length - 2))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-950/20 rounded-xl p-3 border border-slate-200/40 dark:border-slate-800/40 text-[11px] text-slate-400 dark:text-slate-500">
              <AlertCircle size={14} />
              <span>No references to this page yet. Create one by typing <span className="font-mono text-emerald-500">[[{page.name}]]</span> on another page.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
