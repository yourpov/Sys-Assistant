import { motion }            from 'framer-motion';
import { useMemo, useState } from 'react';

import {
  AUTOMATION_METHODS,
  AUTOMATION_METHODS_DENSE_THRESHOLD,
  AUTOMATION_METHODS_SCROLL_THRESHOLD,
  AUTOMATION_METHODS_SEARCH_THRESHOLD,
  type AutomationMethodAction,
} from '../constants/workflows';
import type { WorkflowAction } from '../types';
import { useMotionPreference } from '../hooks/useMotionPreference';
import { AutomateSection }     from './AutomateSection';
import { Tooltip }             from './Tooltip';

interface ActionGridProps {
  disabled     : boolean;
  onSelect     : (action: WorkflowAction) => void;
  onCheckIssues: () => void;
  onAccountSwap: () => void;
}

function runMethod(
  action       : AutomationMethodAction,
  onSelect     : ActionGridProps['onSelect'],
  onAccountSwap: () => void,
) {
  if (action === 'accountSwap') {
    onAccountSwap();
    return;
  }
  onSelect(action);
}

function matchesQuery(label: string, hint: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return label.toLowerCase().includes(needle) || hint.toLowerCase().includes(needle);
}

export function ActionGrid({ disabled, onSelect, onCheckIssues, onAccountSwap }: ActionGridProps) {
  const reduceMotion        = useMotionPreference();
  const [query, setQuery] = useState('');
  const methodCount       = AUTOMATION_METHODS.length;
  const scrollable        = methodCount > AUTOMATION_METHODS_SCROLL_THRESHOLD;
  const searchable        = methodCount >= AUTOMATION_METHODS_SEARCH_THRESHOLD;
  const dense             = methodCount >= AUTOMATION_METHODS_DENSE_THRESHOLD;

  const visibleMethods = useMemo(
    () => AUTOMATION_METHODS.filter(({ label, hint }) => matchesQuery(label, hint, query)),
    [query],
  );

  const hint = scrollable
    ? `${methodCount} methods - scroll${searchable ? ' or filter' : ''}.`
    :  `${methodCount} available method${methodCount === 1 ? '' : 's'}.`;

  const gridClass = [
    'action-grid',
    scrollable && 'action-grid--scrollable',
    dense && 'action-grid--dense',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <AutomateSection
      title      = "Automation Methods"
      hint       = {hint}
      scrollable = {scrollable}
      fill       = {scrollable}
      footer     = {
        <div     className = "action-utility-row" data-tauri-drag-region>
        <Tooltip content   = "Check for common setup problems" block>
            <button
              type      = "button"
              className = "app-btn app-btn-info app-btn-compact action-utility-button"
              disabled  = {disabled}
              onClick   = {onCheckIssues}
            >
              Check for issues
            </button>
          </Tooltip>
          <Tooltip content = "Closes VALORANT, Riot Client, the loader, and the current session" block>
            <button
              type      = "button"
              className = "app-btn app-btn-danger app-btn-compact action-utility-button"
              disabled  = {disabled}
              onClick   = {() => onSelect('closeAll')}
            >
              Close All
            </button>
          </Tooltip>
        </div>
      }
    >
      <div className = {scrollable ? 'action-methods-stack' : undefined} data-tauri-drag-region>
        {searchable ? (
          <input
            type        = "search"
            className   = "action-methods-search"
            placeholder = "Filter methods..."
            value       = {query}
            onChange    = {(e) => setQuery(e.target.value)}
            aria-label  = "Filter methods"
          />
        ) : null}
        <div className = {gridClass} data-tauri-drag-region>
          {visibleMethods.length === 0 ? (
            <p className = "action-methods-empty">No methods match that filter.</p>
          ) : (
            visibleMethods.map(({ id, action, label, hint: methodHint }, index) => (
            <Tooltip key = {`${id}-${index}`} content = {methodHint} block>
              <motion.button
                type      = "button"
                className = {[
                  'action-button',
                  scrollable && 'action-button--compact',
                  scrollable && 'action-button--label-only',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled   = {disabled}
                onClick    = {() => runMethod(action, onSelect, onAccountSwap)}
                initial    = {reduceMotion || scrollable ? false : { opacity: 0, y: 8 }}
                animate    = {{ opacity: 1, y: 0 }}
                transition = {
                  reduceMotion || scrollable
                    ? { duration: 0 }
                    :  { duration: 0.18, delay: Math.min(index * 0.04, 0.28), ease: [0.2, 0.7, 0.3, 1] }
                }
                whileTap   = {reduceMotion ? undefined : { scale: 0.985 }}
              >
                <span className = "action-label">{label}</span>
                {!scrollable ? <span className="action-hint">{methodHint}</span> : null}
              </motion.button>
            </Tooltip>
            ))
          )}
        </div>
      </div>
    </AutomateSection>
  );
}