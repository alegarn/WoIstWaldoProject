import type { ReactNode } from 'react';
import { createFallbackAdSource } from '../../services/ads/FallbackAdSource';
import type { AdSource } from '../../services/ads/AdSource';

interface FakeSourceOptions {
  ready: boolean;
  showImpl?: () => Promise<void>;
}

function makeFakeSource({ ready, showImpl }: FakeSourceOptions): AdSource {
  return {
    isReady: () => ready,
    show: showImpl || jest.fn().mockResolvedValue(undefined),
    renderSurface: () => null,
  };
}

describe('services/ads/FallbackAdSource', () => {
  it('throws if primary is missing', () => {
    expect(() => createFallbackAdSource(null as unknown as AdSource, makeFakeSource({ ready: true })))
      .toThrow(/primary/);
  });

  it('throws if secondary is missing', () => {
    expect(() => createFallbackAdSource(makeFakeSource({ ready: true }), null as unknown as AdSource))
      .toThrow(/secondary/);
  });

  it('isReady() true when primary is ready (regardless of secondary)', () => {
    const primary = makeFakeSource({ ready: true });
    const secondary = makeFakeSource({ ready: false });
    expect(createFallbackAdSource(primary, secondary).isReady()).toBe(true);
  });

  it('isReady() true when only secondary is ready', () => {
    const primary = makeFakeSource({ ready: false });
    const secondary = makeFakeSource({ ready: true });
    expect(createFallbackAdSource(primary, secondary).isReady()).toBe(true);
  });

  it('isReady() false when neither is ready', () => {
    const primary = makeFakeSource({ ready: false });
    const secondary = makeFakeSource({ ready: false });
    expect(createFallbackAdSource(primary, secondary).isReady()).toBe(false);
  });

  it('show() delegates to primary when primary is ready', async () => {
    const primary = makeFakeSource({ ready: true, showImpl: jest.fn().mockResolvedValue(undefined) });
    const secondary = makeFakeSource({ ready: true, showImpl: jest.fn().mockResolvedValue(undefined) });
    const composite = createFallbackAdSource(primary, secondary);
    await composite.show();
    expect(primary.show).toHaveBeenCalled();
    expect(secondary.show).not.toHaveBeenCalled();
  });

  it('show() delegates to secondary when primary is NOT ready', async () => {
    const primary = makeFakeSource({ ready: false, showImpl: jest.fn() });
    const secondary = makeFakeSource({ ready: true, showImpl: jest.fn().mockResolvedValue(undefined) });
    const composite = createFallbackAdSource(primary, secondary);
    await composite.show();
    expect(primary.show).not.toHaveBeenCalled();
    expect(secondary.show).toHaveBeenCalled();
  });

  it('show() delegates to secondary even when NEITHER source is ready (secondary.show is called)', async () => {
    const primary = makeFakeSource({ ready: false, showImpl: jest.fn() });
    const secondary = makeFakeSource({ ready: false, showImpl: jest.fn().mockResolvedValue(undefined) });
    const composite = createFallbackAdSource(primary, secondary);
    await composite.show();
    expect(primary.show).not.toHaveBeenCalled();
    expect(secondary.show).toHaveBeenCalled();
  });

  it('show() swallows async errors from the picked source (contract: never rejects)', async () => {
    const primary = makeFakeSource({
      ready: true,
      showImpl: jest.fn().mockRejectedValue(new Error('primary boom')),
    });
    const secondary = makeFakeSource({ ready: true, showImpl: jest.fn() });
    const composite = createFallbackAdSource(primary, secondary);
    await expect(composite.show()).resolves.toBeUndefined();
  });

  describe('renderSurface delegation (LSP fix)', () => {
    it('returns null when primary is ready and primary.renderSurface() is null', () => {
      const primary: AdSource = { isReady: () => true, show: jest.fn(), renderSurface: () => null };
      const secondary: AdSource = { isReady: () => false, show: jest.fn(), renderSurface: () => 'secondary-surface' };
      expect(createFallbackAdSource(primary, secondary).renderSurface()).toBeNull();
    });

    it('delegates to secondary.renderSurface() when primary is NOT ready', () => {
      const secondarySurface = { __test: 'secondary-surface-node' } as unknown as ReactNode;
      const primary: AdSource = { isReady: () => false, show: jest.fn(), renderSurface: () => null };
      const secondary: AdSource = { isReady: () => true, show: jest.fn(), renderSurface: () => secondarySurface };
      expect(createFallbackAdSource(primary, secondary).renderSurface()).toBe(secondarySurface);
    });

    it('makeFakeSource helper must now include renderSurface (existing tests)', () => {
      // Sanity: the existing makeFakeSource helper produces objects that satisfy the
      // updated contract. Add renderSurface: () => null to makeFakeSource.
      const source = makeFakeSource({ ready: true });
      expect(typeof source.renderSurface).toBe('function');
      expect(source.renderSurface()).toBeNull();
    });
  });

  describe('dispose forwarding', () => {
    it('forwards dispose() to BOTH wrapped sources', () => {
      const primary = makeFakeSource({ ready: true });
      const secondary = makeFakeSource({ ready: false });
      (primary as any).dispose = jest.fn();
      (secondary as any).dispose = jest.fn();
      const composite = createFallbackAdSource(primary, secondary);

      composite.dispose?.();

      expect((primary as any).dispose).toHaveBeenCalledTimes(1);
      expect((secondary as any).dispose).toHaveBeenCalledTimes(1);
    });

    it('is a safe no-op when neither wrapped source implements dispose()', () => {
      const composite = createFallbackAdSource(
        makeFakeSource({ ready: true }),
        makeFakeSource({ ready: false }),
      );
      expect(() => composite.dispose?.()).not.toThrow();
    });
  });

  describe('sticky pick per show cycle (double-pick race fix)', () => {
    function makeFlippingSources() {
      const primary: AdSource = {
        isReady: jest.fn(() => false),
        show: jest.fn().mockResolvedValue(undefined),
        renderSurface: jest.fn(() => 'primary-surface' as unknown as ReactNode),
      };
      const secondary: AdSource = {
        isReady: jest.fn(() => true),
        show: jest.fn().mockResolvedValue(undefined),
        renderSurface: jest.fn(() => 'secondary-surface' as unknown as ReactNode),
      };
      return { primary, secondary };
    }

    it('renderSurface() and show() use the SAME source when primary.isReady() flips between the two calls', async () => {
      const { primary, secondary } = makeFlippingSources();
      const composite = createFallbackAdSource(primary, secondary);

      // Render first: primary not ready → secondary surface.
      expect(composite.renderSurface()).toBe('secondary-surface');
      expect(secondary.renderSurface).toHaveBeenCalledTimes(1);
      expect(primary.renderSurface).not.toHaveBeenCalled();

      // isReady() flips BEFORE show(): primary becomes ready.
      (primary.isReady as jest.Mock).mockReturnValue(true);
      await composite.show();

      // Sticky: show() must use secondary (the decided source), not re-pick primary.
      expect(secondary.show).toHaveBeenCalledTimes(1);
      expect(primary.show).not.toHaveBeenCalled();
    });

    it('show() decision is sticky too: a flip AFTER show() started does not change renderSurface()', async () => {
      const { primary, secondary } = makeFlippingSources();
      const composite = createFallbackAdSource(primary, secondary);

      // Primary ready at show() time → primary picked.
      (primary.isReady as jest.Mock).mockReturnValue(true);
      const pending = composite.show();
      expect(primary.show).toHaveBeenCalledTimes(1);
      expect(secondary.show).not.toHaveBeenCalled();

      // Flip mid-cycle (before show resolves): re-render must NOT swap surfaces.
      (primary.isReady as jest.Mock).mockReturnValue(false);
      expect(composite.renderSurface()).toBe('primary-surface');
      expect(secondary.renderSurface).not.toHaveBeenCalled();

      await pending;
    });

    it('active pick resets after the cycle completes (next cycle re-decides)', async () => {
      const { primary, secondary } = makeFlippingSources();
      const composite = createFallbackAdSource(primary, secondary);

      // Cycle 1: render decided secondary; show() honored it, then reset.
      expect(composite.renderSurface()).toBe('secondary-surface');
      await composite.show();
      expect(secondary.show).toHaveBeenCalledTimes(1);

      // Cycle 2: primary now ready → fresh decision picks primary.
      (primary.isReady as jest.Mock).mockReturnValue(true);
      expect(composite.renderSurface()).toBe('primary-surface');
      await composite.show();
      expect(primary.show).toHaveBeenCalledTimes(1);
      expect(secondary.show).toHaveBeenCalledTimes(1);
    });

    it('active pick resets even when show() of the picked source rejects', async () => {
      const primary: AdSource = {
        isReady: () => true,
        show: jest.fn().mockRejectedValue(new Error('primary boom')),
        renderSurface: jest.fn(() => 'primary-surface' as unknown as ReactNode),
      };
      const secondary: AdSource = {
        isReady: () => true,
        show: jest.fn().mockResolvedValue(undefined),
        renderSurface: () => 'secondary-surface' as unknown as ReactNode,
      };
      const composite = createFallbackAdSource(primary, secondary);

      expect(composite.renderSurface()).toBe('primary-surface');
      await expect(composite.show()).resolves.toBeUndefined();
      expect(primary.show).toHaveBeenCalledTimes(1);
      expect(secondary.show).not.toHaveBeenCalled();

      // Reset happened despite the rejection: next render picks again.
      expect(composite.renderSurface()).toBe('primary-surface');
      expect(primary.renderSurface).toHaveBeenCalledTimes(2);
    });

    it('dispose() clears the sticky pick so the next cycle re-decides', () => {
      const { primary, secondary } = makeFlippingSources();
      const composite = createFallbackAdSource(primary, secondary);

      // Cycle decided secondary (primary not ready at render time).
      expect(composite.renderSurface()).toBe('secondary-surface');

      // Unmount-before-show: dispose clears the stale pick.
      composite.dispose?.();

      // Primary became ready while disposed; the next render must re-pick primary
      // (a stale active would have replayed the now-unloaded secondary).
      (primary.isReady as jest.Mock).mockReturnValue(true);
      expect(composite.renderSurface()).toBe('primary-surface');
      expect(secondary.renderSurface).toHaveBeenCalledTimes(1);
    });
  });
});
