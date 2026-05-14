import React from 'react';
import { StyleSheet } from 'react-native';
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
});