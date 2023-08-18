import { useState, useEffect, useLayoutEffect } from 'react';

import { handleImageOrientation } from "../../utils/orientation";
import { handlePicturePress } from "../../utils/targetLocation";

import ShowPicture from './ShowPicture';
import GameInstructions from '../Instructions/GameInstructions';



export default function GuessPicture({ imageFile, description, imageIsPortrait, hiddenLocation, screenHeight, screenWidth, toAdScreen }) {


  const uri = imageFile;

  const [showFilter, setShowFilter] = useState(true);
  const [touchLocation, setTouchLocation] = useState({ x: 0, y: 0, targetSize: 0 });
  const [target, setTarget] = useState({ locationX: 0, locationY: 0, targetSize: 0 });
  const [showModal, setShowModal] = useState(false);


  useLayoutEffect(() => {
    /* from "../../utils/orientation" */
    handleImageOrientation({imageIsPortrait});
    console.log("imageIsPortrait ??? ", imageIsPortrait);
  }, [imageIsPortrait]);

  useEffect(() => {
    showUpdatedLocation();
  }, [target]);


  const handleFilterClick = () => {
    setShowFilter(false);
  };

  const handlePress = (event) => {
    /* from '../../utils/targetLocation' */
    let { location, target } = handlePicturePress({event, screenWidth, screenHeight});
    setTouchLocation(location);
    setTarget(target);
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

  const toggleDescription = () => {
    setShowFullDescription(!showFullDescription);
  };

  const showUpdatedLocation = () => {
    return (
      <ShowPicture
        // pictureUri only in dev with local images
        pictureUri={uri}
        guess={true}
        description={description}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        touchLocation={touchLocation}
        hiddenLocation={hiddenLocation}
        handlePress={handlePress}
        target={target}
        handleIconPress={handleIconPress}
        showModal={showModal}
        handleConfirm={handleConfirm}
        onCancel={onCancel} />
    );
  }

  if (showFilter) {
    return(
      <GameInstructions
            // pictureUri only in dev with local images
            pictureUri={uri}

            game="guess"
            screenWidth={screenWidth}
            screenHeight={screenHeight}
            handleFilterClick={handleFilterClick} />
    );
  };

  if (!showFilter) {
    return(
      showUpdatedLocation()
    );
  };
}
