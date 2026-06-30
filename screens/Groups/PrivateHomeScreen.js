import { useCallback, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, Share, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import HomeCard from '../../components/UI/HomeCard';
import IconButton from '../../components/UI/IconButton';
import { GlobalStyle } from '../../constants/theme';
import { handleOrientation } from '../../utils/orientation';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';
import { AuthContext } from '../../store/auth-context';

const HideImage = require('../../assets/home/WoIstWaldo-character-hide.webp');
const FindImage = require('../../assets/home/WoIstWaldo-character-guess-4-3.webp');
const RankingImage = require('../../assets/home/WoIstWaldo-character-stats.webp');

export default function PrivateHomeScreen({ navigation, route }) {
  const routeScope = route?.params?.scope;
  const { scope, clear } = useActiveGroup();
  const { setPrivateMode } = useContext(AuthContext);
  const activeScope = routeScope ?? scope;
  const { data, refresh } = useGroupsHub();
  const group = activeScope?.kind === 'private'
    ? [...(data?.owned ?? []), ...(data?.joined ?? [])].find((g) => g.id === activeScope.groupId)
    : null;
  const isLocked = group?.locked === true;
  const isOwner = group?.role === 'owner';
  const groupId = activeScope?.kind === 'private' ? activeScope.groupId : null;

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

  useEffect(() => {
    navigation.setOptions({
      title: group?.name ?? '',
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
  }, [navigation, group?.name, group?.joining_code, isOwner, clear, shareCode]);

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

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: group?.primary_color || GlobalStyle.color.primaryColor900 },
      ]}
    >
      <Text style={styles.title} testID="private-home.title">
        {group?.name ?? ''}
      </Text>
      {isLocked && (
        <Text testID="private-home.lock-badge" style={styles.lockBadge}>
          Locked by owner
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#fff' },
  lockBadge: { fontSize: 14, color: '#ffd700', textAlign: 'center' },
});
