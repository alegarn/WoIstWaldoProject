import {
  SHAPE_TOLERANCE_RATIO,
  MAX_LENGTH_RATIO,
  MATCH_THRESHOLD_RATIO,
  outlineMatchScore,
  isWinningTrace,
  shapeTolerancePx,
  distancePointToSegment,
} from '../utils/shapeMatch';

const IMAGE = { width: 100, height: 100 };

function closedSquare(min: number, max: number) {
  return [
    { x: min, y: min },
    { x: max, y: min },
    { x: max, y: max },
    { x: min, y: max },
    { x: min, y: min },
  ];
}

function closedRect(minX: number, maxX: number, minY: number, maxY: number) {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: minY },
  ];
}

function squareWithSawtoothTop(amplitude: number) {
  const vertices = [
    { x: 0.4, y: 0.6 },
    { x: 0.6, y: 0.6 },
    { x: 0.6, y: 0.4 },
  ];
  for (let i = 1; i < 16; i++) {
    vertices.push({
      x: 0.6 - (i * 125) / 10000,
      y: i % 2 === 1 ? 0.4 - amplitude : 0.4,
    });
  }
  vertices.push({ x: 0.4, y: 0.4 });
  vertices.push({ x: 0.4, y: 0.6 });
  return vertices;
}

describe('shapeMatch', () => {
  describe('constants', () => {
    it('exports the spec tolerance ratio', () => {
      expect(SHAPE_TOLERANCE_RATIO).toBe(0.05);
    });

    it('exports MAX_LENGTH_RATIO = 1.4 and MATCH_THRESHOLD_RATIO = 0.9', () => {
      expect(MAX_LENGTH_RATIO).toBe(1.4);
      expect(MATCH_THRESHOLD_RATIO).toBe(0.9);
    });
  });

  describe('shapeTolerancePx', () => {
    it('scales the tolerance ratio by the smaller image dimension', () => {
      expect(shapeTolerancePx(1000, 1000)).toBe(50);
    });

    it('uses the min axis on aspect-skewed images', () => {
      expect(shapeTolerancePx(2000, 500)).toBe(25);
    });

    it('guards non-positive dimensions with 0 (mirrors the scoring guards)', () => {
      expect(shapeTolerancePx(0, 1000)).toBe(0);
      expect(shapeTolerancePx(1000, 0)).toBe(0);
      expect(shapeTolerancePx(-5, 500)).toBe(0);
    });
  });

  describe('distancePointToSegment', () => {
    it('measures the perpendicular distance inside the segment', () => {
      expect(distancePointToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    });

    it('clamps to the closest endpoint beyond the segment', () => {
      expect(distancePointToSegment({ x: 15, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    });

    it('measures endpoint distance for a degenerate segment', () => {
      expect(distancePointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
    });
  });

  describe('outlineMatchScore', () => {
    it('returns 1.0 for identical outlines', () => {
      expect(
        outlineMatchScore({
          hiddenShape: closedSquare(0.3, 0.7),
          guessShape: closedSquare(0.3, 0.7),
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
        })
      ).toBe(1);
    });

    it('scores a partially drifted trace strictly between 0.9 and 1', () => {
      expect(
        outlineMatchScore({
          hiddenShape: closedSquare(0.3, 0.7),
          guessShape: [
            { x: 0.3, y: 0.3 },
            { x: 0.77, y: 0.3 },
            { x: 0.7, y: 0.23 },
            { x: 0.7, y: 0.7 },
            { x: 0.3, y: 0.7 },
            { x: 0.3, y: 0.3 },
          ],
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
        })
      ).toBeGreaterThan(0.9);
      expect(
        outlineMatchScore({
          hiddenShape: closedSquare(0.3, 0.7),
          guessShape: [
            { x: 0.3, y: 0.3 },
            { x: 0.77, y: 0.3 },
            { x: 0.7, y: 0.23 },
            { x: 0.7, y: 0.7 },
            { x: 0.3, y: 0.7 },
            { x: 0.3, y: 0.3 },
          ],
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
        })
      ).toBeLessThan(1);
    });

    it('scores a disjoint outline near 0', () => {
      expect(
        outlineMatchScore({
          hiddenShape: closedSquare(0.3, 0.7),
          guessShape: closedRect(0.05, 0.2, 0.1, 0.2),
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
        })
      ).toBeLessThan(0.1);
    });

    it('uses the min of the two directions (asymmetric case)', () => {
      expect(
        outlineMatchScore({
          hiddenShape: closedSquare(0.3, 0.7),
          guessShape: [
            { x: 0.3, y: 0.3 },
            { x: 0.7, y: 0.3 },
            { x: 0.7, y: 0.5 },
            { x: 0.95, y: 0.5 },
            { x: 0.7, y: 0.5 },
            { x: 0.7, y: 0.7 },
            { x: 0.3, y: 0.7 },
            { x: 0.3, y: 0.3 },
          ],
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
        })
      ).toBeLessThan(1);
    });
  });

  describe('isWinningTrace', () => {
    const WIN_IMAGE = { width: 10000, height: 10000 };

    it('wins when score meets the threshold and length is within the cap', () => {
      expect(
        isWinningTrace({
          hiddenShape: closedSquare(0.4, 0.6),
          guessShape: closedSquare(0.4, 0.6),
          imageWidth: WIN_IMAGE.width,
          imageHeight: WIN_IMAGE.height,
        })
      ).toBe(true);
    });

    it('wins with a small-amplitude wiggle below the cap', () => {
      expect(
        isWinningTrace({
          hiddenShape: closedSquare(0.4, 0.6),
          guessShape: squareWithSawtoothTop(0.029),
          imageWidth: WIN_IMAGE.width,
          imageHeight: WIN_IMAGE.height,
        })
      ).toBe(true);
    });

    it('passes at exactly 1.4× the hidden length (boundary inclusive)', () => {
      expect(
        isWinningTrace({
          hiddenShape: closedSquare(0.4, 0.6),
          guessShape: squareWithSawtoothTop(0.03),
          imageWidth: WIN_IMAGE.width,
          imageHeight: WIN_IMAGE.height,
        })
      ).toBe(true);
    });

    it('loses when the length cap fails even with a perfect score', () => {
      expect(
        isWinningTrace({
          hiddenShape: closedSquare(0.4, 0.6),
          guessShape: squareWithSawtoothTop(0.031),
          imageWidth: WIN_IMAGE.width,
          imageHeight: WIN_IMAGE.height,
        })
      ).toBe(false);
    });

    it('loses when score is below the threshold even with length within the cap', () => {
      expect(
        isWinningTrace({
          hiddenShape: closedSquare(0.4, 0.6),
          guessShape: closedRect(0.05, 0.2, 0.1, 0.2),
          imageWidth: WIN_IMAGE.width,
          imageHeight: WIN_IMAGE.height,
        })
      ).toBe(false);
    });

    it('rejects a self-intersecting blanket scribble via the cap', () => {
      const once = closedSquare(0.4, 0.6);
      expect(
        isWinningTrace({
          hiddenShape: once,
          guessShape: [...once.slice(0, 4), ...once],
          imageWidth: WIN_IMAGE.width,
          imageHeight: WIN_IMAGE.height,
        })
      ).toBe(false);
    });
  });

  describe('device invariance', () => {
    // Plan-mandated note: the new API has NO screenWidth/screenHeight params —
    // that absence IS the invariance guarantee (type-level): no call site can
    // leak screen geometry into the score or verdict.
    it('produces the same score and verdict at two image sizes with equal aspect', () => {
      const square = closedSquare(0.3, 0.7);
      const params = {
        hiddenShape: square,
        guessShape: closedSquare(0.3, 0.7),
      };
      const largeScore = outlineMatchScore({
        ...params,
        imageWidth: 10000,
        imageHeight: 10000,
      });
      const smallScore = outlineMatchScore({
        ...params,
        imageWidth: 400,
        imageHeight: 400,
      });

      expect(largeScore).toBe(smallScore);
      expect(
        isWinningTrace({ ...params, imageWidth: 10000, imageHeight: 10000 })
      ).toBe(
        isWinningTrace({ ...params, imageWidth: 400, imageHeight: 400 })
      );
    });
  });

  describe('zero and degenerate guards', () => {
    it('returns a defined losing verdict for an empty hidden outline', () => {
      const params = {
        hiddenShape: [],
        guessShape: closedSquare(0.3, 0.7),
        imageWidth: IMAGE.width,
        imageHeight: IMAGE.height,
      };

      expect(outlineMatchScore(params)).toBe(0);
      expect(isWinningTrace(params)).toBe(false);
    });

    it('returns finite values for a zero-length hidden outline', () => {
      const params = {
        hiddenShape: [
          { x: 0.5, y: 0.5 },
          { x: 0.5, y: 0.5 },
        ],
        guessShape: closedSquare(0.3, 0.7),
        imageWidth: IMAGE.width,
        imageHeight: IMAGE.height,
      };

      expect(Number.isFinite(outlineMatchScore(params))).toBe(true);
      expect(isWinningTrace(params)).toBe(false);
    });

    it('guards non-positive image dimensions', () => {
      const params = {
        hiddenShape: closedSquare(0.3, 0.7),
        guessShape: closedSquare(0.3, 0.7),
        imageWidth: 0,
        imageHeight: 0,
      };

      expect(outlineMatchScore(params)).toBe(0);
      expect(isWinningTrace(params)).toBe(false);
    });
  });
});
