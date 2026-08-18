// Behavior tests for hooks/useAdCadence.
//
// These tests exist specifically to lock in the platform-gate removal: before
// the fix, `isSourceReady` was `IS_ANDROID && adSource.isReady()`, which made
// iOS always false and suppressed every free-tier ad. We mock consumeAdSlot to
// capture the `isSourceReady` argument and assert it follows `adSource.isReady()`
// on every platform. The default jest Platform.OS is 'ios' (jest.setup.js sets
// EXPO_OS='ios'), so the iOS case is the regression guard.

import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useAdCadence } from '../hooks/useAdCadence';
import type { AdSource } from '../services/ads/AdSource';
import type { ConsumeAdSlotResult } from '../utils/adCadence';

const mockConsumeAdSlot = jest.fn((): ConsumeAdSlotResult => ({ showAd: false, nextCount: 0 }));
const mockShouldSuppressAds = jest.fn(() => false);
const mockIsE2EMode = jest.fn(() => false);

jest.mock('../utils/adCadence', () => ({
  __esModule: true,
  consumeAdSlot: (...args: unknown[]) => mockConsumeAdSlot(...(args as [unknown])),
}));

jest.mock('../services/billing/adPolicy', () => ({
  __esModule: true,
  shouldSuppressAds: (...args: unknown[]) => mockShouldSuppressAds(...(args as [unknown])),
}));

jest.mock('../utils/e2eMode', () => ({
  __esModule: true,
  isE2EMode: (...args: unknown[]) => mockIsE2EMode(...(args as [])),
}));

function makeSource(isReady: boolean): AdSource {
  return {
    isReady: () => isReady,
    show: jest.fn().mockResolvedValue(undefined),
    renderSurface: () => null,
  };
}

function lastConsumeCallArg(): Record<string, unknown> {
  const calls = mockConsumeAdSlot.mock.calls;
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

describe('useAdCadence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsumeAdSlot.mockReturnValue({ showAd: false, nextCount: 0 });
    mockShouldSuppressAds.mockReturnValue(false);
    mockIsE2EMode.mockReturnValue(false);
  });

  it('iOS, free tier: passes isSourceReady === true to consumeAdSlot (regression: was false under the old IS_ANDROID gate)', () => {
    // Default jest Platform.OS is 'ios' — assert explicitly to document intent.
    expect(Platform.OS).toBe('ios');

    const { result } = renderHook(() =>
      useAdCadence({
        scope: { kind: 'public' },
        authContext: { paidTier: 0 },
        adSource: makeSource(true),
      }),
    );

    result.current.consumeAdSlot();

    expect(mockConsumeAdSlot).toHaveBeenCalledTimes(1);
    expect(lastConsumeCallArg().isSourceReady).toBe(true);
  });

  it('Android, free tier: passes isSourceReady === true to consumeAdSlot', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      const { result } = renderHook(() =>
        useAdCadence({
          scope: { kind: 'public' },
          authContext: { paidTier: 0 },
          adSource: makeSource(true),
        }),
      );

      result.current.consumeAdSlot();

      expect(mockConsumeAdSlot).toHaveBeenCalledTimes(1);
      expect(lastConsumeCallArg().isSourceReady).toBe(true);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });

  it('paid tier (shouldSuppressAds → isAdFree): forwards isAdFree === true to consumeAdSlot (paid suppression unchanged)', () => {
    mockShouldSuppressAds.mockReturnValue(true);

    const { result } = renderHook(() =>
      useAdCadence({
        scope: { kind: 'public' },
        authContext: { paidTier: 1 },
        adSource: makeSource(true),
      }),
    );

    result.current.consumeAdSlot();

    expect(mockConsumeAdSlot).toHaveBeenCalledTimes(1);
    expect(lastConsumeCallArg().isAdFree).toBe(true);
  });

  it('isSourceReady tracks adSource.isReady() (false when the source reports not ready)', () => {
    const { result } = renderHook(() =>
      useAdCadence({
        scope: { kind: 'public' },
        authContext: { paidTier: 0 },
        adSource: makeSource(false),
      }),
    );

    result.current.consumeAdSlot();

    expect(lastConsumeCallArg().isSourceReady).toBe(false);
  });
});
