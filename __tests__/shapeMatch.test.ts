import {
  SHAPE_TOLERANCE_RATIO,
  outlineMatch,
  distancePointToSegment,
} from '../utils/shapeMatch';

const IMAGE = { width: 100, height: 100 };
const SCREEN = { width: 400, height: 800 };

function closedSquare(min: number, max: number) {
  return [
    { x: min, y: min },
    { x: max, y: min },
    { x: max, y: max },
    { x: min, y: max },
    { x: min, y: min },
  ];
}

describe('shapeMatch', () => {
  describe('constants', () => {
    it('exports the spec tolerance ratio', () => {
      expect(SHAPE_TOLERANCE_RATIO).toBe(0.05);
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

  describe('outlineMatch', () => {
    it('matches an identical outline', () => {
      const square = closedSquare(0.3, 0.7);

      expect(
        outlineMatch({
          hiddenShape: square,
          guessShape: closedSquare(0.3, 0.7),
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
          screenWidth: SCREEN.width,
          screenHeight: SCREEN.height,
        })
      ).toBe(true);
    });

    it('matches a guess offset within the tolerance corridor', () => {
      expect(
        outlineMatch({
          hiddenShape: closedSquare(0.3, 0.7),
          guessShape: closedSquare(0.35, 0.75),
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
          screenWidth: SCREEN.width,
          screenHeight: SCREEN.height,
        })
      ).toBe(true);
    });

    it('rejects a disjoint outline', () => {
      expect(
        outlineMatch({
          hiddenShape: closedSquare(0.3, 0.7),
          guessShape: closedSquare(0.05, 0.2),
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
          screenWidth: SCREEN.width,
          screenHeight: SCREEN.height,
        })
      ).toBe(false);
    });

    it('rejects a tiny guess scribble inside the hidden loop (hidden-to-guess direction fails)', () => {
      expect(
        outlineMatch({
          hiddenShape: closedSquare(0.3, 0.7),
          guessShape: closedSquare(0.45, 0.55),
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
          screenWidth: SCREEN.width,
          screenHeight: SCREEN.height,
        })
      ).toBe(false);
    });

    it('rejects a huge guess loop around the hidden outline (guess-to-hidden direction fails)', () => {
      expect(
        outlineMatch({
          hiddenShape: closedSquare(0.3, 0.7),
          guessShape: closedSquare(0.1, 0.9),
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
          screenWidth: SCREEN.width,
          screenHeight: SCREEN.height,
        })
      ).toBe(false);
    });

    it('samples segment bodies, not just vertices (mid-stroke divergence rejected)', () => {
      const hiddenSegment = [
        { x: 0.3, y: 0.5 },
        { x: 0.7, y: 0.5 },
      ];

      expect(
        outlineMatch({
          hiddenShape: hiddenSegment,
          guessShape: [
            { x: 0.3, y: 0.5 },
            { x: 0.5, y: 0.75 },
            { x: 0.7, y: 0.5 },
          ],
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
          screenWidth: SCREEN.width,
          screenHeight: SCREEN.height,
        })
      ).toBe(false);
    });

    it('accepts a mid-stroke bow within the tolerance', () => {
      expect(
        outlineMatch({
          hiddenShape: [
            { x: 0.3, y: 0.5 },
            { x: 0.7, y: 0.5 },
          ],
          guessShape: [
            { x: 0.3, y: 0.5 },
            { x: 0.5, y: 0.62 },
            { x: 0.7, y: 0.5 },
          ],
          imageWidth: IMAGE.width,
          imageHeight: IMAGE.height,
          screenWidth: SCREEN.width,
          screenHeight: SCREEN.height,
        })
      ).toBe(true);
    });

    it('converts per-axis through a non-square rendered image rect', () => {
      expect(
        outlineMatch({
          hiddenShape: closedSquare(0.375, 0.625),
          guessShape: closedSquare(0.425, 0.675),
          imageWidth: 200,
          imageHeight: 100,
          screenWidth: 400,
          screenHeight: 400,
        })
      ).toBe(true);
    });
  });
});
