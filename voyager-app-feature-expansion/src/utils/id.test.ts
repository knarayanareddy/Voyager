import { describe, it, expect } from 'vitest';
import { genUUID, genMediaId, genAudioId } from './id';

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
  it('genMediaId starts with media_', () => {
    expect(genMediaId()).toMatch(/^media_/);
  });

  it('genAudioId starts with audio_', () => {
    expect(genAudioId()).toMatch(/^audio_/);
  });
});
