import AsyncStorage from '@react-native-async-storage/async-storage';
import { getServingCycleEpoch, type ServingScope } from './servingCycle';

export const ALL_POOL_DRAINED_PREFIX = 'allPoolDrained';

type PrivateScope = { kind: 'private'; groupId: string };

function isPrivateScope(scope: unknown): scope is PrivateScope {
  return !!scope && typeof scope === 'object' &&
    (scope as { kind?: unknown }).kind === 'private' &&
    !!(scope as { groupId?: unknown }).groupId;
}

/**
 * Key shape: `allPoolDrained:<public|group:<gid>>:<lang>:drained` —
 * mode-agnostic like the serving-cycle clear. The trailing CONSTANT `drained`
 * segment is load-bearing: it keeps the language a MIDDLE segment, so
 * servingCycle's belt-clear matcher (`key.includes(':<lang>:')`) hits the key
 * with NO matcher adjustment. Language follows servingCycle's convention
 * (`language || 'any'`) — the scope prefixes locate the stamp by its raw
 * `:<lang>:` segment, so any other normalization would make the belt-clear
 * prefixes dead code.
 */
export function allPoolDrainedKey(language: string | null | undefined, scope: unknown): string {
  return `${ALL_POOL_DRAINED_PREFIX}:${isPrivateScope(scope) ? `group:${scope.groupId}` : 'public'}:${language || 'any'}:drained`;
}

/**
 * @returns The serving-cycle epoch the pool was stamped drained for,
 *   or null when no (parseable) stamp exists. Null — never 0 — so a missing
 *   stamp can never equal an unset cycle epoch (0) and read as fresh.
 */
export async function getAllPoolDrainedEpoch(language: string | null | undefined, scope: unknown): Promise<number | null> {
  const stored = await AsyncStorage.getItem(allPoolDrainedKey(language, scope));
  const parsed = parseInt(stored ?? '', 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function markAllPoolDrained(language: string | null | undefined, scope: unknown, epoch: number): Promise<void> {
  await AsyncStorage.setItem(allPoolDrainedKey(language, scope), String(epoch));
}

export async function clearAllPoolDrained(language: string | null | undefined, scope: unknown): Promise<void> {
  await AsyncStorage.removeItem(allPoolDrainedKey(language, scope));
}

/**
 * Fresh iff the stored stamp is for the CURRENT serving-cycle epoch: a stamp
 * never claims validity in a cycle it was not stamped for, so a restart that
 * missed its re-stamp (returned epoch undefined) leaves a stamp consults
 * ignore — epoch mismatch is the invalidation mechanism.
 */
export async function isAllPoolDrainedFresh(language: string | null | undefined, scope: unknown): Promise<boolean> {
  const stored = await getAllPoolDrainedEpoch(language, scope);
  if (stored === null) {
    return false;
  }
  const epoch = await getServingCycleEpoch(language, scope as ServingScope);
  return stored === epoch;
}
