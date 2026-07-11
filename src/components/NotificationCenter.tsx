import { AnimatePresence, motion } from 'framer-motion';


import { toast, useToastStore, type ToastData } from '../hooks/useToastStore';
import { NotificationItem }                     from './NotificationItem';


type  Group                      = 'today' | 'yesterday' | 'older';
const GROUP_ORDER: Group[]       = ['today', 'yesterday', 'older'];
const GROUP_LABELS: Record<Group, string> = { today: 'Today', yesterday: 'Yesterday', older: 'Older' };

function dayOf(date: Date): Group {
  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const day       = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (day >= today) return 'today';
  if (day >= yesterday) return 'yesterday';
  return 'older';
}

function grouped(items: ToastData[]): [Group, ToastData[]][] {
  const sorted = [...items].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const map    = new Map<Group, ToastData[]>();
  for (const item of sorted) {
    const group = dayOf(item.timestamp);
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(item);
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!]);
}

export function NotificationCenter() {
  const { archived, open } = useToastStore();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key       = "notification-backdrop"
            initial   = {{ opacity: 0 }}
            animate   = {{ opacity: 1 }}
            exit      = {{ opacity: 0 }}
            className = "notification-backdrop"
            onClick   = {toast.close}
          />
          <Panel items = {archived} />
        </>
      )}
    </AnimatePresence>
  );
}

function Panel({ items }: { items: ToastData[] }) {
  const groups = grouped(items);
  const empty    = items.length === 0;

  return (
    <motion.div
      key        = "notification-panel"
      initial    = {{ opacity: 0, y: -6, scale: 0.97 }}
      animate    = {{ opacity: 1, y: 0, scale: 1 }}
      exit       = {{ opacity: 0, y: -6, scale: 0.97 }}
      transition = {{ type: 'spring', stiffness: 420, damping: 28 }}
      className  = "notification-panel"
    >
      <div  className = "glass-noise" aria-hidden = "true" />
      <div  className = "notification-panel-header">
      <span className = "settings-section-label">Notifications</span>
        {!empty && (
          <button type    = "button" className = "notification-clear-all" onClick = {toast.clearArchive}>
          <svg    viewBox = "0 0 24 24" fill   = "none" aria-hidden               = "true">
              <path
                d              = "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"
                stroke         = "currentColor"
                strokeWidth    = "1.6"
                strokeLinecap  = "round"
                strokeLinejoin = "round"
              />
            </svg>
            Clear all
          </button>
        )}
      </div>

      <div className = "notification-panel-list">
        {empty ? (
          <div className = "notification-panel-empty">
            <p>No notifications yet.</p>
          </div>
        ) : (
          <AnimatePresence mode = "popLayout">
            {groups.map(([label, list]) => (
              <div key       = {label}>
              <div className = "notification-group-label">{GROUP_LABELS[label]}</div>
                {list.map((item, i) => (
                  <NotificationItem key = {item.id} data = {item} index = {i} onDismiss = {toast.removeArchived} />
                ))}
              </div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
