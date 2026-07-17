import { setImageDimensions } from '../utils/imageDimensions';

describe('imageDimensions utilities', () => {
  it('keeps small portrait images at their intrinsic height while preserving aspect ratio', () => {
    expect(
      setImageDimensions({
        imageHeight: 400,
        imageWidth: 200,
        screenHeight: 800,
        screenWidth: 300,
        isPortrait: true,
      })
    ).toEqual({ maxImageHeight: 400, maxImageWidth: 200 });
  });

  it('scales large portrait images down to fit the screen width when needed', () => {
    expect(
      setImageDimensions({
        imageHeight: 1600,
        imageWidth: 900,
        screenHeight: 800,
        screenWidth: 400,
        isPortrait: true,
      })
    ).toEqual({
      maxImageHeight: expect.closeTo(711.1111111111),
      maxImageWidth: 400,
    });
  });

  it('keeps small landscape images bounded by the available height', () => {
    expect(
      setImageDimensions({
        imageHeight: 200,
        imageWidth: 500,
        screenHeight: 600,
        screenWidth: 300,
        isPortrait: false,
      })
    ).toEqual({ maxImageHeight: 200, maxImageWidth: 500 });
  });

  it('scales large landscape images to remain within the rotated viewport', () => {
    expect(
      setImageDimensions({
        imageHeight: 1200,
        imageWidth: 2000,
        screenHeight: 700,
        screenWidth: 400,
        isPortrait: false,
      })
    ).toEqual({ maxImageHeight: 240, maxImageWidth: 400 });
  });

  // Regression: portrait image whose width EQUALS screen width previously fell
  // through handlePortraitDimensions (both branches used strict < and >) and
  // returned undefined, crashing setImageDimensions at the destructure.
  it('handles portrait image width equal to screen width without crashing', () => {
    expect(
      setImageDimensions({
        imageHeight: 800,
        imageWidth: 400,
        screenHeight: 900,
        screenWidth: 400,
        isPortrait: true,
      })
    ).toEqual({ maxImageHeight: 800, maxImageWidth: 400 });
  });

  // Regression: landscape image whose height EQUALS screenWidth (and the
  // tall-but-narrow combo) previously fell through handleLandscapeDimensions
  // and returned undefined, crashing setImageDimensions.
  it('handles landscape image height equal to screenWidth without crashing', () => {
    expect(
      setImageDimensions({
        imageHeight: 500,
        imageWidth: 1000,
        screenHeight: 400,
        screenWidth: 500,
        isPortrait: false,
      })
    ).toEqual({ maxImageHeight: 200, maxImageWidth: 400 });
  });

  it('handles tall-but-narrow landscape (height>screenWidth, width<=screenHeight) without crashing', () => {
    expect(
      setImageDimensions({
        imageHeight: 600,
        imageWidth: 300,
        screenHeight: 400,
        screenWidth: 500,
        isPortrait: false,
      })
    ).toEqual({ maxImageHeight: 600, maxImageWidth: 300 });
  });
});