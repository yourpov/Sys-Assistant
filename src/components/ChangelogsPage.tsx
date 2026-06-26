import { Fragment, useEffect } from 'react';

import logoWatermark from '../assets/logo-watermark.png';
import { useMouseGlow } from '../hooks/useMouseGlow';
import { BASE_WINDOW_SIZE, tweenWindowSize } from '../utils/windowSize';
import { Skeleton } from './Skeleton';

const EXPANDED_WINDOW_SIZE = { width: 760, height: 760 };

interface Props {
  content: string | null;
  error: string | null;
}

export function ChangelogsPage({ content, error }: Props) {
  const glowRef = useMouseGlow<HTMLElement>();

  useEffect(() => {
    tweenWindowSize(EXPANDED_WINDOW_SIZE.width, EXPANDED_WINDOW_SIZE.height);
    return () => {
      tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height);
    };
  }, []);

  const entries = content ? parseChangelog(content) : [];

  return (
    <main className="settings-page" data-tauri-drag-region ref={glowRef}>
      <img className="changelog-watermark" src={logoWatermark} alt="" aria-hidden="true" />
      <div className="settings-content" data-tauri-drag-region>
        <div className="settings-header" data-tauri-drag-region>
          <h2 data-tauri-drag-region>Changelogs</h2>
        </div>

        {error && <p className="settings-error">{error}</p>}

        {!content && !error && (
          <div className="settings-section skeleton-section" data-tauri-drag-region>
            <Skeleton width={120} height={16} />
            <Skeleton height={13} />
            <Skeleton height={13} width="80%" />
            <Skeleton height={13} width="60%" />
          </div>
        )}

        {content && (
          <div className="changelog-entries" data-tauri-drag-region>
            {entries.map((entry, i) => (
              <article key={i} className="settings-section changelog-entry" data-tauri-drag-region>
                {entry.title && (
                  <h3 className="changelog-version" data-tauri-drag-region>
                    {entry.title}
                  </h3>
                )}
                {entry.date && (
                  <p className="changelog-date" data-tauri-drag-region>
                    {entry.date}
                  </p>
                )}
                {entry.body}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

interface ChangelogEntry {
  title: string | null;
  date: string | null;
  body: React.ReactNode[];
}

function parseChangelog(text: string): ChangelogEntry[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[][] = [];

  for (const line of lines) {
    if (/^#\s+/.test(line.trimEnd()) || blocks.length === 0) {
      blocks.push([]);
    }
    blocks[blocks.length - 1].push(line);
  }

  return blocks.map((block) => {
    const titleMatch = block[0]?.trimEnd().match(/^#\s+(.*)$/);
    const title = titleMatch ? titleMatch[1] : null;
    const rest = titleMatch ? block.slice(1) : block;

    let date: string | null = null;
    let bodyLines = rest;
    const firstContentIndex = rest.findIndex((l) => l.trim() !== '');
    if (firstContentIndex !== -1) {
      const candidate = rest[firstContentIndex].trim();
      if (!/^#{1,2}\s+/.test(candidate) && !/^[-*]\s+/.test(candidate)) {
        date = candidate;
        bodyLines = rest.slice(firstContentIndex + 1);
      }
    }

    return { title, date, body: renderBody(bodyLines) };
  });
}

function renderBody(lines: string[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`list-${nodes.length}`} className="changelog-list">
        {listItems.map((item, i) => (
          <li key={i}>{renderListItem(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);

    if (bullet) {
      listItems.push(bullet[1]);
      continue;
    }
    flushList();

    if (h2) {
      nodes.push(
        <h4 key={nodes.length} className="changelog-heading">
          {renderInline(h2[1])}
        </h4>,
      );
    } else if (line.trim() === '') {
      continue;
    } else {
      nodes.push(
        <p key={nodes.length} className="changelog-paragraph">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushList();

  return nodes;
}

function renderListItem(text: string): React.ReactNode {
  const match = text.match(/^([^:]{1,48}):\s(.*)$/);
  if (!match) return renderInline(text);
  return (
    <>
      <strong>{match[1]}:</strong> {renderInline(match[2])}
    </>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>));
}
