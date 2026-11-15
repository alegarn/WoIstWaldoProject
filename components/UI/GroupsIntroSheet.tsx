import { useCallback, useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';

type GroupsIntroSheetProps = {
  visible: boolean;
  onOpen: () => void;
  onLater: () => void;
};

export default function GroupsIntroSheet({ visible, onOpen, onLater }: GroupsIntroSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onLater();
      return true;
    });
    return () => {
      subscription?.remove();
    };
  }, [visible, onLater]);

  if (!visible) return null;

  return (
    <View testID="groups-intro.sheet" style={styles.wrapper} pointerEvents="box-none">
      <Pressable
        testID="groups-intro.scrim"
        style={styles.scrim}
        onPress={onLater}
        accessibilityRole="button"
        accessibilityLabel={t('groupsIntro.ctaLater')}
      />
      <View style={[styles.card, { paddingBottom: insets.bottom }]}>
        <Text style={styles.title}>{t('groupsIntro.title')}</Text>
        <Text style={styles.body}>{t('groupsIntro.body')}</Text>
        <Text style={styles.pointer}>{t('groupsIntro.iconPointer')}</Text>
        <Pressable
          testID="groups-intro.cta-open"
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={onOpen}
          accessibilityRole="button"
        >
          <Text style={styles.ctaOpenText}>{t('groupsIntro.ctaOpen')}</Text>
        </Pressable>
        <Pressable
          testID="groups-intro.cta-later"
          style={({ pressed }) => [styles.ctaLater, pressed && styles.ctaPressed]}
          onPress={onLater}
          accessibilityRole="button"
        >
          <Text style={styles.ctaLaterText}>{t('groupsIntro.ctaLater')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: -10,
    right: -10,
    bottom: -10,
  },
  scrim: {
    position: 'absolute',
    top: '60%',
    left: 0,
    right: 0,
    bottom: -10,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: GlobalStyle.color.primaryColor900,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: 'black',
    textAlign: 'center',
  },
  pointer: {
    fontSize: 14,
    color: GlobalStyle.color.primaryColor500,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: GlobalStyle.color.primaryColor,
    borderRadius: 5,
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  ctaLater: {
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  ctaPressed: {
    opacity: 0.8,
  },
  ctaOpenText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ctaLaterText: {
    color: GlobalStyle.color.primaryColor500,
    fontSize: 15,
  },
});
