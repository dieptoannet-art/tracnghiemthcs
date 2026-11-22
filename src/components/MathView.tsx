import React, { useMemo } from 'react';
import katex from 'katex';

interface MathViewProps {
  content: string;
  className?: string;
  block?: boolean;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Pure renderer supporting:
 * - Display math: $$...$$ and \[...\]
 * - Inline math: \(...\) and $...$
 * - Safe raw-text fallback when a LaTeX expression has syntax errors (never breaks UI controls)
 * - Scrollable container for wide display formulas so long math never overflows layout
 */
export function renderMathToHtml(content: string): string {
  if (!content) return '';

  // Single-pass tokenizer matching display blocks first, then inline delimiters
  const mathRegex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^\$\n]+?)\$/g;

  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const plain = content.slice(lastIndex, match.index);
      result += escapeHtml(plain).replace(/\n/g, '<br />');
    }

    const displayDollar = match[1];
    const displayBracket = match[2];
    const inlineParen = match[3];
    const inlineDollar = match[4];

    const isDisplay = displayDollar !== undefined || displayBracket !== undefined;
    const rawMath = (displayDollar ?? displayBracket ?? inlineParen ?? inlineDollar ?? '').trim();

    if (!rawMath) {
      result += escapeHtml(match[0]);
    } else {
      try {
        const rendered = katex.renderToString(rawMath, {
          displayMode: isDisplay,
          throwOnError: true,
          strict: 'ignore',
        });
        if (isDisplay) {
          result += `<span class="block my-1.5 max-w-full overflow-x-auto align-middle">${rendered}</span>`;
        } else {
          result += `<span class="inline-block max-w-full overflow-x-auto align-middle">${rendered}</span>`;
        }
      } catch {
        // Malformed LaTeX: gracefully display original text without breaking layout or buttons
        result += `<span class="font-mono text-inherit break-words">${escapeHtml(match[0])}</span>`;
      }
    }

    lastIndex = mathRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    result += escapeHtml(content.slice(lastIndex)).replace(/\n/g, '<br />');
  }

  return result;
}

export const MathView: React.FC<MathViewProps> = ({ content, className = '', block = false }) => {
  const renderedHtml = useMemo(() => renderMathToHtml(content), [content]);

  return (
    <span
      className={`${block ? 'block' : 'inline-block'} max-w-full leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
