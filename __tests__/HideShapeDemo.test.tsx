// HideShapeDemo v2 GREEN contract suite (hide-shape-cue-guess-loop-plan).
//
// Pins the hide→guess teaching-loop contract: a `pointerEvents="none"` root
// (`game.picture.hide-cue`) a11y-labeled via `game.picture.hideCueLabel`;
// Scenario A draws the loose hiding circle (primaryColor), then two sloppy
// guesses (error500, info) and the exact-barn punchline (primaryColor500) —
// each guess popping a sequential fail verdict pill
// (`game.picture.hide-cue-verdict`, one at a time) with honest percents from
// the v2 score helpers; Scenario B group-fades the scenario-A strokes, redraws
// the exact outline in primaryColor with the corridor appearing ONLY there as
// ONE unit, then the almost-barn follower draws in the success color with the
// SUCCESS pill; a caption (`game.picture.hide-cue-caption`) renders BELOW the
// demo box per phase; the demo renders null after ≈11.5s; the demo box side is
// clamped to `screenHeight - CAPTION_RESERVE_PX` (landscape-safe, caption stays
// on-screen); playback never restarts on
// parent re-renders with new prop object identity; clean unmount mid-play;
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

import HideShapeDemo, { CAPTION_RESERVE_PX } from '../components/Picture/HideShapeDemo';
import {
  looseHideVsSloppyGuessScores,
  looseHideVsExactGuessScore,
  goodHideVsAlmostGuessScore,
} from '../utils/shapeDemoData';
import { GlobalStyle } from '../constants/theme';
import i18n from '../i18n';

const IMAGE_DIMS = { width: 320, height: 240 };
const DEFAULT_SCREEN_HEIGHT = 640;
// Closed-loop polylines: N resampled points → N−1 drawn bars (the wrap
// segment from last point back to the first is zero-length and filtered).
const CIRCLE_BARS = 9;
const GUESS_A_BARS = 11;
const GUESS_B_BARS = 9;
const TIGHT_BARS = 17;
const ALMOST_BARS = 17;
const ROOT_TEST_ID = 'game.picture.hide-cue';
const VERDICT_TEST_ID = 'game.picture.hide-cue-verdict';
const CAPTION_TEST_ID = 'game.picture.hide-cue-caption';
const BAND_TEST_ID = 'game.picture.trace-band';
const LABEL = i18n.t('game.picture.hideCueLabel');
const BAD_CAPTION = i18n.t('game.picture.hideCueBadHideCaption');
const GUESS_CAPTION = i18n.t('game.picture.hideCueGuessCaption');
const EXACT_FAILS_CAPTION = i18n.t('game.picture.hideCueExactFailsCaption');
const GOOD_HIDE_CAPTION = i18n.t('game.picture.hideCueGoodHideCaption');
const FOLLOW_CAPTION = i18n.t('game.picture.hideCueFollowCaption');
const FAIL_COPY = i18n.t('game.picture.hideCueFailLabel');
const EXACT_FAILS_COPY = i18n.t('game.picture.hideCueExactFailsLabel');
const TRACE_WIN_COPY = i18n.t('game.picture.traceWin');
const SLOPPY_SCORES = looseHideVsSloppyGuessScores();
const percentFor = (score: number): string => `${Math.round(score * 100)}%`;
const SLOPPY_A_PERCENT = percentFor(SLOPPY_SCORES.a);
const SLOPPY_B_PERCENT = percentFor(SLOPPY_SCORES.b);
const EXACT_FAIL_PERCENT = percentFor(looseHideVsExactGuessScore());
const WIN_PERCENT = percentFor(goodHideVsAlmostGuessScore());
// Explicitly off-center normalized fixture (traced barn element centroid,
// planning/hide-shape-cue-element-trace-plan Decision): centered placeholder
// data must not satisfy the mapping pin vacuously.
const BARN_NORMALIZED_CENTER = { x: 0.583, y: 0.654 };
// Phase boundaries (ms) per the plan's phase table — 70ms/16ms segment cadence
// over 9/11/9/17/17 bars plus per-phase holds: P1+P2 end at 1000, P3 2560,
// P4 4120, P5 6580, P6 8340, P7 11000, P8 (fade-out) 11200. Assertions use
// targeted advances with slack for ~250ms of frame-quantization drift.
const DEMO_END_MS = 11200;

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
  dims: { width: number; height: number } = IMAGE_DIMS,
  screenHeight: number = DEFAULT_SCREEN_HEIGHT
): Promise<RenderResult> {
  return render(<HideShapeDemo imageDimensionStyle={dims} screenHeight={screenHeight} />);
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

function findPills(view: RenderResult): TestInstance[] {
  return view.container.queryAll(
    (node) => node.props.testID === VERDICT_TEST_ID
  );
}

function findCaptions(view: RenderResult): TestInstance[] {
  return view.container.queryAll(
    (node) => node.props.testID === CAPTION_TEST_ID
  );
}

function isInsideNode(node: TestInstance, ancestor: TestInstance): boolean {
  let current: TestInstance | null = node.parent;
  while (current) {
    if (current === ancestor) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

// Self-traced stroke bars (circle / guesses / exact outlines) are thin rotated
// bars; corridor band bars are wide (bandWidth ≈ 2 × tolerance × box side,
// ≥ 15px at the demo's min dim) and carry only the static band translucency,
// so a 1–10px height window isolates the animated strokes.
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

// === tests ====================================================================

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
    { name: 'portrait', dims: { width: 240, height: 320 }, screenHeight: 640 },
    { name: 'landscape height-bound (reserve not binding)', dims: { width: 915, height: 610 }, screenHeight: 660 },
    { name: 'square', dims: { width: 320, height: 320 }, screenHeight: 640 },
    { name: 'wide landscape clamped to screenHeight minus caption reserve', dims: { width: 800, height: 450 }, screenHeight: 360, expectedSide: 316 },
    { name: 'large landscape clamped to screenHeight minus caption reserve', dims: { width: 915, height: 610 }, screenHeight: 412, expectedSide: 368 },
  ])(
    'draws the exact-barn punchline mapped box-local with the demo side clamped to screenHeight minus the caption reserve ($name)',
    async ({
      name,
      dims,
      screenHeight,
      expectedSide,
    }: {
      name: string;
      dims: { width: number; height: number };
      screenHeight: number;
      expectedSide?: number;
    }) => {
      // side = min(dims.width, dims.height, screenHeight − CAPTION_RESERVE_PX);
      // reserve-bound landscape rows pin the literal instead of mirroring the formula.
      const demoSide = expectedSide ?? Math.min(
        dims.width,
        dims.height,
        screenHeight - CAPTION_RESERVE_PX
      );
      const view = await renderDemo(dims, screenHeight);
      await advance(5100);

      const labeled = findLabeledNode(view);
      expect(labeled).not.toBeNull();
      const boxStyle = styleOf(labeled!);
      expect(boxStyle.width).toBe(demoSide);
      expect(boxStyle.height).toBe(demoSide);
      expect(demoSide).toBeLessThanOrEqual(screenHeight - CAPTION_RESERVE_PX);

      const punchBars = findStrokeBars(view, GlobalStyle.color.primaryColor500);
      expect(punchBars.length).toBe(TIGHT_BARS);
      const box = unionBox(punchBars.map((bar) => barBox(styleOf(bar))));
      const extent = Math.max(box.maxX - box.minX, box.maxY - box.minY);
      // Traced barn max normalized dim is 0.301 of the demo side; floor pins
      // the outline near full size, ceiling guards a degenerate contour.
      expect(extent).toBeGreaterThanOrEqual(0.295 * demoSide);
      expect(extent).toBeLessThanOrEqual(1.05 * demoSide);
      // demoBox is flex-centered inside the overlay, so punchline px are
      // box-local: expected center is norm × demo side with no photo-rect
      // offset terms.
      const expectedCx = BARN_NORMALIZED_CENTER.x * demoSide;
      const expectedCy = BARN_NORMALIZED_CENTER.y * demoSide;
      const cx = (box.minX + box.maxX) / 2;
      const cy = (box.minY + box.maxY) / 2;
      expect(Math.abs(cx - expectedCx)).toBeLessThanOrEqual(0.02 * demoSide);
      expect(Math.abs(cy - expectedCy)).toBeLessThanOrEqual(0.02 * demoSide);
    }
  );

  it('draws the loose circle FIRST: staggered ~70ms reveal in primaryColor, complete before any guess', async () => {
    const view = await renderDemo();

    await advance(16);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor)).toBe(1);

    await advance(70);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor)).toBe(2);

    await advance(714);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor)).toBe(CIRCLE_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.error500)).toBe(0);
    expect(visibleStrokeCount(view, GlobalStyle.color.info)).toBe(0);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor500)).toBe(0);
    expect(visibleStrokeCount(view, GlobalStyle.color.success)).toBe(0);
  });

  it('orders scenario A after the circle: sloppy A (error500), then sloppy B (info), then the exact-barn punchline (primaryColor500)', async () => {
    const view = await renderDemo();

    await advance(1000);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor)).toBe(CIRCLE_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.error500)).toBe(0);
    expect(visibleStrokeCount(view, GlobalStyle.color.info)).toBe(0);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor500)).toBe(0);

    // Early guess A: bars appearing at the ~70ms cadence, nothing else yet.
    await advance(170);
    const aEarly = visibleStrokeCount(view, GlobalStyle.color.error500);
    expect(aEarly).toBeGreaterThan(0);
    expect(aEarly).toBeLessThan(GUESS_A_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.info)).toBe(0);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor500)).toBe(0);

    await advance(2560 - 1170);
    expect(visibleStrokeCount(view, GlobalStyle.color.error500)).toBe(GUESS_A_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.info)).toBe(0);

    // 300ms into guess B.
    await advance(300);
    const bEarly = visibleStrokeCount(view, GlobalStyle.color.info);
    expect(bEarly).toBeGreaterThan(0);
    expect(bEarly).toBeLessThan(GUESS_B_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor500)).toBe(0);

    await advance(5500 - 2860);
    expect(visibleStrokeCount(view, GlobalStyle.color.error500)).toBe(GUESS_A_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.info)).toBe(GUESS_B_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor500)).toBe(TIGHT_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.success)).toBe(0);
  });

  it('keeps the corridor band absent through scenario A, then fades it in as ONE unit during the good hide', async () => {
    const view = await renderDemo();

    await advance(6400);
    expect(findBandRoot(view)).toBeNull();

    // Group fade → exact outline redraw → corridor fade all complete by the
    // P6 tail (frame quantization drifts boundaries late by ~250ms).
    await advance(1920);
    const bandRoot = findBandRoot(view);
    expect(bandRoot).not.toBeNull();
    expect(bandBars(bandRoot!).length).toBeGreaterThanOrEqual(8);
    expect(animatedOpacityCountAbove(bandRoot!)).toBe(1);
    expect((styleOf(bandRoot!.parent!) as Style).opacity).toBeGreaterThan(0);

    await advance(2300);
    expect(findBandRoot(view)).toBeNull();
  });

  it('scenario B: group-fades the scenario-A strokes to zero, redraws the exact outline in primaryColor', async () => {
    const view = await renderDemo();

    await advance(6560);
    expect(visibleStrokeCount(view, GlobalStyle.color.error500)).toBe(GUESS_A_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.info)).toBe(GUESS_B_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor500)).toBe(TIGHT_BARS);

    // By the P6 tail the group fade has finished: every scenario-A guess stroke
    // is gone and the punchline is reset for the primaryColor redraw.
    await advance(700);
    expect(visibleStrokeCount(view, GlobalStyle.color.error500)).toBe(0);
    expect(visibleStrokeCount(view, GlobalStyle.color.info)).toBe(0);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor500)).toBe(0);

    await advance(1240);
    // The redrawn outline occupies the barn footprint: the union extent of the
    // primaryColor bars must shrink to the tight contour (the loose circle's
    // extent 0.44 × side would violate this ceiling), proving it faded out.
    const redrawBars = findStrokeBars(view, GlobalStyle.color.primaryColor);
    expect(visibleCount(redrawBars)).toBe(TIGHT_BARS);
    const box = unionBox(
      redrawBars.filter((bar) => (styleOf(bar).opacity as number) > 0).map((bar) => barBox(styleOf(bar)))
    );
    const extent = Math.max(box.maxX - box.minX, box.maxY - box.minY);
    const demoSide = 240;
    expect(extent).toBeGreaterThanOrEqual(0.29 * demoSide);
    expect(extent).toBeLessThanOrEqual(0.35 * demoSide);
  });

  it('finishes scenario B with the almost-barn follower in the success color while the redrawn outline persists', async () => {
    const view = await renderDemo();

    await advance(8700);
    const successEarly = visibleStrokeCount(view, GlobalStyle.color.success);
    expect(successEarly).toBeGreaterThan(0);
    expect(successEarly).toBeLessThan(ALMOST_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor)).toBe(TIGHT_BARS);
    expect(findBandRoot(view)).toBeNull();

    await advance(2200);
    expect(visibleStrokeCount(view, GlobalStyle.color.success)).toBe(ALMOST_BARS);
    expect(visibleStrokeCount(view, GlobalStyle.color.primaryColor)).toBe(TIGHT_BARS);
    expect(findBandRoot(view)).toBeNull();
  });

  it('pops four sequential verdict pills, one at a time, with per-phase copy and honest percents', async () => {
    const view = await renderDemo();

    await advance(1200);
    let pills = findPills(view);
    expect(pills).toHaveLength(1);
    let texts = textStringsOf(pills[0]);
    expect(texts).toContain(FAIL_COPY);
    expect(texts).toContain(SLOPPY_A_PERCENT);

    await advance(1600);
    pills = findPills(view);
    expect(pills).toHaveLength(1);
    texts = textStringsOf(pills[0]);
    expect(texts).toContain(FAIL_COPY);
    expect(texts).toContain(SLOPPY_B_PERCENT);

    await advance(1800);
    pills = findPills(view);
    expect(pills).toHaveLength(1);
    texts = textStringsOf(pills[0]);
    expect(texts).toContain(EXACT_FAILS_COPY);
    expect(texts).toContain(EXACT_FAIL_PERCENT);

    await advance(4200);
    pills = findPills(view);
    expect(pills).toHaveLength(1);
    texts = textStringsOf(pills[0]);
    expect(texts).toContain(TRACE_WIN_COPY);
    expect(texts).toContain(WIN_PERCENT);
  });

  it('shows no pill before the first guess and none during the good hide', async () => {
    const view = await renderDemo();

    await advance(400);
    expect(findPills(view)).toHaveLength(0);

    await advance(7280);
    expect(findPills(view)).toHaveLength(0);
  });

  it('renders the phase caption BELOW the demo box (never inside it) with the per-phase copy', async () => {
    const view = await renderDemo();

    await advance(400);
    let captions = findCaptions(view);
    expect(captions).toHaveLength(1);
    expect(captions[0].props.pointerEvents).toBe('none');
    expect(captions[0].props.children).toBe(BAD_CAPTION);
    const labeled = findLabeledNode(view);
    expect(labeled).not.toBeNull();
    expect(isInsideNode(captions[0], labeled!)).toBe(false);

    await advance(1600);
    captions = findCaptions(view);
    expect(captions[0].props.children).toBe(GUESS_CAPTION);

    await advance(1000);
    captions = findCaptions(view);
    expect(captions[0].props.children).toBe(GUESS_CAPTION);

    await advance(2000);
    captions = findCaptions(view);
    expect(captions[0].props.children).toBe(EXACT_FAILS_CAPTION);

    await advance(2000);
    captions = findCaptions(view);
    expect(captions[0].props.children).toBe(GOOD_HIDE_CAPTION);

    await advance(2000);
    captions = findCaptions(view);
    expect(captions[0].props.children).toBe(FOLLOW_CAPTION);
  });

  it('renders null after ≈11.5s (full playback, fade-out last)', async () => {
    const view = await renderDemo();

    await advance(DEMO_END_MS - 100);
    expect(view.toJSON()).not.toBeNull();
    expect(findPills(view).length).toBeGreaterThan(0);

    await advance(700);
    expect(view.toJSON()).toBeNull();
  });

  it('does not restart playback when the parent re-renders mid-play with a new prop object identity', async () => {
    const view = await renderDemo();
    await advance(100);
    const before = visibleStrokeCount(view, GlobalStyle.color.primaryColor);
    expect(before).toBeGreaterThanOrEqual(2);

    await view.rerender(
      <HideShapeDemo imageDimensionStyle={{ width: 320, height: 240 }} screenHeight={640} />
    );
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

    expect(timingSpy.mock.calls.length).toBeGreaterThanOrEqual(TIGHT_BARS);
    for (const [, config] of timingSpy.mock.calls) {
      expect((config as Style).useNativeDriver).toBe(false);
    }
  });
});
