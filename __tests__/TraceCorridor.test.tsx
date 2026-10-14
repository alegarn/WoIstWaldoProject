// TraceCorridor behavior suite.
//
// TraceCorridor is the guess-side tolerance band: a pure presentational layer
// that renders the live (post-offset) trace as wide translucent rotated View
// segments — the corridor the player is invited to trace inside. It renders
// ONLY the band: no stored outline, no scoring, no gesture, no copy.
//
// Nothing is mocked: the component is pure react-native (no RNGH), i18n is
// already initialized to 'en' by jest.setup.js (and the component uses none).

import React from 'react';
import { render, screen } from '@testing-library/react-native';

import TraceCorridor from '../components/Picture/TraceCorridor';
import { GlobalStyle } from '../constants/theme';

type CorridorProps = React.ComponentProps<typeof TraceCorridor>;

const BAND_WIDTH = 24;

// 4-point square in px space (post-offset points the 2e slot forwards).
const SQUARE_TRACE = [
  { x: 20, y: 20 },
  { x: 180, y: 20 },
  { x: 180, y: 380 },
  { x: 20, y: 380 },
];

describe('TraceCorridor', () => {
  it('renders the band layer with N−1 segments plus the auto-close preview', () => {
    render(<TraceCorridor trace={SQUARE_TRACE} bandWidth={BAND_WIDTH} />);

    const band = screen.getByTestId('game.picture.trace-band');
    // 3 consecutive segments + 1 auto-close preview segment (length >= 3),
    // mirroring ShapeCanvas live-trace semantics — count, not internals.
    expect(band.props.children.length).toBe(4);
  });

  it.each([
    { name: 'empty', trace: [] as Array<{ x: number; y: number }> },
    { name: 'single-point', trace: [{ x: 10, y: 10 }] },
  ])('renders nothing for a $name trace (<2 points → no band layer)', ({ trace }) => {
    render(<TraceCorridor trace={trace} bandWidth={BAND_WIDTH} />);

    expect(screen.queryByTestId('game.picture.trace-band')).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  it('has no hidden-outline dependency: band only, no outline layer, extra props change nothing', () => {
    // Compile-time guard: fails tsc if the props type ever carries
    // `hiddenOutline` (band must not depend on the stored outline).
    const noHiddenOutlineGuard: 'hiddenOutline' extends keyof CorridorProps
      ? never
      : true = true;

    const { rerender } = render(
      <TraceCorridor trace={SQUARE_TRACE} bandWidth={BAND_WIDTH} />
    );

    const bandOnly = screen.toJSON();

    // No stored-outline layer and no live-trace layer from ShapeCanvas seams.
    expect(screen.queryByTestId('game.picture.shape-outline')).toBeNull();
    expect(screen.queryByTestId('game.picture.shape-trace')).toBeNull();

    // Runtime assertion: unknown/extra props (e.g. a hiddenOutline someone
    // might try to pass) change nothing rendered.
    const extraProps = {
      trace: SQUARE_TRACE,
      bandWidth: BAND_WIDTH,
      hiddenOutline: SQUARE_TRACE,
    } as unknown as CorridorProps;
    rerender(<TraceCorridor {...extraProps} />);

    expect(screen.queryByTestId('game.picture.shape-outline')).toBeNull();
    expect(screen.toJSON()).toEqual(bandOnly);
    expect(noHiddenOutlineGuard).toBe(true);
  });

  it('renders band geometry: segment height = bandWidth, translucent ≠ opaque', () => {
    render(<TraceCorridor trace={SQUARE_TRACE} bandWidth={BAND_WIDTH} />);

    const band = screen.getByTestId('game.picture.trace-band');
    const firstSegment = band.props.children[0];
    const style = firstSegment.props.style;

    expect(style.height).toBe(BAND_WIDTH);
    expect(style.borderRadius).toBe(BAND_WIDTH / 2);
    expect(style.backgroundColor).toBe(GlobalStyle.color.primaryColor);
    expect(style.opacity).toBeGreaterThan(0);
    expect(style.opacity).toBeLessThan(1);
  });

  it('derives segment transform math from midpoint + hypot, same as ShapeCanvas', () => {
    render(<TraceCorridor trace={SQUARE_TRACE} bandWidth={BAND_WIDTH} />);

    const band = screen.getByTestId('game.picture.trace-band');
    const firstSegment = band.props.children[0];
    const style = firstSegment.props.style;

    const [start, end] = [SQUARE_TRACE[0], SQUARE_TRACE[1]];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;

    // First band segment spans trace[0]→trace[1]: horizontal bar centered on
    // the midpoint, rotated around the view center (ShapeCanvas.tsx:30-46).
    expect(style.width).toBeCloseTo(length, 6);
    expect(style.left).toBeCloseTo((start.x + end.x) / 2 - length / 2, 6);
    expect(style.top).toBeCloseTo((start.y + end.y) / 2 - BAND_WIDTH / 2, 6);
    expect(style.transform).toEqual([{ rotate: `${angle}deg` }]);
    expect(style.position).toBe('absolute');
  });
});
