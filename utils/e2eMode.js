import { Image as ReactNativeImage } from 'react-native';

import { RANKING as DUMMY_RANKING } from '../data/dummy-data';
import ImageModel from '../models/image';
import { handlePicturePress } from './targetLocation';

const E2E_HIDE_ASSET = require('../assets/tutorial/farm_pict_320.jpg');
const E2E_GUESS_ASSET = require('../assets/tutorial/farm_pict_320.jpg');
const E2E_HIDE_LOCATION = { x: 0.58, y: 0.46 };
const E2E_INCORRECT_HIDE_LOCATION = { x: 0.18, y: 0.18 };

const E2E_GUESS_CARD_CATEGORY = { id: 'e2e-cat-nature', key: 'nature', name: 'Nature' };
const E2E_GUESS_CARD_LANGUAGE = 'en';
const E2E_GUESS_CARD_AVERAGE_RATING = 4.5;
const E2E_GUESS_CARD_RATINGS_COUNT = 7;
const E2E_GUESS_CARD_TAGS = [
  { id: 'e2e-tag-outdoors', name: 'Outdoors' },
  { id: 'e2e-tag-scenic', name: 'Scenic' },
];
const E2E_GUESS_CARD_CREATOR_USERNAME = 'e2e_creator';
const E2E_GUESS_CARD_CREATED_AT = '2024-01-01T00:00:00.000Z';
const E2E_GUESS_CARD_FULL_DESCRIPTION =
  'A scenic spot used for deterministic e2e guess flows.';

const E2E_CATEGORIES = [
  {
    id: 'e2e-default-category',
    key: 'all',
    name: 'Recent/All',
    thumbnailUrl: null,
    count: undefined,
  },
  { id: 'e2e-cat-other', key: 'other', name: 'Other', thumbnailUrl: null, count: undefined },
  { id: 'e2e-cat-nature', key: 'nature', name: 'Nature', thumbnailUrl: null, count: undefined },
  { id: 'e2e-cat-city', key: 'city', name: 'City', thumbnailUrl: null, count: undefined },
  { id: 'e2e-cat-people', key: 'people', name: 'People', thumbnailUrl: null, count: undefined },
  {
    id: 'e2e-cat-abstract',
    key: 'abstract',
    name: 'Abstract',
    thumbnailUrl: null,
    count: undefined,
  },
];

function attachE2EGuessCardMetadata(card, overrides = {}) {
  card.category = overrides.category ?? E2E_GUESS_CARD_CATEGORY;
  card.language = overrides.language ?? E2E_GUESS_CARD_LANGUAGE;
  card.averageRating = overrides.averageRating ?? E2E_GUESS_CARD_AVERAGE_RATING;
  card.ratingsCount = overrides.ratingsCount ?? E2E_GUESS_CARD_RATINGS_COUNT;
  card.tags = overrides.tags ?? E2E_GUESS_CARD_TAGS;
  card.creatorUsername = overrides.creatorUsername ?? E2E_GUESS_CARD_CREATOR_USERNAME;
  card.createdAt = overrides.createdAt ?? E2E_GUESS_CARD_CREATED_AT;
  card.fullDescription = overrides.fullDescription ?? E2E_GUESS_CARD_FULL_DESCRIPTION;

  return card;
}

function resolveLocalAsset(assetSource) {
  const resolvedAsset = ReactNativeImage.resolveAssetSource(assetSource);

  return {
    uri: resolvedAsset?.uri,
    width: resolvedAsset?.width ?? 320,
    height: resolvedAsset?.height ?? 320,
  };
}

export function isE2EMode() {
  return process.env.EXPO_PUBLIC_E2E_MODE === 'true';
}

export function buildE2ECategories() {
  return E2E_CATEGORIES.map((category) => ({ ...category }));
}

export function getE2EAdDelayMs() {
  return isE2EMode() ? 0 : 5000;
}

export function getE2EHideLocation() {
  return E2E_HIDE_LOCATION;
}

export function getE2EIncorrectHideLocation() {
  return E2E_INCORRECT_HIDE_LOCATION;
}

export function buildE2EPictureSelection({ screenWidth, screenHeight, imageDimensionStyle, relativeLocation }) {
  return handlePicturePress({
    event: {
      nativeEvent: {
        locationX: imageDimensionStyle.width * Number(relativeLocation.x),
        locationY: imageDimensionStyle.height * Number(relativeLocation.y),
      },
    },
    screenHeight,
    screenWidth,
    imageDimensionStyle,
  });
}

export function buildE2EHideRouteParams({ screenWidth, screenHeight, isTutorial }) {
  const asset = resolveLocalAsset(E2E_HIDE_ASSET);
  const isPortrait = asset.height >= asset.width;

  return {
    uri: asset.uri,
    imageWidth: asset.width,
    imageHeight: asset.height,
    screenHeight: isPortrait ? screenWidth : screenHeight,
    screenWidth: isPortrait ? screenHeight : screenWidth,
    isPortrait,
    isTutorial,
  };
}

export function buildE2EGuessCards() {
  const asset = resolveLocalAsset(E2E_GUESS_ASSET);
  const isPortrait = asset.height >= asset.width;

  return [
    attachE2EGuessCardMetadata(
      new ImageModel(
        asset.uri,
        'e2e-guess-card',
        'Find the hidden point near the center ring.',
        asset.height,
        asset.width,
        isPortrait,
        getE2EHideLocation(),
        asset.height,
        asset.width,
        1,
      ),
    ),
  ];
}

export function buildE2EHiddenGuessPayload({
  uri,
  description,
  imageHeight,
  imageWidth,
  isPortrait,
  hiddenLocation,
  screenHeight,
  screenWidth,
}) {
  return {
    uri,
    pictureId: 'e2e-hidden-guess-card',
    description,
    imageHeight,
    imageWidth,
    isPortrait,
    hiddenLocation,
    screenHeight,
    screenWidth,
  };
}

export function buildE2EGuessCardFromPayload(payload, { listId = 1 } = {}) {
  if (!payload?.uri) {
    return null;
  }

  return attachE2EGuessCardMetadata(
    new ImageModel(
      payload.uri,
      payload.pictureId ?? 'e2e-hidden-guess-card',
      payload.description,
      payload.imageHeight,
      payload.imageWidth,
      payload.isPortrait,
      payload.hiddenLocation,
      payload.screenHeight,
      payload.screenWidth,
      listId,
    ),
    {
      category: payload.category ?? null,
      language: payload.language ?? E2E_GUESS_CARD_LANGUAGE,
      averageRating: payload.averageRating ?? E2E_GUESS_CARD_AVERAGE_RATING,
      ratingsCount: payload.ratingsCount ?? E2E_GUESS_CARD_RATINGS_COUNT,
      tags: payload.tags ?? E2E_GUESS_CARD_TAGS,
      creatorUsername: payload.creatorUsername ?? E2E_GUESS_CARD_CREATOR_USERNAME,
      createdAt: payload.createdAt ?? E2E_GUESS_CARD_CREATED_AT,
      fullDescription: payload.fullDescription ?? E2E_GUESS_CARD_FULL_DESCRIPTION,
    },
  );
}

export function buildE2ERankingRows() {
  return DUMMY_RANKING.scoresDatum.slice(0, 10).map((row) => ({
    rank: String(row.rank),
    username: row.name,
    total_score: row.totalScore,
  }));
}

export function buildE2ERankingResponse({ after, limit, scope, page } = {}) {
  const allRows = buildE2ERankingRows();

  if (page) {
    return {
      rows: allRows,
      nextCursor: null,
      hasMore: false,
      me: null,
      meta: null,
      pagy: { count: allRows.length, pages: 1, page: 1 },
    };
  }

  if (after) {
    return {
      rows: allRows.slice(5),
      nextCursor: 'e2e-cursor-next',
      hasMore: false,
      me: null,
      meta: null,
      pagy: null,
    };
  }

  return {
    rows: allRows.slice(0, 5),
    me: { user_id: 'e2e-user', username: 'e2e_user', total_score: 50, rank: 3 },
    meta: { top: 3, window: 2 },
    nextCursor: null,
    hasMore: false,
    pagy: null,
  };
}

export function buildE2EUserScores(username) {
  const fallbackRow = DUMMY_RANKING.scoresDatum[0];
  const selectedRow = DUMMY_RANKING.scoresDatum.find((row) => row.name === username) ?? fallbackRow;

  return {
    total: {
      total_score: selectedRow.totalScore,
      total_hide_score: selectedRow.hideScore,
      total_guess_score: selectedRow.guessScore,
    },
    hide_info: {
      hide_count: selectedRow.hideWaldoCreatedCount,
    },
    guess_info: {
      guess_count: selectedRow.guessTotalCount,
    },
  };
}