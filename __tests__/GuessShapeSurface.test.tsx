// GuessShapeSurface behavior suite.
//
// The surface is the guess-only composition (decision doc :197): a single
// ShapeCanvas (with the corridor offset + renderBand slot) plus the graded
// MatchRevealOverlay stacked above it. ALL scoring lives at the single
// lift-time call site here — the surface turns a lifted stroke into a reveal
// (win / loseScore / loseLengthCap) and forwards the normalized outline to
// the parent.
//
// Mocks (system boundaries only):
// - react-native-gesture-handler: Pan handlers are captured so tests fire the
//   same callbacks the native layer would (GuessPicture.test.js pattern).
// - utils/shapeMatch: outlineMatchScore/isWinningTrace are mocked to control
//   the graded outcome; the rest (constants) stays real.
// - components/Picture/ShapeCanvas: capture-and-forward mock — records the
//   props the surface passes down AND renders the REAL ShapeCanvas inside, so
//   the full stroke pipeline (px → simplify → normalize → lift) runs for real.
// utils/shapeGeometry stays real.

const mockPanGestures: Array<Record<string, unknown>> = [];

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');

  function makePan() {
    const gesture: Record<string, unknown> = {};
    mockPanGestures.push(gesture);
    gesture.activeOffsetX = () => gesture;
    gesture.activeOffsetY = () => gesture;
    gesture.failOffsetX = () => gesture;
    gesture.failOffsetY = () => gesture;
    gesture.enabled = () => gesture;
    gesture.hitSlop = (arg: unknown) => {
      gesture.hitSlopArg = arg;
      return gesture;
    };
    gesture.onStart = (cb: unknown) => {
      gesture.onStartHandler = cb;
      return gesture;
    };
    gesture.onBegin = (cb: unknown) => {
      gesture.onBeginHandler = cb;
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
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('../utils/shapeMatch', () => ({
  ...jest.requireActual('../utils/shapeMatch'),
  outlineMatchScore: jest.fn(),
  isWinningTrace: jest.fn(),
}));

jest.mock('../components/Picture/ShapeCanvas', () => {
  const React = require('react');
  const Actual = jest.requireActual('../components/Picture/ShapeCanvas').default;
  const capturedProps: Array<Record<string, unknown>> = [];
  function MockShapeCanvas(props: Record<string, unknown>) {
    capturedProps.push(props);
    return React.createElement(Actual, props);
  }
  return { __esModule: true, default: MockShapeCanvas, __capturedProps: capturedProps };
});

jest.mock('../components/Picture/TraceCorridor', () => {
  const React = require('react');
  const Actual = jest.requireActual('../components/Picture/TraceCorridor').default;
  const capturedProps: Array<Record<string, unknown>> = [];
  function MockTraceCorridor(props: Record<string, unknown>) {
    capturedProps.push(props);
    return React.createElement(Actual, props);
  }
  return { __esModule: true, default: MockTraceCorridor, __capturedProps: capturedProps };
});

import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import GuessShapeSurface from '../components/Picture/GuessShapeSurface';
import { outlineMatchScore, isWinningTrace } from '../utils/shapeMatch';
import i18n from '../i18n';

const shapeCanvasMock = jest.requireMock('../components/Picture/ShapeCanvas') as {
  __capturedProps: Array<Record<string, unknown>>;
};
const traceCorridorMock = jest.requireMock('../components/Picture/TraceCorridor') as {
  __capturedProps: Array<Record<string, unknown>>;
};
const outlineMatchScoreMock = outlineMatchScore as jest.Mock;
const isWinningTraceMock = isWinningTrace as jest.Mock;

type SurfaceProps = React.ComponentProps<typeof GuessShapeSurface>;

const DIMS = { width: 200, height: 400 };
const IMAGE_WIDTH = 640;
const IMAGE_HEIGHT = 480;

// Hidden shape shipped on shape cards (normalized [0,1], closed).
const TRIANGLE_OUTLINE = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.5, y: 0.9 },
  { x: 0.1, y: 0.1 },
];

// A small hidden square: a full-size trace massively overshoots its length cap.
const SMALL_SQUARE_OUTLINE = [
  { x: 0.45, y: 0.45 },
  { x: 0.55, y: 0.45 },
  { x: 0.55, y: 0.55 },
  { x: 0.45, y: 0.55 },
  { x: 0.45, y: 0.45 },
];

// Triangle on the 200×400 surface normalizes (after simplify + close) to the
// same triangle outline above.
const STROKE_VERTICES = [{ x: 20, y: 40 }, { x: 180, y: 40 }, { x: 100, y: 360 }];
const NORMALIZED_STROKE = TRIANGLE_OUTLINE;

const baseProps: SurfaceProps = {
  imageDimensionStyle: DIMS,
  hiddenOutline: TRIANGLE_OUTLINE,
  imageWidth: IMAGE_WIDTH,
  imageHeight: IMAGE_HEIGHT,
};

function lastShapeCanvasProps(): Record<string, unknown> {
  const captured = shapeCanvasMock.__capturedProps;
  if (captured.length === 0) {
    throw new Error('ShapeCanvas was never mounted');
  }
  return captured[captured.length - 1];
}

function lastTraceCorridorProps(): Record<string, unknown> {
  const captured = traceCorridorMock.__capturedProps;
  if (captured.length === 0) {
    throw new Error('TraceCorridor (renderBand slot) was never invoked');
  }
  return captured[captured.length - 1];
}

function findShapePan(): Record<string, any> {
  const pan = [...mockPanGestures].reverse().find((g) => g.onBeginHandler);
  if (!pan) {
    throw new Error('no shape draw Pan gesture is attached to the rendered surface');
  }
  return pan;
}

async function fireShapePan(
  vertices: Array<{ x: number; y: number }>,
  pan: Record<string, any> = findShapePan()
) {
  await act(async () => {
    pan.onBeginHandler({ x: vertices[0].x, y: vertices[0].y });
    for (const vertex of vertices.slice(1)) {
      pan.onUpdateHandler({ x: vertex.x, y: vertex.y });
    }
    pan.onFinalizeHandler({}, true);
  });
}

async function startStroke(
  vertices: Array<{ x: number; y: number }>,
  pan: Record<string, any> = findShapePan()
) {
  await act(async () => {
    pan.onBeginHandler({ x: vertices[0].x, y: vertices[0].y });
    for (const vertex of vertices.slice(1)) {
      pan.onUpdateHandler({ x: vertex.x, y: vertex.y });
    }
  });
}

describe('GuessShapeSurface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPanGestures.length = 0;
    shapeCanvasMock.__capturedProps.length = 0;
    traceCorridorMock.__capturedProps.length = 0;
  });

  // FIRST in the file: React logs the "Cannot update a component while
  // rendering a different component" dev warning only once per process, so
  // this test must run before any other test triggers it.
  it('clears the reveal at stroke start without a React cross-component update warning', async () => {
    outlineMatchScoreMock.mockReturnValue(0.5);
    isWinningTraceMock.mockReturnValue(false);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<GuessShapeSurface {...baseProps} />);

      await fireShapePan(STROKE_VERTICES);
      expect(screen.queryByTestId('game.picture.trace-reveal')).not.toBeNull();

      await startStroke(STROKE_VERTICES);
      expect(screen.queryByTestId('game.picture.trace-reveal')).toBeNull();

      const warningCalls = consoleErrorSpy.mock.calls
        .flat()
        .filter((arg) => /Cannot update a component/.test(String(arg)));
      expect(warningCalls).toEqual([]);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('renders the surface root and mounts the draw surface visible through it', () => {
    render(<GuessShapeSurface {...baseProps} />);

    expect(screen.queryByTestId('game.picture.guess-shape-surface')).not.toBeNull();
    expect(screen.queryByTestId('game.picture.shape-surface')).not.toBeNull();
  });

  it('on a winning lift, reveals the win verdict + percent and forwards the outline', async () => {
    outlineMatchScoreMock.mockReturnValue(0.87);
    isWinningTraceMock.mockReturnValue(true);
    const onOutlineChange = jest.fn();
    render(<GuessShapeSurface {...baseProps} onOutlineChange={onOutlineChange} />);

    expect(screen.queryByTestId('game.picture.trace-reveal')).toBeNull();

    await fireShapePan(STROKE_VERTICES);

    expect(screen.queryByTestId('game.picture.trace-reveal')).not.toBeNull();
    expect(screen.getByTestId('game.picture.trace-reveal-verdict').props.children).toBe(
      i18n.t('game.picture.traceWin')
    );
    expect(screen.getByTestId('game.picture.trace-reveal-percent').props.children).toBe('87%');
    expect(onOutlineChange).toHaveBeenCalledWith(NORMALIZED_STROKE);
  });

  it('on a losing lift within the length cap, reveals the loseScore verdict', async () => {
    outlineMatchScoreMock.mockReturnValue(0.5);
    isWinningTraceMock.mockReturnValue(false);
    render(<GuessShapeSurface {...baseProps} />);

    await fireShapePan(STROKE_VERTICES);

    expect(screen.getByTestId('game.picture.trace-reveal-verdict').props.children).toBe(
      i18n.t('game.picture.traceLoseScore')
    );
    expect(screen.getByTestId('game.picture.trace-reveal-percent').props.children).toBe('50%');
  });

  it('on a losing lift past the length cap, the cap beats the score (loseLengthCap)', async () => {
    outlineMatchScoreMock.mockReturnValue(0.5);
    isWinningTraceMock.mockReturnValue(false);
    render(<GuessShapeSurface {...baseProps} hiddenOutline={SMALL_SQUARE_OUTLINE} />);

    await fireShapePan(STROKE_VERTICES);

    expect(screen.getByTestId('game.picture.trace-reveal-verdict').props.children).toBe(
      i18n.t('game.picture.traceLoseLengthCap')
    );
  });

  it('keeps the reveal rendered across rerenders while no new stroke starts', async () => {
    outlineMatchScoreMock.mockReturnValue(0.87);
    isWinningTraceMock.mockReturnValue(true);
    const { rerender } = render(<GuessShapeSurface {...baseProps} />);

    await fireShapePan(STROKE_VERTICES);
    expect(screen.queryByTestId('game.picture.trace-reveal')).not.toBeNull();

    rerender(<GuessShapeSurface {...baseProps} />);

    expect(screen.queryByTestId('game.picture.trace-reveal')).not.toBeNull();
    expect(screen.getByTestId('game.picture.trace-reveal-percent').props.children).toBe('87%');
  });

  it('clears the reveal at the next stroke START, replaces it on the second lift, and forwards redraw nulls', async () => {
    outlineMatchScoreMock.mockReturnValue(0.5);
    isWinningTraceMock.mockReturnValue(false);
    const onOutlineChange = jest.fn();
    render(<GuessShapeSurface {...baseProps} onOutlineChange={onOutlineChange} />);

    await fireShapePan(STROKE_VERTICES);
    expect(screen.queryByTestId('game.picture.trace-reveal')).not.toBeNull();

    const pan = findShapePan();

    // Second stroke begins: the band slot fires → reveal gone BEFORE the lift.
    await startStroke(STROKE_VERTICES, pan);
    expect(screen.queryByTestId('game.picture.trace-band')).not.toBeNull();
    expect(screen.queryByTestId('game.picture.trace-reveal')).toBeNull();

    // Second lift replaces the verdict.
    outlineMatchScoreMock.mockReturnValue(0.87);
    isWinningTraceMock.mockReturnValue(true);
    await act(async () => {
      pan.onFinalizeHandler({}, true);
    });
    expect(screen.getByTestId('game.picture.trace-reveal-percent').props.children).toBe('87%');
    expect(onOutlineChange).toHaveBeenLastCalledWith(NORMALIZED_STROKE);

    // Redraw path (degenerate stroke → ShapeCanvas calls onOutlineChange(null)):
    // reveal gone and null forwarded to the parent.
    await fireShapePan([{ x: 50, y: 50 }, { x: 50, y: 50 }], pan);
    expect(screen.queryByTestId('game.picture.trace-reveal')).toBeNull();
    expect(onOutlineChange).toHaveBeenLastCalledWith(null);
  });

  it('scores the lifted outline with exactly the 4 image-space params, missing dims → 0', async () => {
    outlineMatchScoreMock.mockReturnValue(0.5);
    isWinningTraceMock.mockReturnValue(false);
    const onOutlineChange = jest.fn();
    const { unmount } = render(
      <GuessShapeSurface {...baseProps} onOutlineChange={onOutlineChange} />
    );

    await fireShapePan(STROKE_VERTICES);

    expect(outlineMatchScoreMock).toHaveBeenCalledWith({
      hiddenShape: TRIANGLE_OUTLINE,
      guessShape: NORMALIZED_STROKE,
      imageWidth: IMAGE_WIDTH,
      imageHeight: IMAGE_HEIGHT,
    });
    // LOCKED signature (resolution d): no screen fields in the scoring call.
    expect(Object.keys(outlineMatchScoreMock.mock.calls[0][0]).sort()).toEqual([
      'guessShape',
      'hiddenShape',
      'imageHeight',
      'imageWidth',
    ]);
    // The parent receives the SAME normalized outline that was scored.
    expect(onOutlineChange).toHaveBeenCalledWith(NORMALIZED_STROKE);

    unmount();

    const { imageWidth: _omitWidth, imageHeight: _omitHeight, ...propsWithoutDims } = baseProps;
    render(<GuessShapeSurface {...propsWithoutDims} onOutlineChange={onOutlineChange} />);
    await fireShapePan(STROKE_VERTICES);

    const lastCall = outlineMatchScoreMock.mock.calls[outlineMatchScoreMock.mock.calls.length - 1][0];
    expect(lastCall.imageWidth).toBe(0);
    expect(lastCall.imageHeight).toBe(0);
  });

  it('keeps outline (own stroke) and hiddenOutline naming apart; empty hiddenOutline → defined lose, no NaN', async () => {
    outlineMatchScoreMock.mockReturnValue(0);
    isWinningTraceMock.mockReturnValue(false);
    const onOutlineChange = jest.fn();
    const storedOutline = [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.5, y: 0.8 },
      { x: 0.2, y: 0.2 },
    ];
    render(
      <GuessShapeSurface
        {...baseProps}
        hiddenOutline={[]}
        outline={storedOutline}
        onOutlineChange={onOutlineChange}
      />
    );

    // `outline` reaches the ShapeCanvas seam untouched; the hidden outline
    // never leaks into the ShapeCanvas props.
    const forwarded = lastShapeCanvasProps();
    expect(forwarded.outline).toBe(storedOutline);
    expect('hiddenOutline' in forwarded).toBe(false);

    await fireShapePan(STROKE_VERTICES);

    expect(screen.queryByTestId('game.picture.trace-reveal')).not.toBeNull();
    const verdict = screen.getByTestId('game.picture.trace-reveal-verdict').props.children;
    expect(verdict).toBeDefined();
    expect(verdict).not.toBe(i18n.t('game.picture.traceWin'));
    const percent = screen.getByTestId('game.picture.trace-reveal-percent').props.children;
    expect(percent).toBe('0%');
    expect(String(percent).includes('NaN')).toBe(false);
  });

  it('forwards ShapeCanvas stroke updates through onStrokeUpdate (anchor + renderPoints, null on lift)', async () => {
    const onStrokeUpdate = jest.fn();
    render(<GuessShapeSurface {...baseProps} onStrokeUpdate={onStrokeUpdate} />);

    await startStroke(STROKE_VERTICES);

    expect(onStrokeUpdate).toHaveBeenCalledWith({
      anchor: { x: 20, y: 40 },
      renderPoints: [{ x: 20, y: 40 }],
    });
    expect(onStrokeUpdate).toHaveBeenLastCalledWith({
      anchor: { x: 100, y: 360 },
      renderPoints: [{ x: 20, y: 40 }, { x: 180, y: 40 }, { x: 100, y: 360 }],
    });

    await act(async () => {
      findShapePan().onFinalizeHandler({}, true);
    });
    expect(onStrokeUpdate).toHaveBeenLastCalledWith(null);
  });

  it('keeps the lift-handler (onOutlineChange) identity stable across two mirror commits (no gesture-object churn)', async () => {
    const { rerender } = render(<GuessShapeSurface {...baseProps} />);

    await startStroke(STROKE_VERTICES);
    const handlerAfterFirstCommit = lastShapeCanvasProps().onOutlineChange;

    rerender(<GuessShapeSurface {...baseProps} />);
    await startStroke(STROKE_VERTICES);
    const handlerAfterSecondCommit = lastShapeCanvasProps().onOutlineChange;

    expect(handlerAfterSecondCommit).toBe(handlerAfterFirstCommit);
  });

  it('renders the corridor band finger-true from the live stroke (no offset)', async () => {
    render(<GuessShapeSurface {...baseProps} />);

    await startStroke(STROKE_VERTICES);

    expect(screen.queryByTestId('game.picture.trace-band')).not.toBeNull();
    expect(lastTraceCorridorProps().trace).toEqual([
      { x: 20, y: 40 },
      { x: 180, y: 40 },
      { x: 100, y: 360 },
    ]);
  });

  it('derives the band width from corridorBandWidthPx with SHAPE_TOLERANCE_RATIO (1000×1000 image at style 500 → 50)', async () => {
    render(
      <GuessShapeSurface
        imageDimensionStyle={{ width: 500, height: 500 }}
        hiddenOutline={TRIANGLE_OUTLINE}
        imageWidth={1000}
        imageHeight={1000}
      />
    );

    await startStroke(STROKE_VERTICES);

    expect(lastTraceCorridorProps().bandWidth).toBe(50);
  });
});
