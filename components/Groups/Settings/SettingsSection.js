import { View, Text, StyleSheet } from 'react-native';

import { getSettingsTokens, settingsTokens } from './settingsTokens';

/**
 * Presentational shell shared by every GroupSettings section.
 *
 * Single Responsibility: layout — a panel with an optional title, caption, and
 * count badge, plus children. Knows nothing about groups, categories, or
 * uploads; sections compose it and hand it content.
 */
export default function SettingsSection({
  title,
  caption,
  count,
  testID,
  headerRight,
  children,
  appearance = 'dark',
  primaryColor,
  secondaryColor,
}) {
  const t = getSettingsTokens({ appearance, primaryColor, secondaryColor });
  const showHeader = title || caption || typeof count === 'number' || headerRight;
  return (
    <View style={[styles.section, { backgroundColor: t.panel }]} testID={testID}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headingText}>
            {title ? <Text style={[styles.title, { color: t.text }]}>{title}</Text> : null}
            {caption ? <Text style={[styles.caption, { color: t.muted }]}>{caption}</Text> : null}
          </View>
          {headerRight}
          {typeof count === 'number' && (
            <View style={[styles.countBadge, { backgroundColor: t.accent }]}>
              <Text style={[styles.countBadgeText, { color: t.accentText }]}>{count}</Text>
            </View>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: 12,
    borderRadius: settingsTokens.radiusPanel,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  headingText: { flex: 1, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  caption: { fontSize: 13, marginTop: 2 },
  countBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: settingsTokens.radiusPill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  countBadgeText: { fontSize: 13, fontWeight: '700' },
});
