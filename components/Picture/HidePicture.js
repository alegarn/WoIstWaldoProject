import  { useState, useLayoutEffect, useEffect } from 'react';

import { handleImageOrientation } from "../../utils/orientation";
import { handlePicturePress, determineImageCorners } from '../../utils/targetLocation';

import ShowPicture from './ShowPicture';
import GameInstructions from '../Instructions/GameInstructions';

import { setImageDimensions } from '../../utils/imageDimensions';


export default function HidePicture({ navigation, uri, imageIsPortrait, imageWidth, imageHeight, screenDimensions}) {

  const [showFilter, setShowFilter] = useState(true);
  const [touchLocation, setTouchLocation] = useState({ x: 0, y: 0, targetSize: 0 });
  const [target, setTarget] = useState({ locationX: 0, locationY: 0, targetSize: 0 });
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

  useEffect(() => {
    showUpdatedLocation();
  }, [target]);

  const handleFilterClick = () => {
    setShowFilter(false);
  };

  const handlePress = (event) => {

    const { topLeft } = determineImageCorners({ maxImageHeight, maxImageWidth, screenHeight, screenWidth });

    /* from '../../utils/targetLocation' */
    let { location, target } = handlePicturePress({event, screenWidth, screenHeight, imageDimensionStyle, topLeft});
    if (location && target) {
    setTouchLocation(location)
    setTarget(target);
    };
  };

  const showUpdatedLocation = () => {
    return (
      <ShowPicture
        uri={uri}
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
    navigation.navigate( 'SetInstructions', {
      uri: uri,
      imageWidth: imageWidth,
      imageHeight: imageHeight,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      isPortrait: imageIsPortrait,
      touchLocation: touchLocation,
      target: target,
      imageDimensionStyle: imageDimensionStyle
    });
  };

  const onCancel = () => {
    setShowModal(false);
  };

  if (showFilter) {
    return(
      <GameInstructions
        game="hide"
        uri={uri}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        imageIsPortrait={imageIsPortrait}
        handleFilterClick={handleFilterClick}
        imageDimensionStyle={imageDimensionStyle} />
    );
  };

  if (!showFilter) {
    return(
      showUpdatedLocation()
    );
  };
};
