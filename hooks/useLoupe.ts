import { useRef, useState } from 'react';
import { Animated } from 'react-native';

import { loupeContentTransform, loupeLayout, type Point } from '../utils/loupeGeometry';

type Dims = { width: number; height: number };

const FALLBACK_DIMS: Dims = { width: 0, height: 0 };

export type UseLoupeResult = {
  visible: boolean;
  frameStyle: {
    position: 'absolute';
    left: Animated.Value;
    top: Animated.Value;
    opacity: number;
  };
  contentStyle: {
    transform: [{ translateX: Animated.Value }, { translateY: Animated.Value }];
  };
  report: (imageAnchor: Point) => void;
  show: () => void;
  hide: () => void;
  originRef: { current: Point | null };
  dimsRef: { current: Dims | null };
};

// Owner of the loupe's ONLY animated values (D2/D9): four plain
// Animated.Values driven by `setValue` inside `report` — zero React
// re-renders per move. Also owns the D8 measurement refs (image origin +
// container dims) and the image→container conversion, so hosts never do
// coordinate math.
export function useLoupe(fallbackDims: Dims = FALLBACK_DIMS): UseLoupeResult {
  const [visible, setVisible] = useState(false);

  const frameX = useRef(new Animated.Value(0)).current;
  const frameY = useRef(new Animated.Value(0)).current;
  const contentX = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(0)).current;

  const originRef = useRef<Point | null>(null);
  const dimsRef = useRef<Dims | null>(null);

  const report = (imageAnchor: Point) => {
    const origin = originRef.current ?? { x: 0, y: 0 };
    const dims = dimsRef.current ?? fallbackDims;

    const frame = loupeLayout({
      anchor: { x: origin.x + imageAnchor.x, y: origin.y + imageAnchor.y },
      screen: dims,
    });
    frameX.setValue(frame.left);
    frameY.setValue(frame.top);

    const content = loupeContentTransform({ anchor: imageAnchor });
    contentX.setValue(content.translateX);
    contentY.setValue(content.translateY);
  };

  const show = () => setVisible(true);

  const hide = () => {
    frameX.setValue(0);
    frameY.setValue(0);
    contentX.setValue(0);
    contentY.setValue(0);
    setVisible(false);
  };

  const frameStyle = {
    position: 'absolute' as const,
    left: frameX,
    top: frameY,
    opacity: visible ? 1 : 0,
  };

  const contentStyle = {
    transform: [
      { translateX: contentX },
      { translateY: contentY },
    ] as UseLoupeResult['contentStyle']['transform'],
  };

  return {
    visible,
    frameStyle,
    contentStyle,
    report,
    show,
    hide,
    originRef,
    dimsRef,
  };
}
