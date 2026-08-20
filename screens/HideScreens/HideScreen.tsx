import { useEffect } from 'react';
import { useWindowDimensions, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { FC } from 'react';

import HidePictureDefault from '../../components/Picture/HidePicture';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { GlobalStyle } from '../../constants/theme';
import {
  PrivateGroupThemeProvider,
  useScopedPrivateGroupTheme,
} from '../../store/privateGroupTheme-context';
import type { AdScope } from '../../utils/adCadence';

type HideRouteParams = {
  uri?: string;
  imageWidth?: number;
  imageHeight?: number;
  isPortrait?: boolean;
  isTutorial?: boolean;
  scope?: AdScope;
};

type HideNavigation = {
  setOptions(options: {
    headerStyle?: { backgroundColor?: string };
    headerTintColor?: string;
  }): void;
  navigate(name: string, params?: Record<string, unknown>): void;
};

type HideScreenProps = {
  navigation: HideNavigation;
  route: { params?: HideRouteParams };
};

type ScopedTheme = ReturnType<typeof useScopedPrivateGroupTheme>;

type HidePictureComponent = FC<{
  navigation?: HideNavigation;
  uri?: string;
  imageWidth?: number;
  imageHeight?: number;
  screenDimensions?: { width?: number; height?: number };
  imageIsPortrait?: boolean;
  isTutorial?: boolean;
  scope?: AdScope;
}>;

// HidePicture.js is an unmigrated dep whose inferred prop types are narrower
// than the runtime contract this screen honors. Cast to a local structural type
// mirroring the props actually passed — behavior preserved.
const HidePicture = HidePictureDefault as unknown as HidePictureComponent;

const FALLBACK_BACKGROUND_COLOR = GlobalStyle.color.primaryColor900;

export default function HideScreen({ navigation, route }: HideScreenProps) {
  const {
    uri,
    imageWidth,
    imageHeight,
    isPortrait,
    isTutorial,
    scope: routeScope,
  } = route.params ?? {};

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const screenDimensions = { width: screenWidth, height: screenHeight };

  const { scope: activeScope } = useActiveGroup();
  // useActiveGroup lives in an unmigrated .js module whose inferred scope
  // literal widens `kind` to string. Cast preserves runtime shape against
  // the AdScope contract — behavior unchanged.
  const scope = (routeScope ?? activeScope) as AdScope | undefined;
  const { group, theme }: ScopedTheme = useScopedPrivateGroupTheme(routeScope);
  const backgroundColor = group?.primary_color ?? FALLBACK_BACKGROUND_COLOR;

  useEffect(() => {
    if (!theme) return;
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.primaryColor },
      headerTintColor: theme.headerTintColor,
    });
  }, [navigation, theme?.primaryColor, theme?.headerTintColor]);

  return (
    <PrivateGroupThemeProvider group={group}>
      {/* RNGH root scoped to this screen subtree (same convention as
          GuessScreen): hosts ShowPicture's nested GestureDetectors without
          wrapping the app/navigators, which broke HomeScreen header touches. */}
      <GestureHandlerRootView style={[styles.container, { backgroundColor }]}>
        <HidePicture
          navigation={navigation}
          uri={uri}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          screenDimensions={screenDimensions}
          imageIsPortrait={isPortrait}
          isTutorial={isTutorial}
          scope={scope}
        />
      </GestureHandlerRootView>
    </PrivateGroupThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
