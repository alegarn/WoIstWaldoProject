const mockGameInstructions = jest.fn(() => null);
const mockShowPicture = jest.fn(() => null);

let capturedPanResponder;

jest.mock('react-native', () => ({
  PanResponder: {
    create: jest.fn((config) => {
      capturedPanResponder = config;
      return { panHandlers: { testID: 'mock-target-pan-handlers' } };
    }),
  },
}));

jest.mock('../components/Instructions/GameInstructions', () => {
  return function MockGameInstructions(props) {
    mockGameInstructions(props);
    return null;
  };
});

jest.mock('../components/Picture/ShowPicture', () => {
  return function MockShowPicture(props) {
    mockShowPicture(props);
    return null;
  };
});

jest.mock('../utils/orientation', () => ({
  handleImageOrientation: jest.fn(),
}));

jest.mock('../utils/imageDimensions', () => ({
  setImageDimensions: jest.fn(() => ({
    maxImageHeight: 100,
    maxImageWidth: 200,
  })),
}));

jest.mock('../utils/targetLocation', () => ({
  determineImageCorners: jest.fn(),
  handlePicturePress: jest.fn(),
  buildCenteredTarget: jest.fn(),
  buildSelectionFromPixels: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  buildE2EPictureSelection: jest.fn(),
  getE2EHideLocation: jest.fn(),
  getE2EIncorrectHideLocation: jest.fn(),
  isE2EMode: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import GuessPicture from '../components/Picture/GuessPicture';
import {
  buildCenteredTarget,
  buildSelectionFromPixels,
} from '../utils/targetLocation';
import {
  buildE2EPictureSelection,
  getE2EHideLocation,
  getE2EIncorrectHideLocation,
  isE2EMode,
} from '../utils/e2eMode';

describe('GuessPicture', () => {
  const baseProps = {
    imageFile: 'file:///guess.jpg',
    description: 'Find the hidden point',
    imageIsPortrait: false,
    imageHeight: 240,
    imageWidth: 320,
    hiddenLocation: { x: 0.58, y: 0.46 },
    screenDimensions: { width: 320, height: 640 },
    toAdScreen: jest.fn(),
  };

  const centeredSelection = {
    location: { x: '0.50', y: '0.50' },
    target: {
      targetSize: 16,
      targetStyle: { position: 'absolute', left: 92, top: 42 },
    },
  };

  const draggedSelection = {
    location: { x: '0.55', y: '0.50' },
    target: {
      targetSize: 16,
      targetStyle: { position: 'absolute', left: 102, top: 42 },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    isE2EMode.mockReturnValue(true);
    getE2EHideLocation.mockReturnValue({ x: 0.58, y: 0.46 });
    getE2EIncorrectHideLocation.mockReturnValue({ x: 0.18, y: 0.18 });
    buildE2EPictureSelection.mockReturnValue({
      location: { x: '0.18', y: '0.18' },
      target: {
        targetSize: 16,
        targetStyle: { position: 'absolute', left: 24, top: 24 },
      },
    });
    buildCenteredTarget.mockReturnValue(centeredSelection);
    buildSelectionFromPixels.mockReturnValue(draggedSelection);
    capturedPanResponder = undefined;
  });

  function getLatestShowPictureProps() {
    return mockShowPicture.mock.calls[mockShowPicture.mock.calls.length - 1][0];
  }

  async function renderToPicture(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(<GuessPicture {...baseProps} {...overrides} />);
    });

    await act(async () => {
      const instructionsProps = mockGameInstructions.mock.calls[mockGameInstructions.mock.calls.length - 1][0];
      instructionsProps.handleFilterClick();
    });

    return renderer;
  }

  it('in non-e2e mode, initializes the target at the picture center on mount', async () => {
    isE2EMode.mockReturnValue(false);

    await renderToPicture();

    expect(buildCenteredTarget).toHaveBeenCalledWith({
      screenWidth: 320,
      screenHeight: 640,
      imageDimensionStyle: { width: 200, height: 100 },
    });

    const pictureProps = getLatestShowPictureProps();
    expect(pictureProps.touchLocation).toEqual({ x: '0.50', y: '0.50' });
    expect(pictureProps.target).toEqual(centeredSelection.target);
    expect(pictureProps.targetPanHandlers).toEqual({ testID: 'mock-target-pan-handlers' });
  });

  it('in non-e2e mode, the target PanResponder claims the touch on the capture phase so the wrapped Pressable child cannot steal it', async () => {
    isE2EMode.mockReturnValue(false);

    await renderToPicture();

    expect(capturedPanResponder.onStartShouldSetPanResponderCapture()).toBe(true);
  });

  it('in non-e2e mode, moves the target when the drag handler updates the location', async () => {
    isE2EMode.mockReturnValue(false);

    await renderToPicture();

    await act(async () => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
      capturedPanResponder.onPanResponderMove(null, { dx: 10, dy: 0 });
    });

    expect(buildSelectionFromPixels).toHaveBeenCalledWith({
      locationX: 110,
      locationY: 50,
      screenWidth: 320,
      screenHeight: 640,
      imageDimensionStyle: { width: 200, height: 100 },
    });

    const pictureProps = getLatestShowPictureProps();
    expect(pictureProps.touchLocation).toEqual({ x: '0.55', y: '0.50' });
    expect(pictureProps.target).toEqual(draggedSelection.target);
  });

  it('in non-e2e mode, ships the dragged location to toAdScreen on confirm', async () => {
    isE2EMode.mockReturnValue(false);
    const toAdScreen = jest.fn();

    await renderToPicture({ toAdScreen });

    await act(async () => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
      capturedPanResponder.onPanResponderMove(null, { dx: 10, dy: 0 });
    });

    await act(async () => {
      getLatestShowPictureProps().handleConfirm();
    });

    expect(toAdScreen).toHaveBeenCalledWith({
      location: { x: '0.55', y: '0.50' },
      hiddenLocation: { x: 0.58, y: 0.46 },
      screenWidth: 320,
      screenHeight: 640,
      target: draggedSelection.target,
    });
  });

  it('in non-e2e mode, opens the confirm modal when the target is tapped without dragging', async () => {
    isE2EMode.mockReturnValue(false);

    await renderToPicture();

    expect(getLatestShowPictureProps().showModal).toBe(false);

    await act(async () => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
      capturedPanResponder.onPanResponderRelease(null, { dx: 2, dy: 2 });
    });

    expect(getLatestShowPictureProps().showModal).toBe(true);
  });

  it('in non-e2e mode, does not open the modal when the target is dragged past the tap threshold', async () => {
    isE2EMode.mockReturnValue(false);

    await renderToPicture();

    await act(async () => {
      capturedPanResponder.onPanResponderGrant(null, { dx: 0, dy: 0 });
      capturedPanResponder.onPanResponderMove(null, { dx: 30, dy: 0 });
      capturedPanResponder.onPanResponderRelease(null, { dx: 30, dy: 0 });
    });

    expect(getLatestShowPictureProps().showModal).toBe(false);
  });

  it('in non-e2e mode, does not move the target when the picture surface is tapped', async () => {
    isE2EMode.mockReturnValue(false);

    await renderToPicture();

    const before = getLatestShowPictureProps();

    await act(async () => {
      getLatestShowPictureProps().handlePress({ nativeEvent: { locationX: 10, locationY: 10 } });
    });

    expect(buildE2EPictureSelection).not.toHaveBeenCalled();

    const after = getLatestShowPictureProps();
    expect(after.touchLocation).toEqual(before.touchLocation);
    expect(after.target).toEqual(before.target);
    expect(after.touchLocation).toEqual({ x: '0.50', y: '0.50' });
  });

  it('in e2e mode, initializes target as null, attaches no panHandlers, and leaves the surface tap to reach handlePress', async () => {
    await renderToPicture();

    expect(buildCenteredTarget).not.toHaveBeenCalled();

    const pictureProps = getLatestShowPictureProps();
    expect(pictureProps.touchLocation).toBeNull();
    expect(pictureProps.target).toBeNull();
    expect(pictureProps.targetPanHandlers).toBeUndefined();

    await act(async () => {
      getLatestShowPictureProps().handlePress();
    });

    expect(buildE2EPictureSelection).toHaveBeenCalledWith({
      screenWidth: 320,
      screenHeight: 640,
      imageDimensionStyle: { width: 200, height: 100 },
      relativeLocation: { x: 0.58, y: 0.46 },
    });
  });

  it('passes defaultOpen={false} to ShowPicture on a first-card route (skipInstructions falsy)', async () => {
    await renderToPicture();
    expect(getLatestShowPictureProps().defaultOpen).toBe(false);
  });

  it('passes defaultOpen={true} to ShowPicture on a second-card route (skipInstructions=true)', async () => {
    await act(async () => {
      create(<GuessPicture {...baseProps} skipInstructions={true} />);
    });

    expect(getLatestShowPictureProps().defaultOpen).toBe(true);
  });

  it('uses a deterministic incorrect location on long press in e2e mode', async () => {
    const toAdScreen = jest.fn();

    await act(async () => {
      create(
        <GuessPicture
          {...baseProps}
          toAdScreen={toAdScreen}
        />
      );
    });

    await act(async () => {
      const instructionsProps = mockGameInstructions.mock.calls[mockGameInstructions.mock.calls.length - 1][0];
      instructionsProps.handleFilterClick();
    });

    await act(async () => {
      getLatestShowPictureProps().handleLongPress();
    });

    expect(buildE2EPictureSelection).toHaveBeenCalledWith({
      screenWidth: 320,
      screenHeight: 640,
      imageDimensionStyle: { width: 200, height: 100 },
      relativeLocation: { x: 0.18, y: 0.18 },
    });

    await act(async () => {
      getLatestShowPictureProps().handleConfirm();
    });

    expect(getLatestShowPictureProps().showModal).toBe(false);

    expect(toAdScreen).toHaveBeenCalledWith({
      location: { x: '0.18', y: '0.18' },
      hiddenLocation: { x: 0.58, y: 0.46 },
      screenWidth: 320,
      screenHeight: 640,
      target: {
        targetSize: 16,
        targetStyle: { position: 'absolute', left: 24, top: 24 },
      },
    });
  });
});
