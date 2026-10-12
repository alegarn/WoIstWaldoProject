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

export interface LoadSessionFilterArgs {
  routeValue?: string | null;
  getter: () => Promise<string | null>;
  setter: (value: string | null) => void;
  fallback: string | null;
  isCancelled: () => boolean;
}

/**
 * Load one session filter (language or mode) for a guess screen: an explicit
 * route value wins; otherwise the stored filter is used; otherwise the
 * fallback. The write is skipped when `isCancelled` reports the owning effect
 * was torn down while the getter was in flight.
 */
export async function loadSessionFilter({ routeValue, getter, setter, fallback, isCancelled }: LoadSessionFilterArgs): Promise<void> {
  if (routeValue) {
    setter(routeValue);
    return;
  }

  const stored = await getter();

  if (isCancelled()) {
    return;
  }

  setter(stored ?? fallback);
}
