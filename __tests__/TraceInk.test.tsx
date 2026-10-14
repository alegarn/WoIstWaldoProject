// TraceInk behavior suite.
//
// TraceInk is the extracted polyline renderer: a pure presentational layer
// that renders N−1 thin rotated View bars between consecutive vertices. It
// is AUTO-CLOSE-FREE by design — the caller composes any closing segment via
// the exported `traceSegmentStyle` builder and the `previewStyle` prop. Bars
// are React.memo'd (value-equal styles skip re-render) so appending point N
// renders only segment N−1.
//
// Nothing is mocked: the component is pure react-native (no RNGH), i18n is
// already initialized to 'en' by jest.setup.js (and the component uses none).

import React, { memo } from 'react';
import { View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import TraceInk, {
  areSegmentPropsEqual,
  areSegmentStylesEqual,
  traceSegmentStyle,
  TraceInkSegment,
  type TraceSegmentStyle,
} from '../components/Picture/TraceInk';
import TraceCorridorEdges from '../components/Picture/TraceCorridorEdges';
import { GlobalStyle } from '../constants/theme';

const SQUARE_POINTS = [
  { x: 20, y: 20 },
  { x: 180, y: 20 },
  { x: 180, y: 380 },
  { x: 20, y: 380 },
];

// 2-point horizontal fixture with known bar geometry.
const HORIZONTAL_SEGMENT = [
  { x: 20, y: 100 },
  { x: 180, y: 100 },
];

function collectNodes(node: any, visit: (node: any) => void) {
  if (!node) {
    return;
  }
  visit(node);
  for (const child of node.children ?? []) {
    collectNodes(child, visit);
  }
}

describe('TraceInk', () => {
  it('renders N−1 bars for N points under the trace-ink root testID', () => {
    render(<TraceInk points={SQUARE_POINTS} />);

    const root = screen.getByTestId('game.picture.trace-ink');
    expect(root.props.children.length).toBe(3);
  });

  it('renders the segment bar with the exact legacy segmentStyle geometry', () => {
    render(<TraceInk points={HORIZONTAL_SEGMENT} />);

    const bar =
      screen.getByTestId('game.picture.trace-ink').props.children[0];
    const style = bar.props.style;
    expect(style.position).toBe('absolute');
    expect(style.left).toBe(20);
    expect(style.top).toBe(99);
    expect(style.width).toBe(160);
    expect(style.height).toBe(2);
    expect(style.borderRadius).toBe(1);
    expect(style.backgroundColor).toBe(GlobalStyle.color.primaryColor);
    expect(style.transform).toEqual([{ rotate: '0deg' }]);
  });

  it('auto-closes nothing: 3 points produce exactly 2 bars (caller composes)', () => {
    render(<TraceInk points={SQUARE_POINTS.slice(0, 3)} />);

    const root = screen.getByTestId('game.picture.trace-ink');
    expect(root.props.children.length).toBe(2);
  });

  it.each([
    { name: 'empty', points: [] as Array<{ x: number; y: number }> },
    { name: 'single-point', points: [{ x: 10, y: 10 }] },
  ])('renders nothing for a $name polyline (<2 points)', ({ points }) => {
    render(<TraceInk points={points} />);

    expect(screen.queryByTestId('game.picture.trace-ink')).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  it('honors custom strokeWidth and color props', () => {
    render(<TraceInk points={HORIZONTAL_SEGMENT} strokeWidth={5} color="#123456" />);

    const style =
      screen.getByTestId('game.picture.trace-ink').props.children[0].props
        .style;
    expect(style.height).toBe(5);
    expect(style.borderRadius).toBe(2.5);
    expect(style.backgroundColor).toBe('#123456');
  });

  it('renders a caller-composed previewStyle bar after the consecutive bars', () => {
    const preview = traceSegmentStyle(
      SQUARE_POINTS[2],
      SQUARE_POINTS[0]
    );
    render(<TraceInk points={SQUARE_POINTS.slice(0, 3)} previewStyle={preview} />);

    const children =
      screen.getByTestId('game.picture.trace-ink').props.children;
    expect(children.length).toBe(3);
    const lastBar = children[children.length - 1];
    const [start, end] = [SQUARE_POINTS[2], SQUARE_POINTS[0]];
    const expected = traceSegmentStyle(start, end);
    expect(lastBar.props.style).toEqual(expected);
  });

  it('skips zero-length segments instead of rendering empty bars', () => {
    render(
      <TraceInk
        points={[
          { x: 20, y: 20 },
          { x: 20, y: 20 },
          { x: 180, y: 20 },
        ]}
      />
    );

    const root = screen.getByTestId('game.picture.trace-ink');
    expect(root.props.children.length).toBe(1);
  });

  describe('memo effectiveness', () => {
    it('compares segment styles by value (the memo gate)', () => {
      const styleA = traceSegmentStyle({ x: 20, y: 100 }, { x: 180, y: 100 });
      const styleA2 = traceSegmentStyle({ x: 20, y: 100 }, { x: 180, y: 100 });
      const styleB = traceSegmentStyle({ x: 0, y: 0 }, { x: 10, y: 0 });

      expect(areSegmentStylesEqual(styleA, styleA)).toBe(true);
      expect(areSegmentStylesEqual(styleA, styleA2)).toBe(true);
      expect(areSegmentStylesEqual(styleA, styleB)).toBe(false);
      expect(areSegmentStylesEqual(styleA, null)).toBe(false);
      expect(areSegmentStylesEqual(null, styleA)).toBe(false);
    });

    it('wires the value comparator into the memoized bar component', () => {
      const memoTag = (TraceInkSegment as any).$$typeof;
      expect(memoTag).toBe(Symbol.for('react.memo'));
      expect((TraceInkSegment as any).compare).toBe(areSegmentPropsEqual);
    });

    it('blocks re-renders for value-equal restyles through real React.memo', () => {
      const renderBar = jest.fn(({ style }: { style: TraceSegmentStyle }) => (
        <View style={style} />
      ));
      const MemoDouble = memo(renderBar, areSegmentPropsEqual);
      const styleA = traceSegmentStyle(
        { x: 20, y: 100 },
        { x: 180, y: 100 }
      )!;
      const styleA2 = traceSegmentStyle(
        { x: 20, y: 100 },
        { x: 180, y: 100 }
      )!;

      const { rerender } = render(<MemoDouble style={styleA} />);
      expect(renderBar).toHaveBeenCalledTimes(1);

      rerender(<MemoDouble style={styleA2} />);
      expect(renderBar).toHaveBeenCalledTimes(1);

      rerender(
        <MemoDouble
          style={traceSegmentStyle({ x: 0, y: 0 }, { x: 10, y: 0 })!}
        />
      );
      expect(renderBar).toHaveBeenCalledTimes(2);
    });

    it('recomputes value-equal styles for untouched segments when a point is appended (only 1 new bar)', () => {
      const first = render(
        <TraceInk points={SQUARE_POINTS.slice(0, 3)} />
      );
      const before = screen
        .getByTestId('game.picture.trace-ink')
        .props.children.map((bar: any) => bar.props.style);

      first.rerender(<TraceInk points={SQUARE_POINTS} />);

      const children =
        screen.getByTestId('game.picture.trace-ink').props.children;
      expect(children.length).toBe(3);
      // Untouched segments keep their exact geometry values, so the memo
      // comparator (proven above) blocks their re-render.
      expect(children[0].props.style).toEqual(before[0]);
      expect(children[1].props.style).toEqual(before[1]);
      expect(children[2].props.style).not.toEqual(before[0]);
    });
  });
});

describe('TraceInk exported style builder', () => {
  it('produces the legacy geometry for a known 2-point fixture', () => {
    const style = traceSegmentStyle({ x: 20, y: 100 }, { x: 180, y: 100 });
    expect(style).toEqual({
      position: 'absolute',
      left: 20,
      top: 99,
      width: 160,
      height: 2,
      borderRadius: 1,
      backgroundColor: GlobalStyle.color.primaryColor,
      transform: [{ rotate: '0deg' }],
    });
  });

  it('returns null for a zero-length segment', () => {
    expect(traceSegmentStyle({ x: 5, y: 5 }, { x: 5, y: 5 })).toBeNull();
  });

  it('honors strokeWidth and color overrides', () => {
    const style = traceSegmentStyle(
      { x: 0, y: 0 },
      { x: 30, y: 40 },
      6,
      '#abcdef'
    );
    expect(style?.height).toBe(6);
    expect(style?.borderRadius).toBe(3);
    expect(style?.backgroundColor).toBe('#abcdef');
    expect(style?.width).toBe(50);
    expect(style?.transform).toEqual([{ rotate: `${(Math.atan2(40, 30) * 180) / Math.PI}deg` }]);
  });

  it('rotates the bar around its midpoint for a diagonal segment', () => {
    const style = traceSegmentStyle({ x: 20, y: 100 }, { x: 180, y: 300 })!;
    expect(style.left + style.width / 2).toBeCloseTo(100, 6);
    expect(style.top + style.height / 2).toBeCloseTo(200, 6);
  });
});

describe('TraceCorridorEdges', () => {
  const BAND_DISTANCE = 24;
  const EDGE_LEFT_TEST_ID = 'game.picture.trace-corridor-edge-left';
  const EDGE_RIGHT_TEST_ID = 'game.picture.trace-corridor-edge-right';

  it('renders exactly 2 thin polylines (left + right edge testIDs)', () => {
    render(
      <TraceCorridorEdges trace={SQUARE_POINTS} distance={BAND_DISTANCE} />
    );

    expect(screen.getByTestId(EDGE_LEFT_TEST_ID)).toBeTruthy();
    expect(screen.getByTestId(EDGE_RIGHT_TEST_ID)).toBeTruthy();
    expect(screen.getByTestId(EDGE_LEFT_TEST_ID).props.children.length).toBeGreaterThan(0);
    expect(screen.getByTestId(EDGE_RIGHT_TEST_ID).props.children.length).toBeGreaterThan(0);
  });

  it('renders every bar at the strokeWidth prop (default 1)', () => {
    const { rerender } = render(
      <TraceCorridorEdges trace={SQUARE_POINTS} distance={BAND_DISTANCE} />
    );

    for (const testID of [EDGE_LEFT_TEST_ID, EDGE_RIGHT_TEST_ID]) {
      for (const bar of screen.getByTestId(testID).props.children) {
        expect(bar.props.style.height).toBe(1);
        expect(bar.props.style.borderRadius).toBe(0.5);
      }
    }

    rerender(
      <TraceCorridorEdges
        trace={SQUARE_POINTS}
        distance={BAND_DISTANCE}
        strokeWidth={3}
      />
    );
    for (const testID of [EDGE_LEFT_TEST_ID, EDGE_RIGHT_TEST_ID]) {
      for (const bar of screen.getByTestId(testID).props.children) {
        expect(bar.props.style.height).toBe(3);
      }
    }
  });

  it('never renders translucent fat bars (no node with height = distance, no opacity < 1)', () => {
    render(
      <TraceCorridorEdges trace={SQUARE_POINTS} distance={BAND_DISTANCE} />
    );

    const tree = screen.toJSON();
    collectNodes(tree, (node) => {
      const style = node?.props?.style;
      const flat = Array.isArray(style)
        ? Object.assign({}, ...style)
        : style ?? {};
      expect(flat.height).not.toBe(BAND_DISTANCE);
      if (flat.opacity !== undefined) {
        expect(flat.opacity).toBe(1);
      }
    });
  });

  it('is memoized like TraceInk (React.memo wrapper)', () => {
    expect((TraceCorridorEdges as any).$$typeof).toBe(
      Symbol.for('react.memo')
    );
  });

  it.each([
    { name: 'empty', trace: [] as Array<{ x: number; y: number }> },
    { name: 'single-point', trace: [{ x: 10, y: 10 }] },
  ])('renders nothing for a $name trace (<2 points)', ({ trace }) => {
    render(<TraceCorridorEdges trace={trace} distance={BAND_DISTANCE} />);

    expect(screen.queryByTestId(EDGE_LEFT_TEST_ID)).toBeNull();
    expect(screen.queryByTestId(EDGE_RIGHT_TEST_ID)).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  it('offsets the edges to ±distance around the trace geometry', () => {
    render(
      <TraceCorridorEdges
        trace={[
          { x: 10, y: 50 },
          { x: 110, y: 50 },
        ]}
        distance={20}
      />
    );

    const leftBars = screen.getByTestId(EDGE_LEFT_TEST_ID).props.children;
    expect(leftBars[0].props.style.top).toBeCloseTo(30 - 1 / 2, 6);
    const rightBars = screen.getByTestId(EDGE_RIGHT_TEST_ID).props.children;
    expect(rightBars[0].props.style.top).toBeCloseTo(70 - 1 / 2, 6);
  });
});
