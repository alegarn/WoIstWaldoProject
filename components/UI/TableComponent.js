import React, { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, Dimensions } from 'react-native';

import TableButton from './TableButton';
import { GlobalStyle } from '../../constants/theme';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const RowItem = React.memo(function RowItem({ row, onPressMore }) {
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
          windowHeight={windowHeight}
          windowWidth={windowWidth}
        />
      </View>
    </View>
  );
});

export default function TableComponent({ data, onPress, onEndReached }) {
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
  }, [headers]);

  const renderItem = useCallback(
    ({ item }) => {
      return <RowItem row={item} onPressMore={onPressMore} />;
    },
    [onPressMore]
  );

  return (
    <View style={styles.container} testID="ranking.table">
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.rank)}
        ListHeaderComponent={renderHeader}
        renderItem={renderItem}
        initialNumToRender={12}
        windowSize={10}
        removeClippedSubviews
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: windowWidth * 0.04,
    paddingTop: windowHeight * 0.04,
    paddingBottom: windowHeight * 0.1,
    backgroundColor: GlobalStyle.color.primaryColor,
  },
  borderStyle: {
    borderColor: 'transparent',
  },
  head: {
    height: windowHeight * 0.07,
    backgroundColor: GlobalStyle.color.primaryColor300,
    flexDirection: 'row',
    alignSelf: "center",
    overflow: "hidden",
    borderTopLeftRadius: windowHeight * 0.01,
    borderTopRightRadius: windowHeight * 0.01,
    marginBottom: windowHeight * 0.03,
  },
  headText: {
    color: "#fff",
    fontSize: windowHeight * 0.03,
  },
  text: {
    margin: windowWidth * 0.02,
    alignSelf: "center",
    color: GlobalStyle.color.primaryColor,
  },
  row: {
    height: windowHeight * 0.07,
    flexDirection: 'row',
  },
  cell: {
    width: windowWidth * 0.23,
    height: windowHeight * 0.07,
    borderBottomWidth: 0.5,
    borderBottomColor: GlobalStyle.color.primaryColor900,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  big: {
    fontSize: windowHeight * 0.03,
  }
});
