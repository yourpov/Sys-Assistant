import { listen } from '@tauri-apps/api/event';

import type { LogLine } from '../types';

export const onWorkflowLog = (callback: (line: LogLine) => void) => listen<LogLine>('workflow://log', (event) => callback(event.payload));
