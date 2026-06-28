import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import TableButton from './TableButton';
import { GlobalStyle } from '../../constants/theme';

function buildRankingMetrics(width, height) {
  return {
    containerPaddingHorizontal: width * 0.04,
    containerPaddingTop: height * 0.04,
    containerPaddingBottom: height * 0.1,

    headerHeight: height * 0.07,
    headerBorderRadius: height * 0.01,
    headerMarginBottom: height * 0.03,
    headerFontSize: height * 0.022,

    rowHeight: height * 0.07,

    cellWidth: width * 0.23,
    cellHeight: height * 0.07,

    textMargin: width * 0.02,
    textFontSize: height * 0.03,

    buttonWidth: width * 0.18,
    buttonHeight: height * 0.03,
    buttonBorderRadius: height * 0.015,
  };
}

function getRankColor(rank) {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C8C8C8';
  if (rank === 3) return '#CD7F32';
  return '#fff';
}

function getRowBackground(rank) {
  if (rank === 1) return 'rgba(255, 215, 0, 0.07)';
  if (rank === 2) return 'rgba(200, 200, 200, 0.06)';
  if (rank === 3) return 'rgba(205, 127, 50, 0.06)';
  return rank % 2 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'transparent';
}

const RowItem = React.memo(function RowItem({ row, onPressMore, metrics, styles }) {
  const rankColor = getRankColor(row.rank);
  const rowBackground = getRowBackground(row.rank);
  return (
    <View style={[styles.row, { backgroundColor: rowBackground }]} testID={`ranking.row.${row.rank}`}>
      <View style={styles.cell}>
        <Text style={[styles.text, styles.big, { color: rankColor, fontWeight: 'bold' }]} numberOfLines={1} testID={`ranking.row.${row.rank}.rank`}>
          {row.rank}
        </Text>
      </View>
      <View style={styles.cell}>
        <Text style={[styles.text, styles.name]} numberOfLines={1} testID={`ranking.row.${row.rank}.name`}>
          {row.name}
        </Text>
      </View>
      <View style={styles.cell}>
        <Text style={[styles.text, styles.big, styles.score]} numberOfLines={1} testID={`ranking.row.${row.rank}.score`}>
          {row.score}
        </Text>
      </View>
      <View style={styles.cell}>
        <TableButton
          accessibilityLabel={`Show more scores for ${row.name}`}
          onPress={() => onPressMore(row.name)}
          testID={`ranking.row.${row.rank}.more`}
          buttonWidth={metrics.buttonWidth}
          buttonHeight={metrics.buttonHeight}
          buttonBorderRadius={metrics.buttonBorderRadius}
        />
      </View>
    </View>
  );
});

export default function TableComponent({ data, onPress, onEndReached }) {
  const { width, height } = useWindowDimensions();
  const metrics = useMemo(() => buildRankingMetrics(width, height), [width, height]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      padding: metrics.containerPaddingHorizontal,
      paddingTop: metrics.containerPaddingTop,
      paddingBottom: metrics.containerPaddingBottom,
      backgroundColor: GlobalStyle.color.primaryColor800,
    },
    head: {
      height: metrics.headerHeight,
      backgroundColor: GlobalStyle.color.primaryColor600,
      flexDirection: 'row',
      alignSelf: "center",
      overflow: "hidden",
      borderTopLeftRadius: metrics.headerBorderRadius,
      borderTopRightRadius: metrics.headerBorderRadius,
      marginBottom: metrics.headerMarginBottom,
      borderBottomWidth: 1.5,
      borderBottomColor: 'rgba(160, 118, 249, 0.5)',
    },
    headText: {
      color: '#c8b4ff',
      fontSize: metrics.headerFontSize,
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontWeight: '700',
    },
    text: {
      margin: metrics.textMargin,
      alignSelf: "center",
      color: "#fff",
    },
    name: {
      fontWeight: '600',
    },
    row: {
      height: metrics.rowHeight,
      flexDirection: 'row',
    },
    cell: {
      width: metrics.cellWidth,
      height: metrics.cellHeight,
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(255, 255, 255, 0.08)',
      textAlign: 'center',
      textAlignVertical: 'center',
      justifyContent: 'center',
    },
    big: {
      fontSize: metrics.textFontSize,
    },
    score: {
      color: GlobalStyle.color.secondaryColor,
      fontWeight: '700',
    },
  }), [metrics]);

  const headers = data?.tableHeaders || [];
  const rows = data?.tableScores || [];

  const onPressMore = useCallback(
    (username) => {
      onPress?.(username);
    },
    [onPress]
  );

  const renderHeader = useCallback(() => {
    return (
      <View style={styles.head} testID="ranking.header">
        {headers.map((header, index) => (
          <View key={`${header}-${index}`} style={styles.cell}>
            <Text style={[styles.text, styles.headText]} numberOfLines={1} testID={`ranking.header.${index}`}>
              {header}
            </Text>
          </View>
        ))}
      </View>
    );
  }, [headers, styles]);

  const renderItem = useCallback(
    ({ item }) => {
      return <RowItem row={item} onPressMore={onPressMore} metrics={metrics} styles={styles} />;
    },
    [onPressMore, metrics, styles]
  );

  return (
    <View style={styles.container} testID="ranking.table">
      <FlatList
        key={`${width}x${height}`}
        data={rows}
        keyExtractor={(item) => String(item.rank)}
        ListHeaderComponent={renderHeader}
        renderItem={renderItem}
        getItemLayout={(data, index) => ({
          length: metrics.rowHeight,
          offset: metrics.rowHeight * index,
          index,
        })}
        initialNumToRender={12}
        windowSize={5}
        removeClippedSubviews // optional; remove if blank rows appear on low-end Android
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={100}
      />
    </View>
  );
};
