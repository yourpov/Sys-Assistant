import type { ReactNode } from 'react';

const MENTION_PATTERN = /(@[A-Za-z0-9_.]{2,30})/g;

export function extractMentionHandles(text: string): string[] {
  const handles = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    handles.add(match[1].slice(1));
  }
  return [...handles];
}

export function CommentBodyText({ text }: { text: string }) {
  const parts = text.split(MENTION_PATTERN);

  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('@') ? (
          <span key = {`${part}-${index}`} className = "configs-comment-mention">
            {part}
          </span>
        ) : (
          <span key = {`${index}-text`}>{part}</span>
        ),
      )}
    </>
  );
}

export function mentionSuggestions(query: string, candidates: string[]): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return candidates.slice(0, 6);
  return candidates.filter((name) => name.toLowerCase().includes(needle)).slice(0, 6);
}

export function insertMention(value: string, cursor: number, handle: string): { value: string; cursor: number } {
  const before  = value.slice(0, cursor);
  const after   = value.slice(cursor);
  const atIndex = before.lastIndexOf('@');
  if (atIndex < 0) return { value, cursor };
  const nextValue  = `${before.slice(0, atIndex)}@${handle} ${after}`;
  const nextCursor = atIndex + handle.length + 2;
  return { value: nextValue, cursor: nextCursor };
}

export function activeMentionQuery(value: string, cursor: number): string | null {
  const before = value.slice(0, cursor);
  const match  = /(^|\s)@([A-Za-z0-9_.]{0,30})$/.exec(before);
  if (!match) return null;
  return match[2];
}

export function replyLabel(username: string | null): ReactNode {
  return username ? (
    <>
      Reply to <span className = "configs-comment-mention">@{username}</span>
    </>
  ) : (
    'Reply'
  );
}