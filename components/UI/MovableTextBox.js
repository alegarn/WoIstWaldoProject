import { useState } from 'react';
import { View, Text, PanResponder, StyleSheet, Pressable } from 'react-native';
import { GlobalStyle } from '../../constants/theme';

export default function MoveableTextBox({description, screenWidth, screenHeight}) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isWide, setIsWide] = useState(false);

  const textBoxWidth = isWide ? screenWidth : 30;
  const textBoxHeight = isWide ? screenHeight : 30;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderStart: () => {
      handleClick();
    },
    onPanResponderMove: (event, gesture) => {
      let newX = position.x + gesture.dx;
      let newY = position.y + gesture.dy;

      // Ensure the new position stays within the screen boundaries
      if (newX < 0) newX = 0;
      if (newX >= screenWidth) newX = screenWidth ; // Adjust the screenWidth of the text box here
      if (newY < 0) newY = 0;
      if (newY >= screenHeight) newY = screenHeight; // Adjust the height of the text box here

      setPosition({
        x: newX,
        y: newY,
      });
    },
    onPanResponderRelease: () => {
    }
  });

  const handleClick = () => {
    setIsWide(!isWide);
  };

  const textStyle = {
    left: position.x,
    top: position.y,
    maxWidth: textBoxWidth * 0.75,
    maxHeight: textBoxHeight * 0.75
  };

  return (
    <View style={styles.textBox}>
      <View style={styles.textContainer}>
        <Text
          editable={false}
          ellipsizeMode={"tail"}
          style={[styles.text, textStyle]}
          {...panResponder.panHandlers}
        >{description}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  textBox: {
    flex: 1,
    position: 'relative',
  },
  textContainer: {
    position: 'absolute',
  },
  text: {
    padding: 10,
    borderRadius: 10,
    borderColor: GlobalStyle.color.primaryColor900,
    borderWidth: 1,
    backgroundColor: GlobalStyle.color.primaryColor100,
    color: "white",
  }
});
