import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import TableButton from './TableButton';
import { GlobalStyle } from '../../constants/theme';
import { usePrivateGroupTheme } from '../../store/privateGroupTheme-context';

const COLUMNS = [
  { header: 'Rank',       field: 'rank',      flex: 0.7, kind: 'rank', key: 'ui.ranking.rank' },
  { header: 'Name',       field: 'name',      flex: 1.6, kind: 'name', key: 'ui.ranking.name' },
  { header: 'Score',      field: 'score',     flex: 1,   kind: 'score', key: 'ui.ranking.score' },
  { header: 'Max Streak', field: 'maxStreak', flex: 1,   kind: 'text', key: 'ui.ranking.maxStreak' },
  { header: 'Others',     field: 'others',    flex: 0.9, kind: 'button', key: 'ui.ranking.others' },
];

function getColumnDescriptor(header) {
  return COLUMNS.find((column) => column.header === header);
}

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

function cellTextStyle(kind, styles, rankColor) {
  if (kind === 'rank') return [styles.text, styles.big, { color: rankColor, fontWeight: 'bold' }];
  if (kind === 'name') return [styles.text, styles.name];
  if (kind === 'score') return [styles.text, styles.big, styles.score];
  return [styles.text];
}

const RowItem = React.memo(function RowItem({ row, headers, onPressMore, metrics, styles, t }) {
  const rankColor = getRankColor(row.rank);
  const rowBackground = getRowBackground(row.rank);
  return (
    <View style={[styles.row, { backgroundColor: rowBackground }]} testID={`ranking.row.${row.rank}`}>
      {headers.map((header, index) => {
        const column = getColumnDescriptor(header);
        const key = `${header}-${index}`;
        if (column?.kind === 'button') {
          return (
            <View key={key} style={[styles.cell, { flex: column.flex }]}>
              <TableButton
                accessibilityLabel={t('ui.ranking.moreScores', { name: row.name })}
                onPress={() => onPressMore(row.name)}
                testID={`ranking.row.${row.rank}.more`}
                buttonWidth={metrics.buttonWidth}
                buttonHeight={metrics.buttonHeight}
                buttonBorderRadius={metrics.buttonBorderRadius}
              />
            </View>
          );
        }
        return (
          <View key={key} style={[styles.cell, { flex: column?.flex ?? 1 }]}>
            <Text
              style={cellTextStyle(column?.kind, styles, rankColor)}
              numberOfLines={1}
              testID={`ranking.row.${row.rank}.${column?.field ?? header}`}
            >
              {row[column?.field]}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

export default function TableComponent({ data, onPress, onEndReached }) {
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation();
  const metrics = useMemo(() => buildRankingMetrics(width, height), [width, height]);
  const theme = usePrivateGroupTheme();
  const containerBg = theme ? theme.screen : GlobalStyle.color.primaryColor800;
  const headBg = theme ? theme.insetDeep : GlobalStyle.color.primaryColor600;
  const scoreColor = theme ? theme.secondaryColor : GlobalStyle.color.secondaryColor;
  const headTextColor = theme ? theme.muted : '#c8b4ff';

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      padding: metrics.containerPaddingHorizontal,
      paddingTop: metrics.containerPaddingTop,
      paddingBottom: metrics.containerPaddingBottom,
      backgroundColor: containerBg,
    },
    head: {
      height: metrics.headerHeight,
      backgroundColor: headBg,
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
      color: headTextColor,
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
      color: scoreColor,
      fontWeight: '700',
    },
  }), [metrics, containerBg, headBg, scoreColor, headTextColor]);

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
        {headers.map((header, index) => {
          const column = getColumnDescriptor(header);
          return (
            <View key={`${header}-${index}`} style={[styles.cell, { flex: column?.flex ?? 1 }]}>
              <Text style={[styles.text, styles.headText]} numberOfLines={1} testID={`ranking.header.${index}`}>
                {column ? t(column.key) : header}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }, [headers, styles, t]);

  const renderItem = useCallback(
    ({ item }) => {
      return <RowItem row={item} headers={headers} onPressMore={onPressMore} metrics={metrics} styles={styles} t={t} />;
    },
    [headers, onPressMore, metrics, styles, t]
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
