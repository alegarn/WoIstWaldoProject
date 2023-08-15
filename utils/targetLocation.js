function determineLocation({locationX, locationY, newImageWidth, newImageHeight}) {
  const touchX = (locationX / newImageWidth).toFixed(2);
  const touchY = (locationY / newImageHeight).toFixed(2);
  const location = { x: touchX, y: touchY };
  return location;
};


function handleTargetSize(screenWidth, screenHeight) {
  // size = mode (0.1, 0.05, 0.01)
  const targetSize = Math.min(screenWidth, screenHeight) * 0.1;
  return targetSize;
};
function setTarget({ locationX, locationY, targetSize }) {
  const targetStyle = {
    position: 'absolute',
    width: targetSize,
    height: targetSize,
    /*  */
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "white",

    /*  */
    left: locationX - targetSize / 2, // Adjusted to center the icon horizontally
    top: locationY - targetSize / 2, // Adjusted to center the icon vertically
  };

  const target = { targetSize: targetSize , targetStyle: targetStyle };
  return target;
};

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
    const targetSize = handleTargetSize(screenWidth, screenHeight);
    const target = setTarget({ locationX, locationY, targetSize });

    return ({ location, target });

    };
  return null;
};

function determineCircleRadius(targetSize){
  const radius = targetSize / 2;
  return radius
};

function targetAbsoluteLocation(hiddenRelativeLocation, screenWidth, screenHeight) {
  // Convert relative coordinates to absolute coordinates
  const x = hiddenRelativeLocation.x * screenWidth;
  const y = hiddenRelativeLocation.y * screenHeight;

  // Return the absolute location as an object
  return { x, y };
};

function determineIsOnTarget({hiddenTrgtAbsLoc, guessTrgtAbsLoc, circleRadius}) {
  // Calculate the absolute distance between the hidden target and the guess target
  const distance = Math.sqrt(
    Math.pow(hiddenTrgtAbsLoc.x - guessTrgtAbsLoc.x, 2) +
    Math.pow(hiddenTrgtAbsLoc.y - guessTrgtAbsLoc.y, 2)
  );

  // Define a threshold for determining if the guess is on target
  const threshold = circleRadius*2; // Adjust this value as needed

  console.log("circleRadius", circleRadius);
  console.log("max", circleRadius*2);
  console.log("distance", distance);
  // Check if the distance is within the threshold
  if (distance <= threshold) {
    return true; // Guess is on target
  } else {
    return false; // Guess is not on target
  };
}

export const isOnTarget = ({ location, hiddenLocation, screenWidth, screenHeight }) => {

  const targetSize = handleTargetSize(screenWidth, screenHeight);
  const circleRadius = determineCircleRadius(targetSize);

  const hiddenTrgtAbsLoc = targetAbsoluteLocation(hiddenLocation, screenWidth, screenHeight);
  const guessTrgtAbsLoc = targetAbsoluteLocation(location, screenWidth, screenHeight);

  const isOnTarget = determineIsOnTarget({hiddenTrgtAbsLoc, guessTrgtAbsLoc, circleRadius})
  console.log("isOnTarget", isOnTarget);
  return isOnTarget;
};
