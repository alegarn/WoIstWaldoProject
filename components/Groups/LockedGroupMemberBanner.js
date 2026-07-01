import { View, Text, StyleSheet } from 'react-native';

import { GlobalStyle } from '../../constants/theme';

export default function LockedGroupMemberBanner({ groupName, testID = 'private-home.locked-member-banner' }) {
  const name = groupName && groupName.trim().length > 0 ? groupName : 'This group';

  return (
    <View style={styles.container} testID={testID} accessibilityLabel="Locked group banner">
      <Text style={styles.title}>{`${name} is temporarily locked`}</Text>
      <Text style={styles.body}>
        {`The owner's Premium+ subscription ended. The group is read-only — you can still view existing images and rankings, but new games are paused until the owner renews.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: GlobalStyle.color.primaryColor800,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: GlobalStyle.color.warning,
  },
  title: {
    color: '#ffd700',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  body: {
    color: '#fff',
    fontSize: 12,
  },
});
