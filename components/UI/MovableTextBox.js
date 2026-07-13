import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, PanResponder, StyleSheet } from 'react-native';
import { GlobalStyle } from '../../constants/theme';

const TAP_THRESHOLD = 8;
const COLLAPSED_SIZE = 30;

export default function MovableTextBox({ description, screenWidth, screenHeight, defaultOpen }) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isWide, setIsWide] = useState(!!defaultOpen);

  const positionRef = useRef(position);
  positionRef.current = position;
  const dragStartRef = useRef(position);

  const textBoxWidth = isWide ? Math.min(screenWidth * 0.7, 280) : COLLAPSED_SIZE;
  const textBoxHeight = isWide ? screenHeight * 0.35 : COLLAPSED_SIZE;

  const handleClick = useCallback(() => {
    setIsWide((prev) => !prev);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = positionRef.current;
        },
        onPanResponderMove: (event, gesture) => {
          let newX = dragStartRef.current.x + gesture.dx;
          let newY = dragStartRef.current.y + gesture.dy;

          if (newX < 0) newX = 0;
          if (newX >= screenWidth) newX = screenWidth;
          if (newY < 0) newY = 0;
          if (newY >= screenHeight) newY = screenHeight;

          setPosition({ x: newX, y: newY });
        },
        onPanResponderRelease: (_event, gesture) => {
          const moved = Math.hypot(gesture.dx, gesture.dy);
          if (moved < TAP_THRESHOLD) {
            handleClick();
          }
        },
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
