import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '../components/UI/Button';
import LanguageSelector from '../components/UI/LanguageSelector';
import { GlobalStyle } from '../constants/theme';
import { resolveDefaultLanguage } from '../utils/languageDefaults';
import { savePreferredLanguage, setOnboardingCompleted } from '../utils/storageDatum';

export default function LanguageOnboardingScreen({ onDone }) {
  const { t } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(resolveDefaultLanguage() || 'en');
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selectedLanguage || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await savePreferredLanguage(selectedLanguage);
      await setOnboardingCompleted(true);
      await onDone?.();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="language-onboarding.screen">
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('onboarding.title')}
        </Text>
        <Text style={styles.subtitle}>
          {t('onboarding.subtitle')}
        </Text>

        <View style={styles.selectorBlock}>
          <Text style={styles.label}>{t('onboarding.preferredLanguage')}</Text>
          <LanguageSelector
            value={selectedLanguage}
            onChange={setSelectedLanguage}
            accessibilityLabel={t('onboarding.selectorLabel')}
            accessibilityHint={t('onboarding.selectorHint')}
            testIDPrefix="language-onboarding.selector"
          />
        </View>

        <Button
          accessibilityLabel={t('onboarding.confirmLabel')}
          onPress={handleConfirm}
          style={styles.button}
          testID="language-onboarding.button.confirm"
        >
          {t('onboarding.confirm')}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GlobalStyle.color.primaryColor900,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.82)',
  },
  selectorBlock: {
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  button: {
    marginTop: 8,
  },
});