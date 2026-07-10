import { useEffect } from 'react';
import { Dimensions, View, StyleSheet } from 'react-native';
import HidePicture from '../../components/Picture/HidePicture';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { GlobalStyle } from '../../constants/theme';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../../store/privateGroupTheme-context';

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
  const { group, theme } = useScopedPrivateGroupTheme(routeScope);
  const backgroundColor = group?.primary_color ?? GlobalStyle.color.primaryColor900;

  useEffect(() => {
    if (!theme) return;
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.primaryColor },
      headerTintColor: theme.headerTintColor,
    });
  }, [navigation, theme?.primaryColor, theme?.headerTintColor]);

  return (
    <PrivateGroupThemeProvider group={group}>
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
    </PrivateGroupThemeProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});
