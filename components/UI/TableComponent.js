import { StyleSheet, View, Dimensions } from 'react-native';
import { Table, TableWrapper, Row, Cell } from 'react-native-reanimated-table';

import TableButton from './TableButton';
import { GlobalStyle } from '../../constants/theme';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

export default function TableComponent({ data, onPress }) {
  const cellStyles = (cellData, cellIndex, rowData) => {
    switch (cellIndex) {
      case 0:
        return(
        <Cell
          key={cellIndex}
          data={cellData}
          textStyle={[styles.text, styles.big]}
          style={styles.cell}
        />
        );
      case 1:
        return(
          <Cell
            key={cellIndex}
            data={cellData}
            textStyle={[styles.text, styles.name]}
            style={styles.cell}
          />
          );
      case 2:
        return(
          <Cell
            key={cellIndex}
            data={cellData}
            textStyle={[styles.text, styles.big]}
            style={styles.cell}
          />
          );
      case 3:
        return(
          <Cell
            key={cellIndex}
            data={
              <TableButton
                cellData={cellData}
                onPress={() => onPress(rowData.name)}
                windowHeight={windowHeight}
                windowWidth={windowWidth}
              />
            }
            textStyle={[styles.text]}
            style={styles.cell}
          />
        );
      default:
        break;
    };
  };

  return (
    <View style={styles.container}>
      <Table borderStyle={styles.borderStyle}>
        <Row
          data={data.tableHeaders}
          style={styles.head}
          textStyle={[styles.text, styles.headText]}
        />
        {data?.tableScores?.map((rowData, index) => (
          <TableWrapper key={index} style={styles.row}>
            {Object.values(rowData).map((cellData, cellIndex) => (
              cellStyles(cellData, cellIndex, rowData)
            ))}
          </TableWrapper>
          ))
        }
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
