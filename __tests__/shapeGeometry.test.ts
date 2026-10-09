import {
  SIMPLIFY_EPSILON_RATIO,
  MAX_OUTLINE_VERTICES,
  simplifyOutline,
  normalizeOutline,
  isDrawableOutline,
  roundTo3Decimals,
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
});
