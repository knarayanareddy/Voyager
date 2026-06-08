import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { Page, Block, AppSettings, AudioNote, MediaAttachment, ActiveView } from '../types';
import {
  buildInitialDatabase,
  buildInitialAudioNotes,
  DEFAULT_SETTINGS,
  getTodayJournalId,
  genId,
  genUUID,
  extractRefs,
} from '../mockData';
import { saveState, loadState } from '../lib/persistence';
import { buildBacklinksIndex, BacklinksIndex, serialiseBacklinks, deserialiseBacklinks } from '../lib/backlinksIndex';

// ─── State shape ─────────────────────────────────────────────────────────────

export interface DatabaseState {
  db: Record<string, Page>;
  currentPageId: string;
  sidebarPageId: string | null;
  favorites: string[];
  settings: AppSettings;
  audioNotes: AudioNote[];
  activeView: ActiveView;
  // Serialised backlinks (Map is not JSON-safe)
  backlinksRaw: Record<string, string[]>;
  // SM2 schedule overrides keyed by cardId
  sm2Schedules: Record<string, { easeFactor: number; interval: number; nextReview: string; reviewCount: number }>;
}

// ─── Action union ────────────────────────────────────────────────────────────

export type Action =
  | { type: 'NAVIGATE'; pageId: string }
  | { type: 'UPDATE_BLOCK'; pageId: string; blockId: string; content: string }
  | { type: 'UPDATE_BLOCK_STATUS'; pageId: string; blockId: string; status: Block['taskStatus'] }
  | { type: 'TOGGLE_COLLAPSE'; pageId: string; blockId: string }
  | { type: 'ADD_BLOCK'; pageId: string; afterBlockId: string; parentId?: string | null; content?: string }
  | { type: 'DELETE_BLOCK'; pageId: string; blockId: string }
  | { type: 'INDENT_BLOCK'; pageId: string; blockId: string }
  | { type: 'OUTDENT_BLOCK'; pageId: string; blockId: string }
  | { type: 'CREATE_PAGE'; name: string; navigate?: boolean }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<AppSettings> }
  | { type: 'TOGGLE_FAVORITE'; pageId: string }
  | { type: 'SET_SIDEBAR_PAGE'; pageId: string | null }
  | { type: 'OPEN_SIDEBAR'; pageId: string }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'ADD_MEDIA'; pageId: string; media: MediaAttachment }
  | { type: 'DELETE_MEDIA'; pageId: string; mediaId: string }
  | { type: 'UPDATE_MEDIA'; pageId: string; media: MediaAttachment }
  | { type: 'ADD_AUDIO_NOTE'; note: AudioNote }
  | { type: 'UPDATE_AUDIO_NOTE'; note: AudioNote }
  | { type: 'DELETE_AUDIO_NOTE'; noteId: string }
  | { type: 'SET_ACTIVE_VIEW'; view: ActiveView }
  | { type: 'UPDATE_SM2'; cardId: string; easeFactor: number; interval: number; nextReview: string; reviewCount: number }
  | { type: 'HYDRATE'; state: DatabaseState };

// ─── Block tree helpers ───────────────────────────────────────────────────────

function makeBlock(content: string, taskStatus: Block['taskStatus'] = null): Block {
  return {
    id: genId(),
    uuid: genUUID(),
    content,
    children: [],
    collapsed: false,
    taskStatus,
    properties: {},
    refs: extractRefs(content),
  };
}

function findAndUpdateBlock(
  blocks: Block[],
  blockId: string,
  updater: (b: Block) => Block,
): Block[] {
  return blocks.map(b => {
    if (b.id === blockId) return updater(b);
    if (b.children.length > 0) {
      return { ...b, children: findAndUpdateBlock(b.children, blockId, updater) };
    }
    return b;
  });
}

function addBlockAfter(blocks: Block[], afterId: string, newBlock: Block): Block[] {
  const result: Block[] = [];
  for (const b of blocks) {
    result.push({ ...b, children: addBlockAfter(b.children, afterId, newBlock) });
    if (b.id === afterId) result.push(newBlock);
  }
  return result;
}

function deleteBlockById(blocks: Block[], id: string): Block[] {
  return blocks
    .filter(b => b.id !== id)
    .map(b => ({ ...b, children: deleteBlockById(b.children, id) }));
}

/**
 * INDENT: move block to become the last child of its preceding sibling.
 * Works at any nesting level.
 */
function indentBlock(blocks: Block[], blockId: string): Block[] {
  // Find the block and its preceding sibling at same level
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === blockId) {
      if (i === 0) return blocks; // No previous sibling — can't indent
      const prev = blocks[i - 1];
      const target = blocks[i];
      const newPrev: Block = { ...prev, children: [...prev.children, target] };
      return [
        ...blocks.slice(0, i - 1),
        newPrev,
        ...blocks.slice(i + 1),
      ];
    }
    // Recurse into children
    const newChildren = indentBlock(blocks[i].children, blockId);
    if (newChildren !== blocks[i].children) {
      return blocks.map((b, idx) => idx === i ? { ...b, children: newChildren } : b);
    }
  }
  return blocks;
}

/**
 * OUTDENT: move block from its parent's children to after its parent.
 * Works at any nesting level.
 */
function outdentBlock(blocks: Block[], blockId: string, parentId: string | null = null): { blocks: Block[]; ejected: Block | null } {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === blockId) {
      if (parentId === null) return { blocks, ejected: null }; // Already top-level
      const ejected = blocks[i];
      return {
        blocks: blocks.filter((_, idx) => idx !== i),
        ejected,
      };
    }
    const result = outdentBlock(blocks[i].children, blockId, blocks[i].id);
    if (result.ejected) {
      const newBlock = { ...blocks[i], children: result.blocks };
      const updated = [...blocks];
      updated[i] = newBlock;
      // Insert ejected block after its former parent (blocks[i])
      updated.splice(i + 1, 0, result.ejected);
      return { blocks: updated, ejected: null }; // null = already re-inserted
    }
  }
  return { blocks, ejected: null };
}

const TASK_CYCLE: Block['taskStatus'][] = ['TODO', 'DOING', 'DONE', 'LATER', 'NOW', 'CANCELLED', null];

// ─── Backlinks refresh helper ────────────────────────────────────────────────

function refreshBacklinks(db: Record<string, Page>): Record<string, string[]> {
  return serialiseBacklinks(buildBacklinksIndex(db));
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state: DatabaseState, action: Action): DatabaseState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;

    case 'NAVIGATE':
      return { ...state, currentPageId: action.pageId };

    case 'SET_ACTIVE_VIEW':
      return { ...state, activeView: action.view };

    case 'UPDATE_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedBlocks = findAndUpdateBlock(page.blocks, action.blockId, b => ({
        ...b,
        content: action.content,
        refs: extractRefs(action.content),
      }));
      const newDb = {
        ...state.db,
        [action.pageId]: { ...page, blocks: updatedBlocks, updatedAt: new Date().toISOString() },
      };
      return { ...state, db: newDb, backlinksRaw: refreshBacklinks(newDb) };
    }

    case 'UPDATE_BLOCK_STATUS': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedBlocks = findAndUpdateBlock(page.blocks, action.blockId, b => {
        const currIdx = TASK_CYCLE.indexOf(b.taskStatus);
        const nextStatus =
          action.status !== undefined
            ? action.status
            : TASK_CYCLE[(currIdx + 1) % TASK_CYCLE.length];
        return { ...b, taskStatus: nextStatus };
      });
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks } },
      };
    }

    case 'TOGGLE_COLLAPSE': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedBlocks = findAndUpdateBlock(page.blocks, action.blockId, b => ({
        ...b,
        collapsed: !b.collapsed,
      }));
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks } },
      };
    }

    case 'ADD_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const newBlock = makeBlock(action.content ?? '');
      const updatedBlocks = addBlockAfter(page.blocks, action.afterBlockId, newBlock);
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks } },
      };
    }

    case 'DELETE_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedBlocks = deleteBlockById(page.blocks, action.blockId);
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks } },
      };
    }

    case 'INDENT_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedBlocks = indentBlock(page.blocks, action.blockId);
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks } },
      };
    }

    case 'OUTDENT_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const { blocks: updatedBlocks } = outdentBlock(page.blocks, action.blockId);
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks } },
      };
    }

    case 'CREATE_PAGE': {
      const id = action.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      if (state.db[id]) {
        return action.navigate ? { ...state, currentPageId: id } : state;
      }
      const newPage: Page = {
        id,
        name: action.name,
        blocks: [makeBlock(`# ${action.name}`)],
        isJournal: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        properties: {},
        tags: [],
        mediaAttachments: [],
      };
      const newDb = { ...state.db, [id]: newPage };
      return {
        ...state,
        db: newDb,
        currentPageId: action.navigate ? id : state.currentPageId,
        backlinksRaw: refreshBacklinks(newDb),
      };
    }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case 'TOGGLE_FAVORITE': {
      const favs = state.favorites.includes(action.pageId)
        ? state.favorites.filter(id => id !== action.pageId)
        : [...state.favorites, action.pageId];
      return { ...state, favorites: favs };
    }

    case 'SET_SIDEBAR_PAGE':
      return { ...state, sidebarPageId: action.pageId };

    case 'OPEN_SIDEBAR':
      return {
        ...state,
        sidebarPageId: action.pageId,
        settings: { ...state.settings, rightSidebarOpen: true },
      };

    case 'CLOSE_SIDEBAR':
      return {
        ...state,
        sidebarPageId: null,
        settings: { ...state.settings, rightSidebarOpen: false },
      };

    case 'ADD_MEDIA': {
      const page = state.db[action.pageId];
      if (!page) return state;
      return {
        ...state,
        db: {
          ...state.db,
          [action.pageId]: {
            ...page,
            mediaAttachments: [...(page.mediaAttachments ?? []), action.media],
          },
        },
      };
    }

    case 'DELETE_MEDIA': {
      const page = state.db[action.pageId];
      if (!page) return state;
      return {
        ...state,
        db: {
          ...state.db,
          [action.pageId]: {
            ...page,
            mediaAttachments: (page.mediaAttachments ?? []).filter(
              m => m.id !== action.mediaId,
            ),
          },
        },
      };
    }

    case 'UPDATE_MEDIA': {
      const page = state.db[action.pageId];
      if (!page) return state;
      return {
        ...state,
        db: {
          ...state.db,
          [action.pageId]: {
            ...page,
            mediaAttachments: (page.mediaAttachments ?? []).map(m =>
              m.id === action.media.id ? action.media : m,
            ),
          },
        },
      };
    }

    case 'ADD_AUDIO_NOTE':
      return { ...state, audioNotes: [...state.audioNotes, action.note] };

    case 'UPDATE_AUDIO_NOTE':
      return {
        ...state,
        audioNotes: state.audioNotes.map(n => (n.id === action.note.id ? action.note : n)),
      };

    case 'DELETE_AUDIO_NOTE':
      return {
        ...state,
        audioNotes: state.audioNotes.filter(n => n.id !== action.noteId),
      };

    case 'UPDATE_SM2':
      return {
        ...state,
        sm2Schedules: {
          ...state.sm2Schedules,
          [action.cardId]: {
            easeFactor: action.easeFactor,
            interval: action.interval,
            nextReview: action.nextReview,
            reviewCount: action.reviewCount,
          },
        },
      };

    default:
      return state;
  }
}

// ─── Initial state factory ────────────────────────────────────────────────────

function buildFreshState(): DatabaseState {
  const db = buildInitialDatabase();
  return {
    db,
    currentPageId: getTodayJournalId(),
    sidebarPageId: null,
    favorites: ['project-voyager', 'media-studio'],
    settings: DEFAULT_SETTINGS,
    audioNotes: buildInitialAudioNotes(),
    activeView: 'editor',
    backlinksRaw: refreshBacklinks(db),
    sm2Schedules: {},
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface DatabaseContextType {
  state: DatabaseState;
  dispatch: React.Dispatch<Action>;
  navigateTo: (pageId: string) => void;
  getOrCreatePage: (name: string) => string;
  /** Derived backlinks index (built once, cheap to read) */
  backlinks: BacklinksIndex;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildFreshState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  // ── Hydrate from IndexedDB on mount ──────────────────────────────────────
  useEffect(() => {
    loadState<DatabaseState>().then(saved => {
      if (saved && !hydratedRef.current) {
        hydratedRef.current = true;
        // Ensure today's journal exists after hydration
        const todayId = getTodayJournalId();
        if (!saved.db[todayId]) {
          const fresh = buildFreshState();
          saved.db[todayId] = fresh.db[todayId];
        }
        // Recompute backlinks from persisted DB (refs may have changed)
        saved.backlinksRaw = serialiseBacklinks(buildBacklinksIndex(saved.db));
        dispatch({ type: 'HYDRATE', state: saved });
      } else {
        hydratedRef.current = true;
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save on state change (debounced 800 ms) ─────────────────────────
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState(state);
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  // ── Derived backlinks index ───────────────────────────────────────────────
  const backlinks = deserialiseBacklinks(state.backlinksRaw);

  // ── Navigation helper ─────────────────────────────────────────────────────
  const navigateTo = useCallback(
    (pageId: string) => {
      if (!state.db[pageId]) {
        const name = pageId
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        dispatch({ type: 'CREATE_PAGE', name, navigate: true });
      } else {
        dispatch({ type: 'NAVIGATE', pageId });
      }
      dispatch({ type: 'SET_ACTIVE_VIEW', view: 'editor' });
    },
    [state.db],
  );

  // ── getOrCreatePage helper ────────────────────────────────────────────────
  const getOrCreatePage = useCallback(
    (name: string): string => {
      const id = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      if (!state.db[id]) {
        dispatch({ type: 'CREATE_PAGE', name });
      }
      return id;
    },
    [state.db],
  );

  return (
    <DatabaseContext.Provider value={{ state, dispatch, navigateTo, getOrCreatePage, backlinks }}>
      {children}
    </DatabaseContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDatabase() {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used inside DatabaseProvider');
  return ctx;
}
