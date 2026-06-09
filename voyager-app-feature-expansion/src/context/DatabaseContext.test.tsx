/* eslint-disable @typescript-eslint/no-explicit-any -- Test context references require loose typing */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { DatabaseProvider, useDatabase } from './DatabaseContext';
import 'fake-indexeddb/auto';

function TestComponent({ onReady }: { onReady: (dbInfo: any) => void }) {
  const context = useDatabase();

  useEffect(() => {
    onReady(context);
  }, [context, onReady]);

  return <div data-testid="test-rendered">Ready</div>;
}

describe('DatabaseContext - RENAME_PAGE action', () => {
  const dbName = 'voyager_db';

  beforeEach(async () => {
    // Delete database to keep tests clean and isolated
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  it('correctly renames a page and rewrites references across other pages', async () => {
    let context: any = null;

    render(
      <DatabaseProvider>
        <TestComponent onReady={(info) => { context = info; }} />
      </DatabaseProvider>
    );

    // Wait for hydration
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(context).not.toBeNull();

    // 1. Create target page to rename
    await act(async () => {
      context.dispatch({ type: 'CREATE_PAGE', name: 'Project Alpha', navigate: true });
    });

    // 2. Create another page linking to the target page
    await act(async () => {
      context.dispatch({ type: 'CREATE_PAGE', name: 'My Notes', navigate: false });
    });

    const notesPageId = 'my-notes';
    const notesPage = context.state.db[notesPageId];
    expect(notesPage).toBeDefined();
    const firstBlockId = notesPage.blocks[0].id;

    // Link in My Notes to Project Alpha
    await act(async () => {
      context.dispatch({
        type: 'UPDATE_BLOCK',
        pageId: notesPageId,
        blockId: firstBlockId,
        content: 'Check [[Project Alpha]] and `[[Project Alpha]]`'
      });
    });

    // 3. Perform rename: Project Alpha -> Project Omega
    await act(async () => {
      context.actions.renamePage('project-alpha', 'Project Omega');
    });

    // 4. Verify rename results
    const state = context.state;

    // The old page ID is gone, the new page ID exists
    expect(state.db['project-alpha']).toBeUndefined();
    expect(state.db['project-omega']).toBeDefined();
    expect(state.db['project-omega'].name).toBe('Project Omega');

    // Title block is updated in Project Omega
    expect(state.db['project-omega'].blocks[0].content).toBe('# Project Omega');

    // Reference in My Notes is rewritten outside of code blocks
    expect(state.db['my-notes'].blocks[0].content).toBe('Check [[Project Omega]] and `[[Project Alpha]]`');

    // Backlinks are updated
    const backlinkPages = context.backlinks.get('project-omega');
    expect(backlinkPages).toBeDefined();
    expect(backlinkPages.has('my-notes')).toBe(true);

    const oldBacklinkPages = context.backlinks.get('project-alpha');
    expect(oldBacklinkPages).toBeUndefined();
  });

  it('correctly persists settings and synchronizes lastOpenedPageId on navigation', async () => {
    let context: any = null;

    const { unmount } = render(
      <DatabaseProvider>
        <TestComponent onReady={(info) => { context = info; }} />
      </DatabaseProvider>
    );

    // Wait for hydration
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(context).not.toBeNull();

    // 1. Verify default settings: alwaysOpenJournal = true, lastOpenedPageId = null/first page
    expect(context.state.settings.alwaysOpenJournal).toBe(true);

    // 2. Create and Navigate to another page (e.g. settings-page)
    await act(async () => {
      context.dispatch({ type: 'CREATE_PAGE', name: 'Settings Page', navigate: true });
    });

    // Verify lastOpenedPageId is updated in state settings
    expect(context.state.currentPageId).toBe('settings-page');
    expect(context.state.settings.lastOpenedPageId).toBe('settings-page');

    // 3. Update alwaysOpenJournal to false
    await act(async () => {
      context.dispatch({
        type: 'UPDATE_SETTINGS',
        settings: { alwaysOpenJournal: false }
      });
    });

    expect(context.state.settings.alwaysOpenJournal).toBe(false);

    // Unmount so we can re-hydrate in a new container
    unmount();

    // 4. Mount again to test hydration
    let context2: any = null;
    render(
      <DatabaseProvider>
        <TestComponent onReady={(info) => { context2 = info; }} />
      </DatabaseProvider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Verify it restored lastOpenedPageId ('settings-page') instead of today's journal
    expect(context2.state.currentPageId).toBe('settings-page');
  });

  it('correctly handles basic block operations (add, update, delete, collapse, status)', async () => {
    let context: any = null;

    render(
      <DatabaseProvider>
        <TestComponent onReady={(info) => { context = info; }} />
      </DatabaseProvider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Create page
    await act(async () => {
      context.dispatch({ type: 'CREATE_PAGE', name: 'Test Page', navigate: true });
    });

    const pageId = 'test-page';
    const firstBlockId = context.state.db[pageId].blocks[0].id;

    // Add block
    await act(async () => {
      context.dispatch({
        type: 'ADD_BLOCK',
        pageId,
        afterBlockId: firstBlockId,
        content: 'New Block Content'
      });
    });

    expect(context.state.db[pageId].blocks).toHaveLength(2);
    const newBlockId = context.state.db[pageId].blocks[1].id;
    expect(context.state.db[pageId].blocks[1].content).toBe('New Block Content');

    // Update block
    await act(async () => {
      context.dispatch({
        type: 'UPDATE_BLOCK',
        pageId,
        blockId: newBlockId,
        content: 'Updated Content'
      });
    });

    expect(context.state.db[pageId].blocks[1].content).toBe('Updated Content');

    // Toggle collapse
    await act(async () => {
      context.dispatch({ type: 'TOGGLE_COLLAPSE', pageId, blockId: firstBlockId });
    });
    expect(context.state.db[pageId].blocks[0].collapsed).toBe(true);

    // Update block status (taskStatus)
    await act(async () => {
      context.dispatch({
        type: 'UPDATE_BLOCK_STATUS',
        pageId,
        blockId: firstBlockId,
        status: 'TODO'
      });
    });
    expect(context.state.db[pageId].blocks[0].taskStatus).toBe('TODO');

    // Delete block
    await act(async () => {
      context.dispatch({
        type: 'DELETE_BLOCK',
        pageId,
        blockId: newBlockId
      });
    });

    expect(context.state.db[pageId].blocks).toHaveLength(1);
  });

  it('correctly handles toggle favorite and active view settings', async () => {
    let context: any = null;

    render(
      <DatabaseProvider>
        <TestComponent onReady={(info) => { context = info; }} />
      </DatabaseProvider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Toggle favorite
    await act(async () => {
      context.dispatch({ type: 'TOGGLE_FAVORITE', pageId: 'project-voyager' });
    });

    // It was in favorites by default, so toggle should remove it
    expect(context.state.favorites).not.toContain('project-voyager');

    // Toggle again to add
    await act(async () => {
      context.dispatch({ type: 'TOGGLE_FAVORITE', pageId: 'project-voyager' });
    });
    expect(context.state.favorites).toContain('project-voyager');

    // Set active view
    await act(async () => {
      context.dispatch({ type: 'SET_ACTIVE_VIEW', view: 'graph' });
    });
    expect(context.state.activeView).toBe('graph');

    // Save review
    const mockReview = {
      id: 'review-x',
      cardId: 'card-x',
      score: 4,
      reviewedAt: new Date().toISOString(),
      easeFactor: 2.5,
      interval: 1,
      nextReview: new Date().toISOString(),
      reviewCount: 1,
    };
    await act(async () => {
      context.dispatch({ type: 'SAVE_REVIEW', review: mockReview });
    });
    expect(context.state.reviews['review-x']).toBeDefined();
  });

  it('correctly handles media operations', async () => {
    let context: any = null;

    render(
      <DatabaseProvider>
        <TestComponent onReady={(info) => { context = info; }} />
      </DatabaseProvider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const mockBlob = new Blob(['img data'], { type: 'image/png' });
    
    // Add media
    let attachment: any = null;
    await act(async () => {
      attachment = await context.actions.addMedia(mockBlob, 'image', 'pic.png');
    });

    expect(attachment).toBeDefined();
    expect(context.state.mediaAttachments).toHaveLength(1);
    expect(context.state.mediaAttachments[0].name).toBe('pic.png');

    // Delete media
    await act(async () => {
      await context.actions.deleteMedia(attachment.id);
    });

    expect(context.state.mediaAttachments).toHaveLength(0);
  });

  it('correctly handles audio note operations', async () => {
    let context: any = null;

    render(
      <DatabaseProvider>
        <TestComponent onReady={(info) => { context = info; }} />
      </DatabaseProvider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const mockNote = {
      id: 'audio-note-1',
      name: 'voice.mp3',
      url: '',
      duration: 120,
      transcription: 'test memo',
      transcriptionStatus: 'done' as const,
      createdAt: new Date().toISOString(),
      waveform: [0.1, 0.2, 0.3],
      cropStart: 0,
      cropEnd: 120
    };

    // Add audio note
    await act(async () => {
      await context.actions.addAudioNote(mockNote);
    });

    expect(context.state.audioNotes).toHaveLength(1);
    expect(context.state.audioNotes[0].transcription).toBe('test memo');

    // Update audio note
    await act(async () => {
      await context.actions.updateAudioNote({
        ...mockNote,
        transcription: 'updated transcription'
      });
    });

    expect(context.state.audioNotes[0].transcription).toBe('updated transcription');

    // Delete audio note
    await act(async () => {
      await context.actions.deleteAudioNote('audio-note-1');
    });

    expect(context.state.audioNotes).toHaveLength(0);
  });
});
