import { useState, useEffect, useLayoutEffect } from 'react';

import { handleImageOrientation } from "../../utils/orientation";
import { handlePicturePress, isOnTarget } from "../../utils/targetLocation";

import ShowPicture from './ShowPicture';
export default function GuessPicture({ navigation, accountId, imageFile, pictureId, description, imageHeight, imageWidth, isPortrait, hiddenLocation, screenHeight, screenWidth }) {

  const uri = imageFile;
  const [touchLocation, setTouchLocation] = useState({ x: 0, y: 0, targetSize: 0 });
  const [target, setTarget] = useState({ locationX: 0, locationY: 0, targetSize: 0 });
  const [showModal, setShowModal] = useState(false);

  const imageIsPortrait = imageWidth < imageHeight;

  useLayoutEffect(() => {
    /* from "../../utils/orientation" */
    handleImageOrientation({imageIsPortrait});
  }, []);

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

  function handleConfirm(){
    let onTarget = isOnTarget({ location: touchLocation, hiddenLocation, screenWidth, screenHeight, target });
    navigation.navigate('AdScreen', { onTarget: onTarget, accountId: accountId, pictureId: pictureId });
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
