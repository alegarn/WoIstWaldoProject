import { useEffect } from 'react';
import { View } from 'react-native';
import LogicalImagePicker from '../../components/Picture/LogicalImagePicker';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../../store/privateGroupTheme-context';

export default function HidingPathScreen({ navigation, route }) {
  const isTutorial = route?.params?.isTutorial;
  const routeScope = route?.params?.scope;
  const { scope: activeScope } = useActiveGroup();
  const scope = routeScope ?? activeScope;
  const { group, theme } = useScopedPrivateGroupTheme(routeScope);

  useEffect(() => {
    if (!theme) return;
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.primaryColor },
      headerTintColor: theme.headerTintColor,
    });
  }, [navigation, theme?.primaryColor, theme?.headerTintColor]);

  return (
    <PrivateGroupThemeProvider group={group}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <LogicalImagePicker navigation={navigation} isTutorial={isTutorial} scope={scope} />
      </View>
    </PrivateGroupThemeProvider>
  );
};
