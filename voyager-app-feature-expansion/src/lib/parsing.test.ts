import { describe, it, expect } from 'vitest';
import { extractRefs, extractTags, normalizeRef } from './parsing';

describe('extractRefs', () => {
  it('extracts a single wikilink', () => {
    expect(extractRefs('See [[Project Alpha]]')).toEqual(['project-alpha']);
  });

  it('extracts multiple wikilinks', () => {
    expect(extractRefs('[[A]] and [[B]]')).toEqual(['a', 'b']);
  });

  it('returns empty for content with no links', () => {
    expect(extractRefs('Just plain text')).toEqual([]);
  });

  it('does not extract links from code fence lines', () => {
    expect(extractRefs('```[[Not A Link]]```')).toEqual([]);
  });

  it('normalizes refs consistently with page IDs', () => {
    expect(extractRefs('[[My Project Name]]')).toEqual(['my-project-name']);
  });
});

describe('extractTags', () => {
  it('extracts a single tag', () => {
    expect(extractTags('Hello #world')).toEqual(['world']);
  });

  it('extracts multiple tags', () => {
    expect(extractTags('#todo and #card')).toEqual(['todo', 'card']);
  });

  it('does not extract tags from code fences', () => {
    expect(extractTags('```#not-a-tag```')).toEqual([]);
  });
});

describe('normalizeRef', () => {
  it('lowercases and hyphenates', () => {
    expect(normalizeRef('My Project')).toBe('my-project');
  });

  it('strips special characters', () => {
    expect(normalizeRef('Hello! World?')).toBe('hello-world');
  });

  it('trims whitespace', () => {
    expect(normalizeRef('  spaces  ')).toBe('spaces');
  });
});
