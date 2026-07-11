import { invoke } from '@tauri-apps/api/core';

export type FeedbackKind = 'feature' | 'bug';

export function submitFeedback(kind: FeedbackKind, title: string, description: string): Promise<void> {
  return invoke('submit_feedback', { kind, title, description });
}
