import { Modal, View, Text,  StyleSheet, Platform } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Button from './Button';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import {GestureHandlerRootView} from 'react-native-gesture-handler';

export default function ClipboardModal({ children, onCancel, onPress , isModalVisible, debugText}) {

  const copyToClipboard = () => {
    console.log("copyToClipboard", debugText);
    Clipboard.setString(children);
  };

  return (
    <Modal
      visible={isModalVisible}
      animationType="fade"
      transparent={true}
    >
      <SafeAreaView style={styles.modalContainer}>
        <GestureHandlerRootView>
        <ScrollView contentContainerStyle={styles.modalContent}>
          
          <Text style={styles.modalText}>{debugText}</Text>

          <View style={styles.buttonContainer}>
          <View style={styles.space}>
            <Button
              onPress={copyToClipboard}
              mode={Platform.OS === "ios" ? "flat" : null}
              thin={true}>Copy
            </Button>
          </View>
          <View style={styles.space}>
            <Button
              onPress={onCancel}
              mode={Platform.OS === "ios" ? "flat" : null}
              thin={true}
              cancel={true}>Close</Button>
          </View>
          </View>
        </ScrollView>
        </GestureHandlerRootView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
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
