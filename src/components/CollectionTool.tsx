import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { appendAppLog }                                                                                      from '../api/applog';
import { fetchCollection, getRiotClientStatus, openRiotClient }                                              from '../api/collection';

import {
  COLLECTION_CATEGORIES,
  COLLECTION_CATEGORY_HINTS,
  COLLECTION_CATEGORY_LABELS,
  COLLECTION_OPEN_RIOT_WAIT_HINT,
  COLLECTION_REFRESH_HINT,
  COLLECTION_SORT_ASC_HINT,
  COLLECTION_SORT_DESC_HINT,
}                                                                                                             from '../constants/collection';
import { COLLECTION_WINDOW_SIZE }                                                                              from '../constants/windowSizes';
import type {
  CollectionCategory,
  CollectionItem,
  CollectionSkinVariant,
  CollectionSnapshot,
  CollectionWeapon,
  RiotClientStatus,
} from '../types';
import {
  buddyDetailImage,
  buildWeaponSkinOptions,
  filterCollectionItems,
  formatOwnedTotal,
  formatSkinProgress,
  ownedSkinCountForWeapon,
  ownedSkinsForWeapon,
  playerCardDetailImage,
  playerCardTileImage,
  previewImage,
  sumCollectionCounts,
  variantPreviewImage,
  variantTileImage,
  weaponStatRows,
  weaponTooltip,
  type CollectionSkinOption,
} from '../utils/collectionLayout';
import { logUserFacingError, parseInvokeError, type UserFacingError }                                        from '../utils/userError';
import { toast }                                                                                             from '../hooks/useToastStore';
import { BASE_WINDOW_SIZE, tweenWindowSize }                                                                 from '../utils/windowSize';
import { EmptyErrorState, ErrorDisplay }                                                                     from './ErrorDisplay';
import { Skeleton }                                                                                          from './Skeleton';
import { Tooltip }                                                                                           from './Tooltip';
import { ToolsEmpty }                                                                                        from './ToolsUi';

const RIOT_STATUS_POLL_MS      = 3000;
const EMPTY_SKIN_VARIANTS: CollectionSkinVariant[] = [];

type SortOrder = 'asc' | 'desc';

let collectionRiotGateFlight: Promise<boolean> | null = null;

function coalesceCollectionRiotGate(run: () => Promise<boolean>): Promise<boolean> {
  if (collectionRiotGateFlight) return collectionRiotGateFlight;
  collectionRiotGateFlight = run().finally(() => {
    collectionRiotGateFlight = null;
  });
  return collectionRiotGateFlight;
}

function riotCollectionReady(status: RiotClientStatus): boolean {
  return status.running && status.loggedIn;
}

function accountLabel(snapshot: CollectionSnapshot | null): string | null {
  if (!snapshot?.accountName || !snapshot.accountTag) return null;
  return `${snapshot.accountName}#${snapshot.accountTag}`;
}

export function CollectionTool() {
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<UserFacingError | null>(null);
  const [snapshot, setSnapshot]                 = useState<CollectionSnapshot | null>(null);
  const [search, setSearch]                     = useState('');
  const [category, setCategory]                 = useState<CollectionCategory>('weapon_skins');
  const [sortOrder, setSortOrder]               = useState<SortOrder>('asc');
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);
  const [selectedSkinKey, setSelectedSkinKey]   = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId]     = useState<string | null>(null);
  const [riotStatus, setRiotStatus] = useState<RiotClientStatus>({ running : false, loggedIn : false });
  const riotReadyRef                  = useRef<boolean | null>(null);
  const refreshTokenRef               = useRef(0);

  const ensureRiotSession = useCallback(
    (): Promise<boolean> =>
      coalesceCollectionRiotGate(async () => {
        try {
          const status = await getRiotClientStatus();
          setRiotStatus(status);
          const ready = riotCollectionReady(status);
          riotReadyRef.current = ready;
          if (ready) return true;

          if (!status.running) {
            const confirmed = await toast.confirm(
              {
                title: "Riot Client isn't open",
                body : 'Collection reads your owned cosmetics from your local Riot Client session. Open it now?',
                icon : 'warning',
              },
              { confirmLabel: 'Open Riot Client' },
            );
            if (!confirmed) return false;

            try {
              await openRiotClient();
              const next = await getRiotClientStatus();
              setRiotStatus(next);
              riotReadyRef.current = riotCollectionReady(next);
              if (!next.loggedIn) {
                toast.info({
                  title: 'Sign in to Riot Client',
                  body : COLLECTION_OPEN_RIOT_WAIT_HINT,
                });
              }
              return riotCollectionReady(next);
            } catch (e) {
              logUserFacingError(parseInvokeError(e), 'collection');
              return false;
            }
          }

          toast.info({
            title: 'Sign in to Riot Client',
            body : COLLECTION_OPEN_RIOT_WAIT_HINT,
          });
          return false;
        } catch (e) {
          logUserFacingError(parseInvokeError(e), 'collection');
          return false;
        }
      }),
    [],
  );

  const refresh = useCallback(async () => {
    const token = ++refreshTokenRef.current;
    setLoading(true);
    setError(null);
    try {
      if (!(await ensureRiotSession())) return;

      const next = await fetchCollection();
      if (token !== refreshTokenRef.current) return;
      setSnapshot(next);
      if (next.catalogWarning) {
        void appendAppLog('warn', `[collection] catalog: ${next.catalogWarning}`).catch(() => {});
        toast.warning({
          title: "Some collection data couldn't load",
          body : 'Item names and icons may be missing until the next refresh. Details are in Developer Logs.',
        });
      }
      if (next.sessionWarning) {
        void appendAppLog('warn', `[collection] entitlements: ${next.sessionWarning}`).catch(() => {});
        toast.warning({
          title: "Your owned items couldn't load",
          body : "Riot didn't return your inventory this time. This can happen right after switching accounts. Try refreshing in a moment.",
        });
      }
    } catch (e) {
      if (token !== refreshTokenRef.current) return;
      setSnapshot(null);
      const parsed = parseInvokeError(e);
      logUserFacingError(parsed, 'collection');
      setError(parsed);
    } finally {
      if (token === refreshTokenRef.current) setLoading(false);
    }
  }, [ensureRiotSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;

    const pollRiotStatus = async () => {
      try {
        const status = await getRiotClientStatus();
        if (cancelled) return;

        const ready = riotCollectionReady(status);
        const prev  = riotReadyRef.current;
        riotReadyRef.current = ready;
        setRiotStatus(status);

        if (prev !== null && !prev && ready) {
          void refresh();
        }
      } catch {
      }
    };

    void pollRiotStatus();
    const interval = setInterval(() => void pollRiotStatus(), RIOT_STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    tweenWindowSize(COLLECTION_WINDOW_SIZE.width, COLLECTION_WINDOW_SIZE.height);
    return () => {
      tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height);
    };
  }, []);

  const weapons = snapshot?.weapons ?? [];
  const items   = snapshot?.items ?? [];

  useEffect(() => {
    if (!weapons.length) return;
    setSelectedWeaponId((current) => current ?? weapons[0]?.id ?? null);
  }, [weapons]);

  const selectedWeapon = useMemo(
    () => weapons.find((weapon) => weapon.id === selectedWeaponId) ?? weapons[0] ?? null,
    [weapons, selectedWeaponId],
  );

  const weaponSkinOptions = useMemo(() => {
    if (!selectedWeapon) return [];
    const owned    = ownedSkinsForWeapon(items, selectedWeapon);
    const options  = buildWeaponSkinOptions(selectedWeapon, owned);
    const query    = search.trim().toLowerCase();
    const filtered = query
      ? options.filter((option) => option.isDefault || option.name.toLowerCase().includes(query))
      :  options;
    return [...filtered].sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      const  cmp         = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [selectedWeapon, items, search, sortOrder]);

  useEffect(() => {
    if (category !== 'weapon_skins') return;
    if (!weaponSkinOptions.length) {
      setSelectedSkinKey(null);
      return;
    }
    setSelectedSkinKey((current) =>
      current && weaponSkinOptions.some((option) => option.key === current) ? current: weaponSkinOptions[0].key,
    );
  }, [category, weaponSkinOptions]);

  const categoryItems = useMemo(() => {
    let filtered                        = filterCollectionItems(items, category, search);
    if  (sortOrder === 'desc') filtered = [...filtered].reverse();
    return filtered;
  }, [items, category, search, sortOrder]);

  useEffect(() => {
    if (category === 'weapon_skins') return;
    if (!categoryItems.length) {
      setSelectedItemId(null);
      return;
    }
    setSelectedItemId((current) => (current && categoryItems.some((item) => item.id === current) ? current : categoryItems[0].id));
  }, [category, categoryItems]);

  const selectedSkin = weaponSkinOptions.find((option) => option.key === selectedSkinKey) ?? weaponSkinOptions[0] ?? null;
  const selectedItem = categoryItems.find((item) => item.id === selectedItemId) ?? categoryItems[0] ?? null;

  const account           = accountLabel(snapshot);
  const totalOwned        = snapshot ? sumCollectionCounts(snapshot.counts) : 0;
  const totalCatalog      = snapshot ? sumCollectionCounts(snapshot.totals) : 0;
  const canShowWeaponCatalog = weapons.length > 0;
  const topbarSummary = snapshot
    ? category === 'weapon_skins'
      ? formatOwnedTotal(snapshot.counts.weaponSkins, snapshot.totals.weaponSkins)
      : formatOwnedTotal(totalOwned, totalCatalog)
    : null;
  const riotSessionPending = !riotCollectionReady(riotStatus);

  return (
    <div    className = "collection-tool" data-tauri-drag-region>
    <div    className = "collection-shell" data-tauri-drag-region>
    <header className = "collection-topbar drag-surface" data-tauri-drag-region>
    <div    className = "collection-topbar-copy" data-tauri-drag-region>
              {snapshot ? (
                <div className = "collection-topbar-stats" data-tauri-drag-region>
                  {topbarSummary && (
                    <div className = "collection-topbar-stat" data-tauri-drag-region>
                      <span className = "app-badge app-badge-muted">Total:</span>
                      <span className = "collection-topbar-stat-value">{topbarSummary}</span>
                    </div>
                  )}
                  <div className = "collection-topbar-stat" data-tauri-drag-region>
                    <span className = "app-badge app-badge-muted">Account:</span>
                    <span className = "collection-topbar-stat-value">{account ?? 'Unknown'}</span>
                  </div>
                </div>
              ) : (
                <p className = "collection-topbar-subtitle">Owned cosmetics from your local Riot Client session.</p>
              )}
          </div>
          <div className = "collection-topbar-actions">
            <input
              type        = "text"
              className   = "collection-search tools-input"
              placeholder = "Search..."
              value       = {search}
              onChange    = {(e) => setSearch(e.target.value)}
              disabled    = {loading || error !== null}
            />
            <Tooltip content = {sortOrder === 'asc' ? COLLECTION_SORT_ASC_HINT : COLLECTION_SORT_DESC_HINT}>
              <button
                type      = "button"
                className = {`collection-sort-btn${sortOrder === 'desc' ? ' active' : ''}`}
                onClick   = {() => setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
                disabled  = {loading || error !== null}
              >
                {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
              </button>
            </Tooltip>
            <Tooltip content = {COLLECTION_REFRESH_HINT}>
              <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" onClick = {() => void refresh()} disabled = {loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </Tooltip>
          </div>
        </header>

        {snapshot?.sessionWarning && (
          <ErrorDisplay
            className = "settings-error drag-surface collection-data-warning"
            error     = {{ code: 'collection_session_warning', title: "Some of your owned items didn't load", body: snapshot.sessionWarning, log: snapshot.sessionWarning }}
            onRetry   = {() => void refresh()}
          />
        )}
        {snapshot?.catalogWarning && (
          <ErrorDisplay
            className = "settings-error drag-surface collection-data-warning"
            error     = {{ code: 'collection_catalog_warning', title: 'Some item names and icons may be missing', body: snapshot.catalogWarning, log: snapshot.catalogWarning }}
            onRetry   = {() => void refresh()}
          />
        )}

        <div className = "collection-workspace">
        <nav className = "collection-category-rail surface-card" aria-label = "Collection categories">
            {COLLECTION_CATEGORIES.map((entry) => {
              const label = COLLECTION_CATEGORY_LABELS[entry];
              const hint  = COLLECTION_CATEGORY_HINTS[entry];
              const count = snapshot
                ? formatOwnedTotal(snapshot.counts[countKey(entry)], snapshot.totals[countKey(entry)])
                : '-';

              return (
                <Tooltip key = {entry} content = {hint} block>
                  <button
                    type        = "button"
                    className   = {`collection-category-btn${category === entry ? ' active' : ''}`}
                    onClick     = {() => setCategory(entry)}
                    disabled    = {loading || error !== null}
                    aria-label  = {`${label}, ${count} owned`}
                  >
                    <span className = "app-badge app-badge-muted collection-category-btn-label">{label}</span>
                    <span className = "collection-category-btn-count" aria-hidden = "true">{count}</span>
                  </button>
                </Tooltip>
              );
            })}
          </nav>

          <section className = "collection-stage surface-card">
            {loading && <CollectionLoadingState category={category} />}

            {!loading && error && (
              <EmptyErrorState
                title      = {error.title}
                hint       = {error.body}
                onRetry    = {() => void refresh()}
                retryLabel = {loading ? 'Refreshing...' : 'Refresh'}
              />
            )}

            {!loading && !error && !snapshot && riotSessionPending && (
              <ToolsEmpty
                title = {riotStatus.running ? 'Sign in to Riot Client' : "Riot Client isn't open"}
                hint  = {
                  riotStatus.running
                    ? COLLECTION_OPEN_RIOT_WAIT_HINT
                    : 'Press Refresh and confirm when prompted to open Riot Client, then sign in.'
                }
              />
            )}

            {!loading && !error && snapshot && totalOwned === 0 && !canShowWeaponCatalog && (
              <ToolsEmpty
                title = "No owned cosmetics"
                hint  = "Your signed-in Riot account does not report any owned skins, buddies, cards, sprays, or titles."
              />
            )}

            {!loading && !error && snapshot && category === 'weapon_skins' && canShowWeaponCatalog && (
              <CollectionGunsView
                weapons        = {weapons}
                items          = {items}
                search         = {search}
                selectedWeapon = {selectedWeapon}
                selectedSkin   = {selectedSkin}
                skinOptions    = {weaponSkinOptions}
                onSelectWeapon = {setSelectedWeaponId}
                onSelectSkin   = {setSelectedSkinKey}
              />
            )}

            {!loading && !error && snapshot && category === 'weapon_skins' && !canShowWeaponCatalog && (
              <ToolsEmpty
                title = "Weapon list couldn't load"
                hint  = "Press Refresh to reload cosmetics from valorant-api.com."
              />
            )}

            {!loading && !error && snapshot && category !== 'weapon_skins' && (
              <CollectionItemsView
                category     = {category}
                items        = {categoryItems}
                search       = {search}
                selectedItem = {selectedItem}
                onSelectItem = {setSelectedItemId}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function countKey(category: CollectionCategory): keyof CollectionSnapshot['counts'] {
  switch (category) {
    case 'weapon_skins': 
      return 'weaponSkins';
    case 'gun_buddies': 
      return 'gunBuddies';
    case 'player_cards': 
      return 'playerCards';
    case 'sprays': 
      return 'sprays';
    case 'titles': 
      return 'titles';
  }
}

function CollectionLoadingState({ category }: { category: CollectionCategory }) {
  if (category === 'weapon_skins') {
    return (
      <div className = "collection-guns-layout collection-guns-layout--loading">
        <div className = "collection-weapon-rail">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key = {index} width = "100%" height = {76} className = "rounded-xl collection-skeleton-tile" />
          ))}
        </div>
        <div className = "collection-guns-main">
          <div className = "collection-preview-row">
            <div className = "collection-preview-panel">
              <Skeleton width = "100%" height = "100%" className = "rounded-xl collection-skeleton-fill" />
            </div>
            <aside className = "collection-weapon-stats-panel">
              <Skeleton width = "100%" height = "100%" className = "rounded-xl collection-skeleton-fill" />
            </aside>
          </div>
          <div className = "collection-skin-grid-wrap">
            <div className = "collection-skin-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key = {index} width = "100%" height = {148} className = "rounded-xl collection-skeleton-tile" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className = {`collection-items-layout collection-items-layout--loading collection-items-layout--${category}`}>
      <div className = "collection-items-grid">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key = {index} width = "100%" height = {108} className = "rounded-xl collection-skeleton-tile" />
        ))}
      </div>
      <aside className = "collection-detail-panel">
        <Skeleton width = "100%" height = "100%" className = "rounded-xl collection-skeleton-fill" />
      </aside>
    </div>
  );
}

type WeaponGroup = {
  weaponClass: string;
  weapons    : CollectionWeapon[];
};

function groupWeaponsByClass(weapons: CollectionWeapon[]): WeaponGroup[] {
  const groups: WeaponGroup[] = [];
  const indexByClass = new Map<string, number>();

  for (const weapon of weapons) {
    const existing = indexByClass.get(weapon.weaponClass);
    if (existing === undefined) {
      indexByClass.set(weapon.weaponClass, groups.length);
      groups.push({ weaponClass: weapon.weaponClass, weapons: [weapon] });
      continue;
    }
    groups[existing].weapons.push(weapon);
  }

  return groups;
}

function GroupChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className   = "collection-weapon-group-chevron"
      viewBox     = "0 0 24 24"
      fill        = "none"
      aria-hidden = "true"
      style       = {{ transform: expanded ? 'rotate(180deg)' : 'none' }}
    >
      <path d = "M6 9l6 6 6-6" stroke = "currentColor" strokeWidth = "2" strokeLinecap = "round" strokeLinejoin = "round" />
    </svg>
  );
}

function CollectionGunsView({
  weapons,
  items,
  search,
  selectedWeapon,
  selectedSkin,
  skinOptions,
  onSelectWeapon,
  onSelectSkin,
}: {
  weapons       : CollectionWeapon[];
  items         : CollectionItem[];
  search        : string;
  selectedWeapon: CollectionWeapon | null;
  selectedSkin  : CollectionSkinOption | null;
  skinOptions   : CollectionSkinOption[];
  onSelectWeapon: (weaponId: string) => void;
  onSelectSkin  : (skinKey: string) => void;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [weaponFilter, setWeaponFilter]           = useState('');
  const [collapsedClasses, setCollapsedClasses]   = useState<Set<string>>(
    () => new Set(weapons.map((weapon) => weapon.weaponClass)),
  );
  const selectedWeaponId = selectedWeapon?.id ?? null;
  const variants = selectedSkin?.variants ?? EMPTY_SKIN_VARIANTS;
  const skinKey = selectedSkin?.key ?? null;

  useEffect(() => {
    if (!skinKey || variants.length === 0) {
      setSelectedVariantId(null);
      return;
    }
    setSelectedVariantId((current) => {
      if (current && variants.some((variant) => variant.id === current && variant.owned)) {
        return current;
      }
      return variants.find((variant) => variant.owned)?.id ?? null;
    });
  }, [skinKey, variants]);

  const selectedVariant: CollectionSkinVariant | null =
    variants.find((variant) => variant.id === selectedVariantId && variant.owned) ?? null;

  const ownedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const weapon of weapons) {
      counts.set(weapon.id, ownedSkinCountForWeapon(items, weapon));
    }
    return counts;
  }, [weapons, items]);

  const weaponGroups = useMemo(() => {
    const query = weaponFilter.trim().toLowerCase();
    const filtered = query
      ? weapons.filter((weapon) => weapon.name.toLowerCase().includes(query))
      : weapons;
    return groupWeaponsByClass(filtered);
  }, [weapons, weaponFilter]);

  const ownedSkinsPerClass = useMemo(() => {
    const totals = new Map<string, number>();
    for (const weapon of weapons) {
      const owned = ownedSkinsForWeapon(items, weapon).length;
      totals.set(weapon.weaponClass, (totals.get(weapon.weaponClass) ?? 0) + owned);
    }
    return totals;
  }, [weapons, items]);

  if (!weapons.length) {
    return <ToolsEmpty title = "Weapon list couldn't load" hint = "Press Refresh to reload cosmetics from valorant-api.com." />;
  }

  const selectedSkinPreviewSrc = selectedVariant
    ? variantPreviewImage(selectedVariant)
    : selectedSkin
      ? previewImage(selectedSkin)
      : null;
  const selectedVideoUrl = selectedVariant?.videoUrl ?? null;
  const previewTitle = selectedVariant?.displayName ?? selectedSkin?.name ?? null;
  const stats                  = selectedWeapon ? weaponStatRows(selectedWeapon) : [];
  const selectedOwnedSkins     = selectedWeapon ? ownedCounts.get(selectedWeapon.id) ?? 1 : 0;
  const selectedTotalSkins     = selectedWeapon?.totalSkinCount ?? 0;
  const hasOwnedSkinsForWeapon = selectedWeapon
    ? ownedSkinsForWeapon(items, selectedWeapon).some(
        (item) => (item.skinId ?? item.id).toLowerCase() !== selectedWeapon.defaultSkinId.toLowerCase(),
      )
    : false;
  const ownedVariantCount = variants.filter((variant) => variant.owned).length;
  const weaponFilterActive = weaponFilter.trim().length > 0;

  const toggleWeaponGroup = (weaponClass: string) => {
    setCollapsedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(weaponClass)) {
        next.delete(weaponClass);
      } else {
        next.add(weaponClass);
      }
      return next;
    });
  };

  return (
    <div className = "collection-guns-layout">
    <div className = "collection-weapon-rail">
        <input
          type        = "text"
          className   = "collection-weapon-filter tools-input"
          placeholder = "Filter weapons..."
          value       = {weaponFilter}
          onChange    = {(e) => setWeaponFilter(e.target.value)}
          aria-label  = "Filter weapons"
        />
        <div className = "collection-weapon-rail-list" role = "listbox" aria-label = "Weapons">
          {weaponGroups.length === 0 ? (
            <p className = "collection-weapon-filter-empty">
              {weaponFilterActive ? 'No weapons match that name.' : 'No weapons available.'}
            </p>
          ) : (
            weaponGroups.map((group) => {
              const expanded = weaponFilterActive || !collapsedClasses.has(group.weaponClass);
              return (
              <div
                key       = {group.weaponClass}
                className = "collection-weapon-group"
                role      = "group"
                aria-label = {group.weaponClass}
              >
                <button
                  type          = "button"
                  className     = "collection-weapon-group-label"
                  onClick       = {() => toggleWeaponGroup(group.weaponClass)}
                  aria-expanded = {expanded}
                  disabled      = {weaponFilterActive}
                >
                  <span className = "collection-weapon-group-label-text">
                    <span>{group.weaponClass}</span>
                    {(ownedSkinsPerClass.get(group.weaponClass) ?? 0) > 0 && (
                      <span className = "collection-weapon-group-pill">{ownedSkinsPerClass.get(group.weaponClass)}</span>
                    )}
                  </span>
                  <GroupChevron expanded = {expanded} />
                </button>
                <div className = {`collection-weapon-group-body${expanded ? ' collection-weapon-group-body--open' : ''}`}>
                  <div className = "collection-weapon-group-body-inner">
                    {group.weapons.map((weapon) => {
                      const owned = ownedCounts.get(weapon.id) ?? 0;
                      return (
                        <Tooltip key = {weapon.id} content = {weaponTooltip(weapon, owned)} block>
                          <button
                            type          = "button"
                            role          = "option"
                            aria-selected = {weapon.id === selectedWeaponId}
                            className     = {`collection-weapon-card${weapon.id === selectedWeaponId ? ' active' : ''}`}
                            onClick       = {() => onSelectWeapon(weapon.id)}
                          >
                            <span className = "collection-weapon-card-icon-wrap">
                              {weapon.iconUrl ? (
                                <img src = {weapon.iconUrl} alt = "" className = "collection-weapon-card-icon" loading = "lazy" />
                              ) : (
                                <span className = "collection-weapon-card-fallback">{weapon.name.charAt(0)}</span>
                              )}
                            </span>
                            <span className = "collection-weapon-card-copy">
                              <span className = "collection-weapon-card-name">{weapon.name}</span>
                              <span className = "collection-weapon-card-class">{weapon.weaponClass}</span>
                              <span className = "collection-weapon-card-skins">
                                {formatSkinProgress(owned, weapon.totalSkinCount)}
                              </span>
                            </span>
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>

      <div className = "collection-guns-main">
      <div className = "collection-preview-row">
      <div className = "collection-preview-panel">
            {selectedSkin ? (
              <>
                <div className = "collection-preview-art">
                  {selectedVideoUrl ? (
                    <video
                      key      = {selectedVideoUrl}
                      src      = {selectedVideoUrl}
                      className = "collection-preview-image collection-preview-video"
                      autoPlay
                      loop
                      muted
                      playsInline
                      poster   = {selectedSkinPreviewSrc ?? undefined}
                    />
                  ) : selectedSkinPreviewSrc ? (
                    <img src = {selectedSkinPreviewSrc} alt = "" className = "collection-preview-image" />
                  ) : (
                    <div className = "collection-preview-fallback">{previewTitle ?? selectedSkin.name}</div>
                  )}
                </div>
                <div  className = "collection-preview-meta">
                <span className = "collection-preview-kicker">{selectedSkin.isDefault ? 'Default skin' : 'Weapon skin'}</span>
                <h2   className = "collection-preview-title">{previewTitle ?? selectedSkin.name}</h2>
                </div>
                {variants.length > 0 ? (
                  <div className = "collection-variants-wrap">
                    <div className = "collection-skin-strip-label">
                      <span>Variants</span>
                      <span className = "collection-skin-count">
                        {formatSkinProgress(ownedVariantCount, variants.length)}
                      </span>
                    </div>
                    <div className = "collection-variants-row" role = "listbox" aria-label = "Skin variants">
                      {variants.map((variant) => {
                        const tileImage = variantTileImage(variant);
                        const isActive = selectedVariantId === variant.id;
                        const label = variant.owned
                          ? variant.displayName
                          : `${variant.displayName} (locked)`;
                        return (
                          <Tooltip key = {variant.id} content = {label}>
                            <button
                              type          = "button"
                              role          = "option"
                              aria-selected = {isActive}
                              aria-disabled = {!variant.owned}
                              disabled      = {!variant.owned}
                              className     = {`collection-variant-swatch${isActive ? ' active' : ''}${variant.owned ? '' : ' is-locked'}`}
                              onClick       = {() => {
                                if (!variant.owned) return;
                                setSelectedVariantId(variant.id);
                              }}
                            >
                              {tileImage ? (
                                <img src = {tileImage} alt = "" className = "collection-variant-swatch-image" loading = "lazy" />
                              ) : (
                                <span className = "collection-variant-swatch-fallback">
                                  {variant.displayName.charAt(0)}
                                </span>
                              )}
                              {!variant.owned ? (
                                <span className = "collection-variant-lock" aria-hidden = "true">
                                  <svg viewBox = "0 0 16 16" width = "12" height = "12" fill = "currentColor">
                                    <path d = "M4.5 7V5.5a3.5 3.5 0 1 1 7 0V7h.75A1.75 1.75 0 0 1 14 8.75v4.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-4.5A1.75 1.75 0 0 1 3.75 7H4.5zm1.5 0h4V5.5a2 2 0 1 0-4 0V7z" />
                                  </svg>
                                </span>
                              ) : null}
                              {variant.owned && variant.videoUrl ? (
                                <span className = "collection-variant-video-badge" aria-hidden = "true">
                                  ▶
                                </span>
                              ) : null}
                            </button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <ToolsEmpty
                title = {search.trim() ? 'No matches' : 'No skins for this weapon'}
                hint  = {
                  search.trim()
                    ? 'Try a different search term or pick another weapon.'
                    :  'Select a weapon to view its default skin and stats.'
                }
              />
            )}
          </div>

          {selectedWeapon ? (
            <aside className = "collection-weapon-stats-panel" aria-label = "Weapon stats">
              {stats.length > 0 ? (
                <dl className = "collection-weapon-stats-grid">
                  {stats.map((stat) => (
                    <div key = {stat.label} className = "collection-weapon-stat">
                      <dt>{stat.label}</dt>
                      <dd>{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className = "collection-weapon-stats-empty">No combat stats for this weapon.</p>
              )}
            </aside>
          ) : null}
        </div>

        <div className = "collection-skin-grid-wrap">
        <div className = "collection-skin-strip-label">
            <span>{hasOwnedSkinsForWeapon ? 'Owned skins' : 'Skins'}</span>
            {selectedWeapon ? (
              <span className = "collection-skin-count">{formatSkinProgress(selectedOwnedSkins, selectedTotalSkins)}</span>
            ) : null}
          </div>
          {skinOptions.length > 0 ? (
            <div className = "collection-skin-grid" role = "listbox" aria-label = {hasOwnedSkinsForWeapon ? 'Owned skins' : 'Skins'}>
              {skinOptions.map((option) => {
                const tileImage = option.iconUrl ?? previewImage(option);
                const skinLabel = option.isDefault ? 'Default skin' : option.name;
                return (
                  <Tooltip key = {option.key} content = {option.name} block>
                    <button
                      type          = "button"
                      role          = "option"
                      aria-selected = {selectedSkin?.key === option.key}
                      className     = {`collection-skin-tile${selectedSkin?.key === option.key ? ' active' : ''}${option.isDefault ? ' is-default' : ''}`}
                      onClick       = {() => onSelectSkin(option.key)}
                    >
                      {tileImage ? (
                        <img src = {tileImage} alt = "" className = "collection-skin-tile-image" loading = "lazy" />
                      ) : (
                        <span className = "collection-skin-tile-fallback">{option.name.charAt(0)}</span>
                      )}
                      <span className = "collection-skin-tile-name">{skinLabel}</span>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <p className = "collection-skin-strip-empty">
              {search.trim() ? 'No skins match your search.' : 'No skins available for this weapon.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CollectionPlayerCardImage({
  src,
  variant,
}: {
  src     : string;
  variant : 'tile' | 'detail';
}) {
  return (
    <span className = {`collection-player-card-frame${variant === 'detail' ? ' collection-player-card-frame--detail' : ''}`}>
      <img
        src       = {src}
        alt       = ""
        className = {variant === 'detail' ? 'collection-detail-image' : 'collection-item-tile-image'}
        loading   = "lazy"
      />
    </span>
  );
}

function CollectionItemsView({
  category,
  items,
  search,
  selectedItem,
  onSelectItem,
}: {
  category    : CollectionCategory;
  items       : CollectionItem[];
  search      : string;
  selectedItem: CollectionItem | null;
  onSelectItem: (itemId: string) => void;
}) {
  if (!items.length) {
    const categoryLabel = COLLECTION_CATEGORY_LABELS[category].toLowerCase();
    return (
      <ToolsEmpty
        title = {search.trim() ? 'No matches' : `No owned ${categoryLabel}`}
        hint  = {
          search.trim()
            ? `Try a different search or switch to another ${categoryLabel} filter.`
            :  `You do not own any ${categoryLabel} on this account.`
        }
      />
    );
  }

  return (
    <div className = {`collection-items-layout collection-items-layout--${category}`}>
    <div className = "collection-items-grid" role = "listbox" aria-label = {COLLECTION_CATEGORY_LABELS[category]}>
        {items.map((item) => (
          <Tooltip key = {item.id} content = {item.name} block>
            <button
              type          = "button"
              role          = "option"
              aria-selected = {selectedItem?.id === item.id}
              className     = {`collection-item-tile${selectedItem?.id === item.id ? ' active' : ''}`}
              onClick       = {() => onSelectItem(item.id)}
            >
              {category === 'titles' ? (
                <span className = "collection-item-title-text">{item.name}</span>
              ) : category === 'player_cards' && playerCardTileImage(item) ? (
                <CollectionPlayerCardImage src = {playerCardTileImage(item)!} variant = "tile" />
              ) : category === 'gun_buddies' && buddyDetailImage(item) ? (
                <img src = {buddyDetailImage(item)!} alt = "" className = "collection-item-tile-image" loading = "lazy" />
              ) : previewImage(item) || item.iconUrl ? (
                <img src = {(previewImage(item) ?? item.iconUrl)!} alt = "" className = "collection-item-tile-image" loading = "lazy" />
              ) : (
                <span className = "collection-item-tile-fallback">{item.name.charAt(0)}</span>
              )}
              <span className = "collection-item-tile-name">{item.name}</span>
            </button>
          </Tooltip>
        ))}
      </div>

      <aside className = "collection-detail-panel">
        {selectedItem ? (
          <>
            <div className = {`collection-detail-art collection-detail-art--${category}`}>
              {category === 'titles' ? (
                <div className = "collection-detail-title-card">{selectedItem.name}</div>
              ) : category === 'player_cards' && playerCardDetailImage(selectedItem) ? (
                <CollectionPlayerCardImage src = {playerCardDetailImage(selectedItem)!} variant = "detail" />
              ) : category === 'gun_buddies' && buddyDetailImage(selectedItem) ? (
                <img
                  src       = {buddyDetailImage(selectedItem)!}
                  alt       = ""
                  className = "collection-detail-image"
                  loading   = "lazy"
                />
              ) : previewImage(selectedItem) || selectedItem.iconUrl ? (
                <img
                  src       = {(previewImage(selectedItem) ?? selectedItem.iconUrl)!}
                  alt       = ""
                  className = "collection-detail-image"
                  loading   = "lazy"
                />
              ) : (
                <div className = "collection-detail-fallback">{selectedItem.name}</div>
              )}
            </div>
            <div  className = "collection-detail-meta">
            <span className = "collection-detail-kicker">
                {COLLECTION_CATEGORY_LABELS[category]}
                {selectedItem.isDefault && <span className = "app-badge app-badge-muted collection-default-badge">Default</span>}
              </span>
            <h2   className = "collection-detail-title">{selectedItem.name}</h2>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}