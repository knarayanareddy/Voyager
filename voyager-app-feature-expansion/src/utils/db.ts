import { Page, AppSettings, AudioNote, MediaAttachment, CardReview } from '../types';

const DB_NAME = 'voyager_db';
const DB_VERSION = 2;

/**
 * Migration map: each key is a schema version,
 * each value is the upgrade function to reach that version.
 * IMPORTANT: migrations must be additive and forward-only.
 */
const MIGRATIONS: Record<number, (
  db: IDBDatabase,
  tx: IDBTransaction
) => void> = {

  1: (db) => {
    // Pages
    if (!db.objectStoreNames.contains('pages')) {
      db.createObjectStore('pages', { keyPath: 'id' });
    }
    // Media
    if (!db.objectStoreNames.contains('media_blobs')) {
      db.createObjectStore('media_blobs'); // Keyed by media ID
    }
    if (!db.objectStoreNames.contains('media_metadata')) {
      db.createObjectStore('media_metadata', { keyPath: 'id' });
    }
    // Audio
    if (!db.objectStoreNames.contains('audio_blobs')) {
      db.createObjectStore('audio_blobs');
    }
    if (!db.objectStoreNames.contains('audio_notes')) {
      db.createObjectStore('audio_notes', { keyPath: 'id' });
    }
    // Settings / favorites / reviews
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings');
    }
    if (!db.objectStoreNames.contains('favorites')) {
      db.createObjectStore('favorites');
    }
    if (!db.objectStoreNames.contains('reviews')) {
      db.createObjectStore('reviews', { keyPath: 'id' });
    }
  },

  2: (db, tx) => {
    // Media index for ownerPageId
    if (db.objectStoreNames.contains('media_metadata')) {
      const store = tx.objectStore('media_metadata');
      if (!store.indexNames.contains('ownerPageId')) {
        store.createIndex('ownerPageId', 'ownerPageId', { unique: false });
      }
    }
    // Graph layout store (for Issue #15)
    if (!db.objectStoreNames.contains('graph_layout')) {
      db.createObjectStore('graph_layout', { keyPath: 'id' });
    }
  },
};

export class VoyagerDB {
  private db: IDBDatabase | null = null;

  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const tx = (event.target as IDBOpenDBRequest).transaction!;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion ?? DB_VERSION;

        for (let v = oldVersion + 1; v <= newVersion; v++) {
          const migrate = MIGRATIONS[v];
          if (migrate) {
            console.info(`[VoyagerDB] running migration to v${v}`);
            migrate(db, tx);
          } else {
            console.warn(`[VoyagerDB] no migration defined for v${v}`);
          }
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private getStore(name: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(name, mode);
    return transaction.objectStore(name);
  }

  /**
   * Opens a single IDBTransaction spanning multiple stores.
   * All reads/writes within the returned stores share the same
   * transaction and commit atomically.
   */
  private getMultiStoreTransaction(
    storeNames: string[],
    mode: IDBTransactionMode
  ): { tx: IDBTransaction; stores: Record<string, IDBObjectStore> } {
    const tx = this.db!.transaction(storeNames, mode);
    const stores: Record<string, IDBObjectStore> = {};
    for (const name of storeNames) {
      stores[name] = tx.objectStore(name);
    }
    return { tx, stores };
  }

  // --- Pages Storage ---
  async savePage(page: Page): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('pages', 'readwrite');
        const request = store.put(page);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async deletePage(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('pages', 'readwrite');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getAllPages(): Promise<Page[]> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('pages', 'readonly');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // --- Settings Storage ---
  async saveSettings(settings: AppSettings): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('settings', 'readwrite');
        const request = store.put(settings, 'app_settings');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getSettings(): Promise<AppSettings | null> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('settings', 'readonly');
        const request = store.get('app_settings');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // --- Favorites Storage ---
  async saveFavorites(favorites: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('favorites', 'readwrite');
        const request = store.put(favorites, 'user_favorites');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getFavorites(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('favorites', 'readonly');
        const request = store.get('user_favorites');
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // --- Media Storage (Binary Blobs) ---
  async saveMedia(
    blob: Blob,
    metadata: Omit<MediaAttachment, 'url'>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const { tx, stores } = this.getMultiStoreTransaction(
        ['media_blobs', 'media_metadata'],
        'readwrite'
      );

      tx.oncomplete = () => resolve();
      tx.onerror   = () => reject(tx.error);
      tx.onabort   = () => reject(new Error('saveMedia transaction aborted'));

      stores['media_blobs'].put({ id: metadata.id, blob }, metadata.id);
      stores['media_metadata'].put(metadata); // no url field — see Issue #7
    });
  }

  async getMediaBlob(id: string): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('media_blobs', 'readonly');
        const request = store.get(id);
        request.onsuccess = () => {
          const res = request.result;
          if (res && typeof res === 'object' && 'blob' in res) {
            resolve((res as { blob: Blob }).blob || null);
          } else {
            resolve((res as Blob) || null);
          }
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async deleteMedia(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { tx, stores } = this.getMultiStoreTransaction(
        ['media_blobs', 'media_metadata'],
        'readwrite'
      );

      tx.oncomplete = () => resolve();
      tx.onerror   = () => reject(tx.error);
      tx.onabort   = () => reject(new Error('deleteMedia transaction aborted'));

      stores['media_blobs'].delete(id);
      stores['media_metadata'].delete(id);
    });
  }

  async getAllMedia(): Promise<MediaAttachment[]> {
    const metadataList = await new Promise<MediaAttachment[]>((resolve, reject) => {
      try {
        const store = this.getStore('media_metadata', 'readonly');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });

    // Rehydrate Blob URLs
    const rehydrated: MediaAttachment[] = [];
    for (const item of metadataList) {
      const blob = await this.getMediaBlob(item.id);
      if (blob) {
        const objectUrl = createMediaUrl(blob);
        rehydrated.push({ ...item, url: objectUrl });
      }
    }
    return rehydrated;
  }

  async getMediaForPage(pageId: string): Promise<MediaAttachment[]> {
    const metadataList = await new Promise<MediaAttachment[]>((resolve, reject) => {
      try {
        const store = this.getStore('media_metadata', 'readonly');
        const index = store.index('ownerPageId');
        const request = index.getAll(pageId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });

    const rehydrated: MediaAttachment[] = [];
    for (const item of metadataList) {
      const blob = await this.getMediaBlob(item.id);
      if (blob) {
        const objectUrl = createMediaUrl(blob);
        rehydrated.push({ ...item, url: objectUrl });
      }
    }
    return rehydrated;
  }

  async reassignMediaOwner(oldPageId: string, newPageId: string): Promise<number> {
    const { tx, stores } = this.getMultiStoreTransaction(['media_metadata'], 'readwrite');
    const store = stores['media_metadata'];
    const index = store.index('ownerPageId');

    const items = await new Promise<MediaAttachment[]>((resolve, reject) => {
      const request = index.getAll(oldPageId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    for (const item of items) {
      store.put({ ...item, ownerPageId: newPageId });
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return items.length;
  }


  // --- Graph Layout Storage ---
  async saveGraphLayout(
    layoutId: string,
    positions: Record<string, { x: number; y: number }>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('graph_layout', 'readwrite');
        const request = store.put({ id: layoutId, positions });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getGraphLayout(
    layoutId: string
  ): Promise<Record<string, { x: number; y: number }> | null> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('graph_layout', 'readonly');
        const request = store.get(layoutId);
        request.onsuccess = () => {
          const res = request.result;
          resolve(res ? res.positions : null);
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async migrateGraphLayoutNodeId(
    layoutId: string,
    oldId: string,
    newId: string
  ): Promise<void> {
    const positions = await this.getGraphLayout(layoutId);
    if (positions && positions[oldId]) {
      const updated = { ...positions };
      updated[newId] = updated[oldId];
      delete updated[oldId];
      await this.saveGraphLayout(layoutId, updated);
    }
  }


  // --- Audio Notes Storage ---
  async saveAudioNote(note: AudioNote, blob?: Blob): Promise<void> {
    // Save metadata
    await new Promise<void>((resolve, reject) => {
      try {
        const store = this.getStore('audio_notes', 'readwrite');
        const request = store.put(note);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });

    // Save blob if provided
    if (blob) {
      await new Promise<void>((resolve, reject) => {
        try {
          const store = this.getStore('audio_blobs', 'readwrite');
          const request = store.put(blob, note.id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } catch (err) {
          reject(err);
        }
      });
    }
  }

  async getAudioBlob(id: string): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('audio_blobs', 'readonly');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async deleteAudioNote(id: string): Promise<void> {
    // Delete metadata
    await new Promise<void>((resolve, reject) => {
      try {
        const store = this.getStore('audio_notes', 'readwrite');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });

    // Delete blob
    await new Promise<void>((resolve, reject) => {
      try {
        const store = this.getStore('audio_blobs', 'readwrite');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getAllAudioNotes(): Promise<AudioNote[]> {
    const notesList = await new Promise<AudioNote[]>((resolve, reject) => {
      try {
        const store = this.getStore('audio_notes', 'readonly');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });

    const rehydrated: AudioNote[] = [];
    for (const note of notesList) {
      const blob = await this.getAudioBlob(note.id);
      if (blob) {
        note.url = createMediaUrl(blob);
      }
      rehydrated.push(note);
    }
    return rehydrated;
  }

  // --- Reviews Storage ---
  async saveReview(review: CardReview): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('reviews', 'readwrite');
        const request = store.put(review);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getAllReviews(): Promise<CardReview[]> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('reviews', 'readonly');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }
}

// Global DB instance
export const dbService = new VoyagerDB();

const createdUrls = new Set<string>();

export function createMediaUrl(blob: Blob): string {
  if (!(blob instanceof Blob)) {
    return `voyager://media/mock-url-${Math.random().toString(36).substring(7)}`;
  }
  const url = URL.createObjectURL(blob);
  createdUrls.add(url);
  return url;
}

export function revokeMediaUrl(url: string): void {
  try {
    URL.revokeObjectURL(url);
    createdUrls.delete(url);
  } catch (e) {
    console.error('Failed to revoke object URL', e);
  }
}

export function cleanupObjectUrls(): void {
  createdUrls.forEach(url => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to revoke object URL', e);
    }
  });
  createdUrls.clear();
}

export const initStorage = async () => {
  await dbService.init();
};
