import { View, Pressable, StyleSheet, ImageBackground } from 'react-native';

import IconButton from '../UI/IconButton';
import CenteredModal from '../UI/CenteredModal';
import EnigmaOverlay from './Descriptions/EnigmaOverlay';
import { GlobalStyle } from '../../constants/theme';

export default function ShowPicture({ uri, guess, description, touchLocation, handlePress, handleLongPress, target, handleIconPress, showModal, handleConfirm,  onCancel, imageDimensionStyle, targetPanHandlers, defaultOpen }) {

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
              <EnigmaOverlay description={description} screenHeight={imageDimensionStyle.height} defaultOpen={defaultOpen}/>
            ) : null }
          </ImageBackground>

        </Pressable>

{/* no cross, when guess, if null  */}
        {touchLocation && target?.dragStyle && (
          <View
            {...(targetPanHandlers || {})}
            style={[target.dragStyle, styles.dragRing]}
            testID={guess ? 'game.picture.guess-target-wrap' : 'game.picture.hide-target-wrap'}
          >
            <IconButton accessibilityLabel="Clear selected point" icon={"close-circle-outline"} color={"white"} size={target.targetSize} onPress={handleIconPress} testID={guess ? 'game.picture.clear-guess' : 'game.picture.clear-hide'}/>
          </View>
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
  dragRing: {
    borderWidth: 2,
    borderColor: GlobalStyle.color.primaryColor,
    backgroundColor: 'transparent',
  },
});
