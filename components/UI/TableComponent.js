import React, { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import TableButton from './TableButton';
import { GlobalStyle } from '../../constants/theme';
import { columnsForBoard } from '../../constants/ranking';
import { usePrivateGroupTheme } from '../../store/privateGroupTheme-context';

function buildRankingMetrics(width, height) {
  return {
    containerPaddingHorizontal: width * 0.04,
    containerPaddingTop: height * 0.04,
    containerPaddingBottom: height * 0.1,

    headerHeight: height * 0.078,
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

function getRankColor(rank, medals) {
  if (rank === 1) return medals.gold;
  if (rank === 2) return medals.silver;
  if (rank === 3) return medals.bronze;
  return '#fff';
}

function getRowBackground(rank, medals) {
  if (rank === 1) return medals.goldTint;
  if (rank === 2) return medals.silverTint;
  if (rank === 3) return medals.bronzeTint;
  return rank % 2 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'transparent';
}

function headerLabel(column, t) {
  const translated = t(column.i18nKey);
  return translated === column.i18nKey ? column.header : translated;
}

function cellTextStyle(kind, styles, rankColor) {
  if (kind === 'rank') return [styles.text, styles.big, { color: rankColor, fontWeight: 'bold' }];
  if (kind === 'name') return [styles.text, styles.name];
  if (kind === 'score') return [styles.text, styles.big, styles.score];
  if (kind === 'score-emphasis') return [styles.text, styles.big, styles.score, styles.scoreEmphasis];
  return [styles.text];
}

const RowItem = React.memo(function RowItem({ row, columns, onPressMore, metrics, styles, medalPalette, t }) {
  const rankColor = getRankColor(row.rank, medalPalette);
  const rowBackground = getRowBackground(row.rank, medalPalette);
  return (
    <View style={[styles.row, { backgroundColor: rowBackground }]} testID={`ranking.row.${row.rank}`}>
      {columns.map((column, index) => {
        const key = `${column.field}-${index}`;
        if (column.kind === 'button') {
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
          <View key={key} style={[styles.cell, { flex: column.flex }]}>
            <Text
              style={cellTextStyle(column.kind, styles, rankColor)}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              testID={`ranking.row.${row.rank}.${column.field}`}
            >
              {row[column.field]}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

const SeparatorItem = React.memo(function SeparatorItem({ styles, metrics }) {
  return (
    <View style={[styles.separatorRow, { height: metrics.rowHeight }]} testID="ranking.separator">
      <Text style={styles.separatorText}>⋯</Text>
    </View>
  );
});

export default function TableComponent({ data, onPress, onEndReached, refreshing, onRefresh, refreshTint }) {
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation();
  const metrics = useMemo(() => buildRankingMetrics(width, height), [width, height]);
  const theme = usePrivateGroupTheme();
  const containerBg = theme ? theme.screen : GlobalStyle.color.primaryColor800;
  const headBg = theme ? theme.insetDeep : GlobalStyle.color.primaryColor600;
  const scoreColor = theme ? theme.secondaryColor : GlobalStyle.color.secondaryColor;
  const headTextColor = theme ? theme.muted : '#c8b4ff';
  const medals = useMemo(() => ({
    gold: theme?.medalGold ?? GlobalStyle.color.medalGold,
    silver: theme?.medalSilver ?? GlobalStyle.color.medalSilver,
    bronze: theme?.medalBronze ?? GlobalStyle.color.medalBronze,
    goldTint: theme?.medalGoldTint ?? GlobalStyle.color.medalGoldTint,
    silverTint: theme?.medalSilverTint ?? GlobalStyle.color.medalSilverTint,
    bronzeTint: theme?.medalBronzeTint ?? GlobalStyle.color.medalBronzeTint,
  }), [theme]);

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
      letterSpacing: 0.2,
      textAlign: 'center',
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
    scoreEmphasis: {
      fontSize: metrics.textFontSize * 1.1,
    },
    separatorRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    separatorText: {
      color: headTextColor,
      fontSize: metrics.headerFontSize,
      textAlign: 'center',
    },
  }), [metrics, containerBg, headBg, scoreColor, headTextColor]);

  const columns = useMemo(
    () => data?.columns ?? columnsForBoard(data?.board),
    [data?.columns, data?.board]
  );
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
        {columns.map((column, index) => (
          <View key={`${column.field}-${index}`} style={[styles.cell, { flex: column.flex }]}>
            <Text
              style={[styles.text, styles.headText]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              testID={`ranking.header.${index}`}
            >
              {headerLabel(column, t)}
            </Text>
          </View>
        ))}
      </View>
    );
  }, [columns, styles, t]);

  const renderItem = useCallback(
    ({ item }) => {
      if (item.separator) {
        return <SeparatorItem styles={styles} metrics={metrics} />;
      }
      return <RowItem row={item} columns={columns} onPressMore={onPressMore} metrics={metrics} styles={styles} medalPalette={medals} t={t} />;
    },
    [columns, onPressMore, metrics, styles, medals, t]
  );

  const keyExtractor = useCallback(
    (item) => {
      if (item.separator) return 'ellipsis';
      return item.userId != null ? String(item.userId) : `rank-${item.rank}`;
    },
    []
  );

  return (
    <View style={styles.container} testID="ranking.table">
      <FlatList
        key={`${width}x${height}`}
        data={rows}
        keyExtractor={keyExtractor}
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
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
              tintColor={refreshTint}
            />
          ) : null
        }
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={100}
      />
    </View>
  );
};
