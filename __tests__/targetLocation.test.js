import {
  buildCenteredTarget,
  buildSelectionFromPixels,
  determineImageCorners,
  handlePicturePress,
  isOnTarget,
} from '../utils/targetLocation';

describe('targetLocation utilities', () => {
  it('computes the image top-left corner from centered dimensions', () => {
    expect(
      determineImageCorners({
        maxImageHeight: 300,
        maxImageWidth: 200,
        screenWidth: 400,
        screenHeight: 800,
      })
    ).toEqual({
      topLeft: {
        x: 100,
        y: 250,
      },
    });
  });

  it('normalizes touch coordinates and target styles when the user presses inside the image', () => {
    const response = handlePicturePress({
      event: { nativeEvent: { locationX: 50, locationY: 25 } },
      screenHeight: 600,
      screenWidth: 300,
      imageDimensionStyle: { width: 100, height: 50 },
    });

    expect(response.location).toEqual({ x: '0.50', y: '0.50' });
    expect(response.target).toEqual({
      targetSize: 15,
      targetStyle: {
        position: 'absolute',
        width: 15,
        height: 15,
        left: 42.5,
        top: 17.5,
      },
      dragSize: 30,
      dragStyle: {
        position: 'absolute',
        width: 30,
        height: 30,
        left: 35,
        top: 10,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
      },
    });
  });

  it('ignores touches outside of the rendered image bounds', () => {
    expect(
      handlePicturePress({
        event: { nativeEvent: { locationX: 110, locationY: 20 } },
        screenHeight: 600,
        screenWidth: 300,
        imageDimensionStyle: { width: 100, height: 50 },
      })
    ).toEqual({ location: null, target: null });
  });

  it('builds a selection from pixel coordinates using the same shape as a press', () => {
    expect(
      buildSelectionFromPixels({
        locationX: 50,
        locationY: 25,
        screenWidth: 300,
        screenHeight: 600,
        imageDimensionStyle: { width: 100, height: 50 },
      })
    ).toEqual({
      location: { x: '0.50', y: '0.50' },
      target: {
        targetSize: 15,
        targetStyle: {
          position: 'absolute',
          width: 15,
          height: 15,
          left: 42.5,
          top: 17.5,
        },
        dragSize: 30,
        dragStyle: {
          position: 'absolute',
          width: 30,
          height: 30,
          left: 35,
          top: 10,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
    });
  });

  it('builds a centered target at the picture middle', () => {
    expect(
      buildCenteredTarget({
        screenWidth: 300,
        screenHeight: 600,
        imageDimensionStyle: { width: 200, height: 100 },
      })
    ).toEqual({
      location: { x: '0.50', y: '0.50' },
      target: {
        targetSize: 15,
        targetStyle: {
          position: 'absolute',
          width: 15,
          height: 15,
          left: 92.5,
          top: 42.5,
        },
        dragSize: 30,
        dragStyle: {
          position: 'absolute',
          width: 30,
          height: 30,
          left: 85,
          top: 35,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
    });
  });

  it('checks whether a guess falls within the target threshold', () => {
    expect(
      isOnTarget({
        location: { x: 0.5, y: 0.5 },
        hiddenLocation: { x: 0.52, y: 0.5 },
        screenWidth: 300,
        screenHeight: 600,
      })
    ).toBe(true);

    expect(
      isOnTarget({
        location: { x: 0.1, y: 0.1 },
        hiddenLocation: { x: 0.8, y: 0.8 },
        screenWidth: 300,
        screenHeight: 600,
      })
    ).toBe(false);
  });

  it('characterizes buildSelectionFromPixels -> isOnTarget pipeline with string locations (toFixed(2))', () => {
    const screenWidth = 300;
    const screenHeight = 600;
    const imageDimensionStyle = { width: 100, height: 50 };

    const hiddenSelection = buildSelectionFromPixels({
      locationX: 50,
      locationY: 25,
      screenWidth,
      screenHeight,
      imageDimensionStyle,
    });

    expect(
      isOnTarget({
        location: hiddenSelection.location,
        hiddenLocation: hiddenSelection.location,
        screenWidth,
        screenHeight,
      })
    ).toBe(true);

    const farGuess = buildSelectionFromPixels({
      locationX: 10,
      locationY: 5,
      screenWidth,
      screenHeight,
      imageDimensionStyle,
    });

    expect(
      isOnTarget({
        location: farGuess.location,
        hiddenLocation: hiddenSelection.location,
        screenWidth,
        screenHeight,
      })
    ).toBe(false);
  });
});