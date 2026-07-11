import { motion }                                            from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { currentAuthSession } from '../api/auth';
import {
  COMMENTS_PAGE_SIZE,
  deleteConfigComment,
  fetchConfigComments,
  postConfigComment,
  updateConfigComment,
} from '../api/communityConfigs';
import { toast }                              from '../hooks/useToastStore';
import type { AuthSession, CommunityComment } from '../types';
import { confirmIfEnabled }                   from '../utils/confirmGate';
import { logSilentFailure }                   from '../utils/silentError';
import { toastFromError }                     from '../utils/userError';
import {
  activeMentionQuery,
  CommentBodyText,
  insertMention,
  mentionSuggestions,
  replyLabel,
} from '../utils/commentText';
import { timeAgo } from '../utils/timeAgo';

function AvatarFallbackIcon() {
  return (
    <svg    viewBox = "0 0 24 24" fill                         = "none" aria-hidden         = "true" className    = "h-3.5 w-3.5">
    <circle cx      = "12" cy                                  = "8" r                      = "3.2" stroke        = "currentColor" strokeWidth = "1.6" />
    <path   d       = "M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke = "currentColor" strokeWidth = "1.6" strokeLinecap = "round" />
    </svg>
  );
}

function replyCountLabel(count: number): string {
  return count === 1 ? '1 reply' : `${count} replies`;
}

type ReplyTarget = { id: string; username: string | null };

function CommentAvatar({ comment, nested }: { comment: CommunityComment; nested?: boolean }) {
  const className = nested ? 'configs-comment-avatar configs-comment-avatar-nested' : 'configs-comment-avatar';
  if (comment.discordAvatarUrl) {
    return <img src = {comment.discordAvatarUrl} alt = "" className = {className} draggable = {false} />;
  }
  return (
    <div className = {`configs-auth-avatar-fallback small ${className}`}>
      <AvatarFallbackIcon />
    </div>
  );
}

function CommentItem({
  comment,
  nested,
  session,
  editing,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReply,
  saving,
}: {
  comment           : CommunityComment;
  nested           ?: boolean;
  session           : AuthSession | null;
  editing           : boolean;
  editDraft         : string;
  onEditDraftChange : (value: string) => void;
  onStartEdit       : () => void;
  onCancelEdit      : () => void;
  onSaveEdit        : () => void;
  onDelete          : () => void;
  onReply           : () => void;
  saving            : boolean;
}) {
  const own    = !!session?.userId && comment.userId    === session.userId;
  const edited = comment.updatedAt && comment.updatedAt !== comment.createdAt;

  return (
    <article       className = {`configs-comment${nested ? ' configs-comment-nested' : ''}`}>
    <CommentAvatar comment   = {comment} nested = {nested} />
    <div           className = "configs-comment-content">
    <div           className = "configs-comment-meta">
    <span          className = "configs-comment-author">{comment.discordUsername ?? 'Guest'}</span>
    <span          className = "configs-comment-time">
            {timeAgo(comment.createdAt)}
            {edited ? ', edited' : ''}
          </span>
        </div>

        {editing ? (
          <div className = "configs-comment-edit">
            <textarea
              className = "configs-comment-edit-input"
              value     = {editDraft}
              onChange  = {(e) => onEditDraftChange(e.target.value)}
              maxLength = {500}
              rows      = {3}
            />
            <div    className = "configs-comment-edit-actions">
            <button type      = "button" className = "configs-comment-action-btn" onClick = {onCancelEdit} disabled = {saving}>
                Cancel
              </button>
              <button
                type      = "button"
                className = "configs-comment-action-btn configs-comment-action-btn-primary"
                onClick   = {onSaveEdit}
                disabled  = {saving || !editDraft.trim()}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p               className = "configs-comment-body">
          <CommentBodyText text      = {comment.body} />
          </p>
        )}

        {!editing && session && (
          <div    className = "configs-comment-actions">
          <button type      = "button" className = "configs-comment-action-link" onClick = {onReply}>
              Reply
            </button>
            {own && (
              <>
                <button type = "button" className = "configs-comment-action-link" onClick = {onStartEdit}>
                  Edit
                </button>
                <button type = "button" className = "configs-comment-action-link configs-comment-action-danger" onClick = {onDelete}>
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function CommentsDrawer({
  configId,
  commentCount,
  onClose,
  onCommentCountChange,
}: {
  configId             : string;
  commentCount         : number;
  onClose              : () => void;
  onCommentCountChange?: (delta: number) => void;
}) {
  const [roots, setRoots]                     = useState<CommunityComment[]>([]);
  const [rootTotal, setRootTotal]             = useState<number | null>(null);
  const [listOffset, setListOffset]           = useState(0);
  const [hasMore, setHasMore]                 = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [loadingMore, setLoadingMore]         = useState(false);
  const [draft, setDraft]                     = useState('');
  const [posting, setPosting]                 = useState(false);
  const [savingEdit, setSavingEdit]           = useState(false);
  const [deletingId, setDeletingId]           = useState<string | null>(null);
  const [session, setSession]                 = useState<AuthSession | null>(null);
  const [replyTarget, setReplyTarget]         = useState<ReplyTarget | null>(null);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editDraft, setEditDraft]             = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [repliesByParent, setRepliesByParent] = useState<Record<string, CommunityComment[]>>({});
  const [repliesHasMore, setRepliesHasMore]   = useState<Record<string, boolean>>({});
  const [loadingReplies, setLoadingReplies]   = useState<Set<string>>(new Set());

  const bodyRef                           = useRef<HTMLDivElement>(null);
  const loadMoreRef                       = useRef<HTMLDivElement>(null);
  const composerRef                       = useRef<HTMLTextAreaElement>(null);
  const rootsRef                          = useRef<CommunityComment[]>([]);
  const initialScrollDoneRef              = useRef(false);
  const [mentionCursor, setMentionCursor] = useState(0);

  useEffect(() => {
    rootsRef.current = roots;
  }, [roots]);

  const mentionCandidates = useMemo(() => {
    const names = new Set<string>();
    for (const comment of roots) {
      if (comment.discordUsername) names.add(comment.discordUsername);
    }
    for (const replies of Object.values(repliesByParent)) {
      for (const reply of replies) {
        if (reply.discordUsername) names.add(reply.discordUsername);
      }
    }
    if (session?.discordUsername) names.add(session.discordUsername);
    if (replyTarget?.username) names.add(replyTarget.username);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [repliesByParent, replyTarget?.username, roots, session?.discordUsername]);

  const mentionQuery   = activeMentionQuery(draft, mentionCursor);
  const mentionOptions = mentionQuery !== null ? mentionSuggestions(mentionQuery, mentionCandidates) : [];

  const scrollToBottom = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
  }, []);

  const loadRoots = useCallback(
    async (offset: number, mode: 'replace' | 'append') => {
      const page = await fetchConfigComments(configId, { offset, parentId: null });
      setRoots((prev) => {
        if (mode === 'replace') return page.comments;
        const seen = new Set(prev.map((comment) => comment.id));
        const next = page.comments.filter((comment) => !seen.has(comment.id));
        return next.length ? [...prev, ...next]: prev;
      });
      setHasMore(page.hasMore);
      if (page.totalCount !== null) setRootTotal(page.totalCount);
      return page;
    },
    [configId],
  );

  const hasOlder = listOffset > 0;

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextOffset = listOffset + rootsRef.current.length;
      await loadRoots(nextOffset, 'append');
    } catch {
      toast.error({ title: "Couldn't load more comments", body: 'Try scrolling again in a moment.' });
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, listOffset, loadRoots, loading, loadingMore]);

  const loadEarlier = useCallback(async () => {
    if (loading || loadingMore || !hasOlder) return;
    const body       = bodyRef.current;
    const prevHeight = body?.scrollHeight ?? 0;
    setLoadingMore(true);
    try {
      const nextOffset = Math.max(0, listOffset - COMMENTS_PAGE_SIZE);
      const page       = await fetchConfigComments(configId, { offset: nextOffset, parentId: null });
      setRoots((prev) => {
        const seen    = new Set(prev.map((comment) => comment.id));
        const prepend = page.comments.filter((comment) => !seen.has(comment.id));
        return prepend.length ? [...prepend, ...prev]: prev;
      });
      setListOffset(nextOffset);
      setHasMore(page.hasMore || nextOffset > 0);
      if (page.totalCount !== null) setRootTotal(page.totalCount);
      requestAnimationFrame(() => {
        if (body) body.scrollTop += body.scrollHeight - prevHeight;
      });
    } catch {
      toast.error({ title: "Couldn't load earlier comments", body: 'Try again in a moment.' });
    } finally {
      setLoadingMore(false);
    }
  }, [configId, hasOlder, listOffset, loading, loadingMore]);

  const jumpToLatest = useCallback(async () => {
    const total = rootTotal ?? rootsRef.current.length;
    if (total === 0) return;
    setLoadingMore(true);
    try {
      const offset = Math.max(0, total - COMMENTS_PAGE_SIZE);
      const page   = await fetchConfigComments(configId, { offset, parentId: null });
      setRoots(page.comments);
      setListOffset(offset);
      setHasMore(page.hasMore);
      if (page.totalCount !== null) setRootTotal(page.totalCount);
      requestAnimationFrame(scrollToBottom);
    } catch {
      toast.error({ title: "Couldn't load latest comments", body: 'Try again in a moment.' });
    } finally {
      setLoadingMore(false);
    }
  }, [configId, rootTotal, scrollToBottom]);

  const loadReplies = useCallback(
    async (parentId: string, append = false) => {
      setLoadingReplies((prev) => new Set(prev).add(parentId));
      try {
        const offset = append ? (repliesByParent[parentId]?.length ?? 0) : 0;
        const page   = await fetchConfigComments(configId, { offset, parentId });
        setRepliesByParent((prev) => {
          const existing = append ? (prev[parentId] ?? []) : [];
          const seen     = new Set(existing.map((comment) => comment.id));
          const next     = page.comments.filter((comment) => !seen.has(comment.id));
          return { ...prev, [parentId]: append ? [...existing, ...next] : page.comments };
        });
        setRepliesHasMore((prev) => ({ ...prev, [parentId]: page.hasMore }));
      } catch {
        toast.error({ title: "Couldn't load replies", body: 'Try again in a moment.' });
      } finally {
        setLoadingReplies((prev) => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }
    },
    [configId, repliesByParent],
  );

  const toggleThread = useCallback(
    async (parent: CommunityComment) => {
      const expanded = expandedThreads.has(parent.id);
      if (expanded) {
        setExpandedThreads((prev) => {
          const next = new Set(prev);
          next.delete(parent.id);
          return next;
        });
        return;
      }
      setExpandedThreads((prev) => new Set(prev).add(parent.id));
      if (!repliesByParent[parent.id]) {
        await loadReplies(parent.id);
      }
    },
    [expandedThreads, loadReplies, repliesByParent],
  );

  useEffect(() => {
    let cancelled = false;
    initialScrollDoneRef.current = false;
    setLoading(true);
    setRoots([]);
    setListOffset(0);
    setHasMore(false);
    setRootTotal(null);
    setExpandedThreads(new Set());
    setRepliesByParent({});
    setRepliesHasMore({});
    setReplyTarget(null);
    setEditingId(null);

    currentAuthSession()
      .then((next) => { if (!cancelled) setSession(next); })
      .catch((e) => {
        logSilentFailure('comments.session', e);
        if (!cancelled) setSession(null);
      });

    const loadInitial = async () => {
      try {
        const probe = await fetchConfigComments(configId, { offset: 0, limit: 1, parentId: null });
        if (cancelled) return;
        const total = probe.totalCount ?? 0;
        setRootTotal(total);
        if (total > COMMENTS_PAGE_SIZE) {
          const offset = total - COMMENTS_PAGE_SIZE;
          const page   = await fetchConfigComments(configId, { offset, parentId: null });
          if (cancelled) return;
          setRoots(page.comments);
          setListOffset(offset);
          setHasMore(page.hasMore);
        } else if (total > 0) {
          const page = await fetchConfigComments(configId, { offset: 0, parentId: null });
          if (cancelled) return;
          setRoots(page.comments);
          setListOffset(0);
          setHasMore(page.hasMore);
        } else {
          setRoots([]);
          setListOffset(0);
          setHasMore(false);
        }
      } catch (e) {
        if (cancelled) return;
        setRoots([]);
        setListOffset(0);
        setHasMore(false);
        toast.error(toastFromError(e, { title: "Couldn't load comments" }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInitial();
    return () => { cancelled = true; };
  }, [configId]);

  useEffect(() => {
    if (loading || initialScrollDoneRef.current || roots.length === 0) return;
    requestAnimationFrame(() => {
      scrollToBottom();
      initialScrollDoneRef.current = true;
    });
  }, [loading, roots.length, scrollToBottom]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    const body     = bodyRef.current;
    if (!sentinel || !body || loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { root: body, rootMargin: '0px 0px 120px 0px', threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading, roots.length]);

  const post = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    const parent = replyTarget;
    setPosting(true);
    try {
      await postConfigComment(configId, body, parent?.id ?? null);
      setDraft('');
      setReplyTarget(null);
      onCommentCountChange?.(1);

      if (parent) {
        setExpandedThreads((prev) => new Set(prev).add(parent.id));
        await loadReplies(parent.id, false);
        setRoots((prev) =>
          prev.map((root) => (root.id === parent.id ? { ...root, replyCount: root.replyCount + 1 } : root)),
        );
        requestAnimationFrame(scrollToBottom);
      } else {
        const atLatest = !hasMore && (rootTotal === null || listOffset + rootsRef.current.length >= rootTotal);
        if (atLatest) {
          await loadRoots(listOffset + rootsRef.current.length, 'append');
          requestAnimationFrame(scrollToBottom);
        } else {
          await jumpToLatest();
        }
      }
    } catch (e) {
      toast.error(toastFromError(e, { title: "Couldn't post your comment" }));
    } finally {
      setPosting(false);
    }
  };

  const saveEdit = async () => {
    if (!editingId || !editDraft.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await updateConfigComment(editingId, editDraft.trim());
      const now          = new Date().toISOString();
      const patch        = (comment: CommunityComment) =>
            comment.id === editingId ? { ...comment, body: editDraft.trim(), updatedAt: now } : comment;
      setRoots((prev) => prev.map(patch));
      setRepliesByParent((prev) => {
        const next: Record<string, CommunityComment[]> = {};
        for (const [parentId, replies] of Object.entries(prev)) {
          next[parentId] = replies.map(patch);
        }
        return next;
      });
      setEditingId(null);
      setEditDraft('');
    } catch (e) {
      toast.error(toastFromError(e, { title: "Couldn't update comment" }));
    } finally {
      setSavingEdit(false);
    }
  };

  const removeComment = async (comment: CommunityComment) => {
    if (deletingId) return;
    const confirmed = await confirmIfEnabled(
      {
        title: 'Delete this comment?',
        body : comment.replyCount > 0 ? 'Its replies will be removed too.': 'This cannot be undone.',
        icon : 'warning',
      },
      'Delete',
    );
    if (!confirmed) return;

    setDeletingId(comment.id);
    try {
      await deleteConfigComment(comment.id);
      const removedCount = 1 + (comment.parentId ? 0 : comment.replyCount);
      onCommentCountChange?.(-removedCount);

      if (comment.parentId) {
        setRepliesByParent((prev) => ({
          ...prev,
          [comment.parentId!]: (prev[comment.parentId!] ?? []).filter((reply) => reply.id !== comment.id),
        }));
        setRoots((prev) =>
          prev.map((root) =>
            root.id === comment.parentId ? { ...root, replyCount: Math.max(0, root.replyCount - 1) } : root,
          ),
        );
      } else {
        setRoots((prev) => prev.filter((root) => root.id !== comment.id));
        setExpandedThreads((prev) => {
          const next = new Set(prev);
          next.delete(comment.id);
          return next;
        });
        setRepliesByParent((prev) => {
          const next = { ...prev };
          delete next[comment.id];
          return next;
        });
        if (rootTotal !== null) setRootTotal(rootTotal - 1);
      }
    } catch (e) {
      toast.error(toastFromError(e, { title: "Couldn't delete comment" }));
    } finally {
      setDeletingId(null);
    }
  };

  const showJumpToLatest   = 
        rootTotal        !== null && rootTotal > 0 && listOffset + roots.length < rootTotal;

  return (
    <motion.div
      className  = "dialog-backdrop configs-comments-backdrop"
      onClick    = {onClose}
      initial    = {{ opacity: 0 }}
      animate    = {{ opacity: 1 }}
      exit       = {{ opacity: 0 }}
      transition = {{ duration: 0.16 }}
      style      = {{ alignItems: 'flex-end' }}
    >
      <motion.div
        className  = "configs-comments-drawer"
        onClick    = {(e) => e.stopPropagation()}
        initial    = {{ y: '100%' }}
        animate    = {{ y: 0 }}
        exit       = {{ y: '100%' }}
        transition = {{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        <div  className = "glass-noise" aria-hidden                    = "true" />
        <div  className = "configs-comments-drawer-handle" aria-hidden = "true" />
        <div  className = "configs-comments-drawer-header">
        <div  className = "configs-comments-drawer-title">
        <span className = "configs-comments-drawer-label">Comments</span>
            {commentCount > 0 && <span className="configs-comments-count">{commentCount}</span>}
          </div>
          <div className = "configs-comments-drawer-actions">
            {showJumpToLatest && (
              <button type = "button" className = "configs-comments-jump-btn" onClick = {() => void jumpToLatest()} disabled = {loadingMore}>
                Latest
              </button>
            )}
            <button type    = "button" className            = "configs-comments-close-btn" onClick = {onClose} aria-label = "Close comments">
            <svg    viewBox = "0 0 24 24" fill              = "none" aria-hidden                   = "true" className     = "h-4 w-4">
            <path   d       = "M6 6l12 12M18 6L6 18" stroke = "currentColor" strokeWidth           = "2" strokeLinecap    = "round" />
              </svg>
            </button>
          </div>
        </div>

        <div className = "configs-comments-drawer-scroll">
        <div ref       = {bodyRef} className = "configs-comments-drawer-body">
            {loading ? (
            <p className        = "configs-comments-status">Loading comments...</p>
            )  : roots.length === 0 ? (
              <p className = "configs-comments-status">No comments yet.</p>
            ) : (
              <div className = "configs-comments-list">
                {hasOlder && (
                  <button
                    type      = "button"
                    className = "configs-comments-earlier-btn"
                    onClick   = {() => void loadEarlier()}
                    disabled  = {loadingMore}
                  >
                    Load earlier comments
                  </button>
                )}

                {roots.map((comment) => {
                  const expanded           = expandedThreads.has(comment.id);
                  const replies            = repliesByParent[comment.id] ?? [];
                  const repliesLoading     = loadingReplies.has(comment.id);
                  const canLoadMoreReplies = repliesHasMore[comment.id];

                  return (
                    <div key = {comment.id} className = "configs-comment-thread">
                      <CommentItem
                        comment           = {comment}
                        session           = {session}
                        editing           = {editingId === comment.id}
                        editDraft         = {editDraft}
                        onEditDraftChange = {setEditDraft}
                        onStartEdit       = {() => {
                          setEditingId(comment.id);
                          setEditDraft(comment.body);
                          setReplyTarget(null);
                        }}
                        onCancelEdit={() => {
                          setEditingId(null);
                          setEditDraft('');
                        }}
                        onSaveEdit = {() => void saveEdit()}
                        onDelete   = {() => void removeComment(comment)}
                        onReply    = {() => {
                          setReplyTarget({ id: comment.id, username: comment.discordUsername });
                          setEditingId(null);
                          composerRef.current?.focus();
                        }}
                        saving = {savingEdit}
                      />

                      {comment.replyCount > 0 && !expanded && (
                        <button type = "button" className = "configs-comment-replies-toggle" onClick = {() => void toggleThread(comment)}>
                          View {replyCountLabel(comment.replyCount)}
                        </button>
                      )}

                      {expanded && (
                        <div className = "configs-comment-replies">
                          {repliesLoading && replies.length === 0 ? (
                            <p className = "configs-comments-status">Loading replies...</p>
                          ) : (
                            replies.map((reply) => (
                              <CommentItem
                                key     = {reply.id}
                                comment = {reply}
                                nested
                                session           = {session}
                                editing           = {editingId === reply.id}
                                editDraft         = {editDraft}
                                onEditDraftChange = {setEditDraft}
                                onStartEdit       = {() => {
                                  setEditingId(reply.id);
                                  setEditDraft(reply.body);
                                  setReplyTarget(null);
                                }}
                                onCancelEdit={() => {
                                  setEditingId(null);
                                  setEditDraft('');
                                }}
                                onSaveEdit = {() => void saveEdit()}
                                onDelete   = {() => void removeComment(reply)}
                                onReply    = {() => {
                                  setReplyTarget({ id: comment.id, username: reply.discordUsername });
                                  setEditingId(null);
                                  composerRef.current?.focus();
                                }}
                                saving = {savingEdit}
                              />
                            ))
                          )}
                          {canLoadMoreReplies && (
                            <button
                              type      = "button"
                              className = "configs-comment-replies-toggle"
                              onClick   = {() => void loadReplies(comment.id, true)}
                              disabled  = {repliesLoading}
                            >
                              Load more replies
                            </button>
                          )}
                          <button type = "button" className = "configs-comment-replies-toggle" onClick = {() => void toggleThread(comment)}>
                            Hide replies
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {hasMore && <div ref={loadMoreRef} className="configs-comments-sentinel" aria-hidden="true" />}
              </div>
            )}
            {loadingMore && roots.length > 0 && <p className="configs-comments-loading-more">Loading more...</p>}
          </div>
        </div>

        {session ? (
          <div className = "configs-comments-composer-wrap">
            {replyTarget && (
              <div className = "configs-comments-replying">
                <span>{replyLabel(replyTarget.username)}</span>
                <button type = "button" className = "configs-comments-replying-cancel" onClick = {() => setReplyTarget(null)}>
                  Cancel
                </button>
              </div>
            )}
            <div className = "configs-comments-composer">
            <div className = "configs-comments-input-wrap">
                <textarea
                  ref      = {composerRef}
                  value    = {draft}
                  rows     = {2}
                  onChange = {(e) => {
                    setDraft(e.target.value);
                    setMentionCursor(e.target.selectionStart ?? e.target.value.length);
                  }}
                  onClick   = {(e) => setMentionCursor(e.currentTarget.selectionStart ?? draft.length)}
                  onKeyUp   = {(e) => setMentionCursor(e.currentTarget.selectionStart ?? draft.length)}
                  onKeyDown = {(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void post();
                    }
                  }}
                  placeholder = {replyTarget ? `Reply to @${replyTarget.username ?? 'user'}...` : 'Add a comment...'}
                  maxLength   = {500}
                  className   = "configs-comments-input"
                />
                {mentionOptions.length > 0 && mentionQuery !== null && (
                  <div className = "configs-comment-mention-menu">
                    {mentionOptions.map((name) => (
                      <button
                        key       = {name}
                        type      = "button"
                        className = "configs-comment-mention-option"
                        onClick   = {() => {
                          const next = insertMention(draft, mentionCursor, name);
                          setDraft(next.value);
                          setMentionCursor(next.cursor);
                          composerRef.current?.focus();
                        }}
                      >
                        <span className = "configs-comment-mention">@{name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type      = "button"
                className = "configs-comments-post-btn"
                onClick   = {() => void post()}
                disabled  = {posting || !draft.trim()}
              >
                Post
              </button>
            </div>
          </div>
        ) : (
          <p className = "configs-comments-signin-hint">Sign in to comment.</p>
        )}
      </motion.div>
    </motion.div>
  );
}