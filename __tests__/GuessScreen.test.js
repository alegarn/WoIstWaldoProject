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

import React from 'react';
import { Dimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import GuessScreen from '../screens/GuessScreens/GuessScreen';
import { isOnTarget } from '../utils/targetLocation';
import { applySuccessSideEffects, resolveNextGuessParams } from '../utils/handleGuessOutcome';
import { navigateToNextGuess } from '../utils/guessNavigation';

function lastPictureProps() {
  return mockGuessPicture.mock.calls[mockGuessPicture.mock.calls.length - 1][0];
}

function lastOverlayProps() {
  return mockSuccessOverlay.mock.calls[mockSuccessOverlay.mock.calls.length - 1][0];
}

function lastMenuProps() {
  return mockGuessExitSwipeMenu.mock.calls[mockGuessExitSwipeMenu.mock.calls.length - 1][0];
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
});
