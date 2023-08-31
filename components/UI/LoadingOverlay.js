import { View, Text, StyleSheet } from "react-native";

import Spinner from "./Spinner";
import { GlobalStyle } from "../../constants/theme";

export default function LoadingOverlay({ message }) {
  return (
    <View style={styles.container}>
      <View style={styles.vertical}>
        <Text style={styles.message}>{message}</Text>
          <Spinner />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  message: {
    fontSize: 20,
    color: GlobalStyle.color.secondaryColor100,
  },
  vertical: {
    flexDirection: "column",
    justifyContent: "center",
  },
  horizontal: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
});
