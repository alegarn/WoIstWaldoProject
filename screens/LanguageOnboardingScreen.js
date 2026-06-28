import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import Button from '../components/UI/Button';
import LanguageSelector from '../components/UI/LanguageSelector';
import { GlobalStyle } from '../constants/theme';
import { resolveDefaultLanguage } from '../utils/languageDefaults';
import { savePreferredLanguage, setOnboardingCompleted } from '../utils/storageDatum';

export default function LanguageOnboardingScreen({ onDone }) {
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
          Pick your preferred language
        </Text>
        <Text style={styles.subtitle}>
          This sets the default language for new enigmas. You can change it later in settings.
        </Text>

        <View style={styles.selectorBlock}>
          <Text style={styles.label}>Preferred language</Text>
          <LanguageSelector
            value={selectedLanguage}
            onChange={setSelectedLanguage}
            accessibilityLabel="Select preferred language for new enigmas"
            accessibilityHint="Opens the language list before you finish onboarding"
            testIDPrefix="language-onboarding.selector"
          />
        </View>

        <Button
          accessibilityLabel="Confirm preferred language and finish onboarding"
          onPress={handleConfirm}
          style={styles.button}
          testID="language-onboarding.button.confirm"
        >
          Confirm
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