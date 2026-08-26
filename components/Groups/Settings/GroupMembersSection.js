import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';

import SettingsSection from './SettingsSection';
import { getSettingsTokens } from './settingsTokens';

/**
 * Members entry — navigates to MemberManagementScreen.
 *
 * Single Responsibility: the membership navigation affordance. Rendered as a
 * settings list row (icon + label + caption + chevron) instead of a oversized
 * block button, so it reads as one item among peers.
 */
export default function GroupMembersSection({
  onManageMembers,
  appearance = 'dark',
  primaryColor,
  secondaryColor,
}) {
  const { t } = useTranslation();
  const tokens = getSettingsTokens({ appearance, primaryColor, secondaryColor });

  return (
    <SettingsSection
      testID="group-settings.section.members"
      appearance={appearance}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('groups.settings.manageMembers')}
        onPress={onManageMembers}
        testID="group-settings.button.members"
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: tokens.inset, borderColor: tokens.hairline },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.iconWell, { backgroundColor: tokens.accent }]}>
          <Ionicons name="people-outline" size={20} color={tokens.text} />
        </View>
        <View style={styles.labelCol}>
          <Text style={[styles.rowTitle, { color: tokens.text }]}>{t('groups.settings.manageMembers')}</Text>
          <Text style={[styles.rowCaption, { color: tokens.muted }]}>{t('groups.settings.manageMembersCaption')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={tokens.muted} />
      </Pressable>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 10, padding: 10,
    borderWidth: 1,
  },
  iconWell: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  labelCol: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowCaption: { fontSize: 13, marginTop: 2 },
});
