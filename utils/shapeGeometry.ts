export interface Point {
  x: number;
  y: number;
}

export const SIMPLIFY_EPSILON_RATIO = 0.01;
export const MAX_OUTLINE_VERTICES = 100;

export function roundTo3Decimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function perpendicularDistance(point: Point, start: Point, end: Point): number {
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

function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) {
    return points.slice();
  }
  const first = points[0];
  const last = points[points.length - 1];
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function closeOutline(points: Point[]): Point[] {
  if (points.length === 0) {
    return points;
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (first.x === last.x && first.y === last.y) {
    return points;
  }
  return [...points, { ...first }];
}

export function simplifyOutline(
  rawPoints: Point[],
  imageWidth: number,
  imageHeight: number
): Point[] {
  if (rawPoints.length === 0) {
    return [];
  }
  const pixelPoints = rawPoints.map((point) => ({ ...point }));
  let epsilon = SIMPLIFY_EPSILON_RATIO * Math.min(imageWidth, imageHeight);
  let simplified = douglasPeucker(pixelPoints, epsilon);
  while (simplified.length > MAX_OUTLINE_VERTICES - 1) {
    epsilon *= 2;
    simplified = douglasPeucker(pixelPoints, epsilon);
  }
  return closeOutline(simplified);
}

export function normalizeOutline(
  points: Point[],
  imageWidth: number,
  imageHeight: number
): Point[] {
  return points.map((point) => ({
    x: roundTo3Decimals(point.x / imageWidth),
    y: roundTo3Decimals(point.y / imageHeight),
  }));
}

export function outlineLengthInImageSpace(
  normalized: Point[],
  imageWidth: number,
  imageHeight: number
): number {
  let total = 0;
  for (let i = 0; i < normalized.length - 1; i++) {
    total += Math.hypot(
      (normalized[i + 1].x - normalized[i].x) * imageWidth,
      (normalized[i + 1].y - normalized[i].y) * imageHeight
    );
  }
  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  if (normalized.length > 0 && (first.x !== last.x || first.y !== last.y)) {
    total += Math.hypot(
      (first.x - last.x) * imageWidth,
      (first.y - last.y) * imageHeight
    );
  }
  return roundTo3Decimals(total);
}

export function corridorBandWidthPx(
  dims: { imageWidth?: number; imageHeight?: number },
  styleWidth: number,
  styleHeight: number | undefined,
  toleranceRatio: number
): number {
  const sourceWidth = dims.imageWidth;
  const sourceHeight = dims.imageHeight;
  const hasSourceDims =
    typeof sourceWidth === 'number' &&
    sourceWidth > 0 &&
    typeof sourceHeight === 'number' &&
    sourceHeight > 0;
  const fallbackAxis = Math.min(styleWidth, styleHeight ?? styleWidth);
  return (
    2 *
    toleranceRatio *
    (hasSourceDims ? Math.min(sourceWidth, sourceHeight) : fallbackAxis) *
    (hasSourceDims ? styleWidth / sourceWidth : 1)
  );
}

export function clampToImage(
  point: Point,
  width: number,
  height: number
): Point {
  return {
    x: Math.min(Math.max(point.x, 0), width),
    y: Math.min(Math.max(point.y, 0), height),
  };
}

export function isDrawableOutline(points: Point[]): boolean {
  const distinct: Point[] = [];
  for (const point of points) {
    const previous = distinct[distinct.length - 1];
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      distinct.push(point);
    }
  }
  const last = distinct[distinct.length - 1];
  if (distinct.length > 1 && last.x === distinct[0].x && last.y === distinct[0].y) {
    distinct.pop();
  }
  return distinct.length >= 3;
}

// Miter joins longer than this multiple of the offset distance are clamped,
// so near-reversal spikes (≈180° turns) stay bounded instead of exploding.
const MITER_LIMIT_RATIO = 2;

// Unit-vector side normals: "left" is the traversal-up side (rotate the
// direction +90° in screen coords), "right" its opposite.
function sideNormals(unitX: number, unitY: number): {
  left: Point;
  right: Point;
} {
  return {
    left: { x: unitY, y: -unitX },
    right: { x: -unitY, y: unitX },
  };
}

function offsetBy(point: Point, normal: Point, distance: number): Point {
  return {
    x: point.x + normal.x * distance,
    y: point.y + normal.y * distance,
  };
}

function miterJoin(
  vertex: Point,
  normalIn: { x: number; y: number },
  normalOut: { x: number; y: number },
  distance: number
): Point {
  const limit = MITER_LIMIT_RATIO * distance;
  const sumX = normalIn.x + normalOut.x;
  const sumY = normalIn.y + normalOut.y;
  const sumLength = Math.hypot(sumX, sumY);
  if (sumLength === 0) {
    // Exact reversal: no bisector exists — clamp along the incoming normal.
    return {
      x: vertex.x + normalIn.x * limit,
      y: vertex.y + normalIn.y * limit,
    };
  }
  const cosHalfAngle = Math.sqrt(
    Math.max(
      0,
      (1 + (normalIn.x * normalOut.x + normalIn.y * normalOut.y)) / 2
    )
  );
  const rawLength = cosHalfAngle > 0 ? distance / cosHalfAngle : limit;
  const miterLength = Math.min(rawLength, limit);
  return {
    x: vertex.x + (sumX / sumLength) * miterLength,
    y: vertex.y + (sumY / sumLength) * miterLength,
  };
}

/**
 * Parallel offset curves of an OPEN polyline: `left`/`right` run ±`distance`
 * from the path, named consistently by traversal direction (left = the
 * traversal-up side). Vertices are miter-joined; miters are clamped to
 * 2×distance from the vertex so near-reversal spikes stay finite. Pure math
 * — feeds the loupe's corridor edge lines.
 */
export function offsetPolyline(
  points: Point[],
  distance: number
): { left: Point[]; right: Point[] } {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      segments.push({
        start: points[i],
        end: points[i + 1],
        unitX: dx / length,
        unitY: dy / length,
      });
    }
  }
  if (segments.length === 0) {
    return { left: [], right: [] };
  }

  const left: Point[] = [];
  const right: Point[] = [];

  const first = segments[0];
  const firstNormals = sideNormals(first.unitX, first.unitY);
  left.push(offsetBy(first.start, firstNormals.left, distance));
  right.push(offsetBy(first.start, firstNormals.right, distance));
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const next = segments[i];
    const prevNormals = sideNormals(prev.unitX, prev.unitY);
    const nextNormals = sideNormals(next.unitX, next.unitY);
    left.push(
      miterJoin(next.start, prevNormals.left, nextNormals.left, distance)
    );
    right.push(
      miterJoin(next.start, prevNormals.right, nextNormals.right, distance)
    );
  }
  const last = segments[segments.length - 1];
  const lastNormals = sideNormals(last.unitX, last.unitY);
  left.push(offsetBy(last.end, lastNormals.left, distance));
  right.push(offsetBy(last.end, lastNormals.right, distance));

  return { left, right };
}
