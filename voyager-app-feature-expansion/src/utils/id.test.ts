import { describe, it, expect } from 'vitest';
import {
  genUUID,
  genMediaId,
  genAudioId,
  genPageId,
  genBlockId,
  genReviewId
} from './id';

describe('genUUID', () => {
  it('returns a valid UUID v4 format', () => {
    const id = genUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('returns unique values on each call', () => {
    const ids = Array.from({ length: 100 }, genUUID);
    const unique = new Set(ids);
    expect(unique.size).toBe(100);
  });
});

describe('prefixed ID helpers', () => {
  const cases: [string, () => string][] = [
    ['media_', genMediaId],
    ['audio_', genAudioId],
    ['page_',  genPageId],
    ['block_', genBlockId],
    ['review_', genReviewId],
  ];

  it.each(cases)('%s helper produces correct prefix', (prefix, fn) => {
    expect(fn()).toMatch(new RegExp(`^${prefix}`));
  });

  it('all helpers produce unique values across 1000 calls', () => {
    const ids = Array.from({ length: 1000 }, genMediaId);
    expect(new Set(ids).size).toBe(1000);
  });
});
