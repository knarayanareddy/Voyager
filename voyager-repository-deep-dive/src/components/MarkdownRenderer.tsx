import React from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onLinkClick?: (pageName: string, isShiftKey: boolean) => void;
  onTagClick?: (tag: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onLinkClick,
  onTagClick
}) => {
  const { state } = useDatabase();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to resolve media-id into active Blob URL if needed
  const resolveImageUrl = (url: string): string => {
    if (url.startsWith('media-')) {
      const media = state.mediaAttachments.find(m => m.id === url);
      return media ? media.url : '';
    }
    return url;
  };

  if (!content) return <span className="text-neutral-500 italic font-mono text-xs">Empty block</span>;

  // 1. Check for Code Blocks: ```javascript ... ```
  if (content.startsWith('```')) {
    const lines = content.split('\n');
    const firstLine = lines[0];
    const language = firstLine.replace('```', '').trim() || 'code';
    const codeContent = lines.slice(1, lines.length - (lines[lines.length - 1] === '```' ? 1 : 0)).join('\n');

    return (
      <div className="my-2 rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden font-mono text-xs max-w-full">
        <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-[10px] text-neutral-400">
          <span>{language.toUpperCase()}</span>
          <button
            onClick={() => handleCopy(codeContent)}
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3 overflow-x-auto text-neutral-200 leading-relaxed font-mono whitespace-pre select-text">
          <code>{codeContent}</code>
        </pre>
      </div>
    );
  }

  // 2. Check for Headers: # H1, ## H2, ### H3
  if (content.startsWith('# ')) {
    return <h1 className="text-lg font-bold text-white mt-2 mb-1 border-b border-neutral-800 pb-0.5 select-text">{renderInline(content.slice(2))}</h1>;
  }
  if (content.startsWith('## ')) {
    return <h2 className="text-base font-bold text-white mt-2 mb-1 select-text">{renderInline(content.slice(3))}</h2>;
  }
  if (content.startsWith('### ')) {
    return <h3 className="text-sm font-bold text-neutral-100 mt-1.5 mb-0.5 select-text">{renderInline(content.slice(4))}</h3>;
  }

  // 3. Check for Blockquotes: > quote
  if (content.startsWith('> ')) {
    return (
      <blockquote className="pl-3 border-l-4 border-blue-500/50 my-2 italic text-neutral-300 select-text">
        {renderInline(content.slice(2))}
      </blockquote>
    );
  }

  // 4. Fallback: standard inline rendering
  return <div className="leading-relaxed text-neutral-200 select-text whitespace-pre-wrap">{renderInline(content)}</div>;

  // Tokenize and render inline formatting
  function renderInline(text: string): React.ReactNode[] {
    const tokens: React.ReactNode[] = [];

    // We tokenize using regexes
    // Supported:
    // - Images: ![[alt]](url) or ![alt](url)
    // - Wikilinks: [[Page Name]]
    // - Tags: #tagname
    // - Bold: **text**
    // - Italic: *text*
    // - Strikethrough: ~~text~~
    // - Highlight: ==text==
    // - Inline Code: `code`
    const regex = /(!?\[\[.*?\]\])|(!?\[.*?\]\(.*?\))|(?:^|\s)(#[a-zA-Z0-9_-]+)|(\*\*.*?\*\*)|(\*.*?\*)|(~~.*?~~)|(==.*?==)|(`.*?`)/g;

    let match;
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      // Add preceding plain text
      if (match.index > lastIndex) {
        tokens.push(text.slice(lastIndex, match.index));
      }

      const tokenStr = match[0];

      // A. Images and WikiLinks with brackets
      if (tokenStr.startsWith('![') && tokenStr.endsWith(')')) {
        // Standard markdown image: ![alt](url)
        const imgMatch = /!\[(.*?)\]\((.*?)\)/.exec(tokenStr);
        if (imgMatch) {
          const alt = imgMatch[1];
          const resolvedUrl = resolveImageUrl(imgMatch[2]);
          tokens.push(
            <div key={match.index} className="my-2 max-w-full flex flex-col items-center">
              <img
                src={resolvedUrl || '/placeholder-image.png'}
                alt={alt}
                className="max-h-56 rounded-lg border border-neutral-800 object-contain shadow-md bg-neutral-900"
                onError={(e) => {
                  // Fallback for broken/loading URLs
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23555" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                }}
              />
              {alt && <span className="text-[10px] text-neutral-500 mt-1 font-mono">{alt}</span>}
            </div>
          );
        }
      } else if (tokenStr.startsWith('![[') && tokenStr.endsWith(']]')) {
        // Wikilink image: ![[media-id]]
        const mediaId = tokenStr.slice(3, -2);
        const resolvedUrl = resolveImageUrl(mediaId);
        tokens.push(
          <div key={match.index} className="my-2 max-w-full flex flex-col items-center">
            <img
              src={resolvedUrl}
              alt="Embedded Attachment"
              className="max-h-56 rounded-lg border border-neutral-800 object-contain shadow-md bg-neutral-900"
            />
          </div>
        );
      } else if (tokenStr.startsWith('[[') && tokenStr.endsWith(']]')) {
        // Wikilink: [[Page Name]]
        const pageName = tokenStr.slice(2, -2);
        tokens.push(
          <button
            key={match.index}
            onClick={(e) => {
              e.stopPropagation();
              if (onLinkClick) onLinkClick(pageName, e.shiftKey);
            }}
            className="text-blue-400 hover:text-blue-300 hover:underline font-semibold bg-blue-500/10 px-1 py-0.5 rounded text-xs inline-flex items-center gap-0.5 cursor-pointer align-baseline"
          >
            {pageName}
          </button>
        );
      }
      // B. Tags: #tagname
      else if (tokenStr.includes('#')) {
        const tag = tokenStr.trim().replace('#', '');
        tokens.push(
          <button
            key={match.index}
            onClick={(e) => {
              e.stopPropagation();
              if (onTagClick) onTagClick(tag);
            }}
            className="text-emerald-400 hover:text-emerald-300 font-medium bg-emerald-500/10 hover:bg-emerald-500/20 px-1.5 py-0.2 rounded-full text-[10px] inline-flex items-center gap-0.5 cursor-pointer ml-1 align-baseline"
          >
            #{tag}
          </button>
        );
      }
      // C. Bold: **text**
      else if (tokenStr.startsWith('**') && tokenStr.endsWith('**')) {
        tokens.push(
          <strong key={match.index} className="font-bold text-white">
            {tokenStr.slice(2, -2)}
          </strong>
        );
      }
      // D. Italic: *text*
      else if (tokenStr.startsWith('*') && tokenStr.endsWith('*')) {
        tokens.push(
          <em key={match.index} className="italic text-neutral-300">
            {tokenStr.slice(1, -1)}
          </em>
        );
      }
      // E. Strike: ~~text~~
      else if (tokenStr.startsWith('~~') && tokenStr.endsWith('~~')) {
        tokens.push(
          <span key={match.index} className="line-through text-neutral-400">
            {tokenStr.slice(2, -2)}
          </span>
        );
      }
      // F. Highlight: ==text==
      else if (tokenStr.startsWith('==') && tokenStr.endsWith('==')) {
        tokens.push(
          <mark key={match.index} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">
            {tokenStr.slice(2, -2)}
          </mark>
        );
      }
      // G. Inline Code: `code`
      else if (tokenStr.startsWith('`') && tokenStr.endsWith('`')) {
        tokens.push(
          <code key={match.index} className="font-mono text-[11px] bg-neutral-800 text-pink-400 px-1 py-0.5 rounded">
            {tokenStr.slice(1, -1)}
          </code>
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Add trailing plain text
    if (lastIndex < text.length) {
      tokens.push(text.slice(lastIndex));
    }

    // If no tokens found, return the original text
    return tokens.length > 0 ? tokens : [text];
  }
};
