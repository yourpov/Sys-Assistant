import { getSettings }                     from '../api/settings';
import { toast, type NotificationContent } from '../hooks/useToastStore';

export async function confirmIfEnabled(
  notice: NotificationContent,
  confirmLabel = 'Continue',
  shouldAbort?: () => boolean,
): Promise<boolean> {
  if (shouldAbort?.()) return false;
  const settings = await getSettings();
  if (shouldAbort?.()) return false;
  if (!settings.confirmBeforeActionsEnabled) return true;
  const accepted = await toast.confirm(notice, { confirmLabel, icon: notice.icon ?? 'warning' });
  if (shouldAbort?.()) return false;
  return accepted;
}
