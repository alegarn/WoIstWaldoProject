import {
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
      topLeft: { x: 0, y: 0 },
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
    });
  });

  it('ignores touches outside of the rendered image bounds', () => {
    expect(
      handlePicturePress({
        event: { nativeEvent: { locationX: 110, locationY: 20 } },
        screenHeight: 600,
        screenWidth: 300,
        imageDimensionStyle: { width: 100, height: 50 },
        topLeft: { x: 0, y: 0 },
      })
    ).toEqual({ location: null, target: null });
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
});