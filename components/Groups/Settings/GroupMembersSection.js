import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';

import SettingsSection from './SettingsSection';
import { settingsTokens as t } from './settingsTokens';

/**
 * Members entry — navigates to MemberManagementScreen.
 *
 * Single Responsibility: the membership navigation affordance. Rendered as a
 * settings list row (icon + label + caption + chevron) instead of a oversized
 * block button, so it reads as one item among peers.
 */
export default function GroupMembersSection({ onManageMembers }) {
  return (
    <SettingsSection testID="group-settings.section.members">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Manage members"
        onPress={onManageMembers}
        testID="group-settings.button.members"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.iconWell}>
          <Ionicons name="people-outline" size={20} color={t.text} />
        </View>
        <View style={styles.labelCol}>
          <Text style={styles.rowTitle}>Manage members</Text>
          <Text style={styles.rowCaption}>Add or remove members, transfer ownership.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={t.muted} />
      </Pressable>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: t.inset, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: t.hairline,
  },
  iconWell: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center',
  },
  labelCol: { flex: 1 },
  rowTitle: { color: t.text, fontSize: 16, fontWeight: '600' },
  rowCaption: { color: t.muted, fontSize: 13, marginTop: 2 },
});
