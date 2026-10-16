// ModeCue RED suite (shape-mode-cue-plan Task 2a).
//
// Pins the Mode Cue wiring contract: an a11y-labeled (`game.picture.modeCueLabel`)
// `pointerEvents="none"` container; a deterministic, centered 7-segment closed
// loop built with `traceSegmentStyle` strokes; segments revealed ~30ms apart
// (all 7 by ≈210ms); the whole cue faded to opacity 0 by ≈360ms; renders null
// afterwards; every animation on the JS driver (`useNativeDriver: false`);
// clean stop/reset when unmounted mid-flash.
//
// Timing harness is pinned to the repo's only real-Animated precedent
// (__tests__/GuessScreen.test.tsx:319-335): manual `Date.now` mock + stepped
// manual clock — TimingAnimation eases on Date.now(), which jest fake timers
// do NOT fake — plus a 16ms rAF shim. This suite's own advance step is 16ms
// (exactly one rAF frame); GuessScreen's 50ms step is too coarse to
// discriminate the ~30ms stagger.

import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { act, render, screen } from '@testing-library/react-native';

import ModeCue from '../components/Picture/ModeCue';
import { GlobalStyle } from '../constants/theme';
import i18n from '../i18n';

type CueProps = { imageDimensionStyle: { width: number; height: number } };

const Cue = ModeCue as unknown as React.FC<CueProps>;

const IMAGE_DIMS = { width: 320, height: 240 };
const MIN_DIM = Math.min(IMAGE_DIMS.width, IMAGE_DIMS.height);
const SEGMENT_COUNT = 7;
const LABEL = i18n.t('game.picture.modeCueLabel');

// --- timing harness ----------------------------------------------------------

let mockClockMs = 0;

function useFakeAnimationTimers() {
  jest.useFakeTimers();
  mockClockMs = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => mockClockMs);
  // RN's jest setup maps requestAnimationFrame to setTimeout(cb, 0); the 16ms
  // frame bounds every timer chain so JS-driven animations progress per frame.
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: (time: number) => void) =>
    setTimeout(() => cb(jest.now()), 16),
  );
}

const advance = async (ms: number) => {
  let elapsed = 0;
  while (elapsed < ms) {
    const step = Math.min(16, ms - elapsed);
    mockClockMs += step;
    await act(async () => {
      jest.advanceTimersByTime(step);
      await Promise.resolve();
    });
    elapsed += step;
  }
};

// --- helpers -----------------------------------------------------------------

type Style = Record<string, any>;

function renderCue() {
  return render(<Cue imageDimensionStyle={IMAGE_DIMS} />);
}

function styleOf(node: ReactTestInstance): Style {
  return StyleSheet.flatten(node.props.style ?? []) ?? {};
}

function readValue(value: Animated.Value): number {
  return (value as unknown as { __getValue(): number }).__getValue();
}

function findLabeledNode(): ReactTestInstance | null {
  const matches = screen.UNSAFE_root.findAll(
    (node) => node.props.accessibilityLabel === LABEL,
  );
  return matches[0] ?? null;
}

// Host nodes only: composite Animated nodes duplicate every match.
function findBars(): ReactTestInstance[] {
  return screen.UNSAFE_root.findAll(
    (node) => typeof node.type === 'string' && matchesBarStyle(styleOf(node)),
  );
}

// `traceSegmentStyle` stroke contract at the cue's ~4px weight.
function matchesBarStyle(style: Style): boolean {
  const stroke = style.height;
  return (
    typeof stroke === 'number' &&
    stroke >= 3.5 &&
    stroke <= 4.5 &&
    style.borderRadius === stroke / 2 &&
    style.backgroundColor === GlobalStyle.color.primaryColor &&
    style.position === 'absolute' &&
    typeof style.width === 'number' &&
    style.width > 0 &&
    typeof style.left === 'number' &&
    typeof style.top === 'number'
  );
}

function hasAnimatedOpacity(node: ReactTestInstance): boolean {
  const opacity = styleOf(node).opacity;
  return !!opacity && typeof (opacity as Style).__getValue === 'function';
}

// Wiring contract: one Animated.Value per segment + a parent fade-out value.
// The parent value is the one carried by (or above) the labeled container.
function cueOpacityValues(): {
  segmentValues: Animated.Value[];
  containerValues: Animated.Value[];
} {
  const nodes = screen.UNSAFE_root.findAll(hasAnimatedOpacity);
  const segmentValues: Animated.Value[] = [];
  const containerValues: Animated.Value[] = [];
  for (const node of nodes) {
    if (isOnContainerPath(node)) {
      containerValues.push(styleOf(node).opacity as Animated.Value);
    } else {
      segmentValues.push(styleOf(node).opacity as Animated.Value);
    }
  }
  return { segmentValues, containerValues };
}

function isOnContainerPath(node: ReactTestInstance): boolean {
  let current: ReactTestInstance | null = node;
  while (current) {
    if (current.props.accessibilityLabel === LABEL) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function visibleCount(values: Animated.Value[]): number {
  return values.filter((value) => readValue(value) > 0).length;
}

function barSignature(node: ReactTestInstance): string {
  const style = styleOf(node);
  return JSON.stringify([
    style.left,
    style.top,
    style.width,
    style.height,
    style.borderRadius,
    style.backgroundColor,
    style.transform,
  ]);
}

type BBox = { minX: number; maxX: number; minY: number; maxY: number };

// Rotated-bar bounds: the bar rotates around its own center.
function barBox(style: Style): BBox {
  const { left, top, width, height } = style;
  const deg = parseFloat(style.transform?.[0]?.rotate ?? '0') || 0;
  const rad = (deg * Math.PI) / 180;
  const ex = Math.abs((width * Math.cos(rad)) / 2) + Math.abs((height * Math.sin(rad)) / 2);
  const ey = Math.abs((width * Math.sin(rad)) / 2) + Math.abs((height * Math.cos(rad)) / 2);
  const cx = left + width / 2;
  const cy = top + height / 2;
  return { minX: cx - ex, maxX: cx + ex, minY: cy - ey, maxY: cy + ey };
}

function unionBox(boxes: BBox[]): BBox {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

describe('ModeCue', () => {
  beforeEach(() => {
    useFakeAnimationTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders a pointerEvents="none" container labelled via game.picture.modeCueLabel', () => {
    renderCue();

    const container = findLabeledNode();
    expect(container).not.toBeNull();
    expect(container!.props.pointerEvents).toBe('none');
  });

  it('draws exactly 7 closed-loop bars with the traceSegmentStyle stroke (primaryColor, ~4px)', async () => {
    renderCue();
    await advance(250);

    const bars = findBars();
    expect(bars).toHaveLength(SEGMENT_COUNT);
    for (const bar of bars) {
      const style = styleOf(bar);
      expect(style.backgroundColor).toBe(GlobalStyle.color.primaryColor);
      expect(style.height).toBeGreaterThanOrEqual(3.5);
      expect(style.height).toBeLessThanOrEqual(4.5);
      expect(style.borderRadius).toBe(style.height / 2);
      expect(style.transform[0].rotate).toMatch(/-?\d+(\.\d+)?deg$/);
    }
  });

  it('renders the identical 7-point blob across separate mounts', async () => {
    renderCue();
    await advance(250);
    const first = findBars().map(barSignature);
    expect(first).toHaveLength(SEGMENT_COUNT);

    screen.unmount();
    renderCue();
    await advance(250);
    const second = findBars().map(barSignature);

    expect(second).toEqual(first);
  });

  it('centres the blob on the image, sized ≈35–40% of the smaller image dimension', async () => {
    renderCue();
    await advance(250);

    const bars = findBars();
    expect(bars).toHaveLength(SEGMENT_COUNT);
    const box = unionBox(bars.map((bar) => barBox(styleOf(bar))));

    const extent = Math.max(box.maxX - box.minX, box.maxY - box.minY);
    expect(extent).toBeGreaterThanOrEqual(0.32 * MIN_DIM);
    expect(extent).toBeLessThanOrEqual(0.43 * MIN_DIM);

    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    expect(Math.abs(cx - IMAGE_DIMS.width / 2)).toBeLessThanOrEqual(0.05 * MIN_DIM);
    expect(Math.abs(cy - IMAGE_DIMS.height / 2)).toBeLessThanOrEqual(0.05 * MIN_DIM);
  });

  it('reveals segments staggered ~30ms apart: 1 visible after one frame, 2 by ~48ms, all 7 by ≈210ms', async () => {
    renderCue();

    const { segmentValues, containerValues } = cueOpacityValues();
    expect(segmentValues).toHaveLength(SEGMENT_COUNT);
    expect(containerValues).toHaveLength(1);

    await advance(16);
    expect(visibleCount(segmentValues)).toBe(1);

    await advance(32);
    expect(visibleCount(segmentValues)).toBe(2);

    await advance(160);
    expect(visibleCount(segmentValues)).toBe(SEGMENT_COUNT);
    expect(readValue(containerValues[0])).toBeGreaterThan(0.8);
  });

  it('fades the whole cue to opacity 0 by ≈360ms and renders null afterwards', async () => {
    renderCue();

    const { containerValues } = cueOpacityValues();
    expect(containerValues).toHaveLength(1);

    await advance(216);
    expect(readValue(containerValues[0])).toBeGreaterThan(0.8);

    await advance(152);
    expect(readValue(containerValues[0])).toBeLessThan(0.05);

    await advance(64);
    expect(screen.toJSON()).toBeNull();
  });

  it('drives every animation on the JS driver (useNativeDriver: false)', async () => {
    const timingSpy = jest.spyOn(Animated, 'timing');
    renderCue();

    await advance(400);

    expect(timingSpy.mock.calls.length).toBeGreaterThanOrEqual(SEGMENT_COUNT + 1);
    for (const [, config] of timingSpy.mock.calls) {
      expect((config as Style).useNativeDriver).toBe(false);
    }
  });

  it('stops cleanly when unmounted mid-flash: no errors or warnings afterwards', async () => {
    const errorSpy = jest.spyOn(console, 'error');
    const { unmount } = renderCue();
    expect(findLabeledNode()).not.toBeNull();

    await advance(100);
    unmount();
    await advance(400);

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
