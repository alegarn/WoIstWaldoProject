import type { Point } from './shapeGeometry';

export const SHAPE_TOLERANCE_RATIO = 0.05;

interface OutlineMatchParams {
  hiddenShape: Point[];
  guessShape: Point[];
  imageWidth: number;
  imageHeight: number;
  screenWidth: number;
  screenHeight: number;
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

function passesCorridor(
  points: Point[],
  otherSegments: [Point, Point][],
  tolerance: number
): boolean {
  const maxStep = tolerance / 2;
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(1, Math.ceil(segmentLength / maxStep));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const sample = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
      if (distanceToOutline(sample, otherSegments) > tolerance) {
        return false;
      }
    }
  }
  return true;
}

export function outlineMatch({
  hiddenShape,
  guessShape,
  imageWidth,
  imageHeight,
  screenWidth,
  screenHeight,
}: OutlineMatchParams): boolean {
  const tolerance = Math.min(screenWidth, screenHeight) * SHAPE_TOLERANCE_RATIO;
  const hiddenPixels = hiddenShape.map((point) => ({
    x: point.x * imageWidth,
    y: point.y * imageHeight,
  }));
  const guessPixels = guessShape.map((point) => ({
    x: point.x * imageWidth,
    y: point.y * imageHeight,
  }));
  return (
    passesCorridor(guessPixels, toSegments(hiddenPixels), tolerance) &&
    passesCorridor(hiddenPixels, toSegments(guessPixels), tolerance)
  );
}
