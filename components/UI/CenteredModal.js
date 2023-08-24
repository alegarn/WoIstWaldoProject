import { Modal, View, Text,  StyleSheet, Platform } from 'react-native';
import Button from './Button';


export default function CenteredModal({ children, onCancel, onPress , isModalVisible}) {
  return (
    <Modal
      visible={isModalVisible}
      animationType="fade"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>

          <Text style={styles.modalText}>{children}</Text>

          <View style={styles.buttonContainer}>
          <View style={styles.space}>
            <Button
              onPress={onPress}
              mode={Platform.OS === "ios" ? "flat" : null}
              thin={true}>Confirm</Button>
          </View>
          <View style={styles.space}>
            <Button
              onPress={onCancel}
              mode={Platform.OS === "ios" ? "flat" : null}
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '80%',
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
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
