const mockResultChoices = jest.fn(() => null);
const mockImageAnimated = jest.fn(() => null);
const mockTutorialOverlay = jest.fn(() => null);

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

jest.mock('../utils/storageDatum', () => ({
  deleteImageFromStorage: jest.fn(),
  removeImageFromList: jest.fn(),
}));

jest.mock('../utils/scoreRequests', () => ({
  updateUserScore: jest.fn(),
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

describe('ShowSuccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    removeImageFromList.mockResolvedValue(undefined);
    deleteImageFromStorage.mockResolvedValue(undefined);
    updateUserScore.mockResolvedValue({ status: 200 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cleans up storage, updates the score, and reveals result choices after the animation', async () => {
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

    expect(mockImageAnimated).toHaveBeenCalledWith({ success: true });
    expect(removeImageFromList).toHaveBeenCalledWith(7, 'nature', 'fr');
    expect(deleteImageFromStorage).toHaveBeenCalledWith('file:///waldo.jpg');
    expect(updateUserScore).toHaveBeenCalledWith({
      score: 1,
      pictureId: 'image-1',
      context: { userId: '42' },
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
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

    expect(mockResultChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        navigation,
        success: true,
        isTutorial: true,
      })
    );
    expect(mockTutorialOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'ShowSuccess' })
    );
  });
});