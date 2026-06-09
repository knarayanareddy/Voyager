/**
 * Core content parsing utilities for Voyager block content.
 * Used by: backlinks indexing, graph edge extraction, search, export.
 */

/** Matches [[Page Name]] wikilinks */
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/** Matches #tag tokens (not inside wikilinks or code) */
const TAG_RE = /(?<!\[)#([a-zA-Z0-9_/-]+)/g;

/**
 * Strips all fenced code blocks (both backtick and tilde)
 * from a content string before link/tag extraction.
 * Replaces fenced/code parts with spaces of the same length
 * to preserve character offsets for MarkdownRenderer matching.
 */
export function stripCodeFences(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length))   // backtick fences
    .replace(/~~~[\s\S]*?~~~/g, (m) => ' '.repeat(m.length))   // tilde fences
    .replace(/`[^`]+`/g, (m) => ' '.repeat(m.length));         // inline single backticks
}

/**
 * Extracts normalized page references from a block's content string.
 * Skips content inside code fences.
 * Returns lowercased, hyphenated refs matching page-id style.
 */
export function extractRefs(content: string): string[] {
  const clean = stripCodeFences(content);
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;

  while ((match = WIKILINK_RE.exec(clean)) !== null) {
    refs.push(normalizeRef(match[1]));
  }

  return refs;
}

/**
 * Extracts #tag tokens from a block's content string.
 */
export function extractTags(content: string): string[] {
  const clean = stripCodeFences(content);
  const tags: string[] = [];
  let match: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;

  while ((match = TAG_RE.exec(clean)) !== null) {
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

/**
 * Rewrites references to a page in a block's content string.
 * Skips references inside code fences. Case-insensitive matching.
 */
export function rewriteRefs(content: string, oldName: string, newName: string): string {
  const escapedOldName = oldName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const combinedRegex = new RegExp(
    "(```[\\s\\S]*?```|~~~[\\s\\S]*?~~~|`[^`]+`)|(\\[\\[\\s*" + escapedOldName + "\\s*\\]\\])",
    'gi'
  );

  return content.replace(combinedRegex, (_match, codePart, _wikilinkPart) => {
    if (codePart) {
      return codePart;
    }
    return `[[${newName}]]`;
  });
}
