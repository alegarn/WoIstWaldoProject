import { Modal, View, Text,  StyleSheet, Platform } from 'react-native';
import Button from './Button';


export default function CenteredModal({ children, onCancel, onPress , isModalVisible, testIDPrefix = 'modal'}) {
  return (
    <Modal
      visible={isModalVisible}
      animationType="fade"
      transparent={true}
    >
      <View style={styles.modalContainer} testID={`${testIDPrefix}.backdrop`}>
        <View accessibilityLabel={`${testIDPrefix} content`} style={styles.modalContent} testID={`${testIDPrefix}.content`}>

          <Text style={styles.modalText}>{children}</Text>

          <View style={styles.buttonContainer}>
          <View style={styles.space}>
            <Button
              accessibilityLabel={`${testIDPrefix} confirm`}
              onPress={onPress}
              mode={Platform.OS === "ios" ? "flat" : null}
              testID={`${testIDPrefix}.confirm`}
              thin={true}>Confirm</Button>
          </View>
          <View style={styles.space}>
            <Button
              accessibilityLabel={`${testIDPrefix} close`}
              onPress={onCancel}
              mode={Platform.OS === "ios" ? "flat" : null}
              testID={`${testIDPrefix}.close`}
              thin={true}
              cancel={true}>Close</Button>
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
  },
  modalText: {
    fontSize: 18,
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  space: {
    paddingHorizontal: 10,
  },
});
