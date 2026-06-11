import { View, Pressable, StyleSheet, ImageBackground } from 'react-native';

import IconButton from '../UI/IconButton';
import CenteredModal from '../UI/CenteredModal';
import MoveableTextBox from '../UI/MovableTextBox';

//debug
//import { useEffect, useLayoutEffect, useState } from 'react';
//import ClipboardModal from '../UI/ClipboardModal';

export default function ShowPicture({ /* hiddenLocation,  showDebugModal, setShowDebugModal,*/ uri, guess, description, /* screenWidth, screenHeight, isPortrait, */  touchLocation, handlePress, handleLongPress, target, handleIconPress, showModal, handleConfirm,  onCancel, imageDimensionStyle }) {

/* mode debug */
/*  const [debugText, setDebugText] = useState("");

   useEffect(() => {
    const text = `touchLocation, guess, target \n\n
    Those are datas to help me debug your phone (location, guess, target): \n
    touchLocation:
    if not like {}, problem
    is: ${JSON.stringify(touchLocation)} \n 
    guess: is ${guess} \n
    if undefinied/null, problem
    target: like {}, if not,problem 
    is: ${JSON.stringify(target)} \n
    Other bug ? 
    add it here: \n`
    setDebugText(text)
    setShowDebugModal();
  }, [touchLocation]);

  useLayoutEffect(() => {
    Alert.alert("Debug", `Tap on the screen, if the little target cannot be seen, copy the text from the modal (pop up) \n\n Button "Copy \n\n
    mail: alexgarnier78310@protonmail.com`);
  }, []); */

  /* mode debug */

  return (
    <View style={styles.container} >
      <View style={[styles.pressable, imageDimensionStyle]}>
        <Pressable
          accessibilityLabel={guess ? 'Guess picture surface' : 'Hide picture surface'}
          onPress={handlePress}
          onLongPress={handleLongPress}
          style={StyleSheet.absoluteFill}
          testID={guess ? 'game.picture.guess-surface' : 'game.picture.hide-surface'}
        >
          <ImageBackground
            accessibilityLabel={guess ? 'Guess picture image' : 'Hide picture image'}
            source={{uri : uri}}
            resizeMode='stretch'
            style={styles.image}
            testID={guess ? 'game.picture.guess-image' : 'game.picture.hide-image'}
          >
{/* target not showing for guessscreen */}
            { guess ? (
              <MoveableTextBox description={description} screenHeight={imageDimensionStyle.height} screenWidth={imageDimensionStyle.width}/>
            ) : null }

            {/* {hiddenLocation && (
              <IconButton icon={"close-circle-outline"} color={"green"} size={target.targetSize} style={hiddenTargetStyle}/>
            )} */}

            {}
          </ImageBackground>

        </Pressable>

{/* no cross, when guess, if null  */}
        {touchLocation && target?.targetStyle && (
          <IconButton accessibilityLabel="Clear selected point" icon={"close-circle-outline"} color={"white"} size={target.targetSize} onPress={handleIconPress} style={target.targetStyle} testID={guess ? 'game.picture.clear-guess' : 'game.picture.clear-hide'}/>
        )}
      </View>



      {
        showModal &&
          <CenteredModal 
            onPress={handleConfirm} 
            onCancel={onCancel} 
            isModalVisible={showModal}
            testIDPrefix={guess ? 'game.picture.guess-modal' : 'game.picture.hide-modal'}
          >
            {"Do you want to validate this ?"}
          </CenteredModal>
      }
{/*  */}
{/*         { showDebugModal ?
        <ClipboardModal 
          onPress={setShowDebugModal} 
          onCancel={setShowDebugModal} 
          isModalVisible={showDebugModal} 
          debugText={debugText}>
        </ClipboardModal> : null} */}
{/*  */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressable: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  locationText: {
    position: 'absolute',
    bottom: 90,
    left: 50,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
  },
  target: {
    borderColor: 'white',
  },
  descriptionViewStyle: {
    justifyContent: "space",
    alignItems: "center",
    overflow: "scroll",
  },
  descriptionTitleStyle: {
    fontWeight: "bold",
  },
  descriptionTextStyle: {
    padding: 10
  }
});


  /*  */
/*
  function handletargetSize(screenWidth, screenHeight) {
    const targetSize = Math.min(screenWidth, screenHeight) * 0.1;
    return targetSize;
  };

  const targetSize = handletargetSize(screenWidth, screenHeight);

  const hiddenTargetStyle = {
    position: 'absolute',
    width: targetSize,
    height: targetSize,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "white",
    borderRadius: 0,

    left: hiddenLocation ? (hiddenLocation.x * screenWidth - targetSize / 2) : null,
    top: hiddenLocation ? (hiddenLocation.y * screenHeight - targetSize / 2): null,
  }; */

  /*  */
