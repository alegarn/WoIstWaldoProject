import {
  LOUPE_ZOOM,
  LOUPE_DIAMETER_PX,
  LOUPE_LIFT_PX,
  MIN_STROKE_STEP_PX,
  LOUPE_LONG_PRESS_MS,
  LOUPE_CURSOR_SIZE_PX,
  LOUPE_MIRROR_STEP_PX,
  loupeLayout,
  loupeContentTransform,
} from '../utils/loupeGeometry';

describe('loupeGeometry', () => {
  describe('constants', () => {
    it('exports the spec values', () => {
      expect(LOUPE_ZOOM).toBe(2.5);
      expect(LOUPE_DIAMETER_PX).toBe(120);
      expect(LOUPE_LIFT_PX).toBe(64);
      expect(MIN_STROKE_STEP_PX).toBe(4);
      expect(LOUPE_LONG_PRESS_MS).toBe(200);
      expect(LOUPE_CURSOR_SIZE_PX).toBe(12);
      expect(LOUPE_MIRROR_STEP_PX).toBe(12);
    });
  });

  describe('loupeLayout', () => {
    it('positions the circle centred above the anchor and returns a diameter-sized rect', () => {
      const layout = loupeLayout({
        anchor: { x: 160, y: 300 },
        screen: { width: 360, height: 800 },
      });

      const centre = { x: 160, y: 300 - LOUPE_LIFT_PX };
      const radius = LOUPE_DIAMETER_PX / 2;
      expect(layout.left).toBe(centre.x - radius);
      expect(layout.top).toBe(centre.y - radius);
      expect(layout.left + LOUPE_DIAMETER_PX).toBe(centre.x + radius);
      expect(layout.top + LOUPE_DIAMETER_PX).toBe(centre.y + radius);
    });

    it('clamps the top edge to 0 so the circle never goes negative', () => {
      const layout = loupeLayout({
        anchor: { x: 160, y: 20 },
        screen: { width: 360, height: 800 },
      });

      expect(layout.top).toBe(0);
    });

    it('keeps the rect fully inside the screen for anchors across the whole screen', () => {
      const width = 360;
      const height = 800;
      const xs = [0, 1, 2, 3, 4].map((i) => 10 + (i * (width - 20)) / 4);
      const ys = [0, 1, 2, 3, 4].map((i) => 10 + (i * (height - 20)) / 4);

      for (const x of xs) {
        for (const y of ys) {
          const layout = loupeLayout({
            anchor: { x, y },
            screen: { width, height },
          });

          expect(layout.left).toBeGreaterThanOrEqual(0);
          expect(layout.top).toBeGreaterThanOrEqual(0);
          expect(layout.left + LOUPE_DIAMETER_PX).toBeLessThanOrEqual(width);
          expect(layout.top + LOUPE_DIAMETER_PX).toBeLessThanOrEqual(height);
        }
      }
    });
  });

  describe('loupeContentTransform', () => {
    it('translates so a child at the image-space anchor lands at the loupe centre', () => {
      const transform = loupeContentTransform({
        anchor: { x: 100, y: 200 },
        zoom: 2.5,
        diameter: 120,
      });

      expect(transform.translateX).toBe(60 - 100 * 2.5);
      expect(transform.translateY).toBe(60 - 200 * 2.5);
    });
  });
});
