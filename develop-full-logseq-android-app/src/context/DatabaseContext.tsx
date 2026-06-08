import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { Page, Block, AppSettings, SearchResult } from '../types';
import { buildInitialDatabase, getTodayJournalId, genId, genUUID } from '../mockData';
import { format } from 'date-fns';

// ─────────────────────────── STATE ───────────────────────────

const defaultSettings: AppSettings = {
  theme: 'dark',
  accentColor: '#6366f1',
  fontSize: 14,
  fontFamily: 'Inter, system-ui, sans-serif',
  showBrackets: false,
  enableSpellCheck: false,
  autoSave: true,
  sidebarOpen: false,
  rightSidebarOpen: false,
  customCSS: '',
  bezelColor: '#1a1a1a',
  navMode: 'buttons',
  batteryLevel: 87,
  charging: false,
};

function loadFromStorage(): { db: Record<string, Page>; settings: AppSettings } | null {
  try {
    const raw = localStorage.getItem('logseq-mobile-db');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function saveToStorage(db: Record<string, Page>, settings: AppSettings) {
  try {
    localStorage.setItem('logseq-mobile-db', JSON.stringify({ db, settings }));
  } catch { /* ignore */ }
}

type DbAction =
  | { type: 'NAVIGATE'; pageId: string }
  | { type: 'OPEN_SIDEBAR'; pageId: string }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'UPDATE_BLOCK'; pageId: string; blockId: string; content: string }
  | { type: 'TOGGLE_TASK'; pageId: string; blockId: string }
  | { type: 'TOGGLE_COLLAPSE'; pageId: string; blockId: string }
  | { type: 'ADD_BLOCK'; pageId: string; afterBlockId: string; content?: string; taskStatus?: Block['taskStatus'] }
  | { type: 'DELETE_BLOCK'; pageId: string; blockId: string }
  | { type: 'INDENT_BLOCK'; pageId: string; blockId: string }
  | { type: 'OUTDENT_BLOCK'; pageId: string; blockId: string }
  | { type: 'MOVE_BLOCK_UP'; pageId: string; blockId: string }
  | { type: 'MOVE_BLOCK_DOWN'; pageId: string; blockId: string }
  | { type: 'CREATE_PAGE'; name: string; navigate?: boolean }
  | { type: 'DELETE_PAGE'; pageId: string }
  | { type: 'APPEND_BLOCK_TO_PAGE'; pageId: string; content: string }
  | { type: 'TOGGLE_FAVORITE'; pageId: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<AppSettings> }
  | { type: 'ENSURE_TODAY_JOURNAL' }
  | { type: 'RENAME_PAGE'; pageId: string; newName: string }
  | { type: 'ADD_CHILD_BLOCK'; pageId: string; parentBlockId: string; content?: string };

interface FullState {
  db: Record<string, Page>;
  currentPageId: string;
  sidebarPageId: string | null;
  favorites: string[];
  settings: AppSettings;
}

// ─────────────────────────── BLOCK HELPERS ───────────────────────────

function findAndUpdateBlock(
  blocks: Block[],
  blockId: string,
  updater: (block: Block) => Block | null
): { blocks: Block[]; found: boolean } {
  let found = false;
  const updated = blocks
    .map(b => {
      if (b.id === blockId) {
        found = true;
        const result = updater(b);
        return result;
      }
      const childResult = findAndUpdateBlock(b.children, blockId, updater);
      if (childResult.found) {
        found = true;
        return { ...b, children: childResult.blocks };
      }
      return b;
    })
    .filter(Boolean) as Block[];
  return { blocks: updated, found };
}

function addBlockAfter(blocks: Block[], afterId: string, newBlock: Block): { blocks: Block[]; done: boolean } {
  let done = false;
  const result: Block[] = [];
  for (const b of blocks) {
    result.push(b);
    if (b.id === afterId && !done) {
      result.push(newBlock);
      done = true;
    } else {
      const childResult = addBlockAfter(b.children, afterId, newBlock);
      if (childResult.done) {
        done = true;
        result[result.length - 1] = { ...b, children: childResult.blocks };
      }
    }
  }
  return { blocks: result, done };
}

function addChildBlock(blocks: Block[], parentId: string, newBlock: Block): { blocks: Block[]; done: boolean } {
  let done = false;
  const result = blocks.map(b => {
    if (b.id === parentId) {
      done = true;
      return { ...b, children: [...b.children, newBlock] };
    }
    const childResult = addChildBlock(b.children, parentId, newBlock);
    if (childResult.done) {
      done = true;
      return { ...b, children: childResult.blocks };
    }
    return b;
  });
  return { blocks: result, done };
}

function removeBlock(blocks: Block[], blockId: string): { blocks: Block[]; removed: Block | null } {
  let removed: Block | null = null;
  const result = blocks.filter(b => {
    if (b.id === blockId) { removed = b; return false; }
    return true;
  }).map(b => {
    if (removed) return b;
    const r = removeBlock(b.children, blockId);
    if (r.removed) { removed = r.removed; return { ...b, children: r.blocks }; }
    return b;
  });
  return { blocks: result, removed };
}

function indentBlock(blocks: Block[], blockId: string): Block[] {
  // Find previous sibling and make this block its last child
  let found = false;
  const result: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === blockId && i > 0 && !found) {
      found = true;
      const prev = { ...result[result.length - 1] };
      prev.children = [...prev.children, blocks[i]];
      result[result.length - 1] = prev;
    } else {
      const recursed = indentBlock(blocks[i].children, blockId);
      if (recursed !== blocks[i].children) {
        result.push({ ...blocks[i], children: recursed });
        found = true;
      } else {
        result.push(blocks[i]);
      }
    }
  }
  return found ? result : blocks;
}

function outdentBlock(blocks: Block[], blockId: string, parentId: string | null = null): { blocks: Block[]; extracted: Block | null; insertAfterParent: string | null } {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === blockId && parentId !== null) {
      const extracted = blocks[i];
      const newBlocks = [...blocks.slice(0, i), ...blocks.slice(i + 1)];
      return { blocks: newBlocks, extracted, insertAfterParent: parentId };
    }
    const child = outdentBlock(blocks[i].children, blockId, blocks[i].id);
    if (child.extracted) {
      return {
        blocks: [...blocks.slice(0, i), { ...blocks[i], children: child.blocks }, ...blocks.slice(i + 1)],
        extracted: child.extracted,
        insertAfterParent: child.insertAfterParent,
      };
    }
  }
  return { blocks, extracted: null, insertAfterParent: null };
}

function moveBlockUp(blocks: Block[], blockId: string): Block[] {
  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx > 0) {
    const newBlocks = [...blocks];
    [newBlocks[idx - 1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx - 1]];
    return newBlocks;
  }
  return blocks.map(b => ({ ...b, children: moveBlockUp(b.children, blockId) }));
}

function moveBlockDown(blocks: Block[], blockId: string): Block[] {
  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx >= 0 && idx < blocks.length - 1) {
    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[idx + 1]] = [newBlocks[idx + 1], newBlocks[idx]];
    return newBlocks;
  }
  return blocks.map(b => ({ ...b, children: moveBlockDown(b.children, blockId) }));
}

const TASK_CYCLE: Block['taskStatus'][] = [null, 'TODO', 'DOING', 'DONE', 'LATER', 'NOW', 'CANCELLED'];

function cycleTask(current: Block['taskStatus']): Block['taskStatus'] {
  const idx = TASK_CYCLE.indexOf(current);
  return TASK_CYCLE[(idx + 1) % TASK_CYCLE.length];
}

function extractRefs(content: string): string[] {
  const refs: string[] = [];
  const wikiLinks = content.match(/\[\[([^\]]+)\]\]/g);
  if (wikiLinks) wikiLinks.forEach(l => refs.push(l.slice(2, -2)));
  const tags = content.match(/#([\w][\w-]*)/g);
  if (tags) tags.forEach(t => refs.push(t.slice(1)));
  return refs;
}

function ensureTodayJournal(db: Record<string, Page>): Record<string, Page> {
  const todayId = getTodayJournalId();
  if (!db[todayId]) {
    const today = new Date();
    const dateStr = format(today, 'yyyy-MM-dd');
    const displayDate = format(today, 'EEEE, MMMM do yyyy');
    db = {
      ...db,
      [todayId]: {
        id: todayId,
        name: dateStr,
        blocks: [
          {
            id: genId(),
            uuid: genUUID(),
            content: `## 🌅 ${displayDate}`,
            children: [],
            collapsed: false,
            taskStatus: null,
            properties: {},
            refs: [],
          },
          {
            id: genId(),
            uuid: genUUID(),
            content: 'Start writing your thoughts for today...',
            children: [],
            collapsed: false,
            taskStatus: null,
            properties: {},
            refs: [],
          },
        ],
        isJournal: true,
        createdAt: today.toISOString(),
        updatedAt: today.toISOString(),
        properties: {},
        tags: ['journal'],
      },
    };
  }
  return db;
}

// ─────────────────────────── REDUCER ───────────────────────────

function reducer(state: FullState, action: DbAction): FullState {
  switch (action.type) {
    case 'NAVIGATE': {
      return { ...state, currentPageId: action.pageId };
    }
    case 'OPEN_SIDEBAR':
      return { ...state, sidebarPageId: action.pageId, settings: { ...state.settings, rightSidebarOpen: true } };
    case 'CLOSE_SIDEBAR':
      return { ...state, sidebarPageId: null, settings: { ...state.settings, rightSidebarOpen: false } };

    case 'UPDATE_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const { blocks } = findAndUpdateBlock(page.blocks, action.blockId, b => ({
        ...b,
        content: action.content,
        refs: extractRefs(action.content),
      }));
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, blocks, updatedAt: new Date().toISOString() } },
      };
    }

    case 'TOGGLE_TASK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const { blocks } = findAndUpdateBlock(page.blocks, action.blockId, b => ({
        ...b,
        taskStatus: cycleTask(b.taskStatus),
      }));
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks } } };
    }

    case 'TOGGLE_COLLAPSE': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const { blocks } = findAndUpdateBlock(page.blocks, action.blockId, b => ({
        ...b,
        collapsed: !b.collapsed,
      }));
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks } } };
    }

    case 'ADD_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const newBlock: Block = {
        id: genId(),
        uuid: genUUID(),
        content: action.content || '',
        children: [],
        collapsed: false,
        taskStatus: action.taskStatus || null,
        properties: {},
        refs: [],
      };
      const { blocks } = addBlockAfter(page.blocks, action.afterBlockId, newBlock);
      const finalBlocks = blocks.length === page.blocks.length
        ? [...page.blocks, newBlock]
        : blocks;
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, blocks: finalBlocks, updatedAt: new Date().toISOString() } },
      };
    }

    case 'ADD_CHILD_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const newBlock: Block = {
        id: genId(),
        uuid: genUUID(),
        content: action.content || '',
        children: [],
        collapsed: false,
        taskStatus: null,
        properties: {},
        refs: [],
      };
      const { blocks } = addChildBlock(page.blocks, action.parentBlockId, newBlock);
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, blocks } },
      };
    }

    case 'DELETE_BLOCK': {
      const page = state.db[action.pageId];
      if (!page || page.blocks.length <= 1) return state;
      const { blocks } = removeBlock(page.blocks, action.blockId);
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks } } };
    }

    case 'INDENT_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const blocks = indentBlock(page.blocks, action.blockId);
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks } } };
    }

    case 'OUTDENT_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const { blocks: stripped, extracted, insertAfterParent } = outdentBlock(page.blocks, action.blockId);
      if (!extracted || !insertAfterParent) return state;
      const { blocks } = addBlockAfter(stripped, insertAfterParent, extracted);
      const finalBlocks = blocks.length === stripped.length ? [...stripped, extracted] : blocks;
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks: finalBlocks } } };
    }

    case 'MOVE_BLOCK_UP': {
      const page = state.db[action.pageId];
      if (!page) return state;
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks: moveBlockUp(page.blocks, action.blockId) } } };
    }

    case 'MOVE_BLOCK_DOWN': {
      const page = state.db[action.pageId];
      if (!page) return state;
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks: moveBlockDown(page.blocks, action.blockId) } } };
    }

    case 'CREATE_PAGE': {
      const safeName = action.name.trim();
      if (!safeName) return state;
      const existingId = Object.values(state.db).find(p => p.name.toLowerCase() === safeName.toLowerCase())?.id;
      if (existingId) {
        return action.navigate ? { ...state, currentPageId: existingId } : state;
      }
      const newId = `page-${Date.now()}`;
      const newPage: Page = {
        id: newId,
        name: safeName,
        blocks: [{ id: genId(), uuid: genUUID(), content: '', children: [], collapsed: false, taskStatus: null, properties: {}, refs: [] }],
        isJournal: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        properties: {},
        tags: [],
      };
      return {
        ...state,
        db: { ...state.db, [newId]: newPage },
        currentPageId: action.navigate ? newId : state.currentPageId,
      };
    }

    case 'DELETE_PAGE': {
      if (Object.keys(state.db).length <= 1) return state;
      const newDb = { ...state.db };
      delete newDb[action.pageId];
      const newCurrentId = state.currentPageId === action.pageId
        ? getTodayJournalId()
        : state.currentPageId;
      return { ...state, db: newDb, currentPageId: newCurrentId };
    }

    case 'APPEND_BLOCK_TO_PAGE': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const newBlock: Block = {
        id: genId(),
        uuid: genUUID(),
        content: action.content,
        children: [],
        collapsed: false,
        taskStatus: null,
        properties: {},
        refs: extractRefs(action.content),
      };
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, blocks: [...page.blocks, newBlock], updatedAt: new Date().toISOString() } },
      };
    }

    case 'TOGGLE_FAVORITE': {
      const favs = state.favorites.includes(action.pageId)
        ? state.favorites.filter(id => id !== action.pageId)
        : [...state.favorites, action.pageId];
      return { ...state, favorites: favs };
    }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case 'ENSURE_TODAY_JOURNAL': {
      const todayId = getTodayJournalId();
      if (state.db[todayId]) return { ...state, currentPageId: todayId };
      return {
        ...state,
        db: ensureTodayJournal(state.db),
        currentPageId: todayId,
      };
    }

    case 'RENAME_PAGE': {
      const page = state.db[action.pageId];
      if (!page) return state;
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, name: action.newName, updatedAt: new Date().toISOString() } },
      };
    }

    default:
      return state;
  }
}

// ─────────────────────────── CONTEXT ───────────────────────────

interface DbContextType {
  state: FullState;
  dispatch: React.Dispatch<DbAction>;
  navigateTo: (pageNameOrId: string) => void;
  search: (query: string) => SearchResult[];
  getBacklinks: (pageName: string) => { page: Page; blocks: Block[] }[];
  getAllTags: () => Record<string, string[]>;
  getJournalPages: () => Page[];
  getAllPages: () => Page[];
  getTasks: () => { block: Block; page: Page }[];
}

const DbContext = createContext<DbContextType | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const stored = loadFromStorage();
  const initialDb = stored?.db || buildInitialDatabase();
  const initialSettings = stored?.settings || defaultSettings;
  const todayId = getTodayJournalId();
  const dbWithToday = ensureTodayJournal(initialDb);

  const [state, dispatch] = useReducer(reducer, {
    db: dbWithToday,
    currentPageId: dbWithToday[todayId] ? todayId : Object.keys(dbWithToday)[0],
    sidebarPageId: null,
    favorites: stored ? (stored as any).favorites || [] : ['logseq-guide', 'project-voyager'],
    settings: initialSettings,
  });

  // Persist to localStorage on every change
  useEffect(() => {
    saveToStorage(state.db, state.settings);
    (window as any).__logseqState = state;
  }, [state]);

  // Apply custom CSS
  useEffect(() => {
    const existing = document.getElementById('logseq-custom-css');
    if (existing) existing.remove();
    if (state.settings.customCSS) {
      const style = document.createElement('style');
      style.id = 'logseq-custom-css';
      style.textContent = state.settings.customCSS;
      document.head.appendChild(style);
    }
  }, [state.settings.customCSS]);

  const navigateTo = useCallback((pageNameOrId: string) => {
    // First check by ID
    if (state.db[pageNameOrId]) {
      dispatch({ type: 'NAVIGATE', pageId: pageNameOrId });
      return;
    }
    // Then check by name
    const found = Object.values(state.db).find(
      p => p.name.toLowerCase() === pageNameOrId.toLowerCase()
    );
    if (found) {
      dispatch({ type: 'NAVIGATE', pageId: found.id });
    } else {
      dispatch({ type: 'CREATE_PAGE', name: pageNameOrId, navigate: true });
    }
  }, [state.db]);

  function collectBlocks(blocks: Block[]): Block[] {
    return blocks.reduce<Block[]>((acc, b) => [...acc, b, ...collectBlocks(b.children)], []);
  }

  const search = useCallback((query: string): SearchResult[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];
    for (const page of Object.values(state.db)) {
      if (page.name.toLowerCase().includes(q)) {
        results.push({ pageId: page.id, pageName: page.name, blockId: '', content: page.name, isJournal: page.isJournal });
      }
      for (const block of collectBlocks(page.blocks)) {
        if (block.content.toLowerCase().includes(q)) {
          results.push({ pageId: page.id, pageName: page.name, blockId: block.id, content: block.content, isJournal: page.isJournal });
        }
      }
    }
    return results.slice(0, 50);
  }, [state.db]);

  const getBacklinks = useCallback((pageName: string): { page: Page; blocks: Block[] }[] => {
    const results: { page: Page; blocks: Block[] }[] = [];
    const nameLC = pageName.toLowerCase();
    for (const page of Object.values(state.db)) {
      const matching = collectBlocks(page.blocks).filter(b =>
        b.refs.some(r => r.toLowerCase() === nameLC) ||
        b.content.toLowerCase().includes(`[[${nameLC}]]`) ||
        b.content.toLowerCase().includes(`#${nameLC}`)
      );
      if (matching.length > 0) results.push({ page, blocks: matching });
    }
    return results;
  }, [state.db]);

  const getAllTags = useCallback((): Record<string, string[]> => {
    const tags: Record<string, string[]> = {};
    for (const page of Object.values(state.db)) {
      for (const block of collectBlocks(page.blocks)) {
        const matches = block.content.match(/#([\w][\w-]*)/g);
        if (matches) {
          matches.forEach(tag => {
            const t = tag.slice(1);
            if (!tags[t]) tags[t] = [];
            if (!tags[t].includes(page.id)) tags[t].push(page.id);
          });
        }
      }
    }
    return tags;
  }, [state.db]);

  const getJournalPages = useCallback((): Page[] => {
    return Object.values(state.db)
      .filter(p => p.isJournal)
      .sort((a, b) => b.name.localeCompare(a.name));
  }, [state.db]);

  const getAllPages = useCallback((): Page[] => {
    return Object.values(state.db).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.db]);

  const getTasks = useCallback((): { block: Block; page: Page }[] => {
    const tasks: { block: Block; page: Page }[] = [];
    for (const page of Object.values(state.db)) {
      for (const block of collectBlocks(page.blocks)) {
        if (block.taskStatus && block.taskStatus !== null) {
          tasks.push({ block, page });
        }
      }
    }
    return tasks;
  }, [state.db]);

  return (
    <DbContext.Provider value={{ state, dispatch, navigateTo, search, getBacklinks, getAllTags, getJournalPages, getAllPages, getTasks }}>
      {children}
    </DbContext.Provider>
  );
}

export function useDatabase() {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useDatabase must be used within DatabaseProvider');
  return ctx;
}
