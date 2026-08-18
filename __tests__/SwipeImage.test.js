const mockSwipeableCard = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);
const mockBadgeDetailModal = jest.fn(() => null);

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    GestureHandlerRootView: ({ children }) => <View>{children}</View>,
  };
});

jest.mock('../components/UI/SwipeableCard', () => {
  return function MockSwipeableCard(props) {
    mockSwipeableCard(props);
    return null;
  };
});

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../components/UI/BadgeDetailModal', () => {
  const React = require('react');

  return function MockBadgeDetailModal(props) {
    mockBadgeDetailModal(props);
    return React.createElement('BadgeDetailModal', {
      testID: `${props.testIDPrefix}.modal`,
      image: props.image,
      onClose: props.onClose,
      onOpenFilter: props.onOpenFilter,
    });
  };
});

jest.mock('../utils/imagesRequests', () => ({
  getImages: jest.fn(),
}));

jest.mock('../utils/ratingRequests', () => ({
  getImageRating: jest.fn(),
  getImageTags: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  PUBLIC_FEED_END_CURSOR: '__public_feed_end__',
  getE2EHiddenGuessCard: jest.fn(),
  getLocalImages: jest.fn(),
  storeImageList: jest.fn(),
  getLastImageId: jest.fn(),
  emptyImageList: jest.fn(),
  removeImageFromList: jest.fn(),
  updateImageList: jest.fn(),
  // Real impl (pure) — SwipeImage now imports this from storageDatum instead of
  // defining it locally, so the mock must supply the same behaviour.
  normalizeListIds: (cards) => {
    if (!Array.isArray(cards) || cards.length === 0) return cards;
    const hasMissing = cards.some((c) => c?.listId == null || !Number.isFinite(c.listId));
    if (!hasMissing) return cards;
    let next = cards.reduce((max, c) => (Number.isFinite(c?.listId) && c.listId > max ? c.listId : max), 0);
    return cards.map((c) => (Number.isFinite(c?.listId) ? c : { ...c, listId: (next += 1) }));
  },
  getLastImageUuid: jest.fn(),
  saveLastImageUuid: jest.fn(),
  deleteImageFromStorage: jest.fn(),
}));

jest.mock('../services/groups/groupFeedCache', () => ({
  __esModule: true,
  readGroupFeedCache: jest.fn(),
  writeGroupFeedCache: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

jest.mock('../utils/e2eMode', () => ({
  buildE2EGuessCardFromPayload: jest.fn(),
  buildE2EGuessCards: jest.fn(),
  isE2EMode: jest.fn(),
}));

jest.mock('../services/cardPrefetcher', () => ({
  prefetchIfLow: jest.fn(() => Promise.resolve()),
  warmAllDeckIfNeeded: jest.fn(() => Promise.resolve()),
}));

import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import SwipeImage from '../components/UI/SwipeImage';
import { GlobalStyle } from '../constants/theme';
import { AuthContext } from '../store/auth-context';
import { buildE2EGuessCardFromPayload, buildE2EGuessCards, isE2EMode } from '../utils/e2eMode';
import { getImages } from '../utils/imagesRequests';
import { getImageRating, getImageTags } from '../utils/ratingRequests';
import {
  deleteImageFromStorage,
  getE2EHiddenGuessCard,
  getLastImageId,
  getLastImageUuid,
  getLocalImages,
  PUBLIC_FEED_END_CURSOR,
  removeImageFromList,
  storeImageList,
  updateImageList,
} from '../utils/storageDatum';
import { prefetchIfLow, warmAllDeckIfNeeded } from '../services/cardPrefetcher';
import { readGroupFeedCache } from '../services/groups/groupFeedCache';

describe('SwipeImage', () => {
  const contextValue = {
    token: 'token',
    uid: 'waldo@example.com',
    expiry: '123',
    access_token: 'access-token',
    client: 'client-id',
    userId: '42',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    isE2EMode.mockReturnValue(false);
    getImages.mockResolvedValue({ isError: false, images: [] });
    getImageTags.mockResolvedValue({ data: [] });
    getImageRating.mockResolvedValue({ data: undefined });
    getE2EHiddenGuessCard.mockResolvedValue(null);
    buildE2EGuessCardFromPayload.mockImplementation((payload) => (
      payload ? { listId: 1, pictureId: payload.pictureId, imageFile: payload.uri } : null
    ));
    buildE2EGuessCards.mockReturnValue([{ listId: 1, pictureId: 'e2e-guess-card', imageFile: 'file:///e2e.jpg' }]);
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    getLastImageId.mockResolvedValue(0);
    getLastImageUuid.mockResolvedValue(null);
    updateImageList.mockResolvedValue([]);
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  function createDeferred() {
    let resolve;
    let reject;

    const promise = new Promise((nextResolve, nextReject) => {
      resolve = nextResolve;
      reject = nextReject;
    });

    return { promise, resolve, reject };
  }

  async function renderSwipeImage(startGuessing = jest.fn(), { category, language } = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <SwipeImage
            screenWidth={320}
            screenHeight={640}
            startGuessing={startGuessing}
            category={category}
            language={language}
          />
        </AuthContext.Provider>
      );

      await flushEffects();
    });

    return { renderer, startGuessing };
  }

  it('uses the local cache when at least four cards are already stored', async () => {
    getLocalImages.mockResolvedValue([
      { listId: 1, imageFile: 'file:///1.jpg' },
      { listId: 2, imageFile: 'file:///2.jpg' },
      { listId: 3, imageFile: 'file:///3.jpg' },
      { listId: 4, imageFile: 'file:///4.jpg' },
    ]);

    const { startGuessing } = await renderSwipeImage();

    expect(getImages).not.toHaveBeenCalled();
    expect(mockSwipeableCard.mock.calls.map(([props]) => props.item.listId)).toEqual([4, 3, 2, 1]);
    expect(mockSwipeableCard.mock.calls[0][0].onSwipe).toBe(startGuessing);
  });

  it('loads new images, assigns incremental list ids, and stores them when the cache is empty', async () => {
    getLocalImages.mockResolvedValue(null);
    getLastImageId.mockResolvedValue(4);
    getImages.mockResolvedValue({
      isError: false,
      images: [
        { pictureId: 'img-1', imageFile: 'file:///one.jpg' },
        { pictureId: 'img-2', imageFile: 'file:///two.jpg' },
      ],
    });

    await renderSwipeImage();

    expect(getImages).toHaveBeenCalledWith(null, contextValue, { language: undefined, scope: undefined });
    expect(storeImageList).toHaveBeenCalledWith([
      expect.objectContaining({ pictureId: 'img-1', listId: 5 }),
      expect.objectContaining({ pictureId: 'img-2', listId: 6 }),
    ], 'all', 'any');
    expect(mockSwipeableCard.mock.calls.map(([props]) => props.item.listId)).toEqual([6, 5]);
  });

  it('ignores a stale last image uuid when the local cache is missing and fetches a fresh batch', async () => {
    getLocalImages.mockResolvedValue(null);
    getLastImageUuid.mockResolvedValue('stale-image-uuid');
    getImages.mockResolvedValue({
      isError: false,
      images: [
        { pictureId: 'img-1', imageFile: 'file:///one.jpg' },
      ],
    });

    await renderSwipeImage();

    expect(getImages).toHaveBeenCalledWith(null, contextValue, { language: undefined, scope: undefined });
    expect(storeImageList).toHaveBeenCalledWith([
      expect.objectContaining({ pictureId: 'img-1', listId: 1 }),
    ], 'all', 'any');
  });

  it('re-queries the server on cold mount when the exhausted sentinel is stored so new uploads surface', async () => {
    // Regression: a stored PUBLIC_FEED_END_CURSOR used to short-circuit the
    // cold-mount load, so once a category ever returned empty it never queried
    // the server again — newly uploaded cards stayed invisible until reinstall.
    getLocalImages.mockResolvedValue(null);
    getLastImageUuid.mockResolvedValue(PUBLIC_FEED_END_CURSOR);
    getImages.mockResolvedValue({
      isError: false,
      images: [
        { pictureId: 'fresh-after-exhaust', imageFile: 'file:///fresh.jpg' },
      ],
    });

    await renderSwipeImage();

    expect(getImages).toHaveBeenCalledWith(null, contextValue, expect.objectContaining({}));
    expect(mockSwipeableCard.mock.calls.map(([props]) => props.item.pictureId)).toContain('fresh-after-exhaust');
  });

  it('normalizes the synthetic all card so category_id stays undefined while category_key is threaded', async () => {
    getLocalImages.mockResolvedValue(null);
    getImages.mockResolvedValue({
      isError: false,
      images: [
        { pictureId: 'img-1', imageFile: 'file:///one.jpg' },
      ],
    });

    await renderSwipeImage(jest.fn(), { category: { id: 'all', key: 'all' } });

    expect(getImages).toHaveBeenCalledWith(
      null,
      contextValue,
      { language: undefined, scope: undefined }
    );
  });

  it('shows the empty-state guidance when the backend returns no playable images', async () => {
    getLocalImages.mockResolvedValue(null);
    getImages.mockResolvedValue({
      isError: false,
      images: [],
    });

    const { renderer } = await renderSwipeImage();

    const renderedText = renderer.root
      .findAll((node) => node.type === 'Text')
      .map((node) => node.props.children)
      .flat()
      .join(' ');

    expect(renderedText).toContain('To play you can:');
    expect(renderedText).toContain('Upload new images');

    const guidanceNode = renderer.root.findAll((node) => {
      const content = Array.isArray(node.props.children)
        ? node.props.children.join('')
        : node.props.children;

      return node.type === 'Text' && content === 'To play you can:';
    })[0];

    expect(StyleSheet.flatten(guidanceNode.props.style)).toEqual(
      expect.objectContaining({ color: GlobalStyle.color.quaternaryColor })
    );
  });

  it('alerts the user when loading fresh images fails', async () => {
    getLocalImages.mockResolvedValue(null);
    getImages.mockResolvedValue({
      isError: true,
      title: 'Server error',
      message: 'Please retry later',
    });

    await renderSwipeImage();

    expect(Alert.alert).toHaveBeenCalledWith('Server error', 'Please retry later');
  });

  it('deletes a dismissed card at deck 4→3 without firing a foreground load (background prefetch owns refill)', async () => {
    getLocalImages.mockResolvedValue([
      { listId: 1, imageFile: 'file:///1.jpg' },
      { listId: 2, imageFile: 'file:///2.jpg' },
      { listId: 3, imageFile: 'file:///3.jpg' },
      { listId: 4, imageFile: 'file:///4.jpg' },
    ]);
    getLastImageId.mockResolvedValue(4);
    getLastImageUuid.mockResolvedValue('image-4');
    getImages.mockResolvedValue({
      isError: false,
      images: [{ pictureId: 'img-5', imageFile: 'file:///5.jpg' }],
    });
    updateImageList.mockResolvedValue([
      { listId: 2, imageFile: 'file:///2.jpg' },
      { listId: 3, imageFile: 'file:///3.jpg' },
      { listId: 4, imageFile: 'file:///4.jpg' },
      { listId: 5, imageFile: 'file:///5.jpg' },
    ]);

    await renderSwipeImage();

    const removableCard = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 1)[0];
    mockSwipeableCard.mockClear();

    await act(async () => {
      await removableCard.removeCard(1);
      await flushEffects();
    });

    expect(removeImageFromList).toHaveBeenCalledWith(1, 'all', 'any');
    expect(deleteImageFromStorage).toHaveBeenCalledWith('file:///1.jpg');
    // No foreground load at deck 3 (only background prefetch is in flight).
    expect(getImages).not.toHaveBeenCalled();
    expect(updateImageList).not.toHaveBeenCalled();
  });

  it('delegates the warm-all prefetch to prefetchIfLow at deck 4→3 without a foreground load', async () => {
    getLocalImages.mockResolvedValue([
      { listId: 1, imageFile: 'file:///1.jpg' },
      { listId: 2, imageFile: 'file:///2.jpg' },
      { listId: 3, imageFile: 'file:///3.jpg' },
      { listId: 4, imageFile: 'file:///4.jpg' },
    ]);
    getLastImageId.mockResolvedValue(4);
    getImages.mockResolvedValue({ isError: false, images: [] });

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const removableCard = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 1)[0];
    mockSwipeableCard.mockClear();

    await act(async () => {
      await removableCard.removeCard(1);
      await flushEffects();
    });

    // No foreground load at deck 3 (refillOrFallback only fires at deck 0).
    expect(getImages).not.toHaveBeenCalled();
    expect(prefetchIfLow).toHaveBeenCalledWith({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: undefined,
      scope: undefined,
      authContext: contextValue,
      currentListId: undefined,
    });
    const allPrefetchCalls = getImages.mock.calls.filter(
      ([, , params]) => params?.category_key === 'all' && params?.category_id === undefined,
    );
    expect(allPrefetchCalls).toHaveLength(0);
  });

  it('calls prefetchIfLow on every removal (dedup is the prefetcher job, not the component)', async () => {
    getLocalImages.mockResolvedValue([
      { listId: 1, imageFile: 'file:///1.jpg' },
      { listId: 2, imageFile: 'file:///2.jpg' },
      { listId: 3, imageFile: 'file:///3.jpg' },
      { listId: 4, imageFile: 'file:///4.jpg' },
    ]);
    getLastImageId.mockResolvedValue(4);
    getImages.mockResolvedValue({ isError: false, images: [] });

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const cardOne = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 1)[0];
    const cardTwo = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 2)[0];
    mockSwipeableCard.mockClear();

    await act(async () => {
      await cardOne.removeCard(1);
      await flushEffects();
    });
    await act(async () => {
      await cardTwo.removeCard(2);
      await flushEffects();
    });

    expect(prefetchIfLow).toHaveBeenCalledTimes(2);
    const allPrefetchCalls = getImages.mock.calls.filter(
      ([, , params]) => params?.category_key === 'all' && params?.category_id === undefined,
    );
    expect(allPrefetchCalls).toHaveLength(0);
  });

  it('swallows prefetchIfLow rejections without surfacing an Alert (prefetcher owns error handling)', async () => {
    getLocalImages.mockResolvedValue([
      { listId: 1, imageFile: 'file:///1.jpg' },
      { listId: 2, imageFile: 'file:///2.jpg' },
      { listId: 3, imageFile: 'file:///3.jpg' },
      { listId: 4, imageFile: 'file:///4.jpg' },
    ]);
    getLastImageId.mockResolvedValue(4);
    getImages.mockResolvedValue({ isError: false, images: [] });
    prefetchIfLow.mockRejectedValueOnce(new Error('prefetcher failed'));

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const removableCard = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 1)[0];
    mockSwipeableCard.mockClear();

    await act(async () => {
      await removableCard.removeCard(1);
      await flushEffects();
    });

    expect(prefetchIfLow).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('still delegates to prefetchIfLow in e2e mode (prefetcher owns the e2e short-circuit)', async () => {
    isE2EMode.mockReturnValue(true);

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const removableCard = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 1)[0];
    mockSwipeableCard.mockClear();

    await act(async () => {
      await removableCard.removeCard(1);
      await flushEffects();
    });

    expect(prefetchIfLow).toHaveBeenCalled();
    const allPrefetchCalls = getImages.mock.calls.filter(
      ([, , params]) => params?.category_key === 'all' && params?.category_id === undefined,
    );
    expect(allPrefetchCalls).toHaveLength(0);
  });

  it('uses the seeded guess cards in e2e mode instead of cache or network state', async () => {
    isE2EMode.mockReturnValue(true);

    await renderSwipeImage();

    expect(getE2EHiddenGuessCard).toHaveBeenCalledTimes(1);
    expect(buildE2EGuessCardFromPayload).toHaveBeenCalledWith(null);
    expect(buildE2EGuessCards).toHaveBeenCalledTimes(1);
    expect(getLocalImages).not.toHaveBeenCalled();
    expect(getImages).not.toHaveBeenCalled();
    expect(mockSwipeableCard.mock.calls.map(([props]) => props.item.pictureId)).toEqual(['e2e-guess-card']);
  });

  it('prefers a saved hidden guess payload in e2e mode before falling back to the seeded card', async () => {
    isE2EMode.mockReturnValue(true);
    getE2EHiddenGuessCard.mockResolvedValue({
      uri: 'file:///saved-hide.jpg',
      pictureId: 'e2e-hidden-guess-card',
    });

    await renderSwipeImage();

    expect(getE2EHiddenGuessCard).toHaveBeenCalledTimes(1);
    expect(buildE2EGuessCardFromPayload).toHaveBeenCalledWith({
      uri: 'file:///saved-hide.jpg',
      pictureId: 'e2e-hidden-guess-card',
    });
    expect(buildE2EGuessCards).not.toHaveBeenCalled();
    expect(mockSwipeableCard.mock.calls.map(([props]) => props.item.pictureId)).toEqual(['e2e-hidden-guess-card']);
  });

  it('renders one hoisted BadgeDetailModal and populates it from the card item plus fetched tags', async () => {
    const tagDeferred = createDeferred();
    const ratingDeferred = createDeferred();
    const cachedItem = {
      listId: 1,
      pictureId: 'img-1',
      imageFile: 'file:///1.jpg',
      averageRating: 4.5,
      ratingsCount: 9,
      category: { name: 'City' },
      language: 'fr',
      creatorUsername: 'waldo',
      createdAt: '2026-01-02T00:00:00Z',
      fullDescription: 'Find Waldo near the bridge.',
    };

    getLocalImages.mockResolvedValue([
      cachedItem,
      { listId: 2, pictureId: 'img-2', imageFile: 'file:///2.jpg' },
      { listId: 3, pictureId: 'img-3', imageFile: 'file:///3.jpg' },
      { listId: 4, pictureId: 'img-4', imageFile: 'file:///4.jpg' },
    ]);
    getImageTags.mockReturnValue(tagDeferred.promise);
    getImageRating.mockReturnValue(ratingDeferred.promise);

    const { renderer } = await renderSwipeImage();
    const cardProps = mockSwipeableCard.mock.calls.find(([props]) => props.item.pictureId === 'img-1')[0];

    await act(async () => {
      cardProps.onBadgePress(cardProps.item);
      await Promise.resolve();
    });

    expect(renderer.root.findAllByType('BadgeDetailModal')).toHaveLength(1);
    expect(getImageTags).toHaveBeenCalledWith({ pictureId: 'img-1', context: contextValue });
    expect(getImageRating).toHaveBeenCalledWith({ pictureId: 'img-1', context: contextValue });
    expect(mockBadgeDetailModal.mock.calls[mockBadgeDetailModal.mock.calls.length - 1][0].image).toEqual(cachedItem);

    await act(async () => {
      tagDeferred.resolve({
        data: [
          { id: 'tag-1', name: 'scenic' },
          { id: 'tag-2', name: 'night' },
        ],
      });
      await flushEffects();
    });

    expect(renderer.root.findAllByType('BadgeDetailModal')).toHaveLength(1);
    expect(mockBadgeDetailModal.mock.calls[mockBadgeDetailModal.mock.calls.length - 1][0].image).toEqual({
      ...cachedItem,
      tags: ['scenic', 'night'],
    });

    await act(async () => {
      ratingDeferred.resolve({
        data: { global_rating: 4, quality_rating: 3, enigma_rating: 4, fun_rating: 5, difficulty_rating: 2 },
      });
      await flushEffects();
    });

    expect(mockBadgeDetailModal.mock.calls[mockBadgeDetailModal.mock.calls.length - 1][0].image).toEqual({
      ...cachedItem,
      tags: ['scenic', 'night'],
      ratings: { global_rating: 4, quality_rating: 3, enigma_rating: 4, fun_rating: 5, difficulty_rating: 2 },
    });
  });

  it('does not warn when the detail modal closes before tag fetching resolves', async () => {
    const deferred = createDeferred();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    getLocalImages.mockResolvedValue([
      {
        listId: 1,
        pictureId: 'img-1',
        imageFile: 'file:///1.jpg',
      },
      {
        listId: 2,
        pictureId: 'img-2',
        imageFile: 'file:///2.jpg',
      },
      {
        listId: 3,
        pictureId: 'img-3',
        imageFile: 'file:///3.jpg',
      },
      {
        listId: 4,
        pictureId: 'img-4',
        imageFile: 'file:///4.jpg',
      },
    ]);
    getImageTags.mockReturnValue(deferred.promise);
    getImageRating.mockResolvedValue({ data: undefined });

    const { renderer } = await renderSwipeImage();
    const cardProps = mockSwipeableCard.mock.calls.find(([props]) => props.item.pictureId === 'img-1')[0];

    await act(async () => {
      cardProps.onBadgePress(cardProps.item);
      await Promise.resolve();
    });

    const modal = renderer.root.findByType('BadgeDetailModal');

    await act(async () => {
      modal.props.onClose();
      await Promise.resolve();
    });

    await act(async () => {
      renderer.unmount();
    });

    await act(async () => {
      deferred.resolve({ data: [{ id: 'tag-1', name: 'scenic' }] });
      await flushEffects();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe('SwipeImage — cardPrefetcher integration', () => {
  const contextValue = {
    token: 'token',
    uid: 'waldo@example.com',
    expiry: '123',
    access_token: 'access-token',
    client: 'client-id',
    userId: '42',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    isE2EMode.mockReturnValue(false);
    getImages.mockResolvedValue({ isError: false, images: [] });
    getImageTags.mockResolvedValue({ data: [] });
    getImageRating.mockResolvedValue({ data: undefined });
    getE2EHiddenGuessCard.mockResolvedValue(null);
    buildE2EGuessCardFromPayload.mockImplementation((payload) => (
      payload ? { listId: 1, pictureId: payload.pictureId, imageFile: payload.uri } : null
    ));
    buildE2EGuessCards.mockReturnValue([{ listId: 1, pictureId: 'e2e-guess-card', imageFile: 'file:///e2e.jpg' }]);
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    getLastImageId.mockResolvedValue(0);
    getLastImageUuid.mockResolvedValue(null);
    updateImageList.mockResolvedValue([]);
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  async function renderSwipeImage(startGuessing = jest.fn(), { category, language, scope } = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <SwipeImage
            screenWidth={320}
            screenHeight={640}
            startGuessing={startGuessing}
            category={category}
            language={language}
            scope={scope}
          />
        </AuthContext.Provider>,
      );

      await flushEffects();
    });

    return { renderer, startGuessing };
  }

  it('calls prefetchIfLow with the active category, language, scope, and authContext after a card is removed', async () => {
    const scope = { kind: 'private', groupId: 'group-7' };
    readGroupFeedCache.mockResolvedValue({
      images: [
        { listId: 1, imageFile: 'file:///1.jpg' },
        { listId: 2, imageFile: 'file:///2.jpg' },
        { listId: 3, imageFile: 'file:///3.jpg' },
        { listId: 4, imageFile: 'file:///4.jpg' },
      ],
    });
    getLastImageId.mockResolvedValue(4);

    await renderSwipeImage(jest.fn(), {
      category: { id: 'cat-nature', key: 'nature' },
      language: 'fr',
      scope,
    });

    const removableCard = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 1)[0];
    mockSwipeableCard.mockClear();

    await act(async () => {
      await removableCard.removeCard(1);
      await flushEffects();
    });

    expect(prefetchIfLow).toHaveBeenCalledWith({
      categoryKey: 'nature',
      categoryId: 'cat-nature',
      language: 'fr',
      scope,
      authContext: contextValue,
      currentListId: undefined,
    });
  });

  it('calls prefetchIfLow at most once per removeCard (component does not pre-dedupe)', async () => {
    getLocalImages.mockResolvedValue([
      { listId: 1, imageFile: 'file:///1.jpg' },
      { listId: 2, imageFile: 'file:///2.jpg' },
      { listId: 3, imageFile: 'file:///3.jpg' },
      { listId: 4, imageFile: 'file:///4.jpg' },
    ]);
    getLastImageId.mockResolvedValue(4);

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const removableCard = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 1)[0];
    mockSwipeableCard.mockClear();

    await act(async () => {
      await removableCard.removeCard(1);
      await flushEffects();
    });

    expect(prefetchIfLow).toHaveBeenCalledTimes(1);
  });

  it('does not call fetchCardBatch with categoryKey "all" from removeCard anymore (warm-all is the prefetcher job)', async () => {
    getLocalImages.mockResolvedValue([
      { listId: 1, imageFile: 'file:///1.jpg' },
      { listId: 2, imageFile: 'file:///2.jpg' },
      { listId: 3, imageFile: 'file:///3.jpg' },
      { listId: 4, imageFile: 'file:///4.jpg' },
    ]);
    getLastImageId.mockResolvedValue(4);

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const removableCard = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 1)[0];
    mockSwipeableCard.mockClear();

    await act(async () => {
      await removableCard.removeCard(1);
      await flushEffects();
    });

    const allPrefetchCalls = getImages.mock.calls.filter(
      ([, , params]) => params?.category_key === 'all' && params?.category_id === undefined,
    );
    expect(allPrefetchCalls).toHaveLength(0);
    expect(prefetchIfLow).toHaveBeenCalled();
  });
});

describe('SwipeImage — deck-empty fallback to "all"', () => {
  const contextValue = {
    token: 'token',
    uid: 'waldo@example.com',
    expiry: '123',
    access_token: 'access-token',
    client: 'client-id',
    userId: '42',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    isE2EMode.mockReturnValue(false);
    getImages.mockResolvedValue({ isError: false, images: [] });
    getImageTags.mockResolvedValue({ data: [] });
    getImageRating.mockResolvedValue({ data: undefined });
    getE2EHiddenGuessCard.mockResolvedValue(null);
    buildE2EGuessCardFromPayload.mockImplementation((payload) => (
      payload ? { listId: 1, pictureId: payload.pictureId, imageFile: payload.uri } : null
    ));
    buildE2EGuessCards.mockReturnValue([{ listId: 1, pictureId: 'e2e-guess-card', imageFile: 'file:///e2e.jpg' }]);
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    getLastImageId.mockResolvedValue(0);
    getLastImageUuid.mockResolvedValue(null);
    updateImageList.mockResolvedValue([]);
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  async function renderSwipeImage(startGuessing = jest.fn(), { category, language, scope } = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <SwipeImage
            screenWidth={320}
            screenHeight={640}
            startGuessing={startGuessing}
            category={category}
            language={language}
            scope={scope}
          />
        </AuthContext.Provider>,
      );

      await flushEffects();
    });

    return { renderer, startGuessing };
  }

  it('falls back to the warmed "all" deck from AsyncStorage when removeCard empties a real category deck (no foreground load)', async () => {
    const natureCards = [
      { listId: 1, pictureId: 'nat-1', imageFile: 'file:///n1.jpg' },
      { listId: 2, pictureId: 'nat-2', imageFile: 'file:///n2.jpg' },
      { listId: 3, pictureId: 'nat-3', imageFile: 'file:///n3.jpg' },
      { listId: 4, pictureId: 'nat-4', imageFile: 'file:///n4.jpg' },
    ];
    const allCard = { listId: 1, pictureId: 'all-1', imageFile: 'file:///a1.jpg' };

    let natureCallCount = 0;
    getLocalImages.mockImplementation((key) => {
      if (key === 'nature') {
        natureCallCount += 1;
        return Promise.resolve(natureCallCount === 1 ? natureCards : []);
      }
      if (key === 'all') {
        return Promise.resolve([allCard]);
      }
      return Promise.resolve(null);
    });

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    expect(getImages).not.toHaveBeenCalled();

    const cardPropsById = {};
    for (const listId of [1, 2, 3, 4]) {
      cardPropsById[listId] = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === listId)[0];
    }

    for (const listId of [1, 2, 3, 4]) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await cardPropsById[listId].removeCard(listId);
        await flushEffects();
      });
    }

    expect(getImages).not.toHaveBeenCalled();
    expect(warmAllDeckIfNeeded).toHaveBeenCalledWith(expect.objectContaining({ language: undefined, scope: undefined }));
    const renderedPictureIds = mockSwipeableCard.mock.calls.map(([props]) => props.item.pictureId);
    expect(renderedPictureIds).toContain('all-1');
  });

  it('uses the category prefetch result before warming or foreground-loading when the last card is removed', async () => {
    const prefetchedNatureCard = { listId: 5, pictureId: 'nat-5', imageFile: 'file:///n5.jpg' };
    let natureDeck = [
      { listId: 1, pictureId: 'nat-1', imageFile: 'file:///n1.jpg' },
      { listId: 2, pictureId: 'nat-2', imageFile: 'file:///n2.jpg' },
      { listId: 3, pictureId: 'nat-3', imageFile: 'file:///n3.jpg' },
      { listId: 4, pictureId: 'nat-4', imageFile: 'file:///n4.jpg' },
    ];
    let allDeck = [];

    getLocalImages.mockImplementation((key) => {
      if (key === 'nature') {
        return Promise.resolve([...natureDeck]);
      }
      if (key === 'all') {
        return Promise.resolve([...allDeck]);
      }
      return Promise.resolve(null);
    });
    removeImageFromList.mockImplementation(async (listId, key) => {
      if (key === 'nature') {
        natureDeck = natureDeck.filter((item) => item.listId !== listId);
      }
      if (key === 'all') {
        allDeck = allDeck.filter((item) => item.listId !== listId);
      }
      return null;
    });
    prefetchIfLow.mockImplementation(({ categoryKey }) => {
      if (categoryKey === 'nature' && natureDeck.length === 0) {
        natureDeck = [prefetchedNatureCard];
      }
      return Promise.resolve();
    });

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const cardPropsById = {};
    for (const listId of [1, 2, 3, 4]) {
      cardPropsById[listId] = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === listId)[0];
    }

    getImages.mockClear();
    warmAllDeckIfNeeded.mockClear();

    for (const listId of [1, 2, 3, 4]) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await cardPropsById[listId].removeCard(listId);
        await flushEffects();
      });
    }

    expect(getImages).not.toHaveBeenCalled();
    expect(warmAllDeckIfNeeded).not.toHaveBeenCalled();
    expect(mockSwipeableCard.mock.calls.map(([props]) => props.item.pictureId)).toContain('nat-5');
  });

  it('fires a last-resort foreground load when both the active category deck and "all" are empty on removeCard', async () => {
    const natureCards = [
      { listId: 1, pictureId: 'nat-1', imageFile: 'file:///n1.jpg' },
      { listId: 2, pictureId: 'nat-2', imageFile: 'file:///n2.jpg' },
      { listId: 3, pictureId: 'nat-3', imageFile: 'file:///n3.jpg' },
      { listId: 4, pictureId: 'nat-4', imageFile: 'file:///n4.jpg' },
    ];
    let natureCallCount = 0;
    getLocalImages.mockImplementation((key) => {
      if (key === 'nature') {
        natureCallCount += 1;
        return Promise.resolve(natureCallCount === 1 ? natureCards : []);
      }
      return Promise.resolve(null);
    });
    getLastImageId.mockResolvedValue(4);
    getImages.mockResolvedValue({ isError: false, images: [{ pictureId: 'fresh-1', imageFile: 'file:///f1.jpg' }] });

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const cardPropsById = {};
    for (const listId of [1, 2, 3, 4]) {
      cardPropsById[listId] = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === listId)[0];
    }

    for (const listId of [1, 2, 3, 4]) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await cardPropsById[listId].removeCard(listId);
        await flushEffects();
      });
    }

    expect(getImages).toHaveBeenCalled();
    const natureForegroundCalls = getImages.mock.calls.filter(
      ([, , params]) => params?.category_key === 'nature',
    );
    expect(natureForegroundCalls.length).toBeGreaterThan(0);
  });

  it('does not fire a foreground load when removeCard drops the deck from 4→3 (low but not empty)', async () => {
    getLocalImages.mockResolvedValue([
      { listId: 1, pictureId: 'nat-1', imageFile: 'file:///n1.jpg' },
      { listId: 2, pictureId: 'nat-2', imageFile: 'file:///n2.jpg' },
      { listId: 3, pictureId: 'nat-3', imageFile: 'file:///n3.jpg' },
      { listId: 4, pictureId: 'nat-4', imageFile: 'file:///n4.jpg' },
    ]);
    getLastImageId.mockResolvedValue(4);

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const first = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 1)[0];
    getImages.mockClear();

    await act(async () => {
      await first.removeCard(1);
      await flushEffects();
    });

    expect(getImages).not.toHaveBeenCalled();
    expect(prefetchIfLow).toHaveBeenCalled();
  });

  it('on mount, cold-starts the active category foreground load when the category deck is empty (no switch to "all")', async () => {
    const allCard = { listId: 1, pictureId: 'all-1', imageFile: 'file:///a1.jpg' };
    getLocalImages.mockImplementation((key) => {
      if (key === 'nature') return Promise.resolve([]);
      if (key === 'all') return Promise.resolve([allCard]);
      return Promise.resolve(null);
    });
    getImages.mockResolvedValue({
      isError: false,
      images: [{ pictureId: 'nat-fresh', imageFile: 'file:///nf.jpg' }],
    });

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    // No cross-category 'recent/all' fallback on mount — that refill only fires mid-play.
    expect(warmAllDeckIfNeeded).not.toHaveBeenCalled();
    expect(getImages).toHaveBeenCalledWith(
      null,
      expect.anything(),
      { language: undefined, scope: undefined, category_key: 'nature' },
    );
    expect(mockSwipeableCard.mock.calls.map(([props]) => props.item.pictureId)).not.toContain('all-1');
  });

  it('on mount, fires the foreground cold-start load when the category deck AND "all" are both empty', async () => {
    getLocalImages.mockResolvedValue(null);
    getImages.mockResolvedValue({
      isError: false,
      images: [{ pictureId: 'fresh-1', imageFile: 'file:///f1.jpg' }],
    });
    getLastImageId.mockResolvedValue(0);

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    expect(getImages).toHaveBeenCalled();
  });

  it('after falling back to "all", a subsequent removeCard removes from the "all" AsyncStorage key', async () => {
    const natureCards = [
      { listId: 1, pictureId: 'nat-1', imageFile: 'file:///n1.jpg' },
      { listId: 2, pictureId: 'nat-2', imageFile: 'file:///n2.jpg' },
      { listId: 3, pictureId: 'nat-3', imageFile: 'file:///n3.jpg' },
      { listId: 4, pictureId: 'nat-4', imageFile: 'file:///n4.jpg' },
    ];
    const allCard = { listId: 1, pictureId: 'all-1', imageFile: 'file:///a1.jpg' };

    let natureCallCount = 0;
    getLocalImages.mockImplementation((key) => {
      if (key === 'nature') {
        natureCallCount += 1;
        return Promise.resolve(natureCallCount === 1 ? natureCards : []);
      }
      if (key === 'all') return Promise.resolve([allCard]);
      return Promise.resolve(null);
    });

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const cardPropsById = {};
    for (const listId of [1, 2, 3, 4]) {
      cardPropsById[listId] = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === listId)[0];
    }

    for (const listId of [1, 2, 3, 4]) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await cardPropsById[listId].removeCard(listId);
        await flushEffects();
      });
    }

    removeImageFromList.mockClear();

    const allRemovable = mockSwipeableCard.mock.calls.find(([props]) => props.item.pictureId === 'all-1')[0];
    await act(async () => {
      await allRemovable.removeCard(allCard.listId);
      await flushEffects();
    });

    expect(removeImageFromList).toHaveBeenCalledWith(allCard.listId, 'all', 'any');
  });

  it('private scope: fallback reads the groupFeedCache for "all" (categoryId undefined) when the group nature deck empties', async () => {
    const scope = { kind: 'private', groupId: 'group-7' };
    const natureCards = [
      { listId: 1, pictureId: 'nat-1', imageFile: 'file:///n1.jpg' },
      { listId: 2, pictureId: 'nat-2', imageFile: 'file:///n2.jpg' },
      { listId: 3, pictureId: 'nat-3', imageFile: 'file:///n3.jpg' },
      { listId: 4, pictureId: 'nat-4', imageFile: 'file:///n4.jpg' },
    ];
    const allCard = { listId: 1, pictureId: 'all-1', imageFile: 'file:///a1.jpg' };

    let natureCallCount = 0;
    readGroupFeedCache.mockImplementation((groupId, { categoryId } = {}) => {
      if (groupId !== 'group-7') return Promise.resolve(null);
      if (categoryId === 'cat-nature') {
        natureCallCount += 1;
        return Promise.resolve({ images: natureCallCount === 1 ? natureCards : [], nextCursor: null });
      }
      if (categoryId === undefined) {
        return Promise.resolve({ images: [allCard], nextCursor: null });
      }
      return Promise.resolve(null);
    });

    await renderSwipeImage(jest.fn(), {
      category: { id: 'cat-nature', key: 'nature' },
      language: 'fr',
      scope,
    });

    expect(getImages).not.toHaveBeenCalled();

    const cardPropsById = {};
    for (const listId of [1, 2, 3, 4]) {
      cardPropsById[listId] = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === listId)[0];
    }

    for (const listId of [1, 2, 3, 4]) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await cardPropsById[listId].removeCard(listId);
        await flushEffects();
      });
    }

    expect(getImages).not.toHaveBeenCalled();
    const allCacheReads = readGroupFeedCache.mock.calls.filter(
      ([, params]) => params?.categoryId === undefined,
    );
    expect(allCacheReads.length).toBeGreaterThan(0);
    expect(mockSwipeableCard.mock.calls.map(([props]) => props.item.pictureId)).toContain('all-1');
  });

  it('e2e mode: deck-empty fallback runs without crashing (warm/prefetch are no-ops; storage reads return null)', async () => {
    isE2EMode.mockReturnValue(true);
    getLocalImages.mockResolvedValue(null);

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const removable = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 1)[0];

    await act(async () => {
      await removable.removeCard(1);
      await flushEffects();
    });

    expect(prefetchIfLow).toHaveBeenCalled();
  });
});