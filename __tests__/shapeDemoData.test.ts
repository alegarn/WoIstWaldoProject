import type { Point } from '../utils/shapeGeometry';
import { outlineMatchScore, isWinningTrace } from '../utils/shapeMatch';
import {
  TIGHT_CONTOUR_POINTS,
  LOOSE_CIRCLE_POINTS,
  FAILING_LINE_POINTS,
  resamplePolyline,
  demoFailScore,
} from '../utils/shapeDemoData';

const DEMO_IMAGE_SIZE = 320;

const POLYLINE_CASES: [string, Point[]][] = [
  ['TIGHT_CONTOUR_POINTS', TIGHT_CONTOUR_POINTS],
  ['LOOSE_CIRCLE_POINTS', LOOSE_CIRCLE_POINTS],
  ['FAILING_LINE_POINTS', FAILING_LINE_POINTS],
];

function boundingBox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

// Vertex-mean centroid; the trace pins below use per-axis distance (stricter
// than Euclidean, bounds each axis independently).
function centroid(points: Point[]): { x: number; y: number } {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: xs.reduce((sum, x) => sum + x, 0) / points.length,
    y: ys.reduce((sum, y) => sum + y, 0) / points.length,
  };
}

function totalArcLength(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return total;
}

describe('shapeDemoData polylines', () => {
  it.each(POLYLINE_CASES)('%s is a closed loop of ≥8 points inside [0,1]', (_name, points) => {
    expect(points.length).toBeGreaterThanOrEqual(8);
    expect(points[0]).toEqual(points[points.length - 1]);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
  });

  it('tight and loose have distinct bounding boxes', () => {
    const tight = boundingBox(TIGHT_CONTOUR_POINTS);
    const loose = boundingBox(LOOSE_CIRCLE_POINTS);
    expect(tight).not.toEqual(loose);
  });

  it('failing line is distinct from loose circle', () => {
    const failing = boundingBox(FAILING_LINE_POINTS);
    const loose = boundingBox(LOOSE_CIRCLE_POINTS);
    expect(failing).not.toEqual(loose);
  });
});

describe('barn element trace', () => {
  const BARN_ELEMENT_BBOX = { minX: 0.425, minY: 0.45, maxX: 0.735, maxY: 0.795 };
  const BARN_EDGE_TOLERANCE = 0.06;
  const BARN_ASPECT_RATIO = 0.967;
  const ASPECT_RATIO_TOLERANCE = 0.15;
  const CENTROID_TOLERANCE = 0.12;

  it('TIGHT contour sits inside the traced barn element bbox (±0.06 per edge)', () => {
    const tight = boundingBox(TIGHT_CONTOUR_POINTS);
    expect(tight.minX).toBeGreaterThanOrEqual(BARN_ELEMENT_BBOX.minX - BARN_EDGE_TOLERANCE);
    expect(tight.minY).toBeGreaterThanOrEqual(BARN_ELEMENT_BBOX.minY - BARN_EDGE_TOLERANCE);
    expect(tight.maxX).toBeLessThanOrEqual(BARN_ELEMENT_BBOX.maxX + BARN_EDGE_TOLERANCE);
    expect(tight.maxY).toBeLessThanOrEqual(BARN_ELEMENT_BBOX.maxY + BARN_EDGE_TOLERANCE);
  });

  it('TIGHT contour has the barn aspect ratio (w/h ≈ 0.967 ±0.15)', () => {
    const tight = boundingBox(TIGHT_CONTOUR_POINTS);
    const aspectRatio = (tight.maxX - tight.minX) / (tight.maxY - tight.minY);
    expect(Math.abs(aspectRatio - BARN_ASPECT_RATIO)).toBeLessThanOrEqual(ASPECT_RATIO_TOLERANCE);
  });

  it('TIGHT contour raw extent (max bbox side) is ≥0.29 and ≤0.45', () => {
    const tight = boundingBox(TIGHT_CONTOUR_POINTS);
    const extent = Math.max(tight.maxX - tight.minX, tight.maxY - tight.minY);
    // Raw measured extent is 0.301; the HideShapeDemo extent-floor test is
    // bar-derived (~1.5px real margin), so this RAW pin keeps an honest margin.
    expect(extent).toBeGreaterThanOrEqual(0.29);
    expect(extent).toBeLessThanOrEqual(0.45);
  });

  it('LOOSE and FAILING centroids sit within 0.12 per axis of the TIGHT centroid (0.583, 0.654)', () => {
    const tight = centroid(TIGHT_CONTOUR_POINTS);
    for (const points of [LOOSE_CIRCLE_POINTS, FAILING_LINE_POINTS]) {
      const center = centroid(points);
      expect(Math.abs(center.x - tight.x)).toBeLessThanOrEqual(CENTROID_TOLERANCE);
      expect(Math.abs(center.y - tight.y)).toBeLessThanOrEqual(CENTROID_TOLERANCE);
    }
  });

  it.each([
    ['LOOSE_CIRCLE_POINTS', LOOSE_CIRCLE_POINTS],
    ['FAILING_LINE_POINTS', FAILING_LINE_POINTS],
  ])('%s bbox strictly contains the TIGHT bbox on ≥3 of 4 edges', (_name, points) => {
    const tight = boundingBox(TIGHT_CONTOUR_POINTS);
    const outer = boundingBox(points);
    const containedEdges = [
      outer.minX < tight.minX,
      outer.minY < tight.minY,
      outer.maxX > tight.maxX,
      outer.maxY > tight.maxY,
    ].filter(Boolean).length;
    expect(containedEdges).toBeGreaterThanOrEqual(3);
  });
});

describe('resamplePolyline', () => {
  it.each([
    [18, { loss: 0.03, spacingRatio: 1.15 }],
    [10, { loss: 0.06, spacingRatio: 1.18 }],
  ])('returns exactly %i points with equalized spacing, preserved endpoints and arc length', (targetCount, { loss: lossTolerance, spacingRatio: ratioTolerance }) => {
    for (const [, points] of POLYLINE_CASES) {
      const resampled = resamplePolyline(points, targetCount);
      expect(resampled).toHaveLength(targetCount);
      expect(resampled[0]).toEqual(points[0]);
      expect(resampled[resampled.length - 1]).toEqual(points[points.length - 1]);

      const originalLength = totalArcLength(points);
      const resampledLength = totalArcLength(resampled);
      expect(resampledLength).toBeGreaterThan(0);
      // Chord resampling legitimately shortens the traced polylines. Measured
      // worst cases: TIGHT at 18 → 2.16% loss, TIGHT at 10 → 5.15% loss
      // (the corner-heavy barn ring). Per-target floors leave headroom.
      expect(Math.abs(resampledLength - originalLength)).toBeLessThanOrEqual(originalLength * lossTolerance);

      const spacings: number[] = [];
      for (let i = 0; i < resampled.length - 1; i++) {
        spacings.push(Math.hypot(resampled[i + 1].x - resampled[i].x, resampled[i + 1].y - resampled[i].y));
      }
      const maxSpacing = Math.max(...spacings);
      const minSpacing = Math.min(...spacings);
      // Measured worst spacing ratios per target: TIGHT at 18 → 1.1446,
      // TIGHT at 10 → 1.1741 (LOOSE@10 1.1115, FAILING@18 1.1040);
      // still roughly equalized.
      expect(maxSpacing / minSpacing).toBeLessThan(ratioTolerance);
    }
  });
});

describe('demoFailScore', () => {
  it('is a finite honest fail score in the [0.25, 0.45] band', () => {
    const score = demoFailScore();
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0.25);
    expect(score).toBeLessThanOrEqual(0.45);
  });

  it('matches outlineMatchScore over the 320×320 demo space and is not a winning trace', () => {
    expect(demoFailScore()).toBe(
      outlineMatchScore({
        hiddenShape: TIGHT_CONTOUR_POINTS,
        guessShape: FAILING_LINE_POINTS,
        imageWidth: DEMO_IMAGE_SIZE,
        imageHeight: DEMO_IMAGE_SIZE,
      })
    );
    expect(
      isWinningTrace({
        hiddenShape: TIGHT_CONTOUR_POINTS,
        guessShape: FAILING_LINE_POINTS,
        imageWidth: DEMO_IMAGE_SIZE,
        imageHeight: DEMO_IMAGE_SIZE,
      })
    ).toBe(false);
  });
});
