import AsyncStorage from '@react-native-async-storage/async-storage';
import { withScopeLock } from './scopeMutex';
import { resetPlayedPictureIdsForScope } from './playedPictureIds';

export const SERVING_CYCLE_PREFIX = 'servingCycle';
const LAST_IMAGE_UUID_KEY_PREFIX = 'lastImageUuid:';
const EXHAUSTED_CATEGORY_KEY_PREFIX = 'exhaustedCategory:';
const GROUP_FEED_KEY_PREFIX = 'groupFeed:';
const GROUP_FEED_EXHAUSTED_KEY_PREFIX = 'groupFeedExhausted:';

export type ServingScope = { kind?: string; groupId?: string } | null | undefined;

function isGroupScope(scope: ServingScope): scope is { kind: string; groupId: string } {
  return scope?.kind === 'private' && !!scope.groupId;
}

export function servingCycleKey(language: string | null | undefined, scope: ServingScope): string {
  return `${SERVING_CYCLE_PREFIX}:${isGroupScope(scope) ? `group:${scope.groupId}` : 'public'}:${language || 'any'}`;
}

export async function getServingCycleEpoch(
  language: string | null | undefined,
  scope: ServingScope,
): Promise<number> {
  const stored = await AsyncStorage.getItem(servingCycleKey(language, scope));
  const parsed = parseInt(stored ?? '', 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function startNewServingCycle(
  language: string | null | undefined,
  scope: ServingScope,
): Promise<number> {
  const key = servingCycleKey(language, scope);
  return withScopeLock(key, async () => {
    const current = await getServingCycleEpoch(language, scope);
    const next = current + 1;
    await AsyncStorage.setItem(key, String(next));
    // Lock order: servingCycle→played only; playedPictureIds.ts never imports
    // servingCycle → no inverse order, no deadlock.
    await resetPlayedPictureIdsForScope(language, scope);
    await clearStaleCycleCursorsAndMarkers(language, scope);
    return next;
  });
}

/**
 * A2: a stale cursor parked at the old feed-end makes every cursor-mode fetch
 * miss forever (head replays persist nothing, cardDeck.ts), and an
 * `exhaustedCategory:all` marker never auto-clears (clearExhaustedMarkerIfLanded
 * excludes 'all'). Both must go under the SAME epoch lock/transition, scoped to
 * (scope, language): public clears `lastImageUuid:*:<lang>` cursors +
 * `exhaustedCategory:*:<lang>` markers; group parity clears this group's
 * `groupFeed:<gid>:*:<lang>:cursor` entries + `groupFeedExhausted:<gid>:*:<lang>`
 * markers. Key shapes mirror utils/storageDatum.ts and
 * services/groups/groupFeedCache.js (no import — module stays
 * AsyncStorage + scopeMutex + playedPictureIds).
 */
async function clearStaleCycleCursorsAndMarkers(
  language: string | null | undefined,
  scope: ServingScope,
): Promise<void> {
  const lang = language || 'any';
  const langSuffix = `:${lang}`;
  const keys = await AsyncStorage.getAllKeys();

  const matches = (key: unknown, prefix: string, suffix: string): key is string =>
    typeof key === 'string' && key.startsWith(prefix) && key.endsWith(suffix);

  // Private game-path transport cursor is being relocated to the
  // groupFeed:<gid>:<cat>:<lang> namespace (parallel agent), making the :cursor
  // clear operative; legacy unscoped lastImageUuid:* private keys are dead
  // garbage cleared only by dev wipe.
  const groupId = isGroupScope(scope) ? scope.groupId : undefined;
  const target = groupId
    ? keys.filter(
        (key) =>
          matches(key, `${GROUP_FEED_KEY_PREFIX}${groupId}:`, `${langSuffix}:cursor`) ||
          matches(key, `${GROUP_FEED_EXHAUSTED_KEY_PREFIX}${groupId}:`, langSuffix),
      )
    : keys.filter(
        (key) =>
          matches(key, LAST_IMAGE_UUID_KEY_PREFIX, langSuffix) ||
          matches(key, EXHAUSTED_CATEGORY_KEY_PREFIX, langSuffix),
      );

  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }
}

async function removeKeysByPrefix(prefix: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const target = keys.filter((key) => typeof key === 'string' && key.startsWith(prefix));
  if (target.length > 0) {
    await AsyncStorage.multiRemove(target);
  }
}

export async function resetServingCycles(): Promise<void> {
  await removeKeysByPrefix(`${SERVING_CYCLE_PREFIX}:`);
}

/**
 * I4 proof predicate: repeats are impossible until 'all' is PROVEN exhausted.
 * Proof = the server served at least one card (serverBatchCount > 0) but the
 * played-filtered resolve is empty (servableCount === 0) — every card the
 * server offered has already been played this cycle. Any other combination
 * (server genuinely empty, or unplayed cards still servable) is NOT cycle
 * exhaustion and must never trigger a cycle transition.
 */
export function isCycleExhausted(serverBatchCount: number, servableCount: number): boolean {
  return serverBatchCount > 0 && servableCount === 0;
}
