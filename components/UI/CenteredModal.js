import { Modal, View, Text,  StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from './Button';


export default function CenteredModal({ children, onCancel, onPress , isModalVisible, testIDPrefix = 'modal', confirmTestID, cancelTestID, confirmLabel, cancelLabel, confirmDisabled }) {
  const { t } = useTranslation();
  const shouldRenderTextChild = typeof children === 'string' || typeof children === 'number';

  return (
    <Modal
      visible={isModalVisible}
      animationType="fade"
      transparent={true}
    >
      <View style={styles.modalContainer} testID={`${testIDPrefix}.backdrop`}>
        <View accessibilityLabel={`${testIDPrefix} content`} style={styles.modalContent} testID={`${testIDPrefix}.content`}>

          {
            shouldRenderTextChild
              ? <Text style={styles.modalText}>{children}</Text>
              : <View style={styles.modalBody}>{children}</View>
          }

          <View style={styles.buttonContainer}>
          <View style={styles.space}>
            <Button
              accessibilityLabel={t('common.confirm')}
              onPress={onPress}
              mode={Platform.OS === "ios" ? "flat" : null}
              testID={confirmTestID || `${testIDPrefix}.confirm`}
              disabled={confirmDisabled}
              thin={true}>{confirmLabel || t('common.confirm')}</Button>
          </View>
          <View style={styles.space}>
            <Button
              accessibilityLabel={t('common.close')}
              onPress={onCancel}
              mode={Platform.OS === "ios" ? "flat" : null}
              testID={cancelTestID || `${testIDPrefix}.close`}
              thin={true}
              cancel={true}>{cancelLabel || t('common.close')}</Button>
          </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    maxWidth: '80%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalText: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalBody: {
    marginBottom: 10,
    flexShrink: 1,
    width: '100%',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  space: {
    paddingHorizontal: 10,
  },
});
