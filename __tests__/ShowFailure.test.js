const mockResultChoices = jest.fn(() => null);
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
  return renderer;
}

describe('ShowFailure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNavigateToNextGuess.mockReset();
  });

  it('shows the failure result state immediately with retry choices (no pre-animation)', async () => {
    const navigation = { replace: jest.fn(), reset: jest.fn() };
    const route = buildRoute();

    const renderer = await renderShowFailure({ navigation, route });

    expect(renderer.root.findByProps({ testID: 'result.screen.failure' })).toBeTruthy();

    const title = renderer.root.findByProps({ testID: 'result.screen.failure.title' });
    expect(title.props.children).toContain('😢');

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
  });
});
