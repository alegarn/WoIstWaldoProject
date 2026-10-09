// ShapeCanvas behavior suite.
//
// ShapeCanvas is the single px→[0,1] outline owner: it collects the raw
// pixel-space stroke via an RNGH Pan recognizer, renders the live trace plus
// the auto-close preview as thin rotated View segments, and ships the
// simplified/normalized (storage) outline through onOutlineChange on stroke
// end.
//
// Only the system boundary is mocked:
// - react-native-gesture-handler (native gestures; Pan handler chains are
//   captured so tests can fire the same callbacks the native layer would)
// Everything else (react-native views, i18n, shapeGeometry pipeline) runs real.

const mockPanGestures: any[] = [];

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');

  function makePan() {
    const gesture: Record<string, unknown> = {};
    mockPanGestures.push(gesture);
    gesture.enabled = (arg: boolean) => {
      gesture.enabledArg = arg;
      return gesture;
    };
    gesture.onBegin = (cb: unknown) => {
      gesture.onBeginHandler = cb;
      return gesture;
    };
    gesture.onStart = (cb: unknown) => {
      gesture.onStartHandler = cb;
      return gesture;
    };
    gesture.onUpdate = (cb: unknown) => {
      gesture.onUpdateHandler = cb;
      return gesture;
    };
    gesture.onEnd = (cb: unknown) => {
      gesture.onEndHandler = cb;
      return gesture;
    };
    gesture.onFinalize = (cb: unknown) => {
      gesture.onFinalizeHandler = cb;
      return gesture;
    };
    return gesture;
  }

  return {
    Gesture: { Pan: makePan },
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    GestureHandlerRootView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

import React from 'react';
import i18n from 'i18next';
import { act, render, screen } from '@testing-library/react-native';

import ShapeCanvas from '../components/Picture/ShapeCanvas';

const IMAGE_DIMENSION_STYLE = { width: 200, height: 400 };

function findDrawPan(): Record<string, any> {
  const pan = [...mockPanGestures].reverse().find((g) => g.onEndHandler);
  if (!pan) {
    throw new Error('no draw Pan gesture is attached to the rendered canvas');
  }
  return pan;
}

async function fireStroke(points: Array<{ x: number; y: number }>) {
  const pan = findDrawPan();
  await act(async () => {
    pan.onStartHandler(points[0]);
    for (const point of points.slice(1)) {
      pan.onUpdateHandler(point);
    }
    pan.onEndHandler({});
  });
}

describe('ShapeCanvas', () => {
  const baseProps = {
    imageDimensionStyle: IMAGE_DIMENSION_STYLE,
    onOutlineChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPanGestures.length = 0;
  });

  it('renders the shape-surface testID and attaches a single draw Pan recognizer', () => {
    render(<ShapeCanvas {...baseProps} />);

    expect(screen.getByTestId('game.picture.shape-surface')).toBeTruthy();
    expect(findDrawPan()).toBeDefined();
  });

  it('renders no outline element while no outline is stored', () => {
    render(<ShapeCanvas {...baseProps} />);

    expect(screen.queryByTestId('game.picture.shape-outline')).toBeNull();
  });

  it('renders the stored outline as rotated View segments (closed square → 4 segments)', () => {
    const outline = [
      { x: 0.1, y: 0.05 },
      { x: 0.9, y: 0.05 },
      { x: 0.9, y: 0.95 },
      { x: 0.1, y: 0.95 },
      { x: 0.1, y: 0.05 },
    ];
    render(<ShapeCanvas {...baseProps} outline={outline} />);

    const outlineEl = screen.getByTestId('game.picture.shape-outline');
    expect(outlineEl.props.children.length).toBe(4);
    const firstSegment = outlineEl.props.children[0];
    // Top edge of the square: 0.1→0.9 of 200px wide, 0.05 of 400px tall.
    expect(firstSegment.props.style.width).toBe(160);
    expect(firstSegment.props.style.left).toBe(20);
    expect(firstSegment.props.style.top).toBe(19);
  });

  it('converts a raw pixel stroke into the storage outline via simplify → normalize (px→[0,1] owner)', async () => {
    const onOutlineChange = jest.fn();
    render(<ShapeCanvas {...baseProps} onOutlineChange={onOutlineChange} />);

    await fireStroke([
      { x: 20, y: 20 },
      { x: 180, y: 20 },
      { x: 180, y: 380 },
      { x: 20, y: 380 },
      { x: 20, y: 20 },
    ]);

    expect(onOutlineChange).toHaveBeenCalledTimes(1);
    expect(onOutlineChange).toHaveBeenCalledWith([
      { x: 0.1, y: 0.05 },
      { x: 0.9, y: 0.05 },
      { x: 0.9, y: 0.95 },
      { x: 0.1, y: 0.95 },
      { x: 0.1, y: 0.05 },
    ]);
  });

  it('renders the live trace with the auto-close preview while the stroke is in progress', async () => {
    render(<ShapeCanvas {...baseProps} />);
    const pan = findDrawPan();

    await act(async () => {
      pan.onStartHandler({ x: 20, y: 20 });
      pan.onUpdateHandler({ x: 180, y: 20 });
      pan.onUpdateHandler({ x: 180, y: 380 });
    });

    const trace = screen.getByTestId('game.picture.shape-trace');
    // 2 consecutive segments + 1 start→end auto-close preview segment.
    expect(trace.props.children.length).toBe(3);
  });

  it('clears the live trace after the stroke finalizes', async () => {
    render(<ShapeCanvas {...baseProps} />);

    await fireStroke([
      { x: 20, y: 20 },
      { x: 180, y: 20 },
      { x: 180, y: 380 },
    ]);

    expect(screen.queryByTestId('game.picture.shape-trace')).toBeNull();
  });

  it('surfaces the redraw prompt and ships null when the outline is too simple', async () => {
    const onOutlineChange = jest.fn();
    render(<ShapeCanvas {...baseProps} onOutlineChange={onOutlineChange} />);

    await fireStroke([
      { x: 50, y: 50 },
      { x: 51, y: 50 },
    ]);

    expect(onOutlineChange).toHaveBeenCalledWith(null);
    expect(
      screen.getByText(i18n.t('game.picture.shapeTooSimple'))
    ).toBeTruthy();
  });

  it('clamps stroke points beyond the image edges (incl. negative coords) so the emitted outline stays in [0,1]', async () => {
    const onOutlineChange = jest.fn();
    render(<ShapeCanvas {...baseProps} onOutlineChange={onOutlineChange} />);

    await fireStroke([
      { x: -50, y: -50 },
      { x: 250, y: -50 },
      { x: 250, y: 450 },
      { x: -50, y: 450 },
      { x: -50, y: -50 },
    ]);

    expect(onOutlineChange).toHaveBeenCalledTimes(1);
    expect(onOutlineChange).toHaveBeenCalledWith([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]);
  });

  it.each([
    { name: 'left', stroke: [{ x: -30, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 300 }, { x: -30, y: 300 }] },
    { name: 'right', stroke: [{ x: 100, y: 100 }, { x: 230, y: 100 }, { x: 230, y: 300 }, { x: 100, y: 300 }] },
    { name: 'top', stroke: [{ x: 50, y: -20 }, { x: 150, y: -20 }, { x: 150, y: 200 }, { x: 50, y: 200 }] },
    { name: 'bottom', stroke: [{ x: 50, y: 200 }, { x: 150, y: 200 }, { x: 150, y: 420 }, { x: 50, y: 420 }] },
  ])('keeps the emitted outline within [0,1] for a stroke beyond the $name edge', async ({ stroke }) => {
    const onOutlineChange = jest.fn();
    render(<ShapeCanvas {...baseProps} onOutlineChange={onOutlineChange} />);

    await fireStroke(stroke);

    expect(onOutlineChange).toHaveBeenCalledTimes(1);
    const outline = onOutlineChange.mock.calls[0][0] as Array<{ x: number; y: number }>;
    expect(outline).not.toBeNull();
    for (const point of outline) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
  });

  it('clamps the live trace and auto-close preview for out-of-bounds points', async () => {
    render(<ShapeCanvas {...baseProps} />);
    const pan = findDrawPan();

    await act(async () => {
      pan.onStartHandler({ x: -50, y: -50 });
      pan.onUpdateHandler({ x: 250, y: -50 });
      pan.onUpdateHandler({ x: 250, y: 450 });
    });

    const trace = screen.getByTestId('game.picture.shape-trace');
    const firstSegment = trace.props.children[0];
    // Clamped (0,0)→(200,0): horizontal bar spanning the full image width.
    expect(firstSegment.props.style.left).toBe(0);
    expect(firstSegment.props.style.width).toBe(200);
    const preview = trace.props.children[trace.props.children.length - 1];
    // Clamped auto-close (200,400)→(0,0): bar centered on (100,200), the
    // midpoint of the clamped endpoints.
    expect(preview.props.style.width).toBeCloseTo(Math.hypot(200, 400), 6);
    expect(preview.props.style.left + preview.props.style.width / 2).toBeCloseTo(100, 6);
    expect(preview.props.style.top + preview.props.style.height / 2).toBeCloseTo(200, 6);
  });

  it('stays degenerate when an out-of-bounds stroke collapses onto the edge', async () => {
    const onOutlineChange = jest.fn();
    render(<ShapeCanvas {...baseProps} onOutlineChange={onOutlineChange} />);

    await fireStroke([
      { x: -50, y: 50 },
      { x: -49, y: 50 },
    ]);

    expect(onOutlineChange).toHaveBeenCalledWith(null);
    expect(
      screen.getByText(i18n.t('game.picture.shapeTooSimple'))
    ).toBeTruthy();
  });

  it('disables the draw recognizer via enabled(false) when disabled', () => {
    render(<ShapeCanvas {...baseProps} disabled={true} />);

    const pan = findDrawPan();
    expect(pan.enabledArg).toBe(false);
  });

  it('keeps the draw recognizer enabled by default', () => {
    render(<ShapeCanvas {...baseProps} />);

    const pan = findDrawPan();
    expect(pan.enabledArg).toBe(true);
  });
});
