jest.mock('react-native', () => ({
  Image: {
    resolveAssetSource: jest.fn(() => ({
      uri: 'file:///e2e-fixture.jpg',
      width: 320,
      height: 240,
    })),
  },
}));

import {
  buildE2EGuessCards,
  buildE2EHideRouteParams,
  buildE2EPictureSelection,
  getE2EAdDelayMs,
  isE2EMode,
} from '../utils/e2eMode';

describe('e2eMode helpers', () => {
  const originalE2EMode = process.env.EXPO_PUBLIC_E2E_MODE;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_MODE;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_E2E_MODE = originalE2EMode;
  });

  it('builds hide route params from the bundled fixture asset', () => {
    expect(buildE2EHideRouteParams({ screenWidth: 320, screenHeight: 640, isTutorial: false })).toEqual({
      uri: 'file:///e2e-fixture.jpg',
      imageWidth: 320,
      imageHeight: 240,
      screenHeight: 640,
      screenWidth: 320,
      isPortrait: false,
      isTutorial: false,
    });
  });

  it('builds a deterministic target selection from normalized coordinates', () => {
    expect(
      buildE2EPictureSelection({
        screenWidth: 320,
        screenHeight: 640,
        imageDimensionStyle: { width: 200, height: 100 },
        relativeLocation: { x: 0.5, y: 0.5 },
      })
    ).toEqual({
      location: { x: '0.50', y: '0.50' },
      target: {
        targetSize: 16,
        targetStyle: {
          position: 'absolute',
          width: 16,
          height: 16,
          left: 92,
          top: 42,
        },
      },
    });
  });

  it('returns a seeded guess card for deterministic swipe flows', () => {
    expect(buildE2EGuessCards()).toEqual([
      expect.objectContaining({
        imageFile: 'file:///e2e-fixture.jpg',
        pictureId: 'e2e-guess-card',
        listId: 1,
      }),
    ]);
  });

  it('switches ad delay to zero only when e2e mode is enabled', () => {
    expect(isE2EMode()).toBe(false);
    expect(getE2EAdDelayMs()).toBe(5000);

    process.env.EXPO_PUBLIC_E2E_MODE = 'true';

    expect(isE2EMode()).toBe(true);
    expect(getE2EAdDelayMs()).toBe(0);
  });
});