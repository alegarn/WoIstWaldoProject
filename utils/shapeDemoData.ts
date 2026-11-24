// Demo data traces the barn element (red gambrel roof, center-right) of
// assets/tutorial/farm_pict_hide_320.jpg. The hide→guess teaching loop pairs a
// loose hiding ring with three guesser attempts: two sloppy rings (both fail),
// the exact barn trace (still fails — loose hides are unfair to guess), and an
// almost-perfect follower that wins once the barn is hidden tightly.
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

// Sloppy guess rings: wobbly circles that only partially follow the loose
// hiding ring, so both fail honestly (A ≈ 0.38, B ≈ 0.2 over 320×320).
export const SLOPPY_GUESS_A_POINTS: Point[] = [
  { x: 0.859, y: 0.56 },
  { x: 0.835, y: 0.698 },
  { x: 0.713, y: 0.763 },
  { x: 0.589, y: 0.774 },
  { x: 0.47, y: 0.733 },
  { x: 0.424, y: 0.617 },
  { x: 0.436, y: 0.506 },
  { x: 0.488, y: 0.407 },
  { x: 0.589, y: 0.346 },
  { x: 0.713, y: 0.356 },
  { x: 0.804, y: 0.442 },
  { x: 0.859, y: 0.56 },
];

export const SLOPPY_GUESS_B_POINTS: Point[] = [
  { x: 0.852, y: 0.51 },
  { x: 0.774, y: 0.606 },
  { x: 0.688, y: 0.67 },
  { x: 0.586, y: 0.639 },
  { x: 0.511, y: 0.564 },
  { x: 0.49, y: 0.448 },
  { x: 0.573, y: 0.359 },
  { x: 0.696, y: 0.307 },
  { x: 0.791, y: 0.4 },
  { x: 0.852, y: 0.51 },
];

// The follower's almost-barn trace: every TIGHT vertex nudged by a smooth
// deterministic wobble (≤0.012 normalized, precomputed literal for stable
// pins) — close enough to win (score ≈ 1.0, within the length cap).
export const ALMOST_BARN_GUESS_POINTS: Point[] = [
  { x: 0.546, y: 0.505 },
  { x: 0.555, y: 0.499 },
  { x: 0.566, y: 0.496 },
  { x: 0.579, y: 0.496 },
  { x: 0.592, y: 0.501 },
  { x: 0.654, y: 0.555 },
  { x: 0.694, y: 0.585 },
  { x: 0.715, y: 0.604 },
  { x: 0.726, y: 0.61 },
  { x: 0.731, y: 0.618 },
  { x: 0.726, y: 0.68 },
  { x: 0.721, y: 0.738 },
  { x: 0.713, y: 0.754 },
  { x: 0.701, y: 0.767 },
  { x: 0.685, y: 0.776 },
  { x: 0.669, y: 0.78 },
  { x: 0.628, y: 0.781 },
  { x: 0.577, y: 0.783 },
  { x: 0.526, y: 0.784 },
  { x: 0.491, y: 0.785 },
  { x: 0.473, y: 0.783 },
  { x: 0.455, y: 0.776 },
  { x: 0.441, y: 0.763 },
  { x: 0.433, y: 0.747 },
  { x: 0.429, y: 0.687 },
  { x: 0.428, y: 0.622 },
  { x: 0.426, y: 0.612 },
  { x: 0.503, y: 0.554 },
  { x: 0.546, y: 0.505 },
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

export function looseHideVsSloppyGuessScores(): { a: number; b: number } {
  return {
    a: outlineMatchScore({
      hiddenShape: LOOSE_CIRCLE_POINTS,
      guessShape: SLOPPY_GUESS_A_POINTS,
      imageWidth: DEMO_IMAGE_SIZE_PX,
      imageHeight: DEMO_IMAGE_SIZE_PX,
    }),
    b: outlineMatchScore({
      hiddenShape: LOOSE_CIRCLE_POINTS,
      guessShape: SLOPPY_GUESS_B_POINTS,
      imageWidth: DEMO_IMAGE_SIZE_PX,
      imageHeight: DEMO_IMAGE_SIZE_PX,
    }),
  };
}

export function looseHideVsExactGuessScore(): number {
  return outlineMatchScore({
    hiddenShape: LOOSE_CIRCLE_POINTS,
    guessShape: TIGHT_CONTOUR_POINTS,
    imageWidth: DEMO_IMAGE_SIZE_PX,
    imageHeight: DEMO_IMAGE_SIZE_PX,
  });
}

export function goodHideVsAlmostGuessScore(): number {
  return outlineMatchScore({
    hiddenShape: TIGHT_CONTOUR_POINTS,
    guessShape: ALMOST_BARN_GUESS_POINTS,
    imageWidth: DEMO_IMAGE_SIZE_PX,
    imageHeight: DEMO_IMAGE_SIZE_PX,
  });
}
