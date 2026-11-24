// HideShapeDemo GREEN contract suite (hide-shape-cue-tutorial-plan).
//
// Pins the Hide Shape Cue wiring contract: a `pointerEvents="none"` root
// (`game.picture.hide-cue`) a11y-labeled via `game.picture.hideCueLabel`;
// Phase 1 draws a ~18-segment tight contour staggered ~70ms in primaryColor
// with the TraceCorridor band absent until the contour completes, then faded
// in as ONE unit; Phase 2 draws a loose circle after the corridor, then a
// diverging line in the distinct reveal color primaryColor500; a fail verdict
// pill (`game.picture.hide-cue-verdict`) shows the honest numeric percent +
// `game.picture.hideCueFailLabel` copy; the whole demo renders null after the
// pill hold + fade (≈5s total); playback never restarts on parent re-renders
// with a new `imageDimensionStyle` object identity; clean unmount mid-play;
// every animation on the JS driver (`useNativeDriver: false`).
//
// Timing harness is copied from the repo's only real-Animated precedent
// (__tests__/ModeCue.test.tsx:37-61): manual `Date.now` mock + stepped manual
// clock — TimingAnimation eases on Date.now(), which jest fake timers do NOT
// fake — plus a 16ms rAF shim. This suite's own advance step is 16ms (exactly
// one rAF frame).

import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { TestInstance, TestNode } from 'test-renderer';
import { act, render, type RenderResult } from '@testing-library/react-native';

import HideShapeDemo from '../components/Picture/HideShapeDemo';
import { demoFailScore } from '../utils/shapeDemoData';
import { GlobalStyle } from '../constants/theme';
import i18n from '../i18n';

type DemoProps = { imageDimensionStyle: { width: number; height: number } };

const Demo: React.FC<DemoProps> = HideShapeDemo;

const IMAGE_DIMS = { width: 320, height: 240 };
const MIN_DIM = Math.min(IMAGE_DIMS.width, IMAGE_DIMS.height);
const CONTOUR_MIN_SEGMENTS = 16;
const CONTOUR_MAX_SEGMENTS = 24;
const ROOT_TEST_ID = 'game.picture.hide-cue';
const VERDICT_TEST_ID = 'game.picture.hide-cue-verdict';
const BAND_TEST_ID = 'game.picture.trace-band';
const LABEL = i18n.t('game.picture.hideCueLabel');
const FAIL_COPY = i18n.t('game.picture.hideCueFailLabel');
const FAIL_PERCENT = `${Math.round(demoFailScore() * 100)}%`;
// Explicitly off-center normalized fixture (traced barn element centroid,
// planning/hide-shape-cue-element-trace-plan Decision): centered placeholder
// data must not satisfy the mapping pin vacuously.
const BARN_NORMALIZED_CENTER = { x: 0.583, y: 0.654 };

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

async function renderDemo(
  dims: { width: number; height: number } = IMAGE_DIMS
): Promise<RenderResult> {
  return render(<Demo imageDimensionStyle={dims} />);
}

function styleOf(node: TestInstance): Style {
  return StyleSheet.flatten(node.props.style ?? []) ?? {};
}

function findRoot(view: RenderResult): TestInstance | null {
  const matches = view.container.queryAll(
    (node) => node.props.testID === ROOT_TEST_ID
  );
  return matches[0] ?? null;
}

function findLabeledNode(view: RenderResult): TestInstance | null {
  const matches = view.container.queryAll(
    (node) => node.props.accessibilityLabel === LABEL
  );
  return matches[0] ?? null;
}

function findBandRoot(view: RenderResult): TestInstance | null {
  const matches = view.container.queryAll(
    (node) => node.props.testID === BAND_TEST_ID
  );
  return matches[0] ?? null;
}

// Self-traced stroke bars (contour / circle / diverging line) are thin
// rotated bars; corridor band bars are wide (bandWidth ≈ 2 × tolerance ×
// box side, ≥ 15px at the demo's min dim) and carry only the static band
// translucency, so a 1–10px height window isolates the animated strokes.
function matchesStrokeBarStyle(style: Style, color: string): boolean {
  const stroke = style.height;
  return (
    typeof stroke === 'number' &&
    stroke >= 1 &&
    stroke <= 10 &&
    style.borderRadius === stroke / 2 &&
    style.backgroundColor === color &&
    style.position === 'absolute' &&
    typeof style.width === 'number' &&
    style.width > 0 &&
    typeof style.left === 'number' &&
    typeof style.top === 'number'
  );
}

// Host nodes only: composite Animated nodes duplicate every match.
function findStrokeBars(view: RenderResult, color: string): TestInstance[] {
  return view.container.queryAll(
    (node) =>
      typeof node.type === 'string' &&
      matchesStrokeBarStyle(styleOf(node), color)
  );
}

// v14 test-renderer snapshots Animated styles as plain numbers on host nodes,
// so opacity state is read from the (per-access refreshed) style snapshot.
function visibleCount(nodes: TestInstance[]): number {
  return nodes.filter((node) => (styleOf(node).opacity as number) > 0).length;
}

function visibleStrokeCount(view: RenderResult, color: string): number {
  return visibleCount(findStrokeBars(view, color));
}

// Wiring contract: the corridor fades in as ONE unit — exactly one animated
// opacity driver between the band root and the labeled container.
function animatedOpacityCountAbove(bandRoot: TestInstance): number {
  let count = 0;
  let current: TestInstance | null = bandRoot;
  while (current) {
    if (typeof styleOf(current).opacity === 'number') {
      count += 1;
    }
    current = current.parent;
  }
  return count;
}

function bandBars(bandRoot: TestInstance): TestInstance[] {
  return bandRoot.children.filter(
    (child: TestNode) =>
      typeof child !== 'string' &&
      typeof child.type === 'string' &&
      typeof styleOf(child).width === 'number'
  ) as unknown as TestInstance[];
}

function textStringsOf(node: TestInstance): string[] {
  const strings: string[] = [];
  const visit = (current: TestInstance | string) => {
    if (typeof current === 'string') {
      return;
    }
    if (
      typeof current.type === 'string' &&
      typeof current.props.children === 'string'
    ) {
      strings.push(current.props.children);
    }
    current.children.forEach(visit);
  };
  node.children.forEach(visit);
  return strings;
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

describe('HideShapeDemo', () => {
  beforeEach(() => {
    useFakeAnimationTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders a pointerEvents="none" container labelled via game.picture.hideCueLabel', async () => {
    const view = await renderDemo();

    const root = findRoot(view);
    expect(root).not.toBeNull();
    expect(root!.props.pointerEvents).toBe('none');

    const labeled = findLabeledNode(view);
    expect(labeled).not.toBeNull();
    expect(labeled!.props.pointerEvents).toBe('none');
  });

  it.each([
    { name: 'portrait', dims: { width: 240, height: 320 } },
    { name: 'landscape', dims: { width: 320, height: 240 } },
    { name: 'square', dims: { width: 320, height: 320 } },
  ])(
    'draws the ~18-segment tight contour in primaryColor, mapped box-local from normalized demo space ($name)',
    async ({ dims }: { name: string; dims: { width: number; height: number } }) => {
      const minDim = Math.min(dims.width, dims.height);
      const view = await renderDemo(dims);
      await advance(1500);

      const contourBars = findStrokeBars(view, GlobalStyle.color.primaryColor);
      expect(contourBars.length).toBeGreaterThanOrEqual(CONTOUR_MIN_SEGMENTS);
      expect(contourBars.length).toBeLessThanOrEqual(CONTOUR_MAX_SEGMENTS);
      for (const bar of contourBars) {
        const style = styleOf(bar);
        expect(style.backgroundColor).toBe(GlobalStyle.color.primaryColor);
        expect(style.transform[0].rotate).toMatch(/-?\d+(\.\d+)?deg$/);
      }

      const box = unionBox(contourBars.map((bar) => barBox(styleOf(bar))));
      const extent = Math.max(box.maxX - box.minX, box.maxY - box.minY);
      // Traced barn max normalized dim is 0.301 of the min side (plan Decision);
      // floor pins the contour near full size, guarding only against a
      // degenerate contour.
      expect(extent).toBeGreaterThanOrEqual(0.295 * minDim);
      expect(extent).toBeLessThanOrEqual(1.05 * minDim);
      // demoBox is flex-centered inside the overlay, so contour px are
      // box-local: expected center is norm × min side with no photo-rect
      // offset terms.
      const expectedCx = BARN_NORMALIZED_CENTER.x * minDim;
      const expectedCy = BARN_NORMALIZED_CENTER.y * minDim;
      const cx = (box.minX + box.maxX) / 2;
      const cy = (box.minY + box.maxY) / 2;
      expect(Math.abs(cx - expectedCx)).toBeLessThanOrEqual(0.02 * minDim);
      expect(Math.abs(cy - expectedCy)).toBeLessThanOrEqual(0.02 * minDim);
    }
  );

  it('reveals contour segments staggered ~70ms apart: 1 after one frame, 2 by ≈86ms, all by ≈1.5s', async () => {
    const view = await renderDemo();

    await advance(16);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor)).toBe(1);

    await advance(70);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor)).toBe(2);

    await advance(1400);
    const total = visibleStrokeCount(view, GlobalStyle.color.primaryColor);
    expect(total).toBeGreaterThanOrEqual(CONTOUR_MIN_SEGMENTS);
    expect(total).toBeLessThanOrEqual(CONTOUR_MAX_SEGMENTS);
  });

  it('keeps the corridor band absent until the contour completes, then fades it in as ONE unit', async () => {
    const view = await renderDemo();

    await advance(200);
    expect(findBandRoot(view)).toBeNull();

    await advance(1500);
    const bandRoot = findBandRoot(view);
    expect(bandRoot).not.toBeNull();
    expect(bandBars(bandRoot!).length).toBeGreaterThanOrEqual(8);
    expect(animatedOpacityCountAbove(bandRoot!)).toBe(1);
    expect((styleOf(bandRoot!.parent!) as Style).opacity).toBeGreaterThan(0);
  });

  it('draws the loose circle after the corridor, then the diverging line in primaryColor500', async () => {
    const view = await renderDemo();

    await advance(1700);
    const contourTotal = visibleStrokeCount(view, GlobalStyle.color.primaryColor);
    expect(findStrokeBars(view, GlobalStyle.color.primaryColor500)).toHaveLength(0);

    await advance(800);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor)).toBeGreaterThan(
      contourTotal
    );
    expect(findStrokeBars(view, GlobalStyle.color.primaryColor500)).toHaveLength(0);

    await advance(1700);
    expect(
      visibleStrokeCount(view, GlobalStyle.color.primaryColor500)
    ).toBeGreaterThan(0);
  });

  it('pops the verdict pill after the diverging line with the honest percent and hideCueFailLabel copy', async () => {
    const view = await renderDemo();

    await advance(2500);
    expect(view.container.queryAll((node) => node.props.testID === VERDICT_TEST_ID)).toHaveLength(0);

    await advance(2800);
    const pill = view.container.queryAll(
      (node) => node.props.testID === VERDICT_TEST_ID
    )[0];
    expect(pill).not.toBeNull();

    const texts = textStringsOf(pill!);
    expect(texts).toContain(FAIL_COPY);
    expect(texts).toContain(FAIL_PERCENT);
  });

  it('renders null after the pill hold + fade (≈5s total)', async () => {
    const view = await renderDemo();

    await advance(5300);
    expect(view.toJSON()).not.toBeNull();
    expect(view.container.queryAll((node) => node.props.testID === VERDICT_TEST_ID).length).toBeGreaterThan(0);

    await advance(3000);
    expect(view.toJSON()).toBeNull();
  });

  it('does not restart playback when the parent re-renders mid-play with a new imageDimensionStyle identity', async () => {
    const view = await renderDemo();
    await advance(500);
    const before = visibleStrokeCount(view, GlobalStyle.color.primaryColor);
    expect(before).toBeGreaterThanOrEqual(4);

    await view.rerender(<Demo imageDimensionStyle={{ width: 320, height: 240 }} />);
    await advance(300);

    const after = visibleStrokeCount(view, GlobalStyle.color.primaryColor);
    expect(after).toBeGreaterThan(before);
    expect(findRoot(view)).not.toBeNull();
  });

  it('stops cleanly when unmounted mid-play: no errors or warnings afterwards', async () => {
    const errorSpy = jest.spyOn(console, 'error');
    const view = await renderDemo();
    const { unmount } = view;
    expect(findRoot(view)).not.toBeNull();

    await advance(100);
    await unmount();
    await advance(600);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('drives every animation on the JS driver (useNativeDriver: false)', async () => {
    const timingSpy = jest.spyOn(Animated, 'timing');
    await renderDemo();

    await advance(8000);

    expect(timingSpy.mock.calls.length).toBeGreaterThanOrEqual(CONTOUR_MIN_SEGMENTS);
    for (const [, config] of timingSpy.mock.calls) {
      expect((config as Style).useNativeDriver).toBe(false);
    }
  });
});
