import { Page, AppSettings, AudioNote, MediaAttachment, CardReview } from '../types';

const DB_NAME = 'voyager_db';
const DB_VERSION = 1;

export class VoyagerDB {
  private db: IDBDatabase | null = null;

  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        
        // Create pages store
        if (!db.objectStoreNames.contains('pages')) {
          db.createObjectStore('pages', { keyPath: 'id' });
        }
        
        // Create media blobs store
        if (!db.objectStoreNames.contains('media_blobs')) {
          db.createObjectStore('media_blobs'); // Keyed by media ID
        }

        // Create media metadata store
        if (!db.objectStoreNames.contains('media_metadata')) {
          db.createObjectStore('media_metadata', { keyPath: 'id' });
        }

        // Create audio notes store
        if (!db.objectStoreNames.contains('audio_notes')) {
          db.createObjectStore('audio_notes', { keyPath: 'id' });
        }

        // Create audio blobs store
        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.createObjectStore('audio_blobs');
        }

        // Create settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        // Create favorites store
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites');
        }

        // Create card reviews store
        if (!db.objectStoreNames.contains('reviews')) {
          db.createObjectStore('reviews', { keyPath: 'id' });
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

  private getStore(name: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(name, mode);
    return transaction.objectStore(name);
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
  async saveMedia(id: string, blob: Blob, type: 'image' | 'audio' | 'video' | 'drawing', name: string): Promise<MediaAttachment> {
    // 1. Save blob to media_blobs
    await new Promise<void>((resolve, reject) => {
      try {
        const store = this.getStore('media_blobs', 'readwrite');
        const request = store.put(blob, id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });

    // 2. Save metadata to media_metadata
    const objectUrl = URL.createObjectURL(blob);
    const metadata: MediaAttachment = {
      id,
      name,
      type,
      url: objectUrl, // This will be dynamic, but we store it
      createdAt: new Date().toISOString(),
      size: blob.size
    };

    await new Promise<void>((resolve, reject) => {
      try {
        const store = this.getStore('media_metadata', 'readwrite');
        const request = store.put(metadata);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });

    return metadata;
  }

  async getMediaBlob(id: string): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('media_blobs', 'readonly');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async deleteMedia(id: string): Promise<void> {
    // Delete blob
    await new Promise<void>((resolve, reject) => {
      try {
        const store = this.getStore('media_blobs', 'readwrite');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });

    // Delete metadata
    await new Promise<void>((resolve, reject) => {
      try {
        const store = this.getStore('media_metadata', 'readwrite');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
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
        item.url = URL.createObjectURL(blob);
        rehydrated.push(item);
      }
    }
    return rehydrated;
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
        note.url = URL.createObjectURL(blob);
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
export const initStorage = async () => {
  await dbService.init();
};
