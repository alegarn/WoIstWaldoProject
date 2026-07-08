import { View, Text, StyleSheet } from 'react-native';

import { settingsTokens as t } from './settingsTokens';

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
}) {
  const showHeader = title || caption || typeof count === 'number' || headerRight;
  return (
    <View style={styles.section} testID={testID}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headingText}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {caption ? <Text style={styles.caption}>{caption}</Text> : null}
          </View>
          {headerRight}
          {typeof count === 'number' && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{count}</Text>
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
    backgroundColor: t.panel,
    padding: 12,
    borderRadius: t.radiusPanel,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  headingText: { flex: 1, marginRight: 12 },
  title: { color: t.text, fontSize: 18, fontWeight: '700' },
  caption: { color: t.muted, fontSize: 13, marginTop: 2 },
  countBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: t.radiusPill,
    backgroundColor: t.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  countBadgeText: { color: t.text, fontSize: 13, fontWeight: '700' },
});
