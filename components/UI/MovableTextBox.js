import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, PanResponder, StyleSheet, Pressable } from 'react-native';
import { GlobalStyle } from '../../constants/theme';

export default function MoveableTextBox({description, screenWidth, screenHeight}) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isWide, setIsWide] = useState(false);

  const positionRef = useRef(position);
  positionRef.current = position;
  const dragStartRef = useRef(position);

  const textBoxWidth = isWide ? screenWidth : 30;
  const textBoxHeight = isWide ? screenHeight : 30;

  const handleClick = useCallback(() => {
    setIsWide((prev) => !prev);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = positionRef.current;
          handleClick();
        },
        onPanResponderMove: (event, gesture) => {
          let newX = dragStartRef.current.x + gesture.dx;
          let newY = dragStartRef.current.y + gesture.dy;

          // Ensure the new position stays within the screen boundaries
          if (newX < 0) newX = 0;
          if (newX >= screenWidth) newX = screenWidth;
          if (newY < 0) newY = 0;
          if (newY >= screenHeight) newY = screenHeight;

          setPosition({ x: newX, y: newY });
        },
        onPanResponderRelease: () => {},
      }),
    [handleClick, screenHeight, screenWidth]
  );

  const textStyle = useMemo(
    () => ({
      left: position.x,
      top: position.y,
      maxWidth: textBoxWidth * 0.75,
      maxHeight: textBoxHeight * 0.75,
    }),
    [position.x, position.y, textBoxHeight, textBoxWidth]
  );

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
