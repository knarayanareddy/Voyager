import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
} from 'react';
import { Page, Block, AppSettings, AudioNote, MediaAttachment, ActiveView } from '../types';
import {
  buildInitialDatabase,
  buildInitialAudioNotes,
  DEFAULT_SETTINGS,
  getTodayJournalId,
  genId,
  formatJournalTitle
} from '../mockData';
import { extractRefs, rewriteRefs } from '../lib/parsing';
import { genUUID, genMediaId } from '../utils/id';
import { dbService, initStorage, revokeMediaUrl } from '../utils/db';
import {
  buildBacklinksIndex,
  BacklinksIndex,
  serialiseBacklinks,
  deserialiseBacklinks,
  updateBacklinksForPage,
} from '../lib/backlinksIndex';

// ─── State shape ─────────────────────────────────────────────────────────────

export interface DatabaseState {
  db: Record<string, Page>;
  currentPageId: string;
  sidebarPageId: string | null;
  favorites: string[];
  settings: AppSettings;
  audioNotes: AudioNote[];
  activeView: ActiveView;
  mediaAttachments: MediaAttachment[];
  // Serialised backlinks index (Map is not JSON-safe for direct state storage)
  backlinksRaw: Record<string, string[]>;
  dirtyPageIds: string[];
  reviews: Record<string, import('../types').CardReview>;
}

export interface DatabaseActions {
  addMedia: (
    blob: Blob,
    type: MediaAttachment['type'],
    name: string,
    ownerPageId?: string
  ) => Promise<MediaAttachment>;
  deleteMedia: (mediaId: string) => Promise<void>;
  addAudioNote: (note: AudioNote, blob?: Blob) => Promise<void>;
  deleteAudioNote: (noteId: string) => Promise<void>;
  updateAudioNote: (note: AudioNote) => Promise<void>;
  renamePage: (pageId: string, newName: string) => void;
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
  | { type: 'SAVE_REVIEW'; review: import('../types').CardReview }
  | { type: 'HYDRATE'; state: DatabaseState }
  | { type: 'CLEAR_DIRTY_PAGES'; pageIds: string[] }
  | { type: 'RENAME_PAGE'; pageId: string; newName: string };

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

function indentBlockTree(blocks: Block[], blockId: string): Block[] {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === blockId) {
      if (i === 0) return blocks;
      const prev = blocks[i - 1];
      const target = blocks[i];
      const newPrev: Block = { ...prev, children: [...prev.children, target] };
      return [
        ...blocks.slice(0, i - 1),
        newPrev,
        ...blocks.slice(i + 1),
      ];
    }
    const newChildren = indentBlockTree(blocks[i].children, blockId);
    if (newChildren !== blocks[i].children) {
      return blocks.map((b, idx) => idx === i ? { ...b, children: newChildren } : b);
    }
  }
  return blocks;
}

function outdentBlockTree(blocks: Block[], blockId: string, parentId: string | null = null): { blocks: Block[]; ejected: Block | null } {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === blockId) {
      if (parentId === null) return { blocks, ejected: null };
      const ejected = blocks[i];
      return {
        blocks: blocks.filter((_, idx) => idx !== i),
        ejected,
      };
    }
    const result = outdentBlockTree(blocks[i].children, blockId, blocks[i].id);
    if (result.ejected) {
      const newBlock = { ...blocks[i], children: result.blocks };
      const updated = [...blocks];
      updated[i] = newBlock;
      updated.splice(i + 1, 0, result.ejected);
      return { blocks: updated, ejected: null };
    }
  }
  return { blocks, ejected: null };
}

const TASK_CYCLE: Block['taskStatus'][] = ['TODO', 'DOING', 'DONE', 'LATER', 'NOW', 'CANCELLED', null];

// ─── Reducer ─────────────────────────────────────────────────────────────────

function rewriteBlockRefs(blocks: Block[], oldName: string, newName: string): Block[] {
  return blocks.map(b => {
    const newContent = rewriteRefs(b.content, oldName, newName);
    const updatedBlock: Block = {
      ...b,
      content: newContent,
      refs: extractRefs(newContent),
    };
    if (b.children && b.children.length > 0) {
      updatedBlock.children = rewriteBlockRefs(b.children, oldName, newName);
    }
    return updatedBlock;
  });
}

function baseReducer(state: DatabaseState, action: Action): DatabaseState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;

    case 'CLEAR_DIRTY_PAGES':
      return {
        ...state,
        dirtyPageIds: state.dirtyPageIds.filter(id => !action.pageIds.includes(id))
      };

    case 'RENAME_PAGE': {
      const { pageId, newName } = action;
      const trimmedNewName = newName.trim();
      const oldPage = state.db[pageId];

      if (!oldPage || !trimmedNewName) return state;

      const newPageId = trimmedNewName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      // Guard: check if another page already has the newPageId (and it's not the same page being renamed, e.g. case change)
      if (newPageId !== pageId && state.db[newPageId]) {
        return state;
      }

      // Create copies and perform renames/references rewriting
      const newDb: Record<string, Page> = {};

      for (const [id, page] of Object.entries(state.db)) {
        if (id === pageId) {
          // The page itself
          const updatedBlocks = rewriteBlockRefs(page.blocks, oldPage.name, trimmedNewName);
          if (updatedBlocks.length > 0 && updatedBlocks[0].content.toLowerCase().startsWith(`# ${oldPage.name.toLowerCase()}`)) {
            updatedBlocks[0] = {
              ...updatedBlocks[0],
              content: `# ${trimmedNewName}`,
              refs: extractRefs(`# ${trimmedNewName}`),
            };
          }
          newDb[newPageId] = {
            ...page,
            id: newPageId,
            name: trimmedNewName,
            blocks: updatedBlocks,
            updatedAt: new Date().toISOString(),
          };
        } else {
          // Other pages
          const updatedBlocks = rewriteBlockRefs(page.blocks, oldPage.name, trimmedNewName);
          const blockChanged = JSON.stringify(updatedBlocks) !== JSON.stringify(page.blocks);
          
          if (blockChanged) {
            newDb[id] = {
              ...page,
              blocks: updatedBlocks,
              updatedAt: new Date().toISOString(),
            };
          } else {
            newDb[id] = page;
          }
        }
      }

      // Update current and sidebar page IDs
      let nextCurrentPageId = state.currentPageId;
      if (state.currentPageId === pageId) {
        nextCurrentPageId = newPageId;
      }
      let nextSidebarPageId = state.sidebarPageId;
      if (state.sidebarPageId === pageId) {
        nextSidebarPageId = newPageId;
      }

      // Update favorites
      const nextFavorites = state.favorites.map(id => id === pageId ? newPageId : id);

      // Rebuild the backlinks index from scratch
      const nextBacklinksRaw = serialiseBacklinks(buildBacklinksIndex(newDb));

      return {
        ...state,
        db: newDb,
        currentPageId: nextCurrentPageId,
        sidebarPageId: nextSidebarPageId,
        favorites: nextFavorites,
        backlinksRaw: nextBacklinksRaw,
      };
    }

    case 'NAVIGATE':
      return { 
        ...state, 
        currentPageId: action.pageId,
      };

    case 'SET_ACTIVE_VIEW': {
      return { ...state, activeView: action.view };
    }
    case 'SAVE_REVIEW': {
      return {
        ...state,
        reviews: {
          ...state.reviews,
          [action.review.id]: action.review
        }
      };
    }

    case 'UPDATE_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedBlocks = findAndUpdateBlock(page.blocks, action.blockId, b => ({
        ...b,
        content: action.content,
        refs: extractRefs(action.content),
      }));
      const newPage = { ...page, blocks: updatedBlocks, updatedAt: new Date().toISOString() };
      const newDb = {
        ...state.db,
        [action.pageId]: newPage,
      };

      // Incrementally update backlinks for just the edited page
      const currentIndex = deserialiseBacklinks(state.backlinksRaw);
      const nextIndex = updateBacklinksForPage(currentIndex, action.pageId, page, newPage);
      const nextBacklinksRaw = serialiseBacklinks(nextIndex);

      return { ...state, db: newDb, backlinksRaw: nextBacklinksRaw };
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
      const newPage = {
        ...page,
        blocks: updatedBlocks,
      };
      const newDb = { ...state.db, [action.pageId]: newPage };

      // Incrementally update backlinks on block deletion
      const currentIndex = deserialiseBacklinks(state.backlinksRaw);
      const nextIndex = updateBacklinksForPage(currentIndex, action.pageId, page, newPage);
      const nextBacklinksRaw = serialiseBacklinks(nextIndex);

      return {
        ...state,
        db: newDb,
        backlinksRaw: nextBacklinksRaw,
      };
    }

    case 'INDENT_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedBlocks = indentBlockTree(page.blocks, action.blockId);
      return {
        ...state,
        db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks } },
      };
    }

    case 'OUTDENT_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const { blocks: updatedBlocks } = outdentBlockTree(page.blocks, action.blockId);
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

      // Incrementally update backlinks index for the new page
      const currentIndex = deserialiseBacklinks(state.backlinksRaw);
      const nextIndex = updateBacklinksForPage(currentIndex, id, undefined, newPage);
      const nextBacklinksRaw = serialiseBacklinks(nextIndex);

      return {
        ...state,
        db: newDb,
        currentPageId: action.navigate ? id : state.currentPageId,
        backlinksRaw: nextBacklinksRaw,
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
        mediaAttachments: [...(state.mediaAttachments ?? []), action.media],
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
        mediaAttachments: (state.mediaAttachments ?? []).filter(
          m => m.id !== action.mediaId,
        ),
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
        mediaAttachments: (state.mediaAttachments ?? []).map(m =>
          m.id === action.media.id ? action.media : m,
        ),
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

    default:
      return state;
  }
}

function reducer(state: DatabaseState, action: Action): DatabaseState {
  let nextState = baseReducer(state, action);
  
  if (nextState.currentPageId !== state.currentPageId) {
    nextState = {
      ...nextState,
      settings: {
        ...nextState.settings,
        lastOpenedPageId: nextState.currentPageId
      }
    };
  }
  
  if (action.type !== 'CLEAR_DIRTY_PAGES' && action.type !== 'HYDRATE' && nextState.db !== state.db) {
    const changedIds = new Set<string>(nextState.dirtyPageIds || []);
    
    // Add modified or new pages
    for (const id in nextState.db) {
      if (nextState.db[id] !== state.db[id]) {
        changedIds.add(id);
      }
    }
    
    // Add deleted pages
    for (const id in state.db) {
      if (!nextState.db[id]) {
        changedIds.add(id);
      }
    }
    
    return { ...nextState, dirtyPageIds: Array.from(changedIds) };
  }
  
  return nextState;
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
    mediaAttachments: [],
    backlinksRaw: serialiseBacklinks(buildBacklinksIndex(db)),
    dirtyPageIds: [],
    reviews: {},
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface DatabaseContextType {
  state: DatabaseState;
  dispatch: React.Dispatch<Action>;
  navigateTo: (pageId: string) => void;
  getOrCreatePage: (name: string) => string;
  backlinks: BacklinksIndex;
  loading: boolean;
  actions: DatabaseActions;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildFreshState);
  const [loading, setLoading] = useState(true);
  const hydratedRef = useRef(false);

  const prevSettingsRef = useRef<AppSettings | null>(null);
  const prevFavoritesRef = useRef<string[]>([]);
  const prevAudioRef = useRef<AudioNote[]>([]);
  const prevReviewsRef = useRef<Record<string, import('../types').CardReview>>({});

  // ── Hydrate from IndexedDB on mount ──────────────────────────────────────
  useEffect(() => {
    const initData = async () => {
      try {
        await initStorage();

        let storedSettings = await dbService.getSettings();
        if (!storedSettings) {
          storedSettings = DEFAULT_SETTINGS;
          await dbService.saveSettings(DEFAULT_SETTINGS);
        }

        const storedFavorites = await dbService.getFavorites();
        const storedAudio = await dbService.getAllAudioNotes();
        const storedMedia = await dbService.getAllMedia();
        const storedPages = await dbService.getAllPages();
        const storedReviews = await dbService.getAllReviews();

        const pagesMap: Record<string, Page> = {};
        if (storedPages.length === 0) {
          const mockPages = buildInitialDatabase();
          for (const page of Object.values(mockPages)) {
            await dbService.savePage(page);
            pagesMap[page.id] = page;
          }
        } else {
          storedPages.forEach(p => {
            pagesMap[p.id] = p;
          });
        }

        // Attach media items to their pages in state metadata
        // Create mutable copies so we never mutate IndexedDB objects in-place
        const mutablePagesMap: Record<string, Page> = {};
        for (const [id, page] of Object.entries(pagesMap)) {
          mutablePagesMap[id] = { ...page, mediaAttachments: [] };
        }

        storedMedia.forEach(media => {
          if (media.ownerPageId && mutablePagesMap[media.ownerPageId]) {
            mutablePagesMap[media.ownerPageId].mediaAttachments!.push(media);
          }
        });

        const todayJournalId = getTodayJournalId();
        if (!mutablePagesMap[todayJournalId]) {
          const dateStr = todayJournalId.replace('journal-', '');
          let journalTitle = dateStr;
          try {
            journalTitle = formatJournalTitle(dateStr);
          } catch (e) {
            console.error('formatJournalTitle failed', e);
          }
          const newJournalPage: Page = {
            id: todayJournalId,
            name: journalTitle,
            blocks: [{
              id: genId(),
              uuid: genUUID(),
              content: `# ${journalTitle}`,
              children: [],
              collapsed: false,
              taskStatus: null,
              properties: {},
              refs: [],
            }],
            isJournal: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            properties: {},
            tags: [],
            mediaAttachments: [],
          };
          mutablePagesMap[todayJournalId] = newJournalPage;
          await dbService.savePage(newJournalPage);
        }

        const initialBacklinksRaw = serialiseBacklinks(buildBacklinksIndex(mutablePagesMap));

        let initialPageId = todayJournalId;
        if (storedSettings.alwaysOpenJournal === false && storedSettings.lastOpenedPageId) {
          const lastId = storedSettings.lastOpenedPageId;
          if (mutablePagesMap[lastId]) {
            initialPageId = lastId;
          }
        }

        const reviewsMap: Record<string, import('../types').CardReview> = {};
        storedReviews.forEach(r => reviewsMap[r.id] = r);

        const hydratedState: DatabaseState = {
          db: mutablePagesMap,
          currentPageId: initialPageId,
          sidebarPageId: null,
          favorites: storedFavorites.length > 0 ? storedFavorites : ['project-voyager', 'media-studio'],
          settings: storedSettings,
          audioNotes: storedAudio,
          activeView: 'editor',
          mediaAttachments: storedMedia,
          backlinksRaw: initialBacklinksRaw,
          dirtyPageIds: [],
          reviews: reviewsMap,
        };

        dispatch({ type: 'HYDRATE', state: hydratedState });
        hydratedRef.current = true;
      } catch (error) {
        console.error('Failed to initialize local database:', error);
      } finally {
        setLoading(false);
      }
    };

    initData();
    return () => {
      dbService.close();
    };
  }, []);

  // ── Auto-save on state change (Incremental) ─────────────────────────
  useEffect(() => {
    if (!hydratedRef.current) return;

    const performSave = async () => {
      try {
        // 1. Sync pages incrementally using the dirty queue (O(k))
        if (state.dirtyPageIds.length > 0) {
          const pagesToSave = [...state.dirtyPageIds];
          dispatch({ type: 'CLEAR_DIRTY_PAGES', pageIds: pagesToSave });
          
          // Sequentially write to avoid unbounded concurrent IDB writes
          for (const id of pagesToSave) {
            const page = state.db[id];
            if (page) {
              await dbService.savePage(page);
            } else {
              await dbService.deletePage(id);
            }
          }
        }

        // 2. Sync settings
        if (state.settings !== prevSettingsRef.current) {
          await dbService.saveSettings(state.settings);
          prevSettingsRef.current = state.settings;
        }

        // 3. Sync favorites
        if (state.favorites !== prevFavoritesRef.current) {
          await dbService.saveFavorites(state.favorites);
          prevFavoritesRef.current = state.favorites;
        }

        // 4. Sync audio notes metadata
        if (state.audioNotes !== prevAudioRef.current) {
          for (const note of state.audioNotes) {
            const prevNote = prevAudioRef.current.find(n => n.id === note.id);
            if (note !== prevNote) {
              await dbService.saveAudioNote(note);
            }
          }
          for (const note of prevAudioRef.current) {
            if (!state.audioNotes.some(n => n.id === note.id)) {
              await dbService.deleteAudioNote(note.id);
            }
          }
          prevAudioRef.current = state.audioNotes;
        }

        // 5. Sync reviews
        if (state.reviews !== prevReviewsRef.current) {
          for (const review of Object.values(state.reviews)) {
            const prevReview = prevReviewsRef.current[review.id];
            if (review !== prevReview) {
              await dbService.saveReview(review);
            }
          }
          prevReviewsRef.current = state.reviews;
        }
      } catch (error) {
        // Suppress errors if database is closed/unmounted
        console.warn('[DatabaseContext] Auto-save failed (expected during cleanup/unmount):', error);
      }
    };

    performSave();
  }, [state]);

  // ── Derived backlinks index ───────────────────────────────────────────────
  const backlinks = useMemo(() => deserialiseBacklinks(state.backlinksRaw), [state.backlinksRaw]);

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

  const addMedia = useCallback(async (
    blob: Blob,
    type: MediaAttachment['type'],
    name: string,
    ownerPageId?: string
  ): Promise<MediaAttachment> => {
    const mediaId = genMediaId();
    const resolvedPageId = ownerPageId || state.currentPageId;
    const objectUrl = URL.createObjectURL(blob);

    const metadata: Omit<MediaAttachment, 'url'> = {
      id: mediaId,
      type,
      name,
      size: blob.size,
      mimeType: blob.type,
      createdAt: new Date().toISOString(),
      ownerPageId: resolvedPageId
    };

    try {
      await dbService.saveMedia(blob, metadata);
      const attachment: MediaAttachment = { ...metadata, url: objectUrl };
      dispatch({ type: 'ADD_MEDIA', pageId: resolvedPageId, media: attachment });
      return attachment;
    } catch (error) {
      console.error('Failed to save media:', error);
      throw error;
    }
  }, [state.currentPageId]);

  const deleteMedia = useCallback(async (mediaId: string) => {
    const pageId = state.currentPageId;
    try {
      const existing = state.mediaAttachments.find(m => m.id === mediaId);
      if (existing?.url) {
        revokeMediaUrl(existing.url);
      }
      await dbService.deleteMedia(mediaId);
      dispatch({ type: 'DELETE_MEDIA', pageId, mediaId });
    } catch (error) {
      console.error('Failed to delete media:', error);
    }
  }, [state.currentPageId, state.mediaAttachments]);

  const addAudioNote = useCallback(async (note: AudioNote, blob?: Blob) => {
    try {
      await dbService.saveAudioNote(note, blob);
      dispatch({ type: 'ADD_AUDIO_NOTE', note });
    } catch (error) {
      console.error('Failed to save audio note:', error);
    }
  }, []);

  const deleteAudioNote = useCallback(async (noteId: string) => {
    try {
      await dbService.deleteAudioNote(noteId);
      dispatch({ type: 'DELETE_AUDIO_NOTE', noteId });
    } catch (error) {
      console.error('Failed to delete audio note:', error);
    }
  }, []);

  const updateAudioNote = useCallback(async (note: AudioNote) => {
    try {
      await dbService.saveAudioNote(note);
      dispatch({ type: 'UPDATE_AUDIO_NOTE', note });
    } catch (error) {
      console.error('Failed to update audio note:', error);
    }
  }, []);

  const renamePage = useCallback((pageId: string, newName: string) => {
    dispatch({ type: 'RENAME_PAGE', pageId, newName });
  }, []);

  const actions = useMemo(() => ({
    addMedia,
    deleteMedia,
    addAudioNote,
    deleteAudioNote,
    updateAudioNote,
    renamePage,
  }), [addMedia, deleteMedia, addAudioNote, deleteAudioNote, updateAudioNote, renamePage]);

  return (
    <DatabaseContext.Provider value={{ state, dispatch, navigateTo, getOrCreatePage, backlinks, loading, actions }}>
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
