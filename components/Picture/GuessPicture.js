import { useState, useEffect, useLayoutEffect } from 'react';

import { handleImageOrientation } from "../../utils/orientation";
import { handlePicturePress } from "../../utils/targetLocation";

import ShowPicture from './ShowPicture';
export default function GuessPicture({ imageFile, imageHeight, imageWidth, hiddenLocation, screenHeight, screenWidth, toAdScreen }) {

  const uri = imageFile;
  const [touchLocation, setTouchLocation] = useState({ x: 0, y: 0, targetSize: 0 });
  const [target, setTarget] = useState({ locationX: 0, locationY: 0, targetSize: 0 });
  const [showModal, setShowModal] = useState(false);

  const imageIsPortrait = imageWidth < imageHeight;

  useLayoutEffect(() => {
    /* from "../../utils/orientation" */
    handleImageOrientation({imageIsPortrait});
    console.log("imageIsPortrait ??? ", imageIsPortrait);
  }, [imageIsPortrait]);

  useEffect(() => {
    showUpdatedLocation();
  }, [target]);

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

  const showUpdatedLocation = () => {
    return (
      <ShowPicture
        // pictureUri only in dev with local images
        pictureUri={uri}
        guess={false}
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

  return (
    showUpdatedLocation()
  );
}
