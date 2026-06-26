const mockResultChoices = jest.fn(() => null);
const mockImageAnimated = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);

jest.mock('../utils/guessNavigation', () => ({
  navigateToNextGuess: jest.fn(),
}));

jest.mock('../components/Results/ResultChoices', () => {
  return function MockResultChoices(props) {
    mockResultChoices(props);
    return null;
  };
});

jest.mock('../components/Results/ImageAnimated', () => {
  return function MockImageAnimated(props) {
    mockImageAnimated(props);
    return null;
  };
});

jest.mock('../components/UI/TutorialOverlay', () => {
  return function MockTutorialOverlay(props) {
    mockTutorialOverlay(props);
    return null;
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import ShowFailure from '../components/Results/ShowFailure';
import { navigateToNextGuess as mockedNavigateToNextGuess } from '../utils/guessNavigation';

function buildRoute(overrides = {}) {
  return {
    params: {
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      description: 'Find Waldo behind the tree.',
      imageHeight: 240,
      imageWidth: 320,
      isPortrait: false,
      hiddenLocation: { x: 0.58, y: 0.46 },
      screenHeight: 640,
      screenWidth: 320,
      isTutorial: true,
      listId: 42,
      category: { key: 'cities', name: 'Cities' },
      language: 'en',
      ...overrides,
    },
  };
}

async function renderShowFailure({ navigation, route }) {
  let renderer;
  await act(async () => {
    renderer = create(<ShowFailure navigation={navigation} route={route} />);
  });
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  return renderer;
}

describe('ShowFailure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedNavigateToNextGuess.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reveals the failure result state and retry choices after the animation', async () => {
    const navigation = { replace: jest.fn(), reset: jest.fn() };
    const route = buildRoute();

    const renderer = await renderShowFailure({ navigation, route });

    expect(mockImageAnimated).toHaveBeenCalledWith({ success: false });

    expect(renderer.root.findByProps({ testID: 'result.screen.failure' })).toBeTruthy();
    expect(mockResultChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        navigation,
        success: false,
        isTutorial: true,
        retryGuess: expect.any(Function),
        onNextCard: expect.any(Function),
        route,
      })
    );
    expect(mockTutorialOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'ShowFailure' })
    );
  });

  it('retries the failed card via navigation.replace when Retry is pressed', async () => {
    const navigation = { replace: jest.fn(), reset: jest.fn() };
    const route = buildRoute();

    await renderShowFailure({ navigation, route });

    const props = mockResultChoices.mock.calls.at(-1)[0];
    props.retryGuess();

    expect(navigation.replace).toHaveBeenCalledWith(
      'GuessScreen',
      expect.objectContaining({ pictureId: 'image-1', isTutorial: true })
    );
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('wires onNextCard to navigateToNextGuess skipping the failed card (currentListId: listId)', async () => {
    const navigation = { replace: jest.fn(), reset: jest.fn() };
    const route = buildRoute({ listId: 42 });

    mockedNavigateToNextGuess.mockResolvedValue(true);

    await renderShowFailure({ navigation, route });

    const props = mockResultChoices.mock.calls.at(-1)[0];
    await act(async () => {
      await props.onNextCard();
    });

    expect(mockedNavigateToNextGuess).toHaveBeenCalledWith(navigation, {
      category: route.params.category,
      language: 'en',
      currentListId: 42,
      isTutorial: true,
    });
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('falls back to a feed navigation.reset when navigateToNextGuess resolves false', async () => {
    const navigation = { replace: jest.fn(), reset: jest.fn() };
    const route = buildRoute();

    mockedNavigateToNextGuess.mockResolvedValue(false);

    await renderShowFailure({ navigation, route });

    const props = mockResultChoices.mock.calls.at(-1)[0];
    await act(async () => {
      await props.onNextCard();
    });

    expect(navigation.reset).toHaveBeenCalledWith({
      index: 2,
      routes: [
        { name: 'HomeScreen' },
        { name: 'GuessPathScreen', params: { isTutorial: true } },
        { name: 'GuessFeedScreen', params: { category: route.params.category, language: 'en' } },
      ],
    });
  });
});
