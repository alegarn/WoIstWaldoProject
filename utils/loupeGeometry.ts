import type { Point } from './shapeGeometry';

export type { Point };

export const LOUPE_ZOOM = 2.5;
export const LOUPE_DIAMETER_PX = 120;
export const LOUPE_LIFT_PX = 64;
export const MIN_STROKE_STEP_PX = 4;
export const LOUPE_LONG_PRESS_MS = 200;
export const LOUPE_CURSOR_SIZE_PX = 12;
export const LOUPE_MIRROR_STEP_PX = 12;

interface LoupeLayoutParams {
  anchor: Point;
  screen: { width: number; height: number };
  diameter?: number;
  lift?: number;
}

interface LoupeContentTransformParams {
  anchor: Point;
  zoom?: number;
  diameter?: number;
}

/**
 * Positions the loupe circle for an anchor point.
 *
 * `anchor` is in CONTAINER space (the loupe host's measured root container) and
 * `screen` holds the same container's dimensions — conversion from image
 * pixels happens in the host hook (`useLoupe.report`), never here.
 *
 * The circle sits ABOVE the anchor by `lift` px by default; the centre is
 * clamped so the circle stays fully inside the container on all four edges.
 *
 * NOTE: when a host falls back to unmeasured dimensions, the "screen" is the
 * image box rather than the real container — a benign pre-measure state, since
 * the layout is recomputed on every reported move once real dims arrive.
 */
export function loupeLayout(params: LoupeLayoutParams): {
  left: number;
  top: number;
} {
  const { anchor, screen } = params;
  const diameter = params.diameter ?? LOUPE_DIAMETER_PX;
  const lift = params.lift ?? LOUPE_LIFT_PX;
  const radius = diameter / 2;

  const desiredX = anchor.x;
  const desiredY = anchor.y - lift;

  const centerX = Math.min(Math.max(desiredX, radius), screen.width - radius);
  const centerY = Math.min(Math.max(desiredY, radius), screen.height - radius);

  return {
    left: centerX - radius,
    top: centerY - radius,
  };
}

/**
 * Content translation so a child drawn at `anchor` in IMAGE-space px (inside
 * the zoom-scaled wrapper) lands exactly at the loupe glass centre.
 */
export function loupeContentTransform(params: LoupeContentTransformParams): {
  translateX: number;
  translateY: number;
} {
  const zoom = params.zoom ?? LOUPE_ZOOM;
  const diameter = params.diameter ?? LOUPE_DIAMETER_PX;
  const centre = diameter / 2;

  return {
    translateX: centre - params.anchor.x * zoom,
    translateY: centre - params.anchor.y * zoom,
  };
}
