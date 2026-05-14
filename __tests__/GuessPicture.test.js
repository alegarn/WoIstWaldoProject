const mockGameInstructions = jest.fn(() => null);
const mockShowPicture = jest.fn(() => null);

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
  });

  function getLatestShowPictureProps() {
    return mockShowPicture.mock.calls[mockShowPicture.mock.calls.length - 1][0];
  }

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