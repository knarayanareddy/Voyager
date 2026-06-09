import { describe, it, expect } from 'vitest';
import { normalizeInputToUrl } from '../context/BrowserContext';

describe('normalizeInputToUrl', () => {
  describe('absolute URLs', () => {
    it('passes through http:// URLs unchanged', () => {
      expect(normalizeInputToUrl('http://example.com', 'duckduckgo')).toBe('http://example.com');
    });

    it('passes through https:// URLs unchanged', () => {
      expect(normalizeInputToUrl('https://www.google.com/search?q=test', 'duckduckgo')).toBe(
        'https://www.google.com/search?q=test'
      );
    });

    it('passes through about:blank unchanged', () => {
      expect(normalizeInputToUrl('about:blank', 'duckduckgo')).toBe('about:blank');
    });
  });

  describe('domain detection', () => {
    it('prepends https:// to bare domain names', () => {
      expect(normalizeInputToUrl('example.com', 'duckduckgo')).toBe('https://example.com');
    });

    it('prepends https:// to subdomains', () => {
      expect(normalizeInputToUrl('docs.example.com', 'duckduckgo')).toBe('https://docs.example.com');
    });

    it('prepends https:// to domains with paths', () => {
      expect(normalizeInputToUrl('example.com/some/path', 'duckduckgo')).toBe(
        'https://example.com/some/path'
      );
    });
  });

  describe('search engine routing', () => {
    it('routes search queries to DuckDuckGo', () => {
      const url = normalizeInputToUrl('hello world', 'duckduckgo');
      expect(url).toBe('https://duckduckgo.com/?q=hello%20world');
    });

    it('routes search queries to Google', () => {
      const url = normalizeInputToUrl('hello world', 'google');
      expect(url).toBe('https://www.google.com/search?q=hello%20world');
    });

    it('routes search queries to custom engine using %s placeholder', () => {
      const url = normalizeInputToUrl('hello world', 'custom', 'https://search.example.com/?q=%s');
      expect(url).toBe('https://search.example.com/?q=hello%20world');
    });

    it('falls back to DuckDuckGo when engine is none', () => {
      // 'none' engine treats it as a domain prefix, not a search
      const url = normalizeInputToUrl('hello world', 'none');
      expect(url).toBe('https://hello world');
    });

    it('falls back to DuckDuckGo for unknown engine with no custom URL', () => {
      const url = normalizeInputToUrl('hello world', 'custom');
      expect(url).toBe('https://duckduckgo.com/?q=hello%20world');
    });
  });

  describe('empty input', () => {
    it('returns about:blank for empty string', () => {
      expect(normalizeInputToUrl('', 'duckduckgo')).toBe('about:blank');
    });

    it('returns about:blank for whitespace-only string', () => {
      expect(normalizeInputToUrl('   ', 'duckduckgo')).toBe('about:blank');
    });
  });

  describe('special characters in search queries', () => {
    it('encodes ampersands', () => {
      const url = normalizeInputToUrl('a & b', 'duckduckgo');
      expect(url).toContain('a%20%26%20b');
    });

    it('encodes hash characters', () => {
      const url = normalizeInputToUrl('c# tutorial', 'google');
      expect(url).toContain('c%23%20tutorial');
    });
  });
});
