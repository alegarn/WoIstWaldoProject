import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import BigButton from '../../components/UI/BigButton';
import GroupsTutorialModal from '../../components/UI/GroupsTutorialModal';
import LoadingOverlay from '../../components/UI/LoadingOverlay';
import { GROUPS_INTRO_ENABLED } from '../../constants/featureFlags';
import { getGroupsDetailSeen, setGroupsDetailSeen } from '../../utils/storageDatum';
import { hasIntroShownThisSession } from './groupsIntroSession';
import { GlobalStyle } from '../../constants/theme';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { AuthContext } from '../../store/auth-context';

export function shouldShowGroupsTutorial(gates) {
  return Boolean(
    gates.enabled &&
      !gates.detailSeen &&
      !gates.isLoading &&
      gates.hasData &&
      gates.isEmptyHub &&
      !gates.hasError &&
      !gates.introShownThisSession
  );
}

export default function GroupsListScreen({ navigation }) {
  const { t } = useTranslation();
  const authContext = useContext(AuthContext);
  const { data, isLoading, error, refresh } = useGroupsHub();
  const { setActive } = useActiveGroup();

  const owned = data?.owned ?? [];

  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialShownRef = useRef(false);
  const hubRef = useRef({ data, isLoading, error });
  hubRef.current = { data, isLoading, error };

  const maybeShowGroupsTutorial = useCallback(async () => {
    if (tutorialShownRef.current) {
      return;
    }

    let detailSeen = false;
    try {
      detailSeen = await getGroupsDetailSeen();
    } catch {
      detailSeen = false;
    }

    if (tutorialShownRef.current) {
      return;
    }

    const { data: hubData, isLoading: hubLoading, error: hubError } = hubRef.current;
    const ownedCount = hubData?.owned?.length ?? 0;
    const joinedCount = hubData?.joined?.length ?? 0;

    const shouldShow = shouldShowGroupsTutorial({
      enabled: GROUPS_INTRO_ENABLED,
      detailSeen,
      isLoading: hubLoading,
      hasData: hubData != null,
      isEmptyHub: ownedCount + joinedCount === 0,
      hasError: hubError != null,
      introShownThisSession: hasIntroShownThisSession(),
    });

    if (!shouldShow) {
      return;
    }

    tutorialShownRef.current = true;
    setGroupsDetailSeen(true).catch(() => {});
    setShowTutorial(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      maybeShowGroupsTutorial();
    }, [refresh, maybeShowGroupsTutorial])
  );

  useEffect(() => {
    maybeShowGroupsTutorial();
  }, [data, isLoading, maybeShowGroupsTutorial]);

  const handleTutorialDone = useCallback(() => {
    setShowTutorial(false);
  }, []);

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
      Alert.alert(t('common.error'), err?.message ?? t('groups.list.openFailed'));
    }
  };

  if (isLoading && !data) {
    return <LoadingOverlay message={t('groups.list.loading')} />;
  }

  if (error && !data) {
    return (
      <View style={styles.container} testID="groups-list.container">
        <Text style={styles.errorText}>{t('groups.list.loadFailed')}</Text>
        <BigButton
          text={t('common.retry')}
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
          {t('groups.list.empty')}
        </Text>
        <Text style={styles.emptySubtitle}>{t('groups.empty.subtitle')}</Text>
        <Text style={styles.emptyHeadline}>{t('groups.empty.whyTitle')}</Text>
        <Text style={styles.emptyDetails}>{t('groups.empty.whyBody')}</Text>
        <BigButton
          text={t('groups.list.joinAnother')}
          onPress={() => navigation.navigate('JoinByCodeScreen')}
          testID="groups-list.button.join"
        />
        <BigButton
          text={t('groups.list.create')}
          onPress={() => navigation.navigate('CreateGroupScreen')}
          testID="groups-list.button.create"
        />
        <Pressable
          onPress={() => navigation.navigate('PaywallScreen', { intent: 'store' })}
          testID="groups-list.button.store"
          accessibilityRole="link"
          accessibilityLabel={t('groups.empty.storeCaption')}
          style={styles.storeLink}
        >
          <Text style={styles.storeLinkText}>{t('groups.empty.storeCaption')}</Text>
        </Pressable>
        {showTutorial && (
          <GroupsTutorialModal visible={showTutorial} onDone={handleTutorialDone} />
        )}
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
            {item.role === 'owner' && <Text style={styles.rowRole}>{t('groups.list.owner')}</Text>}
            <BigButton
              text={t('groups.list.open')}
              onPress={() => openGroup(item)}
              testID={`groups-list.button.open-${item.id}`}
            />
          </View>
        )}
      />
      <BigButton
        text={t('groups.list.joinAnother')}
        onPress={() => navigation.navigate('JoinByCodeScreen')}
        testID="groups-list.button.join"
      />
      <BigButton
        text={t('groups.list.create')}
        onPress={() => navigation.navigate('CreateGroupScreen')}
        testID="groups-list.button.create"
      />
      <BigButton
        text={t('groups.list.store')}
        onPress={() => navigation.navigate('PaywallScreen', { intent: 'store' })}
        testID="groups-list.button.store"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GlobalStyle.color.primaryColor900, padding: 12, gap: 10 },
  emptyText: { color: '#fff', fontSize: 18, textAlign: 'center', marginVertical: 20 },
  emptySubtitle: { color: '#fff', fontSize: 14, textAlign: 'center' },
  emptyHeadline: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  emptyDetails: { color: '#fff', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  storeLink: { alignItems: 'center', paddingVertical: 8 },
  storeLinkText: { color: GlobalStyle.color.secondaryColor, fontSize: 14, textDecorationLine: 'underline' },
  errorText: { color: '#fff', fontSize: 18, textAlign: 'center', marginVertical: 20 },
  row: { padding: 12, marginVertical: 6, borderRadius: 8 },
  rowTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  rowRole: { color: '#ffd700', fontSize: 12 },
});
