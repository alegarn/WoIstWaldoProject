const mockResultChoices = jest.fn(() => null);
const mockImageAnimated = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);

jest.mock('../components/Results/ResultChoices', () => {
  return function MockResultChoices(props) {
    mockResultChoices(props);
    return null;
  };
});

jest.mock('../components/Results/ImageAnimated', () => {
  return function MockImageAnimated(props) {
    mockImageAnimated(props);
    return null;
  };
});

jest.mock('../components/UI/TutorialOverlay', () => {
  return function MockTutorialOverlay(props) {
    mockTutorialOverlay(props);
    return null;
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import ShowFailure from '../components/Results/ShowFailure';

describe('ShowFailure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reveals the failure result state and retry choices after the animation', async () => {
    const navigation = { replace: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'image-1',
        description: 'Find Waldo behind the tree.',
        imageHeight: 240,
        imageWidth: 320,
        isPortrait: false,
        hiddenLocation: { x: 0.58, y: 0.46 },
        screenHeight: 640,
        screenWidth: 320,
        isTutorial: true,
      },
    };

    let renderer;

    await act(async () => {
      renderer = create(<ShowFailure navigation={navigation} route={route} />);
    });

    expect(mockImageAnimated).toHaveBeenCalledWith({ success: false });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(renderer.root.findByProps({ testID: 'result.screen.failure' })).toBeTruthy();
    expect(mockResultChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        navigation,
        success: false,
        isTutorial: true,
      })
    );
    expect(mockTutorialOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'ShowFailure' })
    );
  });
});