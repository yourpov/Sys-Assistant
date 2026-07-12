export const ACCOUNT_REGIONS = ['NA', 'EU', 'AP', 'KR', 'BR', 'LATAM', 'Random'] as const;

export type AccountRegion = (typeof ACCOUNT_REGIONS)[number];
