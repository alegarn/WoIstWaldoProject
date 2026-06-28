import { useLayoutEffect } from "react";
import { View, StyleSheet } from "react-native";

import { handleOrientation } from "../../utils/orientation";

import ShowSuccess from "../../components/Results/ShowSuccess";
import ShowFailure from "../../components/Results/ShowFailure";

export default function ResultScreen({ route, navigation }) {

  useLayoutEffect(() => {
    handleOrientation("portrait");
  }, []);

  const scope = route?.params?.scope;
  const isPrivate = scope?.kind === 'private';
  const backgroundColor = isPrivate ? '#1D133D' : undefined;

  const { onTarget } = route?.params ?? {};

  const content = (() => {
    if (onTarget) {
      return <ShowSuccess navigation={navigation} route={route} />;
    }

    if (!onTarget) {
      return <ShowFailure navigation={navigation} route={route} />;
    }

    return null;
  })();

  if (backgroundColor) {
    return <View style={styles.wrapper}>{content}</View>;
  }

  return content;
};

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
});
