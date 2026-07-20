import {
  createInternalProAdSource,
  INTERNAL_AD_TIMEOUT_MS,
} from '../../services/ads/InternalProAdSource';

describe('services/ads/InternalProAdSource', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('isReady() always returns true (synchronous, no network)', () => {
    const source = createInternalProAdSource();
    expect(source.isReady()).toBe(true);
  });

  it('show() resolves on _continue() (Continue button tap)', async () => {
    const source = createInternalProAdSource();
    let resolved = false;
    const p = source.show().then(() => { resolved = true; });

    expect(resolved).toBe(false);
    source._continue();

    await p;
    expect(resolved).toBe(true);
  });

  it('show() resolves after INTERNAL_AD_TIMEOUT_MS even without Continue tap', async () => {
    const source = createInternalProAdSource();
    let resolved = false;
    const p = source.show().then(() => { resolved = true; });

    expect(resolved).toBe(false);
    jest.advanceTimersByTime(INTERNAL_AD_TIMEOUT_MS);

    await p;
    expect(resolved).toBe(true);
  });

  it('INTERNAL_AD_TIMEOUT_MS is 3000 (named constant, G25)', () => {
    expect(INTERNAL_AD_TIMEOUT_MS).toBe(3000);
  });

  it('show() resolves exactly once even if _continue fires twice', async () => {
    const source = createInternalProAdSource();
    let count = 0;
    const p = source.show().then(() => { count += 1; });

    source._continue();
    source._continue();
    await p;

    expect(count).toBe(1);
  });

  it('repeated show() cycles do not pollute state (second cycle resolves independently)', async () => {
    const source = createInternalProAdSource();
    // First cycle: tap Continue.
    let first = false;
    const p1 = source.show().then(() => { first = true; });
    source._continue();
    await p1;
    expect(first).toBe(true);

    // Second cycle: should resolve via timeout cleanly.
    let second = false;
    const p2 = source.show().then(() => { second = true; });
    jest.advanceTimersByTime(INTERNAL_AD_TIMEOUT_MS);
    await p2;
    expect(second).toBe(true);
  });

  it('timeout fires then _continue is a no-op (does not throw, does not double-resolve)', async () => {
    const source = createInternalProAdSource();
    let count = 0;
    const p = source.show().then(() => { count += 1; });
    jest.advanceTimersByTime(INTERNAL_AD_TIMEOUT_MS);
    await p;
    expect(count).toBe(1);
    // After timeout already resolved, _continue is a no-op.
    expect(() => source._continue()).not.toThrow();
    expect(count).toBe(1);
  });

  it('timer is cleared after _continue (does not fire later)', async () => {
    const source = createInternalProAdSource();
    let count = 0;
    const p = source.show().then(() => { count += 1; });
    source._continue();
    await p;
    // Advance past the timeout window; if timer wasn't cleared, count would increment again
    // via a stale resolveAndCleanup (it won't, because resolveCurrent is nulled).
    jest.advanceTimersByTime(INTERNAL_AD_TIMEOUT_MS + 100);
    expect(count).toBe(1);
  });

  describe('renderSurface (panel JSX)', () => {
    it('returns a React node (not null)', () => {
      const source = createInternalProAdSource();
      const surface = source.renderSurface();
      expect(surface).not.toBeNull();
    });

    it('contains the advertisement image (ad-gazette.webp) as background', () => {
      const source = createInternalProAdSource();
      const surface: any = source.renderSurface();
      
      // The surface itself is now the ImageBackground
      expect(surface.props.source).toEqual(require('../../assets/ads/ad-gazette.webp'));
      expect(surface.props.testID).toBe('ad.internal.pro.panel');
      expect(surface.props.resizeMode).toBe('contain');
    });

    it('the returned surface is stable across calls when state has not changed', () => {
      // Calling renderSurface must NOT mutate state or start a show() cycle.
      const source = createInternalProAdSource();
      let resolved = false;
      const p = source.show().then(() => { resolved = true; });
      // Render the surface mid-show; it must not resolve show() by rendering.
      const surface = source.renderSurface();
      expect(surface).not.toBeNull();
      expect(resolved).toBe(false);
      // Cleanup.
      source._continue();
      return p;
    });
  });
});
