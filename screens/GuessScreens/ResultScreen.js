import { useLayoutEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";

import { handleOrientation } from "../../utils/orientation";
import { useGroupsHub } from "../../hooks/useGroupsHub";

import ShowSuccess from "../../components/Results/ShowSuccess";
import ShowFailure from "../../components/Results/ShowFailure";

export default function ResultScreen({ route, navigation }) {

  useLayoutEffect(() => {
    handleOrientation("portrait");
  }, []);

  const scope = route?.params?.scope;
  const isPrivate = scope?.kind === 'private';
  const { data } = useGroupsHub();

  const group = useMemo(() => {
    if (!isPrivate) {
      return null;
    }
    const groups = [...(data?.owned ?? []), ...(data?.joined ?? [])];
    return groups.find((g) => g.id === scope.groupId) ?? null;
  }, [data, isPrivate, scope]);

  useLayoutEffect(() => {
    if (isPrivate && group?.name) {
      navigation.setOptions({ title: group.name });
    }
  }, [isPrivate, group, navigation]);

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

  if (backgroundColor) {
    return <View style={[styles.wrapper, { backgroundColor }]}>{content}</View>;
  }

  return content;
};

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
});
