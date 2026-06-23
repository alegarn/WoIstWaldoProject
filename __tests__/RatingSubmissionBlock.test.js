jest.mock('../components/UI/StarRatingLine', () => {
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

function instancesOf(renderer, type) {
  return renderer.root.findAllByType(type);
}

describe('RatingSubmissionBlock', () => {
  let MockStarRatingLine;

  beforeAll(() => {
    MockStarRatingLine = jest.requireMock('../components/UI/StarRatingLine');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    getUserTags.mockResolvedValue([]);
    saveUserTag.mockResolvedValue([]);
    addImageTag.mockResolvedValue({ data: { id: 'tag-1', name: 'scenic' } });
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

  it('renders the global StarRatingLine using the result.rating.global prefix', async () => {
    const renderer = await renderBlock();

    const globalLine = renderer.root.findByProps({
      testIDPrefix: 'result.rating.global',
    });

    expect(globalLine).toBeTruthy();
    expect(globalLine.props.value).toBe(0);
  });

  it('keeps the Validate button disabled until the global rating is greater than zero', async () => {
    const renderer = await renderBlock();

    const validateBefore = renderer.root.findByProps({
      testID: 'result.rating.validate',
    });
    expect(validateBefore.props.disabled).toBe(true);

    const globalLine = renderer.root.findByProps({
      testIDPrefix: 'result.rating.global',
    });

    await act(async () => {
      globalLine.props.onChange(5);
    });

    const validateAfter = renderer.root.findByProps({
      testID: 'result.rating.validate',
    });
    expect(validateAfter.props.disabled).toBe(false);
  });

  it('expands the four detail rows when "Rate in details" is toggled', async () => {
    const renderer = await renderBlock();

    expect(instancesOf(renderer, MockStarRatingLine)).toHaveLength(1);

    const toggle = renderer.root.findByProps({
      testID: 'result.rating.toggle-details',
    });

    await act(async () => {
      toggle.props.onPress();
    });

    const lines = instancesOf(renderer, MockStarRatingLine);
    expect(lines).toHaveLength(5);

    const prefixes = lines.map((node) => node.props.testIDPrefix);
    expect(prefixes).toEqual([
      'result.rating.global',
      'result.rating.detail.quality',
      'result.rating.detail.enigma',
      'result.rating.detail.fun',
      'result.rating.detail.difficulty',
    ]);
  });

  it('submits only global_rating when no detail ratings are set', async () => {
    submitRating.mockResolvedValue({ data: { id: 'r1', global_rating: 5 } });

    const renderer = await renderBlock();

    const globalLine = renderer.root.findByProps({
      testIDPrefix: 'result.rating.global',
    });

    await act(async () => {
      globalLine.props.onChange(5);
    });

    const validate = renderer.root.findByProps({ testID: 'result.rating.validate' });

    await act(async () => {
      await validate.props.onPress();
    });

    expect(submitRating).toHaveBeenCalledWith({
      pictureId: 'image-1',
      context: DEFAULT_CONTEXT,
      payload: { global_rating: 5 },
    });
  });

  it('includes the optional snake_case sub-ratings when detail ratings are filled', async () => {
    submitRating.mockResolvedValue({ data: { id: 'r1' } });

    const renderer = await renderBlock();

    await act(async () => {
      renderer.root.findByProps({ testID: 'result.rating.toggle-details' }).props.onPress();
    });

    await act(async () => {
      renderer.root
        .findByProps({ testIDPrefix: 'result.rating.global' })
        .props.onChange(4);
    });
    await act(async () => {
      renderer.root
        .findByProps({ testIDPrefix: 'result.rating.detail.quality' })
        .props.onChange(3);
    });
    await act(async () => {
      renderer.root
        .findByProps({ testIDPrefix: 'result.rating.detail.enigma' })
        .props.onChange(2);
    });
    await act(async () => {
      renderer.root
        .findByProps({ testIDPrefix: 'result.rating.detail.fun' })
        .props.onChange(5);
    });
    await act(async () => {
      renderer.root
        .findByProps({ testIDPrefix: 'result.rating.detail.difficulty' })
        .props.onChange(1);
    });

    await act(async () => {
      await renderer.root.findByProps({ testID: 'result.rating.validate' }).props.onPress();
    });

    expect(submitRating).toHaveBeenCalledWith({
      pictureId: 'image-1',
      context: DEFAULT_CONTEXT,
      payload: {
        global_rating: 4,
        quality_rating: 3,
        enigma_rating: 2,
        fun_rating: 5,
        difficulty_rating: 1,
      },
    });
  });

  it('renders the success state when submitRating resolves without isError', async () => {
    submitRating.mockResolvedValue({ data: { id: 'r1', global_rating: 5 } });

    const renderer = await renderBlock();

    await act(async () => {
      renderer.root
        .findByProps({ testIDPrefix: 'result.rating.global' })
        .props.onChange(5);
    });

    await act(async () => {
      await renderer.root.findByProps({ testID: 'result.rating.validate' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'result.rating.success' })).toBeTruthy();
  });

  it('renders the recoverable error state when submitRating resolves with isError', async () => {
    submitRating.mockResolvedValue({ isError: true, message: 'Network Error' });

    const renderer = await renderBlock();

    await act(async () => {
      renderer.root
        .findByProps({ testIDPrefix: 'result.rating.global' })
        .props.onChange(3);
    });

    await act(async () => {
      await renderer.root.findByProps({ testID: 'result.rating.validate' }).props.onPress();
    });

    const errorNode = renderer.root.findByProps({ testID: 'result.rating.error' });
    expect(errorNode.props.children).toBe('Network Error');

    const validateAfter = renderer.root.findByProps({ testID: 'result.rating.validate' });
    expect(validateAfter.props.disabled).toBe(false);
  });

  it('cooperates with e2e mode by accepting a deterministic submitRating fixture', async () => {
    const e2eFixture = {
      data: {
        id: 'e2e-image-rating-id',
        global_rating: 4,
        quality_rating: 4,
        enigma_rating: 3,
        fun_rating: 5,
        difficulty_rating: 2,
      },
    };
    submitRating.mockResolvedValue(e2eFixture);

    const renderer = await renderBlock();

    await act(async () => {
      renderer.root
        .findByProps({ testIDPrefix: 'result.rating.global' })
        .props.onChange(4);
    });

    await act(async () => {
      await renderer.root.findByProps({ testID: 'result.rating.validate' }).props.onPress();
    });

    expect(submitRating).toHaveBeenCalledTimes(1);
    expect(submitRating).toHaveBeenCalledWith({
      pictureId: 'image-1',
      context: DEFAULT_CONTEXT,
      payload: { global_rating: 4 },
    });
    expect(renderer.root.findByProps({ testID: 'result.rating.success' })).toBeTruthy();
  });

  it('hides gracefully without crashing when pictureId is undefined', async () => {
    let renderer;
    await act(async () => {
      renderer = create(
        <RatingSubmissionBlock pictureId={undefined} context={DEFAULT_CONTEXT} />
      );
    });

    expect(renderer.toJSON()).toBeNull();
    expect(submitRating).not.toHaveBeenCalled();
  });

  it('accepts tag input text and adds a visible chip through addImageTag', async () => {
    addImageTag.mockResolvedValue({ data: { id: 'tag-9', name: 'night walk' } });

    const renderer = await renderBlock();

    await act(async () => {
      renderer.root.findByProps({ testID: 'result.rating.tags.input' }).props.onChangeText('Night Walk');
    });

    expect(renderer.root.findByProps({ testID: 'result.rating.tags.input' }).props.value).toBe('Night Walk');

    await act(async () => {
      await renderer.root.findByProps({ testID: 'result.rating.tags.add' }).props.onPress();
    });

    expect(addImageTag).toHaveBeenCalledWith({
      pictureId: 'image-1',
      context: DEFAULT_CONTEXT,
      name: 'night walk',
    });
    expect(saveUserTag).toHaveBeenCalledWith('night walk');
    expect(renderer.root.findByProps({ testID: 'result.rating.tags.chip.night%20walk' })).toBeTruthy();
  });

  it('shows stable tag suggestions from saved user tags while typing', async () => {
    getUserTags.mockResolvedValue(['museum', 'mountain', 'city']);

    const renderer = await renderBlock();

    await act(async () => {
      renderer.root.findByProps({ testID: 'result.rating.tags.input' }).props.onChangeText('m');
    });

    expect(
      renderer.root.findByProps({ testID: 'result.rating.tags.suggestion.museum' })
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: 'result.rating.tags.suggestion.mountain' })
    ).toBeTruthy();
    expect(
      renderer.root.findAllByProps({ testID: 'result.rating.tags.suggestion.city' })
    ).toHaveLength(0);
  });
});
