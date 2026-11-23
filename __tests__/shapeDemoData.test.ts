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

describe('resamplePolyline', () => {
  it.each([18, 10])('returns exactly %i points with equalized spacing, preserved endpoints and arc length', (targetCount) => {
    for (const [, points] of POLYLINE_CASES) {
      const resampled = resamplePolyline(points, targetCount);
      expect(resampled).toHaveLength(targetCount);
      expect(resampled[0]).toEqual(points[0]);
      expect(resampled[resampled.length - 1]).toEqual(points[points.length - 1]);

      const originalLength = totalArcLength(points);
      const resampledLength = totalArcLength(resampled);
      expect(resampledLength).toBeGreaterThan(0);
      expect(Math.abs(resampledLength - originalLength)).toBeLessThanOrEqual(originalLength * 0.02);

      const spacings: number[] = [];
      for (let i = 0; i < resampled.length - 1; i++) {
        spacings.push(Math.hypot(resampled[i + 1].x - resampled[i].x, resampled[i + 1].y - resampled[i].y));
      }
      const maxSpacing = Math.max(...spacings);
      const minSpacing = Math.min(...spacings);
      expect(maxSpacing / minSpacing).toBeLessThan(1.15);
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
