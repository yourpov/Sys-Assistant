import { openUrl }                     from '@tauri-apps/plugin-opener';
import { AnimatePresence, motion }     from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import {
  onAuthChanged,
  onAuthError,
  signInAsGuest,
  signOut,
  startDiscordSignIn,
} from '../../api/auth';
import {
  createConfig,
  updateConfig,
} from '../../api/communityConfigs';

import { useConfigReaction }                                                              from '../../hooks/useConfigReaction';
import { toast }                                                                          from '../../hooks/useToastStore';
import { parseInvokeError, toastFromError, userError, type UserFacingError }              from '../../utils/userError';
import { ErrorDisplay }                                                                   from '../ErrorDisplay';
import type { AuthSession, CommunityConfig, ConfigPerspective, ConfigType }               from '../../types';
import { confirmIfEnabled }                                                               from '../../utils/confirmGate';


import { timeAgo }                                                                        from '../../utils/timeAgo';
import { Dropdown }                                                                       from '../Dropdown';
import { Tooltip }                                                                        from '../Tooltip';
import { CONFIG_PERSPECTIVES, CONFIG_TYPES, PERSPECTIVE_LABELS, TABS, TYPE_LABELS } from './constants';
import { cloneDefaultOffPreset, presetToPostData }                                        from './preset';
import type { Preset, ShareStep, Tab }                                                    from './types';
import {
  AvatarFallbackIcon,
  CommentIcon,
  configDescription,
  ConfigTabBar,
  ConfigTabPanel,
  editorSeedFromConfig,
  posterDisplayName,
  sessionCreditLabel,
  suggestedConfigTitle,
  ThumbDownIcon,
  ThumbUpIcon,
  typeBadgeText,
  cleanTitle,
  ConfigBackBar,
} from './helpers';

export function AccountMenu({
  session,
  onSessionChange,
  filterMine,
  onToggleFilterMine,
}: {
  session           : AuthSession | null;
  onSessionChange   : (session: AuthSession | null) => void;
  filterMine        : boolean;
  onToggleFilterMine: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    let cancelled      = false;
    let unlistenError  : (() => void) | undefined;
    let unlistenChanged: (() => void) | undefined;
    onAuthError((message) => {
      const parsed = parseInvokeError(message);
      toast.error({ title: "Couldn't sign in", body: parsed.body });
      setBusy(false);
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenError = fn;
    });
    onAuthChanged((next) => {
      if (next && !next.isGuest) {
        onSessionChange(next);
        setOpen(false);
      }
      setBusy(false);
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenChanged = fn;
    });
    return () => {
      cancelled = true;
      unlistenError?.();
      unlistenChanged?.();
    };
  }, [onSessionChange]);

  const signInWithDiscord = async () => {
    setBusy(true);
    try {
      await openUrl(await startDiscordSignIn());
    } catch (e) {
      toast.error(toastFromError(e, { title: "Couldn't sign in" }));
      setBusy(false);
    }
  };

  const continueAsGuest = async () => {
    setBusy(true);
    try {
      onSessionChange(await signInAsGuest());
      setOpen(false);
    } catch (e) {
      toast.error(toastFromError(e, { title: "Couldn't continue as guest" }));
    } finally {
      setBusy(false);
    }
  };

  const logOut = async () => {
    await signOut();
    onSessionChange(null);
    setOpen(false);
  };

  return (
    <div     className = "configs-account-menu" ref = {rootRef}>
    <Tooltip content   = {session ? 'Account menu' : 'Sign in'}>
    <button  type      = "button" className         = "configs-account-trigger" onClick = {() => setOpen((o) => !o)} aria-expanded = {open}>
          {session?.discordAvatarUrl ? (
            <img src = {session.discordAvatarUrl} alt = "" className = "configs-auth-avatar" draggable = {false} />
          ) : (
            <div className = "configs-auth-avatar-fallback">
              <AvatarFallbackIcon />
            </div>
          )}
        </button>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            className  = "configs-account-dropdown"
            initial    = {{ opacity: 0, y: -6, scale: 0.97 }}
            animate    = {{ opacity: 1, y: 0, scale: 1 }}
            exit       = {{ opacity: 0, y: -6, scale: 0.97 }}
            transition = {{ duration: 0.14 }}
          >
            {session ? (
              <>
                <div className = "configs-account-dropdown-identity">
                  {session.discordAvatarUrl ? (
                    <img src = {session.discordAvatarUrl} alt = "" className = "configs-auth-avatar" draggable = {false} />
                  ) : (
                    <div className = "configs-auth-avatar-fallback">
                      <AvatarFallbackIcon />
                    </div>
                  )}
                  <span className = "configs-auth-name">{session.isGuest ? 'Guest' : session.discordUsername}</span>
                </div>
                <button
                  type      = "button"
                  className = {`configs-account-item${filterMine ? ' active' : ''}`}
                  onClick   = {() => {
                    onToggleFilterMine();
                    setOpen(false);
                  }}
                >
                  My configs
                </button>
                <button type                     = "button" className = "configs-account-item" disabled>
                My      comments <span className = "configs-account-soon">Soon</span>
                </button>
                <button   type            = "button" className = "configs-account-item" disabled>
                Favorites <span className = "configs-account-soon">Soon</span>
                </button>
                <button type = "button" className = "configs-account-item configs-account-item-danger" onClick = {logOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  type      = "button"
                  className = "configs-auth-button configs-auth-button-discord"
                  onClick   = {signInWithDiscord}
                  disabled  = {busy}
                >
                  Sign in with Discord
                </button>
                <button type = "button" className = "configs-auth-button configs-auth-button-guest" onClick = {continueAsGuest} disabled = {busy}>
                  Continue as guest
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ThumbButtons({
  config,
  signedIn,
  onOpenComments,
  onReactionChange,
}: {
  config            : CommunityConfig;
  signedIn          : boolean;
  onOpenComments    : () => void;
  onReactionChange ?: (configId: string, delta: { likes: number; dislikes: number }) => void;
}) {
  const {
    displayReaction,
    displayLikes,
    displayDislikes,
    reactionReady,
    toggleReaction,
  } = useConfigReaction({
    configId        : config.id,
    likes           : config.likes,
    dislikes        : config.dislikes,
    signedIn,
    onReactionChange,
  });

  const signedOutHint = 'Sign in to like or dislike';

  return (
    <div     className = "flex items-center gap-2" onClick = {(e) => e.stopPropagation()}>
    <div     className = "configs-pill-bar">
    <Tooltip content   = {signedIn ? 'Like this config' : signedOutHint}>
          <button
            type      = "button"
            className = {`configs-pill-button${displayReaction === 1 ? ' active' : ''}`}
            onClick   = {(e) => { e.stopPropagation(); toggleReaction(1); }}
            disabled  = {!signedIn || !reactionReady}
          >
            <ThumbUpIcon active = {displayReaction === 1} /> {displayLikes}
          </button>
        </Tooltip>
        <span    className = "configs-pill-divider" />
        <Tooltip content   = {signedIn ? 'Dislike this config' : signedOutHint}>
          <button
            type      = "button"
            className = {`configs-pill-button${displayReaction === -1 ? ' active' : ''}`}
            onClick   = {(e) => { e.stopPropagation(); toggleReaction(-1); }}
            disabled  = {!signedIn || !reactionReady}
          >
            <ThumbDownIcon active = {displayReaction === -1} /> {displayDislikes}
          </button>
        </Tooltip>
      </div>
      <Tooltip content = "View comments">
        <button
          type      = "button"
          className = "configs-pill-bar configs-pill-button"
          onClick   = {(e) => {
            e.stopPropagation();
            onOpenComments();
          }}
        >
          <CommentIcon /> {config.commentCount}
        </button>
      </Tooltip>
    </div>
  );
}


export function ConfigEditorView({
  session,
  editingConfig,
  onClose,
  onSaved,
}: {
  session       : AuthSession | null;
  editingConfig?: CommunityConfig;
  onClose       : () => void;
  onSaved       : () => void;
}) {
  const isEdit                        = !!editingConfig;
  const seed                          = editingConfig ? editorSeedFromConfig(editingConfig) : null;
  const titleRef                      = useRef<HTMLInputElement>(null);
  const [step, setStep]               = useState<ShareStep>('build');
  const [name, setName]               = useState(() => seed?.name ?? '');
  const [nameTouched, setNameTouched] = useState(isEdit);
  const [description, setDescription] = useState(() => seed?.description ?? '');
  const [configType, setConfigType]   = useState<ConfigType>(() => seed?.configType ?? 'legit');
  const [perspective, setPerspective] = useState<ConfigPerspective | ''>(() => seed?.perspective ?? '');
  const [preset, setPreset]           = useState<Preset>(() => seed?.preset ?? cloneDefaultOffPreset());
  const [activeTab, setActiveTab]     = useState<Tab>('Aimbot');
  const [formError, setFormError]     = useState<UserFacingError | null>(null);
  const [posting, setPosting]         = useState(false);
  const [dirty, setDirty]             = useState(false);

  const previewBadge   = 
        configType   === 'rage'
      ? `${TYPE_LABELS.rage} | ${PERSPECTIVE_LABELS[perspective || 'first_person']}`
      :   TYPE_LABELS[configType];

  useEffect(() => {
    if (step === 'publish') titleRef.current?.focus();
  }, [step]);

  const goToPublish = () => {
    setFormError(null);
    if (!nameTouched) setName(suggestedConfigTitle(session, configType));
    setStep('publish');
  };

  const requestClose = async () => {
    if (dirty || step === 'publish') {
      const confirmed = await confirmIfEnabled(
        {
          title: isEdit ? 'Discard changes?'        : 'Discard this config?',
          body : isEdit ? 'Your edits will be lost.': 'Your draft will be lost.',
          icon : 'warning',
        },
        'Discard',
      );
      if (!confirmed) return;
    }
    onClose();
  };

  const publish = async () => {
    if (!session) {
      setFormError(userError(
        'sign_in_required',
        'Sign-in required',
        'Sign in with Discord or continue as guest from the profile menu, then try again.',
      ));
      return;
    }

    const title = name.trim();
    if (!title) {
      setFormError(userError(
        'input_invalid',
        'Your config needs a title',
        'Enter a title before publishing.',
      ));
      return;
    }

    const confirmed = await confirmIfEnabled(
      {
        title: isEdit ? 'Save changes?': 'Publish this config?',
        body : isEdit
          ? 'Your updates will go live on the community board.'
            :   'This will share your config with the community.',
        icon: 'warning',
      },
      isEdit ? 'Save': 'Publish',
    );
    if (!confirmed) return;

    const ragePerspective = configType === 'rage' ? perspective || 'first_person' : null;
    const payload         = presetToPostData(preset);

    setPosting(true);
    setFormError(null);
    try {
      if (isEdit && editingConfig) {
        await updateConfig(editingConfig.id, title, description.trim(), configType, ragePerspective, payload);
        toast.success({ title: 'Config updated', body: 'Your changes are live on the community board.' });
      } else {
        await createConfig(title, description.trim(), configType, ragePerspective, payload);
        toast.success({ title: 'Config shared', body: 'Your config is live on the community board.' });
      }
      onSaved();
      onClose();
    } catch (e) {
      setFormError(parseInvokeError(e));
    } finally {
      setPosting(false);
    }
  };

  return (
    <main className = "configs-page configs-page-editor" data-tauri-drag-region>
      <ConfigBackBar
        destination = {isEdit ? cleanTitle(editingConfig!.name) : 'Community Configs'}
        onBack      = {() => void requestClose()}
      />

      <div  className = "configs-detail-panel configs-share-view drag-surface">
      <div  className = "configs-share-steps" aria-label = "Post progress">
      <div  className = {`configs-share-step${step === 'build' ? ' active' : ' done'}`}>
      <span className = "configs-share-step-index">1</span>
            <span>Configure</span>
          </div>
          <div  className = "configs-share-step-line" aria-hidden = "true" />
          <div  className = {`configs-share-step${step === 'publish' ? ' active' : ''}`}>
          <span className = "configs-share-step-index">2</span>
            <span>{isEdit ? 'Save' : 'Publish'}</span>
          </div>
        </div>

        <div             className = "configs-share-scroll drag-surface">
        <AnimatePresence mode      = "wait">
            {step === 'build' ? (
              <motion.div
              key        = "build"
              className  = "configs-share-body drag-surface"
              initial    = {{ opacity: 0, x: -12 }}
              animate    = {{ opacity: 1, x: 0 }}
              exit       = {{ opacity: 0, x: -12 }}
              transition = {{ duration: 0.18 }}
            >
              <div className = "configs-share-view-header">
              <h2  className = "text-base font-bold text-white">{isEdit ? 'Edit config' : 'New config'}</h2>
              <p   className = "configs-share-view-hint">
                  {isEdit ? 'Update your settings, then save your changes.' : 'Configure it, then name and publish.'}
                </p>
              </div>

              <ConfigTabBar tabs = {TABS} activeTab = {activeTab} onChange = {setActiveTab} />
              <ConfigTabPanel
                preset    = {preset}
                activeTab = {activeTab}
                editable
                onPresetChange={(next) => {
                  setDirty(true);
                  setPreset(next);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key        = "publish"
              className  = "configs-share-body drag-surface"
              initial    = {{ opacity: 0, x: 12 }}
              animate    = {{ opacity: 1, x: 0 }}
              exit       = {{ opacity: 0, x: 12 }}
              transition = {{ duration: 0.18 }}
            >
              <div className = "configs-share-view-header">
              <h2  className = "text-base font-bold text-white">{isEdit ? 'Save changes' : 'Publish'}</h2>
              <p   className = "configs-share-view-hint">
                  {isEdit ? 'Review your title and description before saving.' : 'Name your config and add optional notes for the community.'}
                </p>
              </div>

              {!session && <p className="settings-error">Sign in to share a config with the community.</p>}
              {formError && <ErrorDisplay error = {formError} />}

              <div className = "configs-publish-preview">
              <div className = "configs-feed-card-header">
                  {session?.discordAvatarUrl ? (
                    <img src = {session.discordAvatarUrl} alt = "" className = "configs-auth-avatar large" draggable = {false} />
                  ) : (
                    <div className = "configs-auth-avatar-fallback large">
                      <AvatarFallbackIcon />
                    </div>
                  )}
                  <span className = "configs-feed-card-author">{session ? sessionCreditLabel(session) : 'You'}</span>
                  {previewBadge && <span className="configs-type-badge">{previewBadge}</span>}
                </div>
                <h3 className = "configs-feed-card-title">{cleanTitle(name.trim() || 'Untitled config')}</h3>
                {description.trim() ? (
                  <p className = "configs-feed-card-desc">{description.trim()}</p>
                ) : (
                  <p className = "configs-publish-preview-placeholder">No description yet</p>
                )}
              </div>

              <div   className = "configs-share-meta">
              <label className = "add-account-field">
                  <span>Title</span>
                  <input
                    ref      = {titleRef}
                    type     = "text"
                    value    = {name}
                    onChange = {(e) => {
                      setDirty(true);
                      setNameTouched(true);
                      setName(e.target.value);
                    }}
                    placeholder = {suggestedConfigTitle(session, configType)}
                    maxLength   = {60}
                  />
                </label>

                <label className = "add-account-field">
                  <span>Description (optional)</span>
                  <textarea
                    className = "tools-input settings-suggestion-textarea configs-share-description"
                    value     = {description}
                    onChange  = {(e) => {
                      setDirty(true);
                      setDescription(e.target.value);
                    }}
                    placeholder = "Notes or tips for people using this config"
                    rows        = {3}
                    maxLength   = {500}
                  />
                </label>

                <div   className = "configs-share-dialog-row">
                <label className = "add-account-field configs-share-dialog-field">
                    <span>Type</span>
                    <Dropdown
                      value    = {configType}
                      onChange = {(v) => {
                        const next = v as ConfigType;
                        setDirty(true);
                        setConfigType(next);
                        if (v !== 'rage') setPerspective('');
                        else setPerspective((current) => current || 'first_person');
                        if (!nameTouched) setName(suggestedConfigTitle(session, next));
                      }}
                      options = {CONFIG_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }))}
                    />
                  </label>

                  {configType === 'rage' && (
                    <label className = "add-account-field configs-share-dialog-field">
                      <span>Perspective</span>
                      <Dropdown
                        value    = {perspective || 'first_person'}
                        onChange = {(v) => {
                          setDirty(true);
                          setPerspective(v as ConfigPerspective);
                        }}
                        options = {CONFIG_PERSPECTIVES.map((value) => ({ value, label: PERSPECTIVE_LABELS[value] }))}
                      />
                    </label>
                  )}
                </div>

                {session && (
                  <p     className          = "configs-share-credit-preview">
                  Posted as <span className = "configs-share-credit-handle">{sessionCreditLabel(session)}</span>
                  </p>
                )}
              </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className = "configs-share-footer">
          {step === 'build' ? (
            <>
              <button type = "button" className = "configs-share-btn configs-share-btn-secondary" onClick = {() => void requestClose()}>
                Cancel
              </button>
              <button type = "button" className = "configs-share-btn configs-share-btn-primary" onClick = {goToPublish}>
                Continue
              </button>
            </>
          ) : (
            <>
              <button
                type      = "button"
                className = "configs-share-btn configs-share-btn-secondary"
                onClick   = {() => setStep('build')}
                disabled  = {posting}
              >
                Back to editor
              </button>
              <button
                type      = "button"
                className = "configs-share-btn configs-share-btn-primary"
                onClick   = {() => void publish()}
                disabled  = {posting || !session}
              >
                {posting ? (isEdit ? 'Saving...' : 'Publishing...') : isEdit ? 'Save changes' : 'Publish'}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export function ConfigOwnerActions({
  onEdit,
  onDelete,
  busy,
}: {
  onEdit   : () => void;
  onDelete : () => void;
  busy    ?: boolean;
}) {
  return (
    <div    className = "configs-owner-actions">
    <button type      = "button" className = "configs-share-btn configs-share-btn-secondary configs-share-btn-compact" onClick = {onEdit} disabled = {busy}>
        Edit
      </button>
      <button type = "button" className = "configs-share-btn configs-share-btn-danger configs-share-btn-compact" onClick = {onDelete} disabled = {busy}>
        {busy ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  );
}

export function ConfigCard({ config, index, signedIn, onOpen, onOpenComments, onReactionChange }: {
  config            : CommunityConfig;
  index             : number;
  signedIn          : boolean;
  onOpen            : () => void;
  onOpenComments    : () => void;
  onReactionChange ?: (configId: string, delta: { likes: number; dislikes: number }) => void;
}) {
  const badgeText       = typeBadgeText(config);
  const postDescription = configDescription(config);

  return (
    <motion.div
      className = "configs-feed-card"
      role      = "button"
      tabIndex  = {0}
      onClick   = {onOpen}
      onKeyDown = {(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      initial    = {{ opacity: 0, y: 16 }}
      animate    = {{ opacity: 1, y: 0 }}
      transition = {{ duration: 0.28, delay: Math.min(index, 8) * 0.04, ease: [0.2, 0.7, 0.3, 1] }}
      whileTap   = {{ scale: 0.985 }}
    >
      <div className = "configs-feed-card-header">
        {config.discordAvatarUrl ? (
          <img src = {config.discordAvatarUrl} alt = "" className = "configs-auth-avatar large" draggable = {false} />
        ) : (
          <div className = "configs-auth-avatar-fallback large">
            <AvatarFallbackIcon />
          </div>
        )}
        <div  className = "configs-feed-card-byline">
        <span className = "configs-feed-card-author">{posterDisplayName(config)}</span>
          {config.createdAt && <span className="configs-feed-card-time">{timeAgo(config.createdAt)}</span>}
        </div>
        {badgeText && <span className="configs-type-badge">{badgeText}</span>}
      </div>
      <h3 className = "configs-feed-card-title">{cleanTitle(config.name)}</h3>
      {postDescription ? (
        <p className = "configs-feed-card-desc">{postDescription}</p>
      ) : (
        <div className = "mb-3" />
      )}
      <ThumbButtons
        config           = {config}
        signedIn         = {signedIn}
        onOpenComments   = {onOpenComments}
        onReactionChange = {onReactionChange}
      />
    </motion.div>
  );
}

