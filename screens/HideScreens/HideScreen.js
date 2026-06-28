import { Dimensions, View, StyleSheet } from 'react-native';
import HidePicture from '../../components/Picture/HidePicture';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { GlobalStyle } from '../../constants/theme';

export default function HideScreen({ navigation, route }) {
  const uri = route.params?.uri;
  let screenDimensions = {};

  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  const isPortrait = route.params?.isPortrait;
  isPortrait ? (screenDimensions = { width: screenWidth, height: screenHeight }) : (screenDimensions = { width: screenHeight, height: screenWidth }) ;

  const isTutorial = route.params?.isTutorial;
  const routeScope = route.params?.scope;
  const { scope: activeScope } = useActiveGroup();
  const scope = routeScope ?? activeScope;
  const { data } = useGroupsHub();
  const group = scope?.kind === 'private'
    ? [...(data?.owned ?? []), ...(data?.joined ?? [])].find((g) => g.id === scope.groupId)
    : null;
  const backgroundColor = group?.primary_color ?? GlobalStyle.color.primaryColor900;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <HidePicture
        navigation={navigation}
        uri={uri}
        imageWidth={route.params?.imageWidth}
        imageHeight={route.params?.imageHeight}
        screenDimensions={screenDimensions}
        imageIsPortrait={isPortrait}
        isTutorial={isTutorial}
        scope={scope}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});
