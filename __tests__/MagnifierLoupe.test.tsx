// MagnifierLoupe behavior suite.
//
// MagnifierLoupe is the dumb presentational magnifying glass (D2/D9): it owns
// NO math and NO gestures. Animated position styles come IN from `useLoupe`
// (frame = container-space loupeLayout output, content = image-space
// loupeContentTransform output); everything else is static props.
//
// Two-space fixtures (D8): the frame fixture is built from a CONTAINER anchor
// (260, 500); the content fixture from an IMAGE anchor (100, 200).

import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { act, render, screen } from '@testing-library/react-native';

import MagnifierLoupe, {
  type MagnifierLoupeProps,
} from '../components/Picture/MagnifierLoupe';
import {
  LOUPE_CURSOR_SIZE_PX,
  LOUPE_DIAMETER_PX,
  LOUPE_ZOOM,
  loupeContentTransform,
  loupeLayout,
} from '../utils/loupeGeometry';

const SCREEN = { width: 360, height: 800 };
const CONTAINER_ANCHOR = { x: 260, y: 500 };
const IMAGE_ANCHOR = { x: 100, y: 200 };
const IMAGE_DIMS = { width: 320, height: 240 };
const URI = 'https://example.com/picture.jpg';

type Fixture = {
  frameX: Animated.Value;
  frameY: Animated.Value;
  contentX: Animated.Value;
  contentY: Animated.Value;
  frameStyle: MagnifierLoupeProps['frameStyle'];
  contentStyle: MagnifierLoupeProps['contentStyle'];
  expectedFrame: { left: number; top: number };
  expectedContent: { translateX: number; translateY: number };
};

function buildFixture(): Fixture {
  const expectedFrame = loupeLayout({ anchor: CONTAINER_ANCHOR, screen: SCREEN });
  const expectedContent = loupeContentTransform({
    anchor: IMAGE_ANCHOR,
    zoom: LOUPE_ZOOM,
    diameter: LOUPE_DIAMETER_PX,
  });

  const frameX = new Animated.Value(expectedFrame.left);
  const frameY = new Animated.Value(expectedFrame.top);
  const contentX = new Animated.Value(expectedContent.translateX);
  const contentY = new Animated.Value(expectedContent.translateY);

  return {
    frameX,
    frameY,
    contentX,
    contentY,
    frameStyle: { position: 'absolute', left: frameX, top: frameY, opacity: 1 },
    contentStyle: {
      transform: [{ translateX: contentX }, { translateY: contentY }],
    },
    expectedFrame,
    expectedContent,
  };
}

function baseProps(
  fixture: Fixture,
  overrides: Partial<MagnifierLoupeProps> = {},
): MagnifierLoupeProps {
  return {
    visible: true,
    frameStyle: fixture.frameStyle,
    contentStyle: fixture.contentStyle,
    zoom: LOUPE_ZOOM,
    diameter: LOUPE_DIAMETER_PX,
    uri: URI,
    imageDimensionStyle: IMAGE_DIMS,
    children: null,
    ...overrides,
  };
}

function styleOf(node: ReactTestInstance | null): Record<string, any> {
  return StyleSheet.flatten(node?.props.style ?? {}) ?? {};
}

function readValue(value: Animated.Value): number {
  return (value as unknown as { __getValue(): number }).__getValue();
}

function findAllByStyle(
  root: ReactTestInstance,
  predicate: (style: Record<string, any>) => boolean,
): ReactTestInstance[] {
  // Host nodes only: composite Animated nodes carry the raw pre-resolved
  // style and would duplicate every match.
  return root.findAll(
    (node) => typeof node.type === 'string' && predicate(styleOf(node)),
  );
}

describe('MagnifierLoupe', () => {
  it('renders nothing when visible=false', () => {
    const fixture = buildFixture();
    render(<MagnifierLoupe {...baseProps(fixture, { visible: false })} />);

    expect(screen.queryByTestId('game.picture.loupe')).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  it('renders the clipped circle with a centred crosshair cursor when visible', () => {
    const fixture = buildFixture();
    render(<MagnifierLoupe {...baseProps(fixture)} />);

    const loupe = screen.getByTestId('game.picture.loupe');
    expect(loupe.props.pointerEvents).toBe('none');

    const circles = findAllByStyle(
      loupe,
      (style) =>
        style.borderRadius === LOUPE_DIAMETER_PX / 2 &&
        style.overflow === 'hidden',
    );
    expect(circles).toHaveLength(1);
    expect(styleOf(circles[0]).width).toBe(LOUPE_DIAMETER_PX);
    expect(styleOf(circles[0]).height).toBe(LOUPE_DIAMETER_PX);

    const cursor = screen.getByTestId('game.picture.loupe-cursor');
    const cursorStyle = styleOf(cursor);
    expect(cursorStyle.position).toBe('absolute');
    expect(cursorStyle.left).toBe(LOUPE_DIAMETER_PX / 2 - LOUPE_CURSOR_SIZE_PX / 2);
    expect(cursorStyle.top).toBe(LOUPE_DIAMETER_PX / 2 - LOUPE_CURSOR_SIZE_PX / 2);
  });

  it('renders the zoomed image with the passed uri and imageDimensionStyle × zoom', () => {
    const fixture = buildFixture();
    render(<MagnifierLoupe {...baseProps(fixture)} />);

    const image = screen.getByTestId('game.picture.loupe-image');
    expect(image.props.source).toEqual({ uri: URI });

    const imageStyle = styleOf(image);
    expect(imageStyle.width).toBe(IMAGE_DIMS.width * LOUPE_ZOOM);
    expect(imageStyle.height).toBe(IMAGE_DIMS.height * LOUPE_ZOOM);
  });

  it('threads the passed animated frame/content styles live and aligns the zoom-scale wrapper (D9)', () => {
    const fixture = buildFixture();
    const { rerender } = render(<MagnifierLoupe {...baseProps(fixture)} />);

    const loupe = screen.getByTestId('game.picture.loupe');
    const frameStyle = styleOf(loupe);
    expect(readValue(fixture.frameX)).toBe(fixture.expectedFrame.left);
    expect(readValue(fixture.frameY)).toBe(fixture.expectedFrame.top);
    expect(frameStyle.left).toBe(fixture.expectedFrame.left);
    expect(frameStyle.top).toBe(fixture.expectedFrame.top);

    const contentNodes = findAllByStyle(loupe, (style) =>
      Array.isArray(style.transform) &&
      style.transform.some((t: any) => 'translateX' in t),
    );
    expect(contentNodes).toHaveLength(1);
    const contentStyle = styleOf(contentNodes[0]);
    expect(contentStyle.transform).toEqual([
      { translateX: fixture.expectedContent.translateX },
      { translateY: fixture.expectedContent.translateY },
    ]);

    // Children wrapper: sized EXACTLY imageDimensionStyle (NOT ×zoom), scaled
    // from the top-left corner — the D9 alignment mechanism.
    const wrappers = findAllByStyle(
      loupe,
      (style) => style.transformOrigin === 'top left',
    );
    expect(wrappers).toHaveLength(1);
    const wrapperStyle = styleOf(wrappers[0]);
    expect(wrapperStyle.width).toBe(IMAGE_DIMS.width);
    expect(wrapperStyle.height).toBe(IMAGE_DIMS.height);
    expect(wrapperStyle.transform).toEqual([{ scale: LOUPE_ZOOM }]);

    // Live binding: the exact fixture Animated.Values drive the rendered
    // styles (setValue flows into the tree without re-rendering the host).
    act(() => {
      fixture.frameX.setValue(10);
      fixture.contentX.setValue(-1);
    });
    expect(styleOf(loupe).left).toBe(10);
    expect(styleOf(contentNodes[0]).transform[0]).toEqual({ translateX: -1 });

    // Deterministic alignment arithmetic: a child drawn at the image anchor
    // (100, 200) inside the scaled wrapper lands exactly at the glass centre.
    const frameLeft = fixture.expectedFrame.left;
    const contentTranslateX = fixture.expectedContent.translateX;
    const glassCentreX = frameLeft + LOUPE_DIAMETER_PX / 2;
    expect(frameLeft + contentTranslateX + IMAGE_ANCHOR.x * LOUPE_ZOOM).toBe(
      glassCentreX,
    );
    rerender(<MagnifierLoupe {...baseProps(fixture)} />);
    expect(styleOf(screen.getByTestId('game.picture.loupe')).left).toBe(10);
  });

  it('carries no outline-like secret prop and ignores unknown extra props (ISP)', () => {
    type Props = MagnifierLoupeProps;
    const noHiddenOutlineGuard: 'hiddenOutline' extends keyof Props ? never : true =
      true;

    const fixture = buildFixture();
    const { rerender } = render(<MagnifierLoupe {...baseProps(fixture)} />);
    const baseline = screen.toJSON();

    const extraProps = {
      ...baseProps(fixture),
      hiddenOutline: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
    } as unknown as MagnifierLoupeProps;
    rerender(<MagnifierLoupe {...extraProps} />);

    expect(screen.queryByTestId('game.picture.shape-outline')).toBeNull();
    expect(screen.toJSON()).toEqual(baseline);
    expect(noHiddenOutlineGuard).toBe(true);
  });

  it('contains no gesture internals', () => {
    const fixture = buildFixture();
    render(<MagnifierLoupe {...baseProps(fixture)} />);

    expect(JSON.stringify(screen.toJSON())).not.toContain('GestureDetector');
  });
});
