// Pure color math. No React, no side effects.
// Single Responsibility: convert/derive hex shades. Reusable & unit-testable.

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// Normalizes any reasonable hex input (#abc, abc, #aabbcc) to #RRGGBB uppercase.
// Returns #000000 for anything unparseable so downstream math never sees NaN.
export function normalizeHex(hex) {
  if (typeof hex !== 'string') return '#000000';
  let h = hex.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  if (h.length === 4) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return '#000000';
  return h.toUpperCase();
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex);
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

export function rgbToHex(r, g, b) {
  const to = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

// Returns [h (0-360), s (0-1), l (0-1)].
export function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) {
      h = ((gn - bn) / d) % 6;
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

export function hslToHex(h, s, l) {
  const safeS = clamp(s, 0, 1);
  const safeL = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * safeL - 1)) * safeS;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = safeL - c / 2;
  return rgbToHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

const SHADE_L_MIN = 0.12;
const SHADE_L_MAX = 0.92;

// Returns `count` hex shades, lightness stepping dark -> light.
// The exact input hex is always included (snapped onto its nearest step)
// so the original color stays directly selectable in a derivative row.
export function generateShades(hex, count = 10) {
  const safeCount = Math.max(2, Math.floor(count));
  const [h, s, baseL] = hexToHsl(hex);
  const steps = [];
  for (let i = 0; i < safeCount; i++) {
    const l = SHADE_L_MIN + ((SHADE_L_MAX - SHADE_L_MIN) * i) / (safeCount - 1);
    steps.push({ l, hex: hslToHex(h, s, l) });
  }
  let nearest = 0;
  let nearestDelta = Infinity;
  for (let i = 0; i < safeCount; i++) {
    const delta = Math.abs(steps[i].l - baseL);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearest = i;
    }
  }
  steps[nearest].hex = normalizeHex(hex);
  return steps.map((step) => step.hex);
}
