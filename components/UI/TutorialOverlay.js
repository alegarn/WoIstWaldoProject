import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { INSTRUCTIONS } from '../../constants/instructions';

const TutorialOverlay =({ screen, instructionsPosition}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [instructions, setInstructions] = useState("instructions");
  const [closeButtonText, setCloseButtonText] = useState("Close");

  const closeModal = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    setInstructions(INSTRUCTIONS.Tutorial[`${screen}`]); 
    setCloseButtonText(INSTRUCTIONS.Tutorial[`${screen}ModalBtn`]);  
  }, [screen]);

  return (
    <Modal transparent={true} animationType="fade" visible={isVisible}>
      <View style={styles.overlay}>
        {/* This is the clear area that is clickable */}
        {/* <Pressable 
          style={[styles.clickableArea, { top: targetPosition?.top, left: targetPosition?.left }]} 
          onPress={onPress}
          > */}          
          {/* This could be used to show a border or some highlight */}
          {/* <View style={[styles.highlight, { height: highlightArea?.height, width: highlightArea?.width }]} />        
        </Pressable> */}

        {/* Arrow pointing to the clickable area */}
{/*         <View style={[styles.arrow, targetPosition ?? { top: targetPosition?.top + highlightArea?.height, left: targetPosition?.left + highlightArea?.width / 2 - 10 } ]} />
 */}
        {/* Instruction Modal */}
        <ScrollView style={[styles.instructionModal, instructionsPosition]}>
          <Image source={require('../../assets/tutorial/farm_pict_320.jpg')} style={styles.image}/>
          <Text style={styles.instructions}>{instructions}</Text>
          <Pressable onPress={closeModal} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{closeButtonText}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    maxWidth: '100%',
    minHeight: 80,
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
    width: '80%',
    maxHeight: '90%',
    alignContent: 'center',
  },
  instructions: {
    fontSize: 18,
    color: 'black',
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 20,
    marginBottom: 40,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#3498db',
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default TutorialOverlay;