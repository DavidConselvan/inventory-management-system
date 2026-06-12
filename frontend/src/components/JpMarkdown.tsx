import type { ComponentPropsWithoutRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

interface JpMarkdownProps {
  content: string;
  /** Fired when the user clicks an in-app link (so the host can close). */
  onNavigate?: () => void;
}

/** Force a ```jp-metrics fence onto its own line — models sometimes glue it to
 *  the previous sentence, which would otherwise parse as inline code. */
function normalize(md: string): string {
  return md.replace(/([^\n])(```jp-metrics)/g, '$1\n\n$2').replace(/^\n+/, '');
}

/** Parse a ```jp-metrics``` block ("Label: value" per line) into tiles. */
function MetricTiles({ source }: { source: string }) {
  const metrics = source
    .split('\n')
    .map((line) => line.split(/:(.+)/))
    .filter((parts) => parts.length >= 2 && parts[1].trim())
    .map((parts) => ({ label: parts[0].trim(), value: parts[1].trim() }));

  if (!metrics.length) return null;

  return (
    <div className="jp-metrics">
      {metrics.map((m) => (
        <div key={m.label} className="jp-metric">
          <span className="jp-metric-label">{m.label}</span>
          <span className="jp-metric-value tnum">{m.value}</span>
        </div>
      ))}
    </div>
  );
}

export function JpMarkdown({ content, onNavigate }: JpMarkdownProps) {
  const navigate = useNavigate();

  const components: Components = {
    a({ href, children, ...props }) {
      // Internal app routes navigate via the router and close the assistant.
      if (href?.startsWith('/')) {
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.();
              navigate(href);
            }}
            {...props}
          >
            {children}
          </a>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer" {...props}>
          {children}
        </a>
      );
    },
    code({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
      if (className?.includes('language-jp-metrics')) {
        return <MetricTiles source={String(children).replace(/\n$/, '')} />;
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className="jp-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalize(content)}
      </ReactMarkdown>
    </div>
  );
}
