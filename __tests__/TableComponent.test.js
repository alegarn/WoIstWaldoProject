import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import TableComponent from '../components/UI/TableComponent';

describe('TableComponent', () => {
  const data = {
    tableHeaders: ['Rank', 'Name', 'Score', 'Others'],
    tableScores: [
      { rank: 1, name: 'waldo', score: 25, others: '' },
      { rank: 2, name: 'odile', score: 14, others: '' },
    ],
  };

  async function renderTable() {
    let renderer;

    await act(async () => {
      renderer = create(<TableComponent data={data} onPress={jest.fn()} />);
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
});