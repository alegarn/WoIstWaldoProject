import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';
import { PULSE_PERIOD_MS } from '../../constants/groupsIntro';

type GroupTutorialPanel = {
  key: 'page1' | 'page2' | 'page3' | 'page4';
  icon: React.ComponentProps<typeof Ionicons>['name'];
  titleKey: string;
  bodyKey: string;
};

const GROUP_TUTORIAL_PANELS: GroupTutorialPanel[] = [
  {
    key: 'page1',
    icon: 'people-outline',
    titleKey: 'groupsTutorial.page1.title',
    bodyKey: 'groupsTutorial.page1.body',
  },
  {
    key: 'page2',
    icon: 'log-in-outline',
    titleKey: 'groupsTutorial.page2.title',
    bodyKey: 'groupsTutorial.page2.body',
  },
  {
    key: 'page3',
    icon: 'add-circle-outline',
    titleKey: 'groupsTutorial.page3.title',
    bodyKey: 'groupsTutorial.page3.body',
  },
  {
    key: 'page4',
    icon: 'color-palette-outline',
    titleKey: 'groupsTutorial.page4.title',
    bodyKey: 'groupsTutorial.page4.body',
  },
];

const ENTRANCE_DURATION_MS = 350;

type GroupsTutorialModalProps = {
  visible: boolean;
  onDone: () => void;
};

export default function GroupsTutorialModal({ visible, onDone }: GroupsTutorialModalProps) {
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

  const panel = GROUP_TUTORIAL_PANELS[step];
  const isLastPanel = step === GROUP_TUTORIAL_PANELS.length - 1;

  const goToNextPanel = useCallback(() => {
    setStep((current) => Math.min(current + 1, GROUP_TUTORIAL_PANELS.length - 1));
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
      <View style={styles.backdrop} testID="groupsTutorial.backdrop">
        <View style={styles.card} testID="groupsTutorial.card">
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('groupsTutorial.title')}</Text>
            <Pressable
              onPress={handleDone}
              accessibilityRole="button"
              accessibilityLabel={t('groupsTutorial.skip')}
              testID="groupsTutorial.skip"
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>{t('groupsTutorial.skip')}</Text>
            </Pressable>
          </View>

          <Animated.View
            key={panel.key}
            style={[styles.panel, { opacity: entrance, transform: [{ translateY: entranceTransform }] }]}
          >
            <View
              style={styles.panelContent}
              testID={`groupsTutorial.panel.${panel.key}`}
            >
              <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
                <Ionicons
                  name={panel.icon}
                  size={48}
                  color={GlobalStyle.color.secondaryColor}
                  style={styles.panelIcon}
                />
              </Animated.View>

              <Text style={styles.panelTitle}>{t(panel.titleKey)}</Text>
              <Text style={styles.body}>{t(panel.bodyKey)}</Text>
            </View>
          </Animated.View>

          <View style={styles.dotsRow}>
            {GROUP_TUTORIAL_PANELS.map((entry, index) => (
              <View
                key={entry.key}
                style={[styles.dot, index === step && styles.dotActive]}
                testID={`groupsTutorial.dot.${entry.key}`}
              />
            ))}
          </View>

          <Pressable
            onPress={isLastPanel ? handleDone : goToNextPanel}
            accessibilityRole="button"
            accessibilityLabel={isLastPanel ? t('groupsTutorial.done') : t('groupsTutorial.next')}
            testID={isLastPanel ? 'groupsTutorial.done' : 'groupsTutorial.next'}
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
          >
            <Text style={styles.actionButtonText}>
              {isLastPanel ? t('groupsTutorial.done') : t('groupsTutorial.next')}
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
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: GlobalStyle.color.primaryColor900,
    textAlign: 'center',
    marginBottom: 8,
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
