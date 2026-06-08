/**
 * Backlinks index — maintained incrementally.
 *
 * Structure: { targetPageId → Set<sourcePageId> }
 *
 * Instead of JSON.stringify-scanning every page on every render,
 * we build the index once from the full DB, and expose helpers
 * to update it incrementally when blocks change.
 */

import { Page } from '../types';
import { extractRefs } from '../mockData';

export type BacklinksIndex = Map<string, Set<string>>;

/** Parses all blocks in a page and returns { ref → true } */
function refsFromPage(page: Page): Set<string> {
  const refs = new Set<string>();
  function walk(blocks: Page['blocks']): void {
    for (const b of blocks) {
      for (const r of extractRefs(b.content)) {
        // Normalise to page-id style
        refs.add(r.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
      }
      if (b.children.length) walk(b.children);
    }
  }
  walk(page.blocks);
  return refs;
}

/** Build a full backlinks index from all pages in the DB. */
export function buildBacklinksIndex(db: Record<string, Page>): BacklinksIndex {
  const index: BacklinksIndex = new Map();

  for (const page of Object.values(db)) {
    const refs = refsFromPage(page);
    for (const ref of refs) {
      if (!index.has(ref)) index.set(ref, new Set());
      index.get(ref)!.add(page.id);
    }
  }

  return index;
}

/** Serialise for storage (Map → plain object) */
export function serialiseBacklinks(index: BacklinksIndex): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  index.forEach((sources, target) => {
    out[target] = Array.from(sources);
  });
  return out;
}

/** Deserialise from storage */
export function deserialiseBacklinks(raw: Record<string, string[]>): BacklinksIndex {
  const index: BacklinksIndex = new Map();
  for (const [target, sources] of Object.entries(raw)) {
    index.set(target, new Set(sources));
  }
  return index;
}

/** Get all pages that link TO a given page id */
export function getBacklinksFor(index: BacklinksIndex, pageId: string): string[] {
  return Array.from(index.get(pageId) ?? []);
}

/** Update the backlinks index incrementally when a page is updated or created */
export function updateBacklinksForPage(
  index: BacklinksIndex,
  pageId: string,
  oldPage: Page | undefined,
  newPage: Page
): BacklinksIndex {
  const nextIndex = new Map(index);

  // 1. Remove old references from index
  if (oldPage) {
    const oldRefs = refsFromPage(oldPage);
    for (const ref of oldRefs) {
      const sources = nextIndex.get(ref);
      if (sources) {
        sources.delete(pageId);
        if (sources.size === 0) {
          nextIndex.delete(ref);
        }
      }
    }
  }

  // 2. Add new references to index
  const newRefs = refsFromPage(newPage);
  for (const ref of newRefs) {
    if (!nextIndex.has(ref)) {
      nextIndex.set(ref, new Set());
    }
    nextIndex.get(ref)!.add(pageId);
  }

  return nextIndex;
}
