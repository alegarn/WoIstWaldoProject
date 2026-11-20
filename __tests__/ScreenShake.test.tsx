import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';

import ScreenShake, { type ScreenShakeProps } from '../components/Guess/celebration/ScreenShake';

const TEST_ID = 'guess.success.celebration.shake';

type TransformStep = Record<string, unknown>;

function findByTestID(root: ReactTestInstance, testID: string): ReactTestInstance[] {
  return root.findAll(node => typeof node === 'object' && node !== null && (node as ReactTestInstance).props && (node as ReactTestInstance).props.testID === testID);
}

function findShaker(root: ReactTestInstance): ReactTestInstance {
  const matches = findByTestID(root, TEST_ID);
  if (matches.length === 0) {
    throw new Error(`No node found with testID ${TEST_ID}`);
  }
  return matches[0];
}

function findTransform(root: ReactTestInstance): TransformStep[] {
  const node = findShaker(root);
  const style = (node.props as { style?: unknown }).style || {};
  const styleObj = (Array.isArray(style) ? Object.assign({}, ...style) : style) as { transform?: TransformStep[] };
  return styleObj.transform || [];
}

function renderShake(props: Partial<Omit<ScreenShakeProps, 'children'>>): ReturnType<typeof create> {
  let r: ReturnType<typeof create> | undefined;
  act(() => {
    r = create(
      <ScreenShake {...(props as ScreenShakeProps)}>
        <Text>child-marker</Text>
      </ScreenShake>
    );
  });
  return r as ReturnType<typeof create>;
}

describe('ScreenShake', () => {
  let renderer: ReturnType<typeof create> | null;
  afterEach(() => {
    if (renderer) act(() => { renderer!.unmount(); });
    renderer = null;
  });

  it('renders its children', () => {
    act(() => {
      renderer = renderShake({ active: false, intensity: 8 });
    });
    const texts = renderer!.root.findAllByType(Text).map((n: ReactTestInstance) => (n.props as { children: unknown }).children);
    expect(texts).toContain('child-marker');
  });

  it('applies a transform containing translateX and translateY when active', () => {
    renderer = renderShake({ active: true, intensity: 8 });
    const transform = findTransform(renderer!.root);
    const keys = transform.map(step => Object.keys(step)[0]);
    expect(keys).toContain('translateX');
    expect(keys).toContain('translateY');
  });

  it('renders without throwing when active is false (transform may be identity)', () => {
    expect(() => {
      renderer = renderShake({ active: false, intensity: 8 });
    }).not.toThrow();
    const transform = findTransform(renderer!.root);
    expect(Array.isArray(transform)).toBe(true);
  });

  it('triggers one shake sequence on mount when active without throwing', () => {
    expect(() => {
      renderer = renderShake({ active: true, intensity: 10, durationMs: 300 });
    }).not.toThrow();
  });

  it('stops the animation on unmount without throwing', () => {
    renderer = renderShake({ active: true, intensity: 10 });
    expect(() => {
      act(() => { renderer!.unmount(); });
    }).not.toThrow();
    renderer = null;
  });

  it('defaults intensity to 0 (pass-through, no throw) when omitted', () => {
    expect(() => {
      renderer = renderShake({ active: true });
    }).not.toThrow();
    const texts = renderer!.root.findAllByType(Text).map((n: ReactTestInstance) => (n.props as { children: unknown }).children);
    expect(texts).toContain('child-marker');
  });
});
