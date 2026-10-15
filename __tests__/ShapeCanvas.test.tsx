// ShapeCanvas behavior suite.
//
// ShapeCanvas is the single px→[0,1] outline owner: it collects the raw
// pixel-space stroke via an RNGH Pan recognizer, renders the live trace plus
// the auto-close preview as thin rotated View segments, decimates RENDER
// commits (the judged geometry is always the full raw polyline), reports
// stroke progress through onStrokeUpdate, and ships the simplified/normalized
// (storage) outline through onOutlineChange on stroke end.
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
    gesture.hitSlop = (arg: unknown) => {
      gesture.hitSlopArg = arg;
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
import { View } from 'react-native';
import i18n from 'i18next';
import { act, render, screen } from '@testing-library/react-native';

import ShapeCanvas from '../components/Picture/ShapeCanvas';
import {
  isDrawableOutline,
  normalizeOutline,
  simplifyOutline,
} from '../utils/shapeGeometry';

// The judged payload the canvas must emit for a raw polyline: the real
// pipeline (simplify → normalize → drawable gate) over EVERY raw point.
function judgedPayload(raw: Array<{ x: number; y: number }>) {
  const normalized = normalizeOutline(
    simplifyOutline(raw, IMAGE_WIDTH, IMAGE_HEIGHT),
    IMAGE_WIDTH,
    IMAGE_HEIGHT
  );
  return isDrawableOutline(normalized) ? normalized : null;
}

const IMAGE_DIMENSION_STYLE = { width: 200, height: 400 };
const IMAGE_WIDTH = 200;
const IMAGE_HEIGHT = 400;

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

async function driveLiveStroke(points: Array<{ x: number; y: number }>) {
  const pan = findDrawPan();
  await act(async () => {
    pan.onStartHandler(points[0]);
    for (const point of points.slice(1)) {
      pan.onUpdateHandler(point);
    }
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

  describe('finger-true tracing (offset retired)', () => {
    it('renders the live trace under the finger with no offset prop', async () => {
      render(<ShapeCanvas {...baseProps} />);

      await driveLiveStroke([
        { x: 20, y: 100 },
        { x: 180, y: 100 },
      ]);

      const segment =
        screen.getByTestId('game.picture.shape-trace').props.children[0];
      // Finger y 100, bar centered minus strokeWidth/2 → finger-true ink.
      expect(segment.props.style.top).toBe(99);
      expect(segment.props.style.left).toBe(20);
      expect(segment.props.style.width).toBe(160);
      expect(segment.props.style.height).toBe(2);
      expect(segment.props.style.borderRadius).toBe(1);
    });

    it('attaches no hitSlop to the draw Pan (offset recognizer extension retired)', () => {
      render(<ShapeCanvas {...baseProps} />);

      expect(findDrawPan().hitSlopArg).toBeUndefined();
    });

    it('feeds the band the same finger-true render points the live trace consumes', async () => {
      const renderBand = jest.fn(
        (_renderPoints: Array<{ x: number; y: number }>) => null
      );
      render(<ShapeCanvas {...baseProps} renderBand={renderBand} />);

      await driveLiveStroke([
        { x: 20, y: 100 },
        { x: 180, y: 100 },
      ]);

      const segment =
        screen.getByTestId('game.picture.shape-trace').props.children[0];
      expect(segment.props.style.top).toBe(99);
      const calls = renderBand.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const renderPoints = calls[calls.length - 1][0];
      expect(renderPoints[0]).toEqual({ x: 20, y: 100 });
      expect(renderPoints[1]).toEqual({ x: 180, y: 100 });
    });
  });

  describe('render decimation (judged = raw ref)', () => {
    // 5 raw points with ~1px inter-point steps AND a total span below the
    // 4px gate: no point can ever cross MIN_STROKE_STEP_PX from the start
    // commit, so the start commit stays the only one.
    const MICRO_STEP_STROKE = [
      { x: 20, y: 20 },
      { x: 21, y: 20 },
      { x: 22, y: 20 },
      { x: 22.5, y: 21 },
      { x: 23, y: 21 },
    ];

    it('emits the same judged payload as the undecimated full raw polyline', async () => {
      const onOutlineChange = jest.fn();
      const onStrokeUpdate = jest.fn();
      render(
        <ShapeCanvas
          {...baseProps}
          onOutlineChange={onOutlineChange}
          onStrokeUpdate={onStrokeUpdate}
        />
      );

      await fireStroke(MICRO_STEP_STROKE);

      expect(onOutlineChange).toHaveBeenCalledTimes(1);
      expect(onOutlineChange).toHaveBeenCalledWith(
        judgedPayload(MICRO_STEP_STROKE)
      );
    });

    it('fires at most one non-null commit while every step is below the 4px gate', async () => {
      const onStrokeUpdate = jest.fn();
      render(<ShapeCanvas {...baseProps} onStrokeUpdate={onStrokeUpdate} />);

      await fireStroke(MICRO_STEP_STROKE);

      const commits = onStrokeUpdate.mock.calls.filter(
        ([info]) => info !== null
      );
      expect(commits.length).toBeLessThanOrEqual(1);
    });

    it('always commits the first point of a stroke', async () => {
      const onStrokeUpdate = jest.fn();
      render(<ShapeCanvas {...baseProps} onStrokeUpdate={onStrokeUpdate} />);
      const pan = findDrawPan();

      await act(async () => {
        pan.onStartHandler({ x: 20, y: 100 });
      });

      expect(onStrokeUpdate).toHaveBeenCalledTimes(1);
      expect(onStrokeUpdate).toHaveBeenCalledWith({
        anchor: { x: 20, y: 100 },
        renderPoints: [{ x: 20, y: 100 }],
      });
    });
  });

  describe('onStrokeUpdate reporting', () => {
    it('fires {anchor, renderPoints} on start and on decimated commits, anchor = latest RAW point', async () => {
      const onStrokeUpdate = jest.fn();
      const onOutlineChange = jest.fn();
      render(
        <ShapeCanvas
          {...baseProps}
          onOutlineChange={onOutlineChange}
          onStrokeUpdate={onStrokeUpdate}
        />
      );
      const pan = findDrawPan();

      await act(async () => {
        pan.onStartHandler({ x: 10, y: 10 }); // commit 1 (start)
        pan.onUpdateHandler({ x: 13, y: 10 }); // 3px below gate — raw only
        pan.onUpdateHandler({ x: 10, y: 14 }); // 4px from committed → commit 2
      });

      expect(onStrokeUpdate).toHaveBeenCalledTimes(2);
      expect(onStrokeUpdate.mock.calls[0][0]).toEqual({
        anchor: { x: 10, y: 10 },
        renderPoints: [{ x: 10, y: 10 }],
      });
      // The 3px point never reaches the render points, but the reported
      // anchor is the latest RAW finger point.
      expect(onStrokeUpdate.mock.calls[1][0]).toEqual({
        anchor: { x: 10, y: 14 },
        renderPoints: [{ x: 10, y: 10 }, { x: 10, y: 14 }],
      });
    });

    it('ships the full raw polyline (incl. decimated points) to the judge on lift', async () => {
      const onStrokeUpdate = jest.fn();
      const onOutlineChange = jest.fn();
      const raw = [
        { x: 10, y: 10 },
        { x: 13, y: 10 },
        { x: 10, y: 14 },
      ];
      render(
        <ShapeCanvas
          {...baseProps}
          onOutlineChange={onOutlineChange}
          onStrokeUpdate={onStrokeUpdate}
        />
      );
      const pan = findDrawPan();

      await act(async () => {
        pan.onStartHandler(raw[0]);
        pan.onUpdateHandler(raw[1]);
        pan.onUpdateHandler(raw[2]);
        pan.onEndHandler({});
      });

      expect(onOutlineChange).toHaveBeenCalledTimes(1);
      expect(onOutlineChange).toHaveBeenCalledWith(judgedPayload(raw));
    });

    it('fires null AFTER the finalize emission on stroke end', async () => {
      const onStrokeUpdate = jest.fn();
      const onOutlineChange = jest.fn();
      render(
        <ShapeCanvas
          {...baseProps}
          onOutlineChange={onOutlineChange}
          onStrokeUpdate={onStrokeUpdate}
        />
      );
      const pan = findDrawPan();

      await act(async () => {
        pan.onStartHandler({ x: 20, y: 20 });
        pan.onUpdateHandler({ x: 180, y: 20 });
        pan.onUpdateHandler({ x: 180, y: 380 });
        pan.onEndHandler({});
      });

      expect(onOutlineChange).toHaveBeenCalledTimes(1);
      expect(onStrokeUpdate).toHaveBeenLastCalledWith(null);
      const finalizeOrder = onOutlineChange.mock.invocationCallOrder[0];
      const nullOrder =
        onStrokeUpdate.mock.invocationCallOrder[
          onStrokeUpdate.mock.invocationCallOrder.length - 1
        ];
      expect(nullOrder).toBeGreaterThan(finalizeOrder);
    });

    it('fires at least two commits during a 12px move (start + decimated commit)', async () => {
      const onStrokeUpdate = jest.fn();
      render(<ShapeCanvas {...baseProps} onStrokeUpdate={onStrokeUpdate} />);
      const pan = findDrawPan();

      await act(async () => {
        pan.onStartHandler({ x: 20, y: 100 });
        pan.onUpdateHandler({ x: 32, y: 100 });
      });

      const commits = onStrokeUpdate.mock.calls.filter(
        ([info]) => info !== null
      );
      expect(commits.length).toBeGreaterThanOrEqual(2);
    });

    it('fires null on lift even for a degenerate single-point stroke', async () => {
      const onStrokeUpdate = jest.fn();
      render(<ShapeCanvas {...baseProps} onStrokeUpdate={onStrokeUpdate} />);
      const pan = findDrawPan();

      await act(async () => {
        pan.onStartHandler({ x: 20, y: 100 });
        pan.onEndHandler({});
      });

      expect(onStrokeUpdate).toHaveBeenLastCalledWith(null);
    });
  });

  it('renders the band layer between the stored outline and the live trace inside a pointerEvents:none wrapper', async () => {
    const outline = [
      { x: 0.1, y: 0.05 },
      { x: 0.9, y: 0.05 },
      { x: 0.9, y: 0.95 },
      { x: 0.1, y: 0.95 },
      { x: 0.1, y: 0.05 },
    ];
    render(
      <ShapeCanvas
        {...baseProps}
        outline={outline}
        renderBand={() => <View testID="test.band-marker" />}
      />
    );

    await driveLiveStroke([
      { x: 20, y: 100 },
      { x: 180, y: 100 },
    ]);

    const children =
      screen.getByTestId('game.picture.shape-surface').props.children;
    const indexOf = (testID: string) =>
      children.findIndex(
        (child: any) => child?.props?.testID === testID
      );
    const bandIndex = children.findIndex((child: any) =>
      React.Children.toArray(child?.props?.children ?? []).some(
        (inner: any) => inner?.props?.testID === 'test.band-marker'
      )
    );
    expect(indexOf('game.picture.shape-outline')).toBeGreaterThanOrEqual(0);
    expect(bandIndex).toBeGreaterThan(
      indexOf('game.picture.shape-outline')
    );
    expect(indexOf('game.picture.shape-trace')).toBeGreaterThan(bandIndex);
    expect(children[bandIndex].props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pointerEvents: 'none' }),
      ])
    );
  });

  it('renders the band only while the live stroke has at least 2 points', async () => {
    const renderBand = jest.fn(() => <View testID="test.band-marker" />);
    render(<ShapeCanvas {...baseProps} renderBand={renderBand} />);
    const pan = findDrawPan();

    await act(async () => {
      pan.onStartHandler({ x: 20, y: 100 });
    });
    expect(screen.queryByTestId('test.band-marker')).toBeNull();

    await act(async () => {
      pan.onUpdateHandler({ x: 180, y: 100 });
    });
    expect(screen.getByTestId('test.band-marker')).toBeTruthy();
    expect(renderBand).toHaveBeenCalled();
  });

  it('adds no band layer when renderBand is unset (zero render change)', async () => {
    render(<ShapeCanvas {...baseProps} />);

    await driveLiveStroke([
      { x: 20, y: 100 },
      { x: 180, y: 100 },
    ]);

    const children = React.Children.toArray(
      screen.getByTestId('game.picture.shape-surface').props.children
    ) as Array<{ props: { testID?: string } }>;
    expect(children).toHaveLength(1);
    expect(children[0].props.testID).toBe('game.picture.shape-trace');
  });

  it('renders the band node as-is without extra styling from ShapeCanvas', async () => {
    render(
      <ShapeCanvas
        {...baseProps}
        renderBand={() => (
          <View testID="test.band-marker" style={{ width: 10, height: 10 }} />
        )}
      />
    );

    await driveLiveStroke([
      { x: 20, y: 100 },
      { x: 180, y: 100 },
    ]);

    const marker = screen.getByTestId('test.band-marker');
    expect(marker.props.style).toEqual({ width: 10, height: 10 });
  });
});
