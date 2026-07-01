import { useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import CenteredModal from '../../components/UI/CenteredModal';
import ColorPalettePicker from '../../components/UI/ColorPalettePicker';
import HomeCard from '../../components/UI/HomeCard';
import IconButton from '../../components/UI/IconButton';
import LockedGroupOwnerModal from '../../components/Groups/LockedGroupOwnerModal';
import LockedGroupMemberBanner from '../../components/Groups/LockedGroupMemberBanner';
import { GlobalStyle } from '../../constants/theme';
import { handleOrientation } from '../../utils/orientation';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { AuthContext } from '../../store/auth-context';
import { updateGroupSettings } from '../../services/groups/groupApi';

const HideImage = require('../../assets/home/WoIstWaldo-character-hide.webp');
const FindImage = require('../../assets/home/WoIstWaldo-character-guess-4-3.webp');
const RankingImage = require('../../assets/home/WoIstWaldo-character-stats.webp');

export default function PrivateHomeScreen({ navigation, route }) {
  const routeScope = route?.params?.scope;
  const { scope, clear } = useActiveGroup();
  const authContext = useContext(AuthContext);
  const { setPrivateMode } = authContext;
  const activeScope = routeScope ?? scope;
  const { data, refresh } = useGroupsHub();
  const group = activeScope?.kind === 'private'
    ? [...(data?.owned ?? []), ...(data?.joined ?? [])].find((g) => g.id === activeScope.groupId)
    : null;
  const isLocked = group?.locked === true;
  const isOwner = group?.role === 'owner';
  const groupId = activeScope?.kind === 'private' ? activeScope.groupId : null;

  const [isColorEditorVisible, setIsColorEditorVisible] = useState(false);
  const [editorPrimary, setEditorPrimary] = useState(group?.primary_color ?? GlobalStyle.color.primaryColor);
  const [editorSecondary, setEditorSecondary] = useState(group?.secondary_color ?? GlobalStyle.color.secondaryColor);
  const [isSavingColors, setIsSavingColors] = useState(false);
  const [isLockedOwnerModalVisible, setIsLockedOwnerModalVisible] = useState(isLocked && isOwner);

  useEffect(() => {
    setIsLockedOwnerModalVisible(isLocked && isOwner);
  }, [isLocked, isOwner, groupId]);

  useEffect(() => {
    setEditorPrimary(group?.primary_color ?? GlobalStyle.color.primaryColor);
    setEditorSecondary(group?.secondary_color ?? GlobalStyle.color.secondaryColor);
  }, [group?.primary_color, group?.secondary_color]);

  const shareCode = useCallback(async () => {
    const code = group?.joining_code;
    if (!code) {
      Alert.alert('No invite code available.');
      return;
    }
    const message = `Join my private Waldo group! Code: ${code}`;
    try {
      await Share.share({ message });
    } catch (_) {
      Alert.alert('Invite code', message);
    }
  }, [group?.joining_code]);

  const openColorEditor = useCallback(() => {
    setIsColorEditorVisible(true);
  }, []);

  const closeColorEditor = useCallback(() => {
    setIsColorEditorVisible(false);
  }, []);

  const saveColors = useCallback(async () => {
    if (!groupId) return;
    setIsSavingColors(true);
    try {
      const response = await updateGroupSettings(authContext, groupId, {
        primaryColor: editorPrimary,
        secondaryColor: editorSecondary,
      });
      if (response?.status === 200 || response?.status === 204) {
        Alert.alert('Saved', 'Group colors updated.');
        setIsColorEditorVisible(false);
        await refresh();
      } else {
        Alert.alert(`Error ${response?.status ?? ''}`, 'Could not save colors.');
      }
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not save colors.');
    } finally {
      setIsSavingColors(false);
    }
  }, [authContext, groupId, editorPrimary, editorSecondary, refresh]);

  useEffect(() => {
    navigation.setOptions({
      title: group?.name ?? '',
      headerStyle: { backgroundColor: group?.primary_color || GlobalStyle.color.primaryColor900 },
      headerTintColor: '#fff',
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <IconButton
            icon="home-outline"
            color="#fff"
            size={26}
            onPress={() => {
              clear();
              navigation.navigate('HomeScreen');
            }}
            testID="private-home.button.switch-to-public"
            accessibilityLabel="Switch to public"
            style={{ marginRight: 12 }}
          />
          {isOwner && (
            <IconButton
              icon="color-palette-outline"
              color="#fff"
              size={26}
              onPress={openColorEditor}
              testID="private-home.button.customize-colors"
              accessibilityLabel="Customize group colors"
              style={{ marginRight: 12 }}
            />
          )}
          {isOwner && (
            <IconButton
              icon="person-add-outline"
              color="#fff"
              size={26}
              onPress={shareCode}
              testID="private-home.button.share-code"
              accessibilityLabel="Share invite code"
              style={{ marginRight: 12 }}
            />
          )}
          {isOwner && (
            <IconButton
              icon="settings-outline"
              color="#fff"
              size={26}
              onPress={() => navigation.navigate('GroupSettingsScreen')}
              testID="private-home.button.settings"
              accessibilityLabel="Group settings"
            />
          )}
        </View>
      ),
    });
  }, [navigation, group?.name, group?.primary_color, group?.joining_code, isOwner, clear, shareCode, openColorEditor]);

  useFocusEffect(
    useCallback(() => {
      handleOrientation('portrait');
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useFocusEffect(
    useCallback(() => {
      setPrivateMode?.(true);
    }, [setPrivateMode])
  );

  const goScoped = (target) =>
    navigation.navigate(target, {
      scope: { kind: 'private', groupId },
    });

  const renewSubscription = useCallback(() => {
    navigation.navigate('PaywallScreen', { intent: 'store' });
  }, [navigation]);

  const transferOwnership = useCallback(() => {
    navigation.navigate('MemberManagementScreen');
  }, [navigation]);

  const dismissLockedOwnerModal = useCallback(() => {
    setIsLockedOwnerModalVisible(false);
  }, []);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: group?.primary_color || GlobalStyle.color.primaryColor900 },
      ]}
    >
      <Text
        style={styles.title}
        testID="private-home.title"
      >
        {group?.name ?? ''}
      </Text>
      {isLocked && (
        <Text testID="private-home.lock-badge" style={styles.lockBadge}>
          Locked by owner
        </Text>
      )}
      {isLocked && !isOwner && (
        <LockedGroupMemberBanner groupName={group?.name} />
      )}
      <HomeCard
        text="Hide Waldo"
        onPress={() => goScoped('HidingPathScreen')}
        backgroundImage={HideImage}
        heightPercent={40}
        testID="private-home.button.hide"
      />
      <HomeCard
        text="Find Waldo"
        onPress={isLocked ? undefined : () => goScoped('GuessPathScreen')}
        backgroundImage={FindImage}
        heightPercent={40}
        testID="private-home.button.find"
        accessibilityState={isLocked ? { disabled: true } : undefined}
        pointerEvents={isLocked ? 'none' : 'auto'}
      />
      <HomeCard
        text="Ranking"
        onPress={() => goScoped('RankingScreen')}
        backgroundImage={RankingImage}
        heightPercent={20}
        testID="private-home.button.ranking"
      />

      <CenteredModal
        isModalVisible={isColorEditorVisible}
        onPress={saveColors}
        onCancel={closeColorEditor}
        testIDPrefix="private-home.color-editor"
        confirmTestID="private-home.color-editor.confirm.ok"
        cancelTestID="private-home.color-editor.confirm.cancel"
        confirmLabel={isSavingColors ? 'Saving...' : 'Save'}
        cancelLabel="Cancel"
      >
        <View>
          <ColorPalettePicker
            label="Primary color"
            value={editorPrimary}
            onValueChange={setEditorPrimary}
            testIDPrefix="private-home.color-primary"
          />
          <ColorPalettePicker
            label="Secondary color"
            value={editorSecondary}
            onValueChange={setEditorSecondary}
            testIDPrefix="private-home.color-secondary"
          />
        </View>
      </CenteredModal>

      <LockedGroupOwnerModal
        visible={isLockedOwnerModalVisible}
        groupName={group?.name}
        onRenew={renewSubscription}
        onTransfer={transferOwnership}
        onDismiss={dismissLockedOwnerModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#fff' },
  lockBadge: { fontSize: 14, color: '#ffd700', textAlign: 'center' },
});
