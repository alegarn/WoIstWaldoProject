import * as ScreenOrientation from 'expo-screen-orientation';
import { handleImageOrientation } from '../utils/orientation';

jest.mock('expo-screen-orientation', () => ({
  getOrientationLockAsync: jest.fn(),
  lockAsync: jest.fn(),
  OrientationLock: {
    DEFAULT: 0,
    ALL: 1,
    PORTRAIT: 2,
    PORTRAIT_UP: 3,
    PORTRAIT_DOWN: 4,
    LANDSCAPE: 5,
    LANDSCAPE_LEFT: 6,
    LANDSCAPE_RIGHT: 7,
    OTHER: 8,
    UNKNOWN: 9,
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleImageOrientation', () => {
  it('skips lockAsync when current lock already matches desired portrait lock', async () => {
    ScreenOrientation.getOrientationLockAsync.mockResolvedValue(
      ScreenOrientation.OrientationLock.PORTRAIT_UP
    );

    await handleImageOrientation({ imageIsPortrait: true });

    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
  });

  it('locks PORTRAIT_UP for portrait image when current lock is landscape', async () => {
    ScreenOrientation.getOrientationLockAsync.mockResolvedValue(
      ScreenOrientation.OrientationLock.LANDSCAPE_LEFT
    );

    await handleImageOrientation({ imageIsPortrait: true });

    expect(ScreenOrientation.lockAsync).toHaveBeenCalledTimes(1);
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
      ScreenOrientation.OrientationLock.PORTRAIT_UP
    );
  });

  it('locks LANDSCAPE_LEFT for landscape image when current lock is portrait', async () => {
    ScreenOrientation.getOrientationLockAsync.mockResolvedValue(
      ScreenOrientation.OrientationLock.PORTRAIT_UP
    );

    await handleImageOrientation({ imageIsPortrait: false });

    expect(ScreenOrientation.lockAsync).toHaveBeenCalledTimes(1);
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
      ScreenOrientation.OrientationLock.LANDSCAPE_LEFT
    );
  });

  it('locks LANDSCAPE_LEFT exactly once for landscape image when current lock is UNKNOWN', async () => {
    ScreenOrientation.getOrientationLockAsync.mockResolvedValue(
      ScreenOrientation.OrientationLock.UNKNOWN
    );

    await handleImageOrientation({ imageIsPortrait: false });

    expect(ScreenOrientation.lockAsync).toHaveBeenCalledTimes(1);
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
      ScreenOrientation.OrientationLock.LANDSCAPE_LEFT
    );
  });
});
