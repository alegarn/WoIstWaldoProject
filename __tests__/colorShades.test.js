import {
  normalizeHex,
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  generateShades,
} from '../utils/colorShades';

describe('colorShades', () => {
  describe('normalizeHex', () => {
    it.each([
      ['#6528F7', '#6528F7'],
      ['6528f7', '#6528F7'],
      ['#6528f7', '#6528F7'],
      ['abc', '#AABBCC'],
      ['#abc', '#AABBCC'],
      ['  #FFCC00  ', '#FFCC00'],
    ])('normalizes %p to %p', (input, expected) => {
      expect(normalizeHex(input)).toBe(expected);
    });

    it('falls back to black for unparseable input', () => {
      expect(normalizeHex('nope')).toBe('#000000');
      expect(normalizeHex(null)).toBe('#000000');
      expect(normalizeHex(undefined)).toBe('#000000');
    });
  });

  describe('rgb / hex round trip', () => {
    it('converts hex to rgb and back', () => {
      expect(hexToRgb('#6528F7')).toEqual({ r: 0x65, g: 0x28, b: 0xF7 });
      expect(rgbToHex(0x65, 0x28, 0xf7)).toBe('#6528F7');
    });

    it('clamps rgb values into range', () => {
      expect(rgbToHex(-10, 300, 128)).toBe('#00FF80');
    });
  });

  describe('hsl / hex round trip', () => {
    it('converts black and white without NaN', () => {
      expect(hslToHex(0, 0, 0)).toBe('#000000');
      expect(hslToHex(0, 0, 1)).toBe('#FFFFFF');
    });

    it('round-trips a saturated color within a small tolerance', () => {
      const [h, s, l] = hexToHsl('#6528F7');
      // Re-quantizing introduces up to ~1/255 per channel error, so allow a
      // tiny lightness drift rather than asserting exact equality.
      const roundTrip = hexToHsl(hslToHex(h, s, l));
      expect(roundTrip[0]).toBeCloseTo(h, 0);
      expect(roundTrip[1]).toBeCloseTo(s, 1);
      expect(roundTrip[2]).toBeCloseTo(l, 1);
    });
  });

  describe('generateShades', () => {
    it('returns the requested count of valid hexes', () => {
      const shades = generateShades('#6528F7', 10);
      expect(shades).toHaveLength(10);
      shades.forEach((hex) => expect(hex).toMatch(/^#[0-9A-F]{6}$/));
    });

    it('always includes the exact input color (uppercased)', () => {
      expect(generateShades('#6528F7', 10)).toContain('#6528F7');
      expect(generateShades('a076f9', 10)).toContain('#A076F9');
    });

    it('orders shades dark -> light by lightness', () => {
      const shades = generateShades('#6528F7', 10);
      const lightness = shades.map((hex) => hexToHsl(hex)[2]);
      for (let i = 1; i < lightness.length; i++) {
        expect(lightness[i]).toBeGreaterThanOrEqual(lightness[i - 1]);
      }
    });

    it('clamps absurd counts to a minimum of two', () => {
      expect(generateShades('#6528F7', 0)).toHaveLength(2);
      expect(generateShades('#6528F7', -5)).toHaveLength(2);
    });

    it('keeps two different bases distinct', () => {
      const purple = generateShades('#6528F7', 10);
      const blue = generateShades('#7895CB', 10);
      expect(new Set(purple).size).toBe(10);
      expect(new Set(blue).size).toBe(10);
    });
  });
});
