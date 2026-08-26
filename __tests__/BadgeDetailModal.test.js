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

const LIVE_IMAGE_DETAILS = {
  category: {
    id: 'cat-1',
    key: 'city',
    name: 'City',
  },
  language: 'fr',
  tags: ['scenic', 'night'],
  creatorUsername: 'live_creator',
  createdAt: '2026-01-02T00:00:00Z',
  fullDescription: 'Find Waldo near the bridge.',
  averageRating: 4.5,
  ratingsCount: 9,
  ratings: {
    global_rating: 4,
    quality_rating: 3,
    enigma_rating: 4,
    fun_rating: 5,
    difficulty_rating: 2,
  },
};

function formatExpectedDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

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

    const globalRow = renderer.root.findByProps({ testID: 'badge.detail.row.global-rating' });
    const globalTexts = globalRow
      .findAllByType('Text')
      .map((node) => String(node.props.children));
    expect(globalTexts.join(' ')).toEqual(expect.stringContaining('4.5'));
    expect(globalTexts.join(' ')).toEqual(expect.stringContaining('9'));

    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.detailed-ratings' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.detailed-ratings.quality' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.detailed-ratings.enigma' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.detailed-ratings.fun' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.detailed-ratings.difficulty' })
    ).toBeTruthy();
  });

  it('renders live camelCase image fields with formatted values', async () => {
    const renderer = await renderModal({ image: LIVE_IMAGE_DETAILS });

    expect(renderer.root.findByProps({ testID: 'badge.detail.row.tags' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.category' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.language' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.creator' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.date' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.enigma' })).toBeTruthy();

    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.global-rating' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.detailed-ratings' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.detailed-ratings.quality' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.detailed-ratings.enigma' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.detailed-ratings.fun' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.detailed-ratings.difficulty' })
    ).toBeTruthy();

    expect(renderer.root.findAllByType('Text').map((node) => node.props.children).flat()).toEqual(
      expect.arrayContaining([
        'scenic, night',
        'City',
        'fr',
        'live_creator',
        formatExpectedDate('2026-01-02T00:00:00Z'),
        'Find Waldo near the bridge.',
      ])
    );
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

    expect(
      renderer.root.findByProps({ testID: 'badge.detail.row.global-rating' })
    ).toBeTruthy();
    expect(() => {
      renderer.root.findByProps({ testID: 'badge.detail.row.detailed-ratings' });
    }).toThrow();
  });

  it('hides camelCase rows whose source values are missing', async () => {
    const renderer = await renderModal({
      image: {
        category: { id: 'cat-2', key: 'nature', name: 'Nature' },
        language: 'en',
        tags: [],
        creatorUsername: undefined,
        createdAt: undefined,
        fullDescription: undefined,
      },
    });

    expect(renderer.root.findByProps({ testID: 'badge.detail.row.category' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'badge.detail.row.language' })).toBeTruthy();

    expect(() => {
      renderer.root.findByProps({ testID: 'badge.detail.row.tags' });
    }).toThrow();
    expect(() => {
      renderer.root.findByProps({ testID: 'badge.detail.row.creator' });
    }).toThrow();
    expect(() => {
      renderer.root.findByProps({ testID: 'badge.detail.row.date' });
    }).toThrow();
    expect(() => {
      renderer.root.findByProps({ testID: 'badge.detail.row.enigma' });
    }).toThrow();
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