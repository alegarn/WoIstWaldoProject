import { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import HomeCard from '../../components/UI/HomeCard';
import BigButton from '../../components/UI/BigButton';
import { GlobalStyle } from '../../constants/theme';
import { handleOrientation } from '../../utils/orientation';
import { useActiveGroup } from '../../hooks/useActiveGroup';
import { useGroupsHub } from '../../hooks/useGroupsHub';

const HideImage = require('../../assets/home/WoIstWaldo-character-hide.webp');
const FindImage = require('../../assets/home/WoIstWaldo-character-guess-4-3.webp');
const RankingImage = require('../../assets/home/WoIstWaldo-character-stats.webp');

export default function PrivateHomeScreen({ navigation, route }) {
  const routeScope = route?.params?.scope;
  const { scope, clear } = useActiveGroup();
  const activeScope = routeScope ?? scope;
  const { data, refresh } = useGroupsHub();
  const group = activeScope?.kind === 'private'
    ? [...(data?.owned ?? []), ...(data?.joined ?? [])].find((g) => g.id === activeScope.groupId)
    : null;
  const isLocked = group?.locked === true;
  const groupId = activeScope?.kind === 'private' ? activeScope.groupId : null;

  useEffect(() => {
    navigation.setOptions({ title: group?.name ?? '' });
  }, [navigation, group?.name]);

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
      <BigButton
        text="Back to public"
        onPress={() => {
          clear();
          navigation.navigate('HomeScreen');
        }}
        testID="private-home.button.back-to-public"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#fff' },
  lockBadge: { fontSize: 14, color: '#ffd700', textAlign: 'center' },
});
