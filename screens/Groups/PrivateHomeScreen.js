import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Share, Alert, ScrollView, Image, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@react-native-vector-icons/ionicons';

import CenteredModal from '../../components/UI/CenteredModal';
import HomeCard from '../../components/UI/HomeCard';
import IconButton from '../../components/UI/IconButton';
import GroupIdentitySection from '../../components/Groups/Settings/GroupIdentitySection';
import LockedGroupOwnerModal from '../../components/Groups/LockedGroupOwnerModal';
import LockedGroupMemberBanner from '../../components/Groups/LockedGroupMemberBanner';
import { GlobalStyle } from '../../constants/theme';
import { handleOrientation } from '../../utils/orientation';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { AuthContext } from '../../store/auth-context';
import { updateGroupSettings, deletePrivateImage } from '../../services/groups/groupApi';
import { resolveHomeBackground, deleteHomeBackgroundFile } from '../../services/groups/groupHomeBackgrounds';
import { uploadHomeBackground } from '../../services/groups/homeBackgroundUpload';

const HideImage = require('../../assets/home/WoIstWaldo-character-hide.webp');
const FindImage = require('../../assets/home/WoIstWaldo-character-guess-4-3.webp');
const RankingImage = require('../../assets/home/WoIstWaldo-character-stats.webp');

const BACKGROUND_SLOTS = [
  { slot: 'hide', label: 'Hide Waldo' },
  { slot: 'find', label: 'Find Waldo' },
  { slot: 'ranking', label: 'Ranking' },
];

const SLOT_SETTINGS_KEY = {
  hide: 'hideBgImageId',
  find: 'findBgImageId',
  ranking: 'rankingBgImageId',
};

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
  const [isLockedOwnerModalVisible, setIsLockedOwnerModalVisible] = useState(isLocked && isOwner);
  const [bgUris, setBgUris] = useState({});
  const [savingSlot, setSavingSlot] = useState({});
  const savingSlotRef = useRef({});

  const setSaving = useCallback((slot, value) => {
    savingSlotRef.current = { ...savingSlotRef.current, [slot]: value };
    setSavingSlot((prev) => ({ ...prev, [slot]: value }));
  }, []);

  useEffect(() => {
    setIsLockedOwnerModalVisible(isLocked && isOwner);
  }, [isLocked, isOwner, groupId]);

  useEffect(() => {
    let mounted = true;
    if (!groupId) {
      setBgUris({});
      return;
    }
    const snapshots = {
      hide: group?.home_button_backgrounds?.hide,
      find: group?.home_button_backgrounds?.find,
      ranking: group?.home_button_backgrounds?.ranking,
    };
    setBgUris({});
    BACKGROUND_SLOTS.forEach(async ({ slot }) => {
      const slotData = snapshots[slot];
      if (!slotData?.image_id) return;
      const imageIdAtCall = slotData.image_id;
      const uri = await resolveHomeBackground({
        context: authContext,
        groupId,
        slot,
        imageId: imageIdAtCall,
        fileExtension: slotData.file_extension,
        url: slotData.url,
      });
      if (!mounted) return;
      setBgUris((prev) => (uri ? { ...prev, [slot]: uri } : prev));
    });
    return () => { mounted = false; };
  }, [
    group?.home_button_backgrounds?.hide?.image_id,
    group?.home_button_backgrounds?.find?.image_id,
    group?.home_button_backgrounds?.ranking?.image_id,
    groupId,
  ]);

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

  const chooseSlotBackground = useCallback(async (slot) => {
    if (!groupId) return;
    if (savingSlotRef.current[slot]) return;
    const settingsKey = SLOT_SETTINGS_KEY[slot];
    const prevImageId = group?.home_button_backgrounds?.[slot]?.image_id;
    setSaving(slot, true);
    try {
      const { imageId } = await uploadHomeBackground({ context: authContext, groupId });
      if (!imageId) return;
      const response = await updateGroupSettings(authContext, groupId, { [settingsKey]: imageId });
      if (response?.status !== 200 && response?.status !== 204) {
        throw new Error(`PATCH failed with status ${response?.status}`);
      }
      if (prevImageId) {
        await deletePrivateImage(authContext, groupId, prevImageId);
        deleteHomeBackgroundFile(groupId, slot, prevImageId);
      }
      await refresh();
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not update background.');
    } finally {
      setSaving(slot, false);
    }
  }, [authContext, groupId, group, refresh, setSaving]);

  const removeSlotBackground = useCallback(async (slot) => {
    if (!groupId) return;
    if (savingSlotRef.current[slot]) return;
    const settingsKey = SLOT_SETTINGS_KEY[slot];
    const prevImageId = group?.home_button_backgrounds?.[slot]?.image_id;
    if (!prevImageId) return;
    setSaving(slot, true);
    try {
      const response = await updateGroupSettings(authContext, groupId, { [settingsKey]: null });
      if (response?.status !== 200 && response?.status !== 204) {
        throw new Error(`PATCH failed with status ${response?.status}`);
      }
      await deletePrivateImage(authContext, groupId, prevImageId);
      deleteHomeBackgroundFile(groupId, slot, prevImageId);
      await refresh();
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not remove background.');
    } finally {
      setSaving(slot, false);
    }
  }, [authContext, groupId, group, refresh, setSaving]);

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
        backgroundImage={bgUris.hide ? { uri: bgUris.hide } : HideImage}
        heightPercent={40}
        testID="private-home.button.hide"
      />
      <HomeCard
        text="Find Waldo"
        onPress={isLocked ? undefined : () => goScoped('GuessPathScreen')}
        backgroundImage={bgUris.find ? { uri: bgUris.find } : FindImage}
        heightPercent={40}
        testID="private-home.button.find"
        accessibilityState={isLocked ? { disabled: true } : undefined}
        pointerEvents={isLocked ? 'none' : 'auto'}
      />
      <HomeCard
        text="Ranking"
        onPress={() => goScoped('RankingScreen')}
        backgroundImage={bgUris.ranking ? { uri: bgUris.ranking } : RankingImage}
        heightPercent={20}
        testID="private-home.button.ranking"
      />

      <CenteredModal
        isModalVisible={isColorEditorVisible}
        onPress={closeColorEditor}
        onCancel={closeColorEditor}
        testIDPrefix="private-home.color-editor"
        confirmTestID="private-home.color-editor.confirm.ok"
        cancelTestID="private-home.color-editor.confirm.cancel"
        confirmLabel="Done"
        cancelLabel="Cancel"
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <GroupIdentitySection
            groupId={groupId}
            initialName={group?.name ?? ''}
            initialPrimaryColor={group?.primary_color ?? GlobalStyle.color.primaryColor}
            initialSecondaryColor={group?.secondary_color ?? GlobalStyle.color.secondaryColor}
            appearance="light"
            onRefresh={refresh}
            onSaved={closeColorEditor}
            testIDPrefix="private-home"
          />
          <Text style={styles.bgSectionTitle}>Button backgrounds</Text>
          <Text style={styles.bgSectionCaption}>
            Custom images behind each homescreen button.
          </Text>
          {BACKGROUND_SLOTS.map(({ slot, label }) => {
            const slotData = group?.home_button_backgrounds?.[slot];
            const uri = bgUris[slot];
            const isSaving = !!savingSlot[slot];
            return (
              <View key={slot} style={styles.bgSlotCard} testID={`private-home.button-bg.${slot}.row`}>
                {uri ? (
                  <Image source={{ uri }} style={styles.bgThumb} />
                ) : (
                  <View style={[styles.bgThumb, styles.bgThumbFallback]}>
                    <Ionicons name="image-outline" size={18} color={GlobalStyle.color.secondaryColor} />
                  </View>
                )}
                <View style={styles.bgSlotInfo}>
                  <Text style={styles.bgSlotLabel}>{label}</Text>
                  <Text style={styles.bgSlotStatus}>
                    {slotData ? 'Custom image' : 'Default'}
                  </Text>
                </View>
                <View style={styles.bgSlotActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${label} background`}
                    onPress={() => chooseSlotBackground(slot)}
                    disabled={isSaving}
                    testID={`private-home.button-bg.${slot}.choose`}
                    style={({ pressed }) => [
                      styles.bgChooseChip,
                      pressed && styles.pressed,
                      isSaving && styles.bgChooseBusy,
                    ]}
                  >
                    <Ionicons name="cloud-upload-outline" size={15} color="#fff" />
                    <Text style={styles.bgChooseChipText}>{isSaving ? 'Saving…' : 'Choose'}</Text>
                  </Pressable>
                  {slotData && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${label} background`}
                      onPress={() => removeSlotBackground(slot)}
                      testID={`private-home.button-bg.${slot}.remove`}
                      style={({ pressed }) => [styles.bgRemoveChip, pressed && styles.pressed]}
                    >
                      <Ionicons name="trash-outline" size={14} color="#E03A3A" />
                      <Text style={styles.bgRemoveChipText}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
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
  pressed: { opacity: 0.7 },

  // Button backgrounds (inside the white customize modal)
  bgSectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 4, color: GlobalStyle.color.primaryColor800 },
  bgSectionCaption: { fontSize: 12, color: '#6B6680', marginBottom: 10 },
  bgSlotCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
    backgroundColor: '#F5F2FC', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: 'rgba(101,40,247,0.14)',
  },
  bgThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(101,40,247,0.08)' },
  bgThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  bgSlotInfo: { flex: 1 },
  bgSlotLabel: { fontSize: 15, fontWeight: '600', color: GlobalStyle.color.primaryColor800 },
  bgSlotStatus: { fontSize: 12, color: '#6B6680', marginTop: 1 },
  bgSlotActions: { alignItems: 'flex-end', gap: 6 },
  bgChooseChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GlobalStyle.color.primaryColor, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  bgChooseChipText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  bgChooseBusy: { opacity: 0.6 },
  bgRemoveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(224,58,58,0.08)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(224,58,58,0.35)',
    paddingHorizontal: 10, paddingVertical: 7,
  },
  bgRemoveChipText: { color: '#E03A3A', fontSize: 13, fontWeight: '600' },
});
