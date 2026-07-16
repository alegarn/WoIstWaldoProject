import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import TableComponent from '../components/UI/TableComponent';
import { GlobalStyle } from '../constants/theme';
import { PrivateGroupThemeProvider } from '../store/privateGroupTheme-context';
import { getPrivateGroupTheme } from '../utils/privateGroupTheme';

describe('TableComponent', () => {
  const data = {
    tableHeaders: ['Rank', 'Name', 'Score', 'Others'],
    tableScores: [
      { rank: 1, name: 'waldo', score: 25, others: '' },
      { rank: 2, name: 'odile', score: 14, others: '' },
    ],
  };

  const dataFiveCol = {
    tableHeaders: ['Rank', 'Name', 'Score', 'Max Streak', 'Others'],
    tableScores: [
      { rank: 1, name: 'waldo', score: 25, maxStreak: 7, others: '' },
      { rank: 2, name: 'odile', score: 14, maxStreak: 3, others: '' },
    ],
  };

  async function renderTable(dataOverride) {
    let renderer;

    await act(async () => {
      renderer = create(<TableComponent data={dataOverride ?? data} onPress={jest.fn()} />);
    });

    return renderer;
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

  it('renders one header cell per provided column', async () => {
    const renderer = await renderTable();
    const headerLabels = ['Rank', 'Name', 'Score', 'Others'];

    headerLabels.forEach((label, index) => {
      const headerCell = renderer.root.findByProps({ testID: `ranking.header.${index}` });
      expect(headerCell.props.children).toBe(label);
    });
  });

  describe('with five columns including Max Streak', () => {
    it('renders the Max Streak header in the fourth position', async () => {
      const renderer = await renderTable(dataFiveCol);
      const maxStreakHeader = renderer.root.findByProps({ testID: 'ranking.header.3' });

      expect(maxStreakHeader.props.children).toBe('Max Streak');
    });

    it('renders five cells per row including the maxStreak value and the Others button', async () => {
      const renderer = await renderTable(dataFiveCol);

      const rank = renderer.root.findByProps({ testID: 'ranking.row.1.rank' });
      const name = renderer.root.findByProps({ testID: 'ranking.row.1.name' });
      const score = renderer.root.findByProps({ testID: 'ranking.row.1.score' });
      const maxStreak = renderer.root.findByProps({ testID: 'ranking.row.1.maxStreak' });
      const more = renderer.root.findByProps({ testID: 'ranking.row.1.more' });

      expect(rank.props.children).toBe(1);
      expect(name.props.children).toBe('waldo');
      expect(score.props.children).toBe(25);
      expect(maxStreak.props.children).toBe(7);
      expect(more).toBeDefined();
    });
  });
});
