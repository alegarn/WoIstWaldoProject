import  { useState, useLayoutEffect } from 'react';

import { handleImageOrientation } from "../../utils/orientation";
import { handlePicturePress } from '../../utils/targetLocation';

import ShowPicture from './ShowPicture';
import GameInstructions from '../Instructions/GameInstructions';

import { setImageDimensions } from '../../utils/imageDimensions';
import TutorialOverlay from '../UI/TutorialOverlay';
import { buildE2EPictureSelection, getE2EHideLocation, isE2EMode } from '../../utils/e2eMode';


export default function HidePicture({ 
  navigation, 
  uri, 
  imageIsPortrait, 
  imageWidth, 
  imageHeight, 
  screenDimensions, 
  isTutorial,
  scope }) {

  const [showFilter, setShowFilter] = useState(true);
  const [touchLocation, setTouchLocation] = useState(null);
  const [target, setTarget] = useState(null);
  const [showModal, setShowModal] = useState(false);

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

  const handlePress = (event) => {
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
      renderPicture()
    );
  };
};
