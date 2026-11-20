import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';

import _SettingsSection from './SettingsSection';
import MemberCapBanner from './MemberCapBanner';
import { getSettingsTokens as _getSettingsTokens } from './settingsTokens';

// SettingsSection.js is unmigrated; its destructured props (title / caption /
// count / headerRight) are inferred as required by TS. settingsTokens.js
// infers `options = 'dark'` as a string parameter. Permissive casts mirror
// the App.tsx convention.
const SettingsSection = _SettingsSection as React.ComponentType<any>;
const getSettingsTokens = _getSettingsTokens as (options?: unknown) => any;

type GroupMembersSectionProps = {
  onManageMembers?: () => void;
  memberCount?: number | null;
  memberCap?: number | null;
  canPersonalize?: boolean;
  onUpgrade?: () => void;
  appearance?: 'dark' | 'light';
  primaryColor?: string;
  secondaryColor?: string;
};

/**
 * Members entry — navigates to MemberManagementScreen.
 *
 * Single Responsibility: the membership navigation affordance. Rendered as a
 * settings list row (icon + label + caption + chevron) instead of a oversized
 * block button, so it reads as one item among peers.
 */
export default function GroupMembersSection({
  onManageMembers,
  memberCount,
  memberCap,
  canPersonalize = true,
  onUpgrade,
  appearance = 'dark',
  primaryColor,
  secondaryColor,
}: GroupMembersSectionProps) {
  const { t } = useTranslation();
  const tokens = getSettingsTokens({ appearance, primaryColor, secondaryColor });

  return (
    <SettingsSection
      testID="group-settings.section.members"
      appearance={appearance}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
    >
      <MemberCapBanner
        memberCount={memberCount}
        memberCap={memberCap}
        canPersonalize={canPersonalize}
        onUpgrade={onUpgrade}
        textColor={tokens.text}
        mutedColor={tokens.muted}
        accentColor={tokens.accentSoft}
      />
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
