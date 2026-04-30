const mockBigButton = jest.fn(() => null);

jest.mock('../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    mockBigButton(props);
    return null;
  };
});

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import ResultChoices from '../components/Results/ResultChoices';
import { AuthContext } from '../store/auth-context';

describe('ResultChoices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function getButtonProps(text) {
    const buttonCall = mockBigButton.mock.calls.find(([props]) => props.text === text);
    return buttonCall?.[0];
  }

  it('returns to HomeScreen and persists tutorial progress when needed', async () => {
    const navigation = { reset: jest.fn() };
    const updateTutorialStatus = jest.fn().mockResolvedValue(undefined);

    await act(async () => {
      create(
        <AuthContext.Provider value={{
          updateTutorialStatus,
          isTutorialFinished: { hidePathDone: false },
        }}>
          <ResultChoices navigation={navigation} success={true} isTutorial={true} />
        </AuthContext.Provider>
      );
    });

    await act(async () => {
      await getButtonProps('Go to Home').onPress();
    });

    expect(updateTutorialStatus).toHaveBeenCalledWith({
      isTutorial: true,
      guessPathDone: true,
      hidePathDone: false,
    });
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'HomeScreen', params: { isTutorial: true } }],
    });
  });

  it('offers retry and next-image flows when the guess failed', async () => {
    const navigation = { reset: jest.fn() };
    const retryGuess = jest.fn();

    await act(async () => {
      create(
        <AuthContext.Provider value={{ updateTutorialStatus: jest.fn(), isTutorialFinished: {} }}>
          <ResultChoices
            navigation={navigation}
            success={false}
            retryGuess={retryGuess}
            isTutorial={false}
          />
        </AuthContext.Provider>
      );
    });

    getButtonProps('Retry this one').onPress();
    getButtonProps('Another one').onPress();

    expect(retryGuess).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1,
      routes: [{ name: 'GuessPathScreen', params: { isTutorial: false } }],
    });
  });
});