import { AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

import { listAccounts } from './api/accounts';
import { fetchChangelog } from './api/changelog';
import { getSettings } from './api/settings';
import { AccountsPage } from './components/AccountsPage';
import { ActionGrid } from './components/ActionGrid';
import { ChangelogsPage } from './components/ChangelogsPage';
import { ConfigsPage } from './components/ConfigsPage';
import { ConfirmDialog } from './components/ConfirmDialog';
import { LogPanel } from './components/LogPanel';
import { ManualControls } from './components/ManualControls';
import { SettingsPage } from './components/SettingsPage';
import { SplashScreen } from './components/SplashScreen';
import { Titlebar } from './components/Titlebar';
import { ToolsPage } from './components/ToolsPage';
import { useMouseGlow } from './hooks/useMouseGlow';
import { useWorkflow } from './hooks/useWorkflow';
import type { IssueReport, Page } from './types';

type AccountSwapNotice = 'noAccounts' | 'notConfigured';

export function App() {
  const [page, setPage] = useState<Page>('automate');
  const [showSplash, setShowSplash] = useState(true);
  const workflow = useWorkflow();
  const glowRef = useMouseGlow<HTMLElement>();
  const [swapNotice, setSwapNotice] = useState<AccountSwapNotice | null>(null);
  const [pendingLookup, setPendingLookup] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string | null>(null);
  const [changelogError, setChangelogError] = useState<string | null>(null);
  const [swapPreparing, setSwapPreparing] = useState(false);
  const workflowDialog = workflow.needsReboot ? 'needsReboot' : workflow.pendingFix ? 'pendingFix' : null;
  const anyDialogShowing = workflowDialog !== null || swapNotice !== null;

  useEffect(() => {
    fetchChangelog()
      .then(setChangelog)
      .catch((e) => setChangelogError(String(e)));
  }, []);

  const startAccountSwap = async () => {
    if (swapPreparing) return;
    setSwapPreparing(true);
    try {
      const [accounts, settings] = await Promise.all([listAccounts(), getSettings()]);
      if (accounts.length === 0) {
        setSwapNotice('noAccounts');
        return;
      }
      const pool = settings.accountSwapPool.filter((id) => accounts.some((a) => a.id === id));
      if (pool.length === 0) {
        setSwapNotice('notConfigured');
        return;
      }
      await workflow.swap(pool);
    } finally {
      setSwapPreparing(false);
    }
  };

  const confirmSwapNotice = () => {
    setPage(swapNotice === 'noAccounts' ? 'accounts' : 'settings');
    setSwapNotice(null);
  };

  const lookupAccount = (riotId: string) => {
    setPendingLookup(riotId);
    setPage('tools');
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <div className="app-shell" data-tauri-drag-region>
      <Titlebar page={page} onSelectPage={setPage} navDisabled={anyDialogShowing} />
      <div key={page} className="page-fade">
        {page === 'automate' ? (
          <main className="app-main" data-tauri-drag-region ref={glowRef}>
            <div className="app-controls" data-tauri-drag-region>
              <ActionGrid
                disabled={workflow.running || anyDialogShowing || swapPreparing}
                onSelect={workflow.start}
                onCheckIssues={workflow.check}
                onAccountSwap={startAccountSwap}
              />
              <ManualControls disabled={workflow.running || anyDialogShowing || swapPreparing} onSelect={workflow.runManual} />
            </div>
            <LogPanel lines={workflow.lines} onClear={workflow.clearLogs} onCancel={workflow.running ? workflow.cancel : undefined} />
          </main>
        ) : page === 'accounts' ? (
          <AccountsPage onLookup={lookupAccount} />
        ) : page === 'configs' ? (
          <ConfigsPage />
        ) : page === 'tools' ? (
          <ToolsPage initialQuery={pendingLookup} onInitialQueryConsumed={() => setPendingLookup(null)} onOpenSettings={() => setPage('settings')} />
        ) : page === 'changelogs' ? (
          <ChangelogsPage content={changelog} error={changelogError} />
        ) : (
          <SettingsPage />
        )}
      </div>

      <AnimatePresence>
        {workflowDialog === 'needsReboot' && (
          <ConfirmDialog
            key="needsReboot"
            title="Your computer needs to restart"
            body="Remote Desktop was on, which breaks the emu, so it's been turned off. Restart now to finish, or restart later yourself before running this again."
            confirmLabel="Restart now"
            onConfirm={workflow.confirmReboot}
            onCancel={workflow.dismissReboot}
          />
        )}

        {workflowDialog === 'pendingFix' && workflow.pendingFix && (
          <ConfirmDialog
            key="pendingFix"
            title={`${issueSummary(workflow.pendingFix)} found`}
            body={fixBody(workflow.pendingFix)}
            confirmLabel="Auto Fix"
            onConfirm={workflow.confirmFix}
            onCancel={workflow.dismissFix}
          />
        )}

        {swapNotice === 'noAccounts' && (
          <ConfirmDialog
            key="noAccounts"
            title="No accounts saved yet"
            body="Account Swap needs at least one saved account. Add one on the Accounts page first."
            confirmLabel="Go to Accounts"
            onConfirm={confirmSwapNotice}
            onCancel={() => setSwapNotice(null)}
          />
        )}

        {swapNotice === 'notConfigured' && (
          <ConfirmDialog
            key="notConfigured"
            title="Account Swap isn't configured"
            body="Pick which accounts to use for Account Swap in Settings first."
            confirmLabel="Go to Settings"
            onConfirm={confirmSwapNotice}
            onCancel={() => setSwapNotice(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function issueSummary(report: IssueReport): string {
  const count =
    (report.riotRunning ? 0 : 1) + (report.staySignedIn ? 0 : 1) + (report.coreIsolationEnabled ? 0 : 1) + report.missingFiles.length;
  return `${count} issue${count === 1 ? '' : 's'}`;
}

function fixBody(report: IssueReport): string {
  const parts: string[] = [];
  if (!report.riotRunning) parts.push("the Riot Client isn't running");
  if (!report.staySignedIn) parts.push('"Stay signed in" isn\'t enabled in the Riot Client');
  if (!report.coreIsolationEnabled) parts.push('Core isolation (Memory integrity) is off');
  if (report.missingFiles.length > 0) {
    parts.push(`${report.missingFiles.join(' and ')} ${report.missingFiles.length === 1 ? 'is' : 'are'} missing from this folder`);
  }
  const sentence = parts.join(', and ');
  const capitalized = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  const notes: string[] = [];
  if (!report.coreIsolationEnabled) {
    notes.push(" Core isolation can't be turned on automatically. enable it in Windows Security > Device security, then restart.");
  }
  if (report.missingFiles.length > 0) {
    notes.push(" Missing files can't be fixed automatically. Add them to this app's folder and check again.");
  }
  return `${capitalized}.${notes.join('')}`;
}
