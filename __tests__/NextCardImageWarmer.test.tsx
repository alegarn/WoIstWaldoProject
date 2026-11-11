import React from 'react';
import { StyleSheet } from 'react-native';
import { render, RenderResult } from '@testing-library/react-native';

import NextCardImageWarmer from '../components/Picture/NextCardImageWarmer';

// v14 test-renderer instances expose only host component type names, so the
// old UNSAFE_getByType(Image/View) seams are replaced by host-type queries.
function findAllImages(view: RenderResult) {
  return view.container.queryAll((node) => node.type === 'Image');
}

function findHiddenWrapperView(view: RenderResult) {
  const matches = view.container.queryAll(
    (node) => node.type === 'View' && node.props.pointerEvents === 'none',
  );
  if (matches.length === 0) throw new Error('hidden wrapper View not rendered');
  return matches[0];
}

describe('NextCardImageWarmer', () => {
  it('renders null when uris is []', async () => {
    const view = await render(<NextCardImageWarmer uris={[]} />);

    expect(findAllImages(view)).toHaveLength(0);
  });

  it('renders null when uris contains only null/undefined/empty entries', async () => {
    const view = await render(
      <NextCardImageWarmer uris={[null, undefined, '']} />,
    );

    expect(findAllImages(view)).toHaveLength(0);
  });

  it('renders N hidden Images for N valid uris', async () => {
    const view = await render(
      <NextCardImageWarmer uris={['file://a', 'file://b', 'file://c']} />,
    );

    expect(findAllImages(view)).toHaveLength(3);
  });

  it('skips null and empty entries in a mixed list', async () => {
    const view = await render(
      <NextCardImageWarmer uris={['file://a', null, '', 'file://b']} />,
    );

    expect(findAllImages(view)).toHaveLength(2);
  });

  it('caps at 7 images', async () => {
    const uris = Array.from({ length: 10 }, (_, i) => `file://${i}`);
    const view = await render(<NextCardImageWarmer uris={uris} />);

    expect(findAllImages(view)).toHaveLength(7);
  });

  it('uses the hidden-Image style', async () => {
    const view = await render(
      <NextCardImageWarmer uris={['file://a']} />,
    );

    const [image] = findAllImages(view);
    const style = StyleSheet.flatten(image.props.style);

    expect(style.opacity).toBe(0);
    expect(style.width).toBe(1);
    expect(style.height).toBe(1);
    expect(style.position).toBe('absolute');
  });

  it("parent View has pointerEvents='none'", async () => {
    const view = await render(
      <NextCardImageWarmer uris={['file://a']} />,
    );

    const wrapper = findHiddenWrapperView(view);

    expect(wrapper.props.pointerEvents).toBe('none');
  });

  it('each Image receives the correct uri', async () => {
    const view = await render(
      <NextCardImageWarmer
        uris={['file://a', null, '', 'file://b', 'file://c']}
      />,
    );

    const uris = findAllImages(view).map(
      (img) => img.props.source.uri,
    );

    expect(uris).toEqual(['file://a', 'file://b', 'file://c']);
  });
});
