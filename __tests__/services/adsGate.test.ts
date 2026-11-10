import { isAdsDisabledFlag } from '../../services/ads/adsGate';

describe('services/ads/adsGate', () => {
  it('env flag "true" disables ads (release/production semantics)', () => {
    expect(isAdsDisabledFlag('true')).toBe(true);
  });

  it('absent or non-"true" flag keeps ads enabled', () => {
    expect(isAdsDisabledFlag(undefined)).toBe(false);
    expect(isAdsDisabledFlag('')).toBe(false);
    expect(isAdsDisabledFlag('false')).toBe(false);
    expect(isAdsDisabledFlag('TRUE')).toBe(false);
  });
});
