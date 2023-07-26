function determineLocation({locationX, locationY, newImageWidth, newImageHeight}) {
  const touchX = (locationX / newImageWidth).toFixed(2);
  const touchY = (locationY / newImageHeight).toFixed(2);
  const location = { x: touchX, y: touchY };
  return location;
};

function setCircle({ locationX, locationY, screenWidth, screenHeight }) {
  const circleSize = Math.min(screenWidth, screenHeight) * 0.1;
  const circleStyle = {
    position: 'absolute',
    width: circleSize,
    height: circleSize,
    borderRadius: circleSize / 2,
    left: locationX - circleSize / 2,
    top: locationY - circleSize / 2,
  };

  const circle = { circleSize: circleSize, circleStyle: circleStyle };
  return circle;
}

export const handlePicturePress = ({event, screenHeight, screenWidth}) => {
  const { locationX, locationY } = event.nativeEvent;
  const newImageWidth = screenWidth;
  const newImageHeight = screenHeight;
  // Check if the touch event is within the image boundaries
  if (
    locationX >= 0 &&
    locationX <= newImageWidth &&
    locationY >= 0 &&
    locationY <= newImageHeight
  ) {

    const location = determineLocation({ locationX, locationY, newImageWidth, newImageHeight });
    const circle = setCircle({ locationX, locationY, screenWidth, screenHeight });

    return ({ location, circle });

    }
  return null
};
