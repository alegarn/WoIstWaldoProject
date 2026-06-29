import { View, Alert } from 'react-native';

import IconButton from '../../components/UI/IconButton';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';

export function HomeHeaderRight({ navigation, tintColor }) {
  const { scope, activeGroupId, setActive, clear } = useActiveGroup();
  const { data } = useGroupsHub();
  const owned = data?.owned ?? [];
  const joined = data?.joined ?? [];
  const isPrivate = scope.kind === 'private';
  const hasAnyMembership = owned.length > 0 || joined.length > 0;
  const hasActiveGroup = !!activeGroupId;
  const canToggleScope = isPrivate ? hasAnyMembership : hasAnyMembership && hasActiveGroup;

  const toggleScope = () => {
    if (isPrivate) {
      clear();
      navigation.navigate('HomeScreen');
      return;
    }

    if (!activeGroupId) {
      return;
    }

    setActive(activeGroupId).then((response) => {
      if (response?.status === 200 || response?.status === 204) {
        navigation.navigate('PrivateHomeScreen', {
          scope: { kind: 'private', groupId: activeGroupId },
        });
      }
    }).catch((err) => {
      Alert.alert('Error', err?.message ?? 'Could not switch scope.');
    });
  };

  return (
    <View style={{ flexDirection: 'row' }}>
      <IconButton
        accessibilityLabel="Toggle public/private scope"
        icon={isPrivate ? 'earth' : 'people'}
        color={tintColor}
        size={24}
        disabled={!canToggleScope}
        onPress={toggleScope}
        testID="home.header.scope-toggle"
        style={{ marginRight: 20 }}
      />
      <IconButton
        accessibilityLabel="Open private groups list"
        icon="star"
        color={tintColor}
        size={24}
        onPress={() => navigation.navigate('GroupsListScreen')}
        testID="home.header.groups-star"
        style={{ marginRight: 20 }}
      />
      <IconButton
        accessibilityLabel="Open store"
        icon="diamond-outline"
        color={tintColor}
        size={24}
        style={{ marginRight: 20 }}
        onPress={() => navigation.navigate('PaywallScreen', { intent: 'store' })}
        testID="home.header.store"
      />
    </View>
  );
}
