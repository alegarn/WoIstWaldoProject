/**
 * Type declarations for `utils/e2eMode.js`. The runtime module is plain
 * JavaScript; these declarations pin the deterministic-e2e surface consumed
 * by TS code (`App.tsx`, `services/cardPrefetcher.ts`, `hooks/useAdCadence.ts`,
 * guess screens/components). Builder outputs mirror the hardcoded fixtures.
 */

import type ImageModel from '../models/image';

export interface E2ECategory {
  id: string;
  key: string;
  name: string;
  thumbnailUrl: string | null;
  count?: undefined;
}

export interface E2ELocation {
  x: number;
  y: number;
}

export interface E2EImageDimensionStyle {
  width: number;
  height: number;
}

export interface E2ETargetStyle {
  position: 'absolute';
  width: number;
  height: number;
  left: number;
  top: number;
  borderRadius?: number;
  alignItems?: 'center';
  justifyContent?: 'center';
}

export interface E2ESelectionTarget {
  targetSize: number;
  targetStyle: E2ETargetStyle;
  dragSize?: number;
  dragStyle?: E2ETargetStyle;
}

// Mirrors utils/targetLocation.js handlePicturePress: relative location is
// toFixed(2) strings; both halves are null when the press lands off-image.
export interface E2EPictureSelection {
  location: { x: string; y: string } | null;
  target: E2ESelectionTarget | null;
}

export interface E2EHideRouteParams {
  uri: string | undefined;
  imageWidth: number;
  imageHeight: number;
  screenHeight: number;
  screenWidth: number;
  isPortrait: boolean;
  isTutorial?: boolean;
}

export interface E2EHiddenGuessPayloadArgs {
  uri?: unknown;
  description?: unknown;
  imageHeight?: unknown;
  imageWidth?: unknown;
  isPortrait?: unknown;
  hiddenLocation?: unknown;
  screenHeight?: unknown;
  screenWidth?: unknown;
}

export interface E2EHiddenGuessPayload {
  uri?: unknown;
  pictureId: string;
  description?: unknown;
  imageHeight?: unknown;
  imageWidth?: unknown;
  isPortrait?: unknown;
  hiddenLocation?: unknown;
  screenHeight?: unknown;
  screenWidth?: unknown;
}

export interface E2ERankingRow {
  rank: string;
  username: string;
  total_score: number;
}

export interface E2ERankingMeRow {
  user_id: string;
  username: string;
  total_score: number;
  rank: number;
}

export interface E2ERankingResponse {
  rows: E2ERankingRow[];
  nextCursor: string | null;
  hasMore: boolean;
  me: E2ERankingMeRow | null;
  meta: { top: number; window: number } | null;
  pagy: { count: number; pages: number; page: number } | null;
}

export interface E2EUserScores {
  total: { total_score: number; total_hide_score: number; total_guess_score: number };
  hide_info: { hide_count: number };
  guess_info: { guess_count: number };
}

export interface E2EImageRating {
  global_rating: number;
  quality_rating: number;
  enigma_rating: number;
  fun_rating: number;
  difficulty_rating: number;
}

export interface E2EImageTag {
  id: string;
  name: string;
  user_id: string;
  username: string;
}

export interface E2EImageDetail {
  category: { id: string; key: string; name: string; thumbnailUrl: null; sortOrder: number };
  language: string;
  tags: E2EImageTag[];
  creatorUsername: string;
  createdAt: string;
  fullDescription: string;
  averageRating: number;
  ratingsCount: number;
}

export function isE2EMode(): boolean;
export function ensureE2EOnboardingBypass(): Promise<boolean>;
export function buildE2ECategories(): E2ECategory[];
export function getE2EAdDelayMs(): number;
export function getE2EHideLocation(): E2ELocation;
export function getE2EIncorrectHideLocation(): E2ELocation;
export function buildE2EPictureSelection({ screenWidth, screenHeight, imageDimensionStyle, relativeLocation }: {
  screenWidth: number;
  screenHeight: number;
  imageDimensionStyle: E2EImageDimensionStyle;
  relativeLocation: E2ELocation;
}): E2EPictureSelection;
export function buildE2EHideRouteParams({ screenWidth, screenHeight, isTutorial }: {
  screenWidth: number;
  screenHeight: number;
  isTutorial?: boolean;
}): E2EHideRouteParams;
export function buildE2EGuessCards(): (ImageModel & { hiddenLocation: E2ELocation })[];
export function buildE2EHiddenGuessPayload(args: E2EHiddenGuessPayloadArgs): E2EHiddenGuessPayload;
export function buildE2EGuessCardFromPayload(
  payload: Record<string, unknown>,
  options?: { listId?: number },
): (ImageModel & { hiddenLocation: unknown }) | null;
export function buildE2ERankingRows(): E2ERankingRow[];
export function buildE2ERankingResponse(args?: {
  after?: unknown;
  limit?: unknown;
  scope?: unknown;
  page?: unknown;
}): E2ERankingResponse;
export function buildE2EUserScores(username?: unknown): E2EUserScores;
export function buildE2EImageRating(): E2EImageRating;
export function buildE2EImageTags(): E2EImageTag[];
export function buildE2EImageDetail(): E2EImageDetail;
