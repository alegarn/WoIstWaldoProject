import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

const MODES = ['any', 'point', 'shape'] as const;

export type ModeSelectorMode = (typeof MODES)[number];

const MODE_LABEL_KEYS: Record<ModeSelectorMode, string> = {
  any: 'guess.modeFilter.any',
  point: 'guess.modeFilter.point',
  shape: 'guess.modeFilter.shape',
};

type ModeSelectorProps = {
  value: string;
  onChange: (mode: ModeSelectorMode) => void;
  testIDPrefix: string;
  visible: boolean;
  onClose: () => void;
};

export default function ModeSelector({ value, onChange, testIDPrefix, visible, onClose }: ModeSelectorProps) {
  const { t } = useTranslation();

  const handleSelect = (mode: ModeSelectorMode) => {
    onChange(mode);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      transparent={false}>
      <View style={styles.modalContainer} testID={testIDPrefix}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('guess.modeFilter.label')}</Text>
          <Pressable
            onPress={onClose}
            testID={`${testIDPrefix}.close`}
            style={styles.closeButton}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </Pressable>
        </View>
        <ScrollView>
          {MODES.map((mode) => {
            const isSelected = mode === value;
            return (
              <Pressable
                key={mode}
                onPress={() => handleSelect(mode)}
                testID={`${testIDPrefix}.option.${mode}`}
                style={[styles.option, isSelected && styles.optionSelected]}>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {t(MODE_LABEL_KEYS[mode])}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
