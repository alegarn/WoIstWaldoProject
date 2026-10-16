// Integration spec crossing the screen/table mock boundary: RankingScreen's
// converted rows feed the REAL TableComponent, whose RowItem reads
// row[column.field] with the descriptor fields total_score|point_score|
// shape_score. Pins that the raw score keys survive row conversion.
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

jest.mock('../hooks/useActiveGroup', () => ({
  useActiveGroup: () => ({ scope: { kind: 'public' } }),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import RankingScreen from '../screens/RankingScreen';
import { AuthContext } from '../store/auth-context';
import { getRankingData } from '../utils/scoreRequests';

describe('RankingScreen + TableComponent integration', () => {
  const contextValue = { token: 'token', userId: '42' };

  const apiRows = [
    {
      rank: '1',
      username: 'waldo',
      total_score: 250,
      point_score: 120,
      shape_score: 130,
      max_streak: 4,
      user_id: 'u1',
    },
    {
      rank: '2',
      username: 'odile',
      total_score: 200,
      point_score: 110,
      shape_score: 90,
      max_streak: 2,
      user_id: 'u2',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    getRankingData.mockImplementation(() =>
      Promise.resolve({
        status: 200,
        data: { rows: apiRows, nextCursor: null, hasMore: false },
      })
    );
  });

  async function renderScreen() {
    let renderer;

    await act(async () => {
      renderer = create(
        <AuthContext.Provider value={contextValue}>
          <RankingScreen navigation={{ setOptions: jest.fn() }} />
        </AuthContext.Provider>
      );

      await Promise.resolve();
      await Promise.resolve();
    });

    return renderer;
  }

  function scoreCellText(renderer, rank, field) {
    return renderer.root.findByProps({ testID: `ranking.row.${rank}.${field}` }).props.children;
  }

  it('renders the real total-board score cells from the normalized payload score keys', async () => {
    const renderer = await renderScreen();

    expect(getRankingData).toHaveBeenCalledWith(
      contextValue,
      expect.objectContaining({ board: 'total' })
    );
    expect(scoreCellText(renderer, 1, 'total_score')).toBe(250);
    expect(scoreCellText(renderer, 2, 'total_score')).toBe(200);
  });

  it('renders the real shape-board score cells from the same payload after a board switch', async () => {
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'ranking.screen.board.shape' }).props.onPress('shape');
    });

    expect(getRankingData).toHaveBeenLastCalledWith(
      contextValue,
      expect.objectContaining({ board: 'shape' })
    );
    expect(scoreCellText(renderer, 1, 'shape_score')).toBe(130);
    expect(scoreCellText(renderer, 2, 'shape_score')).toBe(90);
  });
});
