import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Animated, Image } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';

type QuickTutorialPanel = {
  key: 'hide' | 'guess' | 'ranking';
  image?: number;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  buttonKey: string;
  bodyKey: string;
};

const HIDE_PANEL_IMAGE = require('../../assets/tutorial/farm_pict_hide_320.jpg');
const GUESS_PANEL_IMAGE = require('../../assets/tutorial/farm_pict_guess_320.jpg');

const PANELS: QuickTutorialPanel[] = [
  {
    key: 'hide',
    image: HIDE_PANEL_IMAGE,
    buttonKey: 'home.hideWaldo',
    bodyKey: 'tutorial.quick.hide',
  },
  {
    key: 'guess',
    image: GUESS_PANEL_IMAGE,
    buttonKey: 'home.findWaldo',
    bodyKey: 'tutorial.quick.guess',
  },
  {
    key: 'ranking',
    icon: 'trophy-outline',
    buttonKey: 'home.ranking',
    bodyKey: 'tutorial.quick.ranking',
  },
];

const ENTRANCE_DURATION_MS = 350;
const PULSE_PERIOD_MS = 700;

type QuickTutorialProps = {
  visible: boolean;
  onDone: () => void;
};

export default function QuickTutorial({ visible, onDone }: QuickTutorialProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const entrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }

    setStep(0);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: ENTRANCE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, step, entrance]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_PERIOD_MS,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: PULSE_PERIOD_MS,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => loop.stop();
  }, [visible, pulse]);

  const panel = PANELS[step];
  const isLastPanel = step === PANELS.length - 1;

  const goToNextPanel = useCallback(() => {
    setStep((current) => Math.min(current + 1, PANELS.length - 1));
  }, []);

  const handleDone = useCallback(() => {
    onDone();
  }, [onDone]);

  const entranceTransform = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleDone}>
      <View style={styles.backdrop} testID="tutorial.quick.backdrop">
        <View style={styles.card} testID="tutorial.quick.card">
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('tutorial.quick.title')}</Text>
            <Pressable
              onPress={handleDone}
              accessibilityRole="button"
              accessibilityLabel={t('tutorial.quick.skip')}
              testID="tutorial.quick.skip"
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>{t('tutorial.quick.skip')}</Text>
            </Pressable>
          </View>

          <Animated.View
            key={panel.key}
            style={[styles.panel, { opacity: entrance, transform: [{ translateY: entranceTransform }] }]}
          >
            <View
              style={styles.panelContent}
              testID={`tutorial.quick.panel.${panel.key}`}
            >
              {panel.image !== undefined ? (
                <Image source={panel.image} style={styles.panelImage} resizeMode="cover" />
              ) : (
                panel.icon && (
                  <Ionicons
                    name={panel.icon}
                    size={48}
                    color={GlobalStyle.color.secondaryColor}
                    style={styles.panelIcon}
                  />
                )
              )}

              <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
                <View style={styles.mockButton} testID="tutorial.quick.panelLabel">
                  <Text style={styles.mockButtonText}>{t(panel.buttonKey)}</Text>
                </View>
              </Animated.View>

              <Text style={styles.body}>{t(panel.bodyKey, { button: t(panel.buttonKey) })}</Text>
            </View>
          </Animated.View>

          <View style={styles.dotsRow}>
            {PANELS.map((entry, index) => (
              <View
                key={entry.key}
                style={[styles.dot, index === step && styles.dotActive]}
                testID={`tutorial.quick.dot.${entry.key}`}
              />
            ))}
          </View>

          <Pressable
            onPress={isLastPanel ? handleDone : goToNextPanel}
            accessibilityRole="button"
            accessibilityLabel={isLastPanel ? t('tutorial.quick.done') : t('tutorial.quick.next')}
            testID={isLastPanel ? 'tutorial.quick.done' : 'tutorial.quick.next'}
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
          >
            <Text style={styles.actionButtonText}>
              {isLastPanel ? t('tutorial.quick.done') : t('tutorial.quick.next')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '80%',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: GlobalStyle.color.primaryColor900,
    flex: 1,
  },
  skipButton: {
    paddingVertical: 6,
    paddingLeft: 12,
  },
  skipText: {
    fontSize: 16,
    color: GlobalStyle.color.primaryColor500,
  },
  panel: {
    alignItems: 'center',
    width: '100%',
  },
  panelContent: {
    alignItems: 'center',
    width: '100%',
  },
  panelIcon: {
    marginBottom: 12,
  },
  panelImage: {
    width: 220,
    height: 200,
    borderRadius: 10,
    marginBottom: 12,
  },
  mockButton: {
    backgroundColor: GlobalStyle.color.primaryColor,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    minWidth: 180,
    alignItems: 'center',
    marginBottom: 12,
  },
  mockButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    color: 'black',
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GlobalStyle.color.secondaryColor300,
    marginHorizontal: 4,
  },
  dotActive: {
    width: 20,
    backgroundColor: GlobalStyle.color.secondaryColor,
  },
  actionButton: {
    backgroundColor: GlobalStyle.color.primaryColor,
    borderRadius: 5,
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  actionButtonPressed: {
    opacity: 0.8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
