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

  it('keeps small landscape images bounded by the available width', () => {
    expect(
      setImageDimensions({
        imageHeight: 200,
        imageWidth: 500,
        screenHeight: 600,
        screenWidth: 300,
        isPortrait: false,
      })
    ).toEqual({ maxImageHeight: 120, maxImageWidth: 300 });
  });

  it('scales large landscape images to remain within the rotated viewport', () => {
    const result = setImageDimensions({
      imageHeight: 1000,
      imageWidth: 2000,
      screenHeight: 400,
      screenWidth: 800,
      isPortrait: false,
    });
    expect(result).toEqual({ maxImageHeight: 400, maxImageWidth: 800 });
    expect(result.maxImageWidth).toBeLessThanOrEqual(800);
    expect(result.maxImageHeight).toBeLessThanOrEqual(400);
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
    ).toEqual({ maxImageHeight: 250, maxImageWidth: 500 });
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

  // Bug fix: swapped landscape-axis comparisons previously produced boxes
  // wider/taller than the screen. The corrected math must always stay within
  // the screenWidth x screenHeight bounding box for realistic landscape dims.
  describe('corrected landscape math stays within screen bounds', () => {
    const cases = [
      {
        name: 'large landscape, image ratio matches screen ratio',
        input: { imageHeight: 1000, imageWidth: 2000, screenHeight: 400, screenWidth: 800 },
      },
      {
        name: 'large landscape, wider than screen on both axes',
        input: { imageHeight: 1200, imageWidth: 2400, screenHeight: 400, screenWidth: 800 },
      },
      {
        name: 'small landscape narrower than screen width',
        input: { imageHeight: 300, imageWidth: 400, screenHeight: 400, screenWidth: 800 },
      },
      {
        name: 'small landscape wider than screen width gets clamped',
        input: { imageHeight: 300, imageWidth: 1600, screenHeight: 400, screenWidth: 800 },
      },
    ];

    cases.forEach(({ name, input }) => {
      it(`${name}`, () => {
        const result = setImageDimensions({ ...input, isPortrait: false });
        expect(result.maxImageWidth).toBeLessThanOrEqual(input.screenWidth);
        expect(result.maxImageHeight).toBeLessThanOrEqual(input.screenHeight);
        expect(result.maxImageWidth).toBeGreaterThan(0);
        expect(result.maxImageHeight).toBeGreaterThan(0);
      });
    });
  });

  // Bug fix: transient missing/zero/non-finite imageHeight or imageWidth (e.g.
  // route params briefly incomplete after AdScreen -> GuessPicture merge) used
  // to leak NaN into RN <Image> which rendered at intrinsic source size ("zoomed").
  describe('setImageDimensions input guard', () => {
    const validScreen = { screenHeight: 600, screenWidth: 300 };

    it('returns screen-sized fallback when imageHeight is undefined', () => {
      expect(
        setImageDimensions({ imageHeight: undefined, imageWidth: 200, ...validScreen, isPortrait: true })
      ).toEqual({ maxImageWidth: 300, maxImageHeight: 600 });
    });

    it('returns screen-sized fallback when imageWidth is 0', () => {
      expect(
        setImageDimensions({ imageHeight: 400, imageWidth: 0, ...validScreen, isPortrait: true })
      ).toEqual({ maxImageWidth: 300, maxImageHeight: 600 });
    });

    it('returns screen-sized fallback when imageHeight is NaN', () => {
      expect(
        setImageDimensions({ imageHeight: NaN, imageWidth: 200, ...validScreen, isPortrait: false })
      ).toEqual({ maxImageWidth: 300, maxImageHeight: 600 });
    });

    it('returns screen-sized fallback when imageWidth is negative', () => {
      expect(
        setImageDimensions({ imageHeight: 400, imageWidth: -10, ...validScreen, isPortrait: false })
      ).toEqual({ maxImageWidth: 300, maxImageHeight: 600 });
    });

    it('returns {0,0} when both image and screen dims are bad', () => {
      expect(
        setImageDimensions({ imageHeight: undefined, imageWidth: 0, screenWidth: 0, screenHeight: NaN, isPortrait: true })
      ).toEqual({ maxImageWidth: 0, maxImageHeight: 0 });
    });

    it('returns {0,0} when only screen dims are bad', () => {
      expect(
        setImageDimensions({ imageHeight: 400, imageWidth: 200, screenWidth: 0, screenHeight: 600, isPortrait: true })
      ).toEqual({ maxImageWidth: 0, maxImageHeight: 0 });
    });
  });

  // Regression: handleLargeLandscapeDimensions grew width to fill height with
  // no fallback when that overflowed screenWidth. Portrait device showing a
  // wide landscape (screenWidth < screenHeight) previously returned
  // maxImageWidth larger than screenWidth. Now width-bound scaling applies.
  it('clamps wide landscape on portrait device to width-bound scaling', () => {
    expect(
      setImageDimensions({
        imageHeight: 1080,
        imageWidth: 1920,
        screenHeight: 800,
        screenWidth: 400,
        isPortrait: false,
      })
    ).toEqual({ maxImageWidth: 400, maxImageHeight: 225 });
  });

  describe('landscape cases on portrait devices (screenWidth < screenHeight) stay within bounds', () => {
    const cases = [
      { imageHeight: 1080, imageWidth: 1920, screenHeight: 800, screenWidth: 400 },
      { imageHeight: 1000, imageWidth: 2000, screenHeight: 800, screenWidth: 400 },
      { imageHeight: 2000, imageWidth: 4000, screenHeight: 600, screenWidth: 300 },
      { imageHeight: 800, imageWidth: 1600, screenHeight: 1000, screenWidth: 500 },
    ];

    cases.forEach((input) => {
      it(`bounds ${input.imageWidth}x${input.imageHeight} within ${input.screenWidth}x${input.screenHeight}`, () => {
        const result = setImageDimensions({ ...input, isPortrait: false });
        expect(result.maxImageWidth).toBeLessThanOrEqual(input.screenWidth);
        expect(result.maxImageHeight).toBeLessThanOrEqual(input.screenHeight);
        expect(result.maxImageWidth).toBeGreaterThan(0);
        expect(result.maxImageHeight).toBeGreaterThan(0);
      });
    });
  });
});
