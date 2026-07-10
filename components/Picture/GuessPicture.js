import { useState, useEffect, useLayoutEffect } from 'react';

import { handleImageOrientation } from "../../utils/orientation";
import { handlePicturePress, determineImageCorners } from "../../utils/targetLocation";

import ShowPicture from './ShowPicture';
import GameInstructions from '../Instructions/GameInstructions';
import { setImageDimensions } from '../../utils/imageDimensions';
import {
  buildE2EPictureSelection,
  getE2EHideLocation,
  getE2EIncorrectHideLocation,
  isE2EMode,
} from '../../utils/e2eMode';


export default function GuessPicture({ imageFile, description, imageIsPortrait, imageHeight, imageWidth, hiddenLocation, screenDimensions, toAdScreen, skipInstructions }) {

  const [showFilter, setShowFilter] = useState(!skipInstructions); 
  const [touchLocation, setTouchLocation] = useState(null);
  const [target, setTarget] = useState(null);
  const [showModal, setShowModal] = useState(false);

/* debug */
  /* const [showDebugModal, setShowDebugModal] = useState(false);

  const toggleDebugModal = () => {
    setShowDebugModal(!showDebugModal);
  }; */
/*  */


  const uri = imageFile;
  const screenWidth = screenDimensions.width;
  const screenHeight = screenDimensions.height;

  const isPortrait = imageIsPortrait;
  const { maxImageHeight, maxImageWidth } = setImageDimensions({ imageHeight, imageWidth, screenHeight, screenWidth, isPortrait });
  const imageDimensionStyle = { width: maxImageWidth, height: maxImageHeight };

  useLayoutEffect(() => {
    /* from "../../utils/orientation" */
    handleImageOrientation({imageIsPortrait});
  }, [imageIsPortrait]);

  useEffect(() => {
    showUpdatedLocation();
  }, [target]);

  const handleFilterClick = () => {
    setShowFilter(false);
  };

  const selectPictureLocation = ({ event, relativeLocation }) => {
    const selection = isE2EMode()
      ? buildE2EPictureSelection({
          screenWidth,
          screenHeight,
          imageDimensionStyle,
          relativeLocation,
        })
      : handlePicturePress({event, screenWidth, screenHeight, imageDimensionStyle/* , topLeft */});

    // still needed?
    //const { topLeft } = determineImageCorners({ maxImageHeight, maxImageWidth, screenHeight, screenWidth });

    /* from '../../utils/targetLocation' */
    let { location, target } = selection;
    if (location && target) {
    setTouchLocation(location)
    setTarget(target);
    };
  };

  const handlePress = (event) => {
    selectPictureLocation({
      event,
      relativeLocation: hiddenLocation ?? getE2EHideLocation(),
    });
  };

  const handleLongPress = () => {
    if (!isE2EMode()) {
      return;
    }

    selectPictureLocation({
      relativeLocation: getE2EIncorrectHideLocation(),
    });
  };

  const handleIconPress = () => {
    setShowModal(true);
  };

  const handleConfirm = () => {
    toAdScreen({ location: touchLocation, hiddenLocation, screenWidth, screenHeight, target });
  };

  const onCancel = () => {
    setShowModal(false);
  };


  const showUpdatedLocation = () => {
    return (
      <ShowPicture
        uri={uri}
        guess={true}
        description={description}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        touchLocation={touchLocation}
        handlePress={handlePress}
        handleLongPress={handleLongPress}
        target={target}
        handleIconPress={handleIconPress}
        showModal={showModal}
        handleConfirm={handleConfirm}
        onCancel={onCancel}
        imageDimensionStyle={imageDimensionStyle}
        /* for debug */
       /*  showDebugModal={showDebugModal}
        setShowDebugModal={toggleDebugModal} */
        />
    );
  };

  if (showFilter) {
    return(
      <GameInstructions
        // pictureUri only in dev with local images
        uri={uri}
        game="guess"
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
}
