import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import _IconButton from './IconButton';
import IconPulseRing from './IconPulseRing';
import {
  getUiState,
  publish,
  signalIconTap,
  subscribe,
} from '../../utils/groupsIntro/groupsIntroUiStore';

// IconButton.js is unmigrated; permissive cast mirrors the App.tsx convention.
const IconButton = _IconButton as React.ComponentType<any>;

type GroupsIconButtonProps = {
  onPress?: () => void;
  color?: string;
};

export default function GroupsIconButton({ onPress, color }: GroupsIconButtonProps) {
  const { t } = useTranslation();
  const [ringPhase, setRingPhase] = useState<'active' | 'settle' | 'off'>(() => getUiState().ringPhase);

  useEffect(() => {
    const unsubscribe = subscribe((state) => setRingPhase(state.ringPhase));
    return unsubscribe;
  }, []);

  // Chain tail owner: a settle-loop completion ends the ring ('off'); an
  // 'active' completion publishes nothing — the ring rests as the static ring
  // until dismissal.
  const handleLoopEnd = useCallback(() => {
    if (getUiState().ringPhase === 'settle') {
      publish({ ringPhase: 'off' });
    }
  }, []);

  const handlePress = useCallback(() => {
    signalIconTap();
    onPress?.();
  }, [onPress]);

  return (
    <View style={{ marginRight: 20 }}>
      <IconPulseRing phase={ringPhase} onLoopEnd={handleLoopEnd}>
        <IconButton
          accessibilityLabel={t('groupsIntro.iconLabel')}
          icon="people"
          color={color}
          size={24}
          onPress={handlePress}
          testID="home.header.groups"
        />
      </IconPulseRing>
    </View>
  );
}
