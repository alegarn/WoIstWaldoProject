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
