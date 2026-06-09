import { describe, it, expect } from 'vitest';
import { extractEdgesFromPage } from './GraphView';

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
