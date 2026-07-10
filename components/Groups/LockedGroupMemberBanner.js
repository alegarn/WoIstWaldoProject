import { View, Text, StyleSheet } from 'react-native';

import { getPrivateGroupTheme } from '../../utils/privateGroupTheme';

export default function LockedGroupMemberBanner({
  groupName,
  primaryColor,
  secondaryColor,
  testID = 'private-home.locked-member-banner',
}) {
  const name = groupName && groupName.trim().length > 0 ? groupName : 'This group';
  const theme = getPrivateGroupTheme({ primaryColor, secondaryColor });

  return (
    <View
      style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.warning }]}
      testID={testID}
      accessibilityLabel="Locked group banner"
    >
      <Text style={[styles.title, { color: theme.warning }]}>{`${name} is temporarily locked`}</Text>
      <Text style={[styles.body, { color: theme.text }] }>
        {`The owner's Premium+ subscription ended. The group is read-only — you can still view existing images and rankings, but new games are paused until the owner renews.`}
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
