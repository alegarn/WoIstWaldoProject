const mockLoadingOverlay = jest.fn(() => null);

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../utils/e2eMode', () => ({
  getE2EAdDelayMs: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import AdScreen from '../screens/GuessScreens/AdScreen';
import { getE2EAdDelayMs } from '../utils/e2eMode';

describe('AdScreen', () => {
  const originalDev = global.__DEV__;
  const route = {
    params: {
      onTarget: true,
      imageFile: 'file:///waldo.jpg',
      pictureId: 'img-42',
      description: 'Look near the fountain',
      imageHeight: 1200,
      imageWidth: 800,
      isPortrait: true,
      hiddenLocation: { x: 0.2, y: 0.4 },
      screenHeight: 640,
      screenWidth: 320,
      listId: 9,
      isTutorial: false,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    getE2EAdDelayMs.mockReturnValue(5000);
  });

  afterEach(() => {
    global.__DEV__ = originalDev;
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('navigates to the result screen after the production timeout elapses', async () => {
    global.__DEV__ = false;
    const navigation = {
      replace: jest.fn(),
    };

    await act(async () => {
      create(<AdScreen navigation={navigation} route={route} />);
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(navigation.replace).toHaveBeenCalledWith('ResultScreen', route.params);
  });

  it('shows the loading overlay immediately in development mode while no ad is loaded', async () => {
    global.__DEV__ = true;
    let renderer;

    await act(async () => {
      renderer = create(<AdScreen navigation={{ replace: jest.fn() }} route={route} />);
    });

    expect(mockLoadingOverlay).toHaveBeenCalledWith({
      message: 'Loading Ads... Are you a test user? Sorry, just wait 5 seconds :3 ',
    });

    await act(async () => {
      renderer.unmount();
      jest.clearAllTimers();
    });
  });

  it('skips the ad wait in e2e mode', async () => {
    global.__DEV__ = false;
    getE2EAdDelayMs.mockReturnValue(0);

    const navigation = {
      replace: jest.fn(),
    };

    await act(async () => {
      create(<AdScreen navigation={navigation} route={route} />);
    });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(navigation.replace).toHaveBeenCalledWith('ResultScreen', route.params);
  });
});