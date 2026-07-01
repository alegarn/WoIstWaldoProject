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

  function getButtonByTestID(renderer, testID) {
    return renderer.root.findByProps({ testID });
  }

  it('returns to HomeScreen and persists tutorial progress when needed', async () => {
    const navigation = { reset: jest.fn() };
    const updateTutorialStatus = jest.fn().mockResolvedValue(undefined);

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{
          updateTutorialStatus,
          isTutorialFinished: { hidePathDone: false },
        }}>
          <ResultChoices navigation={navigation} success={true} isTutorial={true} />
        </AuthContext.Provider>
      );
    });

    await act(async () => {
      await getButtonByTestID(renderer, 'result.button.home').props.onPress();
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

    let renderer;
    await act(async () => {
      renderer = create(
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

    await act(async () => {
      getButtonByTestID(renderer, 'result.button.retry').props.onPress();
      getButtonByTestID(renderer, 'result.button.next').props.onPress();
    });

    expect(retryGuess).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1,
      routes: [
        { name: 'HomeScreen' },
        { name: 'GuessPathScreen', params: { isTutorial: false } },
      ],
    });
  });

  it('returns to PrivateHomeScreen and preserves private scope on Home', async () => {
    const navigation = { reset: jest.fn() };
    const updateTutorialStatus = jest.fn().mockResolvedValue(undefined);
    const scope = { kind: 'private', groupId: 'group-1' };

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ updateTutorialStatus, isTutorialFinished: {} }}>
          <ResultChoices
            navigation={navigation}
            route={{ params: { scope } }}
            success={true}
            isTutorial={false}
          />
        </AuthContext.Provider>
      );
    });

    await act(async () => {
      await getButtonByTestID(renderer, 'result.button.home').props.onPress();
    });

    expect(updateTutorialStatus).not.toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1,
      routes: [
        { name: 'HomeScreen' },
        { name: 'PrivateHomeScreen', params: { scope, isTutorial: false } },
      ],
    });
  });

  it('keeps private scope when resetting back to GuessPathScreen', async () => {
    const navigation = { reset: jest.fn() };
    const scope = { kind: 'private', groupId: 'group-1' };

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ updateTutorialStatus: jest.fn(), isTutorialFinished: {} }}>
          <ResultChoices
            navigation={navigation}
            route={{ params: { scope } }}
            success={false}
            retryGuess={jest.fn()}
            isTutorial={false}
          />
        </AuthContext.Provider>
      );
    });

    await act(async () => {
      getButtonByTestID(renderer, 'result.button.next').props.onPress();
    });

    expect(navigation.reset).toHaveBeenCalledWith({
      index: 2,
      routes: [
        { name: 'HomeScreen' },
        { name: 'PrivateHomeScreen', params: { scope } },
        { name: 'GuessPathScreen', params: { isTutorial: false, scope } },
      ],
    });
  });

  it('deep-links back to GuessFeedScreen with category and language when present', async () => {
    const navigation = { reset: jest.fn() };
    const category = { id: 'cat-1', key: 'nature' };
    const onNextCard = jest.fn();

    let renderer;
    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={{ updateTutorialStatus: jest.fn(), isTutorialFinished: {} }}>
          <ResultChoices
            navigation={navigation}
            route={{ params: { category, language: 'fr' } }}
            success={true}
            isTutorial={false}
            onNextCard={onNextCard}
          />
        </AuthContext.Provider>
      );
    });

    await act(async () => {
      await getButtonByTestID(renderer, 'result.button.next').props.onPress();
    });

    expect(onNextCard).toHaveBeenCalledTimes(1);
    expect(navigation.reset).not.toHaveBeenCalled();
  });
});
