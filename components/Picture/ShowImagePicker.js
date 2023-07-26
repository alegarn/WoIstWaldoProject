import { View, Text, Button, StyleSheet } from 'react-native';
import BigButton from '../UI/BigButton';

export default function ShowImagePicker({ takePictureHandler }) {

  return (
    <View style={styles.container}>
      <View style={styles.buttonsContainer}>
        <BigButton text="Take a Picture" onPress={takePictureHandler}/>
        <BigButton text="Select an Image" onPress={() => {}}/>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
