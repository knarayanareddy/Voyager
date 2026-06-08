import React from 'react';

export function parseInlineMarkdown(text: string, onLinkClick?: (page: string) => void): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Remove leading heading markers for rendering
  const headingMatch = remaining.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const content = headingMatch[2];
    const sizeMap: Record<number, string> = {
      1: 'text-2xl font-bold',
      2: 'text-xl font-bold',
      3: 'text-lg font-semibold',
      4: 'text-base font-semibold',
      5: 'text-sm font-semibold',
      6: 'text-xs font-semibold',
    };
    return [
      <span key={0} className={`${sizeMap[level] || 'text-base font-bold'} text-[var(--color-text-primary)] block`}>
        {parseInlineMarkdown(content, onLinkClick)}
      </span>
    ];
  }

  // Blockquote
  if (remaining.startsWith('> ')) {
    return [
      <blockquote key={0} className="border-l-4 border-[var(--color-accent)] pl-3 italic text-[var(--color-text-secondary)] my-1">
        {parseInlineMarkdown(remaining.slice(2), onLinkClick)}
      </blockquote>
    ];
  }

  // Code block
  if (remaining.startsWith('```')) {
    const end = remaining.indexOf('```', 3);
    const code = end > 3 ? remaining.slice(3, end).replace(/^\n/, '') : remaining.slice(3);
    return [
      <pre key={0} className="bg-[var(--color-surface-2)] rounded px-3 py-2 text-xs font-mono text-[var(--color-accent-green)] overflow-x-auto my-1 whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    ];
  }

  const patterns: Array<{ regex: RegExp; render: (match: RegExpMatchArray) => React.ReactNode }> = [
    {
      regex: /\[\[([^\]]+)\]\]/,
      render: (m) => (
        <span
          key={key++}
          className="text-[var(--color-accent)] underline underline-offset-2 cursor-pointer hover:opacity-80"
          onClick={() => onLinkClick?.(m[1])}
        >
          {m[1]}
        </span>
      ),
    },
    {
      regex: /#([\w][\w-]*)/,
      render: (m) => (
        <span
          key={key++}
          className="text-[var(--color-accent-purple)] cursor-pointer hover:opacity-80 font-medium"
          onClick={() => onLinkClick?.(m[1])}
        >
          #{m[1]}
        </span>
      ),
    },
    {
      regex: /\*\*\*([^*]+)\*\*\*/,
      render: (m) => <strong key={key++}><em>{m[1]}</em></strong>,
    },
    {
      regex: /\*\*([^*]+)\*\*/,
      render: (m) => <strong key={key++} className="font-bold text-[var(--color-text-primary)]">{m[1]}</strong>,
    },
    {
      regex: /(?<!\w)[*_]([^*_]+)[*_](?!\w)/,
      render: (m) => <em key={key++} className="italic">{m[1]}</em>,
    },
    {
      regex: /~~([^~]+)~~/,
      render: (m) => <del key={key++} className="line-through opacity-60">{m[1]}</del>,
    },
    {
      regex: /==([^=]+)==/,
      render: (m) => <mark key={key++} className="bg-yellow-300/40 text-[var(--color-text-primary)] px-0.5 rounded">{m[1]}</mark>,
    },
    {
      regex: /`([^`]+)`/,
      render: (m) => <code key={key++} className="bg-[var(--color-surface-2)] text-[var(--color-accent-green)] px-1.5 py-0.5 rounded text-[0.8em] font-mono">{m[1]}</code>,
    },
    {
      regex: /!\[([^\]]*)\]\(([^)]+)\)/,
      render: (m) => (
        <img key={key++} src={m[2]} alt={m[1]} className="max-w-full rounded-lg my-1 max-h-48 object-contain" />
      ),
    },
    {
      regex: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (m) => (
        <a key={key++} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline">
          {m[1]}
        </a>
      ),
    },
  ];

  while (remaining.length > 0) {
    let earliest: { index: number; match: RegExpMatchArray; render: (m: RegExpMatchArray) => React.ReactNode } | null = null;

    for (const { regex, render } of patterns) {
      const match = remaining.match(regex);
      if (match && match.index !== undefined) {
        if (!earliest || match.index < earliest.index) {
          earliest = { index: match.index, match, render };
        }
      }
    }

    if (!earliest) {
      nodes.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (earliest.index > 0) {
      nodes.push(<span key={key++}>{remaining.slice(0, earliest.index)}</span>);
    }

    nodes.push(earliest.render(earliest.match));
    remaining = remaining.slice(earliest.index + earliest.match[0].length);
  }

  return nodes;
}
