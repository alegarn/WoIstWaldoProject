import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';

const { width, height } = Dimensions.get('window');

const TutorialOverlay = React.forwardRef(({ onPress, targetPosition, highlightArea, instructions, instructionsPosition }, ref) => {
  const [isVisible, setIsVisible] = useState(true);

  const closeModal = () => {
    setIsVisible(false);
  };

  console.log("targetPosition", targetPosition);

  if (!targetPosition) {
    return null; // Return null or handle the case where targetPosition is null
  };

  return (
    <Modal transparent={true} animationType="fade" visible={isVisible}>
      <View style={styles.overlay}>
        {/* This is the clear area that is clickable */}
        <Pressable style={[styles.clickableArea, { top: targetPosition.top, left: targetPosition.left }]} onPress={onPress}>          {/* This could be used to show a border or some highlight */}
          <View style={[styles.highlight, { height: highlightArea.height, width: highlightArea.width }]} />        
        </Pressable>

        {/* Arrow pointing to the clickable area */}
        <View style={[styles.arrow, targetPosition ? { top: targetPosition.top + targetPosition.height, left: targetPosition.left + targetPosition.width / 2 - 10 } : {}]} />

        {/* Instruction Modal */}
        <View style={[styles.instructionModal, instructionsPosition]}>
          <Text style={styles.instructions}>{instructions}</Text>
          <Pressable onPress={closeModal} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clickableArea: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  highlight: {
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 5,
    backgroundColor: 'rgba(240, 240, 240, 0.7)',
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'white',
  },
  instructionModal: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
  },
  instructions: {
    fontSize: 16,
    color: 'black',
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#3498db',
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default TutorialOverlay;