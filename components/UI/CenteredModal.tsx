import { Modal, View, Text, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import React from 'react';

import Button from './Button';

type ModalButtonProps = {
  children?: React.ReactNode;
  accessibilityLabel?: string;
  onPress?: () => void;
  mode?: 'flat' | null;
  testID?: string;
  disabled?: boolean;
  thin?: boolean;
  cancel?: boolean;
};

const TypedButton = Button as unknown as React.ComponentType<ModalButtonProps>;

export type CenteredModalProps = {
  children?: React.ReactNode;
  isModalVisible: boolean;
  onPress?: () => void;
  onCancel?: () => void;
  testIDPrefix?: string;
  confirmTestID?: string;
  cancelTestID?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
};

export default function CenteredModal({
  children,
  onCancel,
  onPress,
  isModalVisible,
  testIDPrefix = 'modal',
  confirmTestID,
  cancelTestID,
  confirmLabel,
  cancelLabel,
  confirmDisabled,
}: CenteredModalProps) {
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
            <TypedButton
              accessibilityLabel={t('common.confirm')}
              onPress={onPress}
              mode={Platform.OS === "ios" ? "flat" : null}
              testID={confirmTestID || `${testIDPrefix}.confirm`}
              disabled={confirmDisabled}
              thin={true}>{confirmLabel || t('common.confirm')}</TypedButton>
          </View>
          <View style={styles.space}>
            <TypedButton
              accessibilityLabel={t('common.close')}
              onPress={onCancel}
              mode={Platform.OS === "ios" ? "flat" : null}
              testID={cancelTestID || `${testIDPrefix}.close`}
              thin={true}
              cancel={true}>{cancelLabel || t('common.close')}</TypedButton>
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
