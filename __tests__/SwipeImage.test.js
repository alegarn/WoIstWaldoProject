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
  getE2EHiddenGuessCard: jest.fn(),
  getLocalImages: jest.fn(),
  storeImageList: jest.fn(),
  getLastImageId: jest.fn(),
  emptyImageList: jest.fn(),
  removeImageFromList: jest.fn(),
  updateImageList: jest.fn(),
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
  removeImageFromList,
  storeImageList,
  updateImageList,
} from '../utils/storageDatum';

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

    expect(getImages).toHaveBeenCalledWith(null, contextValue, { category_id: undefined, category_key: 'all', language: undefined });
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

    expect(getImages).toHaveBeenCalledWith(null, contextValue, { category_id: undefined, category_key: 'all', language: undefined });
    expect(storeImageList).toHaveBeenCalledWith([
      expect.objectContaining({ pictureId: 'img-1', listId: 1 }),
    ], 'all', 'any');
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
      { category_id: undefined, category_key: 'all', language: undefined }
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

  it('deletes a dismissed card and fetches more images when the stack drops below four', async () => {
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
    expect(getImages).toHaveBeenCalledWith('image-4', contextValue, { category_id: undefined, category_key: 'all', language: undefined });
    expect(updateImageList).toHaveBeenCalledWith([
      expect.objectContaining({ pictureId: 'img-5', listId: 5 }),
    ], 'all', 'any');
  });

  it('silently prefetches the all deck when the stack drops below four', async () => {
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

    expect(getImages).toHaveBeenCalledWith(
      null,
      contextValue,
      expect.objectContaining({ category_key: 'nature', category_id: 'cat-nature' }),
    );
    expect(getImages).toHaveBeenCalledWith(
      null,
      contextValue,
      expect.objectContaining({ category_key: 'all', category_id: undefined }),
    );
  });

  it('deduplicates the all-deck prefetch via allDeckWarmedRef on a second removal', async () => {
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

    const allPrefetchCalls = getImages.mock.calls.filter(
      ([, , params]) => params?.category_key === 'all' && params?.category_id === undefined,
    );
    expect(allPrefetchCalls).toHaveLength(1);
  });

  it('swallows all-deck prefetch errors without surfacing an Alert', async () => {
    getLocalImages.mockResolvedValue([
      { listId: 1, imageFile: 'file:///1.jpg' },
      { listId: 2, imageFile: 'file:///2.jpg' },
      { listId: 3, imageFile: 'file:///3.jpg' },
      { listId: 4, imageFile: 'file:///4.jpg' },
    ]);
    getLastImageId.mockResolvedValue(4);
    getImages.mockImplementation((pictureId, authContext, params) => {
      if (params?.category_key === 'all') {
        return Promise.reject(new Error('all-deck warmup failed'));
      }
      return Promise.resolve({ isError: false, images: [] });
    });

    await renderSwipeImage(jest.fn(), { category: { id: 'cat-nature', key: 'nature' } });

    const removableCard = mockSwipeableCard.mock.calls.find(([props]) => props.item.listId === 1)[0];
    mockSwipeableCard.mockClear();

    await act(async () => {
      await removableCard.removeCard(1);
      await flushEffects();
    });

    expect(getImages).toHaveBeenCalledWith(
      null,
      contextValue,
      expect.objectContaining({ category_key: 'all', category_id: undefined }),
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('skips the all-deck prefetch entirely in e2e mode', async () => {
    isE2EMode.mockReturnValue(true);

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