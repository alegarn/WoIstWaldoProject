// Demo data traces the barn element (red gambrel roof, center-right) of
// assets/tutorial/farm_pict_hide_320.jpg; bad lines are sloppy user rings
// around the same barn.
import type { Point } from './shapeGeometry';
import { outlineMatchScore } from './shapeMatch';

export const DEMO_IMAGE_SIZE_PX = 320;

export const TIGHT_CONTOUR_POINTS: Point[] = [
  { x: 0.549, y: 0.503 },
  { x: 0.561, y: 0.495 },
  { x: 0.574, y: 0.49 },
  { x: 0.586, y: 0.489 },
  { x: 0.597, y: 0.493 },
  { x: 0.654, y: 0.547 },
  { x: 0.69, y: 0.578 },
  { x: 0.708, y: 0.598 },
  { x: 0.718, y: 0.606 },
  { x: 0.724, y: 0.616 },
  { x: 0.722, y: 0.68 },
  { x: 0.722, y: 0.741 },
  { x: 0.718, y: 0.759 },
  { x: 0.708, y: 0.774 },
  { x: 0.693, y: 0.784 },
  { x: 0.675, y: 0.788 },
  { x: 0.63, y: 0.789 },
  { x: 0.575, y: 0.79 },
  { x: 0.52, y: 0.789 },
  { x: 0.483, y: 0.788 },
  { x: 0.465, y: 0.784 },
  { x: 0.45, y: 0.774 },
  { x: 0.44, y: 0.759 },
  { x: 0.436, y: 0.741 },
  { x: 0.436, y: 0.68 },
  { x: 0.436, y: 0.614 },
  { x: 0.433, y: 0.604 },
  { x: 0.507, y: 0.547 },
  { x: 0.525, y: 0.526 },
  { x: 0.549, y: 0.503 },
];

export const LOOSE_CIRCLE_POINTS: Point[] = [
  { x: 0.566, y: 0.408 },
  { x: 0.644, y: 0.419 },
  { x: 0.714, y: 0.455 },
  { x: 0.772, y: 0.522 },
  { x: 0.793, y: 0.604 },
  { x: 0.78, y: 0.688 },
  { x: 0.738, y: 0.762 },
  { x: 0.671, y: 0.816 },
  { x: 0.588, y: 0.843 },
  { x: 0.503, y: 0.847 },
  { x: 0.418, y: 0.828 },
  { x: 0.345, y: 0.779 },
  { x: 0.369, y: 0.694 },
  { x: 0.378, y: 0.606 },
  { x: 0.389, y: 0.518 },
  { x: 0.404, y: 0.465 },
  { x: 0.462, y: 0.428 },
  { x: 0.566, y: 0.408 },
];

export const FAILING_LINE_POINTS: Point[] = [
  { x: 0.8, y: 0.656 },
  { x: 0.777, y: 0.733 },
  { x: 0.718, y: 0.788 },
  { x: 0.65, y: 0.824 },
  { x: 0.574, y: 0.811 },
  { x: 0.501, y: 0.825 },
  { x: 0.425, y: 0.805 },
  { x: 0.37, y: 0.747 },
  { x: 0.331, y: 0.676 },
  { x: 0.364, y: 0.599 },
  { x: 0.386, y: 0.534 },
  { x: 0.419, y: 0.47 },
  { x: 0.48, y: 0.426 },
  { x: 0.553, y: 0.381 },
  { x: 0.632, y: 0.415 },
  { x: 0.691, y: 0.464 },
  { x: 0.74, y: 0.516 },
  { x: 0.76, y: 0.583 },
  { x: 0.8, y: 0.656 },
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
