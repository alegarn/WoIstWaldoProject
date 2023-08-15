import  { useState, useLayoutEffect, useEffect } from 'react';

import { handleImageOrientation } from "../../utils/orientation";
import { handlePicturePress } from '../../utils/targetLocation';

import ShowPicture from './ShowPicture';
import HideGameIntructions from '../Instructions/HideGameInstructions';

export default function HidePicture({ navigation, uri, isPortrait, imageWidth, imageHeight, screenHeight, screenWidth }) {

  const [showFilter, setShowFilter] = useState(true);
  const [touchLocation, setTouchLocation] = useState({ x: 0, y: 0, targetSize: 0 });
  const [target, setTarget] = useState({ locationX: 0, locationY: 0, targetSize: 0 });
  const [showModal, setShowModal] = useState(false);


  const imageIsPortrait = imageWidth < imageHeight;

  useLayoutEffect(() => {
    /* from "../../utils/orientation" */
    handleImageOrientation({ imageIsPortrait });
  }, []);

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

  const showUpdatedLocation = () => {
    return (
      <ShowPicture
        uri={uri}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        touchLocation={touchLocation}
        handlePress={handlePress}
        target={target}
        handleIconPress={handleIconPress}
        handleConfirm={handleConfirm}
        showModal={showModal}
        onCancel={onCancel} />
    );
  }

  const handleIconPress = () => {
    setShowModal(true);
  };

  const handleConfirm = () => {
    navigation.navigate( 'SetInstructions', {
      uri: uri,
      imageWidth: imageWidth,
      imageHeight: imageHeight,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      isPortrait: isPortrait,
      touchLocation: touchLocation,
      target: target });
  };

  const onCancel = () => {
    setShowModal(false);
  };

  if (showFilter) {
    return(
      <HideGameIntructions
            uri={uri}
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
};
/*   const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
 */

/*   useEffect(() => {
    const updateScreenDimensions = () => {
      setScreenDimensions(Dimensions.get('window'));
    };

    Dimensions.addEventListener('change', updateScreenDimensions);

    return () => {
      Dimensions.removeEventListener('change', updateScreenDimensions);
    };
  }, []); */
