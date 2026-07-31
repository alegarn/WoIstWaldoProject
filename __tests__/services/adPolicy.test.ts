import { shouldSuppressAds } from '../../services/billing/adPolicy';

describe('services/billing/adPolicy', () => {
  it('returns false for public tier 0', () => {
    expect(shouldSuppressAds({ paidTier: 0, scope: 'public' })).toBe(false);
  });

  it('returns true for public tier 1', () => {
    expect(shouldSuppressAds({ paidTier: 1, scope: 'public' })).toBe(true);
  });

  it('returns false for public tier 2', () => {
    expect(shouldSuppressAds({ paidTier: 2, scope: 'public' })).toBe(false);
  });

  it('returns true for public tier 3', () => {
    expect(shouldSuppressAds({ paidTier: 3, scope: 'public' })).toBe(true);
  });

  it('returns false for private tier 0', () => {
    expect(shouldSuppressAds({ paidTier: 0, scope: 'private' })).toBe(false);
  });

  it('returns true for private tier 1', () => {
    expect(shouldSuppressAds({ paidTier: 1, scope: 'private' })).toBe(true);
  });

  it('returns true for private tier 3', () => {
    expect(shouldSuppressAds({ paidTier: 3, scope: 'private' })).toBe(true);
  });

  it('returns false for private tier 2 when the active group is not owned by the viewer', () => {
    expect(
      shouldSuppressAds({
        paidTier: 2,
        scope: 'private',
        activeGroup: { isOwnedByViewer: false, memberCount: 10 },
      })
    ).toBe(false);
  });

  it('returns false for private tier 2 when the owned active group has 5 members', () => {
    expect(
      shouldSuppressAds({
        paidTier: 2,
        scope: 'private',
        activeGroup: { isOwnedByViewer: true, memberCount: 5 },
      })
    ).toBe(false);
  });

  it('returns true for private tier 2 when the owned active group has more than 5 members', () => {
    expect(
      shouldSuppressAds({
        paidTier: 2,
        scope: 'private',
        activeGroup: { isOwnedByViewer: true, memberCount: 6 },
      })
    ).toBe(true);
  });
});
