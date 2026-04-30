const mockTableComponent = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

jest.mock('../components/UI/TableComponent', () => {
  return function MockTableComponent(props) {
    mockTableComponent(props);
    return null;
  };
});

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props) {
    mockLoadingOverlay(props);
    return null;
  };
});

jest.mock('../utils/scoreRequests', () => ({
  getRankingData: jest.fn(),
  getUserScores: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
  const React = require('react');

  return {
    AuthContext: React.createContext({}),
  };
});

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import RankingScreen from '../screens/RankingScreen';
import { AuthContext } from '../store/auth-context';
import { getRankingData, getUserScores } from '../utils/scoreRequests';

describe('RankingScreen', () => {
  const contextValue = {
    token: 'token',
    uid: 'waldo@example.com',
    expiry: '123',
    access_token: 'access-token',
    client: 'client-id',
    userId: '42',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
  }

  async function renderScreen() {
    await act(async () => {
      create(
        <AuthContext.Provider value={contextValue}>
          <RankingScreen />
        </AuthContext.Provider>
      );

      await flushEffects();
    });
  }

  function getTableProps() {
    return mockTableComponent.mock.calls[mockTableComponent.mock.calls.length - 1][0];
  }

  it('loads the initial ranking window and converts the rows for the table component', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        data: {
          rows: [
            { rank: '1', username: 'waldo', total_score: 25 },
            { rank: '2', username: 'odile', total_score: 14 },
          ],
        },
      },
    });

    await renderScreen();

    expect(getRankingData).toHaveBeenCalledWith(contextValue, { scope: 'initial', top: 10, window: 5 });
    expect(getTableProps()).toEqual(
      expect.objectContaining({
        data: {
          tableHeaders: ['Rank', 'Name', 'Score', 'Others'],
          tableScores: [
            { rank: 1, name: 'waldo', score: 25, others: '' },
            { rank: 2, name: 'odile', score: 14, others: '' },
          ],
        },
      })
    );
  });

  it('shows the detailed score breakdown when a username is selected from the table', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        data: {
          rows: [{ rank: '1', username: 'waldo', total_score: 25 }],
        },
      },
    });
    getUserScores.mockResolvedValue({
      status: 200,
      data: {
        total: {
          total_score: 25,
          total_hide_score: 11,
          total_guess_score: 14,
        },
        hide_info: {
          hide_count: 4,
        },
        guess_info: {
          guess_count: 6,
        },
      },
    });

    await renderScreen();

    await act(async () => {
      await getTableProps().onPress('waldo');
    });

    expect(getUserScores).toHaveBeenCalledWith({ username: 'waldo', context: contextValue });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Complementary Scores of waldo',
      expect.stringContaining('Total Score: 25')
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Complementary Scores of waldo',
      expect.stringContaining('Guessed Images Count: 6')
    );
  });

  it('alerts when detailed scores are not found for a selected user', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        data: {
          rows: [{ rank: '1', username: 'waldo', total_score: 25 }],
        },
      },
    });
    getUserScores.mockResolvedValue({
      status: 404,
    });

    await renderScreen();

    await act(async () => {
      await getTableProps().onPress('waldo');
    });

    expect(Alert.alert).toHaveBeenCalledWith('User not found', 'No scores found for waldo.');
  });
});