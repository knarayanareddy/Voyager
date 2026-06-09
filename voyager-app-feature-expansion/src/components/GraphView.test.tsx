/* eslint-disable @typescript-eslint/no-explicit-any -- Test mock objects require loose typing */
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GraphView, { extractEdgesFromPage } from './GraphView';
import * as DatabaseContextModule from '../context/DatabaseContext';
import { dbService } from '../utils/db';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

describe('extractEdgesFromPage', () => {
  it('extracts direct wikilinks from blocks', () => {
    const page = {
      blocks: [
        { content: 'See [[Project Alpha]]', children: [] },
        { content: 'Also [[Project Beta]]', children: [] }
      ]
    } as any;
    const pageIdByName = new Map([
      ['project alpha', 'page_1'],
      ['project beta', 'page_2']
    ]);
    const edges = extractEdgesFromPage(page, pageIdByName);
    expect(edges).toContain('page_1');
    expect(edges).toContain('page_2');
  });

  it('extracts wikilinks from nested children', () => {
    const page = {
      blocks: [{
        content: 'Top level',
        children: [
          { content: '[[Nested Link]]', children: [] }
        ]
      }]
    } as any;
    const pageIdByName = new Map([['nested link', 'page_3']]);
    const edges = extractEdgesFromPage(page, pageIdByName);
    expect(edges).toContain('page_3');
  });

  it('does not extract links from code blocks', () => {
    const page = {
      blocks: [
        { content: '```\n[[Not A Link]]\n```', children: [] }
      ]
    } as any;
    const pageIdByName = new Map([['not a link', 'page_4']]);
    const edges = extractEdgesFromPage(page, pageIdByName);
    expect(edges).not.toContain('page_4');
  });
});

describe('GraphView Component', () => {
  beforeEach(() => {
    // Mock requestAnimationFrame to avoid stack overflow recursion
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(cb, 10) as any;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderGraphView = () => {
    vi.spyOn(DatabaseContextModule, 'useDatabase').mockReturnValue({
      state: {
        db: {
          'page-1': { id: 'page-1', name: 'Page A', blocks: [], isJournal: false, createdAt: '', updatedAt: '', properties: {}, tags: [], mediaAttachments: [] },
        },
        currentPageId: 'page-1',
        settings: {},
      } as any,
      dispatch: vi.fn(),
      navigateTo: vi.fn(),
      getOrCreatePage: vi.fn(),
      backlinks: new Map(),
      loading: false,
      actions: {},
    } as any);

    return render(<GraphView />);
  };

  it('stabilizes node coordinates and gates saves using signature hashing', async () => {
    const originalGetGraphLayout = dbService.getGraphLayout;
    const originalSaveGraphLayout = dbService.saveGraphLayout;

    const getLayoutSpy = vi.fn().mockResolvedValue({
      'page-1': { x: 160, y: 200 },
    });
    const saveLayoutSpy = vi.fn().mockResolvedValue(undefined);

    dbService.getGraphLayout = getLayoutSpy;
    dbService.saveGraphLayout = saveLayoutSpy;

    const { unmount } = renderGraphView();

    // Wait for the async dbService.getGraphLayout call to complete and trigger layout stabilization / saveGraphLayout
    const start = Date.now();
    while (saveLayoutSpy.mock.calls.length === 0) {
      if (Date.now() - start > 1000) {
        throw new Error('Timed out waiting for saveGraphLayout to be called');
      }
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }

    expect(getLayoutSpy).toHaveBeenCalledWith('global');

    // First save is expected on initial stabilization
    expect(saveLayoutSpy).toHaveBeenCalledTimes(1);
    expect(saveLayoutSpy.mock.calls[0][0]).toBe('global');
    expect(saveLayoutSpy.mock.calls[0][1]).toEqual({
      'page-1': { x: 160, y: 200 },
    });

    // Reset saveSpy calls count
    saveLayoutSpy.mockClear();

    // Trigger another render cycle or physics frame tick
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Since signature remains identical, saveGraphLayout should NOT be called again
    expect(saveLayoutSpy).not.toHaveBeenCalled();

    // Cleanup animation loop to prevent leak
    unmount();

    // Restore original methods
    dbService.getGraphLayout = originalGetGraphLayout;
    dbService.saveGraphLayout = originalSaveGraphLayout;
  });
});
