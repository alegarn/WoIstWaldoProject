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

import RankingScreen, { deriveDisplayRows } from '../screens/RankingScreen';
import { AuthContext } from '../store/auth-context';
import { getRankingData, getUserScores } from '../utils/scoreRequests';
import { GlobalStyle } from '../constants/theme';
import { getPrivateGroupTheme } from '../utils/privateGroupTheme';

const rankSeq = (rows) => rows.map((row) => (row.separator ? 'sep' : row.rank));

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
      { scope: 'initial', window: 5, limit: 20, board: 'total', period: 'all' }
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
    // Pin updated (plan 06 D5): dedupe now runs before renumbering, so bob
    // takes the contiguous rank 3 instead of the gap-rank 4 the old
    // mode-gated post-renumber dedupe produced.
    expect(tableScores).toEqual([
      { rank: 1, name: 'waldo', score: 100, maxStreak: 0, others: '', userId: 'u1', total_score: 100 },
      { rank: 2, name: 'odile', score: 80, maxStreak: 0, others: '', userId: 'u2', total_score: 80 },
      { rank: 3, name: 'bob', score: 60, maxStreak: 0, others: '', userId: 'u3', total_score: 60 },
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

    expect(getRankingData).toHaveBeenCalledWith(contextValue, { after: 'c1', direction: 'down', limit: 20, board: 'total', period: 'all' });

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

    expect(getRankingData).toHaveBeenCalledWith(contextValue, { after: 'c1', direction: 'down', limit: 20, board: 'total', period: 'all' });

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

    expect(getRankingData).toHaveBeenNthCalledWith(3, contextValue, { after: 'c1', direction: 'down', limit: 20, board: 'total', period: 'all' });
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
    expect(typeof props.onStartReached).toBe('function');
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
        { scope: 'initial', window: 5, limit: 20, board: 'point', period: 'all' }
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
        { after: 'p1', direction: 'down', limit: 20, board: 'point', period: 'all' }
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
        { scope: 'initial', window: 5, limit: 20, board: 'total', period: 'all' }
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
        { scope: 'initial', window: 5, limit: 20, board: 'total', period: 'all' }
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
        { scope: 'initial', window: 5, limit: 20, board: 'total', period: 'week' }
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
        { after: 'w1', direction: 'down', limit: 20, board: 'total', period: 'week' }
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

  describe('me-window initial (contract v3)', () => {
    const meWindowRows = [
      { rank: '10', username: 'above_two', total_score: 90, user_id: 'u10' },
      { rank: '11', username: 'above_one', total_score: 85, user_id: 'u11' },
      { rank: '12', username: 'me_user', total_score: 80, user_id: 'u12' },
      { rank: '13', username: 'below_one', total_score: 75, user_id: 'u13' },
      { rank: '14', username: 'below_two', total_score: 70, user_id: 'u14' },
    ];
    const v3Envelope = (overrides = {}) => ({
      rows: meWindowRows,
      me: { user_id: 'u12', username: 'me_user', total_score: 80, rank: 12 },
      upCursor: 'up-c1',
      hasMoreUp: true,
      downCursor: 'down-c1',
      hasMoreDown: true,
      meta: { window: 2 },
      ...overrides,
    });

    it('requests the initial me-window without a top param', async () => {
      getRankingData.mockResolvedValue({ status: 200, data: v3Envelope() });

      await renderScreen();

      expect(getRankingData).toHaveBeenCalledWith(
        contextValue,
        { scope: 'initial', window: 5, limit: 20, board: 'total', period: 'all' }
      );
    });

    it('renders only the me-window rows with no top block and no separator', async () => {
      getRankingData.mockResolvedValue({ status: 200, data: v3Envelope() });

      const renderer = await renderScreen();

      const tableScores = getTableProps().data.tableScores;
      expect(tableScores.map((row) => row.rank)).toEqual([10, 11, 12, 13, 14]);
      expect(tableScores.some((row) => row.separator)).toBe(false);
      expect(renderer.root.findAllByProps({ testID: 'ranking.meCard.rank' })[0].props.children).toBe('You are #12');
    });

    it('fires each direction exactly once when RN auto-triggers both reach handlers on a short me-window', async () => {
      let resolveUp;
      let resolveDown;
      getRankingData
        .mockResolvedValueOnce({ status: 200, data: v3Envelope() })
        .mockReturnValueOnce(new Promise((resolve) => { resolveUp = resolve; }))
        .mockReturnValueOnce(new Promise((resolve) => { resolveDown = resolve; }));

      await renderScreen();

      // RN FlatList fires onStartReached + onEndReached on first layout when
      // the short me-window leaves both list edges inside the threshold.
      act(() => {
        getTableProps().onStartReached();
        getTableProps().onEndReached();
        getTableProps().onStartReached();
        getTableProps().onEndReached();
      });

      expect(getRankingData).toHaveBeenCalledTimes(3);
      expect(getRankingData).toHaveBeenNthCalledWith(
        2,
        contextValue,
        expect.objectContaining({ after: 'up-c1', direction: 'up' })
      );
      expect(getRankingData).toHaveBeenNthCalledWith(
        3,
        contextValue,
        expect.objectContaining({ after: 'down-c1', direction: 'down' })
      );

      await act(async () => {
        resolveUp({
          status: 200,
          data: { rows: [{ rank: 9, username: 'up9', total_score: 95, user_id: 'u9' }], nextCursor: null, hasMore: false },
        });
        resolveDown({
          status: 200,
          data: { rows: [{ rank: 15, username: 'down15', total_score: 65, user_id: 'u15' }], nextCursor: null, hasMore: false },
        });
      });

      expect(getTableProps().data.tableScores.map((row) => row.rank)).toEqual([9, 10, 11, 12, 13, 14, 15]);
    });

    it('derives a separator when a partial up page leaves a rank hole above the me-window', async () => {
      getRankingData
        .mockResolvedValueOnce({ status: 200, data: v3Envelope() })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [
              { rank: '2', username: 'second', total_score: 190, user_id: 'u2' },
              { rank: '3', username: 'third', total_score: 180, user_id: 'u3' },
              { rank: '4', username: 'fourth', total_score: 170, user_id: 'u4' },
            ],
            nextCursor: null,
            hasMore: false,
          },
        });

      await renderScreen();

      await act(async () => {
        await getTableProps().onStartReached();
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        2,
        contextValue,
        { after: 'up-c1', direction: 'up', limit: 20, board: 'total', period: 'all' }
      );
      expect(rankSeq(getTableProps().data.tableScores)).toEqual([
        2, 3, 4, 'sep', 10, 11, 12, 13, 14,
      ]);
    });

    it('never fetches up when the initial envelope closes the up direction', async () => {
      getRankingData.mockResolvedValue({
        status: 200,
        data: v3Envelope({
          rows: meWindowRows.slice(2),
          me: { user_id: 'u12', username: 'me_user', total_score: 80, rank: 1 },
          upCursor: null,
          hasMoreUp: false,
        }),
      });

      await renderScreen();

      await act(async () => {
        await getTableProps().onStartReached();
      });

      expect(getRankingData).toHaveBeenCalledTimes(1);
      expect(getTableProps().data.tableScores.map((row) => row.rank)).toEqual([12, 13, 14]);
    });

    it('honors a false has_more_down from the v3 envelope instead of forcing endless scrolling', async () => {
      getRankingData.mockResolvedValue({
        status: 200,
        data: v3Envelope({ downCursor: null, hasMoreDown: false }),
      });

      const renderer = await renderScreen();

      await act(async () => {
        await getTableProps().onEndReached();
      });

      expect(getRankingData).toHaveBeenCalledTimes(1);
      expect(renderer.root.findAllByProps({ testID: 'ranking.footer.end' }).length).toBeGreaterThan(0);
    });

    it('never fires a bare cursor request when has_more_down is true but down_cursor is null', async () => {
      getRankingData.mockResolvedValue({
        status: 200,
        data: v3Envelope({ downCursor: null, hasMoreDown: true }),
      });

      await renderScreen();

      await act(async () => {
        await getTableProps().onEndReached();
      });

      expect(getRankingData).toHaveBeenCalledTimes(1);
      expect(getRankingData.mock.calls[0][1]).toEqual(
        expect.objectContaining({ scope: 'initial', window: 5 })
      );
      expect(getRankingData.mock.calls[0][1]).not.toHaveProperty('after');
    });

    it('renumbers cursor rows from the last resident rank so labels stay contiguous past the me-block', async () => {
      getRankingData
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [
              { rank: '20', username: 'above', total_score: 60, user_id: 'u20' },
              { rank: '21', username: 'me_user', total_score: 50, user_id: 'u21' },
            ],
            nextCursor: 'anchor-1',
            hasMore: true,
            me: { user_id: 'u21', username: 'me_user', total_score: 50, rank: 21 },
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [
              { username: 'chaser1', total_score: 5, user_id: 'u30' },
              { username: 'chaser2', total_score: 4, user_id: 'u31' },
            ],
            nextCursor: null,
            hasMore: false,
          },
        });

      await renderScreen();

      expect(rankSeq(getTableProps().data.tableScores)).toEqual([20, 21]);

      await act(async () => {
        await getTableProps().onEndReached();
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        2,
        contextValue,
        { after: 'anchor-1', direction: 'down', limit: 20, board: 'total', period: 'all' }
      );
      expect(rankSeq(getTableProps().data.tableScores)).toEqual([
        20, 21, 22, 23,
      ]);
    });

    it('dedupes every cursor append against resident userIds, not just the first browse page', async () => {
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
            rows: [{ rank: '3', username: 'bob', total_score: 60, user_id: 'u3' }],
            nextCursor: 'c2',
            hasMore: true,
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [
              { rank: '2', username: 'odile', total_score: 80, user_id: 'u2' },
              { rank: '3', username: 'bob', total_score: 60, user_id: 'u3' },
              { rank: '4', username: 'eve', total_score: 40, user_id: 'u4' },
            ],
            nextCursor: null,
            hasMore: false,
          },
        });

      await renderScreen();

      await act(async () => {
        await getTableProps().onEndReached();
      });
      await act(async () => {
        await getTableProps().onEndReached();
      });

      const tableScores = getTableProps().data.tableScores;
      expect(tableScores.map((row) => row.userId)).toEqual(['u1', 'u2', 'u3', 'u4']);
      expect(new Set(tableScores.map((row) => row.userId)).size).toBe(tableScores.length);
      expect(tableScores.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
    });

    it('drops the Max Streak column for the total board on period week and widens the score cell', async () => {
      getRankingData.mockResolvedValue({
        status: 200,
        data: {
          rows: [{ rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' }],
          nextCursor: null,
          hasMore: false,
        },
      });

      const renderer = await renderScreen();

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.period.week' }).props.onPress('week');
      });

      const data = getTableProps().data;
      expect(data.columns.map((column) => column.header)).toEqual(['Rank', 'Name', 'Score', 'Others']);
      const scoreColumn = data.columns.find((column) => column.kind === 'score');
      expect(scoreColumn.flex).toBeGreaterThan(1);
      expect(data.columns.some((column) => column.field === 'maxStreak')).toBe(false);
    });
  });

  describe('bidirectional infinite scroll (contract v3)', () => {
    function rankRange(from, to, prefix) {
      const rows = [];
      for (let r = from; r <= to; r++) {
        rows.push({ rank: r, username: `${prefix}${r}`, total_score: 1000 - r, user_id: `u${r}` });
      }
      return rows;
    }

    const v3Window = (overrides = {}) => ({
      rows: rankRange(45, 51, 'me'),
      me: { user_id: 'u48', username: 'me48', total_score: 952, rank: 48 },
      upCursor: 'up-44',
      hasMoreUp: true,
      downCursor: 'down-52',
      hasMoreDown: true,
      ...overrides,
    });

    it('chains scroll-up pages toward rank 1 and stops fetching once the top is reached', async () => {
      getRankingData
        .mockResolvedValueOnce({ status: 200, data: v3Window() })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(25, 44, 'up'), nextCursor: 'up-24', hasMore: true },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(5, 24, 'up'), nextCursor: 'up-4', hasMore: true },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(1, 4, 'up'), nextCursor: null, hasMore: false },
        });

      await renderScreen();

      expect(rankSeq(getTableProps().data.tableScores)).toEqual([45, 46, 47, 48, 49, 50, 51]);

      await act(async () => {
        await getTableProps().onStartReached();
      });
      expect(rankSeq(getTableProps().data.tableScores)).toEqual(Array.from({ length: 27 }, (_, i) => i + 25));

      await act(async () => {
        await getTableProps().onStartReached();
      });
      await act(async () => {
        await getTableProps().onStartReached();
      });

      const finalRows = getTableProps().data.tableScores;
      expect(rankSeq(finalRows)).toEqual(Array.from({ length: 51 }, (_, i) => i + 1));
      expect(new Set(finalRows.map((row) => row.userId)).size).toBe(51);

      await act(async () => {
        await getTableProps().onStartReached();
      });
      expect(getRankingData).toHaveBeenCalledTimes(4);
    });

    it('sends direction=up on scroll-up pages and direction=down on scroll-down pages', async () => {
      getRankingData
        .mockResolvedValueOnce({ status: 200, data: v3Window() })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(25, 44, 'up'), nextCursor: null, hasMore: false },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(52, 71, 'down'), nextCursor: null, hasMore: false },
        });

      await renderScreen();

      await act(async () => {
        await getTableProps().onStartReached();
      });
      await act(async () => {
        await getTableProps().onEndReached();
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        2,
        contextValue,
        { after: 'up-44', direction: 'up', limit: 20, board: 'total', period: 'all' }
      );
      expect(getRankingData).toHaveBeenNthCalledWith(
        3,
        contextValue,
        { after: 'down-52', direction: 'down', limit: 20, board: 'total', period: 'all' }
      );
      expect(rankSeq(getTableProps().data.tableScores)).toEqual([
        ...Array.from({ length: 47 }, (_, i) => i + 25),
      ]);
    });

    it('chains scroll-down pages to the bottom and shows the end text with no further fetches', async () => {
      getRankingData
        .mockResolvedValueOnce({ status: 200, data: v3Window() })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(52, 71, 'down'), nextCursor: 'down-72', hasMore: true },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(72, 91, 'down'), nextCursor: null, hasMore: false },
        });

      const renderer = await renderScreen();

      await act(async () => {
        await getTableProps().onEndReached();
      });
      await act(async () => {
        await getTableProps().onEndReached();
      });

      expect(getTableProps().data.tableScores).toHaveLength(47);
      expect(renderer.root.findAllByProps({ testID: 'ranking.footer.end' }).length).toBeGreaterThan(0);

      await act(async () => {
        await getTableProps().onEndReached();
      });
      expect(getRankingData).toHaveBeenCalledTimes(3);
    });

    it('dedupes and dissolves the separator when an up page overlaps the me-window', async () => {
      getRankingData
        .mockResolvedValueOnce({ status: 200, data: v3Window() })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(42, 49, 'up'), nextCursor: null, hasMore: false },
        });

      await renderScreen();

      await act(async () => {
        await getTableProps().onStartReached();
      });

      const tableScores = getTableProps().data.tableScores;
      expect(rankSeq(tableScores)).toEqual([42, 43, 44, 45, 46, 47, 48, 49, 50, 51]);
      expect(new Set(tableScores.map((row) => row.userId)).size).toBe(tableScores.length);
      expect(tableScores.some((row) => row.separator)).toBe(false);
    });

    it('keeps server ranks on up pages instead of renumbering them', async () => {
      getRankingData
        .mockResolvedValueOnce({ status: 200, data: v3Window() })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(41, 44, 'up'), nextCursor: null, hasMore: false },
        });

      await renderScreen();

      await act(async () => {
        await getTableProps().onStartReached();
      });

      expect(getTableProps().data.tableScores.find((row) => row.rank === 41).name).toBe('up41');
      expect(rankSeq(getTableProps().data.tableScores)).toEqual([41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51]);
    });

    it('keeps scroll-up and scroll-down fetches independent when fired concurrently', async () => {
      let resolveUp;
      let resolveDown;
      getRankingData
        .mockResolvedValueOnce({ status: 200, data: v3Window() })
        .mockReturnValueOnce(new Promise((resolve) => { resolveUp = resolve; }))
        .mockReturnValueOnce(new Promise((resolve) => { resolveDown = resolve; }));

      await renderScreen();

      await act(async () => {
        getTableProps().onStartReached();
        getTableProps().onEndReached();
      });

      expect(getRankingData).toHaveBeenCalledTimes(3);
      expect(getRankingData).toHaveBeenNthCalledWith(
        2,
        contextValue,
        expect.objectContaining({ direction: 'up', after: 'up-44' })
      );
      expect(getRankingData).toHaveBeenNthCalledWith(
        3,
        contextValue,
        expect.objectContaining({ direction: 'down', after: 'down-52' })
      );

      await act(async () => {
        resolveDown({
          status: 200,
          data: { rows: rankRange(52, 53, 'down'), nextCursor: null, hasMore: false },
        });
      });

      expect(rankSeq(getTableProps().data.tableScores)).toEqual([45, 46, 47, 48, 49, 50, 51, 52, 53]);

      await act(async () => {
        resolveUp({
          status: 200,
          data: { rows: rankRange(44, 44, 'up'), nextCursor: null, hasMore: false },
        });
      });

      expect(rankSeq(getTableProps().data.tableScores)).toEqual([44, 45, 46, 47, 48, 49, 50, 51, 52, 53]);
    });

    it('resets both directions and cursors on a board switch', async () => {
      getRankingData
        .mockResolvedValueOnce({ status: 200, data: v3Window() })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(41, 44, 'up'), nextCursor: 'up-40', hasMore: true },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(52, 55, 'down'), nextCursor: 'down-56', hasMore: true },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: v3Window({
            rows: [{ rank: '1', username: 'pioneer', point_score: 55, user_id: 'p1' }],
            me: null,
            upCursor: null,
            hasMoreUp: false,
            downCursor: 'point-down-1',
            hasMoreDown: true,
          }),
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { rows: rankRange(2, 3, 'down'), nextCursor: null, hasMore: false },
        });

      const renderer = await renderScreen();

      await act(async () => {
        await getTableProps().onStartReached();
      });
      await act(async () => {
        await getTableProps().onEndReached();
      });
      expect(getTableProps().data.tableScores).toHaveLength(15);

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.board.point' }).props.onPress('point');
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        4,
        contextValue,
        { scope: 'initial', window: 5, limit: 20, board: 'point', period: 'all' }
      );
      expect(getTableProps().data.tableScores.map((row) => row.rank)).toEqual([1]);

      await act(async () => {
        await getTableProps().onStartReached();
      });
      await act(async () => {
        await getTableProps().onEndReached();
      });

      expect(getRankingData).toHaveBeenCalledTimes(5);
      expect(getRankingData).toHaveBeenNthCalledWith(
        5,
        contextValue,
        { after: 'point-down-1', direction: 'down', limit: 20, board: 'point', period: 'all' }
      );
      expect(getTableProps().data.tableScores.map((row) => row.rank)).toEqual([1, 2, 3]);
    });
  });

  describe('private scope leaderboard (legacy unidirectional contract)', () => {
    const privateRoute = { params: { scope: { kind: 'private', groupId: 'g-1' } } };

    async function renderPrivateScreen() {
      let renderer;

      await act(async () => {
        renderer = create(
          <AuthContext.Provider value={contextValue}>
            <RankingScreen navigation={{ setOptions: jest.fn() }} route={privateRoute} />
          </AuthContext.Provider>
        );
        await flushEffects();
      });

      return renderer;
    }

    it('keeps legacy cursor params without direction and never opens the up direction', async () => {
      getRankingData
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [
              { rank: '1', username: 'waldo', total_score: 100, user_id: 'u1' },
              { rank: '2', username: 'odile', total_score: 80, user_id: 'u2' },
            ],
            nextCursor: 'private-c1',
            hasMore: true,
            me: null,
            meta: null,
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            rows: [{ rank: '3', username: 'bob', total_score: 60, user_id: 'u3' }],
            nextCursor: null,
            hasMore: false,
          },
        });

      await renderPrivateScreen();

      await act(async () => {
        await getTableProps().onStartReached();
      });
      expect(getRankingData).toHaveBeenCalledTimes(1);

      await act(async () => {
        await getTableProps().onEndReached();
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        2,
        contextValue,
        { scope: { kind: 'private', groupId: 'g-1' }, after: 'private-c1', limit: 20, board: 'total' }
      );
      expect(getRankingData.mock.calls[1][1]).not.toHaveProperty('direction');
      expect(getTableProps().data.tableScores.map((row) => row.rank)).toEqual([1, 2, 3]);
    });
  });

  describe('deriveDisplayRows', () => {
    const row = (rank, userId) => ({ rank, name: `n${rank}`, userId });

    it('derives the separator from rank discontinuities without any persisted separator state', () => {
      const display = deriveDisplayRows([
        [row(1, 'a'), row(2, 'b'), row(3, 'c')],
        [row(45, 'd')],
        [row(50, 'e'), row(51, 'f')],
      ]);

      expect(display.map((item) => (item.separator ? 'sep' : item.rank))).toEqual([
        1, 2, 3, 'sep', 45, 'sep', 50, 51,
      ]);
    });

    it('ignores separators persisted by older state so they cannot double up', () => {
      const display = deriveDisplayRows([[row(1, 'a'), row(2, 'b'), { separator: true }, row(3, 'c')]]);

      expect(display.some((item) => item.separator)).toBe(false);
      expect(display.map((item) => item.rank)).toEqual([1, 2, 3]);
    });

    it('dedupes by userId and prefers the initial-slice row', () => {
      const initialRow = { rank: 45, name: 'tail45', userId: 'u45' };
      const cursorRow = { rank: 45, name: 'page45', userId: 'u45' };

      const display = deriveDisplayRows([[row(44, 'u44'), initialRow], [cursorRow]]);

      expect(display.filter((item) => item.rank === 45)).toEqual([initialRow]);
      expect(display).toHaveLength(2);
    });

    it('keeps rows without a userId instead of collapsing them together', () => {
      const display = deriveDisplayRows([[{ rank: 1, name: 'a' }, { rank: 2, name: 'b' }]]);

      expect(display).toHaveLength(2);
    });

    it('re-derives the separator when resident-cap eviction tears a rank hole', () => {
      const display = deriveDisplayRows([[row(40, 'a'), row(41, 'b')], [row(43, 'c')]]);

      expect(display.map((item) => (item.separator ? 'sep' : item.rank))).toEqual([40, 41, 'sep', 43]);
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

  describe('empty ranking state', () => {
    it('shows the empty-state message instead of a stuck loading overlay when a period has no scores', async () => {
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
          data: { rows: [], nextCursor: null, hasMore: false, me: null },
        });

      const renderer = await renderScreen();

      const overlayCallsBeforeSwitch = mockLoadingOverlay.mock.calls.length;

      await act(async () => {
        renderer.root.findByProps({ testID: 'ranking.screen.period.day' }).props.onPress('day');
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        2,
        contextValue,
        { scope: 'initial', window: 5, limit: 20, board: 'total', period: 'day' }
      );

      expect(renderer.root.findAllByProps({ testID: 'ranking.footer.error' })).toHaveLength(0);
      const texts = renderer.root.findAll((node) => typeof node.props.children === 'string');
      expect(texts.map((node) => node.props.children)).toContain('No scores for this period yet.');

      expect(mockLoadingOverlay.mock.calls.length).toBe(overlayCallsBeforeSwitch + 1);
    });

    it('keeps pull-to-refresh wired on the empty state', async () => {
      getRankingData.mockResolvedValue({
        status: 200,
        data: { rows: [], nextCursor: null, hasMore: false, me: null },
      });

      const renderer = await renderScreen();

      const emptyState = renderer.root.findByProps({ testID: 'ranking.empty' });
      const refreshControl = emptyState.props.refreshControl;
      expect(refreshControl).toBeTruthy();
      expect(refreshControl.props.refreshing).toBe(false);

      await act(async () => {
        refreshControl.props.onRefresh();
      });

      expect(getRankingData).toHaveBeenNthCalledWith(
        2,
        contextValue,
        { scope: 'initial', window: 5, limit: 20, board: 'total', period: 'all' }
      );
      expect(refreshControl.props.refreshing).toBe(false);
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
        { scope: 'initial', window: 5, limit: 20, board: 'point', period: 'all' }
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