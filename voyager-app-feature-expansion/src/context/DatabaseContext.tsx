import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { Page, Block, AppSettings, AudioNote, MediaAttachment, ActiveView } from '../types';
import { buildInitialDatabase, buildInitialAudioNotes, DEFAULT_SETTINGS, getTodayJournalId, genId, genUUID } from '../mockData';

interface DatabaseState {
  db: Record<string, Page>;
  currentPageId: string;
  sidebarPageId: string | null;
  favorites: string[];
  settings: AppSettings;
  audioNotes: AudioNote[];
  activeView: ActiveView;
}

type Action =
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
  | { type: 'SET_ACTIVE_VIEW'; view: ActiveView };

function makeBlock(content: string, taskStatus: Block['taskStatus'] = null): Block {
  return {
    id: genId(),
    uuid: genUUID(),
    content,
    children: [],
    collapsed: false,
    taskStatus,
    properties: {},
    refs: [],
  };
}

function findAndUpdateBlock(blocks: Block[], blockId: string, updater: (b: Block) => Block): Block[] {
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

const TASK_CYCLE: Block['taskStatus'][] = ['TODO', 'DOING', 'DONE', 'LATER', 'NOW', 'CANCELLED', null];

function reducer(state: DatabaseState, action: Action): DatabaseState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, currentPageId: action.pageId };

    case 'SET_ACTIVE_VIEW':
      return { ...state, activeView: action.view };

    case 'UPDATE_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedBlocks = findAndUpdateBlock(page.blocks, action.blockId, b => ({ ...b, content: action.content }));
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks, updatedAt: new Date().toISOString() } } };
    }

    case 'UPDATE_BLOCK_STATUS': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedBlocks = findAndUpdateBlock(page.blocks, action.blockId, b => {
        const currIdx = TASK_CYCLE.indexOf(b.taskStatus);
        const nextStatus = action.status !== undefined ? action.status : TASK_CYCLE[(currIdx + 1) % TASK_CYCLE.length];
        return { ...b, taskStatus: nextStatus };
      });
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks } } };
    }

    case 'TOGGLE_COLLAPSE': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedBlocks = findAndUpdateBlock(page.blocks, action.blockId, b => ({ ...b, collapsed: !b.collapsed }));
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks } } };
    }

    case 'ADD_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const newBlock = makeBlock(action.content ?? '');
      const updatedBlocks = addBlockAfter(page.blocks, action.afterBlockId, newBlock);
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks } } };
    }

    case 'DELETE_BLOCK': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedBlocks = deleteBlockById(page.blocks, action.blockId);
      return { ...state, db: { ...state.db, [action.pageId]: { ...page, blocks: updatedBlocks } } };
    }

    case 'CREATE_PAGE': {
      const id = action.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
      return {
        ...state,
        db: { ...state.db, [id]: newPage },
        currentPageId: action.navigate ? id : state.currentPageId,
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
      return { ...state, sidebarPageId: action.pageId, settings: { ...state.settings, rightSidebarOpen: true } };

    case 'CLOSE_SIDEBAR':
      return { ...state, sidebarPageId: null, settings: { ...state.settings, rightSidebarOpen: false } };

    case 'ADD_MEDIA': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedPage = { ...page, mediaAttachments: [...(page.mediaAttachments || []), action.media] };
      return { ...state, db: { ...state.db, [action.pageId]: updatedPage } };
    }

    case 'DELETE_MEDIA': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedPage = { ...page, mediaAttachments: (page.mediaAttachments || []).filter(m => m.id !== action.mediaId) };
      return { ...state, db: { ...state.db, [action.pageId]: updatedPage } };
    }

    case 'UPDATE_MEDIA': {
      const page = state.db[action.pageId];
      if (!page) return state;
      const updatedPage = { ...page, mediaAttachments: (page.mediaAttachments || []).map(m => m.id === action.media.id ? action.media : m) };
      return { ...state, db: { ...state.db, [action.pageId]: updatedPage } };
    }

    case 'ADD_AUDIO_NOTE':
      return { ...state, audioNotes: [...state.audioNotes, action.note] };

    case 'UPDATE_AUDIO_NOTE':
      return { ...state, audioNotes: state.audioNotes.map(n => n.id === action.note.id ? action.note : n) };

    case 'DELETE_AUDIO_NOTE':
      return { ...state, audioNotes: state.audioNotes.filter(n => n.id !== action.noteId) };

    default:
      return state;
  }
}

interface DatabaseContextType {
  state: DatabaseState;
  dispatch: React.Dispatch<Action>;
  navigateTo: (pageId: string) => void;
  getOrCreatePage: (name: string) => string;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

function initState(): DatabaseState {
  return {
    db: buildInitialDatabase(),
    currentPageId: getTodayJournalId(),
    sidebarPageId: null,
    favorites: ['project-voyager', 'media-studio'],
    settings: DEFAULT_SETTINGS,
    audioNotes: buildInitialAudioNotes(),
    activeView: 'editor',
  };
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  const navigateTo = useCallback((pageId: string) => {
    if (!state.db[pageId]) {
      const name = pageId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      dispatch({ type: 'CREATE_PAGE', name, navigate: true });
    } else {
      dispatch({ type: 'NAVIGATE', pageId });
    }
    dispatch({ type: 'SET_ACTIVE_VIEW', view: 'editor' });
  }, [state.db]);

  const getOrCreatePage = useCallback((name: string): string => {
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!state.db[id]) {
      dispatch({ type: 'CREATE_PAGE', name });
    }
    return id;
  }, [state.db]);

  return (
    <DatabaseContext.Provider value={{ state, dispatch, navigateTo, getOrCreatePage }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used inside DatabaseProvider');
  return ctx;
}
