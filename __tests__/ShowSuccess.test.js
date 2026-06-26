const mockResultChoices = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);
const mockRatingSubmissionBlock = jest.fn(() => null);
const mockScoreCelebration = jest.fn(() => null);

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

jest.mock('../components/Results/RatingSubmissionBlock', () => {
  return function MockRatingSubmissionBlock(props) {
    mockRatingSubmissionBlock(props);
    return null;
  };
});

jest.mock('../components/Results/ScoreCelebration', () => {
  return function MockScoreCelebration(props) {
    mockScoreCelebration(props);
    return null;
  };
});

jest.mock('../utils/storageDatum', () => ({
  deleteImageFromStorage: jest.fn(),
  removeImageFromList: jest.fn(),
}));

jest.mock('../utils/scoreRequests', () => ({
  updateUserScore: jest.fn(),
}));

jest.mock('../utils/guessNavigation', () => ({
  navigateToNextGuess: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import ShowSuccess from '../components/Results/ShowSuccess';
import { AuthContext } from '../store/auth-context';
import { deleteImageFromStorage, removeImageFromList } from '../utils/storageDatum';
import { updateUserScore } from '../utils/scoreRequests';
import { navigateToNextGuess } from '../utils/guessNavigation';

describe('ShowSuccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    removeImageFromList.mockResolvedValue(undefined);
    deleteImageFromStorage.mockResolvedValue(undefined);
    updateUserScore.mockResolvedValue({ status: 200 });
    navigateToNextGuess.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cleans up storage, updates the score, shows celebration, hides choices until rated', async () => {
    const navigation = { reset: jest.fn() };
    const route = {
      params: {
        pictureId: 'image-1',
        listId: 7,
        imageFile: 'file:///waldo.jpg',
        isTutorial: true,
        category: { id: 'cat-1', key: 'nature' },
        language: 'fr',
      },
    };

    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ userId: '42' }}>
          <ShowSuccess navigation={navigation} route={route} />
        </AuthContext.Provider>
      );
    });

    expect(removeImageFromList).toHaveBeenCalledWith(7, 'nature', 'fr');
    expect(deleteImageFromStorage).toHaveBeenCalledWith('file:///waldo.jpg');
    expect(updateUserScore).toHaveBeenCalledWith({
      score: 1,
      pictureId: 'image-1',
      context: { userId: '42' },
    });

    const successContainer = renderer.root.findByProps({ testID: 'result.screen.success.container' });
    const successScreen = renderer.root.findByProps({ testID: 'result.screen.success' });
    const title = renderer.root.findByProps({ testID: 'result.screen.success.title' });

    expect(successScreen).toBeTruthy();
    expect(StyleSheet.flatten(successContainer.props.style)).toEqual(
      expect.objectContaining({
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
      })
    );
    expect(StyleSheet.flatten(successScreen.props.style)).toEqual(
      expect.objectContaining({
        width: '100%',
        alignItems: 'center',
      })
    );
    expect(StyleSheet.flatten(title.props.style)).toEqual(
      expect.objectContaining({
        textAlign: 'center',
        color: 'black',
      })
    );

    expect(mockScoreCelebration).toHaveBeenCalledWith(
      expect.objectContaining({ points: 1, testIDPrefix: 'result.celebration' })
    );

    expect(mockRatingSubmissionBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        pictureId: 'image-1',
        context: { userId: '42' },
        onSubmitted: expect.any(Function),
      })
    );

    expect(mockResultChoices).not.toHaveBeenCalled();

    const ratingCall = mockRatingSubmissionBlock.mock.calls.find(
      ([props]) => typeof props.onSubmitted === 'function'
    );
    const onSubmitted = ratingCall[0].onSubmitted;

    await act(async () => {
      onSubmitted();
    });

    expect(mockResultChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        navigation,
        success: true,
        isTutorial: true,
        onNextCard: expect.any(Function),
      })
    );
    expect(mockTutorialOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'ShowSuccess' })
    );
  });

  it('onNextCard delegates to navigateToNextGuess and does not reset when a card is resolved', async () => {
    const navigation = { reset: jest.fn() };
    const category = { id: 'cat-1', key: 'nature' };
    const route = {
      params: {
        pictureId: 'image-1',
        listId: 7,
        imageFile: 'file:///waldo.jpg',
        isTutorial: false,
        category,
        language: 'fr',
      },
    };

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ userId: '42' }}>
          <ShowSuccess navigation={navigation} route={route} />
        </AuthContext.Provider>
      );
    });

    const ratingCall = mockRatingSubmissionBlock.mock.calls.find(
      ([props]) => typeof props.onSubmitted === 'function'
    );
    await act(async () => {
      ratingCall[0].onSubmitted();
    });

    const choicesCall = mockResultChoices.mock.calls.find(
      (props) => typeof props[0].onNextCard === 'function'
    );
    const onNextCard = choicesCall[0].onNextCard;

    navigateToNextGuess.mockResolvedValue(true);

    await act(async () => {
      await onNextCard();
    });

    expect(navigateToNextGuess).toHaveBeenCalledWith(navigation, {
      category,
      language: 'fr',
      currentListId: 7,
      isTutorial: false,
    });
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('onNextCard falls back to feed reset when navigateToNextGuess resolves false', async () => {
    const navigation = { reset: jest.fn() };
    const category = { id: 'cat-1', key: 'nature' };
    const route = {
      params: {
        pictureId: 'image-1',
        listId: 7,
        imageFile: 'file:///waldo.jpg',
        isTutorial: true,
        category,
        language: 'fr',
      },
    };

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ userId: '42' }}>
          <ShowSuccess navigation={navigation} route={route} />
        </AuthContext.Provider>
      );
    });

    const ratingCall = mockRatingSubmissionBlock.mock.calls.find(
      ([props]) => typeof props.onSubmitted === 'function'
    );
    await act(async () => {
      ratingCall[0].onSubmitted();
    });

    const choicesCall = mockResultChoices.mock.calls.find(
      (props) => typeof props[0].onNextCard === 'function'
    );
    const onNextCard = choicesCall[0].onNextCard;

    navigateToNextGuess.mockResolvedValue(false);

    await act(async () => {
      await onNextCard();
    });

    expect(navigateToNextGuess).toHaveBeenCalledWith(navigation, {
      category,
      language: 'fr',
      currentListId: 7,
      isTutorial: true,
    });
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 2,
      routes: [
        { name: 'HomeScreen' },
        { name: 'GuessPathScreen', params: { isTutorial: true } },
        { name: 'GuessFeedScreen', params: { category, language: 'fr' } },
      ],
    });
  });
});
