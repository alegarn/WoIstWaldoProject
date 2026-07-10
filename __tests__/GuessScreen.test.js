const mockGuessPicture = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);

jest.mock('../components/Picture/GuessPicture', () => {
  return function MockGuessPicture(props) {
    mockGuessPicture(props);
    return null;
  };
});

jest.mock('../components/UI/TutorialOverlay', () => {
  return function MockTutorialOverlay(props) {
    mockTutorialOverlay(props);
    return null;
  };
});

jest.mock('../utils/targetLocation', () => ({
  isOnTarget: jest.fn(),
}));

import React from 'react';
import { Dimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import GuessScreen from '../screens/GuessScreens/GuessScreen';
import { isOnTarget } from '../utils/targetLocation';

describe('GuessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 1,
    });
  });

  afterEach(() => {
    Dimensions.get.mockRestore();
  });

  it('passes the image payload to GuessPicture and routes guesses to AdScreen', async () => {
    const navigation = { replace: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: true,
      },
    };
    isOnTarget.mockReturnValue(true);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = mockGuessPicture.mock.calls[mockGuessPicture.mock.calls.length - 1][0];
    pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });

    expect(pictureProps.screenDimensions).toEqual({ width: 320, height: 640 });
    expect(isOnTarget).toHaveBeenCalledWith({ location: { x: 0.5, y: 0.5 } });
    expect(navigation.replace).toHaveBeenCalledWith('AdScreen', {
      onTarget: true,
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      description: 'Find Waldo',
      imageHeight: 1200,
      imageWidth: 800,
      isPortrait: true,
      hiddenLocation: { x: 0.5, y: 0.5 },
      screenHeight: 640,
      screenWidth: 320,
      listId: 3,
      isTutorial: true,
    });
    expect(mockTutorialOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'GuessScreen', isPortrait: true })
    );
  });

  it('skips AdScreen and goes straight to ResultScreen for private scope guesses', async () => {
    const navigation = { replace: jest.fn() };
    const scope = { kind: 'private', groupId: 'group-7' };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 3,
        isTutorial: false,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        scope,
      },
    };
    isOnTarget.mockReturnValue(false);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = mockGuessPicture.mock.calls[mockGuessPicture.mock.calls.length - 1][0];
    pictureProps.toAdScreen({ location: { x: 0.1, y: 0.2 } });

    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('ResultScreen', {
      onTarget: false,
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      description: 'Find Waldo',
      imageHeight: 1200,
      imageWidth: 800,
      isPortrait: true,
      hiddenLocation: { x: 0.5, y: 0.5 },
      screenHeight: 640,
      screenWidth: 320,
      listId: 3,
      isTutorial: false,
      category: { id: 'cat-1', key: 'nature' },
      language: 'fr',
      scope,
    });
  });
});