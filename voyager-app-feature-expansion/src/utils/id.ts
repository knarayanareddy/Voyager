/**
 * Generates a cryptographically random UUID (v4).
 * Falls back to a Math.random-based approach for
 * environments where crypto.randomUUID is unavailable.
 */
export function genUUID(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Fallback (non-crypto-secure, demo only)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }
  );
}

/** Prefixed ID helpers for each domain entity */
export const genMediaId   = () => `media_${genUUID()}`;
export const genAudioId   = () => `audio_${genUUID()}`;
export const genPageId    = () => `page_${genUUID()}`;
export const genBlockId   = () => `block_${genUUID()}`;
export const genReviewId  = () => `review_${genUUID()}`;
