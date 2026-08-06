import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Animated } from 'react-native';

import IconButton from '../../UI/IconButton';
import { OverlayZIndex } from '../../../constants/overlayZIndex';
import { GlobalStyle } from '../../../constants/theme';

const PANEL_HEIGHT_RATIO = 0.35;
const PANEL_MIN_HEIGHT = 120;
const CLOSE_ICON_SIZE = 24;

function buildPanelHeight(screenHeight) {
  const computed = Math.round(screenHeight * PANEL_HEIGHT_RATIO);
  return Math.max(computed, PANEL_MIN_HEIGHT);
}

// Controlled enigma overlay. The legacy PanResponder-based handle lived in this
// separate higher-zIndex subtree, where it intercepted touches in the bottom
// 28px and the target circle's responder chain was never consulted there. The
// handle is removed; the open-surface up-swipe now lives in the picture subtree
// (ShowPicture's nested RNGH surface detector) and drives `isOpen` from the
// parent. This component is purely presentational.
export default function EnigmaOverlay({ description, screenHeight, isOpen, onClose }) {
  const panelHeight = buildPanelHeight(screenHeight);
  const text = description && description !== '' ? description : 'No description';

  if (!isOpen) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: OverlayZIndex.ENIGMA_ROOT, elevation: OverlayZIndex.ENIGMA_ROOT }]}>
      <Pressable
        accessibilityLabel="Close enigma"
        accessibilityRole="button"
        onPress={() => onClose?.()}
        style={styles.scrim}
        testID="guess.enigma.scrim"
      />
      <Animated.View
        style={[styles.panel, { height: panelHeight }]}
        testID="guess.enigma.panel"
      >
        <View style={styles.panelHeader}>
          <IconButton
            accessibilityLabel="Close enigma"
            color="white"
            icon="chevron-down"
            onPress={() => onClose?.()}
            size={CLOSE_ICON_SIZE}
            testID="guess.enigma.close"
          />
        </View>
        <Text style={styles.text} testID="guess.enigma.text">{text}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    zIndex: OverlayZIndex.ENIGMA_SCRIM,
    elevation: OverlayZIndex.ENIGMA_SCRIM,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: GlobalStyle.color.primaryColor900,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    zIndex: OverlayZIndex.ENIGMA_PANEL,
    elevation: OverlayZIndex.ENIGMA_PANEL,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
