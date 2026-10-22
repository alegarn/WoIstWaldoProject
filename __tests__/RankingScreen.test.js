const mockTableComponent = jest.fn(() => null);
const mockTableMounts = jest.fn();
const mockLoadingOverlay = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockUseActiveGroup = jest.fn(() => ({ scope: { kind: 'public' } }));
const mockUseGroupsHub = jest.fn(() => ({ data: null }));

jest.mock('../components/UI/TableComponent', () => {
  const React = jest.requireActual('react');

  return function MockTableComponent(props) {
    React.useEffect(() => {
      mockTableMounts();
    }, []);
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

jest.mock('../components/UI/CenteredModal', () => {
  return function MockCenteredModal(props) {
    mockCenteredModal(props);
    return props.isModalVisible ? (props.children ?? null) : null;
  };
});

jest.mock('../utils/scoreRequests', () => ({
  getRankingData: jest.fn(),
  getUserScores: jest.fn(),
}));

jest.mock('../hooks/useActiveGroup', () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

jest.mock('../hooks/useGroupsHub', () => ({
  useGroupsHub: () => mockUseGroupsHub(),
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
import { getPrivateGroupTheme } from '../utils/privateGroupTheme';

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

  function getModalProps() {
    return mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];
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
        backgroundColor: GlobalStyle.color.primaryColor800,
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

    expect(getRankingData).toHaveBeenCalledWith(
      contextValue,
      { scope: 'initial', top: 10, window: 5, limit: 20, board: 'total', period: 'all' }
    );
    const data = getTableProps().data;
    expect(data.board).toBe('total');
    expect(data.columns.map((column) => column.header)).toEqual(['Rank', 'Name', 'Score', 'Max Streak', 'Others']);
    expect(data.tableScores).toEqual([
      { rank: 1, name: 'waldo', score: 25, maxStreak: 0, others: '', total_score: 25 },
      { rank: 2, name: 'odile', score: 14, maxStreak: 0, others: '', total_score: 14 },
    ]);
  });

  it('maps max_streak from the API payload into the row as maxStreak', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        rows: [{ rank: '1', username: 'waldo', total_score: 25, max_streak: 7 }],
        nextCursor: null,
        hasMore: false,
      },
    });

    await renderScreen();

    const tableScores = getTableProps().data.tableScores;
    expect(tableScores[0].maxStreak).toBe(7);
  });

  it('defaults maxStreak to 0 when the API payload omits max_streak', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        rows: [{ rank: '1', username: 'waldo', total_score: 25 }],
        nextCursor: null,
        hasMore: false,
      },
    });

    await renderScreen();

    const tableScores = getTableProps().data.tableScores;
    expect(tableScores[0].maxStreak).toBe(0);
  });

  it('exposes a 5-column header slice with Max Streak between Score and Others', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        rows: [{ rank: '1', username: 'waldo', total_score: 25, max_streak: 3 }],
        nextCursor: null,
        hasMore: false,
      },
    });

    await renderScreen();

    const headers = getTableProps().data.columns.map((column) => column.header);
    expect(headers).toEqual(['Rank', 'Name', 'Score', 'Max Streak', 'Others']);
    expect(headers).toHaveLength(5);
    expect(headers.indexOf('Max Streak')).toBe(3);
    expect(headers.indexOf('Others')).toBe(4);
  });

  it('opens the detail modal with the fetched score fields when a username is selected from the table', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        rows: [{ rank: '1', username: 'waldo', total_score: 25, user_id: 'u1' }],
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
          point_score: 15,
          shape_score: 10,
          total_point_guess_score: 9,
          total_shape_guess_score: 5,
          total_point_hide_score: 7,
          total_shape_hide_score: 4,
        },
        hide_info: {
          hide_count: 4,
        },
        guess_info: {
          guess_count: 6,
        },
      },
    });

    const renderer = await renderScreen();

    await act(async () => {
      await getTableProps().onPress('waldo');
    });

    expect(getUserScores).toHaveBeenCalledWith({ username: 'waldo', context: contextValue, scope: 'initial' });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ testID: 'ranking.detail.modal' }).length).toBeGreaterThan(0);

    const modalProps = getModalProps();
    expect(modalProps.isModalVisible).toBe(true);
    expect(modalProps.testIDPrefix).toBe('ranking.detail.modal');
    expect(modalProps.singleButton).toBe(true);

    const modalContent = renderer.root;
    const modalTexts = modalContent.findAll((node) => typeof node.props.children === 'string');
    expect(modalTexts.map((node) => node.props.children)).toContain('Details of waldo');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.total_score' }).props.children).toBe('Total Score: 25');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.point_score' }).props.children).toBe('Point Score: 15');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.shape_score' }).props.children).toBe('Contour Score: 10');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.total_hide_score' }).props.children).toBe('Total Hide Score: 11');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.hide_count' }).props.children).toBe('Hidden Images Count: 4');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.guess_count' }).props.children).toBe('Guessed Images Count: 6');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.total_point_guess_score' }).props.children).toBe('Point Guess Score: 9');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.total_shape_guess_score' }).props.children).toBe('Shape Guess Score: 5');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.total_point_hide_score' }).props.children).toBe('Point Hide Score: 7');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.total_shape_hide_score' }).props.children).toBe('Shape Hide Score: 4');
  });

  it('renders the detail modal grouped into sectioned headers', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        rows: [{ rank: '1', username: 'waldo', total_score: 25, user_id: 'u1' }],
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
          point_score: 15,
          shape_score: 10,
          total_point_guess_score: 9,
          total_shape_guess_score: 5,
          total_point_hide_score: 7,
          total_shape_hide_score: 4,
        },
        hide_info: {
          hide_count: 4,
        },
        guess_info: {
          guess_count: 6,
        },
      },
    });

    const renderer = await renderScreen();

    await act(async () => {
      await getTableProps().onPress('waldo');
    });

    const modalContent = renderer.root;
    expect(modalContent.findByProps({ testID: 'ranking.detail.scoresTitle' }).props.children).toBe('Scores');
    expect(modalContent.findByProps({ testID: 'ranking.detail.activityTitle' }).props.children).toBe('Activity');
    expect(modalContent.findByProps({ testID: 'ranking.detail.breakdownTitle' }).props.children).toBe('Breakdown');
  });

  it('renders only the fields present in the detail payload, skipping absent split fields', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        rows: [{ rank: '1', username: 'waldo', total_score: 25, user_id: 'u1' }],
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

    const renderer = await renderScreen();

    await act(async () => {
      await getTableProps().onPress('waldo');
    });

    expect(Alert.alert).not.toHaveBeenCalled();
    const modalContent = renderer.root;

    expect(modalContent.findByProps({ testID: 'ranking.detail.field.total_score' }).props.children).toBe('Total Score: 25');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.total_hide_score' }).props.children).toBe('Total Hide Score: 11');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.hide_count' }).props.children).toBe('Hidden Images Count: 4');
    expect(modalContent.findByProps({ testID: 'ranking.detail.field.guess_count' }).props.children).toBe('Guessed Images Count: 6');

    ['point_score', 'shape_score', 'total_point_guess_score', 'total_shape_guess_score', 'total_point_hide_score', 'total_shape_hide_score'].forEach((field) => {
      expect(modalContent.findAllByProps({ testID: `ranking.detail.field.${field}` })).toHaveLength(0);
    });

    modalContent
      .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('ranking.detail.field.'))
      .forEach((row) => {
        expect(String(row.props.children)).not.toContain('undefined');
      });
  });

  it('closes the detail modal through its close affordance', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: {
        rows: [{ rank: '1', username: 'waldo', total_score: 25, user_id: 'u1' }],
        nextCursor: null,
        hasMore: false,
      },
    });
    getUserScores.mockResolvedValue({
      status: 200,
      data: {
        total: { total_score: 25, total_hide_score: 11 },
        hide_info: { hide_count: 4 },
        guess_info: { guess_count: 6 },
      },
    });

    const renderer = await renderScreen();

    await act(async () => {
      await getTableProps().onPress('waldo');
    });
    expect(renderer.root.findAllByProps({ testID: 'ranking.detail.modal' }).length).toBeGreaterThan(0);

    const modalProps = getModalProps();
    expect(modalProps.singleButton).toBe(true);
    expect(modalProps.confirmLabel).toBeUndefined();

    await act(async () => {
      modalProps.onCancel();
    });

    expect(renderer.root.findAllByProps({ testID: 'ranking.detail.modal' })).toHaveLength(0);
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
      { rank: 1, name: 'waldo', score: 100, maxStreak: 0, others: '', userId: 'u1', total_score: 100 },
      { rank: 2, name: 'odile', score: 80, maxStreak: 0, others: '', userId: 'u2', total_score: 80 },
      { rank: 4, name: 'bob', score: 60, maxStreak: 0, others: '', userId: 'u3', total_score: 60 },
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

    expect(getRankingData).toHaveBeenCalledWith(contextValue, { after: 'c1', limit: 20, board: 'total', period: 'all' });

    const tableScores = getTableProps().data.tableScores;
    expect(tableScores).toEqual([
      { rank: 1, name: 'waldo', score: 100, maxStreak: 0, others: '', userId: 'u1', total_score: 100 },
      { rank: 2, name: 'odile', score: 80, maxStreak: 0, others: '', userId: 'u2', total_score: 80 },
      { rank: 3, name: 'bob', score: 60, maxStreak: 0, others: '', userId: 'u3', total_score: 60 },
      { rank: 4, name: 'eve', score: 40, maxStreak: 0, others: '', userId: 'u4', total_score: 40 },
    ]);
  });

  it('clears loading and surfaces an inline retryable error on a 400 invalid_cursor response', async () => {
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

    const renderer = await renderScreen();

    await act(async () => {
      await getTableProps().onEndReached();
    });

    expect(getRankingData).toHaveBeenCalledWith(contextValue, { after: 'c1', limit: 20, board: 'total', period: 'all' });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ testID: 'ranking.footer.error' }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ testID: 'ranking.footer.retry' }).length).toBeGreaterThan(0);

    const tableScores = getTableProps().data.tableScores;
    expect(tableScores).toEqual([
      { rank: 1, name: 'waldo', score: 100, maxStreak: 0, others: '', userId: 'u1', total_score: 100 },
      { rank: 2, name: 'odile', score: 80, maxStreak: 0, others: '', userId: 'u2', total_score: 80 },
    ]);

    getRankingData.mockResolvedValueOnce({
      status: 200,
      data: {
        rows: [{ rank: '3', username: 'bob', total_score: 60, user_id: 'u3' }],
        nextCursor: null,
        hasMore: false,
      },
    });

    await act(async () => {
      await renderer.root.findAllByProps({ testID: 'ranking.footer.retry' })[0].props.onPress();
    });

    expect(getRankingData).toHaveBeenNthCalledWith(3, contextValue, { after: 'c1', limit: 20, board: 'total', period: 'all' });
    expect(renderer.root.findAllByProps({ testID: 'ranking.footer.error' })).toHaveLength(0);
    expect(getTableProps().data.tableScores).toHaveLength(3);
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

  describe('board tabs', () => {
    it('refetches page 1 with the new board and resets slices, cursor and hasMore', async () => {
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
            nextCursor: 'c2',
            hasMore: true,
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'pioneer', point_score: 55, user_id: 'p1' }],
            nextCursor: 'p1',
            hasMore: true,
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '2', username: 'pointer', point_score: 44, user_id: 'p2' }],
            nextCursor: null,
            hasMore: false,
          },
        });

      const renderer = await renderScreen();

      await act(async () => {
        await getTableProps().onEndReached();
      });
      expect(getTableProps().data.tableScores).toHaveLength(4);

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.board.point' }).props.onPress('point');
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        3,
        contextValue,
        { scope: 'initial', top: 10, window: 5, limit: 20, board: 'point', period: 'all' }
      );

      expect(getTableProps().data.tableScores).toEqual([
        { rank: 1, name: 'pioneer', score: 55, maxStreak: 0, others: '', userId: 'p1', point_score: 55 },
      ]);

      await act(async () => {
        await getTableProps().onEndReached();
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        4,
        contextValue,
        { after: 'p1', limit: 20, board: 'point', period: 'all' }
      );
      expect(getTableProps().data.tableScores).toHaveLength(2);
    });

    it('reads the score from the active board descriptor field', async () => {
      getRankingData
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' }],
            nextCursor: null,
            hasMore: false,
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'contourist', shape_score: 77, user_id: 's1' }],
            nextCursor: null,
            hasMore: false,
          },
        });

      const renderer = await renderScreen();

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.board.shape' }).props.onPress('shape');
      });

      const data = getTableProps().data;
      expect(data.board).toBe('shape');
      expect(data.columns.map((column) => column.header)).toEqual(['Rank', 'Name', 'Contour Score', 'Others']);
      expect(data.tableScores).toEqual([
        { rank: 1, name: 'contourist', score: 77, maxStreak: 0, others: '', userId: 's1', shape_score: 77 },
      ]);
    });

    it('renders the me card with rank and name from the me payload', async () => {
      getRankingData.mockResolvedValue({
        status: 200,
        data: {
          rows: [{ rank: '1', username: 'waldo', total_score: 25, user_id: 'u1' }],
          nextCursor: null,
          hasMore: false,
          me: { user_id: 'u9', username: 'me_user', total_score: 10, rank: 3 },
        },
      });

      const renderer = await renderScreen();

      expect(renderer.root.findAllByProps({ testID: 'ranking.meCard' }).length).toBeGreaterThan(0);
      expect(renderer.root.findAllByProps({ testID: 'ranking.meCard.rank' })[0].props.children).toBe('You are #3');
      expect(renderer.root.findAllByProps({ testID: 'ranking.meCard.name' })[0].props.children).toBe('me_user');
    });

    it('hides the me card when the payload has no me entry', async () => {
      getRankingData.mockResolvedValue({
        status: 200,
        data: {
          rows: [{ rank: '1', username: 'waldo', total_score: 25, user_id: 'u1' }],
          nextCursor: null,
          hasMore: false,
          me: null,
        },
      });

      const renderer = await renderScreen();

      expect(renderer.root.findAllByProps({ testID: 'ranking.meCard' })).toHaveLength(0);
    });

    it('pull-to-refresh refetches the current board page 1 and resets the slices', async () => {
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
            rows: [{ rank: '1', username: 'waldo', total_score: 120, user_id: 'u1' }],
            nextCursor: null,
            hasMore: false,
          },
        });

      const renderer = await renderScreen();
      expect(getTableProps().refreshing).toBe(false);

      await act(async () => {
        await getTableProps().onRefresh();
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        2,
        contextValue,
        { scope: 'initial', top: 10, window: 5, limit: 20, board: 'total', period: 'all' }
      );
      expect(getTableProps().data.tableScores).toEqual([
        { rank: 1, name: 'waldo', score: 120, maxStreak: 0, others: '', userId: 'u1', total_score: 120 },
      ]);
      expect(getTableProps().refreshing).toBe(false);
    });

    it('pull-to-refresh remounts the table so a deep-scroll offset resets', async () => {
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
            rows: [{ rank: '1', username: 'waldo', total_score: 120, user_id: 'u1' }],
            nextCursor: null,
            hasMore: false,
          },
        });

      await renderScreen();
      const mountsBeforeRefresh = mockTableMounts.mock.calls.length;

      await act(async () => {
        await getTableProps().onRefresh();
      });

      expect(mockTableMounts.mock.calls.length).toBe(mountsBeforeRefresh + 1);
      expect(getTableProps().data.tableScores).toEqual([
        { rank: 1, name: 'waldo', score: 120, maxStreak: 0, others: '', userId: 'u1', total_score: 120 },
      ]);
    });
  });

  describe('period chips', () => {
    it('renders the three period chips in public scope and defaults requests to period all', async () => {
      getRankingData.mockResolvedValue({
        status: 200,
        data: {
          rows: [{ rank: '1', username: 'waldo', total_score: 25, user_id: 'u1' }],
          nextCursor: null,
          hasMore: false,
        },
      });

      const renderer = await renderScreen();

      ['all', 'week', 'day'].forEach((period) => {
        expect(renderer.root.findAllByProps({ testID: `ranking.screen.period.${period}` }).length).toBeGreaterThan(0);
      });
      expect(getRankingData).toHaveBeenCalledWith(
        contextValue,
        { scope: 'initial', top: 10, window: 5, limit: 20, board: 'total', period: 'all' }
      );
    });

    it('refetches page 1 with the new period while keeping the active board', async () => {
      getRankingData
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' }],
            nextCursor: null,
            hasMore: false,
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'weekly', total_score: 55, user_id: 'w1' }],
            nextCursor: null,
            hasMore: false,
          },
        });

      const renderer = await renderScreen();

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.period.week' }).props.onPress('week');
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        2,
        contextValue,
        { scope: 'initial', top: 10, window: 5, limit: 20, board: 'total', period: 'week' }
      );
      expect(getTableProps().data.board).toBe('total');
      expect(getTableProps().data.tableScores).toEqual([
        { rank: 1, name: 'weekly', score: 55, maxStreak: 0, others: '', userId: 'w1', total_score: 55 },
      ]);
    });

    it('shows the period score on the total board when server rows omit total_score', async () => {
      getRankingData
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' }],
            nextCursor: null,
            hasMore: false,
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{
              rank: '1',
              username: 'weekly',
              score: 55,
              point_score: 33,
              shape_score: 22,
              user_id: 'w1',
            }],
            nextCursor: null,
            hasMore: false,
          },
        });

      const renderer = await renderScreen();

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.period.week' }).props.onPress('week');
      });

      expect(getTableProps().data.board).toBe('total');
      expect(getTableProps().data.tableScores).toEqual([
        { rank: 1, name: 'weekly', maxStreak: 0, others: '', userId: 'w1', total_score: 55, point_score: 33, shape_score: 22 },
      ]);
    });

    it('carries the active period on cursor page requests', async () => {
      getRankingData
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' }],
            nextCursor: 'c1',
            hasMore: true,
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'weekly', total_score: 55, user_id: 'w1' }],
            nextCursor: 'w1',
            hasMore: true,
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '2', username: 'odile', total_score: 80, user_id: 'u2' }],
            nextCursor: null,
            hasMore: false,
          },
        });

      const renderer = await renderScreen();

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.period.week' }).props.onPress('week');
      });

      await act(async () => {
        await getTableProps().onEndReached();
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        3,
        contextValue,
        { after: 'w1', limit: 20, board: 'total', period: 'week' }
      );
      expect(getTableProps().data.tableScores).toEqual([
        { rank: 1, name: 'weekly', score: 55, maxStreak: 0, others: '', userId: 'w1', total_score: 55 },
        { rank: 2, name: 'odile', score: 80, maxStreak: 0, others: '', userId: 'u2', total_score: 80 },
      ]);
    });

    it('hides the period chips in private scope', async () => {
      mockUseActiveGroup.mockReturnValueOnce({
        scope: { kind: 'private', groupId: 'g-1' },
      });
      mockUseGroupsHub.mockReturnValueOnce({
        data: {
          owned: [{
            id: 'g-1',
            name: 'My Group',
            primary_color: '#198868',
            secondary_color: '#FFCC00',
          }],
          joined: [],
        },
      });
      getRankingData.mockResolvedValue({
        status: 200,
        data: { rows: [], nextCursor: null, hasMore: false },
      });

      const route = { params: { scope: { kind: 'private', groupId: 'g-1' } } };
      let renderer;

      await act(async () => {
        renderer = create(
          <AuthContext.Provider value={contextValue}>
            <RankingScreen navigation={{ setOptions: jest.fn() }} route={route} />
          </AuthContext.Provider>
        );
        await flushEffects();
      });

      ['all', 'week', 'day'].forEach((period) => {
        expect(renderer.root.findAllByProps({ testID: `ranking.screen.period.${period}` })).toHaveLength(0);
      });
    });

    it('discards a stale cursor response when the period is switched mid-flight', async () => {
      let resolveCursor;
      getRankingData
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' }],
            nextCursor: 'c1',
            hasMore: true,
          },
        })
        .mockReturnValueOnce(new Promise((resolve) => { resolveCursor = resolve; }))
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'weekly', total_score: 55, user_id: 'w1' }],
            nextCursor: null,
            hasMore: false,
          },
        });

      const renderer = await renderScreen();

      await act(async () => {
        getTableProps().onEndReached();
      });

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.period.week' }).props.onPress('week');
      });

      await act(async () => {
        resolveCursor({
          status: 200,
          data: {
            rows: [{ rank: '9', username: 'stale', total_score: 1, user_id: 'u3' }],
            nextCursor: 'stale-c',
            hasMore: true,
          },
        });
      });
      await act(async () => {});

      expect(getTableProps().data.tableScores).toEqual([
        { rank: 1, name: 'weekly', score: 55, maxStreak: 0, others: '', userId: 'w1', total_score: 55 },
      ]);
    });
  });

  describe('list footer', () => {
    it('shows a footer spinner while a cursor page is loading and an end text when hasMore is false', async () => {
      let resolveCursor;
      getRankingData
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' }],
            nextCursor: 'c1',
            hasMore: true,
          },
        })
        .mockReturnValueOnce(new Promise((resolve) => { resolveCursor = resolve; }));

      const renderer = await renderScreen();

      await act(async () => {
        getTableProps().onEndReached();
      });

      expect(renderer.root.findAllByProps({ testID: 'ranking.footer.spinner' }).length).toBeGreaterThan(0);

      await act(async () => {
        resolveCursor({
          status: 200,
          data: {
            rows: [{ rank: '2', username: 'odile', total_score: 80, user_id: 'u2' }],
            nextCursor: null,
            hasMore: false,
          },
        });
      });

      expect(renderer.root.findAllByProps({ testID: 'ranking.footer.spinner' })).toHaveLength(0);
      expect(renderer.root.findAllByProps({ testID: 'ranking.footer.end' }).length).toBeGreaterThan(0);
    });
  });

  describe('stale in-flight fetches (request epoch guard)', () => {
    it('discards a stale cursor response when the board is switched mid-flight', async () => {
      let resolveCursor;
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
        .mockReturnValueOnce(new Promise((resolve) => { resolveCursor = resolve; }))
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'pioneer', point_score: 55, user_id: 'p1' }],
            nextCursor: 'p1',
            hasMore: true,
          },
        });

      const renderer = await renderScreen();

      await act(async () => {
        getTableProps().onEndReached();
      });

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.board.point' }).props.onPress('point');
      });

      await act(async () => {
        resolveCursor({
          status: 200,
          data: {
            rows: [{ rank: '3', username: 'stale-total', total_score: 1, user_id: 'u3' }],
            nextCursor: 'stale-c',
            hasMore: true,
          },
        });
      });
      await act(async () => {});

      expect(getRankingData).toHaveBeenNthCalledWith(
        3,
        contextValue,
        { scope: 'initial', top: 10, window: 5, limit: 20, board: 'point', period: 'all' }
      );
      expect(getTableProps().data.board).toBe('point');
      expect(getTableProps().data.tableScores).toEqual([
        { rank: 1, name: 'pioneer', score: 55, maxStreak: 0, others: '', userId: 'p1', point_score: 55 },
      ]);
    });

    it('discards a stale cursor response when a pull-to-refresh lands mid-flight', async () => {
      let resolveCursor;
      getRankingData
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' }],
            nextCursor: 'c1',
            hasMore: true,
          },
        })
        .mockReturnValueOnce(new Promise((resolve) => { resolveCursor = resolve; }))
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'waldo', total_score: 120, user_id: 'u1' }],
            nextCursor: null,
            hasMore: false,
          },
        });

      const renderer = await renderScreen();

      await act(async () => {
        getTableProps().onEndReached();
      });

      await act(async () => {
        await getTableProps().onRefresh();
      });

      await act(async () => {
        resolveCursor({
          status: 200,
          data: {
            rows: [{ rank: '2', username: 'stale-total', total_score: 1, user_id: 'u2' }],
            nextCursor: 'stale-c',
            hasMore: true,
          },
        });
      });
      await act(async () => {});

      expect(getTableProps().data.tableScores).toEqual([
        { rank: 1, name: 'waldo', score: 120, maxStreak: 0, others: '', userId: 'u1', total_score: 120 },
      ]);
    });

    it('discards the old-board initial envelope when the board is switched before it lands', async () => {
      let resolveInitial;
      getRankingData
        .mockReturnValueOnce(new Promise((resolve) => { resolveInitial = resolve; }))
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'pioneer', point_score: 55, user_id: 'p1' }],
            nextCursor: 'p1',
            hasMore: true,
          },
        });

      const renderer = await renderScreen();

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.board.point' }).props.onPress('point');
      });

      await act(async () => {
        resolveInitial({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'old-total', total_score: 9, user_id: 'u0' }],
            nextCursor: 'c0',
            hasMore: true,
            me: { user_id: 'u0', username: 'old-total', rank: 1 },
          },
        });
      });
      await act(async () => {});

      expect(getTableProps().data.board).toBe('point');
      expect(getTableProps().data.tableScores).toEqual([
        { rank: 1, name: 'pioneer', score: 55, maxStreak: 0, others: '', userId: 'p1', point_score: 55 },
      ]);
      expect(renderer.root.findAllByProps({ testID: 'ranking.meCard' })).toHaveLength(0);
    });

    it('silently discards a stale in-flight rejection after a board switch instead of surfacing the error', async () => {
      let rejectCursor;
      getRankingData
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' }],
            nextCursor: 'c1',
            hasMore: true,
          },
        })
        .mockReturnValueOnce(new Promise((_, reject) => { rejectCursor = reject; }))
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '1', username: 'pioneer', point_score: 55, user_id: 'p1' }],
            nextCursor: 'p1',
            hasMore: true,
          },
        });

      const renderer = await renderScreen();

      await act(async () => {
        getTableProps().onEndReached();
      });

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.board.point' }).props.onPress('point');
      });

      await act(async () => {
        rejectCursor({ status: 500, message: 'boom' });
      });
      await act(async () => {});

      expect(Alert.alert).not.toHaveBeenCalled();
      expect(renderer.root.findAllByProps({ testID: 'ranking.footer.error' })).toHaveLength(0);
      expect(getTableProps().data.tableScores).toEqual([
        { rank: 1, name: 'pioneer', score: 55, maxStreak: 0, others: '', userId: 'p1', point_score: 55 },
      ]);
    });
  });

  it('wires the header background and tint to the private group theme when a private scope is active', async () => {
    mockUseActiveGroup.mockReturnValueOnce({
      scope: { kind: 'private', groupId: 'g-1' },
    });
    mockUseGroupsHub.mockReturnValueOnce({
      data: {
        owned: [{
          id: 'g-1',
          name: 'My Group',
          primary_color: '#198868',
          secondary_color: '#FFCC00',
        }],
        joined: [],
      },
    });
    getRankingData.mockResolvedValue({
      status: 200,
      data: { rows: [], nextCursor: null, hasMore: false },
    });

    const expectedTheme = getPrivateGroupTheme({ primaryColor: '#198868' });
    const navigation = { setOptions: jest.fn() };
    const route = { params: { scope: { kind: 'private', groupId: 'g-1' } } };

    await act(async () => {
      create(
        <AuthContext.Provider value={contextValue}>
          <RankingScreen navigation={navigation} route={route} />
        </AuthContext.Provider>
      );
      await flushEffects();
    });

    const setOptionsCalls = navigation.setOptions.mock.calls.map(([opts]) => opts);

    expect(setOptionsCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          headerStyle: { backgroundColor: expectedTheme.primaryColor },
          headerTintColor: expectedTheme.headerTintColor,
        }),
      ])
    );
  });

  it('does not apply group header colors in public scope', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: { rows: [], nextCursor: null, hasMore: false },
    });
    const navigation = { setOptions: jest.fn() };

    await act(async () => {
      create(
        <AuthContext.Provider value={contextValue}>
          <RankingScreen navigation={navigation} />
        </AuthContext.Provider>
      );
      await flushEffects();
    });

    const setOptionsCalls = navigation.setOptions.mock.calls.map(([opts]) => opts);
    setOptionsCalls.forEach((opts) => {
      expect(opts).not.toHaveProperty('headerStyle');
      expect(opts).not.toHaveProperty('headerTintColor');
    });
  });
});