// useLoupe behavior suite.
//
// useLoupe owns the ONLY animated values of the loupe (D2/D9): four plain
// Animated.Values (frameX/frameY + contentX/contentY), the D8 origin/dims
// measurement refs, the image→container conversion in `report()` (zero
// setState in the report path), and the show/hide lifecycle.

import * as React from 'react';
import { Animated } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useLoupe } from '../hooks/useLoupe';
import {
  loupeContentTransform,
  loupeLayout,
  type Point,
} from '../utils/loupeGeometry';

type UseLoupeResult = ReturnType<typeof useLoupe>;

const ORIGIN = { x: 20, y: 280 };
const DIMS = { width: 360, height: 800 };
const IMAGE_ANCHOR = { x: 100, y: 200 };

let captured: UseLoupeResult | undefined;
let renderCount = 0;

function Probe(props: { fallbackDims?: { width: number; height: number } }) {
  renderCount += 1;
  captured = useLoupe(props.fallbackDims);
  return React.createElement(
    Animated.View,
    { style: captured.frameStyle },
    React.createElement(Animated.View, { style: captured.contentStyle }),
  );
}

function readValue(value: Animated.Value): number {
  return (value as unknown as { __getValue(): number }).__getValue();
}

function animatedValues(): {
  frameX: Animated.Value;
  frameY: Animated.Value;
  contentX: Animated.Value;
  contentY: Animated.Value;
} {
  return {
    frameX: captured!.frameStyle.left,
    frameY: captured!.frameStyle.top,
    contentX: captured!.contentStyle.transform[0].translateX,
    contentY: captured!.contentStyle.transform[1].translateY,
  };
}

function renderProbe(fallbackDims?: { width: number; height: number }) {
  let renderer: any;
  act(() => {
    renderer = create(React.createElement(Probe, { fallbackDims }));
  });
  return renderer;
}

describe('useLoupe', () => {
  let renderer: any;

  beforeEach(() => {
    captured = undefined;
    renderCount = 0;
    renderer = undefined;
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer.unmount();
      });
      renderer = undefined;
    }
  });

  describe('report (D8 conversion, zero re-render)', () => {
    it('drives frame/content values with loupeLayout(origin + anchor, dims) and loupeContentTransform(anchor)', () => {
      renderer = renderProbe();

      act(() => {
        captured!.originRef.current = ORIGIN;
        captured!.dimsRef.current = DIMS;
      });

      const { frameX, frameY, contentX, contentY } = animatedValues();
      const spies = [frameX, frameY, contentX, contentY].map((value) =>
        jest.spyOn(value, 'setValue'),
      );

      act(() => {
        captured!.report(IMAGE_ANCHOR);
      });

      const expectedFrame = loupeLayout({
        anchor: { x: ORIGIN.x + IMAGE_ANCHOR.x, y: ORIGIN.y + IMAGE_ANCHOR.y },
        screen: DIMS,
      });
      const expectedContent = loupeContentTransform({ anchor: IMAGE_ANCHOR });

      expect(spies[0]).toHaveBeenCalledWith(expectedFrame.left);
      expect(spies[1]).toHaveBeenCalledWith(expectedFrame.top);
      expect(spies[2]).toHaveBeenCalledWith(expectedContent.translateX);
      expect(spies[3]).toHaveBeenCalledWith(expectedContent.translateY);
      expect(readValue(frameX)).toBe(expectedFrame.left);
      expect(readValue(frameY)).toBe(expectedFrame.top);
      expect(readValue(contentX)).toBe(expectedContent.translateX);
      expect(readValue(contentY)).toBe(expectedContent.translateY);
    });

    it('does NOT flip visible (no setState in the report path)', () => {
      renderer = renderProbe();

      act(() => {
        captured!.report(IMAGE_ANCHOR);
      });

      expect(captured!.visible).toBe(false);
    });

    it('keeps the render count flat across 50 report() calls (§7 budget #1)', () => {
      renderer = renderProbe();
      expect(renderCount).toBe(1);

      act(() => {
        for (let i = 0; i < 50; i += 1) {
          captured!.report({ x: 10 + i, y: 20 + i });
        }
      });

      expect(renderCount).toBe(1);
    });
  });

  describe('show / hide lifecycle', () => {
    it('flips the visible flag only (opacity fade is an implementation detail)', () => {
      renderer = renderProbe();
      expect(captured!.visible).toBe(false);

      act(() => {
        captured!.show();
      });
      expect(captured!.visible).toBe(true);

      act(() => {
        captured!.hide();
      });
      expect(captured!.visible).toBe(false);
    });

    it('resets the animated anchors on hide', () => {
      renderer = renderProbe();

      act(() => {
        captured!.originRef.current = ORIGIN;
        captured!.dimsRef.current = DIMS;
        captured!.report(IMAGE_ANCHOR);
      });
      const { frameX, frameY, contentX, contentY } = animatedValues();
      expect(readValue(frameX)).not.toBe(0);

      act(() => {
        captured!.hide();
      });

      expect(readValue(frameX)).toBe(0);
      expect(readValue(frameY)).toBe(0);
      expect(readValue(contentX)).toBe(0);
      expect(readValue(contentY)).toBe(0);
    });
  });

  describe('late-bound dims (D2)', () => {
    it('falls back to the passed fallbackDims when dimsRef is still null', () => {
      renderer = renderProbe({ width: 320, height: 240 });

      const { frameX } = animatedValues();

      act(() => {
        captured!.report({ x: 100, y: 200 });
      });

      const expected = loupeLayout({
        anchor: { x: 100, y: 200 },
        screen: { width: 320, height: 240 },
      });
      expect(readValue(frameX)).toBe(expected.left);
    });

    it('falls back to the module default dims and a zero origin when nothing is measured', () => {
      renderer = renderProbe();

      const { frameX, frameY } = animatedValues();

      act(() => {
        captured!.report({ x: 100, y: 200 });
      });

      const expected = loupeLayout({
        anchor: { x: 100, y: 200 },
        screen: { width: 0, height: 0 },
      });
      expect(readValue(frameX)).toBe(expected.left);
      expect(readValue(frameY)).toBe(expected.top);
    });
  });
});
