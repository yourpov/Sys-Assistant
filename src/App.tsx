import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';

import { listAccounts } from './api/accounts';
import { getSettings }  from './api/settings';

import { AccountsPage } from './components/AccountsPage';

import { AutomatePage }      from './components/AutomatePage';
import { ConfigsPage }       from './components/ConfigsPage';
import { SettingsPage }      from './components/SettingsPage';
import { SceneViewport }     from './components/SceneViewport';
import { SplashScreen }      from './components/SplashScreen';
import { Titlebar }          from './components/Titlebar';
import { ToastContainer }    from './components/ToastContainer';
import { ToolsPage }         from './components/ToolsPage';
import { UpdateDialog }      from './components/UpdateDialog';
import { useDragRegionBlur } from './hooks/useDragRegionBlur';
import { useDragSurfaces }   from './hooks/useDragSurfaces';
import { useMouseGlow }      from './hooks/useMouseGlow';

import { setOsNotifications, toast }                                           from './hooks/useToastStore';
import { toastFromError }                                                        from './utils/userError';
import { useUpdater }                                                          from './hooks/useUpdater';
import { useWorkflow }                                                         from './hooks/useWorkflow';
import type { Page, SettingsTab, ToolsMatchSection, ToolsTab, WorkflowAction } from './types';
import { InteractiveBackground }                                               from './components/ui/interactive-background';
import { useMotionPreference }                                                 from './hooks/useMotionPreference';

import { initReduceMotion, syncReduceMotion, watchSystemReduceMotion }           from './utils/motionPreference';
import { logSilentFailure }                                                        from './utils/silentError';

export function App() {
  const [page, setPage]                               = useState<Page>('automate');
  const [showSplash, setShowSplash]                   = useState(true);
  const workflow                                      = useWorkflow();
  const updater                                       = useUpdater();
  const [pendingLookup, setPendingLookup]             = useState<string | null>(null);
  const [pendingToolsTab, setPendingToolsTab]         = useState<ToolsTab | null>(null);
  const [pendingMatchSection, setPendingMatchSection] = useState<ToolsMatchSection | null>(null);
  const [pendingSettingsTab, setPendingSettingsTab]   = useState<SettingsTab | null>(null);
  const [swapPreparing, setSwapPreparing]             = useState(false);
  const [sceneOpen, setSceneOpen]                     = useState(false);
  const shellRef                                      = useMouseGlow<HTMLDivElement>();
  const reduceMotion                                  = useMotionPreference();

  useDragRegionBlur();
  useDragSurfaces();

  useEffect(() => {
    initReduceMotion();
    return watchSystemReduceMotion();
  }, []);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setOsNotifications(settings.toastOsNotificationsEnabled);
        syncReduceMotion(settings.reduceAnimationsEnabled);
      })
      .catch((e) => logSilentFailure('boot.settings', e));
  }, []);

  const cancelAutomateWork = useCallback(() => {
    workflow.cancel();
    setSwapPreparing(false);
  }, [workflow]);

  const startAccountSwap = async () => {
    if (swapPreparing || workflow.running) return;
    workflow.beginWork();
    setSwapPreparing(true);
    try {
      const [accounts, settings] = await Promise.all([listAccounts(), getSettings()]);
      if (workflow.isAborted()) return;
      if (accounts.length === 0) {
        const notice = { title: 'No accounts saved yet', body: 'Account Swap needs at least one saved account. Add one on the Accounts page first.' };
        if (await workflow.confirmUnlessAborted(notice, { confirmLabel: 'Go to Accounts' })) {
          setPage('accounts');
        }
        return;
      }
      if (workflow.isAborted()) return;
      const pool = settings.accountSwapPool.filter((id) => accounts.some((a) => a.id === id));
      if (pool.length === 0) {
        const notice = {
          title: "Account Swap isn't set up",
          body : 'Choose which accounts to rotate through in Settings > Automation > Account Swap.',
        };
        if (await workflow.confirmUnlessAborted(notice, { confirmLabel: 'Go to Settings' })) {
          setPage('settings');
        }
        return;
      }
      if (workflow.isAborted()) return;
      await workflow.swap(pool);
    } catch (e) {
      if (!workflow.isAborted()) {
        toast.error(toastFromError(e, { title: "Account Swap couldn't run" }));
      }
    } finally {
      setSwapPreparing(false);
    }
  };

  const lookupAccount = (riotId: string) => {
    setPendingLookup(riotId);
    setPendingToolsTab('Lookup');
    setPage('tools');
  };

  const openSettingsTab = (tab: SettingsTab) => {
    setPendingSettingsTab(tab);
    setPage('settings');
  };

  const openToolsTab = (tab: ToolsTab, matchSection?: ToolsMatchSection) => {
    setPendingToolsTab(tab);
    setPendingMatchSection(matchSection ?? null);
    setPage('tools');
  };

  const handleAction = (action: WorkflowAction) => {
    if (action === 'closeAll') {
      void workflow.startConfirmed(
        action,
        {
          title: 'Close everything?',
          body: 'Closes VALORANT, Riot Client, the loader, and the current session.',
          icon: 'warning',
        },
        'Close All',
      );
      return;
    }
    void workflow.startProcess();
  };

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : (
    <div
      ref       = {shellRef}
      className = {`app-shell${page === 'automate' ? ' app-shell--automate' : ''}${reduceMotion ? ' app-shell--static-bg' : ''}`}
      data-tauri-drag-region
    >
      {!reduceMotion && (
        <>
          <InteractiveBackground pointerTargetRef={shellRef} />
          <div className="app-shell-glow" aria-hidden="true" />
        </>
      )}
      <ToastContainer />
      <Titlebar        page = {page} onSelectPage = {setPage} navDisabled = {workflow.running || swapPreparing} />
      <AnimatePresence mode = "wait">
        <motion.div
          key       = {page}
          className = "page-fade drag-surface"
          data-tauri-drag-region
          initial    = {reduceMotion ? false : { opacity: 0, y: 10 }}
          animate    = {reduceMotion ? undefined : { opacity: 1, y: 0 }}
          exit       = {reduceMotion ? undefined : { opacity: 0, y: -10, transition: { duration: 0.12 } }}
          transition = {reduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
        >
          {page === 'automate' ? (
            <AutomatePage
              workflow         = {workflow}
              swapPreparing    = {swapPreparing}
              onWorkflowAction = {handleAction}
              onAccountSwap    = {startAccountSwap}
              onCancelWork     = {cancelAutomateWork}
            />
          ) : page === 'accounts' ? (
          <AccountsPage onLookup   = {lookupAccount} />
          )             : page   === 'configs' ? (
            <ConfigsPage />
          ) : page === 'tools' ? (
            <ToolsPage
              initialQuery              = {pendingLookup}
              onInitialQueryConsumed    = {() => setPendingLookup(null)}
              initialTab                = {pendingToolsTab}
              initialMatchSection       = {pendingMatchSection}
              onToolsNavigationConsumed = {() => {
                setPendingToolsTab(null);
                setPendingMatchSection(null);
              }}
              onOpenSettings = {() => openSettingsTab('Tools')}
            />
          ) : (
            <SettingsPage
              initialTab           = {pendingSettingsTab}
              onInitialTabConsumed = {() => setPendingSettingsTab(null)}
              onOpenToolsMatch     = {() => openToolsTab('Match', 'Lobby')}
              onOpenScene          = {() => setSceneOpen(true)}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {sceneOpen && (
          <SceneViewport
            key="scene-viewer"
            onDismiss={() => setSceneOpen(false)}
            interactive
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {updater.status !== 'idle' && updater.version && (
          <UpdateDialog
            key       = "update"
            version   = {updater.version}
            notes     = {updater.notes}
            status    = {updater.status}
            progress  = {updater.progress}
            error     = {updater.error}
            onInstall = {updater.install}
            onDismiss = {updater.dismiss}
          />
        )}
      </AnimatePresence>
    </div>
      )}
    </MotionConfig>
  );
}
