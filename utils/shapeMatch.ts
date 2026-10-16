import type { Point } from './shapeGeometry';
import { outlineLengthInImageSpace } from './shapeGeometry';

export const SHAPE_TOLERANCE_RATIO = 0.05;
export const MAX_LENGTH_RATIO = 1.4;
export const MATCH_THRESHOLD_RATIO = 0.9;

export interface OutlineScoreParams {
  hiddenShape: Point[];
  guessShape: Point[];
  imageWidth: number;
  imageHeight: number;
}

export function distancePointToSegment(point: Point, start: Point, end: Point): number {
  const segmentLengthSquared =
    (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (segmentLengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * (end.x - start.x) +
        (point.y - start.y) * (end.y - start.y)) /
        segmentLengthSquared
    )
  );
  return Math.hypot(
    point.x - (start.x + t * (end.x - start.x)),
    point.y - (start.y + t * (end.y - start.y))
  );
}

function toSegments(points: Point[]): [Point, Point][] {
  const segments: [Point, Point][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push([points[i], points[i + 1]]);
  }
  return segments;
}

function distanceToOutline(point: Point, segments: [Point, Point][]): number {
  let min = Infinity;
  for (const [start, end] of segments) {
    const distance = distancePointToSegment(point, start, end);
    if (distance < min) {
      min = distance;
    }
  }
  return min;
}

function forEachCorridorSample(
  points: Point[],
  tolerance: number,
  visitSample: (sample: Point) => void
): void {
  const maxStep = tolerance / 2;
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(1, Math.ceil(segmentLength / maxStep));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      visitSample({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      });
    }
  }
}

function toImageSpace(
  shape: Point[],
  imageWidth: number,
  imageHeight: number
): Point[] {
  return shape.map((point) => ({
    x: point.x * imageWidth,
    y: point.y * imageHeight,
  }));
}

function corridorCoverage(
  points: Point[],
  otherSegments: [Point, Point][],
  tolerance: number
): number {
  let withinCount = 0;
  let totalCount = 0;
  forEachCorridorSample(points, tolerance, (sample) => {
    totalCount++;
    if (distanceToOutline(sample, otherSegments) <= tolerance) {
      withinCount++;
    }
  });
  return totalCount === 0 ? 0 : withinCount / totalCount;
}

function isDegenerateOutline(
  shape: Point[],
  imageWidth: number,
  imageHeight: number
): boolean {
  return outlineLengthInImageSpace(shape, imageWidth, imageHeight) === 0;
}

export function shapeTolerancePx(imageWidth: number, imageHeight: number): number {
  if (!(imageWidth > 0) || !(imageHeight > 0)) {
    return 0;
  }
  return SHAPE_TOLERANCE_RATIO * Math.min(imageWidth, imageHeight);
}

export function outlineMatchScore({
  hiddenShape,
  guessShape,
  imageWidth,
  imageHeight,
}: OutlineScoreParams): number {
  if (!(imageWidth > 0) || !(imageHeight > 0)) {
    return 0;
  }
  if (isDegenerateOutline(hiddenShape, imageWidth, imageHeight)) {
    return 0;
  }
  if (isDegenerateOutline(guessShape, imageWidth, imageHeight)) {
    return 0;
  }
  const tolerance = shapeTolerancePx(imageWidth, imageHeight);
  const hiddenPixels = toImageSpace(hiddenShape, imageWidth, imageHeight);
  const guessPixels = toImageSpace(guessShape, imageWidth, imageHeight);
  return Math.min(
    corridorCoverage(guessPixels, toSegments(hiddenPixels), tolerance),
    corridorCoverage(hiddenPixels, toSegments(guessPixels), tolerance)
  );
}

export function isWinningTrace(params: OutlineScoreParams): boolean {
  const { hiddenShape, guessShape, imageWidth, imageHeight } = params;
  if (!(imageWidth > 0) || !(imageHeight > 0)) {
    return false;
  }
  if (isDegenerateOutline(hiddenShape, imageWidth, imageHeight)) {
    return false;
  }
  return (
    outlineMatchScore(params) >= MATCH_THRESHOLD_RATIO &&
    outlineLengthInImageSpace(guessShape, imageWidth, imageHeight) <=
      outlineLengthInImageSpace(hiddenShape, imageWidth, imageHeight) *
        MAX_LENGTH_RATIO
  );
}
