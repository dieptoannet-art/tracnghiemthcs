import React, { useMemo } from 'react';
import katex from 'katex';

interface MathViewProps {
  content: string;
  className?: string;
  block?: boolean;
}

export const MathView: React.FC<MathViewProps> = ({ content, className = '', block = false }) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    // Regex to detect inline math $...$ and display math $$...$$
    // Also protects standard text
    try {
      // First handle $$...$$ (display mode)
      let parsed = content.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
        } catch {
          return `<span class="text-red-500">[Lỗi công thức: ${math}]</span>`;
        }
      });

      // Then handle inline $...$
      parsed = parsed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
        } catch {
          return `<span class="text-red-500">[Lỗi công thức: ${math}]</span>`;
        }
      });

      // Convert line breaks to <br /> if there are newlines outside math
      return parsed.replace(/\n/g, '<br />');
    } catch {
      return content;
    }
  }, [content]);

  return (
    <span
      className={`inline-block leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
