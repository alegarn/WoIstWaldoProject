import { useState } from 'react';
import { Pressable, View, Text, Modal, ScrollView, StyleSheet } from 'react-native';

import { LANGUAGES } from '../../constants/languages';

export default function LanguageSelector({ value, onChange, testIDPrefix }) {
  const [visible, setVisible] = useState(false);

  const selectedName =
    LANGUAGES.find((language) => language.code === value)?.name || value || 'Select language';

  const handleSelect = (code) => {
    onChange(code);
    setVisible(false);
  };

  return (
    <View>
      <Pressable
        onPress={() => setVisible(true)}
        testID={`${testIDPrefix}.button`}
        style={styles.button}>
        <Text style={styles.buttonText}>{selectedName}</Text>
      </Pressable>

      <Modal
        visible={visible}
        onRequestClose={() => setVisible(false)}
        animationType="slide"
        transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Select language</Text>
            <Pressable
              onPress={() => setVisible(false)}
              testID={`${testIDPrefix}.close`}
              style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
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
                    {language.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
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
  buttonText: {
    fontSize: 15,
    color: '#1D133D',
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
    color: '#1D133D',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 15,
    color: '#1D133D',
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
    color: '#1D133D',
  },
});
