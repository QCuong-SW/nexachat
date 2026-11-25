'use client';

import { Check, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return extractText(props?.children);
  }
  return '';
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const language = /language-([\w-]+)/.exec(className ?? '')?.[1] ?? 'code';
  const rawCode = extractText(children).replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be unavailable in non-HTTPS or test environments
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/80 px-3 py-1.5 text-xs text-slate-600">
        <span className="font-mono font-medium">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Đã sao chép
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Sao chép
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-[13px] leading-relaxed">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

/**
 * Render Markdown an toàn: KHÔNG bật rehype-raw và dùng skipHtml để chặn chèn HTML thô (XSS).
 */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        skipHtml
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          h1: ({ children }) => (
            <h1 className="mt-4 text-lg font-semibold text-slate-900">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-3 text-base font-semibold text-slate-900">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-2.5 text-sm font-semibold text-slate-900">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-300 bg-indigo-50/40 py-1 pl-3 italic text-slate-700">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className?.includes('language-') || className?.includes('hljs'));
            if (isBlock) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }
            return (
              <code
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12.5px] text-indigo-700"
                {...props}
              >
                {children}
              </code>
            );
          },
          a: ({ href, children }) => {
            const safeHref =
              href && /^(https?:|mailto:)/i.test(href) ? href : undefined;
            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 underline-offset-2 hover:underline"
              >
                {children}
              </a>
            );
          },
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse border border-slate-200 text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-200 px-2.5 py-1.5 text-slate-700">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
