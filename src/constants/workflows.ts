import type { WorkflowAction } from '../types';

import {
  AUTOMATION_METHODS_DENSE_THRESHOLD,
  AUTOMATION_METHODS_SCROLL_THRESHOLD,
  AUTOMATION_METHODS_SEARCH_THRESHOLD,
} from '../utils/automateLayout';

export type AutomationMethodAction = WorkflowAction | 'accountSwap';

export interface AutomationMethod {
  id     : string;
  action : AutomationMethodAction;
  label  : string;
  hint   : string;
}

export const AUTOMATION_METHODS: AutomationMethod[] = [
  {
    id     : 'start-process',
    action : 'start',
    label  : 'Start Process',
    hint   : 'Opens Riot, runs TraceX and waits for VALORANT',
  },
  {
    id     : 'account-swap',
    action : 'accountSwap',
    label  : 'Account Swap',
    hint   : 'Signs in to the next account in rotation, then runs Start Process',
  },
];

export {
  AUTOMATION_METHODS_DENSE_THRESHOLD,
  AUTOMATION_METHODS_SCROLL_THRESHOLD,
  AUTOMATION_METHODS_SEARCH_THRESHOLD,
};
