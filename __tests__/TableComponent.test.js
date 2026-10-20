import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import TableComponent from '../components/UI/TableComponent';
import { GlobalStyle } from '../constants/theme';
import { columnsForBoard } from '../constants/ranking';
import { PrivateGroupThemeProvider } from '../store/privateGroupTheme-context';
import { getPrivateGroupTheme } from '../utils/privateGroupTheme';

describe('TableComponent', () => {
  const totalRows = [
    { rank: 1, name: 'waldo', total_score: 25, maxStreak: 7, others: '', userId: 'u-1' },
    { rank: 2, name: 'odile', total_score: 14, maxStreak: 3, others: '', userId: 'u-2' },
  ];

  const data = {
    columns: columnsForBoard('total'),
    tableScores: totalRows,
  };

  async function renderTable(dataOverride, wrapper) {
    let renderer;

    const table = <TableComponent data={dataOverride ?? data} onPress={jest.fn()} />;

    await act(async () => {
      renderer = create(wrapper ? <wrapper>{table}</wrapper> : table);
    });

    return renderer;
  }

  function renderWithPrivateTheme(dataOverride, group) {
    return renderTable(
      dataOverride,
      ({ children }) => (
        <PrivateGroupThemeProvider group={group}>{children}</PrivateGroupThemeProvider>
      )
    );
  }

  function headerLabels(renderer, count) {
    return Array.from({ length: count }, (_, index) =>
      renderer.root.findByProps({ testID: `ranking.header.${index}` }).props.children
    );
  }

  it('renders readable row text against the leaderboard background', async () => {
    const renderer = await renderTable();
    const rowName = renderer.root.findByProps({ testID: 'ranking.row.1.name' });

    expect(StyleSheet.flatten(rowName.props.style)).toEqual(
      expect.objectContaining({
        color: '#fff',
      })
    );
  });

  it('provides getItemLayout with fixed row height derived from window dimensions', async () => {
    const renderer = await renderTable();
    const flatList = renderer.root.findByType(FlatList);
    const getItemLayout = flatList.props.getItemLayout;

    const layout0 = getItemLayout(null, 0);
    expect(layout0).toEqual({
      length: expect.any(Number),
      offset: 0,
      index: 0,
    });
    expect(layout0.length).toBeGreaterThan(0);

    const layout5 = getItemLayout(null, 5);
    expect(layout5).toEqual({
      length: expect.any(Number),
      offset: layout0.length * 5,
      index: 5,
    });
    expect(layout5.length).toBeGreaterThan(0);
  });

  it('passes bounded-scrolling FlatList props for leaderboard performance', async () => {
    const renderer = await renderTable();
    const flatList = renderer.root.findByType(FlatList);

    expect(flatList.props.initialNumToRender).toBeGreaterThan(0);
    expect(flatList.props.windowSize).toBeGreaterThan(0);
    expect(flatList.props.onEndReachedThreshold).toBe(0.5);
    expect(flatList.props.maxToRenderPerBatch).toBe(5);
    expect(flatList.props.updateCellsBatchingPeriod).toBe(100);
    expect(flatList.props.removeClippedSubviews).toBeTruthy();
  });

  it('threads the pull-to-refresh contract into the FlatList refresh control', async () => {
    const onRefresh = jest.fn();

    let renderer;
    await act(async () => {
      renderer = create(
        <TableComponent data={data} onPress={jest.fn()} refreshing={true} onRefresh={onRefresh} refreshTint="#FFCC00" />
      );
    });

    const refreshControl = renderer.root.findByType(FlatList).props.refreshControl;
    expect(refreshControl.props.refreshing).toBe(true);
    expect(refreshControl.props.onRefresh).toBe(onRefresh);
    expect(refreshControl.props.tintColor).toBe('#FFCC00');
  });

  it('renders no refresh control when no onRefresh contract is provided', async () => {
    const renderer = await renderTable();

    expect(renderer.root.findByType(FlatList).props.refreshControl).toBeNull();
  });

  it('uses the public palette container background when no private group theme is present', async () => {
    const renderer = await renderTable();
    const container = renderer.root.findByProps({ testID: 'ranking.table' });

    expect(StyleSheet.flatten(container.props.style).backgroundColor).toBe(
      GlobalStyle.color.primaryColor800
    );
  });

  it('uses the active private group theme container background when wrapped in a provider', async () => {
    const group = { primary_color: '#198868', secondary_color: '#FFCC00' };
    const expectedTheme = getPrivateGroupTheme({ primaryColor: '#198868' });
    let renderer;

    await act(async () => {
      renderer = create(
        <PrivateGroupThemeProvider group={group}>
          <TableComponent data={data} onPress={jest.fn()} />
        </PrivateGroupThemeProvider>
      );
    });

    const container = renderer.root.findByProps({ testID: 'ranking.table' });

    expect(StyleSheet.flatten(container.props.style).backgroundColor).toBe(expectedTheme.screen);
  });

  it('renders one header cell per provided column descriptor', async () => {
    const renderer = await renderTable();
    const labels = headerLabels(renderer, 5);

    expect(labels).toEqual(['Rank', 'Name', 'Score', 'Max Streak', 'Others']);
  });

  it('renders five cells per row including the maxStreak value and the Others button', async () => {
    const renderer = await renderTable();

    const rank = renderer.root.findByProps({ testID: 'ranking.row.1.rank' });
    const name = renderer.root.findByProps({ testID: 'ranking.row.1.name' });
    const score = renderer.root.findByProps({ testID: 'ranking.row.1.total_score' });
    const maxStreak = renderer.root.findByProps({ testID: 'ranking.row.1.maxStreak' });
    const more = renderer.root.findByProps({ testID: 'ranking.row.1.more' });

    expect(rank.props.children).toBe(1);
    expect(name.props.children).toBe('waldo');
    expect(score.props.children).toBe(25);
    expect(maxStreak.props.children).toBe(7);
    expect(more).toBeDefined();
  });

  describe('per-board column descriptors', () => {
    it('renders the total board headers Rank, Name, Score, Max Streak, Others', async () => {
      const renderer = await renderTable();

      expect(headerLabels(renderer, 5)).toEqual(['Rank', 'Name', 'Score', 'Max Streak', 'Others']);
    });

    it('renders the point board headers Rank, Name, Point Score, Others from descriptors', async () => {
      const renderer = await renderTable({
        columns: columnsForBoard('point'),
        tableScores: [
          { rank: 1, name: 'waldo', point_score: 30, others: '', userId: 'u-1' },
          { rank: 2, name: 'odile', point_score: 12, others: '', userId: 'u-2' },
        ],
      });

      expect(headerLabels(renderer, 4)).toEqual(['Rank', 'Name', 'Point Score', 'Others']);
      expect(renderer.root.findByProps({ testID: 'ranking.row.1.point_score' }).props.children).toBe(30);
    });

    it('renders the shape board headers Rank, Name, Contour Score, Others from descriptors', async () => {
      const renderer = await renderTable({
        columns: columnsForBoard('shape'),
        tableScores: [
          { rank: 1, name: 'waldo', shape_score: 44, others: '', userId: 'u-1' },
          { rank: 2, name: 'odile', shape_score: 21, others: '', userId: 'u-2' },
        ],
      });

      expect(headerLabels(renderer, 4)).toEqual(['Rank', 'Name', 'Contour Score', 'Others']);
      expect(renderer.root.findByProps({ testID: 'ranking.row.1.shape_score' }).props.children).toBe(44);
    });

    it('falls back to the literal header string when the i18n key is not translated yet', async () => {
      const columns = columnsForBoard('point').map((column) =>
        column.kind === 'score-emphasis'
          ? { ...column, i18nKey: 'ui.ranking.notDraftedYet' }
          : column
      );
      const renderer = await renderTable({
        columns,
        tableScores: [{ rank: 1, name: 'waldo', point_score: 30, others: '', userId: 'u-1' }],
      });

      expect(headerLabels(renderer, 4)).toEqual(['Rank', 'Name', 'Point Score', 'Others']);
    });

    it('renders the total board when only legacy header-string data is provided', async () => {
      const renderer = await renderTable({
        tableHeaders: ['Rank', 'Name', 'Score', 'Max Streak', 'Others'],
        tableScores: totalRows,
      });

      expect(headerLabels(renderer, 5)).toEqual(['Rank', 'Name', 'Score', 'Max Streak', 'Others']);
      expect(renderer.root.findByProps({ testID: 'ranking.row.1.total_score' }).props.children).toBe(25);
    });
  });

  describe('score-emphasis cells', () => {
    it('renders the board-primary score bold, in the secondary color, slightly larger', async () => {
      const renderer = await renderTable();
      const baseScore = StyleSheet.flatten(
        renderer.root.findByProps({ testID: 'ranking.row.1.total_score' }).props.style
      );
      const rendererPoint = await renderTable({
        columns: columnsForBoard('point'),
        tableScores: [{ rank: 1, name: 'waldo', point_score: 30, others: '', userId: 'u-1' }],
      });
      const emphasisScore = StyleSheet.flatten(
        rendererPoint.root.findByProps({ testID: 'ranking.row.1.point_score' }).props.style
      );

      expect(emphasisScore.color).toBe(GlobalStyle.color.secondaryColor);
      expect(emphasisScore.fontWeight).toBe('700');
      expect(emphasisScore.fontSize).toBeGreaterThan(baseScore.fontSize);
    });
  });

  describe('header text fit', () => {
    it('renders header text on a single line with font auto-shrink', async () => {
      const renderer = await renderTable();
      const headerText = renderer.root.findByProps({ testID: 'ranking.header.1' });

      expect(headerText.props.numberOfLines).toBe(1);
      expect(headerText.props.adjustsFontSizeToFit).toBe(true);
      expect(headerText.props.minimumFontScale).toBeGreaterThanOrEqual(0.5);
      expect(headerText.props.minimumFontScale).toBeLessThanOrEqual(0.65);
    });

    it('styles header text without uppercase transform and with tight letterSpacing', async () => {
      const renderer = await renderTable();
      const headerText = renderer.root.findByProps({ testID: 'ranking.header.1' });
      const flattened = StyleSheet.flatten(headerText.props.style);

      expect(flattened.textTransform).toBeUndefined();
      expect(flattened.letterSpacing).toBeLessThanOrEqual(0.5);
    });
  });

  describe('key extraction', () => {
    it('keys rows by userId with a rank-prefixed fallback stable across renumbering', async () => {
      const renderer = await renderTable();
      const keyExtractor = renderer.root.findByType(FlatList).props.keyExtractor;

      expect(keyExtractor({ userId: 'u-9', rank: 4 })).toBe('u-9');
      expect(keyExtractor({ rank: 4 })).toBe('rank-4');
      expect(keyExtractor({ userId: 'u-9', rank: 1 })).toBe(keyExtractor({ userId: 'u-9', rank: 7 }));
    });
  });

  describe('medal theme tokens', () => {
    it('sources rank medal color and row tint from public GlobalStyle tokens', async () => {
      const renderer = await renderTable();
      const rankText = StyleSheet.flatten(
        renderer.root.findByProps({ testID: 'ranking.row.1.rank' }).props.style
      );
      const rowOne = renderer.root.findByProps({ testID: 'ranking.row.1' });
      const rankTwoText = StyleSheet.flatten(
        renderer.root.findByProps({ testID: 'ranking.row.2.rank' }).props.style
      );

      expect(rankText.color).toBe(GlobalStyle.color.medalGold);
      expect(StyleSheet.flatten(rowOne.props.style).backgroundColor).toBe(
        GlobalStyle.color.medalGoldTint
      );
      expect(rankTwoText.color).toBe(GlobalStyle.color.medalSilver);
    });

    it('lets a private group theme override the rendered medal row tint', async () => {
      const group = { primary_color: '#198868', secondary_color: '#FFCC00' };
      const expectedTheme = getPrivateGroupTheme({
        primaryColor: '#198868',
        secondaryColor: '#FFCC00',
      });
      let renderer;

      await act(async () => {
        renderer = create(
          <PrivateGroupThemeProvider group={group}>
            <TableComponent data={data} onPress={jest.fn()} />
          </PrivateGroupThemeProvider>
        );
      });

      const rowOne = renderer.root.findByProps({ testID: 'ranking.row.1' });

      expect(StyleSheet.flatten(rowOne.props.style).backgroundColor).toBe(
        expectedTheme.medalGoldTint
      );
      expect(expectedTheme.medalGoldTint).not.toBe(GlobalStyle.color.medalGoldTint);
    });
  });
});
