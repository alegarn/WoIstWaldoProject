// 'any' is the canonical "no filter" sentinel shared by the session language
// filter, the session mode filter, and the storage-key namespaces derived from
// them (see storageDatum.ts key builders and cardDeck.ts resolveServer*).
export const ANY_FILTER = 'any';

export function normalizeLanguage(language?: string | null): string {
  return language || ANY_FILTER;
}

export function normalizeMode(mode?: string | null): string {
  return mode || ANY_FILTER;
}
