import { useLayoutEffect } from "react";
import { View, StyleSheet } from "react-native";

import { handleOrientation } from "../../utils/orientation";
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from "../../store/privateGroupTheme-context";

import ShowSuccess from "../../components/Results/ShowSuccess";
import ShowFailure from "../../components/Results/ShowFailure";

export default function ResultScreen({ route, navigation }) {

  useLayoutEffect(() => {
    handleOrientation("portrait");
  }, []);

  const scope = route?.params?.scope;
  const isPrivate = scope?.kind === 'private';
  const { group, theme } = useScopedPrivateGroupTheme(scope);

  useLayoutEffect(() => {
    if (!theme) return;
    navigation.setOptions({
      title: group?.name,
      headerStyle: { backgroundColor: theme.primaryColor },
      headerTintColor: theme.headerTintColor,
    });
  }, [navigation, group?.name, theme?.primaryColor, theme?.headerTintColor]);

  const backgroundColor = isPrivate
    ? (group?.primary_color ?? '#1D133D')
    : undefined;

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

  return (
    <PrivateGroupThemeProvider group={group}>
      {backgroundColor ? (
        <View style={[styles.wrapper, { backgroundColor }]}>{content}</View>
      ) : content}
    </PrivateGroupThemeProvider>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
});
