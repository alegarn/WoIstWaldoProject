// MatchRevealOverlay behavior suite.
//
// The overlay is the guess-side graded reveal: a pure presentational absolute
// layer showing the hidden outline (thin distinct segments) plus the verdict
// copy and the numeric match percent. Zero scoring, zero state — verdicts
// arrive as props.
//
// Nothing is mocked: the component is pure react-native + i18n (already
// initialized to 'en' by jest.setup.js). Verdict copy is asserted against the
// real en.json strings via i18n.t().

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import MatchRevealOverlay from '../components/Picture/MatchRevealOverlay';
import i18n from '../i18n';
import { GlobalStyle } from '../constants/theme';

type OverlayProps = React.ComponentProps<typeof MatchRevealOverlay>;

const DIMS = { width: 200, height: 100 };

// Normalized 4-point square spanning x 0→0.5, y 0→1 (open; stored outlines
// close themselves with a repeated first point).
const SQUARE_OUTLINE = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0 },
  { x: 0.5, y: 1 },
  { x: 0, y: 1 },
];

const baseProps: OverlayProps = {
  outcome: 'win',
  scorePercent: 87,
  hiddenOutline: SQUARE_OUTLINE,
  imageDimensionStyle: DIMS,
};

describe('MatchRevealOverlay', () => {
  it('renders nothing when outcome is null', () => {
    render(<MatchRevealOverlay {...baseProps} outcome={null} />);

    expect(screen.queryByTestId('game.picture.trace-reveal')).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  it('renders the win verdict copy from en.json', () => {
    render(<MatchRevealOverlay {...baseProps} outcome="win" />);

    expect(screen.queryByTestId('game.picture.trace-reveal')).not.toBeNull();
    expect(screen.getByTestId('game.picture.trace-reveal-verdict').props.children).toBe(
      i18n.t('game.picture.traceWin')
    );
  });

  it('renders the loseScore verdict copy from en.json', () => {
    render(<MatchRevealOverlay {...baseProps} outcome="loseScore" />);

    expect(screen.getByTestId('game.picture.trace-reveal-verdict').props.children).toBe(
      i18n.t('game.picture.traceLoseScore')
    );
  });

  it('renders the loseLengthCap verdict copy from en.json', () => {
    render(<MatchRevealOverlay {...baseProps} outcome="loseLengthCap" />);

    expect(screen.getByTestId('game.picture.trace-reveal-verdict').props.children).toBe(
      i18n.t('game.picture.traceLoseLengthCap')
    );
  });

  it('renders the match percent as its own numeric text with the % sign', () => {
    render(<MatchRevealOverlay {...baseProps} scorePercent={87} />);

    expect(screen.getByTestId('game.picture.trace-reveal-percent').props.children).toBe('87%');
  });

  it('renders continuously across rerenders while the outcome stays set', () => {
    const { rerender } = render(<MatchRevealOverlay {...baseProps} />);

    rerender(<MatchRevealOverlay {...baseProps} />);

    expect(screen.queryByTestId('game.picture.trace-reveal')).not.toBeNull();
    expect(screen.getByTestId('game.picture.trace-reveal-verdict').props.children).toBe(
      i18n.t('game.picture.traceWin')
    );
  });

  it('renders the hidden outline scaled to px, distinct, non-blocking', () => {
    render(<MatchRevealOverlay {...baseProps} />);

    const root = screen.getByTestId('game.picture.trace-reveal');
    // Repo pattern: pointerEvents lives in the layer style (ShapeCanvas seam).
    const hasPointerEventsNone = (element: ReactTestInstance) => {
      const style = element.props.style as unknown;
      return (Array.isArray(style) ? style : [style]).some(
        (entry) => entry && entry.pointerEvents === 'none'
      );
    };
    expect(hasPointerEventsNone(root)).toBe(true);

    const outlineLayer = screen.getByTestId('game.picture.trace-reveal-outline');
    expect(hasPointerEventsNone(outlineLayer)).toBe(true);

    // N−1 segments between consecutive vertices (stored outlines are closed
    // upstream; no auto-close segment here).
    const segments = outlineLayer.props.children;
    expect(segments).toHaveLength(SQUARE_OUTLINE.length - 1);

    // First segment spans outline[0]→outline[1] scaled by the dimension style:
    // (0,0)→(100,0) px.
    const style = segments[0].props.style;
    expect(style.width).toBeCloseTo(100, 6);
    expect(style.left).toBeCloseTo(0, 6);
    expect(style.top).toBeCloseTo(-1, 6);
    expect(style.height).toBeGreaterThan(0);
    expect(style.backgroundColor).toBe(GlobalStyle.color.primaryColor500);
  });
});
