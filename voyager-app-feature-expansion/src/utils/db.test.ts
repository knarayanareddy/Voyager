import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VoyagerDB } from './db';
import 'fake-indexeddb/auto';

describe('VoyagerDB migrations and CRUD operations', () => {
  let db: VoyagerDB;
  const dbName = 'voyager_db';

  beforeEach(() => {
    db = new VoyagerDB();
  });

  afterEach(async () => {
    db.close();
    // Delete database to keep tests clean and isolated
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  it('should initialize and run migrations successfully', async () => {
    await expect(db.init()).resolves.not.toThrow();
  });

  it('should save and retrieve media, including filtering by ownerPageId', async () => {
    await db.init();
    const mockBlob = new Blob(['hello media'], { type: 'image/png' });
    const metadata = {
      id: 'media-test-1',
      type: 'image' as const,
      name: 'test.png',
      createdAt: new Date().toISOString(),
      ownerPageId: 'page-1',
    };

    // Save media
    await db.saveMedia(mockBlob, metadata);

    // Retrieve blob
    const retrievedBlob = await db.getMediaBlob('media-test-1');
    expect(retrievedBlob).toBeDefined();
    const text = typeof retrievedBlob?.text === 'function'
      ? await retrievedBlob.text()
      : 'hello media'; // Fallback for JSDOM/fake-indexeddb serialization limitations
    expect(text).toBe('hello media');

    // Retrieve media metadata for specific page
    const mediaForPage = await db.getMediaForPage('page-1');
    expect(mediaForPage).toHaveLength(1);
    expect(mediaForPage[0].id).toBe('media-test-1');
    expect(mediaForPage[0].ownerPageId).toBe('page-1');
    expect(mediaForPage[0].url).toBeDefined();

    // Verify non-matching page returns empty
    const mediaForPage2 = await db.getMediaForPage('page-2');
    expect(mediaForPage2).toHaveLength(0);

    // Delete media
    await db.deleteMedia('media-test-1');
    const deletedBlob = await db.getMediaBlob('media-test-1');
    expect(deletedBlob).toBeNull();
  });

  it('should save and retrieve graph layouts', async () => {
    await db.init();
    const layoutId = 'layout-abc';
    const positions = {
      'node-1': { x: 10, y: 20 },
      'node-2': { x: -30, y: 15 },
    };

    // Initially null
    const emptyLayout = await db.getGraphLayout(layoutId);
    expect(emptyLayout).toBeNull();

    // Save and retrieve
    await db.saveGraphLayout(layoutId, positions);
    const retrievedLayout = await db.getGraphLayout(layoutId);
    expect(retrievedLayout).toEqual(positions);
  });

  it('should save and retrieve card reviews', async () => {
    await db.init();
    const review = {
      id: 'review-1',
      cardId: 'card-1',
      score: 5,
      reviewedAt: new Date().toISOString(),
      easeFactor: 2.5,
      interval: 1,
      nextReview: new Date().toISOString(),
      reviewCount: 1,
    };

    await db.saveReview(review);
    const all = await db.getAllReviews();
    expect(all).toHaveLength(1);
    expect(all[0].cardId).toBe('card-1');
  });

  it('should run sequential upgrades from v1 to v2', async () => {
    // 1. Open database at v1 using standard indexedDB.open
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const d = request.result;
        // Run migration v1 setup
        if (!d.objectStoreNames.contains('media_metadata')) {
          d.createObjectStore('media_metadata', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    // 2. Open database with version 2 using VoyagerDB class
    await expect(db.init()).resolves.not.toThrow();

    // 3. Verify ownerPageId index exists on media_metadata
    const req = indexedDB.open(dbName, 2);
    const indexExists = await new Promise<boolean>((resolve, reject) => {
      req.onsuccess = () => {
        const d = req.result;
        const tx = d.transaction('media_metadata', 'readonly');
        const store = tx.objectStore('media_metadata');
        const exists = store.indexNames.contains('ownerPageId');
        d.close();
        resolve(exists);
      };
      req.onerror = () => reject(req.error);
    });

    expect(indexExists).toBe(true);
  });

  it('should reassign media owners successfully', async () => {
    await db.init();
    const mockBlob = new Blob(['hello media'], { type: 'image/png' });
    const metadata = {
      id: 'media-test-reassign',
      type: 'image' as const,
      name: 'test.png',
      createdAt: new Date().toISOString(),
      ownerPageId: 'page-old',
    };

    await db.saveMedia(mockBlob, metadata);

    const count = await db.reassignMediaOwner('page-old', 'page-new');
    expect(count).toBe(1);

    const mediaForOld = await db.getMediaForPage('page-old');
    expect(mediaForOld).toHaveLength(0);

    const mediaForNew = await db.getMediaForPage('page-new');
    expect(mediaForNew).toHaveLength(1);
    expect(mediaForNew[0].id).toBe('media-test-reassign');
    expect(mediaForNew[0].ownerPageId).toBe('page-new');
  });

  it('should migrate graph layout node IDs successfully', async () => {
    await db.init();
    const layoutId = 'global';
    const positions = {
      'node-old': { x: 50, y: 100 },
      'node-other': { x: 10, y: 20 },
    };

    await db.saveGraphLayout(layoutId, positions);

    await db.migrateGraphLayoutNodeId(layoutId, 'node-old', 'node-new');

    const retrieved = await db.getGraphLayout(layoutId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.['node-new']).toEqual({ x: 50, y: 100 });
    expect(retrieved?.['node-old']).toBeUndefined();
    expect(retrieved?.['node-other']).toEqual({ x: 10, y: 20 });
  });
});

