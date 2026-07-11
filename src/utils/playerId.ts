export function riotId(name: string, tag: string): string {
  return `${name}#${tag}`;
}

export function playerKey(name: string, tag: string): string {
  return `${name.toLowerCase()}#${tag.toLowerCase()}`;
}

export function parseRiotId(query: string): [string, string] | null {
  const [name, tag] = query.split('#').map((part) => part.trim());
  if (!name || !tag) return null;
  return [name, tag];
}