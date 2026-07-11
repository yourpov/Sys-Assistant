import { AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

import { currentAuthSession, onAuthChanged } from '../api/auth';
import {
  deleteConfig,
  fetchCommunityConfigs,
} from '../api/communityConfigs';

import { useReactionListPatch } from '../hooks/useReactionListPatch';
import { toast } from '../hooks/useToastStore';
import type { AuthSession, CommunityConfig } from '../types';
import { CONFIGS_WINDOW_SIZE } from '../constants/windowSizes';
import { BASE_WINDOW_SIZE, tweenWindowSize } from '../utils/windowSize';
import { confirmIfEnabled } from '../utils/confirmGate';
import { logSilentFailure } from '../utils/silentError';
import { parseInvokeError, toastFromError, type UserFacingError } from '../utils/userError';
import { EmptyErrorState } from './ErrorDisplay';

import { CommentsDrawer } from './CommentsDrawer';
import { Dropdown } from './Dropdown';
import { Skeleton } from './Skeleton';
import { TABS, TYPE_FILTERS, TYPE_LABELS } from './configs/constants';
import {
  AccountMenu,
  ConfigCard,
  ConfigEditorView,
  ConfigOwnerActions,
  ThumbButtons,
} from './configs/ConfigSubcomponents';
import {
  AvatarFallbackIcon,
  cleanTitle,
  configDescription,
  ConfigBackBar,
  ConfigTabBar,
  ConfigTabPanel,
  isOwnConfig,
  posterDisplayName,
} from './configs/helpers';
import { toPreset } from './configs/preset';
import type { EditorTarget, Tab, TypeFilter } from './configs/types';

export function ConfigsPage() {

  const [configs, setConfigs]                   = useState<CommunityConfig[] | null>(null);
  const [selectedId, setSelectedId]             = useState<string | null>(null);
  const [activeTab, setActiveTab]               = useState<Tab>('Aimbot');
  const [commentsConfigId, setCommentsConfigId] = useState<string | null>(null);
  const [session, setSession]                   = useState<AuthSession | null>(null);
  const [error, setError]                       = useState<UserFacingError | null>(null);
  const [filterMine, setFilterMine]             = useState(false);
  const [typeFilter, setTypeFilter]             = useState<TypeFilter>('all');
  const [editorTarget, setEditorTarget]         = useState<EditorTarget | null>(null);
  const [deletingId, setDeletingId]             = useState<string | null>(null);

  const refreshConfigs = () => {
    fetchCommunityConfigs()
      .then(setConfigs)
      .catch((e) => setError(parseInvokeError(e)));
  };

  const patchReactionCounts = useReactionListPatch(setConfigs);

  const bumpCommentCount = (configId: string, delta = 1) => {
    setConfigs((prev) =>
      prev?.map((config) =>
        config.id === configId
          ? { ...config, commentCount: Math.max(0, config.commentCount + delta) }
          : config,
      ) ?? prev,
    );
  };

  const handleDeleteConfig = async (config: CommunityConfig) => {
    if (deletingId) return;
    if (!(await confirmIfEnabled({ title: 'Delete this config?', body: `"${config.name}" will be removed from the community board.` }, 'Delete'))) {
      return;
    }
    setDeletingId(config.id);
    try {
      await deleteConfig(config.id);
      setConfigs((prev) => prev?.filter((c) => c.id !== config.id) ?? prev);
      setSelectedId((id) => (id === config.id ? null : id));
      toast.success({ title: 'Config deleted' });
    } catch (e) {
      toast.error(toastFromError(e, { title: "Couldn't delete config" }));
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    tweenWindowSize(CONFIGS_WINDOW_SIZE.width, CONFIGS_WINDOW_SIZE.height);
    return () => {
      tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height);
    };
  }, []);

  useEffect(() => {
    refreshConfigs();
    currentAuthSession()
      .then(setSession)
      .catch((e) => {
        logSilentFailure('configs.session', e);
        setSession(null);
      });
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    onAuthChanged((next) => setSession(next)).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  if (error) {
    return (
      <main className = "configs-page" data-tauri-drag-region>
        <EmptyErrorState
          title      = {error.title}
          hint       = {error.body}
          onRetry    = {refreshConfigs}
          retryLabel = "Try again"
        />
      </main>
    );
  }

  if (!configs) {
    return (
      <main className = "configs-page" data-tauri-drag-region>
      <div  className = "configs-feed">
          {Array.from({ length: 4 }).map((_, i) => (
            <div      key       = {i} className = "configs-feed-card">
            <div      className = "configs-feed-card-header">
            <Skeleton width     = {30} height   = {30} className = "rounded-full" />
            <Skeleton width     = {90} height   = {11} />
              </div>
              <Skeleton width = "60%" height = {16} className = "mb-2" />
              <Skeleton width = "85%" height = {12} className = "mb-3" />
              <Skeleton width = {140} height = {28} className = "rounded-full" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (editorTarget) {
    return (
      <ConfigEditorView
        session       = {session}
        editingConfig = {editorTarget.kind === 'edit' ? editorTarget.config : undefined}
        onClose       = {() => setEditorTarget(null)}
        onSaved       = {() => {
          refreshConfigs();
          if (editorTarget.kind === 'create') setFilterMine(true);
        }}
      />
    );
  }

  const selected = selectedId ? configs.find((c) => c.id === selectedId) : null;

  if (selected) {
    const preset          = toPreset(selected);
    const postDescription = configDescription(selected);
    return (
      <main          className   = "configs-page" data-tauri-drag-region>
      <ConfigBackBar destination = {filterMine ? 'My configs' : 'All configs'} onBack = {() => setSelectedId(null)} />

        <div className = "configs-detail-panel drag-surface">
        <div className = "flex items-start justify-between gap-3 drag-surface">
            <div>
              <div className = "configs-feed-card-header" style = {{ marginBottom: 10 }}>
                {selected.discordAvatarUrl ? (
                  <img src = {selected.discordAvatarUrl} alt = "" className = "configs-auth-avatar large" draggable = {false} />
                ) : (
                  <div className = "configs-auth-avatar-fallback large">
                    <AvatarFallbackIcon />
                  </div>
                )}
                <span className = "configs-feed-card-author">{posterDisplayName(selected)}</span>
              </div>
              <h2 className = "text-base font-bold text-white">{cleanTitle(preset.name)}</h2>
              {postDescription && <p className="mt-1 text-xs text-app-faint">{postDescription}</p>}
            </div>
            <ThumbButtons
              config           = {selected}
              signedIn         = {session !== null}
              onOpenComments   = {() => setCommentsConfigId(selected.id)}
              onReactionChange = {patchReactionCounts}
            />
          </div>

          {isOwnConfig(selected, session) && (
            <ConfigOwnerActions
              onEdit   = {() => setEditorTarget({ kind: 'edit', config: selected })}
              onDelete = {() => void handleDeleteConfig(selected)}
              busy     = {deletingId === selected.id}
            />
          )}

          <ConfigTabBar   tabs   = {TABS} activeTab   = {activeTab} onChange = {setActiveTab} />
          <ConfigTabPanel preset = {preset} activeTab = {activeTab} />
        </div>

        <AnimatePresence>
          {commentsConfigId && (
            <CommentsDrawer
              configId             = {commentsConfigId}
              commentCount         = {selected.commentCount}
              onClose              = {() => setCommentsConfigId(null)}
              onCommentCountChange = {(delta) => bumpCommentCount(commentsConfigId, delta)}
            />
          )}
        </AnimatePresence>
      </main>
    );
  }

  const visibleConfigs = configs.filter(
    (c) => (!filterMine || c.userId === session?.userId) && (typeFilter === 'all' || c.type === typeFilter),
  );

  return (
    <main className = "configs-page" data-tauri-drag-region>
      {filterMine && <ConfigBackBar destination="All configs" onBack={() => setFilterMine(false)} />}

      <div className = "configs-feed-header drag-surface">
      <div className = "configs-feed-title drag-surface">
          <h2>{filterMine ? 'My configs' : 'Community Configs'}</h2>
          <p>
            {filterMine ? 'Configs you have shared with the community.' : 'Browse and review configs from the community.'}
          </p>
        </div>
        <div className = "configs-feed-header-actions">
          <button
            type      = "button"
            className = "configs-share-btn configs-share-btn-primary configs-share-btn-compact"
            onClick   = {() =>
              session
                ? setEditorTarget({ kind: 'create' })
                :  toast.error({ title: 'Sign in first', body: 'Use the profile menu to sign in before sharing a config.' })
            }
          >
            New config
          </button>
          <AccountMenu session = {session} onSessionChange = {setSession} filterMine = {filterMine} onToggleFilterMine = {() => setFilterMine((v) => !v)} />
        </div>
      </div>

      <div className = "configs-type-filters drag-surface">
        <Dropdown
          value         = {typeFilter}
          onChange      = {(v) => setTypeFilter(v as TypeFilter)}
          options       = {TYPE_FILTERS.map((type) => ({ value: type, label: type === 'all' ? 'All types' : TYPE_LABELS[type] }))}
          className     = "configs-type-dropdown"
          menuClassName = "configs-type-dropdown-menu"
        />
      </div>

      <div className = "configs-feed drag-surface">
        {visibleConfigs.length === 0 ? (
          <p className = "text-center text-xs text-app-ghost">No configs found.</p>
        ) : (
          visibleConfigs.map((c, index) => (
            <ConfigCard
              key              = {c.id}
              config           = {c}
              index            = {index}
              signedIn         = {session !== null}
              onOpen           = {() => setSelectedId(c.id)}
              onOpenComments   = {() => setCommentsConfigId(c.id)}
              onReactionChange = {patchReactionCounts}
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {commentsConfigId && (
          <CommentsDrawer
            configId             = {commentsConfigId}
            commentCount         = {configs.find((c) => c.id === commentsConfigId)?.commentCount ?? 0}
            onClose              = {() => setCommentsConfigId(null)}
            onCommentCountChange = {(delta) => bumpCommentCount(commentsConfigId, delta)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}