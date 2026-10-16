// Single source of truth for the leaderboard column contract (per board).
// Each descriptor: { board, header, field, flex, kind, i18nKey }.
// TableComponent receives the descriptor list as `data.columns`; the screen
// resolves the active board with columnsForBoard(board). Score fields follow
// the plan-02 locked server naming (total_score | point_score | shape_score).
export const RANKING_BOARD_COLUMNS = {
  total: [
    { board: 'total', header: 'Rank', field: 'rank', flex: 0.7, kind: 'rank', i18nKey: 'ui.ranking.rank' },
    { board: 'total', header: 'Name', field: 'name', flex: 1.6, kind: 'name', i18nKey: 'ui.ranking.name' },
    { board: 'total', header: 'Score', field: 'total_score', flex: 1, kind: 'score', i18nKey: 'ui.ranking.score' },
    { board: 'total', header: 'Max Streak', field: 'maxStreak', flex: 1, kind: 'text', i18nKey: 'ui.ranking.maxStreak' },
    { board: 'total', header: 'Others', field: 'others', flex: 0.9, kind: 'button', i18nKey: 'ui.ranking.others' },
  ],
  point: [
    { board: 'point', header: 'Rank', field: 'rank', flex: 0.7, kind: 'rank', i18nKey: 'ui.ranking.rank' },
    { board: 'point', header: 'Name', field: 'name', flex: 1.6, kind: 'name', i18nKey: 'ui.ranking.name' },
    { board: 'point', header: 'Point Score', field: 'point_score', flex: 1.9, kind: 'score-emphasis', i18nKey: 'ui.ranking.pointScore' },
    { board: 'point', header: 'Others', field: 'others', flex: 0.9, kind: 'button', i18nKey: 'ui.ranking.others' },
  ],
  shape: [
    { board: 'shape', header: 'Rank', field: 'rank', flex: 0.7, kind: 'rank', i18nKey: 'ui.ranking.rank' },
    { board: 'shape', header: 'Name', field: 'name', flex: 1.6, kind: 'name', i18nKey: 'ui.ranking.name' },
    { board: 'shape', header: 'Contour Score', field: 'shape_score', flex: 1.9, kind: 'score-emphasis', i18nKey: 'ui.ranking.contourScore' },
    { board: 'shape', header: 'Others', field: 'others', flex: 0.9, kind: 'button', i18nKey: 'ui.ranking.others' },
  ],
};

// Active leaderboard boards, in tab order. Single source of truth for the
// board switch guard (RankingScreen) and the tab list (BoardTabs).
export const BOARDS = ['total', 'point', 'shape'];

export function columnsForBoard(board) {
  return RANKING_BOARD_COLUMNS[board] ?? RANKING_BOARD_COLUMNS.total;
}

// Legacy consumer shim: consumed only by the frontend-smoke test to pin the
// total-board header order.
export const RANKING = {
  tableHeaders: RANKING_BOARD_COLUMNS.total.map((column) => column.header),
};
