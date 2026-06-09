import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useDatabase } from './DatabaseContext';
import { dbService } from '../utils/db';
import { genUUID } from '../utils/id';
import { BrowserTab, BrowserHistoryEntry, BrowserBookmark, WebClip } from '../types';
import { getTodayJournalId } from '../mockData';

export function normalizeInputToUrl(
  input: string,
  searchEngineSetting: 'none' | 'duckduckgo' | 'google' | 'custom',
  customSearchUrl?: string
): string {
  const trimmed = input.trim();
  if (!trimmed) return 'about:blank';

  if (/^(https?:\/\/|about:|file:\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  // Check if it looks like a domain name
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i;
  if (domainRegex.test(trimmed)) {
    return 'https://' + trimmed;
  }

  // It is a search query
  if (searchEngineSetting === 'none') {
    return 'https://' + trimmed;
  } else if (searchEngineSetting === 'duckduckgo') {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  } else if (searchEngineSetting === 'google') {
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  } else if (searchEngineSetting === 'custom' && customSearchUrl) {
    return customSearchUrl.replace('%s', encodeURIComponent(trimmed));
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}

function findLastBlockId(blocks: any[]): string {
  if (blocks.length === 0) return '';
  const last = blocks[blocks.length - 1];
  if (last.children && last.children.length > 0) {
    return findLastBlockId(last.children);
  }
  return last.id;
}

interface BrowserContextType {
  currentUrl: string;
  tabs: BrowserTab[];
  activeTab: BrowserTab | undefined;
  activeTabId: string;
  history: BrowserHistoryEntry[];
  bookmarks: BrowserBookmark[];
  clips: WebClip[];
  loading: boolean;
  navigate: (url: string) => void;
  openInNewTab: (url: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  toggleBookmark: (url: string, title?: string) => Promise<void>;
  addClipToVoyagerNotes: (
    clip: WebClip,
    target: { pageId: string; mode: 'appendToJournal' | 'newPage' }
  ) => Promise<void>;
  clearHistory: () => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  deleteClip: (id: string) => Promise<void>;
}

const BrowserContext = createContext<BrowserContextType | undefined>(undefined);

export function BrowserProvider({ children }: { children: React.ReactNode }) {
  const { state: dbState, dispatch: dbDispatch, getOrCreatePage } = useDatabase();

  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [history, setHistory] = useState<BrowserHistoryEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([]);
  const [clips, setClips] = useState<WebClip[]>([]);
  const [loading] = useState<boolean>(false);

  // Initialize data from DB
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [loadedBookmarks, loadedHistory, loadedClips] = await Promise.all([
          dbService.getBookmarks(),
          dbService.getHistory(),
          dbService.getClips(),
        ]);
        if (active) {
          setBookmarks(loadedBookmarks);
          setHistory(loadedHistory);
          setClips(loadedClips);
        }
      } catch (err) {
        console.error('Failed to load browser data:', err);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, []);

  // Guarantee at least one default tab
  useEffect(() => {
    if (tabs.length === 0) {
      const initialTab: BrowserTab = {
        id: genUUID(),
        url: 'https://duckduckgo.com',
        title: 'DuckDuckGo',
        createdAt: new Date().toISOString(),
        lastVisitedAt: new Date().toISOString(),
      };
      setTabs([initialTab]);
      setActiveTabId(initialTab.id);
    }
  }, [tabs]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const currentUrl = activeTab ? activeTab.url : 'about:blank';

  const navigate = useCallback((inputUrl: string) => {
    if (!activeTabId) return;

    const engine = dbState.settings.browserSearchEngine || 'duckduckgo';
    const customUrl = dbState.settings.browserCustomSearchUrl;
    const normalizedUrl = normalizeInputToUrl(inputUrl, engine, customUrl);

    let parsedTitle = normalizedUrl;
    try {
      const urlObj = new URL(normalizedUrl);
      parsedTitle = urlObj.hostname;
    } catch {
      // ignore
    }

    setTabs(prev =>
      prev.map(t =>
        t.id === activeTabId
          ? {
              ...t,
              url: normalizedUrl,
              title: parsedTitle,
              lastVisitedAt: new Date().toISOString(),
            }
          : t
      )
    );

    // Save to history if enabled
    if (dbState.settings.browserPersistHistory) {
      const newEntry: BrowserHistoryEntry = {
        id: genUUID(),
        url: normalizedUrl,
        title: parsedTitle,
        visitedAt: new Date().toISOString(),
      };
      dbService.addHistoryEntry(newEntry).then(() => {
        setHistory(prev => [newEntry, ...prev].slice(0, 500));
      }).catch(err => {
        console.error('Failed to save history entry:', err);
      });
    }
  }, [activeTabId, dbState.settings.browserSearchEngine, dbState.settings.browserCustomSearchUrl, dbState.settings.browserPersistHistory]);

  const openInNewTab = useCallback((url: string): string => {
    const newTabId = genUUID();
    let parsedTitle = url;
    try {
      parsedTitle = new URL(url).hostname;
    } catch {
      // ignore
    }

    const newTab: BrowserTab = {
      id: newTabId,
      url,
      title: parsedTitle,
      createdAt: new Date().toISOString(),
      lastVisitedAt: new Date().toISOString(),
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
    return newTabId;
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (filtered.length === 0) return prev; // keep at least one

      if (activeTabId === tabId) {
        // Find next closest tab to activate
        const oldIndex = prev.findIndex(t => t.id === tabId);
        const nextActive = filtered[oldIndex] || filtered[filtered.length - 1];
        setActiveTabId(nextActive.id);
      }
      return filtered;
    });
  }, [activeTabId]);

  const toggleBookmark = useCallback(async (url: string, title?: string) => {
    const existing = bookmarks.find(b => b.url === url);
    if (existing) {
      try {
        await dbService.deleteBookmark(existing.id);
        setBookmarks(prev => prev.filter(b => b.id !== existing.id));
      } catch (err) {
        console.error('Failed to delete bookmark:', err);
      }
    } else {
      let parsedTitle = title || url;
      if (!title) {
        try {
          parsedTitle = new URL(url).hostname;
        } catch {
          // ignore
        }
      }
      const newBookmark: BrowserBookmark = {
        id: genUUID(),
        url,
        title: parsedTitle,
        createdAt: new Date().toISOString(),
      };
      try {
        await dbService.addBookmark(newBookmark);
        setBookmarks(prev => [...prev, newBookmark]);
      } catch (err) {
        console.error('Failed to add bookmark:', err);
      }
    }
  }, [bookmarks]);

  const addClipToVoyagerNotes = useCallback(async (
    clip: WebClip,
    target: { pageId: string; mode: 'appendToJournal' | 'newPage' }
  ) => {
    let targetPageId = target.pageId;

    if (target.mode === 'appendToJournal') {
      targetPageId = getTodayJournalId();
    } else if (target.mode === 'newPage') {
      targetPageId = getOrCreatePage(clip.title || 'Web Clip');
    }

    const page = dbState.db[targetPageId];
    if (!page) return;

    const blockId = genUUID();
    const clipTitle = clip.title || clip.url;
    let blockContent = `[${clipTitle}](${clip.url})`;
    if (clip.excerpt) {
      blockContent += `\n> ${clip.excerpt}`;
    }

    const lastBlockId = findLastBlockId(page.blocks);
    
    // Add block via DB Reducer Action
    dbDispatch({
      type: 'ADD_BLOCK',
      pageId: targetPageId,
      afterBlockId: lastBlockId,
      content: blockContent,
    });

    const persistedClip: WebClip = {
      ...clip,
      pageId: targetPageId,
      blockId,
      createdAt: new Date().toISOString(),
    };

    try {
      await dbService.saveClip(persistedClip);
      setClips(prev => [persistedClip, ...prev]);
    } catch (err) {
      console.error('Failed to save clip metadata:', err);
    }
  }, [dbDispatch, dbState.db, getOrCreatePage]);

  const clearHistory = useCallback(async () => {
    try {
      await dbService.clearHistory();
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }, []);

  const deleteBookmark = useCallback(async (id: string) => {
    try {
      await dbService.deleteBookmark(id);
      setBookmarks(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error('Failed to delete bookmark:', err);
    }
  }, []);

  const deleteClip = useCallback(async (id: string) => {
    try {
      await dbService.deleteClip(id);
      setClips(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete clip:', err);
    }
  }, []);

  return (
    <BrowserContext.Provider
      value={{
        currentUrl,
        tabs,
        activeTab,
        activeTabId,
        history,
        bookmarks,
        clips,
        loading,
        navigate,
        openInNewTab,
        closeTab,
        setActiveTabId,
        toggleBookmark,
        addClipToVoyagerNotes,
        clearHistory,
        deleteBookmark,
        deleteClip,
      }}
    >
      {children}
    </BrowserContext.Provider>
  );
}

export function useBrowser() {
  const context = useContext(BrowserContext);
  if (!context) {
    throw new Error('useBrowser must be used within a BrowserProvider');
  }
  return context;
}
