import type { ReactNode } from 'react';

/**
 * Minimal ad source. Used by AdScreen which awaits show() then routes on resolve.
 * Every implementation MUST be substitutable (LSP): same shape, same semantics.
 */
export interface AdSource {
  /** Sync readiness. Never throws, never returns a Promise. */
  isReady(): boolean;
  /**
   * Displays the ad surface. Resolves when the surface has been dismissed
   * (user closed, timeout fired, or surface failed silently). NEVER rejects —
   * failures resolve as no-op so the post-show route always runs.
   * Resolving IS the sole close signal.
   */
  show(): Promise<void>;
  /**
   * React node for the ad surface, or null when the surface is native
   * (rendered above the JS layer). The returned node's lifecycle is owned by
   * the caller; the source must not retain refs.
   */
  renderSurface(): ReactNode;
}

/**
 * Bridge-snapshot hook shape consumed by the AdMob source/bridge.
 * All members optional — the bridge may surface a partial subset.
 */
export interface HookSnapshot {
  isLoaded?: boolean;
  isOpened?: boolean;
  isClosed?: boolean;
  isShowing?: boolean;
  load?(): void;
  show?(): Promise<void> | void;
}

/**
 * Indirection handle so consumers read a live snapshot without re-binding.
 * Returns null when no snapshot is currently available.
 */
export interface HookSnapshotHandle {
  get(): HookSnapshot | null;
}

// Tag for introspection / dev tooling. Optional on impls.
export const AD_SOURCE_TAG = 'AdSource';
