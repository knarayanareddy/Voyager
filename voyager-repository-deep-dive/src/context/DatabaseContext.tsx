import React, { createContext, useContext, useReducer, useEffect, useState, useMemo } from 'react';
import { DatabaseState, Page, Block, AppSettings, AudioNote, MediaAttachment } from '../types';
import { dbService, initStorage } from '../utils/db';
import { getMockPages, generateUuid } from '../mockData';
import {
  updateBlockInTree,
  addBlockToTree,
  deleteBlockFromTree,
  indentBlockInTree,
  outdentBlockInTree
} from '../utils/treeUtils';

// Rebuild backlinks and tag indexes reactively
export const rebuildIndexes = (pages: Record<string, Page>) => {
  const backlinks: Record<string, any[]> = {};
  const tagIndex: Record<string, string[]> = {};

  Object.values(pages).forEach(page => {
    const pageId = page.id;
    const pageName = page.name;

    const traverseBlocks = (block: Block) => {
      // Extract links: [[Page Name]]
      const linkRegex = /\[\[(.*?)\]\]/g;
      let match;
      const content = block.content;
      while ((match = linkRegex.exec(content)) !== null) {
        const targetName = match[1]?.trim();
        if (targetName) {
          // Find target page by name (case-insensitive)
          const targetPage = Object.values(pages).find(
            p => p.name.toLowerCase() === targetName.toLowerCase()
          );
          // If page doesn't exist yet, we index by its lowercase name as a placeholder
          const targetKey = targetPage ? targetPage.id : `page-${targetName.toLowerCase().replace(/\s+/g, '-')}`;
          
          if (!backlinks[targetKey]) {
            backlinks[targetKey] = [];
          }
          
          if (!backlinks[targetKey].some(b => b.blockUuid === block.uuid)) {
            backlinks[targetKey].push({
              pageId,
              pageName,
              blockUuid: block.uuid,
              content
            });
          }
        }
      }

      // Extract tags: #tagname (case insensitive, alphanumeric + hyphens)
      const tagRegex = /(?:^|\s)#([a-zA-Z0-9_-]+)/g;
      // Reset regex index to avoid sticky matching bugs
      tagRegex.lastIndex = 0;
      while ((match = tagRegex.exec(content)) !== null) {
        const tag = match[1]?.toLowerCase();
        if (tag) {
          if (!tagIndex[tag]) {
            tagIndex[tag] = [];
          }
          if (!tagIndex[tag].includes(pageId)) {
            tagIndex[tag].push(pageId);
          }
        }
      }

      block.children.forEach(traverseBlocks);
    };

    page.blocks.forEach(traverseBlocks);
  });

  return { backlinks, tagIndex };
};

// Initial state
const defaultSettings: AppSettings = {
  bezelColor: '#1C1C1E',
  navMode: 'buttons',
  batteryLevel: 85,
  charging: false,
  screenOn: true,
  rightSidebarOpen: false,
  sPenActive: false,
  desktopMode: false,
  volume: 50
};

const initialState: Omit<DatabaseState, 'backlinks' | 'tagIndex'> = {
  pages: {},
  currentPageId: '',
  sidebarPageId: null,
  favorites: [],
  settings: defaultSettings,
  audioNotes: [],
  mediaAttachments: [],
  activeView: 'editor'
};

// Actions Union
type Action =
  | { type: 'INITIALIZE'; payload: { pages: Record<string, Page>; favorites: string[]; settings: AppSettings; audioNotes: AudioNote[]; mediaAttachments: MediaAttachment[] } }
  | { type: 'SET_ACTIVE_VIEW'; payload: DatabaseState['activeView'] }
  | { type: 'NAVIGATE_TO_PAGE'; payload: string }
  | { type: 'NAVIGATE_SIDEBAR'; payload: string }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'SET_PAGES'; payload: Record<string, Page> }
  | { type: 'SET_FAVORITES'; payload: string[] }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'SET_AUDIO_NOTES'; payload: AudioNote[] }
  | { type: 'SET_MEDIA_ATTACHMENTS'; payload: MediaAttachment[] };

// Pure reducer for synchronous state updates
function databaseReducer(
  state: Omit<DatabaseState, 'backlinks' | 'tagIndex'>,
  action: Action
): Omit<DatabaseState, 'backlinks' | 'tagIndex'> {
  switch (action.type) {
    case 'INITIALIZE':
      const initPages = action.payload.pages;
      // Find a default page to show (either today's journal or the first welcome page)
      const todayId = `journal-${new Date().toISOString().split('T')[0]}`;
      const defaultPageId = initPages[todayId] ? todayId : (Object.keys(initPages)[0] || '');
      return {
        ...state,
        pages: initPages,
        favorites: action.payload.favorites,
        settings: action.payload.settings,
        audioNotes: action.payload.audioNotes,
        mediaAttachments: action.payload.mediaAttachments,
        currentPageId: defaultPageId
      };

    case 'SET_ACTIVE_VIEW':
      return {
        ...state,
        activeView: action.payload
      };

    case 'NAVIGATE_TO_PAGE':
      return {
        ...state,
        currentPageId: action.payload,
        // If navigating to the page that is in the sidebar, close the sidebar to prevent double editor
        sidebarPageId: state.sidebarPageId === action.payload ? null : state.sidebarPageId
      };

    case 'NAVIGATE_SIDEBAR':
      return {
        ...state,
        sidebarPageId: action.payload,
        settings: {
          ...state.settings,
          rightSidebarOpen: true
        }
      };

    case 'CLOSE_SIDEBAR':
      return {
        ...state,
        sidebarPageId: null,
        settings: {
          ...state.settings,
          rightSidebarOpen: false
        }
      };

    case 'SET_PAGES':
      return {
        ...state,
        pages: action.payload
      };

    case 'SET_FAVORITES':
      return {
        ...state,
        favorites: action.payload
      };

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: action.payload
      };

    case 'SET_AUDIO_NOTES':
      return {
        ...state,
        audioNotes: action.payload
      };

    case 'SET_MEDIA_ATTACHMENTS':
      return {
        ...state,
        mediaAttachments: action.payload
      };

    default:
      return state;
  }
}

// Context contract
interface DatabaseContextProps {
  state: DatabaseState;
  loading: boolean;
  actions: {
    setActiveView: (view: DatabaseState['activeView']) => void;
    navigateToPage: (pageId: string) => void;
    navigateSidebar: (pageId: string) => void;
    closeSidebar: () => void;
    createPage: (name: string, isJournal: boolean) => Promise<string>;
    deletePage: (pageId: string) => Promise<void>;
    addBlock: (pageId: string, targetUuid: string, asChild: boolean) => Promise<string>;
    updateBlock: (pageId: string, blockUuid: string, content: string, updates?: Partial<Block>) => Promise<void>;
    deleteBlock: (pageId: string, blockUuid: string) => Promise<void>;
    indentBlock: (pageId: string, blockUuid: string) => Promise<boolean>;
    outdentBlock: (pageId: string, blockUuid: string) => Promise<boolean>;
    toggleFavorite: (pageId: string) => Promise<void>;
    updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
    addMedia: (blob: Blob, type: MediaAttachment['type'], name: string) => Promise<MediaAttachment>;
    deleteMedia: (id: string) => Promise<void>;
    addAudioNote: (note: Omit<AudioNote, 'url'>, blob?: Blob) => Promise<void>;
    deleteAudioNote: (id: string) => Promise<void>;
  };
}

const DatabaseContext = createContext<DatabaseContextProps | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rawState, dispatch] = useReducer(databaseReducer, initialState);
  const [loading, setLoading] = useState(true);

  // Initialize DB and load data
  useEffect(() => {
    const initData = async () => {
      try {
        await initStorage();
        
        // Load settings, favorites, media, audio notes, pages
        let storedSettings = await dbService.getSettings();
        if (!storedSettings) {
          storedSettings = defaultSettings;
          await dbService.saveSettings(defaultSettings);
        }

        const storedFavorites = await dbService.getFavorites();
        const storedAudio = await dbService.getAllAudioNotes();
        const storedMedia = await dbService.getAllMedia();
        const storedPages = await dbService.getAllPages();

        const pagesMap: Record<string, Page> = {};
        
        if (storedPages.length === 0) {
          // First boot: seed with mock pages
          const mockPages = getMockPages();
          for (const page of mockPages) {
            await dbService.savePage(page);
            pagesMap[page.id] = page;
          }
        } else {
          storedPages.forEach(p => {
            pagesMap[p.id] = p;
          });
        }

        dispatch({
          type: 'INITIALIZE',
          payload: {
            pages: pagesMap,
            favorites: storedFavorites,
            settings: storedSettings,
            audioNotes: storedAudio,
            mediaAttachments: storedMedia
          }
        });
      } catch (error) {
        console.error('Failed to initialize local database:', error);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // Compute backlinks and tagIndex reactively
  const { backlinks, tagIndex } = useMemo(() => {
    return rebuildIndexes(rawState.pages);
  }, [rawState.pages]);

  // Combined state exposed to the application
  const state: DatabaseState = useMemo(() => ({
    ...rawState,
    backlinks,
    tagIndex
  }), [rawState, backlinks, tagIndex]);

  // Operations wrapped in repository actions (triggers state change + IndexedDB write)
  const actions = useMemo(() => {
    const setActiveView = (view: DatabaseState['activeView']) => {
      dispatch({ type: 'SET_ACTIVE_VIEW', payload: view });
    };

    const navigateToPage = (pageId: string) => {
      dispatch({ type: 'NAVIGATE_TO_PAGE', payload: pageId });
    };

    const navigateSidebar = (pageId: string) => {
      dispatch({ type: 'NAVIGATE_SIDEBAR', payload: pageId });
    };

    const closeSidebar = () => {
      dispatch({ type: 'CLOSE_SIDEBAR' });
    };

    const createPage = async (name: string, isJournal: boolean): Promise<string> => {
      const pageId = isJournal
        ? `journal-${new Date().toISOString().split('T')[0]}`
        : `page-${generateUuid()}`;

      // Check if page already exists
      if (rawState.pages[pageId]) {
        return pageId;
      }

      const newPage: Page = {
        id: pageId,
        name,
        isJournal,
        createdAt: new Date().toISOString(),
        blocks: [
          {
            uuid: generateUuid(),
            content: '',
            children: []
          }
        ],
        tags: []
      };

      const updatedPages = {
        ...rawState.pages,
        [pageId]: newPage
      };

      dispatch({ type: 'SET_PAGES', payload: updatedPages });
      await dbService.savePage(newPage);

      return pageId;
    };

    const deletePage = async (pageId: string): Promise<void> => {
      const updatedPages = { ...rawState.pages };
      delete updatedPages[pageId];

      dispatch({ type: 'SET_PAGES', payload: updatedPages });
      await dbService.deletePage(pageId);
    };

    const addBlock = async (pageId: string, targetUuid: string, asChild: boolean): Promise<string> => {
      const page = rawState.pages[pageId];
      if (!page) return '';

      const newUuid = generateUuid();
      const newBlock: Block = {
        uuid: newUuid,
        content: '',
        children: [],
        parentUuid: asChild ? targetUuid : undefined
      };

      // Clone blocks tree
      const clonedBlocks = JSON.parse(JSON.stringify(page.blocks));
      addBlockToTree(clonedBlocks, targetUuid, newBlock, asChild);

      const updatedPage = {
        ...page,
        blocks: clonedBlocks
      };

      const updatedPages = {
        ...rawState.pages,
        [pageId]: updatedPage
      };

      dispatch({ type: 'SET_PAGES', payload: updatedPages });
      await dbService.savePage(updatedPage);

      return newUuid;
    };

    const updateBlock = async (
      pageId: string,
      blockUuid: string,
      content: string,
      updates?: Partial<Block>
    ): Promise<void> => {
      const page = rawState.pages[pageId];
      if (!page) return;

      const clonedBlocks = JSON.parse(JSON.stringify(page.blocks));
      const fullUpdates = { content, ...updates };
      
      updateBlockInTree(clonedBlocks, blockUuid, fullUpdates);

      const updatedPage = {
        ...page,
        blocks: clonedBlocks
      };

      const updatedPages = {
        ...rawState.pages,
        [pageId]: updatedPage
      };

      dispatch({ type: 'SET_PAGES', payload: updatedPages });
      await dbService.savePage(updatedPage);
    };

    const deleteBlock = async (pageId: string, blockUuid: string): Promise<void> => {
      const page = rawState.pages[pageId];
      if (!page) return;

      const clonedBlocks = JSON.parse(JSON.stringify(page.blocks));
      deleteBlockFromTree(clonedBlocks, blockUuid);

      // Ensure there is at least one block on the page
      if (clonedBlocks.length === 0) {
        clonedBlocks.push({
          uuid: generateUuid(),
          content: '',
          children: []
        });
      }

      const updatedPage = {
        ...page,
        blocks: clonedBlocks
      };

      const updatedPages = {
        ...rawState.pages,
        [pageId]: updatedPage
      };

      dispatch({ type: 'SET_PAGES', payload: updatedPages });
      await dbService.savePage(updatedPage);
    };

    const indentBlock = async (pageId: string, blockUuid: string): Promise<boolean> => {
      const page = rawState.pages[pageId];
      if (!page) return false;

      const clonedBlocks = JSON.parse(JSON.stringify(page.blocks));
      const success = indentBlockInTree(clonedBlocks, blockUuid);

      if (success) {
        const updatedPage = {
          ...page,
          blocks: clonedBlocks
        };

        const updatedPages = {
          ...rawState.pages,
          [pageId]: updatedPage
        };

        dispatch({ type: 'SET_PAGES', payload: updatedPages });
        await dbService.savePage(updatedPage);
      }

      return success;
    };

    const outdentBlock = async (pageId: string, blockUuid: string): Promise<boolean> => {
      const page = rawState.pages[pageId];
      if (!page) return false;

      const clonedBlocks = JSON.parse(JSON.stringify(page.blocks));
      const success = outdentBlockInTree(clonedBlocks, blockUuid);

      if (success) {
        const updatedPage = {
          ...page,
          blocks: clonedBlocks
        };

        const updatedPages = {
          ...rawState.pages,
          [pageId]: updatedPage
        };

        dispatch({ type: 'SET_PAGES', payload: updatedPages });
        await dbService.savePage(updatedPage);
      }

      return success;
    };

    const toggleFavorite = async (pageId: string): Promise<void> => {
      const isFav = rawState.favorites.includes(pageId);
      const updatedFavorites = isFav
        ? rawState.favorites.filter(id => id !== pageId)
        : [...rawState.favorites, pageId];

      dispatch({ type: 'SET_FAVORITES', payload: updatedFavorites });
      await dbService.saveFavorites(updatedFavorites);
    };

    const updateSettings = async (settingsUpdates: Partial<AppSettings>): Promise<void> => {
      const updatedSettings = {
        ...rawState.settings,
        ...settingsUpdates
      };

      dispatch({ type: 'SET_SETTINGS', payload: updatedSettings });
      await dbService.saveSettings(updatedSettings);
    };

    const addMedia = async (blob: Blob, type: MediaAttachment['type'], name: string): Promise<MediaAttachment> => {
      const mediaId = `media-${generateUuid()}`;
      const savedMedia = await dbService.saveMedia(mediaId, blob, type, name);
      
      const updatedMediaList = [...rawState.mediaAttachments, savedMedia];
      dispatch({ type: 'SET_MEDIA_ATTACHMENTS', payload: updatedMediaList });
      
      return savedMedia;
    };

    const deleteMedia = async (id: string): Promise<void> => {
      const updatedMediaList = rawState.mediaAttachments.filter(m => m.id !== id);
      dispatch({ type: 'SET_MEDIA_ATTACHMENTS', payload: updatedMediaList });
      await dbService.deleteMedia(id);
    };

    const addAudioNote = async (note: Omit<AudioNote, 'url'>, blob?: Blob): Promise<void> => {
      // Create a temporary object URL if blob is provided, else use empty string
      const url = blob ? URL.createObjectURL(blob) : '';
      const fullNote: AudioNote = {
        ...note,
        url
      };

      const updatedAudioList = [...rawState.audioNotes, fullNote];
      dispatch({ type: 'SET_AUDIO_NOTES', payload: updatedAudioList });
      await dbService.saveAudioNote(fullNote, blob);
    };

    const deleteAudioNote = async (id: string): Promise<void> => {
      const updatedAudioList = rawState.audioNotes.filter(n => n.id !== id);
      dispatch({ type: 'SET_AUDIO_NOTES', payload: updatedAudioList });
      await dbService.deleteAudioNote(id);
    };

    return {
      setActiveView,
      navigateToPage,
      navigateSidebar,
      closeSidebar,
      createPage,
      deletePage,
      addBlock,
      updateBlock,
      deleteBlock,
      indentBlock,
      outdentBlock,
      toggleFavorite,
      updateSettings,
      addMedia,
      deleteMedia,
      addAudioNote,
      deleteAudioNote
    };
  }, [rawState]);

  return (
    <DatabaseContext.Provider value={{ state, loading, actions }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
