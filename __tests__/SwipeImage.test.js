const mockSwipeableCard = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

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

jest.mock('../utils/imagesRequests', () => ({
  getImages: jest.fn(),
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
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import SwipeImage from '../components/UI/SwipeImage';
import { AuthContext } from '../store/auth-context';
import { buildE2EGuessCardFromPayload, buildE2EGuessCards, isE2EMode } from '../utils/e2eMode';
import { getImages } from '../utils/imagesRequests';
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

  async function renderSwipeImage(startGuessing = jest.fn()) {
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <SwipeImage screenWidth={320} screenHeight={640} startGuessing={startGuessing} />
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

    expect(getImages).toHaveBeenCalledWith(null, contextValue);
    expect(storeImageList).toHaveBeenCalledWith([
      expect.objectContaining({ pictureId: 'img-1', listId: 5 }),
      expect.objectContaining({ pictureId: 'img-2', listId: 6 }),
    ]);
    expect(mockSwipeableCard.mock.calls.map(([props]) => props.item.listId)).toEqual([6, 5]);
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

    expect(removeImageFromList).toHaveBeenCalledWith(1);
    expect(deleteImageFromStorage).toHaveBeenCalledWith('file:///1.jpg');
    expect(getImages).toHaveBeenCalledWith('image-4', contextValue);
    expect(updateImageList).toHaveBeenCalledWith([
      expect.objectContaining({ pictureId: 'img-5', listId: 5 }),
    ]);
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
});