import  { useState, useLayoutEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { handleImageOrientation } from "../../utils/orientation";
import { handlePicturePress } from '../../utils/targetLocation';

import ShowPicture from './ShowPicture';
import GameInstructions from '../Instructions/GameInstructions';

import { setImageDimensions } from '../../utils/imageDimensions';
import TutorialOverlay from '../UI/TutorialOverlay';
import { buildE2EPictureSelection, E2E_SHAPE_POLYGON, getE2EHideLocation, isE2EMode } from '../../utils/e2eMode';
import { GlobalStyle } from '../../constants/theme';

const MODE_OPTIONS = [
  { value: 'point', labelKey: 'hide.modePoint' },
  { value: 'shape', labelKey: 'hide.modeShape' },
];


export default function HidePicture({
  navigation,
  uri,
  imageIsPortrait,
  imageWidth,
  imageHeight,
  screenDimensions,
  isTutorial,
  scope }) {

  const { t } = useTranslation();
  const [showFilter, setShowFilter] = useState(true);
  const [mode, setMode] = useState('point');
  const [outline, setOutline] = useState(null);
  const [touchLocation, setTouchLocation] = useState(null);
  const [target, setTarget] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const isShapeMode = mode === 'shape';

  const screenWidth = screenDimensions.width;
  const screenHeight = screenDimensions.height;

  const isPortrait = imageIsPortrait;
  const { maxImageHeight, maxImageWidth } = setImageDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, isPortrait });
  const imageDimensionStyle = { width: maxImageWidth, height: maxImageHeight };

  useLayoutEffect(() => {
    /* from "../../utils/orientation" */
    handleImageOrientation({ imageIsPortrait });
  }, [navigation]);

  const handleFilterClick = () => {
    setShowFilter(false);
  };

  const handleModeSelect = (nextMode) => {
    setMode(nextMode);
    if (nextMode !== 'shape') {
      setOutline(null);
      return;
    }
    if (isE2EMode()) {
      applyOutline(E2E_SHAPE_POLYGON.map((point) => ({ ...point })));
    }
  };

  // Shape surface output: a drawable outline auto-opens the confirm modal
  // (the only opener in shape mode — the clear-hide icon needs a point
  // selection); a null (degenerate/redraw) just clears it.
  const applyOutline = (nextOutline) => {
    setOutline(nextOutline);
    if (nextOutline) {
      setShowModal(true);
    }
  };

  const handleOutlineChange = (nextOutline) => {
    applyOutline(nextOutline);
  };

  const handlePress = (event) => {
    if (isShapeMode) {
      return;
    }
    const selection = isE2EMode()
      ? buildE2EPictureSelection({
          screenWidth,
          screenHeight,
          imageDimensionStyle,
          relativeLocation: getE2EHideLocation(),
        })
      : handlePicturePress({event, screenWidth, screenHeight, imageDimensionStyle});

    /* from '../../utils/targetLocation' */
    let { location, target } = selection;
    if (location && target) {
    setTouchLocation(location)
    setTarget(target);
    };
  };

  const renderModePicker = () => {
    return (
      <View style={styles.modePicker} testID="game.picture.mode-picker">
        <Text style={styles.modeLabel}>{t('hide.modeLabel')}</Text>
        {MODE_OPTIONS.map(({ value, labelKey }) => (
          <Pressable
            key={value}
            onPress={() => handleModeSelect(value)}
            style={[styles.modeChip, mode === value && styles.modeChipSelected]}
            testID={`game.picture.mode-chip-${value}`}
          >
            <Text style={[styles.modeChipText, mode === value && styles.modeChipTextSelected]}>
              {t(labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderPicture = () => {
    return (
      <ShowPicture
        uri={uri}
        guess={false}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        isPortrait={imageIsPortrait}
        touchLocation={touchLocation}
        handlePress={handlePress}
        target={target}
        handleIconPress={handleIconPress}
        showModal={showModal}
        handleConfirm={handleConfirm}
        onCancel={onCancel}
        imageDimensionStyle={imageDimensionStyle}
        {...(isShapeMode ? { shapeMode: true, outline: outline, onOutlineChange: handleOutlineChange } : {})}
        />
    );
  }

  const handleIconPress = () => {
    setShowModal(true);
  };

  const handleConfirm = () => {
    setShowModal(false);
    const routeParams = {
      uri: uri,
      imageWidth: imageWidth,
      imageHeight: imageHeight,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      isPortrait: imageIsPortrait,
      touchLocation: touchLocation,
      target: target,
      imageDimensionStyle: imageDimensionStyle,
      isTutorial: isTutorial,
      ...(isShapeMode ? { mode: mode, shape: outline } : {}),
    };

    if (scope?.kind === 'private') {
      routeParams.scope = scope;
    }

    navigation.navigate( 'SetInstructions', {
      ...routeParams,
    });
  };

  const onCancel = () => {
    setShowModal(false);
  }; 

  if (showFilter) {
    return(
      <>
        <GameInstructions
          game="hide"
          uri={uri}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          imageIsPortrait={imageIsPortrait}
          handleFilterClick={handleFilterClick}
          imageDimensionStyle={imageDimensionStyle} />
        {
          isTutorial &&
           <TutorialOverlay
            screen={"HideScreen"}
            isPortrait={imageIsPortrait}
            instructionsPosition={{top:0, left: 0}}
           />
        }
      </>
      
    );
  };

  if (!showFilter) {
    return(
      <>
        {renderModePicker()}
        {renderPicture()}
      </>
    );
  };
};

const styles = StyleSheet.create({
  modePicker: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: GlobalStyle.color.scrim,
  },
  modeLabel: {
    color: GlobalStyle.color.onSurface,
    fontSize: 14,
  },
  modeChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GlobalStyle.color.onSurface,
  },
  modeChipSelected: {
    backgroundColor: GlobalStyle.color.primaryColor500,
    borderColor: GlobalStyle.color.primaryColor500,
  },
  modeChipText: {
    color: GlobalStyle.color.onSurface,
    fontSize: 14,
  },
  modeChipTextSelected: {
    fontWeight: 'bold',
  },
});
