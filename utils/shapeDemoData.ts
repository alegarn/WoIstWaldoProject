import type { Point } from './shapeGeometry';
import { outlineMatchScore } from './shapeMatch';

const DEMO_IMAGE_SIZE_PX = 320;

export const TIGHT_CONTOUR_POINTS: Point[] = [
  { x: 0.75, y: 0.5 },
  { x: 0.738, y: 0.59 },
  { x: 0.694, y: 0.669 },
  { x: 0.625, y: 0.725 },
  { x: 0.543, y: 0.753 },
  { x: 0.457, y: 0.753 },
  { x: 0.375, y: 0.725 },
  { x: 0.306, y: 0.669 },
  { x: 0.262, y: 0.59 },
  { x: 0.25, y: 0.5 },
  { x: 0.268, y: 0.412 },
  { x: 0.311, y: 0.335 },
  { x: 0.375, y: 0.275 },
  { x: 0.456, y: 0.241 },
  { x: 0.544, y: 0.241 },
  { x: 0.625, y: 0.275 },
  { x: 0.689, y: 0.335 },
  { x: 0.732, y: 0.412 },
  { x: 0.75, y: 0.5 },
];

export const LOOSE_CIRCLE_POINTS: Point[] = [
  { x: 0.83, y: 0.52 },
  { x: 0.812, y: 0.634 },
  { x: 0.756, y: 0.735 },
  { x: 0.667, y: 0.809 },
  { x: 0.558, y: 0.846 },
  { x: 0.443, y: 0.844 },
  { x: 0.337, y: 0.803 },
  { x: 0.25, y: 0.73 },
  { x: 0.192, y: 0.632 },
  { x: 0.17, y: 0.52 },
  { x: 0.188, y: 0.406 },
  { x: 0.244, y: 0.306 },
  { x: 0.333, y: 0.231 },
  { x: 0.443, y: 0.194 },
  { x: 0.557, y: 0.194 },
  { x: 0.663, y: 0.231 },
  { x: 0.75, y: 0.31 },
  { x: 0.808, y: 0.408 },
  { x: 0.83, y: 0.52 },
];

export const FAILING_LINE_POINTS: Point[] = [
  { x: 0.8, y: 0.505 },
  { x: 0.79, y: 0.572 },
  { x: 0.759, y: 0.631 },
  { x: 0.71, y: 0.674 },
  { x: 0.651, y: 0.696 },
  { x: 0.589, y: 0.696 },
  { x: 0.53, y: 0.674 },
  { x: 0.481, y: 0.631 },
  { x: 0.45, y: 0.572 },
  { x: 0.44, y: 0.505 },
  { x: 0.452, y: 0.439 },
  { x: 0.483, y: 0.381 },
  { x: 0.53, y: 0.336 },
  { x: 0.589, y: 0.312 },
  { x: 0.651, y: 0.312 },
  { x: 0.71, y: 0.336 },
  { x: 0.758, y: 0.381 },
  { x: 0.788, y: 0.439 },
  { x: 0.8, y: 0.505 },
];

function cumulativeSegmentLengths(points: Point[]): number[] {
  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] +
        Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    );
  }
  return cumulative;
}

function pointAtDistance(
  points: Point[],
  cumulative: number[],
  distance: number
): Point {
  let index = 1;
  while (index < cumulative.length - 1 && cumulative[index] < distance) {
    index++;
  }
  const segmentStart = cumulative[index - 1];
  const segmentLength = cumulative[index] - segmentStart;
  if (segmentLength === 0) {
    return { ...points[index] };
  }
  const t = (distance - segmentStart) / segmentLength;
  return {
    x: points[index - 1].x + (points[index].x - points[index - 1].x) * t,
    y: points[index - 1].y + (points[index].y - points[index - 1].y) * t,
  };
}

export function resamplePolyline(
  points: Point[],
  targetCount: number
): Point[] {
  if (points.length < 2 || targetCount < 2) {
    return points.map((point) => ({ ...point }));
  }
  const cumulative = cumulativeSegmentLengths(points);
  const totalLength = cumulative[cumulative.length - 1];
  const resampled: Point[] = [];
  for (let i = 0; i < targetCount; i++) {
    if (i === 0) {
      resampled.push({ ...points[0] });
    } else if (i === targetCount - 1) {
      resampled.push({ ...points[points.length - 1] });
    } else {
      resampled.push(
        pointAtDistance(
          points,
          cumulative,
          (i / (targetCount - 1)) * totalLength
        )
      );
    }
  }
  return resampled;
}

export function demoFailScore(): number {
  return outlineMatchScore({
    hiddenShape: TIGHT_CONTOUR_POINTS,
    guessShape: FAILING_LINE_POINTS,
    imageWidth: DEMO_IMAGE_SIZE_PX,
    imageHeight: DEMO_IMAGE_SIZE_PX,
  });
}
