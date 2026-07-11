export const MASKED_USERNAME = '************';

export function displayUsername(username: string, hidden: boolean): string {
  return hidden ? MASKED_USERNAME: username;
}

export function accountAvatarInitial(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '?';
  const hashIndex = trimmed.indexOf('#');
  const name      = hashIndex > 0 ? trimmed.slice(0, hashIndex) : trimmed;
  return name.charAt(0).toUpperCase();
}