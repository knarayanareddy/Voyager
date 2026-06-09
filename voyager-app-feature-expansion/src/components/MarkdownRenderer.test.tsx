import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MarkdownRenderer from './MarkdownRenderer';
import * as DatabaseContextModule from '../context/DatabaseContext';

// Mock useDatabase
const renderWithContext = (ui: React.ReactElement, stateOverrides = {}) => {
  vi.spyOn(DatabaseContextModule, 'useDatabase').mockReturnValue({
    state: { mediaAttachments: [], ...stateOverrides } as any,
    dispatch: vi.fn(),
    navigateTo: vi.fn(),
    getOrCreatePage: vi.fn(),
    backlinks: new Map(),
    loading: false,
    actions: {},
  });
  
  return render(ui);
};

describe('MarkdownRenderer', () => {
  it('renders standard inline markdown correctly', () => {
    const { container } = renderWithContext(
      <MarkdownRenderer content="This is **bold** and *italic* and ~~strikethrough~~" />
    );
    expect(container.innerHTML).toContain('<strong class="font-semibold text-white">bold</strong>');
    expect(container.innerHTML).toContain('<em class="italic text-slate-300">italic</em>');
    expect(container.innerHTML).toContain('<del class="line-through text-slate-500">strikethrough</del>');
  });

  it('renders wikilinks', () => {
    const { container } = renderWithContext(<MarkdownRenderer content="Link to [[Page A]]" />);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe('Page A');
  });

  it('renders block elements (headings, quotes)', () => {
    const { container } = renderWithContext(<MarkdownRenderer content="### Small Heading" />);
    const h3 = container.querySelector('h3');
    expect(h3).not.toBeNull();
    expect(h3?.textContent).toBe('Small Heading');
  });

  it('renders multiline code blocks via codeBlock prop', () => {
    const { container } = renderWithContext(
      <MarkdownRenderer 
        content="" 
        codeBlock={{ language: 'typescript', code: 'const x = 1;\nconsole.log(x);' }} 
      />
    );
    const pre = container.querySelector('pre');
    const code = container.querySelector('code');
    expect(pre).not.toBeNull();
    expect(code).not.toBeNull();
    expect(code?.textContent).toContain('const x = 1;');
  });

  it('renders images and handles internal voyager://media/ urls', () => {
    const mockMedia = [
      { id: '123', url: 'blob:mock-url-xyz', type: 'image', name: 'test.png', createdAt: '' }
    ];
    const { container } = renderWithContext(
      <MarkdownRenderer content="![Alt text](voyager://media/123)" />,
      { mediaAttachments: mockMedia }
    );
    
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('blob:mock-url-xyz');
    expect(img?.getAttribute('alt')).toBe('Alt text');
  });

  it('renders images and handles legacy raw IDs', () => {
    const mockMedia = [
      { id: 'abc1234', url: 'blob:legacy-url', type: 'image', name: 'test.png', createdAt: '' }
    ];
    const { container } = renderWithContext(
      <MarkdownRenderer content="![Alt text](abc1234)" />,
      { mediaAttachments: mockMedia }
    );
    
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('blob:legacy-url');
  });

  it('renders images and handles external urls gracefully', () => {
    const { container } = renderWithContext(
      <MarkdownRenderer content="![Alt text](https://example.com/img.png)" />
    );
    
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/img.png');
  });
});
