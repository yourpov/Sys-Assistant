export function readPersistedRecord(storageKey: string, recordId: string, defaultValue: boolean): boolean {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return defaultValue;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return recordId in parsed ? parsed[recordId]: defaultValue;
  } catch {
    return defaultValue;
  }
}

export function writePersistedRecord(storageKey: string, recordId: string, value: boolean): void {
  try {
    const raw        = sessionStorage.getItem(storageKey);
    const parsed     = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[recordId] = value;
    sessionStorage.setItem(storageKey, JSON.stringify(parsed));
  } catch {
  }
}