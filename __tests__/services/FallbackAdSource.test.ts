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
});
