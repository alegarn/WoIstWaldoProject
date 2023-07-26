import ShowPicture from './ShowPicture';
import  { useState, useLayoutEffect, useEffect } from 'react';
import { handleImageOrientation } from "../../utils/orientation";
import { handlePicturePress } from '../../utils/targetLocation';
import { imageUploader } from '../../utils/fileUploader';

export default function Picture({  uri, isPortrait, imageWidth, imageHeight, screenHeight, screenWidth }) {

  const [touchLocation, setTouchLocation] = useState({ x: 0, y: 0, circleSize: 0 });
  const [circle, setCircle] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const imageIsPortrait = imageWidth < imageHeight;

  useLayoutEffect(() => {
    handleImageOrientation({ imageIsPortrait, isPortrait });
  }, []);

  useEffect(() => {
    showUpdatedLocation();
  }, [circle]);

  const handlePress = (event) => {
    let { location, circle } = handlePicturePress({event, screenWidth, screenHeight});
    setTouchLocation(location);
    setCircle(circle);
  };

  const showUpdatedLocation = () => {
    return (
      <ShowPicture
        uri={uri}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        touchLocation={touchLocation}
        handlePress={handlePress}
        circle={circle}
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
    imageUploader({ uri, imageWidth, imageHeight, screenHeight, screenWidth, isPortrait, touchLocation });
  };

  const onCancel = () => {
    setShowModal(false);
  };

  return (
    <ShowPicture
      uri={uri}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
      touchLocation={touchLocation}
      handlePress={handlePress}
      circle={circle}
      handleIconPress={handleIconPress}
      handleConfirm={handleConfirm}
      showModal={showModal}
      onCancel={onCancel} />
  );
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
