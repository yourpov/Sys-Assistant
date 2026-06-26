import type { WorkflowAction } from '../types';

interface ActionDef {
  action: WorkflowAction;
  label: string;
  hint: string;
}

const ACTIONS: ActionDef[] = [
{
  action: 'startWithRestart',
  label: 'Hamad Method',
  hint: 'temp opens VALORANT, changes emu seed, runs loader, and creates a session (Recommended)'
},
{
  action: 'startWithoutRestart',
  label: 'Hamad Method (Faster)',
  hint: 'Changes emu seed, runs loader, and creates a session without temp opening VALORANT (Faster)'
},
{
  action: 'fix55Error',
  label: '55% Fix Method',
  hint: 'If Hamad Method causes the 55% error. use this instead'
},
];

const CLOSE_ALL: ActionDef = {
  action: 'closeAll',
  label: 'Close All',
  hint: 'Closes VALORANT, Riot Client, the loader, and the current session'
};

interface Props {
  disabled: boolean;
  onSelect: (action: WorkflowAction) => void;
  onCheckIssues: () => void;
  onAccountSwap: () => void;
}

export function ActionGrid({ disabled, onSelect, onCheckIssues, onAccountSwap }: Props) {
  return (
    <div className="action-grid" data-tauri-drag-region>
      {ACTIONS.map(({ action, label, hint }) => (
        <button key={action} className="action-button" disabled={disabled} onClick={() => onSelect(action)}>
          <span className="action-label">{label}</span>
          <span className="action-hint">{hint}</span>
        </button>
      ))}
      <button className="action-button" disabled={disabled} onClick={onAccountSwap}>
        <span className="action-label">Account Swap</span>
        <span className="action-hint">Like Hamad Method (Faster), but signs in to a different account first</span>
      </button>
      <button className="action-button" disabled={disabled} onClick={() => onSelect(CLOSE_ALL.action)}>
        <span className="action-label">{CLOSE_ALL.label}</span>
        <span className="action-hint">{CLOSE_ALL.hint}</span>
      </button>
      <button className="action-button" disabled={disabled} onClick={onCheckIssues}>
        <span className="action-label">Check for issues</span>
        <span className="action-hint">Looks for common problems that prevent this from working</span>
      </button>
    </div>
  );
}
