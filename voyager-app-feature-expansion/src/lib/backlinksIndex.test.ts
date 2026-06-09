import { describe, it, expect } from 'vitest';
import {
  buildBacklinksIndex,
  updateBacklinksForPage,
  serialiseBacklinks,
  deserialiseBacklinks
} from './backlinksIndex';
import { Page, Block } from '../types';

function makeMockPage(id: string, name: string, content: string): Page {
  return {
    id,
    name,
    blocks: [{
      id: 'b1',
      uuid: 'uuid-1',
      content,
      children: [],
      collapsed: false,
      taskStatus: null,
      properties: {},
      refs: []
    } as Block],
    isJournal: false,
    createdAt: '',
    updatedAt: '',
    properties: {},
    tags: []
  };
}

describe('backlinksIndex', () => {
  it('builds index correctly from db', () => {
    const db: Record<string, Page> = {
      'page-a': makeMockPage('page-a', 'Page A', 'This links to [[Page B]]'),
      'page-b': makeMockPage('page-b', 'Page B', 'Hello world')
    };

    const index = buildBacklinksIndex(db);
    expect(index.get('page-b')?.has('page-a')).toBe(true);
    expect(index.get('page-a')).toBeUndefined();
  });

  it('updates index when page is modified', () => {
    const db: Record<string, Page> = {
      'page-a': makeMockPage('page-a', 'Page A', 'This links to [[Page B]]'),
    };
    let index = buildBacklinksIndex(db);
    
    // Modify Page A to link to Page C instead
    const newPageA = makeMockPage('page-a', 'Page A', 'This links to [[Page C]]');
    index = updateBacklinksForPage(index, 'page-a', db['page-a'], newPageA);
    
    expect(index.get('page-b')).toBeUndefined(); 
    expect(index.get('page-c')?.has('page-a')).toBe(true);
  });

  it('serialises and deserialises correctly', () => {
    const index = new Map([
      ['page-b', new Set(['page-a'])]
    ]);
    const raw = serialiseBacklinks(index);
    expect(raw).toEqual({ 'page-b': ['page-a'] });

    const restored = deserialiseBacklinks(raw);
    expect(restored.get('page-b')?.has('page-a')).toBe(true);
  });
});
