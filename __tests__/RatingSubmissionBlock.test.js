jest.mock('../components/UI/StarRatingLine', () => {
  const React = require('react');
  function MockStarRatingLine(props) {
    return null;
  }
  MockStarRatingLine.displayName = 'MockStarRatingLine';
  return MockStarRatingLine;
});

jest.mock('../utils/ratingRequests', () => ({
  submitRating: jest.fn(),
  addImageTag: jest.fn(),
  deleteImageTag: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  getUserTags: jest.fn(),
  saveUserTag: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import RatingSubmissionBlock from '../components/Results/RatingSubmissionBlock';
import { addImageTag, submitRating } from '../utils/ratingRequests';
import { getUserTags, saveUserTag } from '../utils/storageDatum';

const DEFAULT_CONTEXT = { token: 'Bearer t', userId: '42' };

function findStarLineByPrefix(renderer, prefix) {
  return renderer.root.findByProps({ testIDPrefix: prefix });
}

function findTestID(renderer, testID) {
  return renderer.root.findByProps({ testID });
}

function findAllTestID(renderer, testID) {
  return renderer.root.findAllByProps({ testID });
}

describe('RatingSubmissionBlock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    getUserTags.mockResolvedValue([]);
    saveUserTag.mockResolvedValue([]);
    addImageTag.mockResolvedValue({ data: { id: 'tag-1', name: 'scenic' } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderBlock(overrides = {}) {
    const props = {
      pictureId: 'image-1',
      context: DEFAULT_CONTEXT,
      ...overrides,
    };

    let renderer;
    await act(async () => {
      renderer = create(<RatingSubmissionBlock {...props} />);
    });

    return renderer;
  }

  async function flushPromises() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('renders nothing when pictureId is undefined', async () => {
    let renderer;
    await act(async () => {
      renderer = create(
        <RatingSubmissionBlock pictureId={undefined} context={DEFAULT_CONTEXT} />
      );
    });

    expect(renderer.toJSON()).toBeNull();
    expect(submitRating).not.toHaveBeenCalled();
  });

  it('phase rating renders exactly one StarRatingLine using the result.rating.global prefix', async () => {
    const renderer = await renderBlock();

    const globalLine = findStarLineByPrefix(renderer, 'result.rating.global');
    expect(globalLine).toBeTruthy();
    expect(globalLine.props.value).toBe(0);
    expect(globalLine.props.starSize).toBe(48);
    expect(globalLine.props.widthPercent).toBe(90);

    expect(
      renderer.root.findAllByType(
        jest.requireMock('../components/UI/StarRatingLine')
      )
    ).toHaveLength(1);
  });

  it('auto-submits global_rating after debounce when a global star is selected', async () => {
    submitRating.mockResolvedValue({ data: { id: 'r1' } });

    const renderer = await renderBlock();

    const globalLine = findStarLineByPrefix(renderer, 'result.rating.global');

    await act(async () => {
      globalLine.props.onChange(5);
    });

    expect(submitRating).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    await flushPromises();

    expect(submitRating).toHaveBeenCalledTimes(1);
    expect(submitRating).toHaveBeenCalledWith({
      pictureId: 'image-1',
      context: DEFAULT_CONTEXT,
      payload: { global_rating: 5 },
    });
  });

  it('invokes onSubmitted once after a successful auto-submit', async () => {
    submitRating.mockResolvedValue({ data: { id: 'r1' } });
    const onSubmitted = jest.fn();

    const renderer = await renderBlock({ onSubmitted });

    const globalLine = findStarLineByPrefix(renderer, 'result.rating.global');

    await act(async () => {
      globalLine.props.onChange(5);
    });
    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    await flushPromises();

    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it('does not render a Validate button', async () => {
    const renderer = await renderBlock();

    expect(findAllTestID(renderer, 'result.rating.validate')).toHaveLength(0);
  });

  it('transitions to submitted phase with two links and no global star after auto-submit', async () => {
    submitRating.mockResolvedValue({ data: { id: 'r1' } });

    const renderer = await renderBlock();

    expect(findAllTestID(renderer, 'result.rating.tags.link')).toHaveLength(0);
    expect(findAllTestID(renderer, 'result.rating.details.link')).toHaveLength(0);

    const globalLine = findStarLineByPrefix(renderer, 'result.rating.global');

    await act(async () => {
      globalLine.props.onChange(5);
    });
    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    await flushPromises();

    expect(
      findAllTestID(renderer, 'result.rating.global')
    ).toHaveLength(0);
    expect(findTestID(renderer, 'result.rating.tags.link')).toBeTruthy();
    expect(findTestID(renderer, 'result.rating.details.link')).toBeTruthy();
  });

  it('details flow submits global plus filled sub-rating and closes the modal', async () => {
    submitRating.mockResolvedValueOnce({ data: { id: 'r1' } });
    submitRating.mockResolvedValue({ data: { id: 'r1-updated' } });

    const renderer = await renderBlock();

    const globalLine = findStarLineByPrefix(renderer, 'result.rating.global');
    await act(async () => {
      globalLine.props.onChange(5);
    });
    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    await flushPromises();

    await act(async () => {
      findTestID(renderer, 'result.rating.details.link').props.onPress();
    });

    const MockStarRatingLine = jest.requireMock('../components/UI/StarRatingLine');
    const lines = renderer.root.findAllByType(MockStarRatingLine);
    const prefixes = lines.map((node) => node.props.testIDPrefix);
    expect(prefixes).toEqual([
      'result.rating.detail.quality',
      'result.rating.detail.enigma',
      'result.rating.detail.fun',
      'result.rating.detail.difficulty',
    ]);

    await act(async () => {
      findStarLineByPrefix(renderer, 'result.rating.detail.quality').props.onChange(3);
    });

    await act(async () => {
      await findTestID(renderer, 'result.rating.details.save').props.onPress();
    });

    expect(submitRating).toHaveBeenLastCalledWith({
      pictureId: 'image-1',
      context: DEFAULT_CONTEXT,
      payload: { global_rating: 5, quality_rating: 3 },
    });

    const detailLines = renderer.root
      .findAllByType(MockStarRatingLine)
      .filter((node) => node.props.testIDPrefix?.startsWith('result.rating.detail.'));
    const stillVisibleCount = detailLines.filter((node) => {
      let cursor = node;
      while (cursor?.parent) {
        if (cursor.type === 'Modal' && cursor.props.visible === false) {
          return false;
        }
        cursor = cursor.parent;
      }
      return true;
    }).length;
    expect(stillVisibleCount).toBe(0);
  });

  it('tags flow adds a visible chip via addImageTag', async () => {
    submitRating.mockResolvedValue({ data: { id: 'r1' } });
    addImageTag.mockResolvedValue({ data: { id: 'tag-9', name: 'night walk' } });

    const renderer = await renderBlock();

    const globalLine = findStarLineByPrefix(renderer, 'result.rating.global');
    await act(async () => {
      globalLine.props.onChange(5);
    });
    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    await flushPromises();

    await act(async () => {
      findTestID(renderer, 'result.rating.tags.link').props.onPress();
    });

    await act(async () => {
      findTestID(renderer, 'result.rating.tags.input').props.onChangeText('Night Walk');
    });

    await act(async () => {
      await findTestID(renderer, 'result.rating.tags.add').props.onPress();
    });

    expect(addImageTag).toHaveBeenCalledWith({
      pictureId: 'image-1',
      context: DEFAULT_CONTEXT,
      name: 'night walk',
    });
    expect(saveUserTag).toHaveBeenCalledWith('night walk');
    expect(
      findTestID(renderer, 'result.rating.tags.chip.night%20walk')
    ).toBeTruthy();
  });
});
