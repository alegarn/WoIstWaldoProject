import { StyleSheet, View, Dimensions, ScrollView } from 'react-native';
import { Table, TableWrapper, Row, Cell } from 'react-native-reanimated-table';

import TableButton from './TableButton';
import { GlobalStyle } from '../../constants/theme';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

export default function TableComponent({ data, onPress }) {

  return (
    <View style={styles.container}>
      <Table borderStyle={styles.borderStyle}>
        <Row
          data={data.tableHeaders}
          style={styles.head}
          textStyle={[styles.text, styles.headText]} />
        <ScrollView>
          {data.tableScores.map((rowData, index) => (
            <TableWrapper key={index} style={styles.row}>
              {Object.values(rowData).map((cellData, cellIndex) => (
                  <Cell
                    key={cellIndex}
                    data={
                      cellIndex === 3
                        ? <TableButton cellData={cellData} rowData={rowData} onPress={onPress} windowHeight={windowHeight} windowWidth={windowWidth}/>
                        : cellData
                    }
                    textStyle={styles.text}
                  />
                )
              )}
            </TableWrapper>
          ))}
        </ScrollView>
      </Table>
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
    alignSelf: "center",
    overflow: "hidden",
    borderTopLeftRadius : 5,
    borderTopRightRadius : 5,
  },
  headText: {
    color: "#fff",
    fontSize: windowHeight * 0.03,
  },
  text: {
    margin: windowWidth * 0.02,
    alignSelf: "center",
    color: "#fff",
  },
  row: {
    flexDirection: 'row',
    backgroundColor: GlobalStyle.color.secondaryColor100,
  },
});
