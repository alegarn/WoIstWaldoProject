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

    it('keeps untouched segments on their CACHED style objects when a point is appended (append-only cache: only the new segment is rebuilt)', () => {
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
      expect(children[0].props.style).toBe(before[0]);
      expect(children[1].props.style).toBe(before[1]);
      expect(children[2].props.style).not.toBe(before[0]);
      expect(children[2].props.style).not.toBe(before[1]);
    });

    it('builds every segment after an empty mount receives its first polyline (empty-cache append)', () => {
      const first = render(<TraceInk points={[]} />);

      first.rerender(<TraceInk points={SQUARE_POINTS} />);

      const children =
        screen.getByTestId('game.picture.trace-ink').props.children;
      expect(children.length).toBe(3);
      expect(children[0].props.style).toEqual(
        traceSegmentStyle(SQUARE_POINTS[0], SQUARE_POINTS[1])
      );
    });

    it('rebuilds the whole cache for a brand-new stroke that is not a prefix extension (all styles fresh, values correct)', () => {
      const firstStroke = [
        { x: 20, y: 20 },
        { x: 180, y: 20 },
        { x: 180, y: 380 },
      ];
      const secondStroke = [
        { x: 40, y: 40 },
        { x: 160, y: 40 },
        { x: 160, y: 360 },
      ];
      const first = render(<TraceInk points={firstStroke} />);
      const before = screen
        .getByTestId('game.picture.trace-ink')
        .props.children.map((bar: any) => bar.props.style);

      first.rerender(<TraceInk points={secondStroke} />);

      const children =
        screen.getByTestId('game.picture.trace-ink').props.children;
      expect(children.length).toBe(2);
      for (const staleStyle of before) {
        expect(children[0].props.style).not.toBe(staleStyle);
        expect(children[1].props.style).not.toBe(staleStyle);
      }
      expect(children[0].props.style).toEqual(
        traceSegmentStyle(secondStroke[0], secondStroke[1])
      );
      expect(children[1].props.style).toEqual(
        traceSegmentStyle(secondStroke[1], secondStroke[2])
      );
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
