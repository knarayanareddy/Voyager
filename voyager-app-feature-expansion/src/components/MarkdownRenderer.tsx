import React, { useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';

interface Props {
  content: string;
  onLinkClick?: (target: string, _e: React.MouseEvent) => void;
  onExternalLinkClick?: (url: string) => void;
  className?: string;
  /** Pre-accumulated multi-line code fence block passed from the parent rendering loop */
  codeBlock?: { language?: string; code: string };
}

export default function MarkdownRenderer({ content, onLinkClick, onExternalLinkClick, className = '', codeBlock }: Props) {
  const { state } = useDatabase();
  const mediaById = useMemo(() => new Map(state.mediaAttachments.map(m => [m.id, m])), [state.mediaAttachments]);

  const renderInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let key = 0;

    // 1. Tokenize into code spans and text spans
    const segments: { type: 'code' | 'text'; content: string }[] = [];
    let lastIndex = 0;
    const inlineCodeRegex = /`([^`]+)`/g;
    let match;
    while ((match = inlineCodeRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: 'text',
          content: text.slice(lastIndex, match.index)
        });
      }
      segments.push({
        type: 'code',
        content: match[1]
      });
      lastIndex = inlineCodeRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }

    const patterns: [RegExp, (match: string, ...groups: string[]) => React.ReactNode][] = [
      [/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
        let resolvedUrl = url;
        if (url.startsWith('voyager://media/')) {
          const id = url.replace('voyager://media/', '');
          const media = mediaById.get(id);
          resolvedUrl = media ? media.url : url;
        } else if (mediaById.has(url)) {
          resolvedUrl = mediaById.get(url)!.url;
        } else {
          resolvedUrl = url;
        }
        return (
          <img
            key={key++}
            src={resolvedUrl}
            alt={alt || 'Image'}
            loading="lazy"
            className="max-w-full max-h-64 rounded-lg my-1.5 border border-slate-700/50 block shadow-md object-contain"
          />
        );
      }],
      [/\bhttps?:\/\/[^\s)\]>"]+/g, (url) => (
        <button
          key={key++}
          onClick={() => onExternalLinkClick ? onExternalLinkClick(url) : window.open(url, '_blank', 'noopener,noreferrer')}
          className="text-sky-400 hover:text-sky-300 hover:underline font-medium transition-colors break-all"
          title={url}
        >
          🌐 {url.length > 50 ? url.slice(0, 47) + '…' : url}
        </button>
      )],
      [/\[\[([^\]]+)\]\]/g, (_match, p1) => (
        <button
          key={key++}
          onClick={(e) => onLinkClick?.(p1, e)}
          className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium transition-colors"
        >
          {p1}
        </button>
      )],
      [/#([\w-]+)/g, (_, p1) => (
        <span key={key++} className="text-violet-400 hover:text-violet-300 cursor-pointer font-medium">#{p1}</span>
      )],
      [/\*\*([^*]+)\*\*/g, (_, p1) => <strong key={key++} className="font-semibold text-white">{p1}</strong>],
      [/\*([^*]+)\*/g, (_, p1) => <em key={key++} className="italic text-slate-300">{p1}</em>],
      [/~~([^~]+)~~/g, (_, p1) => <del key={key++} className="line-through text-slate-500">{p1}</del>],
      [/==([^=]+)==/g, (_, p1) => <mark key={key++} className="bg-yellow-400/30 text-yellow-200 px-0.5 rounded">{p1}</mark>],
    ];

    const renderTextSegment = (segmentText: string): React.ReactNode[] => {
      const segmentParts: React.ReactNode[] = [];
      let remaining = segmentText;

      while (remaining.length > 0) {
        let earliest = -1;
        let earliestMatch: RegExpExecArray | null = null;
        let earliestRenderer: ((match: string, ...groups: string[]) => React.ReactNode) | null = null;

        for (const [pattern, renderer] of patterns) {
          pattern.lastIndex = 0;
          const m = pattern.exec(remaining);
          if (m && (earliest === -1 || m.index < earliest)) {
            earliest = m.index;
            earliestMatch = m;
            earliestRenderer = renderer;
          }
        }

        if (earliest === -1 || !earliestMatch || !earliestRenderer) {
          segmentParts.push(<span key={key++}>{remaining}</span>);
          break;
        }

        if (earliest > 0) {
          segmentParts.push(<span key={key++}>{remaining.slice(0, earliest)}</span>);
        }
        segmentParts.push(earliestRenderer(earliestMatch[0], ...earliestMatch.slice(1)));
        remaining = remaining.slice(earliest + earliestMatch[0].length);
      }
      return segmentParts;
    };

    // 2. Process segments
    for (const segment of segments) {
      if (segment.type === 'code') {
        parts.push(
          <code key={key++} className="bg-slate-700 text-emerald-300 px-1 py-0.5 rounded text-[0.85em] font-mono">
            {segment.content}
          </code>
        );
      } else {
        parts.push(...renderTextSegment(segment.content));
      }
    }

    return parts;
  };

  const renderBlock = (text: string): React.ReactNode => {
    if (text.startsWith('# ')) return <h1 className="text-lg font-bold text-white leading-tight">{renderInline(text.slice(2))}</h1>;
    if (text.startsWith('## ')) return <h2 className="text-base font-semibold text-white/90 leading-tight">{renderInline(text.slice(3))}</h2>;
    if (text.startsWith('### ')) return <h3 className="text-sm font-semibold text-white/80 leading-tight">{renderInline(text.slice(4))}</h3>;
    if (text.startsWith('> ')) return <blockquote className="border-l-2 border-indigo-400 pl-2 text-slate-400 italic">{renderInline(text.slice(2))}</blockquote>;
    if (text.startsWith('```')) {
      // Single-line code fence: strip opening/closing backticks and render inline code block
      let codeContent = text.slice(3);
      // Strip optional closing ``` if present on the same line
      if (codeContent.endsWith('```')) {
        codeContent = codeContent.slice(0, -3);
      }
      // Strip optional language identifier from the beginning (e.g., ```typescript)
      const langMatch = codeContent.match(/^(\w+)\s/);
      if (langMatch) {
        codeContent = codeContent.slice(langMatch[0].length);
      }
      return (
        <pre className="bg-slate-900 rounded-lg p-3 my-2 overflow-x-auto border border-slate-700/50">
          <code className="text-emerald-300 text-xs font-mono whitespace-pre">{codeContent}</code>
        </pre>
      );
    }
    return <span className="text-slate-200 leading-relaxed">{renderInline(text)}</span>;
  };

  // If a pre-accumulated code fence block was passed, render it directly
  if (codeBlock) {
    return (
      <span className={`break-words ${className}`}>
        <pre className="bg-slate-900 rounded-lg p-3 my-2 overflow-x-auto border border-slate-700/50 relative" data-language={codeBlock.language || undefined}>
          {codeBlock.language && (
            <span className="absolute top-1.5 right-2 text-[9px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded select-none">
              {codeBlock.language}
            </span>
          )}
          <code className="text-emerald-300 text-xs font-mono whitespace-pre">
            {codeBlock.code}
          </code>
        </pre>
      </span>
    );
  }

  return (
    <span className={`break-words ${className}`}>
      {renderBlock(content)}
    </span>
  );
}
