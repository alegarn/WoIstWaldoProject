const mockGuessPicture = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);
const mockGuessExitSwipeMenu = jest.fn(() => null);
const mockSuccessOverlay = jest.fn(() => null);

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

jest.mock('../components/Guess/GuessExitSwipeMenu', () => {
  return function MockGuessExitSwipeMenu(props) {
    mockGuessExitSwipeMenu(props);
    return null;
  };
});

jest.mock('../components/Guess/SuccessOverlay', () => {
  return function MockSuccessOverlay(props) {
    mockSuccessOverlay(props);
    return null;
  };
});

jest.mock('../utils/targetLocation', () => ({
  isOnTarget: jest.fn(),
}));

jest.mock('../utils/handleGuessOutcome', () => ({
  applySuccessSideEffects: jest.fn(),
  resolveNextGuessParams: jest.fn(),
}));

jest.mock('../utils/guessNavigation', () => ({
  navigateToNextGuess: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: jest.fn(() => false),
}));

jest.mock('../services/cardPrefetcher', () => ({
  prefetchIfLow: jest.fn(() => Promise.resolve()),
  warmAllDeckIfNeeded: jest.fn(() => Promise.resolve()),
}));

jest.mock('../hooks/useStreak', () => {
  const actual = jest.requireActual('../hooks/useStreak');
  const spies = { onWin: jest.fn(), onLose: jest.fn(), reset: jest.fn() };
  const useStreakMock = jest.fn((initial) => {
    const result = actual.useStreak(initial);
    return {
      ...result,
      onWin: (...args) => { spies.onWin(...args); return result.onWin(...args); },
      onLose: (...args) => { spies.onLose(...args); return result.onLose(...args); },
      reset: (...args) => { spies.reset(...args); return result.reset(...args); },
    };
  });
  useStreakMock.__spies = spies;
  return { useStreak: useStreakMock };
});

import React from 'react';
import { Dimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import GuessScreen from '../screens/GuessScreens/GuessScreen';
import { isOnTarget } from '../utils/targetLocation';
import { applySuccessSideEffects, resolveNextGuessParams } from '../utils/handleGuessOutcome';
import { navigateToNextGuess } from '../utils/guessNavigation';
import { prefetchIfLow } from '../services/cardPrefetcher';
import { warmAllDeckIfNeeded } from '../services/cardPrefetcher';

function lastPictureProps() {
  return mockGuessPicture.mock.calls[mockGuessPicture.mock.calls.length - 1][0];
}

function lastOverlayProps() {
  return mockSuccessOverlay.mock.calls[mockSuccessOverlay.mock.calls.length - 1][0];
}

function lastMenuProps() {
  return mockGuessExitSwipeMenu.mock.calls[mockGuessExitSwipeMenu.mock.calls.length - 1][0];
}

function streakSpies() {
  const { useStreak } = require('../hooks/useStreak');
  return useStreak.__spies;
}

describe('GuessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { isE2EMode } = require('../utils/e2eMode');
    isE2EMode.mockReturnValue(false);
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

  it('on success (public): buffers side effects, shows overlay, never navigates to AdScreen/ResultScreen', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
    });

    expect(applySuccessSideEffects).toHaveBeenCalledWith({
      listId: 3,
      categoryKey: 'nature',
      language: 'fr',
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      scope: undefined,
      userId: '',
      points: 2,
      multiplier: 2,
      streak: 1,
      streakMultiplier: 1.0,
    });
    expect(navigation.replace).not.toHaveBeenCalledWith('AdScreen', expect.anything());
    expect(navigation.replace).not.toHaveBeenCalledWith('ResultScreen', expect.anything());

    const overlayProps = lastOverlayProps();
    expect(overlayProps.visible).toBe(true);
    expect(overlayProps.onDone).toEqual(expect.any(Function));
    expect(overlayProps.multiplier).toBe(2);
    expect(overlayProps.points).toBe(2);
  });

  it('on a slow success (elapsedMs past threshold) uses multiplier=1 and skips the bonus', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 6000 });
    });

    expect(applySuccessSideEffects).toHaveBeenCalledWith({
      listId: 3,
      categoryKey: 'nature',
      language: 'fr',
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      scope: undefined,
      userId: '',
      points: 1,
      multiplier: 1,
      streak: 1,
      streakMultiplier: 1.0,
    });
    expect(lastOverlayProps().multiplier).toBe(1);
    expect(lastOverlayProps().points).toBe(1);
  });

  it('never navigates to AdScreen regardless of speed bonus', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
    });

    expect(navigation.replace).not.toHaveBeenCalledWith('AdScreen', expect.anything());
    expect(navigation.replace).not.toHaveBeenCalledWith('ResultScreen', expect.anything());
  });

  it('overlay onDone with resolved params advances via setParams (no replace, no navigateToNextGuess)', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    const nextParams = {
      listId: 4,
      imageFile: 'file:///next.jpg',
      pictureId: 'image-2',
      description: 'Next card',
      hiddenLocation: { x: 0.3, y: 0.7 },
      category: { id: 'cat-1', key: 'nature' },
      language: 'fr',
      isTutorial: false,
      skipInstructions: true,
    };
    resolveNextGuessParams.mockResolvedValue({ params: nextParams });

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
    });

    const overlayProps = lastOverlayProps();
    await act(async () => {
      overlayProps.onDone();
    });

    expect(resolveNextGuessParams).toHaveBeenCalledWith({
      category: { id: 'cat-1', key: 'nature' },
      language: 'fr',
      currentListId: 3,
      isTutorial: false,
      scope: undefined,
    });
    expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
    expect(navigation.replace).not.toHaveBeenCalledWith('GuessScreen', expect.anything());
    expect(navigateToNextGuess).not.toHaveBeenCalled();
    // Regression (T4): prefetch fired during success path but did not block overlay/setParams.
    expect(prefetchIfLow).toHaveBeenCalledTimes(1);
    expect(prefetchIfLow).toHaveBeenCalledWith({
      categoryKey: 'nature',
      categoryId: 'cat-1',
      language: 'fr',
      scope: undefined,
      authContext: expect.objectContaining({ userId: '' }),
    });
  });

  it('overlay onDone with null (deck exhausted) falls back to navigateToNextGuess (no setParams)', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);
    resolveNextGuessParams.mockResolvedValue(null);
    navigateToNextGuess.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
    });

    const overlayProps = lastOverlayProps();
    await act(async () => {
      overlayProps.onDone();
    });

    expect(navigateToNextGuess).toHaveBeenCalledWith(
      navigation,
      {
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        currentListId: 3,
        isTutorial: false,
        scope: undefined,
      }
    );
    expect(navigation.setParams).not.toHaveBeenCalled();
    // Regression (T5): prefetch fired on win but did not interfere with exhaustion fallback.
    expect(prefetchIfLow).toHaveBeenCalledTimes(1);
    expect(navigateToNextGuess).toHaveBeenCalledTimes(1);
  });

  it('on failure (private scope): navigates to ResultScreen with sharedParams, no side effects, overlay hidden', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.1, y: 0.2 } });
    });

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
    expect(applySuccessSideEffects).not.toHaveBeenCalled();

    const overlayProps = lastOverlayProps();
    expect(overlayProps.visible).toBe(false);
  });

  it('activates hints on the first card of each game series (non-e2e mount)', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    expect(pictureProps.pulseTarget).toBe(true);
    expect(pictureProps.onInteract).toEqual(expect.any(Function));

    const menuProps = lastMenuProps();
    expect(menuProps.showHints).toBe(true);
    expect(menuProps.onInteract).toEqual(expect.any(Function));
  });

  it('suppresses hints in e2e mode', async () => {
    const { isE2EMode } = require('../utils/e2eMode');
    isE2EMode.mockReturnValue(true);

    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    expect(lastPictureProps().pulseTarget).toBe(false);
    expect(lastMenuProps().showHints).toBe(false);
  });

  it('dismisses hints on first onInteract', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    expect(lastPictureProps().pulseTarget).toBe(true);
    expect(lastMenuProps().showHints).toBe(true);

    await act(async () => {
      lastPictureProps().onInteract();
    });

    expect(lastPictureProps().pulseTarget).toBe(false);
    expect(lastMenuProps().showHints).toBe(false);
  });

  it('on success: calls streak.onWin and passes streakTier (tier >= 0) to SuccessOverlay', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
    });

    expect(streakSpies().onWin).toHaveBeenCalledTimes(1);
    expect(streakSpies().onLose).not.toHaveBeenCalled();

    const overlayProps = lastOverlayProps();
    expect(overlayProps.streakTier).toBeDefined();
    expect(overlayProps.streakTier.tier).toBeGreaterThanOrEqual(0);
  });

  it('after 3 consecutive successes, SuccessOverlay streakTier.tier === 1 (Focused)', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
      });
    }

    expect(streakSpies().onWin).toHaveBeenCalledTimes(3);

    const overlayProps = lastOverlayProps();
    expect(overlayProps.streakTier.tier).toBe(1);
    expect(overlayProps.streakTier.label).toBe('Focused');
  });

  it('on failure: calls streak.onLose before navigating to ResultScreen', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(false);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.1, y: 0.2 } });
    });

    expect(streakSpies().onLose).toHaveBeenCalledTimes(1);
    expect(streakSpies().onWin).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith('ResultScreen', expect.anything());
  });

  it('after success then failure: streak resets and a fresh mount starts a tier-0 streak', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
      });
    }
    expect(lastOverlayProps().streakTier.tier).toBe(1);

    isOnTarget.mockReturnValue(false);
    await act(async () => {
      pictureProps.toAdScreen({ location: { x: 0.1, y: 0.2 } });
    });
    expect(streakSpies().onLose).toHaveBeenCalledTimes(1);

    isOnTarget.mockReturnValue(true);
    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });
    await act(async () => {
      lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
    });

    expect(lastOverlayProps().streakTier.tier).toBe(0);
  });

  it('final points reflects both multipliers: Math.round(base * speedMul * streakMul)', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    const pictureProps = lastPictureProps();
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
      });
    }

    const overlayProps = lastOverlayProps();
    expect(overlayProps.multiplier).toBe(2);
    expect(overlayProps.streakTier.multiplier).toBe(1.5);
    expect(overlayProps.points).toBe(3);
  });

  it('regression: 3rd consecutive win buffers post-increment streak=3, streakMultiplier=1.5, points=3 (not stale tier-0 values)', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
      });
    }

    expect(applySuccessSideEffects).toHaveBeenCalledTimes(3);
    expect(applySuccessSideEffects).toHaveBeenLastCalledWith({
      listId: 3,
      categoryKey: 'nature',
      language: 'fr',
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      scope: undefined,
      userId: '',
      points: 3,
      multiplier: 2,
      streak: 3,
      streakMultiplier: 1.5,
    });

    const overlayProps = lastOverlayProps();
    expect(overlayProps.streakTier.tier).toBe(1);
    expect(overlayProps.streakTier.multiplier).toBe(1.5);
    expect(overlayProps.points).toBe(3);
  });

  it('regression: 7th consecutive win buffers post-increment streak=7, streakMultiplier=2.0, points=4', async () => {
    const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
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
      },
    };
    isOnTarget.mockReturnValue(true);
    applySuccessSideEffects.mockResolvedValue(undefined);

    await act(async () => {
      create(<GuessScreen navigation={navigation} route={route} />);
    });

    for (let i = 0; i < 7; i++) {
      await act(async () => {
        lastPictureProps().toAdScreen({ location: { x: 0.5, y: 0.5 }, elapsedMs: 1000 });
      });
    }

    expect(applySuccessSideEffects).toHaveBeenCalledTimes(7);
    expect(applySuccessSideEffects).toHaveBeenLastCalledWith({
      listId: 3,
      categoryKey: 'nature',
      language: 'fr',
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      scope: undefined,
      userId: '',
      points: 4,
      multiplier: 2,
      streak: 7,
      streakMultiplier: 2.0,
    });

    const overlayProps = lastOverlayProps();
    expect(overlayProps.streakTier.tier).toBe(2);
    expect(overlayProps.streakTier.multiplier).toBe(2.0);
    expect(overlayProps.points).toBe(4);
  });

  describe('background prefetch on streak win', () => {
    function baseRoute(overrides = {}) {
      return {
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
          ...overrides,
        },
      };
    }

    it('T1: on success fires prefetchIfLow after applySuccessSideEffects with identity deps', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      expect(applySuccessSideEffects).toHaveBeenCalled();
      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(prefetchIfLow).toHaveBeenCalledWith({
        categoryKey: 'nature',
        categoryId: 'cat-1',
        language: 'fr',
        scope: undefined,
        authContext: expect.objectContaining({ userId: '' }),
      });
    });

    it('T7 (plan-spec): on success (private scope): prefetchIfLow called with private scope passed through', async () => {
      // Mirrors T1 with scope = { kind: 'private', groupId: 'group-7' }.
      // Screen must NOT strip or rewrite scope; prefetcher handles private
      // write path internally (out of scope for screen test).
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      const privateScope = { kind: 'private', groupId: 'group-7' };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute({ scope: privateScope })} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      expect(applySuccessSideEffects).toHaveBeenCalled();
      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(prefetchIfLow).toHaveBeenCalledWith({
        categoryKey: 'nature',
        categoryId: 'cat-1',
        language: 'fr',
        scope: privateScope,
        authContext: expect.objectContaining({ userId: '' }),
      });
    });

    it('T2: prefetch is fire-and-forget (overlay visible even before prefetch resolves)', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      // Never-resolving deferred: if awaited, SuccessOverlay would never show.
      prefetchIfLow.mockReturnValue(new Promise(() => {}));

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(lastOverlayProps().visible).toBe(true);
    });

    it('T3: prefetch is a no-op in e2e mode (screen-side guard is internal to prefetcher)', async () => {
      // Prefetcher guards on isE2EMode internally. Mock the module to mimic that behavior.
      const { isE2EMode } = require('../utils/e2eMode');
      isE2EMode.mockReturnValue(true);
      prefetchIfLow.mockImplementation(() => {
        // Mirror real prefetcher: e2e mode short-circuits before any work.
        return Promise.resolve();
      });

      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      // Screen still calls prefetchIfLow (it does not duplicate the e2e check);
      // the prefetcher module owns the no-op behavior.
      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(lastOverlayProps().visible).toBe(true);
    });

    it('T6: on a miss, prefetchIfLow is never called (no deck mutation)', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(false);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.1, y: 0.2 } });
      });

      expect(navigation.replace).toHaveBeenCalledWith('ResultScreen', expect.anything());
      expect(prefetchIfLow).not.toHaveBeenCalled();
    });

    it('T6b: categoryKey falls back to "all" when category is null', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute({ category: null })} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(prefetchIfLow).toHaveBeenCalledWith(expect.objectContaining({
        categoryKey: 'all',
        categoryId: undefined,
      }));
    });

    it('T7: prefetch rejection does not break the success flow (overlay still shows, setParams still fires onDone)', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);
      // Lazy: build the rejected promise only when the screen calls the mock,
      // so the call-site .catch(() => {}) attaches synchronously.
      prefetchIfLow.mockImplementation(() => Promise.reject(new Error('network down')));
      const nextParams = {
        listId: 4,
        imageFile: 'file:///next.jpg',
        pictureId: 'image-2',
        description: 'Next card',
        hiddenLocation: { x: 0.3, y: 0.7 },
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        isTutorial: false,
        skipInstructions: true,
      };
      resolveNextGuessParams.mockResolvedValue({ params: nextParams });

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      // Overlay still shown despite prefetch rejection (call-site .catch swallows).
      expect(prefetchIfLow).toHaveBeenCalledTimes(1);
      expect(lastOverlayProps().visible).toBe(true);

      const overlayProps = lastOverlayProps();
      await act(async () => {
        overlayProps.onDone();
      });

      // Flush the rejected promise's unhandled-rejection microtask.
      await act(async () => { await Promise.resolve(); });

      expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
      expect(navigateToNextGuess).not.toHaveBeenCalled();
    });

    it('T8: mount fires eager warm-all for real category', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      expect(warmAllDeckIfNeeded).toHaveBeenCalledTimes(1);
      expect(warmAllDeckIfNeeded).toHaveBeenCalledWith(expect.objectContaining({
        language: 'fr',
        scope: undefined,
        authContext: expect.objectContaining({ userId: '' }),
      }));
    });

    it('T9: mount does NOT fire warm-all for "all" category', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute({ category: { id: 'cat-all', key: 'all' } })} />);
      });

      expect(warmAllDeckIfNeeded).not.toHaveBeenCalled();
    });

    it('T10: handleOverlayDone waits for warm-all and retries when deck exhausted in real category', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      warmAllDeckIfNeeded.mockResolvedValue(undefined);

      const nextParams = {
        listId: 4,
        imageFile: 'file:///next.jpg',
        pictureId: 'image-2',
        description: 'Next card',
        hiddenLocation: { x: 0.3, y: 0.7 },
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
        isTutorial: false,
        skipInstructions: true,
      };
      resolveNextGuessParams
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ params: nextParams });

      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      const overlayProps = lastOverlayProps();
      await act(async () => {
        overlayProps.onDone();
      });

      // mount (1) + handleOverlayDone wait (1) = 2
      expect(warmAllDeckIfNeeded).toHaveBeenCalledTimes(2);
      expect(resolveNextGuessParams).toHaveBeenCalledTimes(2);
      expect(navigation.setParams).toHaveBeenCalledWith(nextParams);
      expect(navigateToNextGuess).not.toHaveBeenCalled();
    });

    it('T11: handleOverlayDone bounces when deck is truly empty after warm retry', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };
      warmAllDeckIfNeeded.mockResolvedValue(undefined);

      resolveNextGuessParams.mockResolvedValue(null);
      navigateToNextGuess.mockResolvedValue(undefined);

      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute()} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      const overlayProps = lastOverlayProps();
      await act(async () => {
        overlayProps.onDone();
      });

      expect(warmAllDeckIfNeeded).toHaveBeenCalledTimes(2);
      expect(resolveNextGuessParams).toHaveBeenCalledTimes(2);
      expect(navigateToNextGuess).toHaveBeenCalledTimes(1);
      expect(navigation.setParams).not.toHaveBeenCalled();
    });

    it('T12: handleOverlayDone does NOT warm when category is "all" (immediate bounce)', async () => {
      const navigation = { replace: jest.fn(), setParams: jest.fn(), popToTop: jest.fn() };

      resolveNextGuessParams.mockResolvedValue(null);
      navigateToNextGuess.mockResolvedValue(undefined);

      isOnTarget.mockReturnValue(true);
      applySuccessSideEffects.mockResolvedValue(undefined);

      await act(async () => {
        create(<GuessScreen navigation={navigation} route={baseRoute({ category: { id: 'cat-all', key: 'all' } })} />);
      });

      const pictureProps = lastPictureProps();
      await act(async () => {
        pictureProps.toAdScreen({ location: { x: 0.5, y: 0.5 } });
      });

      const overlayProps = lastOverlayProps();
      await act(async () => {
        overlayProps.onDone();
      });

      expect(warmAllDeckIfNeeded).not.toHaveBeenCalled();
      expect(resolveNextGuessParams).toHaveBeenCalledTimes(1);
      expect(navigateToNextGuess).toHaveBeenCalledTimes(1);
    });
  });
});
