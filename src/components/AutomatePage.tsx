import { useCallback } from 'react';

import { useAutomateLayout } from '../hooks/useAutomateLayout';
import type { WorkflowHandle } from '../hooks/useWorkflow';
import type { WorkflowAction } from '../types';
import { ActionGrid } from './ActionGrid';
import { AutomateStatusPill } from './AutomateStatusPill';
import { LogPanel } from './LogPanel';
import { ManualControls } from './ManualControls';
import { PageHero } from './PageHero';

interface AutomatePageProps {
  workflow: WorkflowHandle;
  swapPreparing: boolean;
  onWorkflowAction: (action: WorkflowAction) => void;
  onAccountSwap: () => void;
  onCancelWork: () => void;
}

export function AutomatePage({ workflow, swapPreparing, onWorkflowAction, onAccountSwap, onCancelWork }: AutomatePageProps) {
  const { publishLayout } = useAutomateLayout();
  const reportConsoleLayout = useCallback(
    (collapsed: boolean) => publishLayout({ consoleCollapsed: collapsed }),
    [publishLayout],
  );
  const isBusy = workflow.running || swapPreparing;

  return (
    <main className="app-main app-main--automate" data-tauri-drag-region>
      <div className="automate-workspace" data-tauri-drag-region>
        <div className="automate-status-island-anchor">
          <AutomateStatusPill running={workflow.running} swapPreparing={swapPreparing} lines={workflow.lines} />
        </div>
        <PageHero title="Automate" subtitle="Manual process made easy." />

        <div className="automate-panels" data-tauri-drag-region>
          <ActionGrid
            disabled={isBusy}
            onSelect={onWorkflowAction}
            onCheckIssues={workflow.check}
            onAccountSwap={onAccountSwap}
          />
          <ManualControls disabled={isBusy} onSelect={workflow.runManual} onLayoutReport={publishLayout} />
        </div>
      </div>

      <LogPanel
        lines={workflow.lines}
        onClear={workflow.clearLogs}
        onCancel={workflow.running || swapPreparing ? onCancelWork : undefined}
        onCollapsedChange={reportConsoleLayout}
        defaultCollapsed
      />
    </main>
  );
}