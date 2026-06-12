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
    headerFontSize: height * 0.03,

    rowHeight: height * 0.07,

    cellWidth: width * 0.23,
    cellHeight: height * 0.07,

    textMargin: width * 0.02,
    textFontSize: height * 0.03,

    buttonWidth: width * 0.18,
    buttonHeight: height * 0.03,
    buttonBorderRadius: 5,
  };
}

const RowItem = React.memo(function RowItem({ row, onPressMore, metrics, styles }) {
  return (
    <View style={styles.row} testID={`ranking.row.${row.rank}`}>
      <View style={styles.cell}>
        <Text style={[styles.text, styles.big]} numberOfLines={1} testID={`ranking.row.${row.rank}.rank`}>
          {row.rank}
        </Text>
      </View>
      <View style={styles.cell}>
        <Text style={[styles.text, styles.name]} numberOfLines={1} testID={`ranking.row.${row.rank}.name`}>
          {row.name}
        </Text>
      </View>
      <View style={styles.cell}>
        <Text style={[styles.text, styles.big]} numberOfLines={1} testID={`ranking.row.${row.rank}.score`}>
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
      backgroundColor: GlobalStyle.color.primaryColor,
    },
    head: {
      height: metrics.headerHeight,
      backgroundColor: GlobalStyle.color.primaryColor300,
      flexDirection: 'row',
      alignSelf: "center",
      overflow: "hidden",
      borderTopLeftRadius: metrics.headerBorderRadius,
      borderTopRightRadius: metrics.headerBorderRadius,
      marginBottom: metrics.headerMarginBottom,
    },
    headText: {
      color: "#fff",
      fontSize: metrics.headerFontSize,
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
      borderBottomColor: GlobalStyle.color.primaryColor900,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    big: {
      fontSize: metrics.textFontSize,
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
