import { appendAppLog } from '../api/applog';

export function logSilentFailure(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  void appendAppLog('warn', `[${context}] ${message}`).catch(() => {});
}