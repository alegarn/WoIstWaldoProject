import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { render } from '@testing-library/react-native';

import NextCardImageWarmer from '../components/Picture/NextCardImageWarmer';

describe('NextCardImageWarmer', () => {
  it('renders null when uris is []', () => {
    const { UNSAFE_getAllByType } = render(<NextCardImageWarmer uris={[]} />);

    expect(() => UNSAFE_getAllByType(Image)).toThrow();
  });

  it('renders null when uris contains only null/undefined/empty entries', () => {
    const { UNSAFE_getAllByType } = render(
      <NextCardImageWarmer uris={[null, undefined, '']} />,
    );

    expect(() => UNSAFE_getAllByType(Image)).toThrow();
  });

  it('renders N hidden Images for N valid uris', () => {
    const { UNSAFE_getAllByType } = render(
      <NextCardImageWarmer uris={['file://a', 'file://b', 'file://c']} />,
    );

    expect(UNSAFE_getAllByType(Image)).toHaveLength(3);
  });

  it('skips null and empty entries in a mixed list', () => {
    const { UNSAFE_getAllByType } = render(
      <NextCardImageWarmer uris={['file://a', null, '', 'file://b']} />,
    );

    expect(UNSAFE_getAllByType(Image)).toHaveLength(2);
  });

  it('caps at 7 images', () => {
    const uris = Array.from({ length: 10 }, (_, i) => `file://${i}`);
    const { UNSAFE_getAllByType } = render(<NextCardImageWarmer uris={uris} />);

    expect(UNSAFE_getAllByType(Image)).toHaveLength(7);
  });

  it('uses the hidden-Image style', () => {
    const { UNSAFE_getAllByType } = render(
      <NextCardImageWarmer uris={['file://a']} />,
    );

    const [image] = UNSAFE_getAllByType(Image);
    const style = StyleSheet.flatten(image.props.style);

    expect(style.opacity).toBe(0);
    expect(style.width).toBe(1);
    expect(style.height).toBe(1);
    expect(style.position).toBe('absolute');
  });

  it("parent View has pointerEvents='none'", () => {
    const { UNSAFE_getByType } = render(
      <NextCardImageWarmer uris={['file://a']} />,
    );

    const view = UNSAFE_getByType(View);

    expect(view.props.pointerEvents).toBe('none');
  });

  it('each Image receives the correct uri', () => {
    const { UNSAFE_getAllByType } = render(
      <NextCardImageWarmer
        uris={['file://a', null, '', 'file://b', 'file://c']}
      />,
    );

    const uris = UNSAFE_getAllByType(Image).map(
      (img) => img.props.source.uri,
    );

    expect(uris).toEqual(['file://a', 'file://b', 'file://c']);
  });
});
