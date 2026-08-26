import { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import LogicalImagePicker from '../../components/Picture/LogicalImagePicker';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../../store/privateGroupTheme-context';

export default function HidingPathScreen({ navigation, route }) {
  const { t } = useTranslation();
  const isTutorial = route?.params?.isTutorial;
  const routeScope = route?.params?.scope;
  const { scope: activeScope } = useActiveGroup();
  const scope = routeScope ?? activeScope;
  const { group, theme, isPrivate } = useScopedPrivateGroupTheme(scope);
  const isLocked = isPrivate && group?.locked === true;

  useEffect(() => {
    if (!isLocked) return;
    Alert.alert(
      t('guess.path.lockTitle'),
      t('guess.path.lockMessage')
    );
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alert once per lock state, not per t identity
  }, [isLocked, navigation]);

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
