import { describe, it, expect } from 'vitest';
import { extractRefs, extractTags, normalizeRef, stripCodeFences, rewriteRefs } from './parsing';

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

describe('stripCodeFences', () => {
  it('strips backtick fenced blocks', () => {
    expect(stripCodeFences('before ```[[link]]``` after'))
      .not.toContain('[[link]]');
  });

  it('strips tilde fenced blocks', () => {
    expect(stripCodeFences('~~~[[link]]~~~'))
      .not.toContain('[[link]]');
  });

  it('strips inline single backticks', () => {
    expect(stripCodeFences('text `[[link]]` more'))
      .not.toContain('[[link]]');
  });

  it('preserves content outside fences', () => {
    const result = stripCodeFences('[[Keep]] and ```[[Drop]]```');
    expect(result).toContain('[[Keep]]');
    expect(result).not.toContain('[[Drop]]');
  });
});

describe('extractRefs with code fences', () => {
  it('does not extract links from inline backtick fences', () => {
    expect(extractRefs('text `[[Not A Link]]` more')).toEqual([]);
  });

  it('does not extract links from multi-line fences', () => {
    expect(extractRefs('```\n[[Not A Link]]\n```')).toEqual([]);
  });

  it('still extracts links outside fences', () => {
    expect(extractRefs('[[Real Link]] and `[[Fake]]`'))
      .toEqual(['real-link']);
  });
});

describe('rewriteRefs', () => {
  it('rewrites matching references case-insensitively', () => {
    expect(rewriteRefs('See [[Old Name]]', 'Old Name', 'New Name')).toBe('See [[New Name]]');
    expect(rewriteRefs('See [[old name]]', 'Old Name', 'New Name')).toBe('See [[New Name]]');
  });

  it('ignores matching references inside inline code or fences', () => {
    expect(rewriteRefs('Code `[[Old Name]]`', 'Old Name', 'New Name')).toBe('Code `[[Old Name]]`');
    expect(rewriteRefs('```\n[[Old Name]]\n```', 'Old Name', 'New Name')).toBe('```\n[[Old Name]]\n```');
  });

  it('rewrites outside fences while leaving inside fences intact', () => {
    expect(
      rewriteRefs('Link [[Old Name]] and code `[[Old Name]]`', 'Old Name', 'New Name')
    ).toBe('Link [[New Name]] and code `[[Old Name]]`');
  });
});
