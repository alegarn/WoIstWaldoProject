import { useCallback, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import BigButton from '../../components/UI/BigButton';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import { GlobalStyle } from '../../constants/theme';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { AuthContext } from '../../store/auth-context';

export default function GroupsListScreen({ navigation }) {
  const authContext = useContext(AuthContext);
  const { data, isLoading, error, refresh } = useGroupsHub();
  const { setActive } = useActiveGroup();

  const owned = data?.owned ?? [];

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const groups = [
    ...(data?.owned ?? []),
    ...(data?.joined ?? []),
  ];

  const openGroup = async (group) => {
    try {
      const response = await setActive(group.id);
      if (response?.status === 200 || response?.status === 204) {
        navigation.navigate('PrivateHomeScreen', {
          scope: { kind: 'private', groupId: group.id },
        });
      }
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not open the group.');
    }
  };

  if (isLoading && !data) {
    return <LoadingOverlay message="Loading groups..." />;
  }

  if (error && !data) {
    return (
      <View style={styles.container} testID="groups-list.container">
        <Text style={styles.errorText}>Couldn't load groups.</Text>
        <BigButton
          text="Retry"
          onPress={() => refresh()}
          testID="groups-list.button.retry"
        />
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={styles.container} testID="groups-list.container">
        <Text style={styles.emptyText} testID="groups-list.empty">
          You're not in any private group yet.
        </Text>
        <BigButton
          text="Join another group"
          onPress={() => navigation.navigate('JoinByCodeScreen')}
          testID="groups-list.button.join"
        />
        <BigButton
          text="Create group"
          onPress={() => navigation.navigate('CreateGroupScreen')}
          testID="groups-list.button.create"
        />
        <BigButton
          text="Store"
          onPress={() => navigation.navigate('PaywallScreen', { intent: 'store' })}
          testID="groups-list.button.store"
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="groups-list.container">
      <FlatList
        data={groups}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View
            style={[styles.row, { backgroundColor: item.primary_color || GlobalStyle.color.primaryColor500 }]}
            testID="groups-list.item.group"
          >
            <Text style={styles.rowTitle}>{item.name}</Text>
            {item.role === 'owner' && <Text style={styles.rowRole}>Owner</Text>}
            <BigButton
              text="Open"
              onPress={() => openGroup(item)}
              testID={`groups-list.button.open-${item.id}`}
            />
          </View>
        )}
      />
      <BigButton
        text="Join another group"
        onPress={() => navigation.navigate('JoinByCodeScreen')}
        testID="groups-list.button.join"
      />
      <BigButton
        text="Create group"
        onPress={() => navigation.navigate('CreateGroupScreen')}
        testID="groups-list.button.create"
      />
      <BigButton
        text="Store"
        onPress={() => navigation.navigate('PaywallScreen', { intent: 'store' })}
        testID="groups-list.button.store"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GlobalStyle.color.primaryColor900, padding: 12, gap: 10 },
  emptyText: { color: '#fff', fontSize: 18, textAlign: 'center', marginVertical: 20 },
  errorText: { color: '#fff', fontSize: 18, textAlign: 'center', marginVertical: 20 },
  row: { padding: 12, marginVertical: 6, borderRadius: 8 },
  rowTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  rowRole: { color: '#ffd700', fontSize: 12 },
});
