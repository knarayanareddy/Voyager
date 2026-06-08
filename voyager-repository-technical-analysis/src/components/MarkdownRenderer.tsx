import React from 'react';

interface Props {
  content: string;
  onLinkClick?: (target: string, e: React.MouseEvent) => void;
  className?: string;
  showBrackets?: boolean;
}

export default function MarkdownRenderer({
  content,
  onLinkClick,
  className = '',
  showBrackets = false,
}: Props) {
  // ─── Inline renderer ──────────────────────────────────────────────────────
  const renderInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    type PatternRenderer = (match: string, ...groups: string[]) => React.ReactNode;
    const patterns: [RegExp, PatternRenderer][] = [
      // Wiki links [[Page Name]]
      [
        /\[\[([^\]]+)\]\]/g,
        (_, p1) => (
          <button
            key={key++}
            onClick={e => onLinkClick?.(p1, e)}
            className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors border-b border-indigo-400/30 hover:border-indigo-300"
          >
            {showBrackets ? `[[${p1}]]` : p1}
          </button>
        ),
      ],
      // Hashtags #tag
      [
        /#([\w-]+)/g,
        (_, p1) => (
          <span key={key++} className="text-cyan-400 text-[0.85em] font-medium">
            #{p1}
          </span>
        ),
      ],
      // Bold **text**
      [
        /\*\*([^*]+)\*\*/g,
        (_, p1) => (
          <strong key={key++} className="text-white font-semibold">
            {p1}
          </strong>
        ),
      ],
      // Italic *text*
      [
        /\*([^*]+)\*/g,
        (_, p1) => (
          <em key={key++} className="text-slate-300 italic">
            {p1}
          </em>
        ),
      ],
      // Strikethrough ~~text~~
      [
        /~~([^~]+)~~/g,
        (_, p1) => (
          <span key={key++} className="line-through text-slate-500">
            {p1}
          </span>
        ),
      ],
      // Highlight ==text==
      [
        /==([^=]+)==/g,
        (_, p1) => (
          <mark key={key++} className="bg-yellow-400/30 text-yellow-200 px-0.5 rounded">
            {p1}
          </mark>
        ),
      ],
      // Inline code `code`
      [
        /`([^`]+)`/g,
        (_, p1) => (
          <code
            key={key++}
            className="bg-slate-800 text-emerald-300 px-1 py-0.5 rounded text-[0.85em] font-mono"
          >
            {p1}
          </code>
        ),
      ],
      // Image markdown: ![alt](url)
      [
        /!\[([^\]]*)\]\((data:[^)]+)\)/g,
        (_, alt, src) => (
          <img
            key={key++}
            src={src}
            alt={alt || 'attachment'}
            className="max-w-full rounded-lg mt-2 mb-1 border border-slate-700"
            style={{ maxHeight: 180 }}
          />
        ),
      ],
    ];

    while (remaining.length > 0) {
      let earliest = -1;
      let earliestMatch: RegExpExecArray | null = null;
      let earliestRenderer: PatternRenderer | null = null;

      for (const [pattern, renderer] of patterns) {
        pattern.lastIndex = 0;
        const m = pattern.exec(remaining);
        if (m && (earliest === -1 || m.index < earliest)) {
          earliest = m.index;
          earliestMatch = m;
          earliestRenderer = renderer;
        }
      }

      if (!earliestMatch || !earliestRenderer) {
        parts.push(
          <span key={key++}>
            {remaining}
          </span>,
        );
        break;
      }

      if (earliest > 0) {
        parts.push(
          <span key={key++}>
            {remaining.slice(0, earliest)}
          </span>,
        );
      }

      parts.push(earliestRenderer(earliestMatch[0], ...earliestMatch.slice(1)));
      remaining = remaining.slice(earliest + earliestMatch[0].length);
    }

    return parts;
  };

  // ─── Block-level renderer ─────────────────────────────────────────────────
  const renderBlock = (text: string): React.ReactNode => {
    if (text.startsWith('# ')) {
      return (
        <h1 className="text-lg font-bold text-white leading-tight">
          {renderInline(text.slice(2))}
        </h1>
      );
    }
    if (text.startsWith('## ')) {
      return (
        <h2 className="text-base font-semibold text-slate-100 leading-tight">
          {renderInline(text.slice(3))}
        </h2>
      );
    }
    if (text.startsWith('### ')) {
      return (
        <h3 className="text-sm font-semibold text-slate-200 leading-tight">
          {renderInline(text.slice(4))}
        </h3>
      );
    }
    if (text.startsWith('> ')) {
      return (
        <blockquote className="border-l-2 border-indigo-500 pl-3 text-slate-300 italic">
          {renderInline(text.slice(2))}
        </blockquote>
      );
    }
    if (text.startsWith('```')) {
      const code = text.slice(3);
      return (
        <pre className="bg-slate-900 text-emerald-300 text-xs p-2 rounded font-mono overflow-x-auto">
          <code>{code || ' '}</code>
        </pre>
      );
    }
    // Check if content is just an image attachment (data URL)
    if (text.startsWith('![') && text.includes('data:image')) {
      const match = text.match(/!\[([^\]]*)\]\((data:[^)]+)\)/);
      if (match) {
        return (
          <img
            src={match[2]}
            alt={match[1] || 'attachment'}
            className="max-w-full rounded-lg border border-slate-700"
            style={{ maxHeight: 200 }}
          />
        );
      }
    }

    return <span className="leading-relaxed">{renderInline(text)}</span>;
  };

  return (
    <span className={`block ${className}`}>
      {renderBlock(content)}
    </span>
  );
}
