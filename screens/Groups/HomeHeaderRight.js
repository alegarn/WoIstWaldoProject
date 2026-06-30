import { useState } from 'react';
import { View, Modal, Pressable, Text, StyleSheet, Alert } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

import IconButton from '../../components/UI/IconButton';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { GlobalStyle } from '../../constants/theme';

export function HomeHeaderRight({ navigation, tintColor, onStartTutorial }) {
  const [menuOpen, setMenuOpen] = useState(false);
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

  const select = (action) => () => {
    setMenuOpen(false);
    action();
  };

  const items = [
    {
      key: 'groups',
      label: 'Groups',
      icon: 'people',
      testID: 'home.menu.groups',
      onPress: select(() => navigation.navigate('GroupsListScreen')),
    },
    {
      key: 'store',
      label: 'Store',
      icon: 'diamond-outline',
      testID: 'home.menu.store',
      onPress: select(() => navigation.navigate('PaywallScreen', { intent: 'store' })),
    },
    {
      key: 'scope-toggle',
      label: isPrivate ? 'Switch to public' : 'Switch to private',
      icon: isPrivate ? 'earth' : 'people-outline',
      testID: 'home.menu.scope-toggle',
      disabled: !canToggleScope,
      onPress: select(toggleScope),
    },
    {
      key: 'tutorial',
      label: 'Tutorial',
      icon: 'book',
      testID: 'home.menu.tutorial',
      onPress: select(() => onStartTutorial?.()),
    },
  ];

  return (
    <View style={{ flexDirection: 'row' }}>
      <IconButton
        accessibilityLabel="More options"
        icon="ellipsis-vertical"
        color={tintColor}
        size={24}
        onPress={() => setMenuOpen(true)}
        testID="home.header.other-options"
        style={{ marginRight: 20 }}
      />
      <Modal
        transparent
        animationType="fade"
        visible={menuOpen}
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            {items.map((item) => (
              <Pressable
                key={item.key}
                style={[styles.row, item.disabled && styles.rowDisabled]}
                onPress={item.onPress}
                disabled={item.disabled}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={item.disabled ? { disabled: true } : undefined}
                testID={item.testID}
              >
                <Ionicons name={item.icon} size={20} color={tintColor} />
                <Text style={styles.label}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    top: 60,
    right: 12,
    backgroundColor: GlobalStyle.color.primaryColor700,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 180,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  rowDisabled: {
    opacity: 0.35,
  },
  label: {
    color: 'white',
    marginLeft: 12,
    fontSize: 16,
  },
});
