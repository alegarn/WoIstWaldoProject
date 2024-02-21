import { useState, useEffect, useLayoutEffect } from 'react';

import { handleImageOrientation } from "../../utils/orientation";
import { handlePicturePress, determineImageCorners } from "../../utils/targetLocation";

import ShowPicture from './ShowPicture';
import GameInstructions from '../Instructions/GameInstructions';
import { setImageDimensions } from '../../utils/imageDimensions';


export default function GuessPicture({ imageFile, description, imageIsPortrait, imageHeight, imageWidth, hiddenLocation, screenDimensions, toAdScreen }) {

  const [showFilter, setShowFilter] = useState(true); 
  const [touchLocation, setTouchLocation] = useState({ x: 0, y: 0, targetSize: 0 });
  const [target, setTarget] = useState({ locationX: 0, locationY: 0, targetSize: 0 });
  const [showModal, setShowModal] = useState(false);

/* debug */
  const [showDebugModal, setShowDebugModal] = useState(false);

  const toggleDebugModal = () => {
    setShowDebugModal(!showDebugModal);
  };
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

  const handlePress = (event) => {
    // still needed?
    //const { topLeft } = determineImageCorners({ maxImageHeight, maxImageWidth, screenHeight, screenWidth });

    /* from '../../utils/targetLocation' */
    let { location, target } = handlePicturePress({event, screenWidth, screenHeight, imageDimensionStyle/* , topLeft */});
    if (location && target) {
    setTouchLocation(location)
    setTarget(target);
    };
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
        target={target}
        handleIconPress={handleIconPress}
        showModal={showModal}
        handleConfirm={handleConfirm}
        onCancel={onCancel}
        imageDimensionStyle={imageDimensionStyle}
        /*  */
        showDebugModal={showDebugModal}
        setShowDebugModal={toggleDebugModal}
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
