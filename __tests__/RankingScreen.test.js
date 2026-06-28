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
import { Alert, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import RankingScreen from '../screens/RankingScreen';
import { AuthContext } from '../store/auth-context';
import { getRankingData, getUserScores } from '../utils/scoreRequests';
import { GlobalStyle } from '../constants/theme';

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
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <RankingScreen navigation={{ setOptions: jest.fn() }} />
        </AuthContext.Provider>
      );

      await flushEffects();
    });

    return renderer;
  }

  function getTableProps() {
    return mockTableComponent.mock.calls[mockTableComponent.mock.calls.length - 1][0];
  }

  it('fills the available screen height so the table can render into a real viewport', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        rows: [{ rank: '1', username: 'waldo', total_score: 25 }],
        nextCursor: null,
        hasMore: false,
      },
    });

    const renderer = await renderScreen();
    const screen = renderer.root.findByProps({ testID: 'ranking.screen' });

    expect(StyleSheet.flatten(screen.props.style)).toEqual(
      expect.objectContaining({
        flex: 1,
        backgroundColor: GlobalStyle.color.primaryColor500,
      })
    );
  });

  it('loads the initial ranking window and converts the rows for the table component', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        rows: [
          { rank: '1', username: 'waldo', total_score: 25 },
          { rank: '2', username: 'odile', total_score: 14 },
        ],
        nextCursor: null,
        hasMore: false,
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
        rows: [{ rank: '1', username: 'waldo', total_score: 25 }],
        nextCursor: null,
        hasMore: false,
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
        rows: [{ rank: '1', username: 'waldo', total_score: 25 }],
        nextCursor: null,
        hasMore: false,
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

  it('enforces the resident-row cap after enough successive cursor pages', async () => {
    const initialRows = [];
    for (let i = 1; i <= 5; i++) {
      initialRows.push({ rank: String(i), username: `user${i}`, total_score: i * 10, user_id: `u${i}` });
    }

    getRankingData.mockResolvedValueOnce({
      status: 200,
      data: {
        rows: initialRows,
        nextCursor: 'c1',
        hasMore: true,
      },
    });

    const CURSOR_PAGE_SIZE = 25;
    const CURSOR_PAGES = 7;
    let nextUserId = 6;

    for (let p = 0; p < CURSOR_PAGES; p++) {
      const rows = [];
      for (let j = 0; j < CURSOR_PAGE_SIZE; j++) {
        const id = nextUserId++;
        rows.push({ rank: String(id), username: `user${id}`, total_score: id, user_id: `u${id}` });
      }
      const isLast = p === CURSOR_PAGES - 1;
      getRankingData.mockResolvedValueOnce({
        status: 200,
        data: {
          rows: rows,
          nextCursor: isLast ? null : `c${p + 2}`,
          hasMore: !isLast,
        },
      });
    }

    await renderScreen();

    for (let p = 0; p < CURSOR_PAGES; p++) {
      await act(async () => {
        await getTableProps().onEndReached();
      });
    }

    const tableScores = getTableProps().data.tableScores;

    expect(tableScores.length).toBeLessThanOrEqual(150);

    expect(tableScores.some(r => r.userId === 'u1')).toBe(false);
    expect(tableScores.some(r => r.userId === 'u5')).toBe(false);

    expect(tableScores.some(r => r.userId === 'u180')).toBe(true);
    expect(tableScores.some(r => r.userId === 'u156')).toBe(true);
  });

  it('only triggers one network fetch when onEndReached is called rapidly while a fetch is in-flight', async () => {
    let resolveCursor;
    const cursorPromise = new Promise(r => { resolveCursor = r; });

    getRankingData
      .mockResolvedValueOnce({
        status: 200,
        data: {
          rows: [
            { rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' },
            { rank: '2', username: 'odile', total_score: 80, user_id: 'u2' },
          ],
          nextCursor: 'c1',
          hasMore: true,
        },
      })
      .mockReturnValueOnce(cursorPromise);

    await renderScreen();
    expect(getRankingData).toHaveBeenCalledTimes(1);

    act(() => {
      getTableProps().onEndReached();
      getTableProps().onEndReached();
    });

    expect(getRankingData).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveCursor({
        status: 200,
        data: {
          rows: [{ rank: '3', username: 'bob', total_score: 60, user_id: 'u3' }],
          nextCursor: null,
          hasMore: false,
        },
      });
    });

    expect(getRankingData).toHaveBeenCalledTimes(2);
  });

  it('deduplicates rows at the initial-to-browse boundary using userId', async () => {
    getRankingData
      .mockResolvedValueOnce({
        status: 200,
        data: {
          rows: [
            { rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' },
            { rank: '2', username: 'odile', total_score: 80, user_id: 'u2' },
          ],
          nextCursor: 'cursor-1',
          hasMore: true,
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          rows: [
            { rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' },
            { rank: '3', username: 'bob', total_score: 60, user_id: 'u3' },
          ],
          nextCursor: 'cursor-2',
          hasMore: false,
        },
      });

    await renderScreen();

    await act(async () => {
      await getTableProps().onEndReached();
    });

    const tableScores = getTableProps().data.tableScores;
    expect(tableScores).toEqual([
      { rank: 1, name: 'waldo', score: 100, others: '', userId: 'u1' },
      { rank: 2, name: 'odile', score: 80, others: '', userId: 'u2' },
      { rank: 4, name: 'bob', score: 60, others: '', userId: 'u3' },
    ]);
  });

  it('falls back cleanly when a cursor browse returns a legacy pagy envelope', async () => {
    getRankingData
      .mockResolvedValueOnce({
        status: 200,
        data: {
          rows: [
            { rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' },
            { rank: '2', username: 'odile', total_score: 80, user_id: 'u2' },
          ],
          nextCursor: 'c1',
          hasMore: true,
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          rows: [
            { rank: '3', username: 'bob', total_score: 60, user_id: 'u3' },
            { rank: '4', username: 'eve', total_score: 40, user_id: 'u4' },
          ],
          nextCursor: null,
          hasMore: false,
          pagy: { next: null, page: 2, pages: 2 },
        },
      });

    await renderScreen();

    await act(async () => {
      await getTableProps().onEndReached();
    });

    expect(getRankingData).toHaveBeenCalledWith(contextValue, { after: 'c1' });

    const tableScores = getTableProps().data.tableScores;
    expect(tableScores).toEqual([
      { rank: 1, name: 'waldo', score: 100, others: '', userId: 'u1' },
      { rank: 2, name: 'odile', score: 80, others: '', userId: 'u2' },
      { rank: 3, name: 'bob', score: 60, others: '', userId: 'u3' },
      { rank: 4, name: 'eve', score: 40, others: '', userId: 'u4' },
    ]);
  });

  it('clears loading and surfaces a recoverable error on a 400 invalid_cursor response', async () => {
    getRankingData
      .mockResolvedValueOnce({
        status: 200,
        data: {
          rows: [
            { rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' },
            { rank: '2', username: 'odile', total_score: 80, user_id: 'u2' },
          ],
          nextCursor: 'c1',
          hasMore: true,
        },
      })
      .mockResolvedValueOnce({
        status: 400,
        message: 'Cursor is invalid or expired',
      });

    await renderScreen();

    await act(async () => {
      await getTableProps().onEndReached();
    });

    expect(getRankingData).toHaveBeenCalledWith(contextValue, { after: 'c1' });

    expect(Alert.alert).toHaveBeenCalledWith(
      'There is a problem with the server',
      expect.stringContaining('Cursor is invalid or expired')
    );

    const tableScores = getTableProps().data.tableScores;
    expect(tableScores).toEqual([
      { rank: 1, name: 'waldo', score: 100, others: '', userId: 'u1' },
      { rank: 2, name: 'odile', score: 80, others: '', userId: 'u2' },
    ]);
  });

  it('passes rows with userId and required callbacks to TableComponent for stable key extraction', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        rows: [
          { rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' },
          { rank: '2', username: 'odile', total_score: 80, user_id: 'u2' },
        ],
        nextCursor: null,
        hasMore: false,
      },
    });

    await renderScreen();
    const props = getTableProps();

    props.data.tableScores.forEach((row) => {
      expect(row).toHaveProperty('userId');
    });
    expect(typeof props.onEndReached).toBe('function');
    expect(typeof props.onPress).toBe('function');
  });
});