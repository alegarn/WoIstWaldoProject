import {
  SIMPLIFY_EPSILON_RATIO,
  MAX_OUTLINE_VERTICES,
  simplifyOutline,
  normalizeOutline,
  isDrawableOutline,
  roundTo3Decimals,
  outlineLengthInImageSpace,
  corridorBandWidthPx,
  clampToImage,
} from '../utils/shapeGeometry';

describe('shapeGeometry', () => {
  describe('constants', () => {
    it('exports the spec values', () => {
      expect(SIMPLIFY_EPSILON_RATIO).toBe(0.01);
      expect(MAX_OUTLINE_VERTICES).toBe(100);
    });
  });

  describe('simplifyOutline', () => {
    it('keeps the corners of an L shape and auto-closes by appending the start vertex', () => {
      const outline = simplifyOutline(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 },
          { x: 50, y: 50 },
        ],
        100,
        100
      );

      expect(outline).toEqual([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 50 },
        { x: 0, y: 0 },
      ]);
    });

    it('drops near-collinear points below the epsilon and still closes the outline', () => {
      const outline = simplifyOutline(
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 0 },
        ],
        100,
        100
      );

      expect(outline).toEqual([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 0 },
      ]);
      expect(isDrawableOutline(outline)).toBe(false);
    });

    it('enforces the vertex cap on a dense zigzag', () => {
      const zigzag = Array.from({ length: 300 }, (_, i) => ({
        x: i * 3,
        y: i % 2 === 0 ? 100 : 900,
      }));

      const outline = simplifyOutline(zigzag, 1000, 1000);

      expect(outline.length).toBeLessThanOrEqual(MAX_OUTLINE_VERTICES);
    });

    it('always closes the outline on the start vertex', () => {
      const outline = simplifyOutline(
        [
          { x: 10, y: 10 },
          { x: 90, y: 10 },
          { x: 50, y: 80 },
        ],
        100,
        100
      );

      expect(outline[outline.length - 1]).toEqual(outline[0]);
    });
  });

  describe('normalizeOutline', () => {
    it('divides each axis by the image dimensions', () => {
      expect(
        normalizeOutline(
          [
            { x: 0, y: 0 },
            { x: 200, y: 100 },
            { x: 50, y: 25 },
          ],
          200,
          100
        )
      ).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 0.25, y: 0.25 },
      ]);
    });

    it('rounds output to 3 decimals', () => {
      expect(
        normalizeOutline([{ x: 33.333, y: 66.666 }], 200, 100)
      ).toEqual([{ x: 0.167, y: 0.667 }]);
    });
  });

  describe('storage pipeline simplify -> normalize', () => {
    it('produces normalized 3-decimal closed outlines within [0,1]', () => {
      const outline = normalizeOutline(
        simplifyOutline(
          [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 50 },
            { x: 50, y: 50 },
          ],
          200,
          100
        ),
        200,
        100
      );

      expect(outline[0]).toEqual(outline[outline.length - 1]);
      for (const vertex of outline) {
        expect(vertex.x).toBeGreaterThanOrEqual(0);
        expect(vertex.x).toBeLessThanOrEqual(1);
        expect(vertex.y).toBeGreaterThanOrEqual(0);
        expect(vertex.y).toBeLessThanOrEqual(1);
        expect(vertex.x * 1000).toBeCloseTo(Math.round(vertex.x * 1000), 6);
        expect(vertex.y * 1000).toBeCloseTo(Math.round(vertex.y * 1000), 6);
      }
      expect(outline).toEqual([
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 0.25, y: 0.5 },
        { x: 0, y: 0 },
      ]);
    });
  });

  describe('isDrawableOutline', () => {
    it('rejects fewer than 3 raw points', () => {
      expect(isDrawableOutline([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
    });

    it('rejects a straight-line scribble that collapses to two distinct vertices', () => {
      const collapsed = simplifyOutline(
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 0 },
        ],
        100,
        100
      );

      expect(isDrawableOutline(collapsed)).toBe(false);
    });

    it('accepts an outline with at least 3 distinct closed vertices', () => {
      const drawable = simplifyOutline(
        [
          { x: 10, y: 10 },
          { x: 90, y: 10 },
          { x: 50, y: 80 },
        ],
        100,
        100
      );

      expect(isDrawableOutline(drawable)).toBe(true);
    });
  });

  describe('roundTo3Decimals', () => {
    it.each([
      [0.123456, 0.123],
      [0.1235, 0.124],
      [1, 1],
      [0, 0],
    ])('rounds %p to %p', (value, expected) => {
      expect(roundTo3Decimals(value)).toBe(expected);
    });
  });

  describe('outlineLengthInImageSpace', () => {
    it('sums per-axis rescaled segments of a closed square (auto-close not double-counted)', () => {
      expect(
        outlineLengthInImageSpace(
          [
            { x: 0.1, y: 0.1 },
            { x: 0.6, y: 0.1 },
            { x: 0.6, y: 0.6 },
            { x: 0.1, y: 0.6 },
            { x: 0.1, y: 0.1 },
          ],
          2000,
          1000
        )
      ).toBe(3000);
    });

    it('adds the auto-close segment for an unclosed outline', () => {
      expect(
        outlineLengthInImageSpace(
          [
            { x: 0.1, y: 0.1 },
            { x: 0.6, y: 0.1 },
            { x: 0.6, y: 0.6 },
            { x: 0.1, y: 0.6 },
          ],
          2000,
          1000
        )
      ).toBe(3000);
      expect(
        outlineLengthInImageSpace(
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
          ],
          100,
          100
        )
      ).toBe(341.421);
    });

    it('rescales per axis in a very wide image (2000×500 distortion fixed)', () => {
      const length = outlineLengthInImageSpace(
        [
          { x: 0.3, y: 0.3 },
          { x: 0.7, y: 0.3 },
          { x: 0.7, y: 0.7 },
          { x: 0.3, y: 0.7 },
          { x: 0.3, y: 0.3 },
        ],
        2000,
        500
      );

      expect(length).toBe(2000);
      expect(length).not.toBeCloseTo(2262.742, 2);
    });

    it('rounds the result to 3 decimals (pipeline parity)', () => {
      expect(
        outlineLengthInImageSpace(
          [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          100,
          100
        )
      ).toBe(282.843);
    });

    it('sums segments before rounding (no per-segment rounding drift)', () => {
      expect(
        outlineLengthInImageSpace(
          [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          100,
          100
        )
      ).toBe(282.843);
    });
  });

  describe('corridorBandWidthPx', () => {
    it('scales the tolerance circle from image space onto the rendered style width', () => {
      expect(
        corridorBandWidthPx(
          { imageWidth: 1000, imageHeight: 1000 },
          500,
          undefined,
          0.05
        )
      ).toBe(50);
    });

    it('falls back to the style dims symmetrically when image dims are missing (landscape style)', () => {
      expect(corridorBandWidthPx({}, 320, 240, 0.05)).toBe(
        2 * 0.05 * Math.min(320, 240)
      );
    });

    it('falls back to the style dims symmetrically when image dims are missing (portrait style)', () => {
      expect(corridorBandWidthPx({}, 240, 320, 0.05)).toBe(
        2 * 0.05 * Math.min(240, 320)
      );
    });
  });

  describe('clampToImage', () => {
    it('clamps low values to 0 on both axes', () => {
      expect(clampToImage({ x: -5, y: -1 }, 100, 100)).toEqual({
        x: 0,
        y: 0,
      });
    });

    it('clamps high values to the image bounds on both axes', () => {
      expect(clampToImage({ x: 150, y: 200 }, 100, 80)).toEqual({
        x: 100,
        y: 80,
      });
    });

    it('clamps per axis without touching the other axis', () => {
      expect(clampToImage({ x: -5, y: 200 }, 100, 80)).toEqual({
        x: 0,
        y: 80,
      });
    });

    it('passes through in-range points', () => {
      expect(clampToImage({ x: 42, y: 17 }, 100, 80)).toEqual({
        x: 42,
        y: 17,
      });
    });
  });
});
