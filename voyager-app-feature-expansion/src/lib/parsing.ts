/**
 * Core content parsing utilities for Voyager block content.
 * Used by: backlinks indexing, graph edge extraction, search, export.
 */

/** Matches [[Page Name]] wikilinks */
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/** Matches #tag tokens (not inside wikilinks or code) */
const TAG_RE = /(?<!\[)#([a-zA-Z0-9_/-]+)/g;

/** Matches opening ``` fences */
const CODE_FENCE_RE = /^```/;

/**
 * Extracts normalized page references from a block's content string.
 * Skips content inside code fences.
 * Returns lowercased, hyphenated refs matching page-id style.
 */
export function extractRefs(content: string): string[] {
  if (CODE_FENCE_RE.test(content.trim())) return [];

  const refs: string[] = [];
  let match: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;

  while ((match = WIKILINK_RE.exec(content)) !== null) {
    refs.push(normalizeRef(match[1]));
  }

  return refs;
}

/**
 * Extracts #tag tokens from a block's content string.
 */
export function extractTags(content: string): string[] {
  if (CODE_FENCE_RE.test(content.trim())) return [];

  const tags: string[] = [];
  let match: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;

  while ((match = TAG_RE.exec(content)) !== null) {
    tags.push(match[1].toLowerCase());
  }

  return tags;
}

/**
 * Normalizes a wikilink target to page-id style.
 * e.g. "My Project" → "my-project"
 */
export function normalizeRef(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
