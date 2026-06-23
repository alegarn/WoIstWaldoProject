jest.mock('react-native', () => {
  const React = require('react');

  function MockModal({ children }) {
    return React.createElement(React.Fragment, null, children);
  }

  return {
    Modal: MockModal,
    View: 'View',
    Text: 'Text',
    ScrollView: 'ScrollView',
    Pressable: 'Pressable',
    StyleSheet: {
      hairlineWidth: 1,
      create: (styles) => styles,
    },
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import BadgeDetailModal from '../components/UI/BadgeDetailModal';
import { MOCK_IMAGE_DETAILS } from '../data/mock-image-detail';

describe('BadgeDetailModal', () => {
  async function renderModal(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(
        <BadgeDetailModal
          image={MOCK_IMAGE_DETAILS.full}
          onClose={jest.fn()}
          onOpenFilter={jest.fn()}
          testIDPrefix="badge.detail"
          {...overrides}
        />
      );
    });

    return renderer;
  }

  it('renders every detail row for the full fixture', async () => {
    const renderer = await renderModal({ image: MOCK_IMAGE_DETAILS.full });

    expect(renderer.root.findByProps({ testID: 'badge.detail.row.tags' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.category' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.language' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.creator' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.date' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.enigma' })).toBeTruthy();
  });

  it('hides rows whose source values are missing in the sparse fixture', async () => {
    const renderer = await renderModal({ image: MOCK_IMAGE_DETAILS.sparse });

    expect(() => {
      renderer.root.findByProps({ testID: 'badge.detail.row.tags' });
    }).toThrow();
    expect(() => {
      renderer.root.findByProps({ testID: 'badge.detail.row.creator' });
    }).toThrow();

    expect(renderer.root.findByProps({ testID: 'badge.detail.row.category' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.language' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.date' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.enigma' })).toBeTruthy();
  });

  it('calls onClose when the close button is pressed', async () => {
    const onClose = jest.fn();
    const renderer = await renderModal({ onClose });

    await act(async () => {
      renderer.root.findByProps({ testID: 'badge.detail.close' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenFilter when the filter button is pressed', async () => {
    const onOpenFilter = jest.fn();
    const renderer = await renderModal({ onOpenFilter });

    await act(async () => {
      renderer.root.findByProps({ testID: 'badge.detail.filter' }).props.onPress();
    });

    expect(onOpenFilter).toHaveBeenCalledTimes(1);
  });
});