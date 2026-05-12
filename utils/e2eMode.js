import { Image as ReactNativeImage } from 'react-native';

import { RANKING as DUMMY_RANKING } from '../data/dummy-data';
import ImageModel from '../models/image';
import { handlePicturePress } from './targetLocation';

const E2E_HIDE_ASSET = require('../assets/tutorial/farm_pict_320.jpg');
const E2E_GUESS_ASSET = require('../assets/tutorial/farm_pict_320.jpg');
const E2E_HIDE_LOCATION = { x: 0.58, y: 0.46 };

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

export function getE2EAdDelayMs() {
  return isE2EMode() ? 0 : 5000;
}

export function getE2EHideLocation() {
  return E2E_HIDE_LOCATION;
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
  ];
}

export function buildE2ERankingRows() {
  return DUMMY_RANKING.scoresDatum.slice(0, 10).map((row) => ({
    rank: String(row.rank),
    username: row.name,
    total_score: row.totalScore,
  }));
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