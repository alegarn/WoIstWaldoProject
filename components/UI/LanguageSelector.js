import { useState } from 'react';
import { Pressable, View, Text, Modal, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LANGUAGES } from '../../constants/languages';
import { GlobalStyle } from '../../constants/theme';

export default function LanguageSelector({
  value,
  onChange,
  testIDPrefix,
  accessibilityLabel = undefined,
  accessibilityHint = undefined,
  variant = 'light',
  visible,
  onClose,
}) {
  const [internalVisible, setInternalVisible] = useState(false);
  const { t } = useTranslation();
  const isOverlay = variant === 'overlay';
  const isControlled = visible !== undefined;

  const modalVisible = isControlled ? visible : internalVisible;
  const handleClose = () => {
    if (isControlled) {
      onClose?.();
      return;
    }
    setInternalVisible(false);
  };

  const selectedLanguage = LANGUAGES.find((language) => language.code === value);
  const selectedName =
    (selectedLanguage && (selectedLanguage.nativeName ?? selectedLanguage.name)) ||
    value ||
    t('common.selectLanguage');

  const handleSelect = (code) => {
    onChange(code);
    handleClose();
  };

  const modal = (
    <Modal
      visible={modalVisible}
      onRequestClose={handleClose}
      animationType="slide"
      transparent={false}>
      <View style={styles.modalContainer} testID={testIDPrefix}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('common.selectLanguage')}</Text>
          <Pressable
            onPress={handleClose}
            testID={`${testIDPrefix}.close`}
            style={styles.closeButton}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </Pressable>
        </View>
        <ScrollView>
          {LANGUAGES.map((language) => {
            const isSelected = language.code === value;
            return (
              <Pressable
                key={language.code}
                onPress={() => handleSelect(language.code)}
                testID={`${testIDPrefix}.option.${language.code}`}
                style={[styles.option, isSelected && styles.optionSelected]}>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {language.nativeName ?? language.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );

  if (isControlled) {
    return modal;
  }

  return (
    <View>
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel ?? t('common.selectLanguage')}
        accessibilityRole="button"
        onPress={() => setInternalVisible(true)}
        testID={`${testIDPrefix}.button`}
        style={[styles.button, isOverlay && styles.buttonOverlay]}>
        <Text style={[styles.buttonText, isOverlay && styles.buttonTextOverlay]}>{selectedName}</Text>
      </Pressable>

      {modal}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCC',
    backgroundColor: '#FFF',
  },
  buttonOverlay: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
  },
  buttonText: {
    fontSize: 15,
    color: 'GlobalStyle.color.tertiaryColor900',
  },
  buttonTextOverlay: {
    color: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'GlobalStyle.color.tertiaryColor900',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 15,
    color: 'GlobalStyle.color.tertiaryColor900',
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  optionSelected: {
    backgroundColor: 'rgba(29, 19, 61, 0.08)',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionTextSelected: {
    fontWeight: 'bold',
    color: 'GlobalStyle.color.tertiaryColor900',
  },
});
