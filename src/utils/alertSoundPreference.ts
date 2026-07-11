const STORAGE_KEY = 'muteAlertSoundsEnabled';

let muted = readStored();

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function getMuteAlertSounds(): boolean {
  return muted;
}

export function syncMuteAlertSounds(enabled: boolean): void {
  muted = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
  }
}
