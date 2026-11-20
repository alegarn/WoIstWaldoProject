import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';

type MemberCapBannerProps = {
  memberCount?: number | null;
  memberCap?: number | null;
  canPersonalize?: boolean;
  onUpgrade?: () => void;
  testIDPrefix?: string;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
};

/**
 * Member cap banner — "{{current}}/{{cap}} members" with an upgrade CTA when a
 * free owner is at their cap.
 *
 * Single Responsibility: render the cap state. Policy (cap value, at-cap
 * predicate) is resolved by the caller from services/billing/groupPersonalization.
 */
export default function MemberCapBanner({
  memberCount,
  memberCap,
  canPersonalize = true,
  onUpgrade,
  testIDPrefix = 'group-settings.members',
  textColor,
  mutedColor,
  accentColor,
}: MemberCapBannerProps) {
  const { t } = useTranslation();
  if (memberCount == null || memberCap == null) {
    return null;
  }

  const isAtCap = memberCount >= memberCap;
  const showUpgrade = isAtCap && !canPersonalize;

  return (
    <View style={styles.row} testID={`${testIDPrefix}.cap-banner`}>
      <Ionicons
        name="people-outline"
        size={14}
        color={showUpgrade ? (accentColor ?? mutedColor) : (mutedColor ?? textColor)}
      />
      <Text style={[styles.count, { color: textColor }]} testID={`${testIDPrefix}.cap-count`}>
        {t('groups.members.memberCap', { current: memberCount, cap: memberCap })}
      </Text>
      {showUpgrade && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('groups.members.upgradeFor30')}
          onPress={onUpgrade}
          testID={`${testIDPrefix}.upgrade`}
          style={({ pressed }) => [styles.upgradeChip, { borderColor: accentColor ?? textColor }, pressed && styles.pressed]}
        >
          <Text style={[styles.upgradeText, { color: accentColor ?? textColor }]}>
            {t('groups.members.upgradeFor30')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8,
  },
  count: { fontSize: 13, fontWeight: '600' },
  upgradeChip: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    marginLeft: 'auto',
  },
  upgradeText: { fontSize: 12, fontWeight: '700' },
});
