import { AnimatePresence, Reorder, motion, useDragControls }                                                                     from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal }                                                                                                          from 'react-dom';

import { open, save } from '@tauri-apps/plugin-dialog';

import { addAccount, exportAccountsTxt, forgetAccountSession, importAccountsTxt, listAccounts, loginAccount, removeAccount, reorderAccounts, setAccountCategory, setAccountFullAccess, setAccountNotes, setAccountRegion, updateAccount } from '../api/accounts';
import { onWorkflowLog }                                                                                                         from '../api/events';
import { getSettings, saveSettings }                                                                                             from '../api/settings';
import { cancelAction }                                                                                                          from '../api/workflow';

import { toast }                                                                                                                 from '../hooks/useToastStore';
import type { Account, LogLine, Settings }                                                                                       from '../types';
import { accountAvatarInitial, displayUsername }                                                                                 from '../utils/accountDisplay';
import { groupAccountsByCategory, distinctCategories, UNCATEGORIZED_KEY }                                                        from '../utils/accountCategories';
import { readPersistedRecord, writePersistedRecord }                                                                             from '../utils/persistedRecord';
import { CLIPBOARD_ACK_MS }                                                                                                      from '../constants/timing';
import { confirmIfEnabled }                                                                                                      from '../utils/confirmGate';
import { logSilentFailure }                                                                                                      from '../utils/silentError';
import { parseInvokeError, toastFromError, type UserFacingError }                                                                from '../utils/userError';
import { BASE_WINDOW_SIZE, tweenWindowSize }                                                                                     from '../utils/windowSize';
import { AccountCategorySection }                                                                                                from './AccountCategorySection';
import { AccountFormDialog }                                                                                                     from './AccountFormDialog';
import { LogPanel }                                                                                                              from './LogPanel';
import { PageHero }                                                                                                              from './PageHero';

import { Skeleton }                                                                                                              from './Skeleton';
import { Tooltip }                                                                                                               from './Tooltip';

interface Props {
  onLookup: (riotId: string) => void;
}

const ACCOUNTS_WINDOW_SIZE     = { width : 640, height : 860 };
const COMPACT_LIST_THRESHOLD   = 8;
const ANIMATE_LIST_THRESHOLD   = 15;
const DRAG_SELECT_THRESHOLD_PX = 4;
const DRAG_SCROLL_EDGE_PX      = 44;
const DRAG_SCROLL_SPEED_PX     = 14;
const ACCOUNTS_CATEGORY_STATE_KEY = 'accounts-category-state';

interface DragSelectState {
  active     : boolean;
  dragging   : boolean;
  anchorIndex: number;
  mode       : 'select' | 'deselect';
  pointerId  : number;
  startX     : number;
  startY     : number;
}

export function AccountsPage({ onLookup }: Props) {
  const [accounts, setAccounts]               = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountsLoadError, setAccountsLoadError] = useState<UserFacingError | null>(null);
  const [lines, setLines]                     = useState<LogLine[]>([]);
  const [adding, setAdding]                   = useState(false);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [loggingInId, setLoggingInId]         = useState<string | null>(null);
  const [copiedId, setCopiedId]               = useState<string | null>(null);
  const [formError, setFormError]             = useState<UserFacingError | null>(null);
  const [saving, setSaving]                   = useState(false);
  const [search, setSearch]                   = useState('');
  const [transferring, setTransferring]       = useState(false);
  const [selectionMode, setSelectionMode]     = useState(false);
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(() => new Set());
  const [bulkWorking, setBulkWorking]         = useState(false);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [hideUsernames, setHideUsernames]     = useState(false);
  const [categoryOpenState, setCategoryOpenState] = useState<Record<string, boolean>>({});
  const settingsRef                           = useRef<Settings | null>(null);

  const listRef                               = useRef<HTMLDivElement>(null);
  const dragSelectRef                         = useRef<DragSelectState | null>(null);
  const dragPointerYRef                       = useRef(0);
  const dragScrollRafRef                      = useRef<number | null>(null);
  const visibleRowsRef                        = useRef<Account[]>([]);
  const accountsRef                           = useRef<Account[]>([]);

  useEffect(() => {
    tweenWindowSize(ACCOUNTS_WINDOW_SIZE.width, ACCOUNTS_WINDOW_SIZE.height);
    return () => {
      tweenWindowSize(BASE_WINDOW_SIZE.width, BASE_WINDOW_SIZE.height);
    };
  }, []);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        settingsRef.current = settings;
        setHideUsernames(settings.hideAccountUsernames);
      })
      .catch((e) => {
        logSilentFailure('accounts.settings', e);
        settingsRef.current = null;
      });
  }, []);

  const toggleHideUsernames = async () => {
    if (!settingsRef.current) return;
    const next = !hideUsernames;
    setHideUsernames(next);
    const updated             = { ...settingsRef.current, hideAccountUsernames: next };
          settingsRef.current = updated;
    try {
      await saveSettings(updated);
    } catch (e) {
      setHideUsernames(!next);
      settingsRef.current = { ...updated, hideAccountUsernames: !next };
      toast.error(toastFromError(e, { title: "Couldn't save username visibility" }));
    }
  };

  useEffect(() => {
    listAccounts()
      .then((rows) => {
        setAccounts(rows);
        setAccountsLoadError(null);
      })
      .catch((e) => {
        const parsed = parseInvokeError(e);
        setAccountsLoadError(parsed);
        log('error', parsed.body ? `${parsed.title}. ${parsed.body}` : parsed.title);
      })
      .finally(() => setLoadingAccounts(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    onWorkflowLog((line) => setLines((prev) => [...prev, line])).then((fn) => {
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

  const log = (level: LogLine['level'], message: string) => {
    setLines((prev) => [...prev, { level, message }]);
  };

  const loginAbortRef = useRef(false);
  const loginIdRef    = useRef<string | null>(null);

  const login = async (account: Account) => {
    loginAbortRef.current = false;
    loginIdRef.current    = account.id;
    setLines([]);
    setLoggingInId(account.id);
    try {
      await loginAccount(account.id);
      setAccounts((prev) =>
        prev.map((row) => (row.id === account.id ? { ...row, hasSession: true } : row)),
      );
    } catch (error) {
      if (!loginAbortRef.current) {
        const parsed = parseInvokeError(error);
        if (parsed.code !== 'cancelled') {
          log('error', parsed.body ? `${parsed.title}. ${parsed.body}` : parsed.title);
        }
      }
    } finally {
      if (loginIdRef.current === account.id) {
        setLoggingInId(null);
        loginIdRef.current = null;
      }
      loginAbortRef.current = false;
    }
  };

  const cancelLogin = () => {
    loginAbortRef.current = true;
    void cancelAction();
  };

  const copyLabel = async (account: Account) => {
    await navigator.clipboard.writeText(account.label);
    setCopiedId(account.id);
    setTimeout(() => setCopiedId((current) => (current === account.id ? null : current)), CLIPBOARD_ACK_MS);
  };

  const endDragSelect = useCallback(() => {
    dragSelectRef.current = null;
    setIsDragSelecting(false);
    if (dragScrollRafRef.current !== null) {
      cancelAnimationFrame(dragScrollRafRef.current);
      dragScrollRafRef.current = null;
    }
  }, []);

  const exitSelectionMode = () => {
    endDragSelect();
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyDragRange = useCallback((anchorIndex: number, currentIndex: number, mode: 'select' | 'deselect') => {
    const accounts = visibleRowsRef.current;
    if (accounts.length === 0) return;

    const start    = Math.min(anchorIndex, currentIndex);
    const end      = Math.max(anchorIndex, currentIndex);
    const rangeIds = accounts.slice(start, end + 1).map((account) => account.id);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of rangeIds) {
        if (mode === 'select') next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const rowIndexAtPointer = useCallback((clientY: number) => {
    const list = listRef.current;
    if (!list) return null;

    const rows = list.querySelectorAll<HTMLElement>('[data-account-select-index]');
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const index = Number(row.dataset.accountSelectIndex);
        return Number.isFinite(index) ? index: null;
      }
    }

    return null;
  }, []);

  const stopDragScrollLoop = useCallback(() => {
    if (dragScrollRafRef.current !== null) {
      cancelAnimationFrame(dragScrollRafRef.current);
      dragScrollRafRef.current = null;
    }
  }, []);

  const autoScrollList = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const rect = list.getBoundingClientRect();
    const y    = dragPointerYRef.current;

    if (y < rect.top + DRAG_SCROLL_EDGE_PX) {
      list.scrollTop -= DRAG_SCROLL_SPEED_PX;
    } else if (y > rect.bottom - DRAG_SCROLL_EDGE_PX) {
      list.scrollTop += DRAG_SCROLL_SPEED_PX;
    }
  }, []);

  const startDragScrollLoop = useCallback(() => {
    stopDragScrollLoop();
    const tick = () => {
      const drag = dragSelectRef.current;
      if (!drag?.active || !drag.dragging) {
        dragScrollRafRef.current = null;
        return;
      }
      autoScrollList();
      const index = rowIndexAtPointer(dragPointerYRef.current);
      if (index !== null) {
        applyDragRange(drag.anchorIndex, index, drag.mode);
      }
      dragScrollRafRef.current = requestAnimationFrame(tick);
    };
    dragScrollRafRef.current = requestAnimationFrame(tick);
  }, [applyDragRange, autoScrollList, rowIndexAtPointer, stopDragScrollLoop]);

  const requestBulkRemove = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const         labels  = accounts.filter((account) => selectedIds.has(account.id)).map((account) => account.label);
    const         preview = 
    labels.length <= 3 ? labels.join(', ') : `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`;

    const confirmed = await toast.confirm(
      {
        title: `Remove ${ids.length} account${ids.length === 1 ? '' : 's'}?`,
        body : `This removes ${preview}. It won't sign you out of the Riot Client.`,
      },
      { confirmLabel: 'Remove', icon: 'error' },
    );
    if (!confirmed) return;

    setBulkWorking(true);
    const removedIds: string[] = [];
    const failures: string[]   = [];

    for (const id of ids) {
      const label = accounts.find((account) => account.id === id)?.label ?? id;
      try {
        await removeAccount(id);
        removedIds.push(id);
      } catch (e) {
        failures.push(`${label}: ${e}`);
      }
    }

    if (removedIds.length > 0) {
      setAccounts((prev) => prev.filter((account) => !removedIds.includes(account.id)));
      log('ok', `removed ${removedIds.length} account${removedIds.length === 1 ? '' : 's'}`);
    }
    if (failures.length > 0) {
      log('error', failures.join('\n'));
      toast.error({
        title: "Couldn't remove every account",
        body : failures.slice(0, 3).join('\n'),
      });
    } else if (removedIds.length > 0) {
      toast.success({
        title: 'Accounts removed',
        body : `Removed ${removedIds.length} account${removedIds.length === 1 ? '' : 's'}.`,
      });
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      removedIds.forEach((id) => next.delete(id));
      return next;
    });
    if (ids.length === removedIds.length) exitSelectionMode();
    setBulkWorking(false);
  };

  const requestBulkForget = async () => {
    const targets = accounts.filter((account) => selectedIds.has(account.id) && account.hasSession);
    if (targets.length === 0) return;

    const confirmed = await toast.confirm(
      {
        title: `Forget ${targets.length} saved session${targets.length === 1 ? '' : 's'}?`,
        body : 'These accounts stay in your list. Their next login will sign in fresh through the Riot Client.',
      },
      { confirmLabel: 'Forget sessions' },
    );
    if (!confirmed) return;

    setBulkWorking(true);
    const forgottenIds: string[] = [];
    const failures: string[]     = [];

    for (const account of targets) {
      try {
        await forgetAccountSession(account.id);
        forgottenIds.push(account.id);
      } catch (e) {
        failures.push(`${account.label}: ${e}`);
      }
    }

    if (forgottenIds.length > 0) {
      setAccounts((prev) =>
        prev.map((account) => (forgottenIds.includes(account.id) ? { ...account, hasSession: false } : account)),
      );
      log('ok', `forgot ${forgottenIds.length} saved session${forgottenIds.length === 1 ? '' : 's'}`);
    }
    if (failures.length > 0) {
      log('error', failures.join('\n'));
      toast.error({
        title: "Couldn't forget every session",
        body : failures.slice(0, 3).join('\n'),
      });
    } else if (forgottenIds.length > 0) {
      toast.success({
        title: 'Sessions forgotten',
        body : `Cleared ${forgottenIds.length} saved session${forgottenIds.length === 1 ? '' : 's'}.`,
      });
    }

    setBulkWorking(false);
  };

  const requestRemove = async (account: Account) => {
    const notice    = { title: `Remove ${account.label}?`, body: "This only removes it. it won't sign you out of the Riot Client." };
    const confirmed = await toast.confirm(notice, { confirmLabel: 'Remove', icon: 'error' });
    if (!confirmed) return;
    try {
      await removeAccount(account.id);
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      log('ok', `removed ${account.label}`);
    } catch (e) {
      log('error', parseInvokeError(e).log);
    }
  };

  const requestForget = async (account: Account) => {
    const notice = {
      title: `Forget saved session for ${account.label}?`,
      body : 'The account stays in your list. its next login will sign in fresh through the Riot Client and save a new session.',
    };
    const confirmed = await toast.confirm(notice, { confirmLabel: 'Forget session' });
    if (!confirmed) return;
    try {
      await forgetAccountSession(account.id);
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, hasSession: false } : a)));
      log('ok', `forgot the saved session for ${account.label}`);
    } catch (e) {
      log('error', parseInvokeError(e).log);
    }
  };

  const submitAdd = async (label: string, username: string, password: string, notes: string, fullAccess: boolean, category: string, region: string) => {
    setSaving(true);
    setFormError(null);
    try {
      const account = await addAccount(label, username, password);
      if (notes !== '') await setAccountNotes(account.id, notes);
      if (!fullAccess) await setAccountFullAccess(account.id, false);
      if (category !== '') await setAccountCategory(account.id, category);
      if (region !== '') await setAccountRegion(account.id, region);
      setAccounts((prev) => [...prev, { ...account, notes: notes || null, fullAccess, category: category || null, region: region || null }]);
      log('ok', `added ${label || username}`);
      setAdding(false);
    } catch (e) {
      setFormError(parseInvokeError(e));
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (label: string, username: string, password: string, notes: string, fullAccess: boolean, category: string, region: string) => {
    if (!editingId) return;
    if (password !== '') {
      const notice = { title: 'Change this account\'s password?', body: "Make sure you've got the new password right, or you won't be able to log in.", icon: 'error' as const };
      if (!(await confirmIfEnabled(notice, 'Change password'))) return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await updateAccount(editingId, label, username, password === '' ? null : password);
      await setAccountNotes(editingId, notes || null);
      await setAccountFullAccess(editingId, fullAccess);
      await setAccountCategory(editingId, category || null);
      await setAccountRegion(editingId, region || null);
      setAccounts((prev) => prev.map((account) => (account.id === editingId ? { ...account, label, username, notes: notes || null, fullAccess, category: category || null, region: region || null } : account)));
      log('ok', `updated ${label || username}`);
      setEditingId(null);
    } catch (e) {
      setFormError(parseInvokeError(e));
    } finally {
      setSaving(false);
    }
  };

  const closeAdd = () => {
    setAdding(false);
    setFormError(null);
  };

  const closeEdit = () => {
    setEditingId(null);
    setFormError(null);
  };

  const clearLogs = () => setLines([]);

  const exportAccounts = async () => {
    if (accounts.length === 0) {
      toast.error({ title: 'Nothing to export', body: 'Add at least one account first.' });
      return;
    }

    const path = await save({
      filters    : [{ name: 'Text file', extensions: ['txt'] }],
      defaultPath: 'accounts.txt',
    });
    if (!path) return;

    setTransferring(true);
    try {
      const result = await exportAccountsTxt(path);
      log('ok', `exported ${result.exported} account${result.exported === 1 ? '' : 's'}`);
      if (result.errors.length > 0) {
        toast.warning({
          title: 'Export finished with warnings',
          body : `${result.exported} account${result.exported === 1 ? '' : 's'} saved. ${result.errors.join(' ')}`,
        });
      } else {
        toast.success({
          title: 'Accounts exported',
          body : `Saved ${result.exported} account${result.exported === 1 ? '' : 's'} as a .txt file.`,
        });
      }
    } catch (e) {
      log('error', parseInvokeError(e).log);
      toast.error(toastFromError(e, { title: "Couldn't export accounts" }));
    } finally {
      setTransferring(false);
    }
  };

  const importAccounts = async () => {
    const path = await open({
      multiple: false,
      filters : [{ name: 'Text file', extensions: ['txt'] }],
      title   : 'Import accounts',
    });
    if (typeof path !== 'string') return;

    setTransferring(true);
    try {
      const result = await importAccountsTxt(path);
      if (result.added.length > 0) {
        setAccounts((prev) => [...prev, ...result.added]);
        log('ok', `imported ${result.added.length} account${result.added.length === 1 ? '' : 's'}`);
      }

      const summary = [
        result.added.length      > 0 ? `Added ${result.added.length}`                                                             : null,
        result.skippedDuplicates > 0 ? `Skipped ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? '' : 's'}`: null,
      ]
        .filter(Boolean)
        .join(' | ');

      if (result.added.length === 0 && result.skippedDuplicates === 0) {
        toast.error({
          title: 'Import failed',
          body : result.errors.join('\n') || 'No accounts were imported.',
        });
        return;
      }

      if (result.errors.length > 0) {
        toast.warning({
          title: 'Import finished with issues',
          body : [summary, result.errors.slice(0, 4).join('\n')].filter(Boolean).join('\n\n'),
        });
        return;
      }

      toast.success({
        title: 'Accounts imported',
        body : summary || 'Import complete.',
      });
    } catch (e) {
      log('error', parseInvokeError(e).log);
      toast.error(toastFromError(e, { title: "Couldn't import accounts" }));
    } finally {
      setTransferring(false);
    }
  };

  const editingAccount      = accounts.find((account) => account.id === editingId);
  const anyActionInProgress = loggingInId !== null;
  const controlsDisabled    = anyActionInProgress || transferring || bulkWorking;

  const query            = search.trim().toLowerCase();
  const filteredAccounts = query
    ? accounts.filter((a) => a.label.toLowerCase().includes(query) || a.username.toLowerCase().includes(query))
    :  accounts;

  const compact             = accounts.length >= COMPACT_LIST_THRESHOLD;
  const animateList         = filteredAccounts.length <= ANIMATE_LIST_THRESHOLD;
  const selectedCount       = selectedIds.size;
  const allFilteredSelected = filteredAccounts.length > 0 && filteredAccounts.every((account) => selectedIds.has(account.id));
  const selectedWithSession = accounts.filter((account) => selectedIds.has(account.id) && account.hasSession).length;
  const searchActive        = query.length > 0;
  const canReorder          = !searchActive && !selectionMode && !controlsDisabled && accounts.length > 1;
  const showDragHandle      = !selectionMode && accounts.length > 1;

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredAccounts.map((account) => account.id)));
  };

  const categoryGroups    = groupAccountsByCategory(filteredAccounts).filter((group) => group.accounts.length > 0);
  const existingCategories = distinctCategories(accounts);

  const isCategoryOpen = (key: string): boolean =>
    key in categoryOpenState ? categoryOpenState[key] : readPersistedRecord(ACCOUNTS_CATEGORY_STATE_KEY, key, true);

  const groupOpenByKey = new Map<string, boolean>();
  const visibleRows: Account[] = [];
  for (const group of categoryGroups) {
    const effectiveOpen = searchActive || isCategoryOpen(group.key);
    groupOpenByKey.set(group.key, effectiveOpen);
    if (effectiveOpen) visibleRows.push(...group.accounts);
  }
  const indexById = new Map(visibleRows.map((account, i) => [account.id, i]));

  const toggleCategory = (key: string) => {
    const next = !isCategoryOpen(key);
    writePersistedRecord(ACCOUNTS_CATEGORY_STATE_KEY, key, next);
    setCategoryOpenState((prev) => ({ ...prev, [key]: next }));
  };

  accountsRef.current    = accounts;
  visibleRowsRef.current = visibleRows;

  const handleCategoryReorder = (categoryKey: string, ids: string[]) => {
    if (!canReorder) return;
    setAccounts((prev) => {
      const groups = groupAccountsByCategory(prev);
      const target = groups.find((group) => group.key === categoryKey);
      if (target) {
        const byId      = new Map(target.accounts.map((account) => [account.id, account]));
        const reordered = ids
          .map((id) => byId.get(id))
          .filter((account): account is Account => account !== undefined);
        for (const account of target.accounts) {
          if (!ids.includes(account.id)) reordered.push(account);
        }
        target.accounts = reordered;
      }
      const next = groups.flatMap((group) => group.accounts);
      accountsRef.current = next;
      return next;
    });
  };

  const handleCategorySectionReorder = (orderedKeys: string[]) => {
    if (!canReorder) return;
    setAccounts((prev) => {
      const groups = groupAccountsByCategory(prev);
      const byKey  = new Map(groups.map((group) => [group.key, group]));
      const reorderedGroups = orderedKeys
        .map((key) => byKey.get(key))
        .filter((group): group is ReturnType<typeof groupAccountsByCategory>[number] => group !== undefined);
      const uncategorized = groups.filter((group) => group.key === UNCATEGORIZED_KEY);
      const next = [...reorderedGroups, ...uncategorized].flatMap((group) => group.accounts);
      accountsRef.current = next;
      return next;
    });
  };

  const renameCategory = async (oldKey: string, newTitle: string) => {
    const targets = accounts.filter((account) => (account.category ?? '').trim().toLowerCase() === oldKey);
    if (targets.length === 0) return;

    const renamedIds: string[] = [];
    const failures: string[]   = [];
    for (const account of targets) {
      try {
        await setAccountCategory(account.id, newTitle);
        renamedIds.push(account.id);
      } catch (e) {
        failures.push(`${account.label}: ${e}`);
      }
    }
    if (renamedIds.length > 0) {
      setAccounts((prev) => prev.map((account) => (renamedIds.includes(account.id) ? { ...account, category: newTitle } : account)));
      log('ok', `renamed category to ${newTitle}`);
    }
    if (failures.length > 0) {
      log('error', failures.join('\n'));
      toast.error({
        title: "Couldn't rename every account",
        body : failures.slice(0, 3).join('\n'),
      });
    }
  };

  const persistOrder = useCallback(() => {
    const ids = accountsRef.current.map((account) => account.id);
    void reorderAccounts(ids).catch((e) => {
      toast.error(toastFromError(e, { title: "Couldn't save account order" }));
      listAccounts()
        .then((rows) => {
          setAccounts(rows);
          accountsRef.current = rows;
        })
        .catch((reloadError) => logSilentFailure('accounts.reorder.reload', reloadError));
    });
  }, []);

  useEffect(() => {
    if (!selectionMode) endDragSelect();
  }, [selectionMode, endDragSelect]);

  useEffect(() => () => endDragSelect(), [endDragSelect]);

  const handleSelectPointerDown = (event: ReactPointerEvent<HTMLElement>, index: number | null, selected: boolean) => {
    if (controlsDisabled || index === null) return;

    dragSelectRef.current = {
      active     : true,
      dragging   : false,
      anchorIndex: index,
      mode       : selected ? 'deselect': 'select',
      pointerId  : event.pointerId,
      startX     : event.clientX,
      startY     : event.clientY,
    };
    dragPointerYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSelectPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragSelectRef.current;
    if (!drag?.active || event.pointerId !== drag.pointerId) return;

    dragPointerYRef.current = event.clientY;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.dragging && (Math.abs(dx) > DRAG_SELECT_THRESHOLD_PX || Math.abs(dy) > DRAG_SELECT_THRESHOLD_PX)) {
      drag.dragging = true;
      setIsDragSelecting(true);
      startDragScrollLoop();
    }

    if (!drag.dragging) return;

    const hoverIndex = rowIndexAtPointer(event.clientY);
    if (hoverIndex !== null) {
      applyDragRange(drag.anchorIndex, hoverIndex, drag.mode);
    }
  };

  const handleSelectPointerEnter = (event: ReactPointerEvent<HTMLElement>, index: number | null) => {
    const drag = dragSelectRef.current;
    if (!drag?.active || !drag.dragging || index === null || event.pointerId !== drag.pointerId) return;
    applyDragRange(drag.anchorIndex, index, drag.mode);
  };

  const handleSelectPointerUp = (event: ReactPointerEvent<HTMLElement>, accountId: string) => {
    const drag = dragSelectRef.current;
    if (!drag?.active || event.pointerId !== drag.pointerId) return;

    const wasDragging = drag.dragging;
    endDragSelect();

    if (!wasDragging) {
      toggleSelect(accountId);
    }
  };

  const renderCategoryGroup = (group: ReturnType<typeof groupAccountsByCategory>[number], reorderable: boolean) => (
    <AccountCategorySection
      key              = {group.key}
      categoryKey      = {group.key}
      title            = {group.title}
      count            = {group.accounts.length}
      open             = {groupOpenByKey.get(group.key) ?? true}
      forceOpen        = {searchActive}
      compact          = {compact}
      reorderable      = {reorderable}
      reorderEnabled   = {canReorder}
      searchActive     = {searchActive}
      onToggle         = {() => toggleCategory(group.key)}
      onRename         = {(newTitle) => renameCategory(group.key, newTitle)}
      onReorderDragEnd = {persistOrder}
    >
      <Reorder.Group
        as                   = "div"
        axis                 = "y"
        values               = {group.accounts.map((account) => account.id)}
        onReorder            = {(ids) => handleCategoryReorder(group.key, ids)}
        className            = {`account-category-list${compact ? ' account-category-list--compact' : ''}`}
        role                 = {selectionMode ? 'listbox' : undefined}
        aria-multiselectable = {selectionMode ? true : undefined}
      >
        {group.accounts.map((account) => {
          const index = indexById.get(account.id) ?? null;
          return (
            <AccountCard
              key                  = {account.id}
              account              = {account}
              index                = {index}
              compact              = {compact}
              animate              = {animateList}
              selectionMode        = {selectionMode}
              selected             = {selectedIds.has(account.id)}
              isLoggingIn          = {loggingInId === account.id}
              copied               = {copiedId === account.id}
              hideUsernames        = {hideUsernames}
              disabled             = {controlsDisabled}
              reorderEnabled       = {canReorder}
              showDragHandle       = {showDragHandle}
              searchActive         = {searchActive}
              onReorderDragEnd     = {persistOrder}
              onSelectPointerDown  = {(event) => handleSelectPointerDown(event, index, selectedIds.has(account.id))}
              onSelectPointerMove  = {handleSelectPointerMove}
              onSelectPointerEnter = {(event) => handleSelectPointerEnter(event, index)}
              onSelectPointerUp    = {(event) => handleSelectPointerUp(event, account.id)}
              onLogin              = {() => login(account)}
              onCopyLabel          = {() => copyLabel(account)}
              onLookup             = {() => onLookup(account.label)}
              onEdit               = {() => setEditingId(account.id)}
              onForget             = {() => requestForget(account)}
              onRemove             = {() => requestRemove(account)}
            />
          );
        })}
      </Reorder.Group>
    </AccountCategorySection>
  );

  const reorderableGroups = categoryGroups.filter((group) => group.key !== UNCATEGORIZED_KEY);
  const uncategorizedGroup = categoryGroups.find((group) => group.key === UNCATEGORIZED_KEY);

  return (
    <main className = "accounts-page" data-tauri-drag-region>
    <div  className = "accounts-content" data-tauri-drag-region>
        <PageHero
          title    = "Accounts"
          subtitle = "Saved Riot logins for Account Swapping."
          actions  = {
            <div    className = "accounts-hero-actions">
            <button type      = "button" className = "app-btn app-btn-secondary app-btn-compact" disabled = {controlsDisabled} onClick = {() => void importAccounts()}>
                Import
              </button>
              <button
                type      = "button"
                className = "app-btn app-btn-secondary app-btn-compact"
                disabled  = {controlsDisabled || accounts.length === 0}
                onClick   = {() => void exportAccounts()}
              >
                Export
              </button>
              <button type = "button" className = "app-btn app-btn-primary app-btn-compact" disabled = {controlsDisabled} onClick = {() => setAdding(true)}>
                Add account
              </button>
            </div>
          }
        />

        {!loadingAccounts && accounts.length > 0 && (
          <div className = "accounts-toolbar" data-tauri-drag-region>
            <input
              type        = "text"
              className   = "accounts-search"
              placeholder = "Search accounts..."
              value       = {search}
              onChange    = {(e) => setSearch(e.target.value)}
            />
            <span className = "accounts-toolbar-count">
              {selectionMode && selectedCount > 0
                ? `${selectedCount} selected`
                : filteredAccounts.length === accounts.length
                  ? `${accounts.length} account${accounts.length === 1 ? '' : 's'}`
                  : `${filteredAccounts.length} of ${accounts.length}`}
            </span>
            <Tooltip
              content={
                hideUsernames
                  ? 'Show login usernames on this page'
                  :  'Hide login usernames to avoid leaks when sharing your screen'
              }
            >
              <button
                type      = "button"
                className = "app-btn app-btn-secondary app-btn-compact accounts-toolbar-btn"
                onClick   = {() => void toggleHideUsernames()}
              >
                {hideUsernames ? 'Show usernames' : 'Hide usernames'}
              </button>
            </Tooltip>
            {selectionMode ? (
              <button
                type      = "button"
                className = "app-btn app-btn-secondary app-btn-compact accounts-toolbar-btn"
                disabled  = {controlsDisabled || filteredAccounts.length === 0}
                onClick   = {() => (allFilteredSelected ? setSelectedIds(new Set()) : selectAllFiltered())}
              >
                {allFilteredSelected ? 'Deselect all' : 'Select all'}
              </button>
            ) : (
              <button
                type      = "button"
                className = "app-btn app-btn-secondary app-btn-compact accounts-toolbar-btn"
                disabled  = {controlsDisabled}
                onClick   = {() => setSelectionMode(true)}
              >
                Select
              </button>
            )}
          </div>
        )}

        {selectionMode && (
          <div  className = "accounts-bulk-bar" data-tauri-drag-region>
          <span className = "accounts-bulk-summary">
              {selectedCount === 0
                ? 'Tap to select, or click and drag down the list'
                : `${selectedCount} selected`}
            </span>
            <div className = "accounts-bulk-actions">
              {selectedWithSession > 0 && (
                <button
                  type      = "button"
                  className = "app-btn app-btn-secondary app-btn-compact"
                  disabled  = {controlsDisabled || selectedCount === 0}
                  onClick   = {() => void requestBulkForget()}
                >
                  Forget sessions{selectedWithSession < selectedCount ? ` (${selectedWithSession})` : ''}
                </button>
              )}
              <button
                type      = "button"
                className = "app-btn app-btn-danger app-btn-compact"
                disabled  = {controlsDisabled || selectedCount === 0}
                onClick   = {() => void requestBulkRemove()}
              >
                Remove selected
              </button>
              <button type = "button" className = "app-btn app-btn-secondary app-btn-compact" disabled = {bulkWorking} onClick = {exitSelectionMode}>
                Done
              </button>
            </div>
          </div>
        )}

        <div className = "account-controls" data-tauri-drag-region>
          <div
            ref                  = {listRef}
            className            = {`account-list${compact ? ' account-list--compact' : ''}${isDragSelecting ? ' account-list--drag-selecting' : ''}`}
            role                 = {selectionMode ? 'listbox' : undefined}
            aria-multiselectable = {selectionMode ? true : undefined}
            data-tauri-drag-region
          >
            {loadingAccounts &&
              Array.from({ length: compact ? 6 : 3 }).map((_, i) => (
                <div      key       = {i} className              = "surface-card account-row" data-tauri-drag-region>
                <Skeleton width     = {compact ? 32 : 40} height = {compact ? 32 : 40} className = "rounded-full" />
                <div      className = "account-row-body" data-tauri-drag-region>
                <Skeleton width     = {120} height               = {compact ? 12 : 14} />
                <Skeleton width     = {80} height                = {11} />
                  </div>
                  <Skeleton width = {compact ? 56 : 72} height = {32} className = "rounded-full" />
                </div>
              ))}

            {!loadingAccounts && accountsLoadError && (
              <div className = "accounts-empty" data-tauri-drag-region>
                <p className = "accounts-empty-title">{accountsLoadError.title}</p>
                {accountsLoadError.body && <p className = "accounts-empty-hint">{accountsLoadError.body}</p>}
                <button
                  type      = "button"
                  className = "app-btn app-btn-secondary app-btn-compact"
                  onClick   = {() => {
                    setLoadingAccounts(true);
                    setAccountsLoadError(null);
                    listAccounts()
                      .then((rows) => {
                        setAccounts(rows);
                        setAccountsLoadError(null);
                      })
                      .catch((e) => setAccountsLoadError(parseInvokeError(e)))
                      .finally(() => setLoadingAccounts(false));
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {!loadingAccounts && !accountsLoadError && accounts.length === 0 && (
              <div className = "accounts-empty" data-tauri-drag-region>
              <div className = "accounts-empty-icon" aria-hidden = "true">
                  <UserIcon />
                </div>
                <p      className = "accounts-empty-title">No accounts saved yet</p>
                <p      className = "accounts-empty-hint">Add a Riot login to use Account Swap or sign in without typing credentials each time.</p>
                <button type      = "button" className = "app-btn app-btn-primary app-btn-compact" onClick = {() => setAdding(true)}>
                  Add account
                </button>
              </div>
            )}

            {!loadingAccounts && accounts.length > 0 && filteredAccounts.length === 0 && (
              <p className = "accounts-notice">No accounts match "{search}".</p>
            )}

            {!loadingAccounts && !accountsLoadError && reorderableGroups.length > 0 && (
              <Reorder.Group
                as        = "div"
                axis      = "y"
                values    = {reorderableGroups.map((group) => group.key)}
                onReorder = {handleCategorySectionReorder}
                className = "account-category-group-list"
              >
                {reorderableGroups.map((group) => renderCategoryGroup(group, true))}
              </Reorder.Group>
            )}
            {!loadingAccounts && !accountsLoadError && uncategorizedGroup && renderCategoryGroup(uncategorizedGroup, false)}
          </div>

          {anyActionInProgress && (
            <button type = "button" className = "app-btn app-btn-secondary app-btn-compact accounts-cancel-login" onClick = {cancelLogin}>
              Cancel login
            </button>
          )}
        </div>
      </div>

      <LogPanel
        lines            = {lines}
        onClear          = {clearLogs}
        emptyMessage     = "Account activity will show up here."
        defaultCollapsed = {false}
      />

      <AnimatePresence>
        {adding && (
          <AccountFormDialog
            key                = "adding"
            mode               = "add"
            existingCategories = {existingCategories}
            error              = {formError}
            saving             = {saving}
            onSave             = {submitAdd}
            onCancel           = {closeAdd}
          />
        )}
        {editingAccount && (
          <AccountFormDialog
            key                = "editing"
            mode               = "edit"
            initialLabel       = {editingAccount.label}
            initialUsername    = {editingAccount.username}
            initialNotes       = {editingAccount.notes ?? ''}
            initialFullAccess  = {editingAccount.fullAccess}
            initialCategory    = {editingAccount.category ?? ''}
            initialRegion      = {editingAccount.region ?? ''}
            existingCategories = {existingCategories}
            error              = {formError}
            saving             = {saving}
            onSave             = {submitEdit}
            onCancel           = {closeEdit}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function AccountCard({
  account,
  index,
  compact,
  animate,
  selectionMode,
  selected,
  isLoggingIn,
  copied,
  hideUsernames,
  disabled,
  reorderEnabled,
  showDragHandle,
  searchActive,
  onReorderDragEnd,
  onSelectPointerDown,
  onSelectPointerMove,
  onSelectPointerEnter,
  onSelectPointerUp,
  onLogin,
  onCopyLabel,
  onLookup,
  onEdit,
  onForget,
  onRemove,
}: {
  account             : Account;
  index               : number | null;
  compact             : boolean;
  animate             : boolean;
  selectionMode       : boolean;
  selected            : boolean;
  isLoggingIn         : boolean;
  copied              : boolean;
  hideUsernames       : boolean;
  disabled            : boolean;
  reorderEnabled      : boolean;
  showDragHandle      : boolean;
  searchActive        : boolean;
  onReorderDragEnd    : () => void;
  onSelectPointerDown : (event: ReactPointerEvent<HTMLElement>) => void;
  onSelectPointerMove : (event: ReactPointerEvent<HTMLElement>) => void;
  onSelectPointerEnter: (event: ReactPointerEvent<HTMLElement>) => void;
  onSelectPointerUp   : (event: ReactPointerEvent<HTMLElement>) => void;
  onLogin             : () => void;
  onCopyLabel         : () => void;
  onLookup            : () => void;
  onEdit              : () => void;
  onForget            : () => void;
  onRemove            : () => void;
}) {
  const dragControls = useDragControls();
  const className    = `surface-card account-row${compact ? ' account-row--compact' : ''}${selected ? ' account-row--selected' : ''}${selectionMode ? ' account-row--selectable' : ''}${showDragHandle ? ' account-row--reorderable' : ''}`;
  const sessionBadge = account.hasSession ? (
    <Tooltip content   = "Sign in uses a saved Riot session">
    <span    className = "app-badge app-badge-success">{compact ? 'Saved session' : 'Session saved'}</span>
    </Tooltip>
  ) : (
    <Tooltip content   = "Next login signs in fresh through the Riot Client">
    <span    className = "app-badge app-badge-muted">{compact ? 'No saved session' : 'Fresh login'}</span>
    </Tooltip>
  );
  const accessBadge = account.fullAccess ? (
    <Tooltip content   = "Full access">
    <span    className = "app-badge app-badge-primary">FA</span>
    </Tooltip>
  ) : (
    <Tooltip content   = "Not full access">
    <span    className = "app-badge app-badge-muted">NFA</span>
    </Tooltip>
  );
  const regionBadge = account.region ? (
    <Tooltip content   = "Region">
    <span    className = "app-badge app-badge-muted">{account.region}</span>
    </Tooltip>
  ) : null;

  const dragHandle = showDragHandle ? (
    <Tooltip content = {reorderEnabled ? 'Drag to reorder' : searchActive ? 'Clear search to reorder' : 'Reorder unavailable right now'}>
      <button
        type       = "button"
        className  = {`account-row-drag-handle${reorderEnabled ? '' : ' account-row-drag-handle--locked'}`}
        disabled   = {!reorderEnabled}
        aria-label = {reorderEnabled ? 'Drag to reorder' : searchActive ? 'Clear search to reorder' : 'Reorder unavailable'}
        onPointerDown = {(event) => {
          if (!reorderEnabled) return;
          event.preventDefault();
          dragControls.start(event);
        }}
      >
        <GripIcon />
      </button>
    </Tooltip>
  ) : null;

  const content = selectionMode ? (
    <div
      className                 = "account-row-select-label"
      data-account-select-index = {index === null ? undefined : index}
      role                      = "option"
      aria-selected             = {selected}
      onPointerDown             = {onSelectPointerDown}
      onPointerMove             = {onSelectPointerMove}
      onPointerEnter            = {onSelectPointerEnter}
      onPointerUp               = {onSelectPointerUp}
      onPointerCancel           = {onSelectPointerUp}
    >
      <input
        type      = "checkbox"
        className = "settings-checkbox account-row-checkbox"
        checked   = {selected}
        disabled  = {disabled}
        readOnly
        tabIndex    = {-1}
        aria-hidden = "true"
      />
      <div className = "account-row-avatar" aria-hidden = "true">
        {accountAvatarInitial(account.label)}
      </div>
      <div  className = "account-row-body">
      <div  className = "account-row-top">
      <span className = "account-row-label">{account.label}</span>
          {regionBadge}
          {accessBadge}
          {sessionBadge}
        </div>
        <span className = {`account-row-username${hideUsernames ? ' account-row-username--masked' : ''}`} aria-label = {hideUsernames ? 'Username hidden' : undefined}>
          {displayUsername(account.username, hideUsernames)}
        </span>
      </div>
    </div>
  ) : (
    <>
      {dragHandle}
      <div className = "account-row-avatar" aria-hidden = "true">
        {accountAvatarInitial(account.label)}
      </div>

      <div     className = "account-row-body" data-tauri-drag-region>
      <div     className = "account-row-top" data-tauri-drag-region>
      <Tooltip content   = {copied ? 'Copied!' : 'Click to copy display name'}>
      <button  type      = "button" className = "account-row-label account-row-label-copyable" onClick = {onCopyLabel}>
              {copied ? 'Copied!' : account.label}
            </button>
          </Tooltip>
          {regionBadge}
          {accessBadge}
        </div>
        <span className = {`account-row-username${hideUsernames ? ' account-row-username--masked' : ''}`} aria-label = {hideUsernames ? 'Username hidden' : undefined}>
          {displayUsername(account.username, hideUsernames)}
        </span>
        {account.notes && (
          <Tooltip content = {account.notes}>
            <span className = "account-row-notes">{account.notes}</span>
          </Tooltip>
        )}
      </div>

      <div     className = "account-row-actions" data-tauri-drag-region>
      <div     className = "account-row-main-actions">
      <Tooltip content   = {account.hasSession ? 'Sign in with saved session' : 'Sign in fresh and save a session'}>
      <button  type      = "button" className = "app-btn app-btn-primary app-btn-compact" disabled = {disabled} onClick = {onLogin}>
              {isLoggingIn ? 'Logging in...' : 'Login'}
            </button>
          </Tooltip>
          <div     className = "account-row-login-group">
          {sessionBadge}
          <div     className = "account-row-lookup-row">
          <Tooltip content = "Open this account in Tools">
          <button  type    = "button" className = "app-btn app-btn-secondary app-btn-compact" disabled = {disabled} onClick = {onLookup}>
              Lookup
            </button>
          </Tooltip>
          <AccountMoreMenu
            disabled   = {disabled}
            hasSession = {account.hasSession}
            onEdit     = {onEdit}
            onForget   = {onForget}
            onRemove   = {onRemove}
          />
          </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <Reorder.Item
      as            = "div"
      value         = {account.id}
      className     = {className}
      dragListener  = {false}
      dragControls  = {dragControls}
      drag          = {reorderEnabled ? 'y' : false}
      onDragEnd     = {() => {
        if (reorderEnabled) onReorderDragEnd();
      }}
      initial       = {animate ? { opacity: 0, y: 8 } : false}
      animate       = {animate ? { opacity: 1, y: 0 } : undefined}
      transition    = {animate ? { duration: 0.18, delay: Math.min(index ?? 0, 5) * 0.03, ease: [0.2, 0.7, 0.3, 1] } : undefined}
      {...(reorderEnabled ? {} : { 'data-tauri-drag-region': true })}
    >
      {content}
    </Reorder.Item>
  );
}

function AccountMoreMenu({
  disabled,
  hasSession,
  onEdit,
  onForget,
  onRemove,
}: {
  disabled  : boolean;
  hasSession: boolean;
  onEdit    : () => void;
  onForget  : () => void;
  onRemove  : () => void;
}) {
  const [open, setOpen]           = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const rootRef                   = useRef<HTMLDivElement>(null);
  const triggerRef                = useRef<HTMLButtonElement>(null);
  const menuRef                   = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu    = menuRef.current;
    if (!trigger || !menu) return;

    const rect       = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const menuWidth  = 188;
    const gap        = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const above      = spaceBelow < menuHeight && rect.top > menuHeight + gap;
    setOpenAbove(above);

    setMenuStyle({
      position  : 'fixed',
      top       : above ? rect.top - menuHeight - gap                                             : rect.bottom + gap,
      left      : Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8),
      width     : menuWidth,
      zIndex    : 50,
      visibility: 'visible',
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
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

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div     className = "account-more-menu" ref = {rootRef}>
    <Tooltip content   = "More actions">
        <button
          ref           = {triggerRef}
          type          = "button"
          className     = "account-more-trigger"
          disabled      = {disabled}
          onClick       = {() => setOpen((value) => !value)}
          aria-label    = "More actions"
          aria-expanded = {open}
        >
          <MoreIcon />
        </button>
      </Tooltip>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref        = {menuRef}
              className  = "account-more-dropdown"
              style      = {menuStyle}
              initial    = {{ opacity: 0, y: openAbove ? -6 : 6, scale: 0.97 }}
              animate    = {{ opacity: 1, y: 0, scale: 1 }}
              exit       = {{ opacity: 0, y: openAbove ? -6 : 6, scale: 0.97 }}
              transition = {{ duration: 0.14 }}
            >
              <button type = "button" className = "account-more-item" onClick = {() => run(onEdit)}>
                Edit account
              </button>
              {hasSession && (
                <button type = "button" className = "account-more-item" onClick = {() => run(onForget)}>
                  Forget saved session
                </button>
              )}
              <button type = "button" className = "account-more-item account-more-item-danger" onClick = {() => run(onRemove)}>
                Remove account
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function MoreIcon() {
  return (
    <svg    viewBox = "0 0 24 24" fill = "currentColor" aria-hidden = "true">
    <circle cx      = "6" cy           = "12" r                     = "1.6" />
    <circle cx      = "12" cy          = "12" r                     = "1.6" />
    <circle cx      = "18" cy          = "12" r                     = "1.6" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg    viewBox = "0 0 16 16" fill = "currentColor" aria-hidden = "true">
    <circle cx      = "5" cy           = "3" r                      = "1.25" />
    <circle cx      = "11" cy          = "3" r                      = "1.25" />
    <circle cx      = "5" cy           = "8" r                      = "1.25" />
    <circle cx      = "11" cy          = "8" r                      = "1.25" />
    <circle cx      = "11" cy          = "13" r                     = "1.25" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg    viewBox = "0 0 24 24" fill                         = "none" aria-hidden         = "true">
    <circle cx      = "12" cy                                  = "8" r                      = "3.2" stroke        = "currentColor" strokeWidth = "1.6" />
    <path   d       = "M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke = "currentColor" strokeWidth = "1.6" strokeLinecap = "round" />
    </svg>
  );
}

