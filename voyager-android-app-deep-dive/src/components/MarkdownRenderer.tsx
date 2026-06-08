import React from 'react';

interface MarkdownRendererProps {
  content: string;
  onLinkClick?: (ref: string) => void;
  className?: string;
}

export function parseInlineMarkdown(
  content: string,
  onLinkClick?: (ref: string) => void
): React.ReactNode[] {
  if (!content) return [];

  // Handle headings
  const headingMatch = content.match(/^(#{1,3})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const text = headingMatch[2];
    const cls = level === 1 ? 'md-heading-1' : level === 2 ? 'md-heading-2' : 'md-heading-3';
    return [<span key="h" className={cls}>{parseInlineText(text, onLinkClick)}</span>];
  }

  // Handle blockquote
  if (content.startsWith('> ')) {
    return [
      <span key="bq" style={{
        display: 'block',
        borderLeft: '3px solid rgba(99,102,241,0.5)',
        paddingLeft: '8px',
        color: '#94a3b8',
        fontStyle: 'italic',
      }}>
        {parseInlineText(content.slice(2), onLinkClick)}
      </span>
    ];
  }

  // Handle code block indicator
  if (content.startsWith('```')) {
    const lang = content.slice(3).trim() || 'code';
    return [<span key="cb" style={{ color: '#94a3b8', fontSize: '0.8em' }}>{'{'}{lang}{'}'}</span>];
  }

  return parseInlineText(content, onLinkClick);
}

function parseInlineText(text: string, onLinkClick?: (ref: string) => void): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Wiki links [[...]]
    const wikiMatch = remaining.match(/\[\[([^\]]+)\]\]/);
    if (wikiMatch && wikiMatch.index !== undefined) {
      if (wikiMatch.index > 0) {
        parts.push(...parseFormats(remaining.slice(0, wikiMatch.index), key));
        key++;
      }
      parts.push(
        <span
          key={`wl-${key++}`}
          className="md-link"
          onClick={(e) => { e.stopPropagation(); onLinkClick?.(wikiMatch[1]); }}
        >
          {wikiMatch[1]}
        </span>
      );
      remaining = remaining.slice(wikiMatch.index + wikiMatch[0].length);
      continue;
    }

    // Hashtags
    const tagMatch = remaining.match(/#([\w][\w-]*)/);
    if (tagMatch && tagMatch.index !== undefined) {
      if (tagMatch.index > 0) {
        parts.push(...parseFormats(remaining.slice(0, tagMatch.index), key));
        key++;
      }
      parts.push(
        <span
          key={`tag-${key++}`}
          className="md-tag"
          onClick={(e) => { e.stopPropagation(); onLinkClick?.(tagMatch[1]); }}
        >
          {tagMatch[0]}
        </span>
      );
      remaining = remaining.slice(tagMatch.index + tagMatch[0].length);
      continue;
    }

    parts.push(...parseFormats(remaining, key));
    break;
  }

  return parts;
}

function parseFormats(text: string, keyOffset: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = keyOffset * 1000;

  while (remaining.length > 0) {
    // Highlight ==text==
    const hlMatch = remaining.match(/==([^=]+)==/);
    if (hlMatch && hlMatch.index !== undefined) {
      if (hlMatch.index > 0) parts.push(<span key={key++}>{remaining.slice(0, hlMatch.index)}</span>);
      parts.push(<span key={key++} className="md-highlight">{hlMatch[1]}</span>);
      remaining = remaining.slice(hlMatch.index + hlMatch[0].length);
      continue;
    }

    // Bold **text**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
      parts.push(<strong key={key++} className="md-bold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Italic *text* (not **)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) parts.push(<span key={key++}>{remaining.slice(0, italicMatch.index)}</span>);
      parts.push(<em key={key++} className="md-italic">{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    // Strikethrough ~~text~~
    const strikeMatch = remaining.match(/~~([^~]+)~~/);
    if (strikeMatch && strikeMatch.index !== undefined) {
      if (strikeMatch.index > 0) parts.push(<span key={key++}>{remaining.slice(0, strikeMatch.index)}</span>);
      parts.push(<span key={key++} className="md-strikethrough">{strikeMatch[1]}</span>);
      remaining = remaining.slice(strikeMatch.index + strikeMatch[0].length);
      continue;
    }

    // Inline code `text`
    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) parts.push(<span key={key++}>{remaining.slice(0, codeMatch.index)}</span>);
      parts.push(<code key={key++} className="md-code">{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }

    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return parts;
}

export default function MarkdownRenderer({ content, onLinkClick, className }: MarkdownRendererProps) {
  const nodes = parseInlineMarkdown(content, onLinkClick);
  return <span className={className}>{nodes}</span>;
}
