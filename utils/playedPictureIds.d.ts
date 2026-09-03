/**
 * Type declarations for `utils/playedPictureIds.js`. The runtime module is
 * plain JavaScript; these declarations pin the structured-args contract
 * actually used at runtime.
 */

import type { CardImage } from '../services/cardDeck';

// F2b played-picture set (scope-aware: public vs per-group, per-language).
// Shared memory of recently played pictureIds so fall-through/replay paths
// skip just-played cards. Cap-evicted (most recent 200 kept).
export const PLAYED_PICTURE_IDS_PREFIX: string;
export const PLAYED_PICTURE_IDS_CAP: number;
export function playedPictureIdsKey(language: string | null | undefined, scope: unknown): string;
export function getPlayedPictureIds(language: string | null | undefined, scope: unknown): Promise<string[]>;
export function addPlayedPictureId(pictureId: string | null | undefined, language: string | null | undefined, scope: unknown): Promise<void>;
export function filterPlayedCards(cards: CardImage[], language: string | null | undefined, scope: unknown): Promise<CardImage[]>;
export function clearPlayedPictureIdsForGroup(groupId: string): Promise<void>;
export function clearAllPrivatePlayedPictureIds(): Promise<void>;
// Fix 1 replay-cycle restart: clears the WHOLE scope+language played-set under
// the SAME lock key as addPlayedPictureId, so an in-flight add cannot write
// stale ids after the reset.
export function resetPlayedPictureIdsForScope(language: string | null | undefined, scope: unknown): Promise<void>;
