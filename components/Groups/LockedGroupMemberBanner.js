import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getPrivateGroupTheme } from '../../utils/privateGroupTheme';

export default function LockedGroupMemberBanner({
  groupName,
  primaryColor,
  secondaryColor,
  testID = 'private-home.locked-member-banner',
}) {
  const { t } = useTranslation();
  const name = groupName && groupName.trim().length > 0 ? groupName : t('groups.locked.thisGroupCapital');
  const theme = getPrivateGroupTheme({ primaryColor, secondaryColor });

  return (
    <View
      style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.warning }]}
      testID={testID}
      accessibilityLabel={t('groups.locked.bannerLabel')}
    >
      <Text style={[styles.title, { color: theme.warning }]}>{t('groups.locked.memberTitle', { name })}</Text>
      <Text style={[styles.body, { color: theme.text }] }>
        {t('groups.locked.memberBody')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  title: {
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  body: {
    fontSize: 12,
  },
});
