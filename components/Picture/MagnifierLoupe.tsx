import React, { type ReactNode } from 'react';
import {
  Animated,
  ImageBackground,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { LOUPE_CURSOR_SIZE_PX } from '../../utils/loupeGeometry';

export type MagnifierLoupeProps = {
  visible: boolean;
  /** Animated position/opacity styles from the hook (container-space frame). */
  frameStyle: StyleProp<Animated.WithAnimatedValue<ViewStyle>>;
  /** Animated translate styles from the hook (image-space content window). */
  contentStyle: StyleProp<Animated.WithAnimatedValue<ViewStyle>>;
  zoom: number;
  diameter: number;
  uri: string;
  imageDimensionStyle: { width: number; height: number };
  children?: ReactNode;
};

const CURSOR_THICKNESS_PX = 2;

// Dumb presentational circle (D2): receives animated styles from `useLoupe`,
// computes NOTHING positional itself — math lives in utils/loupeGeometry + hook.
export default function MagnifierLoupe({
  visible,
  frameStyle,
  contentStyle,
  zoom,
  diameter,
  uri,
  imageDimensionStyle,
  children,
}: MagnifierLoupeProps) {
  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      testID="game.picture.loupe"
      pointerEvents="none"
      style={[styles.frame, { width: diameter, height: diameter }, frameStyle]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.glass,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.content,
            {
              width: imageDimensionStyle.width * zoom,
              height: imageDimensionStyle.height * zoom,
            },
            contentStyle,
          ]}
        >
          <ImageBackground
            testID="game.picture.loupe-image"
            source={{ uri }}
            style={{
              width: imageDimensionStyle.width * zoom,
              height: imageDimensionStyle.height * zoom,
            }}
          />
          <View
            pointerEvents="none"
            style={[
              styles.childrenWrapper,
              {
                width: imageDimensionStyle.width,
                height: imageDimensionStyle.height,
                transformOrigin: 'top left',
                transform: [{ scale: zoom }],
              },
            ]}
          >
            {children}
          </View>
        </Animated.View>
      </View>
      <View
        testID="game.picture.loupe-cursor"
        pointerEvents="none"
        style={[
          styles.cursor,
          {
            left: diameter / 2 - LOUPE_CURSOR_SIZE_PX / 2,
            top: diameter / 2 - LOUPE_CURSOR_SIZE_PX / 2,
          },
        ]}
      >
        <View style={styles.cursorHorizontal} />
        <View style={styles.cursorVertical} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    // iOS shadow* + Android elevation (shadow props are iOS-only).
    // PERF (F6 ladder step 1): if the playtest shows jank from elevation
    // raster on the per-frame-translated frame, first fallback is border-only
    // or `renderToHardwareTextureAndroid` on this frame container — before any
    // code change.
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  glass: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  content: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  childrenWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  cursor: {
    position: 'absolute',
    width: LOUPE_CURSOR_SIZE_PX,
    height: LOUPE_CURSOR_SIZE_PX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cursorHorizontal: {
    position: 'absolute',
    width: LOUPE_CURSOR_SIZE_PX,
    height: CURSOR_THICKNESS_PX,
    backgroundColor: '#ffffff',
  },
  cursorVertical: {
    position: 'absolute',
    width: CURSOR_THICKNESS_PX,
    height: LOUPE_CURSOR_SIZE_PX,
    backgroundColor: '#ffffff',
  },
});
